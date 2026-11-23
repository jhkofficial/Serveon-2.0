import type {
  CampaignRecord,
  CustomerRecord,
  DashboardFilters,
  DateRangeKey,
  IndustryProfile,
  KpiCardMetric,
  Tenant,
} from '../../types/platform';

const REFERENCE_DATE = new Date(Date.UTC(2026, 10, 20)); // 2026-11-20

export function getCutoffDateIso(range: DateRangeKey): string {
  const d = new Date(REFERENCE_DATE.getTime());
  if (range === '30d') d.setUTCDate(d.getUTCDate() - 30);
  else if (range === '90d') d.setUTCDate(d.getUTCDate() - 90);
  else if (range === '6m') d.setUTCMonth(d.getUTCMonth() - 6);
  else d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function formatIdrCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `IDR ${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `IDR ${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `IDR ${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `IDR ${(value / 1_000).toFixed(0)}K`;
  return `IDR ${Math.round(value).toLocaleString('en-US')}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function filterScopedCustomers(
  customers: CustomerRecord[],
  permittedRegionIds: string[],
  permittedBranchIds: string[],
  filters: DashboardFilters
): CustomerRecord[] {
  const regionSet = new Set(permittedRegionIds);
  const branchSet = new Set(permittedBranchIds);

  return customers.filter((c) => {
    if (!regionSet.has(c.region_id)) return false;
    if (!branchSet.has(c.branch_id)) return false;
    if (filters.regionId !== 'ALL' && c.region_id !== filters.regionId) return false;
    if (filters.segment !== 'ALL' && c.customer_segment !== filters.segment) return false;
    return true;
  });
}

export interface MonthlyTrendPoint {
  month: string;
  revenueMillions: number;
  activeCustomers: number;
  transactions: number;
}

export interface SegmentDistributionItem {
  segment: string;
  count: number;
  sharePct: number;
  avgLtv: number;
  color: string;
}

export interface RegionalPerformanceRow {
  regionId: string;
  regionName: string;
  customers: number;
  activeRatePct: number;
  atRiskCount: number;
  revenue: number;
  opportunityScore: number;
  branchCount: number;
}

export interface RecommendedActionItem {
  id: string;
  title: string;
  targetSummary: string;
  regionName: string;
  estimatedImpact: string;
  priority: 'High' | 'Medium';
  suggestedChannel: string;
  segment: string;
  regionId: string;
}

export interface DashboardAnalyticsSnapshot {
  kpis: KpiCardMetric[];
  monthlyTrends: MonthlyTrendPoint[];
  segments: SegmentDistributionItem[];
  regionalPerformance: RegionalPerformanceRow[];
  recommendedActions: RecommendedActionItem[];
  aiInsightCards: Array<{
    id: string;
    category: 'Retention' | 'Opportunity' | 'Location' | 'Activation';
    headline: string;
    evidence: string;
    confidenceLabel: string;
  }>;
  totalFilteredCustomers: number;
  totalPeriodRevenue: number;
}

const SEGMENT_COLORS: Record<string, string> = {
  'High-Value Loyal': '#102B4D',
  'Growth Potential': '#1769AA',
  'Core Active': '#16A6BD',
  'At-Risk Retention': '#D9534F',
  'New Onboarding': '#64748B',
};

export function computeDashboardAnalytics(params: {
  tenant: Tenant;
  industry: IndustryProfile;
  allCustomers: CustomerRecord[];
  campaigns: CampaignRecord[];
  permittedRegionIds: string[];
  permittedBranchIds: string[];
  filters: DashboardFilters;
}): DashboardAnalyticsSnapshot {
  const { tenant, industry, allCustomers, campaigns, permittedRegionIds, permittedBranchIds, filters } = params;
  const scopedCustomers = filterScopedCustomers(
    allCustomers,
    permittedRegionIds,
    permittedBranchIds,
    filters
  );

  const cutoffIso = getCutoffDateIso(filters.dateRange);
  const totalCustomers = scopedCustomers.length;
  const activeCustomers = scopedCustomers.filter((c) => c.status === 'Active').length;
  const atRiskCustomers = scopedCustomers.filter(
    (c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk'
  ).length;
  const growthOpportunities = scopedCustomers.filter(
    (c) => c.model_outputs.purchase_propensity_score >= 68
  ).length;

  const retentionRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

  // Period transactions within selected date range
  let totalPeriodRevenue = 0;
  let totalPeriodTxCount = 0;
  for (const c of scopedCustomers) {
    for (const tx of c.transactions) {
      if (tx.date >= cutoffIso) {
        totalPeriodRevenue += tx.amount;
        totalPeriodTxCount += 1;
      }
    }
  }

  // Average Geographic Opportunity Score
  const avgGeoScore =
    totalCustomers > 0
      ? scopedCustomers.reduce((acc, c) => acc + c.model_outputs.geographic_opportunity_score, 0) /
        totalCustomers
      : 0;

  // Campaign Conversion Rate across tenant campaigns matching region filter
  const matchingCampaigns = campaigns.filter(
    (cmp) =>
      cmp.tenant_id === tenant.id &&
      (filters.regionId === 'ALL' || cmp.regionId === 'ALL' || cmp.regionId === filters.regionId)
  );
  const completedOrSimulated = matchingCampaigns.filter(
    (c) => c.status === 'Completed' || c.status === 'Simulated Execution'
  );
  const avgConversionRate =
    completedOrSimulated.length > 0
      ? completedOrSimulated.reduce((acc, c) => acc + c.estimatedConversionRate, 0) /
        completedOrSimulated.length
      : matchingCampaigns.length > 0
        ? matchingCampaigns.reduce((acc, c) => acc + c.estimatedConversionRate, 0) /
          matchingCampaigns.length
        : 0;

  // Deterministic period delta derived from data ratios (never random)
  const rangeFactor = filters.dateRange === '30d' ? 0.6 : filters.dateRange === '90d' ? 0.85 : filters.dateRange === '6m' ? 1 : 1.15;
  const retentionDelta = Number(((retentionRate - 74) * 0.18 * rangeFactor).toFixed(1));
  const growthDelta = Number(((growthOpportunities / Math.max(1, totalCustomers)) * 18 * rangeFactor).toFixed(1));
  const revenueDelta = Number(((totalPeriodTxCount / Math.max(1, totalCustomers)) * 4.2 * rangeFactor).toFixed(1));

  const kpis: KpiCardMetric[] = [
    {
      id: 'total_customers',
      label: `Total ${industry.terminology.customerPlural}`,
      formattedValue: formatNumber(totalCustomers),
      rawValue: totalCustomers,
      deltaPct: Number((4.8 * rangeFactor).toFixed(1)),
      deltaLabel: 'vs prior baseline',
      trendDirection: 'up',
      tone: 'neutral',
      formulaTitle: `How Total ${industry.terminology.customerPlural} is calculated`,
      formulaDescription: `Count of distinct synthetic ${industry.terminology.customerPlural.toLowerCase()} within your authorized tenant, region, branch, and segment scope.`,
      dataScopeNote: `Demo Data · ${tenant.shortName} · ${totalCustomers} records matched`,
    },
    {
      id: 'active_customers',
      label: `Active ${industry.terminology.customerPlural}`,
      formattedValue: formatNumber(activeCustomers),
      rawValue: activeCustomers,
      deltaPct: Number((3.4 * rangeFactor).toFixed(1)),
      deltaLabel: `${retentionRate.toFixed(1)}% of total`,
      trendDirection: 'up',
      tone: 'positive',
      formulaTitle: `How Active ${industry.terminology.customerPlural} is calculated`,
      formulaDescription: `Count of scoped records with lifecycle status = Active (recent transaction or service engagement without churn alert).`,
      dataScopeNote: `Demo Data · Active / Total = ${activeCustomers} / ${totalCustomers}`,
    },
    {
      id: 'retention_rate',
      label: industry.terminology.retentionMetricLabel,
      formattedValue: `${retentionRate.toFixed(1)}%`,
      rawValue: retentionRate,
      deltaPct: retentionDelta,
      deltaLabel: 'vs benchmark 74.0%',
      trendDirection: retentionDelta >= 0 ? 'up' : 'down',
      tone: retentionRate >= 74 ? 'positive' : 'warning',
      formulaTitle: `How ${industry.terminology.retentionMetricLabel} is calculated`,
      formulaDescription: `(Active ${industry.terminology.customerPlural} ÷ Total Scoped ${industry.terminology.customerPlural}) × 100. Derived strictly from the active filtered demo dataset.`,
      dataScopeNote: `Demo Data · Industry Profile: ${industry.name}`,
    },
    {
      id: 'growth_opportunities',
      label: 'Growth Opportunities',
      formattedValue: formatNumber(growthOpportunities),
      rawValue: growthOpportunities,
      deltaPct: growthDelta,
      deltaLabel: 'propensity >= 68%',
      trendDirection: 'up',
      tone: 'positive',
      formulaTitle: 'How Growth Opportunities is calculated',
      formulaDescription:
        'Count of scoped customers whose simulated purchase or cross-sell propensity score is >= 68/100 (Illustrative AI Simulation).',
      dataScopeNote: 'Illustrative AI Simulation · Threshold >= 68%',
    },
    {
      id: 'at_risk_customers',
      label: `At-Risk ${industry.terminology.customerPlural}`,
      formattedValue: formatNumber(atRiskCustomers),
      rawValue: atRiskCustomers,
      deltaPct: Number((-((atRiskCustomers / Math.max(1, totalCustomers)) * 10)).toFixed(1)),
      deltaLabel: `${((atRiskCustomers / Math.max(1, totalCustomers)) * 100).toFixed(1)}% of base`,
      trendDirection: 'down',
      tone: atRiskCustomers > totalCustomers * 0.2 ? 'critical' : 'warning',
      formulaTitle: `How At-Risk ${industry.terminology.customerPlural} is calculated`,
      formulaDescription:
        'Count of customers flagged with High churn risk (>= 65/100) or At-Risk lifecycle status requiring proactive retention outreach.',
      dataScopeNote: 'Illustrative AI Simulation · High Risk >= 65',
    },
    {
      id: 'campaign_conversion',
      label: 'Campaign Conversion',
      formattedValue: `${avgConversionRate.toFixed(1)}%`,
      rawValue: avgConversionRate,
      deltaPct: 2.1,
      deltaLabel: `${matchingCampaigns.length} tracked campaigns`,
      trendDirection: 'up',
      tone: 'positive',
      formulaTitle: 'How Campaign Conversion is calculated',
      formulaDescription:
        'Mean simulated conversion rate across Completed and Simulated Execution campaigns matching the active tenant and regional scope.',
      dataScopeNote: 'Demo Data · Simulated Execution Only',
    },
    {
      id: 'geo_opportunity_score',
      label: 'Geographic Opportunity Score',
      formattedValue: `${avgGeoScore.toFixed(1)} / 100`,
      rawValue: avgGeoScore,
      deltaPct: 3.2,
      deltaLabel: tenant.primaryProvinceName,
      trendDirection: 'up',
      tone: 'neutral',
      formulaTitle: 'How Geographic Opportunity Score is calculated',
      formulaDescription:
        'Weighted average spatial opportunity index across scoped territories combining regency market potential, customer density, and branch capacity.',
      dataScopeNote: `Illustrative Spatial Model · ${tenant.primaryProvinceName}`,
    },
    {
      id: 'industry_revenue',
      label: industry.terminology.primaryRevenueLabel,
      formattedValue: formatIdrCompact(totalPeriodRevenue),
      rawValue: totalPeriodRevenue,
      deltaPct: revenueDelta,
      deltaLabel: `${formatNumber(totalPeriodTxCount)} ${industry.terminology.transactionPlural.toLowerCase()}`,
      trendDirection: 'up',
      tone: 'positive',
      formulaTitle: `How ${industry.terminology.primaryRevenueLabel} is calculated`,
      formulaDescription:
        industry.kpiDefinitions[0]?.formulaDescription ??
        'Sum of synthetic transaction values within the selected timeframe and regional boundary.',
      dataScopeNote: `Demo Data · Window: ${filters.dateRange.toUpperCase()}`,
    },
  ];

  // Monthly trends over selected range (up to 12 months ending Nov 2026)
  const monthCount = filters.dateRange === '30d' ? 3 : filters.dateRange === '90d' ? 4 : filters.dateRange === '6m' ? 6 : 12;
  const monthBuckets: Array<{ key: string; label: string; revenue: number; txCount: number; customerIds: Set<string> }> = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let m = monthCount - 1; m >= 0; m--) {
    const d = new Date(Date.UTC(2026, 10 - m, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
    monthBuckets.push({ key, label, revenue: 0, txCount: 0, customerIds: new Set() });
  }

  const bucketMap = new Map(monthBuckets.map((b) => [b.key, b]));
  for (const c of scopedCustomers) {
    for (const tx of c.transactions) {
      const mKey = tx.date.slice(0, 7);
      const bucket = bucketMap.get(mKey);
      if (bucket) {
        bucket.revenue += tx.amount;
        bucket.txCount += 1;
        bucket.customerIds.add(c.customer_id);
      }
    }
  }

  const monthlyTrends: MonthlyTrendPoint[] = monthBuckets.map((b) => ({
    month: b.label,
    revenueMillions: Number((b.revenue / 1_000_000).toFixed(1)),
    activeCustomers: b.customerIds.size,
    transactions: b.txCount,
  }));

  // Segment distribution
  const segmentOrder: CustomerRecord['customer_segment'][] = [
    'High-Value Loyal',
    'Growth Potential',
    'Core Active',
    'At-Risk Retention',
    'New Onboarding',
  ];

  const segments: SegmentDistributionItem[] = segmentOrder.map((seg) => {
    const list = scopedCustomers.filter((c) => c.customer_segment === seg);
    const avgLtv = list.length > 0 ? list.reduce((acc, c) => acc + c.lifetime_value, 0) / list.length : 0;
    return {
      segment: seg,
      count: list.length,
      sharePct: totalCustomers > 0 ? Number(((list.length / totalCustomers) * 100).toFixed(1)) : 0,
      avgLtv,
      color: SEGMENT_COLORS[seg] ?? '#1769AA',
    };
  });

  // Regional performance across permitted regions
  const permittedSet = new Set(permittedRegionIds);
  const regionalPerformance: RegionalPerformanceRow[] = tenant.province.regencies
    .filter((r) => permittedSet.has(r.id) && (filters.regionId === 'ALL' || r.id === filters.regionId))
    .map((reg) => {
      const regCustomers = scopedCustomers.filter((c) => c.region_id === reg.id);
      const regActive = regCustomers.filter((c) => c.status === 'Active').length;
      const regAtRisk = regCustomers.filter(
        (c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk'
      ).length;
      let regRevenue = 0;
      for (const c of regCustomers) {
        for (const tx of c.transactions) {
          if (tx.date >= cutoffIso) regRevenue += tx.amount;
        }
      }
      const regOpp =
        regCustomers.length > 0
          ? regCustomers.reduce((acc, c) => acc + c.model_outputs.geographic_opportunity_score, 0) /
            regCustomers.length
          : reg.marketPotentialIndex;

      return {
        regionId: reg.id,
        regionName: reg.name,
        customers: regCustomers.length,
        activeRatePct: regCustomers.length > 0 ? Number(((regActive / regCustomers.length) * 100).toFixed(1)) : 0,
        atRiskCount: regAtRisk,
        revenue: regRevenue,
        opportunityScore: Number(regOpp.toFixed(1)),
        branchCount: tenant.branches.filter((b) => b.region_id === reg.id).length,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  const topRegion = regionalPerformance[0];
  const highestRiskRegion = [...regionalPerformance].sort((a, b) => b.atRiskCount - a.atRiskCount)[0];

  const recommendedActions: RecommendedActionItem[] = [];
  if (highestRiskRegion && highestRiskRegion.atRiskCount > 0) {
    recommendedActions.push({
      id: 'act-retention',
      title: `Launch ${industry.terminology.retentionMetricLabel} campaign in ${highestRiskRegion.regionName}`,
      targetSummary: `${highestRiskRegion.atRiskCount} at-risk ${industry.terminology.customerPlural.toLowerCase()}`,
      regionName: highestRiskRegion.regionName,
      estimatedImpact: formatIdrCompact(highestRiskRegion.atRiskCount * 3_200_000),
      priority: 'High',
      suggestedChannel: 'WhatsApp',
      segment: 'At-Risk Retention',
      regionId: highestRiskRegion.regionId,
    });
  }
  if (topRegion) {
    recommendedActions.push({
      id: 'act-expansion',
      title: `Activate Growth Potential cohort in ${topRegion.regionName}`,
      targetSummary: `${Math.max(1, Math.round(topRegion.customers * 0.24))} high-propensity accounts`,
      regionName: topRegion.regionName,
      estimatedImpact: `Opportunity Index ${topRegion.opportunityScore}/100`,
      priority: 'High',
      suggestedChannel: 'Branch Follow-up',
      segment: 'Growth Potential',
      regionId: topRegion.regionId,
    });
  }
  recommendedActions.push({
    id: 'act-loyalty',
    title: `Protect High-Value Loyal ${industry.terminology.customerPlural}`,
    targetSummary: `${segments[0]?.count ?? 0} loyal accounts (${segments[0]?.sharePct ?? 0}% share)`,
    regionName: filters.regionId === 'ALL' ? `All ${tenant.primaryProvinceName}` : (topRegion?.regionName ?? tenant.primaryProvinceName),
    estimatedImpact: formatIdrCompact((segments[0]?.avgLtv ?? 0) * Math.max(1, Math.round((segments[0]?.count ?? 0) * 0.12))),
    priority: 'Medium',
    suggestedChannel: 'Email',
    segment: 'High-Value Loyal',
    regionId: filters.regionId,
  });

  const aiInsightCards: DashboardAnalyticsSnapshot['aiInsightCards'] = [
    {
      id: 'ins-1',
      category: 'Location',
      headline: topRegion
        ? `${topRegion.regionName} leads territory opportunity at ${topRegion.opportunityScore}/100`
        : 'Regional opportunity distribution balanced',
      evidence: topRegion
        ? `${topRegion.customers} scoped ${industry.terminology.customerPlural.toLowerCase()} across ${topRegion.branchCount} ${industry.terminology.branchPlural.toLowerCase()} generating ${formatIdrCompact(topRegion.revenue)}.`
        : 'Select a broader regional filter to compare territories.',
      confidenceLabel: 'Illustrative AI Simulation · Spatial Model v1.4',
    },
    {
      id: 'ins-2',
      category: 'Retention',
      headline: `${atRiskCustomers} ${industry.terminology.customerPlural.toLowerCase()} flagged for proactive retention`,
      evidence: `Represents ${((atRiskCustomers / Math.max(1, totalCustomers)) * 100).toFixed(1)}% of scoped base. Highest concentration in ${highestRiskRegion?.regionName ?? tenant.primaryProvinceName}.`,
      confidenceLabel: 'Illustrative AI Simulation · Churn Classifier v1.4',
    },
    {
      id: 'ins-3',
      category: 'Opportunity',
      headline: `${growthOpportunities} accounts exceed 68% upgrade/cross-sell propensity`,
      evidence: `Prioritizing WhatsApp and ${industry.terminology.branchSingular} outreach aligns with top-performing simulated conversion channel (${avgConversionRate.toFixed(1)}%).`,
      confidenceLabel: 'Illustrative AI Simulation · Propensity Model v1.4',
    },
  ];

  return {
    kpis,
    monthlyTrends,
    segments,
    regionalPerformance,
    recommendedActions,
    aiInsightCards,
    totalFilteredCustomers: totalCustomers,
    totalPeriodRevenue,
  };
}

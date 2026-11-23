import type {
  BranchRecord,
  CustomerRecord,
  IndustryProfile,
  RiskCategory,
  Tenant,
} from '../../types/platform';

export interface CustomerDirectoryQuery {
  searchQuery?: string;
  regionId?: string;
  districtId?: string;
  villageId?: string;
  segment?: string;
  risk?: 'ALL' | RiskCategory;
  status?: 'ALL' | CustomerRecord['status'];
  lifecycleStage?: string;
  sortBy?: 'ltv_desc' | 'churn_desc' | 'propensity_desc' | 'recent_desc' | 'name_asc';
}

export interface LifecycleStageMetric {
  stage: string;
  count: number;
  sharePct: number;
  avgLtv: number;
  highRiskCount: number;
}

export interface SegmentProfileMetric {
  segment: CustomerRecord['customer_segment'];
  count: number;
  sharePct: number;
  totalLtv: number;
  avgLtv: number;
  avgChurnScore: number;
  avgPropensityScore: number;
  atRiskCount: number;
  color: string;
}

export interface TerritoryDetailedIntelligence {
  regionId: string;
  regionName: string;
  lat: number;
  lng: number;
  populationThousands: number;
  customerCount: number;
  activeCount: number;
  activeRatePct: number;
  atRiskCount: number;
  highPropensityCount: number;
  cumulativeLtv: number;
  avgLtv: number;
  opportunityScore: number;
  branchCount: number;
  branches: BranchRecord[];
  avgBranchCapacityPct: number;
  customersPerBranch: number;
  coverageStatus: 'Strong' | 'Balanced' | 'Underserved';
  segmentBreakdown: Array<{
    segment: CustomerRecord['customer_segment'];
    count: number;
    sharePct: number;
  }>;
  topCustomers: CustomerRecord[];
}

const SEGMENT_ORDER: CustomerRecord['customer_segment'][] = [
  'High-Value Loyal',
  'Growth Potential',
  'Core Active',
  'At-Risk Retention',
  'New Onboarding',
];

const SEGMENT_COLORS: Record<CustomerRecord['customer_segment'], string> = {
  'High-Value Loyal': '#102B4D',
  'Growth Potential': '#1769AA',
  'Core Active': '#16A6BD',
  'At-Risk Retention': '#D9534F',
  'New Onboarding': '#64748B',
};

export function queryCustomers(
  customers: CustomerRecord[],
  query: CustomerDirectoryQuery
): CustomerRecord[] {
  const q = (query.searchQuery ?? '').trim().toLowerCase();

  const filtered = customers.filter((c) => {
    if (query.regionId && query.regionId !== 'ALL' && c.region_id !== query.regionId) {
      return false;
    }
    if (query.districtId && query.districtId !== 'ALL' && c.district_id !== query.districtId) {
      return false;
    }
    if (query.villageId && query.villageId !== 'ALL' && c.village_id !== query.villageId) {
      return false;
    }
    if (query.segment && query.segment !== 'ALL' && c.customer_segment !== query.segment) {
      return false;
    }
    if (query.risk && query.risk !== 'ALL' && c.model_outputs.churn_risk_category !== query.risk) {
      return false;
    }
    if (query.status && query.status !== 'ALL' && c.status !== query.status) {
      return false;
    }
    if (
      query.lifecycleStage &&
      query.lifecycleStage !== 'ALL' &&
      c.lifecycle_stage !== query.lifecycleStage
    ) {
      return false;
    }
    if (q) {
      const extValues = Object.values(c.extension_attributes)
        .map((v) => String(v).toLowerCase())
        .join(' ');
      const matched =
        c.full_name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.demographic_attributes.city.toLowerCase().includes(q) ||
        c.demographic_attributes.district.toLowerCase().includes(q) ||
        c.demographic_attributes.village.toLowerCase().includes(q) ||
        extValues.includes(q);
      if (!matched) return false;
    }
    return true;
  });

  const sortBy = query.sortBy ?? 'ltv_desc';
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortBy === 'churn_desc') {
      return b.model_outputs.churn_risk_score - a.model_outputs.churn_risk_score;
    }
    if (sortBy === 'propensity_desc') {
      return b.model_outputs.purchase_propensity_score - a.model_outputs.purchase_propensity_score;
    }
    if (sortBy === 'recent_desc') {
      return a.last_activity_date < b.last_activity_date ? 1 : -1;
    }
    if (sortBy === 'name_asc') {
      return a.full_name.localeCompare(b.full_name);
    }
    return b.lifetime_value - a.lifetime_value;
  });

  return sorted;
}

export function computeSegmentProfiles(customers: CustomerRecord[]): SegmentProfileMetric[] {
  const total = customers.length;
  return SEGMENT_ORDER.map((seg) => {
    const group = customers.filter((c) => c.customer_segment === seg);
    const totalLtv = group.reduce((acc, c) => acc + c.lifetime_value, 0);
    const avgLtv = group.length > 0 ? totalLtv / group.length : 0;
    const avgChurn =
      group.length > 0
        ? group.reduce((acc, c) => acc + c.model_outputs.churn_risk_score, 0) / group.length
        : 0;
    const avgProp =
      group.length > 0
        ? group.reduce((acc, c) => acc + c.model_outputs.purchase_propensity_score, 0) / group.length
        : 0;
    const atRiskCount = group.filter(
      (c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk'
    ).length;

    return {
      segment: seg,
      count: group.length,
      sharePct: total > 0 ? Number(((group.length / total) * 100).toFixed(1)) : 0,
      totalLtv,
      avgLtv,
      avgChurnScore: Number(avgChurn.toFixed(1)),
      avgPropensityScore: Number(avgProp.toFixed(1)),
      atRiskCount,
      color: SEGMENT_COLORS[seg],
    };
  });
}

export function computeLifecycleDistribution(
  customers: CustomerRecord[],
  industry: IndustryProfile
): LifecycleStageMetric[] {
  const total = customers.length;
  const knownStages = new Set(industry.lifecycleStages);
  const stageMetrics: LifecycleStageMetric[] = industry.lifecycleStages.map((stage) => {
    const group = customers.filter((c) => c.lifecycle_stage === stage);
    const avgLtv =
      group.length > 0 ? group.reduce((acc, c) => acc + c.lifetime_value, 0) / group.length : 0;
    const highRiskCount = group.filter(
      (c) => c.model_outputs.churn_risk_category === 'High'
    ).length;
    return {
      stage,
      count: group.length,
      sharePct: total > 0 ? Number(((group.length / total) * 100).toFixed(1)) : 0,
      avgLtv,
      highRiskCount,
    };
  });

  // Capture any customers whose lifecycle label came from a different industry override
  const otherGroup = customers.filter((c) => !knownStages.has(c.lifecycle_stage));
  if (otherGroup.length > 0 && stageMetrics.length > 0) {
    const last = stageMetrics[stageMetrics.length - 1];
    const combinedCount = last.count + otherGroup.length;
    const combinedLtv =
      (last.avgLtv * last.count + otherGroup.reduce((a, c) => a + c.lifetime_value, 0)) /
      Math.max(1, combinedCount);
    stageMetrics[stageMetrics.length - 1] = {
      ...last,
      count: combinedCount,
      sharePct: total > 0 ? Number(((combinedCount / total) * 100).toFixed(1)) : 0,
      avgLtv: combinedLtv,
      highRiskCount:
        last.highRiskCount +
        otherGroup.filter((c) => c.model_outputs.churn_risk_category === 'High').length,
    };
  }

  return stageMetrics;
}

export function getAtRiskCustomers(
  customers: CustomerRecord[],
  limit = 25
): {
  totalAtRisk: number;
  revenueAtRisk: number;
  avgChurnScore: number;
  priorityQueue: CustomerRecord[];
} {
  const atRisk = customers
    .filter((c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk')
    .sort((a, b) => {
      if (b.model_outputs.churn_risk_score !== a.model_outputs.churn_risk_score) {
        return b.model_outputs.churn_risk_score - a.model_outputs.churn_risk_score;
      }
      return b.lifetime_value - a.lifetime_value;
    });

  const revenueAtRisk = atRisk.reduce((acc, c) => acc + c.lifetime_value, 0);
  const avgChurnScore =
    atRisk.length > 0
      ? Number(
          (
            atRisk.reduce((acc, c) => acc + c.model_outputs.churn_risk_score, 0) / atRisk.length
          ).toFixed(1)
        )
      : 0;

  return {
    totalAtRisk: atRisk.length,
    revenueAtRisk,
    avgChurnScore,
    priorityQueue: atRisk.slice(0, limit),
  };
}

export function buildCustomerSpendTimeline(
  customer: CustomerRecord
): Array<{ date: string; amountMillions: number; category: string; product: string }> {
  return [...customer.transactions]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((tx) => ({
      date: tx.date,
      amountMillions: Number((tx.amount / 1_000_000).toFixed(2)),
      category: tx.category,
      product: tx.product_name,
    }));
}

export function computeTerritoryIntelligence(
  tenant: Tenant,
  scopedCustomers: CustomerRecord[],
  permittedRegionIds: string[]
): TerritoryDetailedIntelligence[] {
  const permittedSet = new Set(permittedRegionIds);

  return tenant.province.regencies
    .filter((reg) => permittedSet.has(reg.id))
    .map((reg) => {
      const regCust = scopedCustomers.filter((c) => c.region_id === reg.id);
      const activeCount = regCust.filter((c) => c.status === 'Active').length;
      const atRiskCount = regCust.filter(
        (c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk'
      ).length;
      const highPropensityCount = regCust.filter(
        (c) => c.model_outputs.purchase_propensity_score >= 68
      ).length;
      const cumulativeLtv = regCust.reduce((acc, c) => acc + c.lifetime_value, 0);
      const branches = tenant.branches.filter((b) => b.region_id === reg.id);
      const avgBranchCapacityPct =
        branches.length > 0
          ? Number(
              (branches.reduce((acc, b) => acc + b.capacityScore, 0) / branches.length).toFixed(1)
            )
          : 0;
      const customersPerBranch =
        branches.length > 0 ? Math.round(regCust.length / branches.length) : regCust.length;

      const opportunityScore =
        regCust.length > 0
          ? Number(
              (
                regCust.reduce((acc, c) => acc + c.model_outputs.geographic_opportunity_score, 0) /
                regCust.length
              ).toFixed(1)
            )
          : reg.marketPotentialIndex;

      const coverageStatus: TerritoryDetailedIntelligence['coverageStatus'] =
        branches.length === 0 || (customersPerBranch > 125 && opportunityScore >= 80)
          ? 'Underserved'
          : avgBranchCapacityPct >= 82
            ? 'Strong'
            : 'Balanced';

      const segmentBreakdown = SEGMENT_ORDER.map((seg) => {
        const count = regCust.filter((c) => c.customer_segment === seg).length;
        return {
          segment: seg,
          count,
          sharePct: regCust.length > 0 ? Number(((count / regCust.length) * 100).toFixed(1)) : 0,
        };
      });

      const topCustomers = [...regCust]
        .sort((a, b) => b.lifetime_value - a.lifetime_value)
        .slice(0, 5);

      return {
        regionId: reg.id,
        regionName: reg.name,
        lat: reg.lat,
        lng: reg.lng,
        populationThousands: reg.populationThousands,
        customerCount: regCust.length,
        activeCount,
        activeRatePct:
          regCust.length > 0 ? Number(((activeCount / regCust.length) * 100).toFixed(1)) : 0,
        atRiskCount,
        highPropensityCount,
        cumulativeLtv,
        avgLtv: regCust.length > 0 ? cumulativeLtv / regCust.length : 0,
        opportunityScore,
        branchCount: branches.length,
        branches,
        avgBranchCapacityPct,
        customersPerBranch,
        coverageStatus,
        segmentBreakdown,
        topCustomers,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

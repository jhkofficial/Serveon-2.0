import type {
  CampaignChannel,
  CustomerRecord,
  IndustryId,
  IndustryProfile,
  RiskCategory,
  Tenant,
  UserPersona,
} from '../../types/platform';
import type {
  ApprovalPolicy,
  BusinessRule,
  Campaign,
  CampaignAudience,
  CampaignEvent,
  CampaignEventStatus,
  ConversionEvent,
  ExplanationFactor,
  ModelRegistryEntry,
  Mvp3CampaignStatus,
  NbaStrategy,
  PredictionResult,
  Recommendation,
} from '../../types/mvp3';
import { hasPermission } from '../permissions/rbac';

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicUnit(key: string): number {
  return (deterministicHash(key) % 10000) / 10000;
}

export interface CustomerConsentProfile {
  hasConsent: boolean;
  optedOut: boolean;
  suppressed: boolean;
  suppressionReason?: string;
}

/** Deterministic consent, opt-out, and suppression flags per customer record */
export function evaluateCustomerConsent(customer: CustomerRecord): CustomerConsentProfile {
  const r = deterministicUnit(`consent-${customer.tenant_id}-${customer.customer_id}`);
  if (r < 0.055) {
    return {
      hasConsent: true,
      optedOut: true,
      suppressed: false,
      suppressionReason: 'Customer opted out of promotional outreach',
    };
  }
  if (r < 0.095) {
    return {
      hasConsent: false,
      optedOut: false,
      suppressed: false,
      suppressionReason: 'Marketing consent not verified',
    };
  }
  if (r < 0.13) {
    return {
      hasConsent: true,
      optedOut: false,
      suppressed: true,
      suppressionReason: 'Contact frequency cap (7-day suppression)',
    };
  }
  return { hasConsent: true, optedOut: false, suppressed: false };
}

function buildNormalizedFactors(
  raw: Array<{
    id: string;
    featureName: string;
    featureLabel: string;
    featureValue: string;
    impactPoints: number;
    direction: ExplanationFactor['direction'];
  }>
): ExplanationFactor[] {
  const totalAbs = raw.reduce((acc, f) => acc + Math.abs(f.impactPoints), 0) || 1;
  return raw
    .map((f) => ({
      ...f,
      normalizedWeightPct: Number(((Math.abs(f.impactPoints) / totalAbs) * 100).toFixed(1)),
      attributionMethod: 'Illustrative Feature Attribution (Demo Mode)' as const,
    }))
    .sort((a, b) => Math.abs(b.impactPoints) - Math.abs(a.impactPoints));
}

function getIndustryPredictionLabels(industryId: IndustryId) {
  switch (industryId) {
    case 'motorcycle':
      return {
        churnUseCase: 'AHASS Workshop Drop-Off & Post-KPB Churn Risk',
        propensityUseCase: '160cc Premium Scooter & Second-Unit Upgrade Propensity',
        geoUseCase: 'Main Dealer & AHASS Pit District Opportunity',
        engagementUseCase: 'Rider AHASS & Motorku X Engagement Index',
        churnFeature1: 'Days since last AHASS periodic service visit',
        churnFeature2: 'KPB warranty phase & 4,000 km service interval gap',
        propFeature1: 'Commuter tenure & 160cc upgrade readiness window',
      };
    case 'automotive':
      return {
        churnUseCase: 'Service Inactivity & Workshop Defection Risk',
        propensityUseCase: 'Vehicle Repurchase & Hybrid Trade-In Propensity',
        geoUseCase: 'Dealership Catchment & Service Bay Opportunity',
        engagementUseCase: 'After-Sales & Workshop Engagement Index',
        churnFeature1: 'Days since last workshop/sales order',
        churnFeature2: 'Warranty & periodic service interval gap',
        propFeature1: 'Ownership tenure & upgrade cycle window',
      };
    case 'automotive_parts':
      return {
        churnUseCase: 'Workshop Reorder Lapse & Sub-Dealer Switching Risk',
        propensityUseCase: 'Multi-SKU Battery, Brake & Suspension Bundle Propensity',
        geoUseCase: 'Depot Logistics & Workshop Corridor Opportunity',
        engagementUseCase: 'B2B Replenishment & Fast-Fit Engagement Index',
        churnFeature1: 'Days past expected workshop parts reorder cycle',
        churnFeature2: 'SKU line breadth & wholesale fulfillment cadence',
        propFeature1: 'Distributor tier & cross-category assortment headroom',
      };
    case 'insurance':
      return {
        churnUseCase: 'Policy Lapse & Renewal Non-Payment Risk',
        propensityUseCase: 'Critical Illness & Health Rider Cross-Sell Propensity',
        geoUseCase: 'Agency & Bancassurance Territory Whitespace Score',
        engagementUseCase: 'Policyholder Advisory & Renewal Engagement Index',
        churnFeature1: 'Days remaining to policy renewal & grace-period pattern',
        churnFeature2: 'Advisor touchpoint recency & auto-debit consistency',
        propFeature1: 'Policy tenure, claim band & household protection gap',
      };
    case 'retail':
      return {
        churnUseCase: 'Lapsing Loyalty & Purchase Frequency Drop Risk',
        propensityUseCase: 'Cross-Category Basket Expansion Propensity',
        geoUseCase: 'Store Catchment & Omnichannel Demand Score',
        engagementUseCase: 'Omnichannel Loyalty Engagement Index',
        churnFeature1: 'Days since last store/app basket purchase',
        churnFeature2: 'Basket frequency & loyalty tier momentum',
        propFeature1: 'Multi-category basket affinity & VIP status',
      };
    case 'banking':
      return {
        churnUseCase: 'Deposit Outflow & Primary Bank Attrition Risk',
        propensityUseCase: 'Multi-Product Wealth & Credit Cross-Sell Propensity',
        geoUseCase: 'Branch Corridor & Commercial Deposit Opportunity',
        engagementUseCase: 'Digital Banking & RM Engagement Index',
        churnFeature1: 'Transaction recency & balance activity trend',
        churnFeature2: 'Product holding depth & RM touchpoint cadence',
        propFeature1: 'Account tier & multi-product cross-sell headroom',
      };
    case 'property':
      return {
        churnUseCase: 'Lead Drop-Off & Gallery Stagnation Risk',
        propensityUseCase: 'Phase-2 Repeat Investment & Booking Propensity',
        geoUseCase: 'Geographic Site Demand & Catchment Opportunity',
        engagementUseCase: 'Prospect & Investor Advisory Engagement Index',
        churnFeature1: 'Days since last gallery or advisor milestone',
        churnFeature2: 'Financing pre-qualification & follow-up cadence',
        propFeature1: 'Investment horizon & coastal catchment demand',
      };
    default:
      return {
        churnUseCase: 'Account Retention & Inactivity Risk',
        propensityUseCase: 'Next-Offer Upgrade & Cross-Sell Propensity',
        geoUseCase: 'Regional Territory Opportunity Score',
        engagementUseCase: 'Customer Engagement Health Index',
        churnFeature1: 'Days since last recorded transaction',
        churnFeature2: 'Channel responsiveness & interaction cadence',
        propFeature1: 'Historical value & lifecycle progression',
      };
  }
}

/** Build deterministic PredictionResult records covering all 4 MVP 3 prediction families */
export function buildTenantPredictions(
  tenant: Tenant,
  industry: IndustryProfile,
  customers: CustomerRecord[]
): PredictionResult[] {
  const labels = getIndustryPredictionLabels(industry.id);
  const results: PredictionResult[] = [];
  const dataTimestamp = '2026-11-20 06:00 WIB';

  // 1. Customer-level predictions (Churn Risk, Purchase Propensity, Engagement Indicator)
  for (const c of customers) {
    const extKeys = Object.entries(c.extension_attributes);
    const primaryExt = extKeys[0] ? `${extKeys[0][0]}: ${extKeys[0][1]}` : c.lifecycle_stage;
    const secondaryExt = extKeys[1] ? `${extKeys[1][0]}: ${extKeys[1][1]}` : `${c.products.length} holdings`;

    const missingRoll = deterministicUnit(`missing-${c.customer_id}`);
    const missingIndicators: string[] = [];
    if (missingRoll < 0.09) {
      missingIndicators.push('Secondary channel click-through telemetry unavailable (imputed to cohort median)');
    }
    if (missingRoll > 0.93) {
      missingIndicators.push('External regional competitor pricing index not linked in demo dataset');
    }

    const churnFactors = buildNormalizedFactors([
      {
        id: 'recency',
        featureName: 'last_activity_recency',
        featureLabel: labels.churnFeature1,
        featureValue: `Last activity ${c.last_activity_date}`,
        impactPoints: c.model_outputs.contributing_factors[0]?.impact ?? (c.model_outputs.churn_risk_score > 60 ? 34 : -22),
        direction: c.model_outputs.churn_risk_score >= 55 ? 'increases_risk' : 'reduces_risk',
      },
      {
        id: 'engagement',
        featureName: 'interaction_cadence',
        featureLabel: labels.churnFeature2,
        featureValue: `${c.interactions.length} recent touches · ${primaryExt}`,
        impactPoints: c.model_outputs.contributing_factors[1]?.impact ?? 20,
        direction: c.status === 'At-Risk' ? 'increases_risk' : 'reduces_risk',
      },
      {
        id: 'territory',
        featureName: 'territory_pressure',
        featureLabel: `Territory context (${c.demographic_attributes.city})`,
        featureValue: `Geo index ${c.model_outputs.geographic_opportunity_score}/100`,
        impactPoints: c.model_outputs.contributing_factors[2]?.impact ?? 14,
        direction: c.model_outputs.churn_risk_score >= 60 ? 'increases_risk' : 'increases_opportunity',
      },
      {
        id: 'tenure',
        featureName: 'tenure_loyalty_buffer',
        featureLabel: 'Account tenure & product depth',
        featureValue: `${c.demographic_attributes.tenure_months} months · ${secondaryExt}`,
        impactPoints: c.model_outputs.contributing_factors[3]?.impact ?? -15,
        direction: 'reduces_risk',
      },
    ]);

    results.push({
      id: `pred-churn-${c.customer_id}`,
      tenant_id: c.tenant_id,
      entityType: 'customer',
      entityId: c.customer_id,
      entityCode: c.code,
      entityName: c.full_name,
      regionId: c.region_id,
      regionName: c.demographic_attributes.city,
      segment: c.customer_segment,
      predictionType: 'churn_risk',
      score: c.model_outputs.churn_risk_score,
      category: c.model_outputs.churn_risk_category,
      contributingFactors: churnFactors,
      evaluationDate: c.model_outputs.last_evaluated_at,
      dataTimestamp,
      modelVersion: 'serveon-churn-sim-v2.1',
      modelName: `${industry.name} Churn Risk Scorer`,
      modelStatus: 'Simulated AI Prediction',
      missingDataIndicators: missingIndicators,
      modelLimitations: [
        'Deterministic synthetic scoring model for demonstration; not calibrated on historical production churn labels.',
        'Feature weights are illustrative relative contributions, not live TreeSHAP/KernelSHAP outputs.',
        'Requires human review before initiating customer retention incentives.',
      ],
      industryUseCaseLabel: labels.churnUseCase,
      shapAvailable: false,
    });

    const propCat: RiskCategory =
      c.model_outputs.purchase_propensity_score >= 70
        ? 'High'
        : c.model_outputs.purchase_propensity_score >= 45
          ? 'Medium'
          : 'Low';

    const propFactors = buildNormalizedFactors([
      {
        id: 'upgrade_window',
        featureName: 'lifecycle_upgrade_window',
        featureLabel: labels.propFeature1,
        featureValue: `${c.lifecycle_stage} · ${c.demographic_attributes.tenure_months}m tenure`,
        impactPoints: Math.round((c.model_outputs.purchase_propensity_score - 35) * 0.6),
        direction: c.model_outputs.purchase_propensity_score >= 50 ? 'increases_opportunity' : 'reduces_opportunity',
      },
      {
        id: 'ltv_depth',
        featureName: 'historical_ltv_band',
        featureLabel: 'Cumulative transaction value & order cadence',
        featureValue: `${c.transactions.length} orders · ${primaryExt}`,
        impactPoints: c.transactions.length >= 3 ? 24 : 11,
        direction: 'increases_opportunity',
      },
      {
        id: 'channel_fit',
        featureName: 'channel_responsiveness',
        featureLabel: `Preferred channel responsiveness (${c.demographic_attributes.preferred_channel})`,
        featureValue: c.interactions[0]?.outcome ?? 'Neutral',
        impactPoints: c.interactions[0]?.outcome === 'Positive' ? 18 : -8,
        direction: c.interactions[0]?.outcome === 'Positive' ? 'increases_opportunity' : 'reduces_opportunity',
      },
      {
        id: 'churn_drag',
        featureName: 'inactivity_drag',
        featureLabel: 'Retention friction offset',
        featureValue: `Churn score ${c.model_outputs.churn_risk_score}/100`,
        impactPoints: c.model_outputs.churn_risk_score > 65 ? -22 : 9,
        direction: c.model_outputs.churn_risk_score > 65 ? 'reduces_opportunity' : 'increases_opportunity',
      },
    ]);

    results.push({
      id: `pred-prop-${c.customer_id}`,
      tenant_id: c.tenant_id,
      entityType: 'customer',
      entityId: c.customer_id,
      entityCode: c.code,
      entityName: c.full_name,
      regionId: c.region_id,
      regionName: c.demographic_attributes.city,
      segment: c.customer_segment,
      predictionType: 'purchase_propensity',
      score: c.model_outputs.purchase_propensity_score,
      category: propCat,
      contributingFactors: propFactors,
      evaluationDate: c.model_outputs.last_evaluated_at,
      dataTimestamp,
      modelVersion: 'serveon-propensity-sim-v2.0',
      modelName: `${industry.name} Propensity Model`,
      modelStatus: 'Simulated AI Prediction',
      missingDataIndicators: missingIndicators,
      modelLimitations: [
        'Simulated propensity index derived from synthetic lifecycle and transaction attributes.',
        'Does not incorporate live macroeconomic credit or real-time web clickstream signals.',
        'Feature weights represent illustrative demo contributions rather than production SHAP.',
      ],
      industryUseCaseLabel: labels.propensityUseCase,
      shapAvailable: false,
    });

    // Engagement Indicator (0-100 deterministic score)
    const engScore = Math.max(
      12,
      Math.min(
        98,
        Math.round(
          (100 - c.model_outputs.churn_risk_score) * 0.55 +
            c.model_outputs.purchase_propensity_score * 0.35 +
            (c.interactions[0]?.outcome === 'Positive' ? 10 : 0)
        )
      )
    );
    const engCat: RiskCategory = engScore >= 70 ? 'High' : engScore >= 45 ? 'Medium' : 'Low';
    results.push({
      id: `pred-eng-${c.customer_id}`,
      tenant_id: c.tenant_id,
      entityType: 'customer',
      entityId: c.customer_id,
      entityCode: c.code,
      entityName: c.full_name,
      regionId: c.region_id,
      regionName: c.demographic_attributes.city,
      segment: c.customer_segment,
      predictionType: 'engagement_index',
      score: engScore,
      category: engCat,
      contributingFactors: buildNormalizedFactors([
        {
          id: 'touch_outcome',
          featureName: 'recent_interaction_outcome',
          featureLabel: 'Latest touchpoint outcome & responsiveness',
          featureValue: `${c.interactions[0]?.type ?? 'Touchpoint'} (${c.interactions[0]?.outcome ?? 'Neutral'})`,
          impactPoints: c.interactions[0]?.outcome === 'Positive' ? 29 : -14,
          direction: c.interactions[0]?.outcome === 'Positive' ? 'increases_opportunity' : 'reduces_opportunity',
        },
        {
          id: 'tx_freq',
          featureName: 'transaction_frequency',
          featureLabel: '12-month order & service frequency',
          featureValue: `${c.transactions.length} recorded orders`,
          impactPoints: c.transactions.length * 9,
          direction: 'increases_opportunity',
        },
        {
          id: 'pref_channel',
          featureName: 'preferred_channel_reachability',
          featureLabel: 'Verified preferred channel reachability',
          featureValue: c.demographic_attributes.preferred_channel,
          impactPoints: 16,
          direction: 'increases_opportunity',
        },
      ]),
      evaluationDate: c.model_outputs.last_evaluated_at,
      dataTimestamp,
      modelVersion: 'serveon-engage-sim-v1.8',
      modelName: `${industry.name} Engagement Indicator`,
      modelStatus: 'Simulated AI Prediction',
      missingDataIndicators: missingIndicators,
      modelLimitations: [
        'Engagement score synthesizes demo interactions and transaction cadence; live digital app telemetry is not connected.',
      ],
      industryUseCaseLabel: labels.engagementUseCase,
      shapAvailable: false,
    });
  }

  // 2. Territory-level Geographic Opportunity Scores
  for (const reg of tenant.province.regencies) {
    const regCusts = customers.filter((c) => c.region_id === reg.id);
    if (regCusts.length === 0) continue;
    const avgScore = Math.round(
      regCusts.reduce((acc, c) => acc + c.model_outputs.geographic_opportunity_score, 0) /
        regCusts.length
    );
    const highPropShare = Math.round(
      (regCusts.filter((c) => c.model_outputs.purchase_propensity_score >= 68).length /
        regCusts.length) *
        100
    );
    const branchCount = tenant.branches.filter((b) => b.region_id === reg.id).length;
    const cat: PredictionResult['category'] =
      avgScore >= 82
        ? 'Strong Opportunity'
        : avgScore >= 72
          ? 'Moderate Opportunity'
          : 'Emerging';

    results.push({
      id: `pred-geo-${tenant.id}-${reg.id}`,
      tenant_id: tenant.id,
      entityType: 'territory',
      entityId: reg.id,
      entityCode: reg.id.toUpperCase(),
      entityName: reg.name,
      regionId: reg.id,
      regionName: reg.name,
      segment: 'Territory Cohort',
      predictionType: 'geographic_opportunity',
      score: avgScore,
      category: cat,
      contributingFactors: buildNormalizedFactors([
        {
          id: 'market_index',
          featureName: 'market_potential_index',
          featureLabel: 'Regional demographic & economic potential index',
          featureValue: `Index ${reg.marketPotentialIndex}/100 · Pop ${reg.populationThousands.toLocaleString()}K`,
          impactPoints: Math.round(reg.marketPotentialIndex * 0.42),
          direction: 'increases_opportunity',
        },
        {
          id: 'high_prop_density',
          featureName: 'high_propensity_density',
          featureLabel: `High-propensity ${industry.terminology.customerPlural.toLowerCase()} density`,
          featureValue: `${highPropShare}% of ${regCusts.length} accounts`,
          impactPoints: Math.round(highPropShare * 0.55),
          direction: 'increases_opportunity',
        },
        {
          id: 'branch_coverage',
          featureName: 'branch_coverage_ratio',
          featureLabel: `${industry.terminology.branchSingular} coverage capacity`,
          featureValue: `${branchCount} active ${industry.terminology.branchPlural.toLowerCase()}`,
          impactPoints: branchCount >= 2 ? 18 : -9,
          direction: branchCount >= 2 ? 'increases_opportunity' : 'reduces_opportunity',
        },
      ]),
      evaluationDate: '2026-11-20',
      dataTimestamp,
      modelVersion: 'serveon-spatial-sim-v2.0',
      modelName: `${industry.name} Spatial Opportunity Scorer`,
      modelStatus: 'Simulated AI Prediction',
      missingDataIndicators: [
        'Illustrative WGS-84 regency boundaries used in demo mode (not official BPS cadastral survey shapefiles).',
      ],
      modelLimitations: [
        'Territory scores combine synthetic customer portfolios with illustrative regional potential indices.',
        'Site investment decisions should incorporate external demographic census and foot-traffic audits.',
      ],
      industryUseCaseLabel: labels.geoUseCase,
      shapAvailable: false,
    });
  }

  return results;
}

/** Default industry-configured Business Rules for the Next-Best-Action Engine */
export function buildDefaultBusinessRules(tenantId: string, industryId: IndustryId): BusinessRule[] {
  const baseStamp = '2026-11-18 09:00';
  if (industryId === 'motorcycle') {
    return [
      {
        id: `rule-${tenantId}-mc-retain`,
        tenant_id: tenantId,
        industryId,
        name: 'Post-KPB Overdue AHASS Service Reactivation',
        strategy: 'RETAIN',
        description: 'Trigger proactive AHASS Pit Express voucher outreach when rider churn risk >= 68.',
        minChurnScore: 68,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'WhatsApp',
        priority: 'Critical',
        actionTemplate: 'Send complimentary AHASS 4,000 km inspection & genuine oil discount voucher via WhatsApp',
        active: true,
        version: 2,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [
          { version: 1, timestamp: '2026-10-12 10:00', actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initial motorcycle AHASS retention rule deployed.' },
          { version: 2, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Tuned threshold to 68 for post-KPB 4,000 km drop-off window.' },
        ],
      },
      {
        id: `rule-${tenantId}-mc-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'Loyal Multi-Unit Rider & Community Defense',
        strategy: 'DEFEND',
        description: 'Protect High-Value Loyal riders with priority AHASS express lane and genuine parts rewards.',
        minChurnScore: 20,
        minPropensityScore: 65,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Branch Follow-up',
        priority: 'High',
        actionTemplate: 'Enroll rider in AHASS Priority Express Lane and 2-year genuine parts loyalty benefit',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Created loyal rider defense policy.' }],
      },
      {
        id: `rule-${tenantId}-mc-develop`,
        tenant_id: tenantId,
        industryId,
        name: '160cc Premium Scooter Upgrade Acceleration',
        strategy: 'DEVELOP',
        description: 'Target Growth Potential riders with propensity >= 70 for PCX 160 / ADV 160 trade-in.',
        minChurnScore: null,
        minPropensityScore: 70,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'Call Center',
        priority: 'High',
        actionTemplate: 'Offer trade-in valuation & low-DP FIFGROUP installment quote for PCX 160 / ADV 160',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Activated 160cc upgrade rule.' }],
      },
      {
        id: `rule-${tenantId}-mc-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'High-Density District Mobile AHASS Acquisition',
        strategy: 'ACQUIRE',
        description: 'Deploy roadshow and mobile AHASS pit units in regencies scoring >= 80 spatial opportunity.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 80,
        targetSegment: 'ALL',
        suggestedChannel: 'Email',
        priority: 'Medium',
        actionTemplate: 'Launch localized Main Dealer showcase & corporate two-wheeler fleet acquisition event',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Configured district acquisition threshold.' }],
      },
    ];
  }

  if (industryId === 'automotive_parts') {
    return [
      {
        id: `rule-${tenantId}-parts-retain`,
        tenant_id: tenantId,
        industryId,
        name: 'Overdue Workshop Parts Replenishment Recovery',
        strategy: 'RETAIN',
        description: 'Alert territory sales reps when B2B workshop reorder lapse risk >= 66.',
        minChurnScore: 66,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'WhatsApp',
        priority: 'Critical',
        actionTemplate: 'Dispatch express restock offer with priority 24-hour GS Astra & Aspira delivery window',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized workshop replenishment rule.' }],
      },
      {
        id: `rule-${tenantId}-parts-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'Platinum Sub-Dealer Share-of-Shelf Defense',
        strategy: 'DEFEND',
        description: 'Protect High-Value Loyal sub-dealers and fleet depots with quarterly volume rebates.',
        minChurnScore: 18,
        minPropensityScore: 65,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Branch Follow-up',
        priority: 'High',
        actionTemplate: 'Schedule distributor account manager review for quarterly rebate tier lock-in',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized sub-dealer defense rule.' }],
      },
      {
        id: `rule-${tenantId}-parts-develop`,
        tenant_id: tenantId,
        industryId,
        name: 'Multi-SKU Battery, Brake & Suspension Cross-Sell',
        strategy: 'DEVELOP',
        description: 'Expand single-line buyers scoring >= 70 propensity into full wear-parts bundles.',
        minChurnScore: null,
        minPropensityScore: 70,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'Call Center',
        priority: 'High',
        actionTemplate: 'Offer starter assortment bundle pairing GS Astra batteries with KYB & Aspira wear parts',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized multi-SKU cross-sell rule.' }],
      },
      {
        id: `rule-${tenantId}-parts-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'High-Opportunity Logistics Corridor Onboarding',
        strategy: 'ACQUIRE',
        description: 'Recruit independent workshops and retail fast-fit customers in corridors >= 78 index.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 78,
        targetSegment: 'ALL',
        suggestedChannel: 'Email',
        priority: 'Medium',
        actionTemplate: 'Launch regional B2B workshop partner acquisition and Shop&Drive catchment promotion',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initialized depot corridor rule.' }],
      },
    ];
  }

  if (industryId === 'insurance') {
    return [
      {
        id: `rule-${tenantId}-ins-retain`,
        tenant_id: tenantId,
        industryId,
        name: '45-Day Policy Lapse & Grace-Period Defense',
        strategy: 'RETAIN',
        description: 'Trigger advisor retention outreach when policyholder lapse risk >= 66.',
        minChurnScore: 66,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'Call Center',
        priority: 'Critical',
        actionTemplate: 'Schedule Agency Advisor renewal grace-period review and auto-debit enrollment support',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized policy persistency rule.' }],
      },
      {
        id: `rule-${tenantId}-ins-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'Multi-Year Policyholder Loyalty Protection',
        strategy: 'DEFEND',
        description: 'Retain High-Value Loyal households with annual coverage adequacy reviews.',
        minChurnScore: 16,
        minPropensityScore: 65,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Branch Follow-up',
        priority: 'High',
        actionTemplate: 'Invite policyholder to complimentary annual family protection & beneficiary review',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized loyalty defense rule.' }],
      },
      {
        id: `rule-${tenantId}-ins-develop`,
        tenant_id: tenantId,
        industryId,
        name: 'Critical Illness & Hospital Rider Cross-Sell',
        strategy: 'DEVELOP',
        description: 'Offer rider attach upgrades to Growth Potential policyholders scoring >= 70 propensity.',
        minChurnScore: null,
        minPropensityScore: 70,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'WhatsApp',
        priority: 'High',
        actionTemplate: 'Present Flexi Critical Illness & Family Hospital Cash rider quote via licensed advisor',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized rider cross-sell rule.' }],
      },
      {
        id: `rule-${tenantId}-ins-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'Agency & Bancassurance Whitespace Expansion',
        strategy: 'ACQUIRE',
        description: 'Prioritize regional agency recruitment and bancassurance campaigns in territories >= 78.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 78,
        targetSegment: 'ALL',
        suggestedChannel: 'Email',
        priority: 'Medium',
        actionTemplate: 'Activate localized bancassurance financial wellness workshop in high-index corridor',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initialized whitespace acquisition rule.' }],
      },
    ];
  }

  if (industryId === 'automotive') {
    return [
      {
        id: `rule-${tenantId}-auto-retain`,
        tenant_id: tenantId,
        industryId,
        name: 'Overdue Workshop Service Reactivation',
        strategy: 'RETAIN',
        description: 'Trigger proactive Service Advisor outreach when churn risk >= 70 for at-risk vehicle owners.',
        minChurnScore: 70,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'WhatsApp',
        priority: 'Critical',
        actionTemplate: 'Send complimentary 24-point workshop inspection voucher and Service Advisor booking link',
        active: true,
        version: 2,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [
          { version: 1, timestamp: '2026-10-12 10:00', actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initial automotive retention rule deployed.' },
          { version: 2, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Lowered threshold from 75 to 70 to capture overdue 20,000 km owners earlier.' },
        ],
      },
      {
        id: `rule-${tenantId}-auto-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'High-Value Fleet & Loyal Owner Defense',
        strategy: 'DEFEND',
        description: 'Protect High-Value Loyal owners approaching warranty expiry or elevated competitive pressure.',
        minChurnScore: 22,
        minPropensityScore: 65,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Branch Follow-up',
        priority: 'High',
        actionTemplate: 'Assign dealership VIP concierge for Extended Care Plus renewal & loyalty trade-in valuation',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [
          { version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Created loyal owner defense policy.' },
        ],
      },
      {
        id: `rule-${tenantId}-auto-develop`,
        tenant_id: tenantId,
        industryId,
        name: 'Hybrid SUV Upgrade & Trade-In Acceleration',
        strategy: 'DEVELOP',
        description: 'Target Growth Potential owners with propensity >= 72 for multi-finance trade-in upgrade.',
        minChurnScore: null,
        minPropensityScore: 72,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'Call Center',
        priority: 'High',
        actionTemplate: 'Schedule priority Hybrid SUV test-drive & pre-approved trade-in financing quote',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [
          { version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Activated trade-in development rule.' },
        ],
      },
      {
        id: `rule-${tenantId}-auto-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'High-Opportunity Territory Acquisition Push',
        strategy: 'ACQUIRE',
        description: 'Recommend territory expansion outreach in regencies scoring >= 80 geographic opportunity.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 80,
        targetSegment: 'ALL',
        suggestedChannel: 'Email',
        priority: 'Medium',
        actionTemplate: 'Launch localized dealership showcase & corporate fleet acquisition campaign in high-index corridor',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [
          { version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Configured territory acquisition threshold.' },
        ],
      },
    ];
  }

  if (industryId === 'retail') {
    return [
      {
        id: `rule-${tenantId}-ret-retain`,
        tenant_id: tenantId,
        industryId,
        name: '45-Day Lapsing Loyalty Member Win-Back',
        strategy: 'RETAIN',
        description: 'Re-engage lapsing shoppers scoring >= 68 churn risk with tailored basket voucher.',
        minChurnScore: 68,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'WhatsApp',
        priority: 'Critical',
        actionTemplate: 'Deliver time-limited cross-category win-back voucher redeemable in-store or app',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized retail retention rule.' }],
      },
      {
        id: `rule-${tenantId}-ret-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'Platinum VIP Exclusive Retention Lock-In',
        strategy: 'DEFEND',
        description: 'Defend top-decile Platinum & Gold members from omnichannel share-of-wallet erosion.',
        minChurnScore: 18,
        minPropensityScore: 65,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Email',
        priority: 'High',
        actionTemplate: 'Invite to private seasonal capsule preview with double loyalty points accelerator',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized VIP defense rule.' }],
      },
      {
        id: `rule-${tenantId}-ret-develop`,
        tenant_id: tenantId,
        industryId,
        name: 'Omnichannel Basket Cross-Category Expansion',
        strategy: 'DEVELOP',
        description: 'Grow average basket items among Growth Potential shoppers with propensity >= 70.',
        minChurnScore: null,
        minPropensityScore: 70,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'SMS',
        priority: 'High',
        actionTemplate: 'Promote Click-and-Collect bundle reward across adjacent Home & Lifestyle categories',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized basket expansion rule.' }],
      },
      {
        id: `rule-${tenantId}-ret-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'High-Footfall Catchment Member Acquisition',
        strategy: 'ACQUIRE',
        description: 'Activate store catchment campaigns in districts exceeding 80 opportunity index.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 80,
        targetSegment: 'ALL',
        suggestedChannel: 'Branch Follow-up',
        priority: 'Medium',
        actionTemplate: 'Run geo-targeted flagship store membership sign-up drive with instant welcome tier',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initialized catchment acquisition rule.' }],
      },
    ];
  }

  if (industryId === 'banking') {
    return [
      {
        id: `rule-${tenantId}-bnk-retain`,
        tenant_id: tenantId,
        industryId,
        name: 'Deposit Outflow & Primary Bank Defense',
        strategy: 'RETAIN',
        description: 'Alert Relationship Managers when account attrition score >= 68.',
        minChurnScore: 68,
        minPropensityScore: null,
        minOpportunityScore: null,
        targetSegment: 'At-Risk Retention',
        suggestedChannel: 'Call Center',
        priority: 'Critical',
        actionTemplate: 'Trigger RM retention advisory call with tailored time-deposit rate review',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized banking attrition defense rule.' }],
      },
      {
        id: `rule-${tenantId}-bnk-defend`,
        tenant_id: tenantId,
        industryId,
        name: 'Priority Wealth Relationship Consolidation',
        strategy: 'DEFEND',
        description: 'Protect affluent multi-product customers with proactive portfolio review.',
        minChurnScore: 15,
        minPropensityScore: 66,
        minOpportunityScore: null,
        targetSegment: 'High-Value Loyal',
        suggestedChannel: 'Branch Follow-up',
        priority: 'High',
        actionTemplate: 'Schedule quarterly Priority Wealth portfolio rebalancing and fee-waiver review',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized Priority Wealth defense rule.' }],
      },
      {
        id: `rule-${tenantId}-bnk-develop`,
        tenant_id: tenantId,
        industryId,
        name: 'SME Working Capital & Mutual Fund Cross-Sell',
        strategy: 'DEVELOP',
        description: 'Cross-sell secondary credit or wealth facilities to Growth Potential clients >= 70 propensity.',
        minChurnScore: null,
        minPropensityScore: 70,
        minOpportunityScore: null,
        targetSegment: 'Growth Potential',
        suggestedChannel: 'Email',
        priority: 'High',
        actionTemplate: 'Present pre-screened SME liquidity line and digital treasury onboarding package',
        active: true,
        version: 1,
        updatedBy: 'Nadia Pramesti',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized cross-sell rule.' }],
      },
      {
        id: `rule-${tenantId}-bnk-acquire`,
        tenant_id: tenantId,
        industryId,
        name: 'Commercial Corridor Branch Opportunity Capture',
        strategy: 'ACQUIRE',
        description: 'Prioritize regional SME & affluent acquisition in corridors >= 78 opportunity index.',
        minChurnScore: null,
        minPropensityScore: null,
        minOpportunityScore: 78,
        targetSegment: 'ALL',
        suggestedChannel: 'Branch Follow-up',
        priority: 'Medium',
        actionTemplate: 'Deploy branch relationship team for commercial corridor merchant & payroll acquisition',
        active: true,
        version: 1,
        updatedBy: 'Ardian Kusuma',
        updatedAt: baseStamp,
        auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initialized branch corridor rule.' }],
      },
    ];
  }

  // Property (and default configurable fallback for insurance/healthcare)
  return [
    {
      id: `rule-${tenantId}-gen-retain`,
      tenant_id: tenantId,
      industryId,
      name: 'Stalled High-Value Prospect Re-Engagement',
      strategy: 'RETAIN',
      description: 'Re-engage high-risk accounts or stalled leads scoring >= 68 inactivity risk.',
      minChurnScore: 68,
      minPropensityScore: null,
      minOpportunityScore: null,
      targetSegment: 'At-Risk Retention',
      suggestedChannel: 'WhatsApp',
      priority: 'Critical',
      actionTemplate: 'Send updated financing comparison dossier and private gallery consultation slot',
      active: true,
      version: 1,
      updatedBy: 'Nadia Pramesti',
      updatedAt: baseStamp,
      auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized retention rule.' }],
    },
    {
      id: `rule-${tenantId}-gen-defend`,
      tenant_id: tenantId,
      industryId,
      name: 'Repeat Investor & Key Account Priority Access',
      strategy: 'DEFEND',
      description: 'Safeguard High-Value Loyal portfolio holders with priority advisory engagement.',
      minChurnScore: 15,
      minPropensityScore: 65,
      minOpportunityScore: null,
      targetSegment: 'High-Value Loyal',
      suggestedChannel: 'Branch Follow-up',
      priority: 'High',
      actionTemplate: 'Offer early-bird private allocation briefing and dedicated advisor walkthrough',
      active: true,
      version: 1,
      updatedBy: 'Nadia Pramesti',
      updatedAt: baseStamp,
      auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized defense rule.' }],
    },
    {
      id: `rule-${tenantId}-gen-develop`,
      tenant_id: tenantId,
      industryId,
      name: 'High-Propensity Portfolio Expansion Offer',
      strategy: 'DEVELOP',
      description: 'Convert Growth Potential accounts with propensity >= 70 into next-tier commitment.',
      minChurnScore: null,
      minPropensityScore: 70,
      minOpportunityScore: null,
      targetSegment: 'Growth Potential',
      suggestedChannel: 'Call Center',
      priority: 'High',
      actionTemplate: 'Schedule yield & partner mortgage pre-qualification session with specialist advisor',
      active: true,
      version: 1,
      updatedBy: 'Nadia Pramesti',
      updatedAt: baseStamp,
      auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Nadia Pramesti', actorRole: 'Tenant Administrator', changeNote: 'Initialized development rule.' }],
    },
    {
      id: `rule-${tenantId}-gen-acquire`,
      tenant_id: tenantId,
      industryId,
      name: 'High-Demand Geographic Zone Expansion',
      strategy: 'ACQUIRE',
      description: 'Activate acquisition programs in territories scoring >= 78 spatial opportunity.',
      minChurnScore: null,
      minPropensityScore: null,
      minOpportunityScore: 78,
      targetSegment: 'ALL',
      suggestedChannel: 'Email',
      priority: 'Medium',
      actionTemplate: 'Launch regional site demand showcase and localized partner referral campaign',
      active: true,
      version: 1,
      updatedBy: 'Ardian Kusuma',
      updatedAt: baseStamp,
      auditHistory: [{ version: 1, timestamp: baseStamp, actorName: 'Ardian Kusuma', actorRole: 'Platform Super Admin', changeNote: 'Initialized acquisition rule.' }],
    },
  ];
}

/** Deterministic transparent Next-Best-Action generator driven by active BusinessRules */
export function generateRecommendations(
  tenant: Tenant,
  industry: IndustryProfile,
  customers: CustomerRecord[],
  rules: BusinessRule[]
): Recommendation[] {
  const activeRules = rules.filter((r) => r.active);
  const recs: Recommendation[] = [];

  const retainRule = activeRules.find((r) => r.strategy === 'RETAIN');
  const defendRule = activeRules.find((r) => r.strategy === 'DEFEND');
  const developRule = activeRules.find((r) => r.strategy === 'DEVELOP');
  const acquireRule = activeRules.find((r) => r.strategy === 'ACQUIRE');

  // 1. RETAIN — Top at-risk customers
  if (retainRule) {
    const threshold = retainRule.minChurnScore ?? 68;
    const candidates = [...customers]
      .filter(
        (c) =>
          c.model_outputs.churn_risk_score >= threshold &&
          (retainRule.targetSegment === 'ALL' || c.customer_segment === retainRule.targetSegment)
      )
      .sort((a, b) => b.model_outputs.churn_risk_score * b.lifetime_value - a.model_outputs.churn_risk_score * a.lifetime_value)
      .slice(0, 8);

    candidates.forEach((c, idx) => {
      const consent = evaluateCustomerConsent(c);
      const eligibility: Recommendation['eligibility'] = consent.optedOut
        ? 'Suppressed (Opt-Out)'
        : !consent.hasConsent
          ? 'Suppressed (No Consent)'
          : consent.suppressed
            ? 'Review Required'
            : 'Eligible';

      recs.push({
        id: `NBA-${tenant.code.slice(0, 3)}-RET-${String(idx + 1).padStart(3, '0')}`,
        tenant_id: tenant.id,
        strategy: 'RETAIN',
        entityType: 'customer',
        entityId: c.customer_id,
        entityCode: c.code,
        entityName: c.full_name,
        regionId: c.region_id,
        regionName: c.demographic_attributes.city,
        segment: c.customer_segment,
        priority: c.model_outputs.churn_risk_score >= 82 ? 'Critical' : retainRule.priority,
        recommendedAction: retainRule.actionTemplate,
        businessRationale: `Simulated churn score ${c.model_outputs.churn_risk_score}/100 exceeds rule threshold (>=${threshold}) with last activity on ${c.last_activity_date}.`,
        suggestedChannel: retainRule.suggestedChannel,
        expectedOutcome: `Protect ~18% simulated retention recovery on IDR ${(c.lifetime_value / 1_000_000).toFixed(1)}M LTV account`,
        eligibility,
        eligibilityNotes: consent.suppressionReason ?? 'Consent verified · No active frequency suppression',
        status: 'Open',
        ruleId: retainRule.id,
        ruleVersion: retainRule.version,
        score: c.model_outputs.churn_risk_score,
        estimatedRevenueImpact: Math.round(c.lifetime_value * 0.22),
        createdAt: '2026-11-20',
      });
    });
  }

  // 2. DEFEND — High-value loyal accounts
  if (defendRule) {
    const minChurn = defendRule.minChurnScore ?? 15;
    const candidates = [...customers]
      .filter(
        (c) =>
          c.model_outputs.churn_risk_score >= minChurn &&
          (defendRule.targetSegment === 'ALL' || c.customer_segment === defendRule.targetSegment)
      )
      .sort((a, b) => b.lifetime_value - a.lifetime_value)
      .slice(0, 6);

    candidates.forEach((c, idx) => {
      const consent = evaluateCustomerConsent(c);
      const eligibility: Recommendation['eligibility'] = consent.optedOut
        ? 'Suppressed (Opt-Out)'
        : !consent.hasConsent
          ? 'Suppressed (No Consent)'
          : 'Eligible';

      recs.push({
        id: `NBA-${tenant.code.slice(0, 3)}-DEF-${String(idx + 1).padStart(3, '0')}`,
        tenant_id: tenant.id,
        strategy: 'DEFEND',
        entityType: 'customer',
        entityId: c.customer_id,
        entityCode: c.code,
        entityName: c.full_name,
        regionId: c.region_id,
        regionName: c.demographic_attributes.city,
        segment: c.customer_segment,
        priority: defendRule.priority,
        recommendedAction: defendRule.actionTemplate,
        businessRationale: `Top-value ${c.customer_segment} ${industry.terminology.customerSingular.toLowerCase()} in ${c.demographic_attributes.city} (tenure ${c.demographic_attributes.tenure_months}m).`,
        suggestedChannel: defendRule.suggestedChannel,
        expectedOutcome: `Defend high-value portfolio share & reinforce renewal cadence`,
        eligibility,
        eligibilityNotes: consent.suppressionReason ?? 'Consent verified · Priority defense eligible',
        status: 'Open',
        ruleId: defendRule.id,
        ruleVersion: defendRule.version,
        score: Math.min(99, Math.round(70 + c.model_outputs.purchase_propensity_score * 0.25)),
        estimatedRevenueImpact: Math.round(c.lifetime_value * 0.3),
        createdAt: '2026-11-20',
      });
    });
  }

  // 3. DEVELOP — High propensity growth accounts
  if (developRule) {
    const minProp = developRule.minPropensityScore ?? 70;
    const candidates = [...customers]
      .filter(
        (c) =>
          c.model_outputs.purchase_propensity_score >= minProp &&
          (developRule.targetSegment === 'ALL' || c.customer_segment === developRule.targetSegment)
      )
      .sort((a, b) => b.model_outputs.purchase_propensity_score - a.model_outputs.purchase_propensity_score)
      .slice(0, 6);

    candidates.forEach((c, idx) => {
      const consent = evaluateCustomerConsent(c);
      const eligibility: Recommendation['eligibility'] = consent.optedOut
        ? 'Suppressed (Opt-Out)'
        : !consent.hasConsent
          ? 'Suppressed (No Consent)'
          : 'Eligible';

      recs.push({
        id: `NBA-${tenant.code.slice(0, 3)}-DEV-${String(idx + 1).padStart(3, '0')}`,
        tenant_id: tenant.id,
        strategy: 'DEVELOP',
        entityType: 'customer',
        entityId: c.customer_id,
        entityCode: c.code,
        entityName: c.full_name,
        regionId: c.region_id,
        regionName: c.demographic_attributes.city,
        segment: c.customer_segment,
        priority: developRule.priority,
        recommendedAction: developRule.actionTemplate,
        businessRationale: `Simulated propensity ${c.model_outputs.purchase_propensity_score}% exceeds rule threshold (>=${minProp}%) in lifecycle stage "${c.lifecycle_stage}".`,
        suggestedChannel: developRule.suggestedChannel,
        expectedOutcome: `Projected +15–20% simulated upgrade/cross-sell conversion readiness`,
        eligibility,
        eligibilityNotes: consent.suppressionReason ?? 'Consent verified · Eligible for growth offer',
        status: 'Open',
        ruleId: developRule.id,
        ruleVersion: developRule.version,
        score: c.model_outputs.purchase_propensity_score,
        estimatedRevenueImpact: Math.round(c.lifetime_value * 0.35),
        createdAt: '2026-11-20',
      });
    });
  }

  // 4. ACQUIRE — Territory opportunity plays
  if (acquireRule) {
    const minOpp = acquireRule.minOpportunityScore ?? 78;
    const topTerritories = tenant.province.regencies
      .filter((r) => r.marketPotentialIndex >= minOpp)
      .sort((a, b) => b.marketPotentialIndex - a.marketPotentialIndex)
      .slice(0, 4);

    topTerritories.forEach((reg, idx) => {
      const regCount = customers.filter((c) => c.region_id === reg.id).length;
      recs.push({
        id: `NBA-${tenant.code.slice(0, 3)}-ACQ-${String(idx + 1).padStart(3, '0')}`,
        tenant_id: tenant.id,
        strategy: 'ACQUIRE',
        entityType: 'territory',
        entityId: reg.id,
        entityCode: reg.id.toUpperCase(),
        entityName: reg.name,
        regionId: reg.id,
        regionName: reg.name,
        segment: 'Growth Potential',
        priority: reg.marketPotentialIndex >= 86 ? 'High' : acquireRule.priority,
        recommendedAction: `${acquireRule.actionTemplate} (${reg.name})`,
        businessRationale: `Spatial opportunity index ${reg.marketPotentialIndex}/100 across ${reg.populationThousands.toLocaleString()}K catchment population (${regCount} active demo accounts).`,
        suggestedChannel: acquireRule.suggestedChannel,
        expectedOutcome: `Expand territory reach across ${reg.districts.length} priority districts in ${reg.name}`,
        eligibility: 'Eligible',
        eligibilityNotes: 'Territory-level acquisition play · Subject to regional marketing approval',
        status: 'Open',
        ruleId: acquireRule.id,
        ruleVersion: acquireRule.version,
        score: reg.marketPotentialIndex,
        estimatedRevenueImpact: Math.round(regCount * 1_650_000),
        createdAt: '2026-11-20',
      });
    });
  }

  const priorityRank: Record<Recommendation['priority'], number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };
  return recs.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority] || b.score - a.score);
}

export interface AudienceSelectionCriteria {
  tenantId: string;
  businessUnitId: string; // 'ALL' or bu id
  regionId: string; // 'ALL' or regency id
  targetSegment: string; // 'ALL' or segment
  minRiskCategory: 'ALL' | RiskCategory;
  minPropensityScore: number;
  respectConsent: boolean;
  respectSuppression: boolean;
  includeControlGroup: boolean;
  geoCustomerIds?: string[];
}

/** Deduplicated audience calculator with consent, opt-out, suppression, and control-group holdout */
export function computeCampaignAudience(
  customers: CustomerRecord[],
  criteria: AudienceSelectionCriteria
): CampaignAudience {
  const geoSet =
    criteria.geoCustomerIds && criteria.geoCustomerIds.length > 0
      ? new Set(criteria.geoCustomerIds)
      : null;

  const matched = customers.filter((c) => {
    if (c.tenant_id !== criteria.tenantId) return false;
    if (geoSet && !geoSet.has(c.customer_id)) return false;
    if (criteria.businessUnitId !== 'ALL' && c.business_unit_id !== criteria.businessUnitId) {
      return false;
    }
    if (criteria.regionId !== 'ALL' && c.region_id !== criteria.regionId) {
      return false;
    }
    if (criteria.targetSegment !== 'ALL' && c.customer_segment !== criteria.targetSegment) {
      return false;
    }
    if (criteria.minRiskCategory === 'High' && c.model_outputs.churn_risk_category !== 'High') {
      return false;
    }
    if (
      criteria.minRiskCategory === 'Medium' &&
      c.model_outputs.churn_risk_category === 'Low'
    ) {
      return false;
    }
    if (c.model_outputs.purchase_propensity_score < criteria.minPropensityScore) {
      return false;
    }
    return true;
  });

  // Deduplicate by customer_id
  const uniqueMap = new Map<string, CustomerRecord>();
  for (const c of matched) {
    uniqueMap.set(c.customer_id, c);
  }
  const deduplicated = Array.from(uniqueMap.values());

  let optedOutExcluded = 0;
  let consentMissingExcluded = 0;
  let suppressedExcluded = 0;
  const eligible: CustomerRecord[] = [];

  for (const c of deduplicated) {
    const profile = evaluateCustomerConsent(c);
    if (profile.optedOut) {
      optedOutExcluded++;
      continue;
    }
    if (criteria.respectConsent && !profile.hasConsent) {
      consentMissingExcluded++;
      continue;
    }
    if (criteria.respectSuppression && profile.suppressed) {
      suppressedExcluded++;
      continue;
    }
    eligible.push(c);
  }

  // Deterministic 10% holdout control group when requested and audience >= 15
  const controlIds: string[] = [];
  const reachableIds: string[] = [];
  for (const c of eligible) {
    const holdoutRoll = deterministicUnit(`ctrl-${criteria.tenantId}-${c.customer_id}`);
    if (criteria.includeControlGroup && eligible.length >= 15 && holdoutRoll < 0.1) {
      controlIds.push(c.customer_id);
    } else {
      reachableIds.push(c.customer_id);
    }
  }

  return {
    tenant_id: criteria.tenantId,
    totalMatchedRaw: matched.length,
    deduplicatedCount: deduplicated.length,
    consentVerifiedCount: deduplicated.length - consentMissingExcluded - optedOutExcluded,
    optedOutExcluded,
    suppressedExcluded: suppressedExcluded + consentMissingExcluded,
    controlGroupCount: controlIds.length,
    eligibleReachableCount: reachableIds.length,
    eligibleCustomerIds: reachableIds,
    controlCustomerIds: controlIds,
  };
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/** Strict campaign state machine & RBAC transition validator */
export function validateCampaignTransition(
  campaign: Campaign,
  toStatus: Mvp3CampaignStatus,
  persona: UserPersona
): TransitionValidationResult {
  const from = campaign.status;
  if (from === toStatus) {
    return { allowed: false, reason: `Campaign is already in ${toStatus} state.` };
  }

  // Terminal states cannot execute or advance
  if (from === 'Rejected' && toStatus !== 'Draft' && toStatus !== 'Pending Approval') {
    return {
      allowed: false,
      reason: 'Rejected campaigns cannot be scheduled or executed. Revise and resubmit for approval first.',
    };
  }
  if (from === 'Cancelled' || from === 'Completed') {
    return { allowed: false, reason: `${from} campaigns are closed and cannot transition to ${toStatus}.` };
  }

  // Approval / rejection strictly gated by campaigns.approve permission
  if (toStatus === 'Approved' || toStatus === 'Rejected') {
    if (!hasPermission(persona, 'campaigns.approve')) {
      return {
        allowed: false,
        reason: `Role "${persona.title}" is not authorized to approve or reject campaigns.`,
      };
    }
    if (from !== 'Pending Approval') {
      return {
        allowed: false,
        reason: `Campaign must be in Pending Approval before it can be ${toStatus.toLowerCase()}.`,
      };
    }
    return { allowed: true };
  }

  // Submission requires campaigns.create
  if (toStatus === 'Pending Approval') {
    if (!hasPermission(persona, 'campaigns.create')) {
      return { allowed: false, reason: `Role "${persona.title}" cannot submit campaigns for approval.` };
    }
    if (from !== 'Draft' && from !== 'Rejected') {
      return { allowed: false, reason: `Only Draft or Rejected campaigns can be submitted for approval.` };
    }
    if (campaign.audience.eligibleReachableCount === 0) {
      return { allowed: false, reason: 'Cannot submit a campaign with 0 eligible reachable customers.' };
    }
    return { allowed: true };
  }

  // Scheduling & Simulated Execution require approval + execute permission
  if (toStatus === 'Scheduled') {
    if (!hasPermission(persona, 'campaigns.execute_simulated')) {
      return { allowed: false, reason: `Role "${persona.title}" cannot schedule campaigns.` };
    }
    if (from !== 'Approved' || campaign.requiresReapproval) {
      return { allowed: false, reason: 'Campaign must be Approved before scheduling.' };
    }
    return { allowed: true };
  }

  if (toStatus === 'Simulated Running' || toStatus === 'Simulated Execution') {
    if (!hasPermission(persona, 'campaigns.execute_simulated')) {
      return { allowed: false, reason: `Role "${persona.title}" cannot start simulated execution.` };
    }
    if (from !== 'Approved' && from !== 'Scheduled') {
      return {
        allowed: false,
        reason: `Cannot execute campaign from ${from} state. Approval is strictly required.`,
      };
    }
    if (campaign.requiresReapproval) {
      return {
        allowed: false,
        reason: 'Campaign was modified after approval and requires reapproval before execution.',
      };
    }
    return { allowed: true };
  }

  if (toStatus === 'Completed' || toStatus === 'Failed') {
    if (!hasPermission(persona, 'campaigns.execute_simulated')) {
      return { allowed: false, reason: `Role "${persona.title}" cannot finalize execution.` };
    }
    if (from !== 'Simulated Running' && from !== 'Simulated Execution') {
      return { allowed: false, reason: 'Only a running simulated campaign can transition to Completed/Failed.' };
    }
    return { allowed: true };
  }

  if (toStatus === 'Cancelled') {
    if (!hasPermission(persona, 'campaigns.create') && !hasPermission(persona, 'campaigns.approve')) {
      return { allowed: false, reason: `Role "${persona.title}" cannot cancel campaigns.` };
    }
    return { allowed: true };
  }

  if (toStatus === 'Draft' && from === 'Rejected') {
    return { allowed: true };
  }

  return { allowed: false, reason: `Unsupported transition from ${from} to ${toStatus}.` };
}

/**
 * Deterministically generate deduplicated CampaignEvent[] and ConversionEvent[] for a campaign
 * up to `progressPct` (0-100) of its eligible audience. Never sends real external communications.
 */
export function generateDeterministicCampaignEvents(
  campaign: Campaign,
  allCustomers: CustomerRecord[],
  progressPct: number
): { events: CampaignEvent[]; conversions: ConversionEvent[] } {
  const customerMap = new Map(allCustomers.map((c) => [c.customer_id, c]));
  const eligibleIds = campaign.audience.eligibleCustomerIds;
  const clampedPct = Math.max(0, Math.min(100, progressPct));
  const processedCount = Math.round((eligibleIds.length * clampedPct) / 100);

  const channels = campaign.channels.length > 0 ? campaign.channels : [campaign.channel];
  const events: CampaignEvent[] = [];
  const conversions: ConversionEvent[] = [];
  const dedupeKeySet = new Set<string>();

  const pushEvent = (ev: CampaignEvent) => {
    const key = `${ev.campaignId}::${ev.customerId}::${ev.status}`;
    if (dedupeKeySet.has(key)) return;
    dedupeKeySet.add(key);
    events.push(ev);
  };

  for (let i = 0; i < processedCount; i++) {
    const cid = eligibleIds[i];
    const cust = customerMap.get(cid);
    if (!cust) continue;

    const assignedChannel = channels[i % channels.length];
    const roll = deterministicUnit(`sim-${campaign.id}-v${campaign.version}-${cid}`);
    const baseDate = campaign.scheduledDate || '2026-11-20';
    const minute = String((i * 3) % 60).padStart(2, '0');
    const hour = String(9 + (Math.floor((i * 3) / 60) % 8)).padStart(2, '0');

    // Always Queued first
    pushEvent({
      id: `ev-${campaign.id}-${cid}-q`,
      tenant_id: campaign.tenant_id,
      campaignId: campaign.id,
      customerId: cid,
      customerCode: cust.code,
      customerName: cust.full_name,
      regionId: cust.region_id,
      regionName: cust.demographic_attributes.city,
      segment: cust.customer_segment,
      channel: assignedChannel,
      status: 'Queued',
      timestamp: `${baseDate} ${hour}:${minute}`,
      detail: `Queued for simulated ${assignedChannel} dispatch (no live message sent).`,
      simulatedOnly: true,
    });

    // ~6% delivery failure
    if (roll < 0.06) {
      pushEvent({
        id: `ev-${campaign.id}-${cid}-fail`,
        tenant_id: campaign.tenant_id,
        campaignId: campaign.id,
        customerId: cid,
        customerCode: cust.code,
        customerName: cust.full_name,
        regionId: cust.region_id,
        regionName: cust.demographic_attributes.city,
        segment: cust.customer_segment,
        channel: assignedChannel,
        status: 'Failed',
        timestamp: `${baseDate} ${hour}:${minute}`,
        detail: `Simulated ${assignedChannel} delivery bounce / unreachable endpoint.`,
        simulatedOnly: true,
      });
      continue;
    }

    // Delivered
    pushEvent({
      id: `ev-${campaign.id}-${cid}-del`,
      tenant_id: campaign.tenant_id,
      campaignId: campaign.id,
      customerId: cid,
      customerCode: cust.code,
      customerName: cust.full_name,
      regionId: cust.region_id,
      regionName: cust.demographic_attributes.city,
      segment: cust.customer_segment,
      channel: assignedChannel,
      status: 'Delivered',
      timestamp: `${baseDate} ${hour}:${minute}`,
      detail: `Simulated ${assignedChannel} delivery acknowledged in sandbox.`,
      simulatedOnly: true,
    });

    // ~3% opted out post-delivery
    if (roll < 0.09) {
      pushEvent({
        id: `ev-${campaign.id}-${cid}-opt`,
        tenant_id: campaign.tenant_id,
        campaignId: campaign.id,
        customerId: cid,
        customerCode: cust.code,
        customerName: cust.full_name,
        regionId: cust.region_id,
        regionName: cust.demographic_attributes.city,
        segment: cust.customer_segment,
        channel: assignedChannel,
        status: 'Opted out',
        timestamp: `${baseDate} ${hour}:${minute}`,
        detail: `Simulated opt-out recorded; added to suppression registry.`,
        simulatedOnly: true,
      });
      continue;
    }

    // Response probability scaled by channel + propensity
    const channelLift =
      assignedChannel === 'Branch Follow-up'
        ? 0.44
        : assignedChannel === 'WhatsApp'
          ? 0.36
          : assignedChannel === 'Call Center'
            ? 0.32
            : assignedChannel === 'Email'
              ? 0.25
              : 0.22;
    const responseThreshold = 0.09 + channelLift * (0.75 + cust.model_outputs.purchase_propensity_score / 200);

    if (roll < responseThreshold) {
      pushEvent({
        id: `ev-${campaign.id}-${cid}-resp`,
        tenant_id: campaign.tenant_id,
        campaignId: campaign.id,
        customerId: cid,
        customerCode: cust.code,
        customerName: cust.full_name,
        regionId: cust.region_id,
        regionName: cust.demographic_attributes.city,
        segment: cust.customer_segment,
        channel: assignedChannel,
        status: 'Responded',
        timestamp: `${baseDate} ${hour}:${minute}`,
        detail: `Simulated positive engagement via ${assignedChannel}.`,
        simulatedOnly: true,
      });

      const convRateFactor = Math.min(0.55, Math.max(0.28, (campaign.estimatedConversionRate || 15) / 40));
      const convThreshold = 0.09 + (responseThreshold - 0.09) * convRateFactor;
      if (roll < convThreshold) {
        const attributedRev = Math.max(
          1_500_000,
          Math.round((cust.lifetime_value * 0.16) / 50000) * 50000
        );
        pushEvent({
          id: `ev-${campaign.id}-${cid}-conv`,
          tenant_id: campaign.tenant_id,
          campaignId: campaign.id,
          customerId: cid,
          customerCode: cust.code,
          customerName: cust.full_name,
          regionId: cust.region_id,
          regionName: cust.demographic_attributes.city,
          segment: cust.customer_segment,
          channel: assignedChannel,
          status: 'Converted',
          timestamp: `${baseDate} ${hour}:${minute}`,
          detail: `Simulated conversion attributed (IDR ${(attributedRev / 1_000_000).toFixed(1)}M).`,
          simulatedOnly: true,
        });

        conversions.push({
          id: `conv-${campaign.id}-${cid}`,
          tenant_id: campaign.tenant_id,
          campaignId: campaign.id,
          customerId: cid,
          regionId: cust.region_id,
          regionName: cust.demographic_attributes.city,
          segment: cust.customer_segment,
          channel: assignedChannel,
          attributedRevenue: attributedRev,
          convertedAt: `${baseDate} ${hour}:${minute}`,
          isControlGroup: false,
        });
      }
    }
  }

  // Control group baseline simulated organic conversions (when campaign is running/completed & holdout exists)
  if (clampedPct >= 50 && campaign.audience.controlCustomerIds.length > 0) {
    for (const ctrlId of campaign.audience.controlCustomerIds) {
      const cust = customerMap.get(ctrlId);
      if (!cust) continue;
      const ctrlRoll = deterministicUnit(`ctrl-conv-${campaign.id}-${ctrlId}`);
      if (ctrlRoll < 0.065) {
        const rev = Math.max(1_200_000, Math.round((cust.lifetime_value * 0.12) / 50000) * 50000);
        conversions.push({
          id: `conv-ctrl-${campaign.id}-${ctrlId}`,
          tenant_id: campaign.tenant_id,
          campaignId: campaign.id,
          customerId: ctrlId,
          regionId: cust.region_id,
          regionName: cust.demographic_attributes.city,
          segment: cust.customer_segment,
          channel: campaign.channel,
          attributedRevenue: rev,
          convertedAt: `${campaign.scheduledDate || '2026-11-20'} 17:00`,
          isControlGroup: true,
        });
      }
    }
  }

  return { events, conversions };
}

export interface CampaignPerformanceRow {
  campaignId: string;
  campaignName: string;
  status: Mvp3CampaignStatus;
  channel: CampaignChannel;
  regionName: string;
  segment: string;
  reach: number;
  delivered: number;
  responded: number;
  converted: number;
  failed: number;
  optedOut: number;
  deliveryRatePct: number;
  responseRatePct: number;
  conversionRatePct: number;
  campaignCost: number;
  attributedRevenue: number;
  roiPct: number | null; // null if cost == 0 or no executed events
  hasControlGroup: boolean;
  controlGroupSize: number;
  controlConversions: number;
  controlConversionRatePct: number | null;
  observedDiffPctPts: number | null;
}

export interface DimensionPerformanceRow {
  key: string;
  reach: number;
  delivered: number;
  responded: number;
  converted: number;
  deliveryRatePct: number;
  responseRatePct: number;
  conversionRatePct: number;
  attributedRevenue: number;
}

export interface EventDrivenPerformanceSummary {
  totalReach: number;
  totalDelivered: number;
  totalResponded: number;
  totalConverted: number;
  deliveryRatePct: number;
  responseRatePct: number;
  conversionRatePct: number;
  totalCampaignCost: number;
  totalAttributedRevenue: number;
  blendedRoiPct: number | null;
  campaigns: CampaignPerformanceRow[];
  byRegion: DimensionPerformanceRow[];
  bySegment: DimensionPerformanceRow[];
  byChannel: DimensionPerformanceRow[];
}

/** Computes ALL performance & ROI KPIs strictly from CampaignEvent[] and ConversionEvent[] records */
export function computeEventDrivenPerformance(
  campaigns: Campaign[],
  events: CampaignEvent[],
  conversions: ConversionEvent[]
): EventDrivenPerformanceSummary {
  const rows: CampaignPerformanceRow[] = campaigns.map((cmp) => {
    const cmpEvents = events.filter((e) => e.campaignId === cmp.id);
    const cmpConvs = conversions.filter((c) => c.campaignId === cmp.id && !c.isControlGroup);
    const ctrlConvs = conversions.filter((c) => c.campaignId === cmp.id && c.isControlGroup);

    const reach = cmpEvents.filter((e) => e.status === 'Queued').length;
    const delivered = cmpEvents.filter((e) => e.status === 'Delivered').length;
    const responded = cmpEvents.filter((e) => e.status === 'Responded').length;
    const converted = cmpConvs.length;
    const failed = cmpEvents.filter((e) => e.status === 'Failed').length;
    const optedOut = cmpEvents.filter((e) => e.status === 'Opted out').length;

    const deliveryRatePct = reach > 0 ? Number(((delivered / reach) * 100).toFixed(1)) : 0;
    const responseRatePct = delivered > 0 ? Number(((responded / delivered) * 100).toFixed(1)) : 0;
    const conversionRatePct = delivered > 0 ? Number(((converted / delivered) * 100).toFixed(1)) : 0;
    const attributedRevenue = cmpConvs.reduce((acc, c) => acc + c.attributedRevenue, 0);
    const roiPct =
      reach > 0 && cmp.budgetAllocated > 0
        ? Number((((attributedRevenue - cmp.budgetAllocated) / cmp.budgetAllocated) * 100).toFixed(1))
        : null;

    const controlSize = cmp.audience.controlGroupCount;
    const hasControlGroup = controlSize > 0 && reach > 0;
    const controlConversionRatePct = hasControlGroup
      ? Number(((ctrlConvs.length / controlSize) * 100).toFixed(1))
      : null;
    const observedDiffPctPts =
      hasControlGroup && controlConversionRatePct !== null
        ? Number((conversionRatePct - controlConversionRatePct).toFixed(1))
        : null;

    return {
      campaignId: cmp.id,
      campaignName: cmp.name,
      status: cmp.status,
      channel: cmp.channel,
      regionName: cmp.regionName,
      segment: cmp.targetSegment,
      reach,
      delivered,
      responded,
      converted,
      failed,
      optedOut,
      deliveryRatePct,
      responseRatePct,
      conversionRatePct,
      campaignCost: cmp.budgetAllocated,
      attributedRevenue,
      roiPct,
      hasControlGroup,
      controlGroupSize: controlSize,
      controlConversions: ctrlConvs.length,
      controlConversionRatePct,
      observedDiffPctPts,
    };
  });

  const executedRows = rows.filter((r) => r.reach > 0);
  const totalReach = executedRows.reduce((a, r) => a + r.reach, 0);
  const totalDelivered = executedRows.reduce((a, r) => a + r.delivered, 0);
  const totalResponded = executedRows.reduce((a, r) => a + r.responded, 0);
  const totalConverted = executedRows.reduce((a, r) => a + r.converted, 0);
  const totalCampaignCost = executedRows.reduce((a, r) => a + r.campaignCost, 0);
  const totalAttributedRevenue = executedRows.reduce((a, r) => a + r.attributedRevenue, 0);

  const aggregateBy = (
    extractor: (e: CampaignEvent) => string,
    convExtractor: (c: ConversionEvent) => string
  ): DimensionPerformanceRow[] => {
    const map = new Map<
      string,
      { reach: number; delivered: number; responded: number; converted: number; revenue: number }
    >();
    const ensure = (k: string) => {
      let item = map.get(k);
      if (!item) {
        item = { reach: 0, delivered: 0, responded: 0, converted: 0, revenue: 0 };
        map.set(k, item);
      }
      return item;
    };

    for (const ev of events) {
      const bucket = ensure(extractor(ev));
      if (ev.status === 'Queued') bucket.reach++;
      else if (ev.status === 'Delivered') bucket.delivered++;
      else if (ev.status === 'Responded') bucket.responded++;
    }
    for (const cv of conversions) {
      if (cv.isControlGroup) continue;
      const bucket = ensure(convExtractor(cv));
      bucket.converted++;
      bucket.revenue += cv.attributedRevenue;
    }

    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        reach: v.reach,
        delivered: v.delivered,
        responded: v.responded,
        converted: v.converted,
        deliveryRatePct: v.reach > 0 ? Number(((v.delivered / v.reach) * 100).toFixed(1)) : 0,
        responseRatePct: v.delivered > 0 ? Number(((v.responded / v.delivered) * 100).toFixed(1)) : 0,
        conversionRatePct: v.delivered > 0 ? Number(((v.converted / v.delivered) * 100).toFixed(1)) : 0,
        attributedRevenue: v.revenue,
      }))
      .sort((a, b) => b.attributedRevenue - a.attributedRevenue);
  };

  return {
    totalReach,
    totalDelivered,
    totalResponded,
    totalConverted,
    deliveryRatePct: totalReach > 0 ? Number(((totalDelivered / totalReach) * 100).toFixed(1)) : 0,
    responseRatePct: totalDelivered > 0 ? Number(((totalResponded / totalDelivered) * 100).toFixed(1)) : 0,
    conversionRatePct: totalDelivered > 0 ? Number(((totalConverted / totalDelivered) * 100).toFixed(1)) : 0,
    totalCampaignCost,
    totalAttributedRevenue,
    blendedRoiPct:
      totalCampaignCost > 0
        ? Number((((totalAttributedRevenue - totalCampaignCost) / totalCampaignCost) * 100).toFixed(1))
        : null,
    campaigns: rows,
    byRegion: aggregateBy((e) => e.regionName, (c) => c.regionName),
    bySegment: aggregateBy((e) => e.segment, (c) => c.segment),
    byChannel: aggregateBy((e) => e.channel, (c) => c.channel),
  };
}

/** Build tenant-scoped Model Registry entries for Continuous Learning & Governance */
export function buildDefaultModelRegistry(
  tenantId: string,
  industry: IndustryProfile,
  sampleSize: number
): ModelRegistryEntry[] {
  return [
    {
      id: `mdl-${tenantId}-churn`,
      tenant_id: tenantId,
      industryId: industry.id,
      modelName: `${industry.name} Churn Risk Scorer`,
      predictionType: 'churn_risk',
      version: 'serveon-churn-sim-v2.1',
      status: 'Simulated Demo',
      lastEvaluatedAt: '2026-11-20',
      evaluationSampleSize: sampleSize,
      driftIndicator: 'Stable',
      monitoringScorePct: 91.4,
      featureCompletenessPct: 94.2,
      retrainingStatus: 'Idle',
      validationStatus: 'Simulated Baseline Only',
      limitations: [
        'Deterministic synthetic prototype model; not trained on historical production churn labels.',
        'External macroeconomic & competitor pricing features are excluded in demo mode.',
      ],
      validationNotes: 'Baseline deterministic consistency verified across tenant synthetic records.',
    },
    {
      id: `mdl-${tenantId}-propensity`,
      tenant_id: tenantId,
      industryId: industry.id,
      modelName: `${industry.name} Purchase Propensity Model`,
      predictionType: 'purchase_propensity',
      version: 'serveon-propensity-sim-v2.0',
      status: 'Simulated Demo',
      lastEvaluatedAt: '2026-11-20',
      evaluationSampleSize: sampleSize,
      driftIndicator: 'Watch',
      monitoringScorePct: 86.8,
      featureCompletenessPct: 91.6,
      retrainingStatus: 'Idle',
      validationStatus: 'Simulated Baseline Only',
      limitations: [
        'Simulated propensity index; requires campaign conversion feedback loops before production calibration.',
      ],
      validationNotes: 'Minor seasonal distribution shift flagged for review (Watch status).',
    },
    {
      id: `mdl-${tenantId}-spatial`,
      tenant_id: tenantId,
      industryId: industry.id,
      modelName: `${industry.name} Spatial Opportunity Scorer`,
      predictionType: 'geographic_opportunity',
      version: 'serveon-spatial-sim-v2.0',
      status: 'Simulated Demo',
      lastEvaluatedAt: '2026-11-20',
      evaluationSampleSize: sampleSize,
      driftIndicator: 'Stable',
      monitoringScorePct: 93.0,
      featureCompletenessPct: 96.5,
      retrainingStatus: 'Idle',
      validationStatus: 'Simulated Baseline Only',
      limitations: [
        'Uses illustrative WGS-84 regency polygons; official BPS census/cadastral feeds required for production.',
      ],
      validationNotes: 'Spatial bounds and branch coverage radius verified across all tenant territories.',
    },
    {
      id: `mdl-${tenantId}-engagement`,
      tenant_id: tenantId,
      industryId: industry.id,
      modelName: `${industry.name} Engagement Health Indicator`,
      predictionType: 'engagement_index',
      version: 'serveon-engage-sim-v1.8',
      status: 'Simulated Demo',
      lastEvaluatedAt: '2026-11-20',
      evaluationSampleSize: sampleSize,
      driftIndicator: 'Stable',
      monitoringScorePct: 89.2,
      featureCompletenessPct: 88.9,
      retrainingStatus: 'Idle',
      validationStatus: 'Simulated Baseline Only',
      limitations: [
        'Derived from synthetic touchpoint logs; live digital app telemetry not integrated.',
      ],
      validationNotes: 'Consistent recency and channel responsiveness weighting verified.',
    },
  ];
}

export function buildDefaultApprovalPolicy(tenantId: string): ApprovalPolicy {
  return {
    tenant_id: tenantId,
    requireApprovalAboveBudgetIdr: 0,
    requireReapprovalOnEdit: true,
    allowExecutiveOverride: true,
    minimumConsentVerification: true,
    updatedBy: 'Nadia Pramesti',
    updatedAt: '2026-11-18 09:00',
  };
}

/** Browser-safe CSV export helper */
export function triggerCsvDownload(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  filename: string
): void {
  const escapeCell = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

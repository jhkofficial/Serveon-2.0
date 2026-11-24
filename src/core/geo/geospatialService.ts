import type { CustomerRecord, IndustryId, Tenant } from '../../types/platform';
import type {
  CompetitorFilterMode,
  CompetitorLocation,
  CoverageAnalysisResult,
  CoverageOverlapItem,
  CustomerMapCounts,
  CustomerMarkerGroup,
  CustomerToDealerInsights,
  DealerNetworkNode,
  GeoClusterNode,
  GeoFilterState,
  GeoSelectionGeometry,
  GeoSelectionSummary,
  GeoViewportBounds,
  GeocodedCustomer,
  IndustryGeoConfig,
  NetworkNodeCategory,
  OpportunityGapCategory,
  OpportunityGapZone,
  OpportunityWeights,
  SavedMapView,
} from '../../types/geospatial';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import { evaluateCustomerConsent } from '../ai-engine/mvp3Engine';

export const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityWeights = {
  concentration: 25,
  growthPotential: 20,
  atRiskDensity: 20,
  coverageGap: 20,
  competitorProximity: 15,
};

export const MARKER_GROUP_META: Record<
  CustomerMarkerGroup,
  { label: string; color: string; stroke: string; shortLabel: string }
> = {
  high_value: {
    label: 'High-Value Loyal',
    color: '#15946A',
    stroke: '#0D5E43',
    shortLabel: 'High-Value',
  },
  active: {
    label: 'Active / Core',
    color: '#1769AA',
    stroke: '#102B4D',
    shortLabel: 'Active',
  },
  growth: {
    label: 'Growth Potential',
    color: '#D97706',
    stroke: '#92400E',
    shortLabel: 'Growth',
  },
  at_risk: {
    label: 'At-Risk',
    color: '#D9534F',
    stroke: '#991B1B',
    shortLabel: 'At-Risk',
  },
  inactive: {
    label: 'Inactive / Dormant',
    color: '#64748B',
    stroke: '#334155',
    shortLabel: 'Inactive',
  },
};

export const INDUSTRY_GEO_CONFIGS: Record<IndustryId, IndustryGeoConfig> = {
  motorcycle: {
    industryId: 'motorcycle',
    customerLabel: 'Rider',
    customerPlural: 'Riders',
    dealerLabel: 'Main / Sales Dealer',
    dealerPlural: 'Main & Sales Dealers',
    serviceLabel: 'AHASS Service Center',
    servicePlural: 'AHASS Workshops',
    branchLabel: 'Regional Branch Office',
    competitorDealerLabel: 'Competitor Motorcycle Dealer',
    competitorServiceLabel: 'Competitor Service Workshop',
    serviceStatusLabel: 'AHASS Service Recency',
    productFilterLabel: 'Motorcycle Model',
    competitorBrands: [
      'Competitor Brand Y (Illustrative)',
      'Competitor Brand S (Illustrative)',
      'Independent Service Network (Illustrative)',
    ],
    defaultRadiusKm: 5,
  },
  automotive: {
    industryId: 'automotive',
    customerLabel: 'Vehicle Owner',
    customerPlural: 'Vehicle Owners',
    dealerLabel: 'Sales Dealership',
    dealerPlural: 'Sales Dealerships',
    serviceLabel: 'Authorized Workshop',
    servicePlural: 'Service & Body-Paint Centers',
    branchLabel: 'Regional Showroom / Fleet Hub',
    competitorDealerLabel: 'Competitor Dealership',
    competitorServiceLabel: 'Competitor Workshop',
    serviceStatusLabel: 'Workshop Service Recency',
    productFilterLabel: 'Vehicle Model',
    competitorBrands: [
      'Competitor Auto Group A (Illustrative)',
      'Competitor Auto Group B (Illustrative)',
      'Independent Auto Workshop (Illustrative)',
    ],
    defaultRadiusKm: 5,
  },
  automotive_parts: {
    industryId: 'automotive_parts',
    customerLabel: 'Workshop Partner',
    customerPlural: 'Workshop Partners',
    dealerLabel: 'Parts Distribution Depot',
    dealerPlural: 'Distribution Depots',
    serviceLabel: 'Fast-Fit Outlet',
    servicePlural: 'Fast-Fit Retail Outlets',
    branchLabel: 'Logistics Warehouse',
    competitorDealerLabel: 'Competitor Parts Distributor',
    competitorServiceLabel: 'Competitor Fast-Fit Chain',
    serviceStatusLabel: 'Replenishment Recency',
    productFilterLabel: 'SKU Line',
    competitorBrands: [
      'Competitor Parts Dist. A (Illustrative)',
      'Competitor Parts Dist. B (Illustrative)',
      'Regional Fast-Fit Chain (Illustrative)',
    ],
    defaultRadiusKm: 8,
  },
  banking: {
    industryId: 'banking',
    customerLabel: 'Account Holder',
    customerPlural: 'Account Holders',
    dealerLabel: 'Flagship Digital Hub',
    dealerPlural: 'Flagship Digital Hubs',
    serviceLabel: 'Advisory & SME Lounge',
    servicePlural: 'Advisory Lounges',
    branchLabel: 'Merchant Onboarding Desk',
    competitorDealerLabel: 'Competitor Bank Branch',
    competitorServiceLabel: 'Competitor Digital Lounge',
    serviceStatusLabel: 'RM / Digital Activity Recency',
    productFilterLabel: 'Banking Product',
    competitorBrands: [
      'Competitor Bank A (Illustrative)',
      'Competitor Digital Bank B (Illustrative)',
      'Competitor SME Bank C (Illustrative)',
    ],
    defaultRadiusKm: 4,
  },
  insurance: {
    industryId: 'insurance',
    customerLabel: 'Policyholder',
    customerPlural: 'Policyholders',
    dealerLabel: 'Regional Agency Office',
    dealerPlural: 'Agency Offices',
    serviceLabel: 'Bancassurance & Advisory Desk',
    servicePlural: 'Advisory & Claim Desks',
    branchLabel: 'District Protection Office',
    competitorDealerLabel: 'Competitor Insurance Agency',
    competitorServiceLabel: 'Competitor Bancassurance Desk',
    serviceStatusLabel: 'Policy Review Recency',
    productFilterLabel: 'Policy Plan',
    competitorBrands: [
      'Competitor Life Insurer A (Illustrative)',
      'Competitor Health Insurer B (Illustrative)',
      'Regional Brokerage Group (Illustrative)',
    ],
    defaultRadiusKm: 8,
  },
  retail: {
    industryId: 'retail',
    customerLabel: 'Member',
    customerPlural: 'Members',
    dealerLabel: 'Flagship Store',
    dealerPlural: 'Flagship Stores',
    serviceLabel: 'Click & Collect Hub',
    servicePlural: 'Fulfillment Hubs',
    branchLabel: 'Regional Retail Office',
    competitorDealerLabel: 'Competitor Retail Store',
    competitorServiceLabel: 'Competitor Hypermarket',
    serviceStatusLabel: 'Purchase Recency',
    productFilterLabel: 'Category Affinity',
    competitorBrands: [
      'Competitor Retail Chain A (Illustrative)',
      'Competitor Lifestyle Store B (Illustrative)',
    ],
    defaultRadiusKm: 5,
  },
  property: {
    industryId: 'property',
    customerLabel: 'Buyer / Prospect',
    customerPlural: 'Buyers & Prospects',
    dealerLabel: 'Marketing Gallery',
    dealerPlural: 'Marketing Galleries',
    serviceLabel: 'Site Experience Center',
    servicePlural: 'Site Advisory Centers',
    branchLabel: 'Regional Sales Office',
    competitorDealerLabel: 'Competitor Development',
    competitorServiceLabel: 'Competitor Marketing Gallery',
    serviceStatusLabel: 'Advisory Touchpoint Recency',
    productFilterLabel: 'Property Project',
    competitorBrands: [
      'Competitor Township A (Illustrative)',
      'Competitor Residences B (Illustrative)',
    ],
    defaultRadiusKm: 10,
  },
  healthcare: {
    industryId: 'healthcare',
    customerLabel: 'Patient Member',
    customerPlural: 'Patient Members',
    dealerLabel: 'Primary Clinic / Hospital',
    dealerPlural: 'Clinics & Hospitals',
    serviceLabel: 'Diagnostic & Wellness Center',
    servicePlural: 'Diagnostic Centers',
    branchLabel: 'Care Coordination Hub',
    competitorDealerLabel: 'Competitor Clinic',
    competitorServiceLabel: 'Competitor Diagnostic Lab',
    serviceStatusLabel: 'Care Visit Recency',
    productFilterLabel: 'Care Program',
    competitorBrands: [
      'Competitor Health Network A (Illustrative)',
      'Competitor Lab Group B (Illustrative)',
    ],
    defaultRadiusKm: 5,
  },
};

export function getIndustryGeoConfig(industryId: IndustryId): IndustryGeoConfig {
  return INDUSTRY_GEO_CONFIGS[industryId] ?? INDUSTRY_GEO_CONFIGS.motorcycle;
}

function fnv1aHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(key: string): number {
  return (fnv1aHash(key) % 100000) / 100000;
}

/** Exact WGS-84 Haversine straight-line distance in kilometers */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371.0088;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function classifyBranchCategory(branchType: string): NetworkNodeCategory {
  const lower = branchType.toLowerCase();
  if (
    lower.includes('ahass') ||
    lower.includes('service') ||
    lower.includes('workshop') ||
    lower.includes('fast-fit') ||
    lower.includes('advisory') ||
    lower.includes('lounge') ||
    lower.includes('body-paint')
  ) {
    if (lower.includes('main dealer') || lower.includes('flagship')) return 'dealer';
    return 'service';
  }
  if (
    lower.includes('dealer') ||
    lower.includes('showroom') ||
    lower.includes('flagship') ||
    lower.includes('depot') ||
    lower.includes('agency')
  ) {
    return 'dealer';
  }
  return 'branch';
}

/**
 * Build industry-agnostic dealer, service center, and branch network nodes
 * strictly scoped to the active tenant and permitted regions.
 */
export function buildTenantDealerNetwork(
  tenant: Tenant,
  industryId: IndustryId,
  permittedRegionIds: string[],
  customers: CustomerRecord[]
): DealerNetworkNode[] {
  const geoConfig = getIndustryGeoConfig(industryId);
  const regMap = new Map(tenant.province.regencies.map((r) => [r.id, r]));
  const permittedSet = new Set(permittedRegionIds);

  const countByBranch = new Map<string, number>();
  for (const c of customers) {
    if (c.tenant_id !== tenant.id) continue;
    countByBranch.set(c.branch_id, (countByBranch.get(c.branch_id) ?? 0) + 1);
  }

  const baseNodes: DealerNetworkNode[] = tenant.branches
    .filter((b) => b.tenant_id === tenant.id && permittedSet.has(b.region_id))
    .map((b) => {
      const reg = regMap.get(b.region_id);
      const category = classifyBranchCategory(b.type);
      const assigned = countByBranch.get(b.id) ?? 0;
      const monthlyVol = Math.max(85, Math.round(assigned * 2.4 + b.capacityScore * 1.8));
      const opStatus: DealerNetworkNode['operational_status'] =
        b.capacityScore >= 90
          ? 'High Load'
          : category === 'service'
            ? 'Express Active'
            : 'Operational';

      return {
        dealer_id: b.id,
        tenant_id: tenant.id,
        business_unit_id: b.business_unit_id,
        region_id: b.region_id,
        region_name: reg?.name ?? b.region_id,
        district_id: b.district_id,
        code: b.code,
        name: b.name,
        dealer_type: b.type,
        network_category: category,
        address: `Jl. Raya ${reg?.name ?? tenant.primaryProvinceName} Corridor · ${b.code} (Synthetic Demo)`,
        operational_status: opStatus,
        latitude: Number(b.lat.toFixed(5)),
        longitude: Number(b.lng.toFixed(5)),
        service_capacity_pct: b.capacityScore,
        service_volume_monthly: monthlyVol,
        assigned_customers: assigned,
        default_coverage_km: geoConfig.defaultRadiusKm,
      };
    });

  // Add realistic satellite service/branch points in the primary regency when it has < 3 nodes
  // so Dealer vs Service/AHASS vs Branch layer toggles are always rich and clear.
  const primaryReg = tenant.province.regencies.find((r) => permittedSet.has(r.id));
  if (primaryReg) {
    const primaryNodes = baseNodes.filter((n) => n.region_id === primaryReg.id);
    const hasService = primaryNodes.some((n) => n.network_category === 'service');
    const hasBranch = primaryNodes.some((n) => n.network_category === 'branch');

    if (!hasService && primaryNodes.length > 0) {
      const anchor = primaryNodes[0];
      baseNodes.push({
        dealer_id: `${anchor.dealer_id}-svc-sat`,
        tenant_id: tenant.id,
        business_unit_id: anchor.business_unit_id,
        region_id: primaryReg.id,
        region_name: primaryReg.name,
        district_id: anchor.district_id,
        code: `${tenant.code.slice(0, 3)}-SVC1`,
        name: `${tenant.shortName} ${geoConfig.serviceLabel} East ${primaryReg.name.replace(/^Kota |^Kab\. /, '')}`,
        dealer_type: geoConfig.serviceLabel,
        network_category: 'service',
        address: `East Corridor, ${primaryReg.name} (Synthetic Demo)`,
        operational_status: 'Express Active',
        latitude: Number((anchor.latitude + 0.024).toFixed(5)),
        longitude: Number((anchor.longitude + 0.031).toFixed(5)),
        service_capacity_pct: 82,
        service_volume_monthly: Math.max(120, Math.round(anchor.service_volume_monthly * 0.72)),
        assigned_customers: Math.round(anchor.assigned_customers * 0.3),
        default_coverage_km: geoConfig.defaultRadiusKm,
      });
    }

    if (!hasBranch && primaryNodes.length > 0) {
      const anchor = primaryNodes[0];
      baseNodes.push({
        dealer_id: `${anchor.dealer_id}-br-sat`,
        tenant_id: tenant.id,
        business_unit_id: anchor.business_unit_id,
        region_id: primaryReg.id,
        region_name: primaryReg.name,
        district_id: anchor.district_id,
        code: `${tenant.code.slice(0, 3)}-BR01`,
        name: `${tenant.shortName} ${geoConfig.branchLabel} ${primaryReg.name.replace(/^Kota |^Kab\. /, '')}`,
        dealer_type: geoConfig.branchLabel,
        network_category: 'branch',
        address: `Central Business District, ${primaryReg.name} (Synthetic Demo)`,
        operational_status: 'Operational',
        latitude: Number((anchor.latitude - 0.028).toFixed(5)),
        longitude: Number((anchor.longitude - 0.026).toFixed(5)),
        service_capacity_pct: 79,
        service_volume_monthly: Math.max(95, Math.round(anchor.service_volume_monthly * 0.55)),
        assigned_customers: Math.round(anchor.assigned_customers * 0.2),
        default_coverage_km: geoConfig.defaultRadiusKm,
      });
    }
  }

  return baseNodes;
}

/**
 * Deterministic synthetic competitor reference locations per tenant/industry.
 * Explicitly labeled illustrative synthetic data — never presented as verified real branches.
 */
export function buildTenantCompetitors(
  tenant: Tenant,
  industryId: IndustryId,
  permittedRegionIds: string[]
): CompetitorLocation[] {
  const geoConfig = getIndustryGeoConfig(industryId);
  const provinceGeo = getProvinceMapConfig(tenant);
  const permittedSet = new Set(permittedRegionIds);
  const competitors: CompetitorLocation[] = [];

  for (const reg of tenant.province.regencies) {
    if (!permittedSet.has(reg.id)) continue;
    const territory = provinceGeo.territories.find((t) => t.regionId === reg.id);
    const centerLat = territory?.center[0] ?? reg.lat;
    const centerLng = territory?.center[1] ?? reg.lng;

    // 3 illustrative competitors in primary/high-potential cities, 2 in smaller regencies
    const count = reg.marketPotentialIndex >= 85 ? 4 : 2;
    const spreadDeg = tenant.primaryProvinceId === 'prov-jakarta' ? 0.032 : 0.068;

    for (let i = 0; i < count; i++) {
      const key = `comp-${tenant.id}-${reg.id}-${i}`;
      const angle = seededUnit(`${key}-ang`) * Math.PI * 2;
      const radiusFactor = 0.28 + seededUnit(`${key}-rad`) * 0.72;
      const lat = Number((centerLat + Math.cos(angle) * spreadDeg * radiusFactor).toFixed(5));
      const lng = Number((centerLng + Math.sin(angle) * spreadDeg * radiusFactor * 1.15).toFixed(5));
      const isService = i % 2 === 1;
      const brand = geoConfig.competitorBrands[i % geoConfig.competitorBrands.length];
      const shortCity = reg.name.replace(/^Kota |^Kab\. & Kota |^Kab\. /, '');

      competitors.push({
        competitor_id: `comp-${tenant.code.toLowerCase()}-${reg.id.replace('reg-', '')}-${i + 1}`,
        tenant_id: tenant.id,
        region_id: reg.id,
        region_name: reg.name,
        competitor_brand: brand,
        competitor_category: isService ? 'service' : 'dealer',
        category_label: isService
          ? geoConfig.competitorServiceLabel
          : geoConfig.competitorDealerLabel,
        location_name: `${brand.replace(' (Illustrative)', '')} — ${shortCity} ${isService ? 'Service Point' : 'Outlet'} ${i + 1}`,
        latitude: lat,
        longitude: lng,
        address: `Corridor ${i + 1}, ${reg.name} (Illustrative Synthetic Reference)`,
        location_source: 'Illustrative Synthetic Reference Data (Demo Only)',
        last_verified_date: '2026-11-15 (Synthetic Demo Baseline)',
      });
    }
  }

  return competitors;
}

function daysBetween(dateStr: string, refStr = '2026-11-20'): number {
  const d1 = new Date(dateStr).getTime();
  const d2 = new Date(refStr).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 45;
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function deriveMarkerGroup(c: CustomerRecord): CustomerMarkerGroup {
  if (c.status === 'Dormant') return 'inactive';
  if (c.status === 'At-Risk' || c.model_outputs.churn_risk_category === 'High') return 'at_risk';
  if (c.customer_segment === 'High-Value Loyal') return 'high_value';
  if (c.customer_segment === 'Growth Potential') return 'growth';
  return 'active';
}

/**
 * Deterministically geocode tenant customers to valid WGS-84 coordinates anchored to
 * their district centroid / territory polygon with realistic urban + outer-catchment spread
 * so coverage radius (1–15 km) and outside-coverage at-risk analytics work cleanly.
 */
export function buildGeocodedCustomers(
  tenant: Tenant,
  customers: CustomerRecord[],
  dealers: DealerNetworkNode[]
): GeocodedCustomer[] {
  const provinceGeo = getProvinceMapConfig(tenant);
  const territoryMap = new Map(provinceGeo.territories.map((t) => [t.regionId, t]));
  const regMap = new Map(tenant.province.regencies.map((r) => [r.id, r]));
  const dealerMap = new Map(dealers.map((d) => [d.dealer_id, d]));

  const isCompactMetro = tenant.primaryProvinceId === 'prov-jakarta';
  const [[minLat, minLng], [maxLat, maxLng]] = provinceGeo.bounds;

  const result: GeocodedCustomer[] = [];

  for (const c of customers) {
    if (c.tenant_id !== tenant.id) continue;

    const territory = territoryMap.get(c.region_id);
    const reg = regMap.get(c.region_id);
    const assignedDealer = dealerMap.get(c.branch_id) ?? dealers.find((d) => d.region_id === c.region_id) ?? dealers[0];

    const districtAnchor = territory?.districtCentroids[c.district_id];
    const baseLat = districtAnchor?.[0] ?? assignedDealer?.latitude ?? territory?.center[0] ?? reg?.lat ?? provinceGeo.center[0];
    const baseLng = districtAnchor?.[1] ?? assignedDealer?.longitude ?? territory?.center[1] ?? reg?.lng ?? provinceGeo.center[1];

    // Deterministic polar offset around anchor in 3 realistic distance rings:
    // ~54% inner core (0.5–4.4 km), ~28% mid ring (4.6–8.8 km), ~18% outer ring (9.0–14.5 km)
    // At-risk customers slightly skewed toward outer ring to reveal realistic coverage gaps
    const uAngle = seededUnit(`geo-ang-${c.tenant_id}-${c.customer_id}`);
    const uRing = seededUnit(`geo-ring-${c.tenant_id}-${c.customer_id}`);
    const uJitter = seededUnit(`geo-jit-${c.tenant_id}-${c.customer_id}`);

    const isAtRisk = c.status === 'At-Risk' || c.model_outputs.churn_risk_category === 'High';
    const innerCutoff = isAtRisk ? 0.42 : 0.58;
    const midCutoff = isAtRisk ? 0.72 : 0.85;

    let distKm: number;
    if (uRing < innerCutoff) {
      distKm = isCompactMetro ? 0.35 + uJitter * 2.4 : 0.5 + uJitter * 3.8;
    } else if (uRing < midCutoff) {
      distKm = isCompactMetro ? 2.8 + uJitter * 2.8 : 4.4 + uJitter * 4.4;
    } else {
      distKm = isCompactMetro ? 5.6 + uJitter * 3.4 : 9.0 + uJitter * 5.8;
    }

    const angle = uAngle * Math.PI * 2;
    const dLat = (distKm / 111.32) * Math.cos(angle);
    const dLng = (distKm / (111.32 * Math.cos((baseLat * Math.PI) / 180))) * Math.sin(angle);

    const rawLat = Math.max(minLat + 0.015, Math.min(maxLat - 0.015, baseLat + dLat));
    const rawLng = Math.max(minLng + 0.015, Math.min(maxLng - 0.015, baseLng + dLng));
    const latitude = Number(rawLat.toFixed(5));
    const longitude = Number(rawLng.toFixed(5));

    // Find nearest dealer across tenant's active network
    let nearestDealer = assignedDealer;
    let nearestDist = assignedDealer
      ? haversineDistanceKm(latitude, longitude, assignedDealer.latitude, assignedDealer.longitude)
      : 0;

    for (const d of dealers) {
      const km = haversineDistanceKm(latitude, longitude, d.latitude, d.longitude);
      if (!nearestDealer || km < nearestDist) {
        nearestDist = km;
        nearestDealer = d;
      }
    }

    const assignedDist = assignedDealer
      ? haversineDistanceKm(latitude, longitude, assignedDealer.latitude, assignedDealer.longitude)
      : nearestDist;

    const latestTx = c.transactions[0];
    const lastPurchaseDate = latestTx?.date ?? c.last_activity_date;
    const lastServiceDate = c.last_activity_date;
    const daysSinceService = daysBetween(lastServiceDate);
    const latestInter = c.interactions[0];
    const consent = evaluateCustomerConsent(c);

    result.push({
      customer_id: c.customer_id,
      pseudonym_code: c.code,
      tenant_id: c.tenant_id,
      business_unit_id: c.business_unit_id,
      customer_segment: c.customer_segment,
      status: c.status,
      lifecycle_stage: c.lifecycle_stage,
      latitude,
      longitude,
      location_accuracy: districtAnchor ? 'District-Anchored Synthetic' : 'Urban Corridor Synthetic',
      location_source: 'Synthetic Demo Geocoder (Illustrative)',
      last_purchase_date: lastPurchaseDate,
      last_service_date: lastServiceDate,
      days_since_last_service: daysSinceService,
      lifetime_value: c.lifetime_value,
      churn_risk: c.model_outputs.churn_risk_score,
      churn_risk_category: c.model_outputs.churn_risk_category,
      purchase_propensity: c.model_outputs.purchase_propensity_score,
      geographic_opportunity_score: c.model_outputs.geographic_opportunity_score,
      assigned_dealer_id: assignedDealer?.dealer_id ?? c.branch_id,
      assigned_dealer_name: assignedDealer?.name ?? c.branch_id,
      assigned_dealer_distance_km: Number(assignedDist.toFixed(2)),
      nearest_dealer_id: nearestDealer?.dealer_id ?? c.branch_id,
      nearest_dealer_name: nearestDealer?.name ?? c.branch_id,
      nearest_dealer_distance_km: Number(nearestDist.toFixed(2)),
      region_id: c.region_id,
      region_name: reg?.name ?? c.demographic_attributes.city,
      district_id: c.district_id,
      village_id: c.village_id,
      product_primary: c.products[0]?.name ?? 'Primary Holding',
      preferred_channel: c.demographic_attributes.preferred_channel,
      latest_interaction_summary: latestInter
        ? `${latestInter.type} (${latestInter.date} · ${latestInter.outcome})`
        : `Last activity ${c.last_activity_date}`,
      marker_group: deriveMarkerGroup(c),
      has_consent: consent.hasConsent,
      opted_out: consent.optedOut,
      suppressed: consent.suppressed,
    });
  }

  return result;
}

export const DEFAULT_GEO_FILTERS: GeoFilterState = {
  searchQuery: '',
  segment: 'ALL',
  purchaseStatus: 'ALL',
  serviceStatus: 'ALL',
  churnRisk: 'ALL',
  valueTier: 'ALL',
  productOwnership: 'ALL',
  assignedDealerId: 'ALL',
  onlyOutsideCoverage: false,
};

/** Filter geocoded customers across geographic hierarchy and multi-criteria attributes */
export function filterGeocodedCustomers(
  customers: GeocodedCustomer[],
  hierarchy: { regionId: string; districtId: string; villageId: string },
  filters: GeoFilterState,
  coverageThresholdKm: number
): GeocodedCustomer[] {
  const q = filters.searchQuery.trim().toLowerCase();

  // Compute dynamic high/mid LTV quantiles so value tier adapts to every industry (motorcycle vs banking vs automotive)
  const sortedLtv = [...customers].map((c) => c.lifetime_value).sort((a, b) => a - b);
  const p70 = sortedLtv[Math.floor(sortedLtv.length * 0.7)] ?? 50_000_000;
  const p35 = sortedLtv[Math.floor(sortedLtv.length * 0.35)] ?? 20_000_000;

  return customers.filter((c) => {
    if (hierarchy.regionId !== 'ALL' && c.region_id !== hierarchy.regionId) return false;
    if (hierarchy.districtId !== 'ALL' && c.district_id !== hierarchy.districtId) return false;
    if (hierarchy.villageId !== 'ALL' && c.village_id !== hierarchy.villageId) return false;

    if (filters.segment !== 'ALL' && c.customer_segment !== filters.segment) return false;
    if (filters.churnRisk !== 'ALL' && c.churn_risk_category !== filters.churnRisk) return false;
    if (filters.assignedDealerId !== 'ALL' && c.assigned_dealer_id !== filters.assignedDealerId) {
      return false;
    }
    if (filters.productOwnership !== 'ALL' && c.product_primary !== filters.productOwnership) {
      return false;
    }

    if (filters.purchaseStatus !== 'ALL') {
      const days = daysBetween(c.last_purchase_date);
      if (filters.purchaseStatus === 'Recent' && days > 45) return false;
      if (filters.purchaseStatus === 'Standard' && (days <= 45 || days > 120)) return false;
      if (filters.purchaseStatus === 'Lapsed' && days <= 120) return false;
    }

    if (filters.serviceStatus !== 'ALL') {
      const d = c.days_since_last_service;
      if (filters.serviceStatus === 'Current' && d > 45) return false;
      if (filters.serviceStatus === 'Due Soon' && (d <= 45 || d > 90)) return false;
      if (filters.serviceStatus === 'Overdue' && d <= 90) return false;
    }

    if (filters.valueTier !== 'ALL') {
      if (filters.valueTier === 'High' && c.lifetime_value < p70) return false;
      if (
        filters.valueTier === 'Mid' &&
        (c.lifetime_value < p35 || c.lifetime_value >= p70)
      ) {
        return false;
      }
      if (filters.valueTier === 'Standard' && c.lifetime_value >= p35) return false;
    }

    if (filters.onlyOutsideCoverage && c.nearest_dealer_distance_km <= coverageThresholdKm) {
      return false;
    }

    if (q) {
      const haystack = `${c.pseudonym_code} ${c.region_name} ${c.assigned_dealer_name} ${c.product_primary} ${c.customer_segment}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/** Filter competitors according to user toggle */
export function filterCompetitors(
  competitors: CompetitorLocation[],
  mode: CompetitorFilterMode,
  regionId: string
): CompetitorLocation[] {
  if (mode === 'none') return [];
  return competitors.filter((comp) => {
    if (regionId !== 'ALL' && comp.region_id !== regionId) return false;
    if (mode === 'dealer' && comp.competitor_category !== 'dealer') return false;
    if (mode === 'service' && comp.competitor_category !== 'service') return false;
    return true;
  });
}

/**
 * Smart zoom-dependent deterministic spatial clustering.
 * Guarantees 100% total reconciliation: sum(cluster.count) === customers.length.
 */
export function computeZoomClusters(
  customers: GeocodedCustomer[],
  zoom: number
): GeoClusterNode[] {
  if (customers.length === 0) return [];

  // Low zoom (<= 9): group cleanly by regency/territory
  if (zoom <= 9) {
    const byRegion = new Map<string, GeocodedCustomer[]>();
    for (const c of customers) {
      const list = byRegion.get(c.region_id) ?? [];
      list.push(c);
      byRegion.set(c.region_id, list);
    }
    return Array.from(byRegion.entries()).map(([regionId, group]) =>
      buildClusterNode(`cl-reg-${regionId}`, group[0].region_name, regionId, group)
    );
  }

  // Medium (10-11) or high-zoom aggregated cluster mode (>= 12): spatial grid bucketing
  const cellDeg = zoom === 10 ? 0.085 : zoom === 11 ? 0.048 : 0.025;
  const buckets = new Map<string, GeocodedCustomer[]>();

  for (const c of customers) {
    const gx = Math.floor(c.latitude / cellDeg);
    const gy = Math.floor(c.longitude / cellDeg);
    const key = `${c.region_id}:${gx}:${gy}`;
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }

  return Array.from(buckets.entries()).map(([key, group], idx) =>
    buildClusterNode(
      `cl-grid-${key}-${idx}`,
      `${group[0].region_name} Zone ${idx + 1}`,
      group[0].region_id,
      group
    )
  );
}

function buildClusterNode(
  id: string,
  label: string,
  regionId: string,
  group: GeocodedCustomer[]
): GeoClusterNode {
  let sumLat = 0;
  let sumLng = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let totalLtv = 0;
  let atRiskCount = 0;
  let highValueCount = 0;
  let sumChurn = 0;
  const customerIds: string[] = [];

  for (const c of group) {
    sumLat += c.latitude;
    sumLng += c.longitude;
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
    totalLtv += c.lifetime_value;
    if (c.marker_group === 'at_risk') atRiskCount++;
    if (c.marker_group === 'high_value') highValueCount++;
    sumChurn += c.churn_risk;
    customerIds.push(c.customer_id);
  }

  const n = group.length;
  const pad = 0.012;
  return {
    id,
    label,
    regionId,
    latitude: Number((sumLat / n).toFixed(5)),
    longitude: Number((sumLng / n).toFixed(5)),
    count: n,
    totalLtv,
    atRiskCount,
    highValueCount,
    avgChurnRisk: Math.round(sumChurn / n),
    bounds: [
      [minLat - pad, minLng - pad],
      [maxLat + pad, maxLng + pad],
    ],
    customerIds,
  };
}

/**
 * Compute straight-line radius coverage catchment around a selected dealer.
 * Always reconciles: inside_count + outside_count === customers.length.
 */
export function computeDealerCoverage(
  dealer: DealerNetworkNode,
  radiusKm: number,
  customers: GeocodedCustomer[],
  allDealers: DealerNetworkNode[]
): CoverageAnalysisResult {
  const safeRadius = Math.max(0.5, radiusKm);
  const inside: GeocodedCustomer[] = [];
  const outside: GeocodedCustomer[] = [];
  let insideLtv = 0;
  let insideAtRisk = 0;
  let sumInsideDist = 0;
  let sumAllDist = 0;

  for (const c of customers) {
    const km = haversineDistanceKm(dealer.latitude, dealer.longitude, c.latitude, c.longitude);
    sumAllDist += km;
    if (km <= safeRadius) {
      inside.push(c);
      insideLtv += c.lifetime_value;
      if (c.marker_group === 'at_risk') insideAtRisk++;
      sumInsideDist += km;
    } else {
      outside.push(c);
    }
  }

  const overlapping: CoverageOverlapItem[] = [];
  for (const other of allDealers) {
    if (other.dealer_id === dealer.dealer_id) continue;
    const dist = haversineDistanceKm(dealer.latitude, dealer.longitude, other.latitude, other.longitude);
    if (dist <= safeRadius * 2) {
      let shared = 0;
      for (const c of inside) {
        const dOther = haversineDistanceKm(other.latitude, other.longitude, c.latitude, c.longitude);
        if (dOther <= safeRadius) shared++;
      }
      overlapping.push({
        dealer_id: other.dealer_id,
        dealer_name: other.name,
        distance_km: Number(dist.toFixed(2)),
        shared_customer_count: shared,
      });
    }
  }

  overlapping.sort((a, b) => a.distance_km - b.distance_km);

  return {
    dealer_id: dealer.dealer_id,
    dealer_name: dealer.name,
    dealer_type: dealer.dealer_type,
    radius_km: safeRadius,
    inside_customers: inside,
    outside_customers: outside,
    inside_count: inside.length,
    outside_count: outside.length,
    inside_ltv: insideLtv,
    inside_at_risk_count: insideAtRisk,
    coverage_rate_pct:
      customers.length > 0 ? Number(((inside.length / customers.length) * 100).toFixed(1)) : 0,
    avg_distance_inside_km:
      inside.length > 0 ? Number((sumInsideDist / inside.length).toFixed(2)) : 0,
    avg_distance_all_km:
      customers.length > 0 ? Number((sumAllDist / customers.length).toFixed(2)) : 0,
    overlapping_dealers: overlapping,
  };
}

/**
 * Customer-to-Dealer network intelligence summary for the active customer scope.
 */
export function computeCustomerToDealerInsights(
  customers: GeocodedCustomer[],
  dealers: DealerNetworkNode[],
  thresholdKm: number
): CustomerToDealerInsights {
  let nearDealer = 0;
  let outsideCoverage = 0;
  let assignedNonNearest = 0;
  let overlappingCatchment = 0;

  for (const c of customers) {
    if (c.nearest_dealer_distance_km <= thresholdKm) {
      nearDealer++;
    } else {
      outsideCoverage++;
    }
    if (c.assigned_dealer_id !== c.nearest_dealer_id) {
      assignedNonNearest++;
    }

    let dealersWithin = 0;
    for (const d of dealers) {
      const km = haversineDistanceKm(c.latitude, c.longitude, d.latitude, d.longitude);
      if (km <= thresholdKm) {
        dealersWithin++;
        if (dealersWithin >= 2) break;
      }
    }
    if (dealersWithin >= 2) overlappingCatchment++;
  }

  return {
    near_dealer_count: nearDealer,
    outside_coverage_count: outsideCoverage,
    assigned_non_nearest_count: assignedNonNearest,
    overlapping_catchment_count: overlappingCatchment,
    threshold_km: thresholdKm,
  };
}

/** Ray-casting algorithm for point-in-polygon check ([lat, lng]) */
export function isPointInPolygon(
  point: [number, number],
  polygon: Array<[number, number]>
): boolean {
  if (polygon.length < 3) return false;
  const [py, px] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInGeometry(
  lat: number,
  lng: number,
  geometry: GeoSelectionGeometry
): boolean {
  if (geometry.type === 'rectangle') {
    const [[s, w], [n, e]] = geometry.bounds;
    const south = Math.min(s, n);
    const north = Math.max(s, n);
    const west = Math.min(w, e);
    const east = Math.max(w, e);
    return lat >= south && lat <= north && lng >= west && lng <= east;
  }
  if (geometry.type === 'polygon') {
    return isPointInPolygon([lat, lng], geometry.points);
  }
  const dist = haversineDistanceKm(lat, lng, geometry.center[0], geometry.center[1]);
  return dist <= geometry.radiusKm;
}

/**
 * Evaluate a user-drawn Rectangle, Polygon, or Radius selection against filtered customers,
 * dealers, and competitors for direct campaign activation.
 */
export function evaluateGeoSelection(
  geometry: GeoSelectionGeometry,
  label: string,
  customers: GeocodedCustomer[],
  dealers: DealerNetworkNode[],
  competitors: CompetitorLocation[],
  coverageThresholdKm: number
): GeoSelectionSummary {
  const matching = customers.filter((c) => isPointInGeometry(c.latitude, c.longitude, geometry));
  const nearbyDealers = dealers.filter((d) => isPointInGeometry(d.latitude, d.longitude, geometry));
  const nearbyCompetitors = competitors.filter((comp) =>
    isPointInGeometry(comp.latitude, comp.longitude, geometry)
  );

  let totalLtv = 0;
  let atRiskCount = 0;
  let eligibleConsented = 0;
  let coveredCount = 0;
  const segCounts = new Map<string, number>();
  const regCounts = new Map<string, number>();

  for (const c of matching) {
    totalLtv += c.lifetime_value;
    if (c.marker_group === 'at_risk') atRiskCount++;
    if (c.has_consent && !c.opted_out && !c.suppressed) eligibleConsented++;
    if (c.nearest_dealer_distance_km <= coverageThresholdKm) coveredCount++;
    segCounts.set(c.customer_segment, (segCounts.get(c.customer_segment) ?? 0) + 1);
    regCounts.set(c.region_id, (regCounts.get(c.region_id) ?? 0) + 1);
  }

  const segmentDistribution = [
    'High-Value Loyal',
    'Growth Potential',
    'Core Active',
    'At-Risk Retention',
    'New Onboarding',
  ]
    .map((seg) => {
      const count = segCounts.get(seg) ?? 0;
      return {
        segment: seg,
        count,
        sharePct: matching.length > 0 ? Number(((count / matching.length) * 100).toFixed(1)) : 0,
      };
    })
    .filter((s) => s.count > 0);

  let dominantRegion = 'ALL';
  let maxRegCount = 0;
  for (const [rid, cnt] of regCounts.entries()) {
    if (cnt > maxRegCount) {
      maxRegCount = cnt;
      dominantRegion = rid;
    }
  }

  return {
    label,
    geometry,
    matching_customers: matching,
    matching_count: matching.length,
    eligible_consented_count: eligibleConsented,
    total_ltv: totalLtv,
    at_risk_count: atRiskCount,
    segment_distribution: segmentDistribution,
    nearby_dealers: nearbyDealers,
    nearby_competitors: nearbyCompetitors,
    approx_coverage_rate_pct:
      matching.length > 0 ? Number(((coveredCount / matching.length) * 100).toFixed(1)) : 0,
    dominant_region_id: dominantRegion,
  };
}

/**
 * Transparent, configurable Opportunity & Gap Analysis scoring engine across territories.
 * Clearly labeled illustrative — combines customer concentration, growth potential,
 * at-risk density, dealer coverage gap, and competitor proximity into A–E zones.
 */
export function computeOpportunityGapZones(
  tenant: Tenant,
  industryId: IndustryId,
  permittedRegionIds: string[],
  customers: GeocodedCustomer[],
  dealers: DealerNetworkNode[],
  competitors: CompetitorLocation[],
  coverageThresholdKm: number,
  weights: OpportunityWeights = DEFAULT_OPPORTUNITY_WEIGHTS
): OpportunityGapZone[] {
  const geoConfig = getIndustryGeoConfig(industryId);
  const permittedSet = new Set(permittedRegionIds);
  const regencies = tenant.province.regencies.filter((r) => permittedSet.has(r.id));

  const totalWeight =
    weights.concentration +
    weights.growthPotential +
    weights.atRiskDensity +
    weights.coverageGap +
    weights.competitorProximity || 100;

  const maxCustInAnyReg = Math.max(
    1,
    ...regencies.map((r) => customers.filter((c) => c.region_id === r.id).length)
  );

  const zones: OpportunityGapZone[] = regencies.map((reg) => {
    const regCusts = customers.filter((c) => c.region_id === reg.id);
    const regDealers = dealers.filter((d) => d.region_id === reg.id);
    const regComps = competitors.filter((cp) => cp.region_id === reg.id);

    const n = regCusts.length;
    const atRiskCount = regCusts.filter((c) => c.marker_group === 'at_risk').length;
    const growthCount = regCusts.filter(
      (c) => c.customer_segment === 'Growth Potential' || c.purchase_propensity >= 68
    ).length;
    const coveredCount = regCusts.filter(
      (c) => c.nearest_dealer_distance_km <= coverageThresholdKm
    ).length;

    const coverageRatePct = n > 0 ? Number(((coveredCount / n) * 100).toFixed(1)) : 0;
    const avgNearestKm =
      n > 0
        ? Number(
            (regCusts.reduce((s, c) => s + c.nearest_dealer_distance_km, 0) / n).toFixed(2)
          )
        : 0;

    // Normalized 0-100 factors
    const concentrationScore = Math.min(100, Math.round((n / maxCustInAnyReg) * 100));
    const growthPotentialScore = Math.min(
      100,
      Math.round(reg.marketPotentialIndex * 0.65 + (n > 0 ? (growthCount / n) * 100 * 0.35 : 0))
    );
    const atRiskDensityScore =
      n > 0 ? Math.min(100, Math.round((atRiskCount / n) * 260)) : 0;
    const coverageGapScore = Math.min(
      100,
      Math.round((100 - coverageRatePct) * 0.7 + Math.min(100, avgNearestKm * 6.5) * 0.3)
    );
    const compRatio = regComps.length / Math.max(1, regDealers.length);
    const competitorProximityScore = Math.min(100, Math.round(compRatio * 34));

    const composite = Math.min(
      99,
      Math.max(
        18,
        Math.round(
          (concentrationScore * weights.concentration +
            growthPotentialScore * weights.growthPotential +
            atRiskDensityScore * weights.atRiskDensity +
            coverageGapScore * weights.coverageGap +
            competitorProximityScore * weights.competitorProximity) /
            totalWeight
        )
      )
    );

    // Classify into A–E Opportunity & Gap categories
    let category: OpportunityGapCategory;
    let categoryCode: OpportunityGapZone['category_code'];
    let recommendedStrategy: OpportunityGapZone['recommended_strategy'];
    let recommendedAction: string;
    let explanation: string;

    if (atRiskDensityScore >= 62) {
      category = 'High Retention Risk';
      categoryCode = 'C';
      recommendedStrategy = 'RETAIN';
      recommendedAction = `Launch proactive ${geoConfig.serviceLabel} retention outreach for ${atRiskCount} at-risk ${geoConfig.customerPlural.toLowerCase()} in ${reg.name}.`;
      explanation = `${atRiskCount} of ${n} ${geoConfig.customerPlural.toLowerCase()} (${Math.round((atRiskCount / Math.max(1, n)) * 100)}%) show elevated churn risk with ${coverageRatePct}% within ${coverageThresholdKm} km coverage.`;
    } else if (coverageGapScore >= 56 && growthPotentialScore >= 72) {
      category = 'High Potential / Low Coverage';
      categoryCode = 'A';
      recommendedStrategy = 'ACQUIRE';
      recommendedAction = `Deploy mobile ${geoConfig.serviceLabel.toLowerCase()} / pop-up unit or evaluate new ${geoConfig.dealerLabel.toLowerCase()} site in ${reg.name}.`;
      explanation = `Strong market potential (${growthPotentialScore}/100) paired with ${coverageRatePct}% ${coverageThresholdKm} km straight-line coverage across ${regDealers.length} active unit(s).`;
    } else if (concentrationScore >= 68 && competitorProximityScore >= 52) {
      category = 'High Customer Density / High Competition';
      categoryCode = 'B';
      recommendedStrategy = 'DEFEND';
      recommendedAction = `Activate loyalty defense & priority ${geoConfig.serviceLabel.toLowerCase()} lane to protect ${n} accounts against ${regComps.length} illustrative nearby competitor locations.`;
      explanation = `High customer density (${n} accounts) with ${regComps.length} illustrative competitor reference sites creating competitive proximity pressure.`;
    } else if (coverageRatePct < 50) {
      category = 'Underserved Territories';
      categoryCode = 'E';
      recommendedStrategy = 'ACQUIRE';
      recommendedAction = `Expand catchment outreach and partner network across outer districts of ${reg.name} (avg distance ${avgNearestKm} km).`;
      explanation = `Average straight-line distance to nearest ${geoConfig.dealerLabel.toLowerCase()} is ${avgNearestKm} km, leaving ${(100 - coverageRatePct).toFixed(0)}% outside ${coverageThresholdKm} km radius.`;
    } else {
      category = 'Strong Coverage / Growth Opportunity';
      categoryCode = 'D';
      recommendedStrategy = 'DEVELOP';
      recommendedAction = `Run cross-sell & upgrade campaign leveraging ${regDealers.length} active ${geoConfig.dealerPlural.toLowerCase()} in ${reg.name}.`;
      explanation = `Healthy ${coverageRatePct}% network coverage with ${growthCount} growth-ready ${geoConfig.customerPlural.toLowerCase()} available for expansion.`;
    }

    return {
      region_id: reg.id,
      region_name: reg.name,
      category,
      category_code: categoryCode,
      composite_score: composite,
      customer_count: n,
      at_risk_count: atRiskCount,
      dealer_count: regDealers.length,
      competitor_count: regComps.length,
      coverage_rate_pct: coverageRatePct,
      avg_nearest_dealer_km: avgNearestKm,
      factors: {
        concentrationScore,
        growthPotentialScore,
        atRiskDensityScore,
        coverageGapScore,
        competitorProximityScore,
      },
      explanation,
      recommended_strategy: recommendedStrategy,
      recommended_action: recommendedAction,
      data_coverage_status:
        n >= 30 ? 'Sufficient Synthetic Sample' : 'Limited Sample — Interpret Cautiously',
    };
  });

  return zones.sort((a, b) => b.composite_score - a.composite_score);
}

/** Built-in executive & analyst saved map views adapted per tenant */
export function buildPresetSavedViews(
  tenant: Tenant,
  industryId: IndustryId
): SavedMapView[] {
  const geoConfig = getIndustryGeoConfig(industryId);
  const primaryReg = tenant.province.regencies[0];
  return [
    {
      id: `preset-overview-${tenant.id}`,
      name: `${tenant.primaryProvinceName} Network Overview`,
      description: `Provincial clusters, ${geoConfig.dealerPlural.toLowerCase()}, and opportunity zones.`,
      regionId: 'ALL',
      districtId: 'ALL',
      mapMode: 'clusters',
      radiusKm: geoConfig.defaultRadiusKm,
      layers: {
        customerClusters: true,
        dealers: true,
        serviceCenters: true,
        branches: true,
        competitorMode: 'none',
        territoryBoundaries: true,
        opportunityOverlay: true,
      },
      filters: DEFAULT_GEO_FILTERS,
      isPreset: true,
    },
    {
      id: `preset-atrisk-${tenant.id}`,
      name: `${primaryReg?.name ?? 'Primary City'} At-Risk & Coverage Gap`,
      description: `Highlights At-Risk ${geoConfig.customerPlural.toLowerCase()} outside ${geoConfig.defaultRadiusKm} km radius vs competitors.`,
      regionId: primaryReg?.id ?? 'ALL',
      districtId: 'ALL',
      mapMode: 'points',
      radiusKm: geoConfig.defaultRadiusKm,
      layers: {
        customerPoints: true,
        atRiskHighlight: true,
        dealers: true,
        serviceCenters: true,
        competitorMode: 'all',
        coverageRadius: true,
        uncoveredHighlight: true,
        customerToDealerLines: true,
      },
      filters: { ...DEFAULT_GEO_FILTERS, churnRisk: 'High' },
      isPreset: true,
    },
    {
      id: `preset-heatmap-${tenant.id}`,
      name: `Customer Value & Competitor Heatmap`,
      description: `Weighted LTV concentration heatmap overlaid with illustrative competitor sites.`,
      regionId: 'ALL',
      districtId: 'ALL',
      mapMode: 'heatmap_value',
      radiusKm: 10,
      layers: {
        dealers: true,
        serviceCenters: true,
        competitorMode: 'all',
        territoryBoundaries: true,
      },
      filters: DEFAULT_GEO_FILTERS,
      isPreset: true,
    },
  ];
}

export function hasValidWgs84Coordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Reconciles customer visibility counts strictly from the same filtered dataset:
 * Total = Mapped + Unmapped, and Visible = Mapped points inside current map viewport bounds.
 */
export function computeCustomerMapCounts(
  customers: ReadonlyArray<Pick<GeocodedCustomer, 'latitude' | 'longitude'>>,
  viewportBounds: GeoViewportBounds | null
): CustomerMapCounts {
  const total = customers.length;
  let mapped = 0;
  let visible = 0;

  for (const c of customers) {
    if (!hasValidWgs84Coordinate(c.latitude, c.longitude)) continue;
    mapped += 1;
    if (
      !viewportBounds ||
      (c.latitude >= viewportBounds.south &&
        c.latitude <= viewportBounds.north &&
        c.longitude >= viewportBounds.west &&
        c.longitude <= viewportBounds.east)
    ) {
      visible += 1;
    }
  }

  return {
    total,
    mapped,
    visible,
    unmapped: total - mapped,
  };
}


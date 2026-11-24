import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import {
  buildGeocodedCustomers,
  buildTenantCompetitors,
  buildTenantDealerNetwork,
  computeCustomerMapCounts,
  computeCustomerToDealerInsights,
  computeDealerCoverage,
  computeOpportunityGapZones,
  computeZoomClusters,
  DEFAULT_GEO_FILTERS,
  DEFAULT_OPPORTUNITY_WEIGHTS,
  evaluateGeoSelection,
  filterCompetitors,
  filterGeocodedCustomers,
  haversineDistanceKm,
  isPointInPolygon,
} from './geospatialService';
import { computeCampaignAudience } from '../ai-engine/mvp3Engine';

test('all 6 demo tenants geocode cleanly to valid Indonesian WGS-84 coordinates with strict tenant separation', () => {
  for (const tenant of DEMO_TENANTS) {
    const dataset = generateTenantDataset(tenant);
    const allRegionIds = tenant.province.regencies.map((r) => r.id);
    const dealers = buildTenantDealerNetwork(
      tenant,
      tenant.defaultIndustryId,
      allRegionIds,
      dataset.customers
    );
    const geocoded = buildGeocodedCustomers(tenant, dataset.customers, dealers);
    const competitors = buildTenantCompetitors(tenant, tenant.defaultIndustryId, allRegionIds);

    assert.equal(
      geocoded.length,
      dataset.customers.length,
      `${tenant.name} must geocode every customer`
    );
    assert.ok(dealers.length >= tenant.branches.length, `${tenant.name} must include all branches`);
    assert.ok(competitors.length > 0, `${tenant.name} must have illustrative competitors`);

    for (const c of geocoded) {
      assert.equal(c.tenant_id, tenant.id);
      assert.ok(c.latitude >= -11 && c.latitude <= 6, `valid Indonesia lat for ${c.customer_id}`);
      assert.ok(c.longitude >= 95 && c.longitude <= 141, `valid Indonesia lng for ${c.customer_id}`);
      assert.ok(c.nearest_dealer_distance_km >= 0);
      assert.ok(c.assigned_dealer_distance_km >= c.nearest_dealer_distance_km - 0.01);
    }

    for (const comp of competitors) {
      assert.equal(comp.tenant_id, tenant.id);
      assert.match(comp.location_source, /Illustrative Synthetic/i);
    }
  }
});

test('smart zoom-dependent clustering reconciles 100% with filtered customer totals at every zoom tier', () => {
  const astra = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);

  for (const zoom of [8, 9, 10, 11, 12]) {
    const clusters = computeZoomClusters(geocoded, zoom);
    const totalInClusters = clusters.reduce((acc, cl) => acc + cl.count, 0);
    assert.equal(
      totalInClusters,
      geocoded.length,
      `Zoom ${zoom} clusters must sum exactly to ${geocoded.length}`
    );
  }

  const lowClusters = computeZoomClusters(geocoded, 8);
  const medClusters = computeZoomClusters(geocoded, 11);
  assert.ok(
    medClusters.length > lowClusters.length,
    'Medium zoom must expand provincial clusters into finer spatial sub-clusters'
  );
});

test('dealer radius coverage reconciles inside + outside === total and grows monotonically from 5 km to 10 km', () => {
  const astra = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);

  const semarangCustomers = filterGeocodedCustomers(
    geocoded,
    { regionId: 'reg-semarang', districtId: 'ALL', villageId: 'ALL' },
    DEFAULT_GEO_FILTERS,
    5
  );
  const semarangDealer = dealers.find((d) => d.region_id === 'reg-semarang')!;
  assert.ok(semarangDealer);

  const cov5 = computeDealerCoverage(semarangDealer, 5, semarangCustomers, dealers);
  const cov10 = computeDealerCoverage(semarangDealer, 10, semarangCustomers, dealers);

  assert.equal(cov5.inside_count + cov5.outside_count, semarangCustomers.length);
  assert.equal(cov10.inside_count + cov10.outside_count, semarangCustomers.length);
  assert.ok(
    cov10.inside_count >= cov5.inside_count,
    '10 km straight-line catchment must include at least as many customers as 5 km'
  );
  assert.ok(cov5.inside_count > 0 && cov5.outside_count > 0, '5 km radius splits inner & outer cohorts');
});

test('spatial selection supports rectangle, polygon ray-casting, and radius accurately', () => {
  const astra = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);
  const competitors = buildTenantCompetitors(astra, 'motorcycle', allRegionIds);

  // Simple square ray-casting test
  const square: Array<[number, number]> = [
    [-7.1, 110.3],
    [-7.1, 110.5],
    [-6.9, 110.5],
    [-6.9, 110.3],
  ];
  assert.equal(isPointInPolygon([-7.0, 110.4], square), true);
  assert.equal(isPointInPolygon([-7.5, 110.8], square), false);

  const rectSel = evaluateGeoSelection(
    { type: 'rectangle', bounds: [[-7.15, 110.25], [-6.9, 110.55]] },
    'Semarang Rectangle',
    geocoded,
    dealers,
    competitors,
    5
  );
  assert.ok(rectSel.matching_count > 0);
  assert.ok(rectSel.eligible_consented_count <= rectSel.matching_count);
  assert.ok(rectSel.nearby_dealers.length > 0);

  const radiusSel = evaluateGeoSelection(
    { type: 'radius', center: [-6.976, 110.421], radiusKm: 8 },
    'Semarang 8 km Radius',
    geocoded,
    dealers,
    competitors,
    5
  );
  assert.ok(radiusSel.matching_count > 0);
  for (const c of radiusSel.matching_customers) {
    const km = haversineDistanceKm(c.latitude, c.longitude, -6.976, 110.421);
    assert.ok(km <= 8.0001);
  }
});

test('opportunity & gap scoring is deterministic, bounded 0-100, and sensitive to weight sliders', () => {
  const astra = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);
  const competitors = buildTenantCompetitors(astra, 'motorcycle', allRegionIds);

  const defaultZones = computeOpportunityGapZones(
    astra,
    'motorcycle',
    allRegionIds,
    geocoded,
    dealers,
    competitors,
    5,
    DEFAULT_OPPORTUNITY_WEIGHTS
  );
  const riskHeavyZones = computeOpportunityGapZones(
    astra,
    'motorcycle',
    allRegionIds,
    geocoded,
    dealers,
    competitors,
    5,
    { concentration: 5, growthPotential: 5, atRiskDensity: 75, coverageGap: 10, competitorProximity: 5 }
  );

  assert.equal(defaultZones.length, astra.province.regencies.length);
  for (const z of defaultZones) {
    assert.ok(z.composite_score >= 0 && z.composite_score <= 100);
    assert.ok(['A', 'B', 'C', 'D', 'E'].includes(z.category_code));
  }

  // At least one territory score changes when weights shift heavily toward atRiskDensity
  const anyChanged = defaultZones.some((z) => {
    const alt = riskHeavyZones.find((r) => r.region_id === z.region_id);
    return alt && alt.composite_score !== z.composite_score;
  });
  assert.ok(anyChanged, 'Weight sliders must meaningfully affect composite opportunity scores');
});

test('customer-to-dealer insights and competitor filters reconcile properly', () => {
  const lexus = DEMO_TENANTS.find((t) => t.id === 'tenant-lexus')!;
  const dataset = generateTenantDataset(lexus);
  const allRegionIds = lexus.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(lexus, 'automotive', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(lexus, dataset.customers, dealers);
  const competitors = buildTenantCompetitors(lexus, 'automotive', allRegionIds);

  const insights = computeCustomerToDealerInsights(geocoded, dealers, 5);
  assert.equal(insights.near_dealer_count + insights.outside_coverage_count, geocoded.length);

  const allComps = filterCompetitors(competitors, 'all', 'ALL');
  const dealerComps = filterCompetitors(competitors, 'dealer', 'ALL');
  const serviceComps = filterCompetitors(competitors, 'service', 'ALL');
  const noComps = filterCompetitors(competitors, 'none', 'ALL');
  assert.equal(dealerComps.length + serviceComps.length, allComps.length);
  assert.equal(noComps.length, 0);

  // Verify existing campaign audience engine works cleanly on Lexus and with geoCustomerIds subsetting
  const aud = computeCampaignAudience(dataset.customers, {
    tenantId: lexus.id,
    businessUnitId: 'ALL',
    regionId: 'ALL',
    targetSegment: 'ALL',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    respectConsent: true,
    respectSuppression: true,
    includeControlGroup: true,
  });
  assert.ok(aud.eligibleReachableCount > 0);

  const subsetIds = geocoded.slice(0, 45).map((c) => c.customer_id);
  const geoAud = computeCampaignAudience(dataset.customers, {
    tenantId: lexus.id,
    businessUnitId: 'ALL',
    regionId: 'ALL',
    targetSegment: 'ALL',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    respectConsent: true,
    respectSuppression: true,
    includeControlGroup: true,
    geoCustomerIds: subsetIds,
  });
  assert.equal(geoAud.totalMatchedRaw, 45);
  assert.equal(geoAud.deduplicatedCount, 45);
  assert.ok(geoAud.eligibleReachableCount > 0 && geoAud.eligibleReachableCount <= 45);
});

test('computeCustomerMapCounts reconciles Total = Mapped + Unmapped and tracks viewport Visible subset', () => {
  const sample = [
    { latitude: -6.99, longitude: 110.42 }, // Inside Semarang viewport
    { latitude: -7.01, longitude: 110.44 }, // Inside Semarang viewport
    { latitude: -7.56, longitude: 110.82 }, // Surakarta (outside Semarang viewport)
    { latitude: Number.NaN, longitude: 110.4 }, // Unmapped invalid coordinate
    { latitude: 0, longitude: 0 }, // Unmapped null island
  ];

  const allView = computeCustomerMapCounts(sample, null);
  assert.equal(allView.total, 5);
  assert.equal(allView.mapped, 3);
  assert.equal(allView.unmapped, 2);
  assert.equal(allView.visible, 3);
  assert.equal(allView.mapped + allView.unmapped, allView.total);

  const semarangView = computeCustomerMapCounts(sample, {
    south: -7.1,
    north: -6.9,
    west: 110.3,
    east: 110.55,
  });
  assert.equal(semarangView.total, 5);
  assert.equal(semarangView.mapped, 3);
  assert.equal(semarangView.unmapped, 2);
  assert.equal(semarangView.visible, 2);
  assert.ok(semarangView.visible <= semarangView.mapped);
});


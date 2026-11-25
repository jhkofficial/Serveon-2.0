import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
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
  isPlottableCustomer,
  isPointInPolygon,
} from './geospatialService';
import {
  buildValidationReportCsv,
  computeGeolocationQualitySummary,
  isValidWgs84Coordinate,
  runForwardGeocoding,
  runReverseGeocoding,
  validateAllCustomerLocations,
  validatePointAgainstLandAndTerritory,
} from './geoValidationEngine';
import { computeCampaignAudience } from '../ai-engine/mvp3Engine';
import { getPersonaById, hasPermission } from '../permissions/rbac';

test('AT-1..4: all 6 demo tenants pass EPSG:4326 terrestrial land-mask & sea-exclusion validation with zero plotted sea points', () => {
  for (const tenant of DEMO_TENANTS) {
    const dataset = generateTenantDataset(tenant);
    const provinceGeo = getProvinceMapConfig(tenant);
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
      `${tenant.name} must preserve 100% of customer records`
    );
    assert.ok(dealers.length >= tenant.branches.length, `${tenant.name} must include all branches`);
    assert.ok(competitors.length > 0, `${tenant.name} must have illustrative competitors`);

    let plottableCount = 0;
    let quarantinedCount = 0;

    for (const c of geocoded) {
      assert.equal(c.tenant_id, tenant.id);

      if (isPlottableCustomer(c)) {
        plottableCount++;
        const check = validatePointAgainstLandAndTerritory(
          c.latitude,
          c.longitude,
          provinceGeo,
          c.region_id
        );
        assert.equal(
          check.coordinateStatus,
          'VALID',
          `${tenant.name} ${c.customer_id} must have valid WGS-84 coordinate`
        );
        assert.equal(
          check.landStatus,
          'ON_LAND',
          `${tenant.name} ${c.customer_id} (${c.latitude}, ${c.longitude}) must NOT appear in sea/water: ${check.issueDescription}`
        );
        assert.equal(
          check.territoryStatus,
          'INSIDE_TERRITORY',
          `${tenant.name} ${c.customer_id} must fall inside assigned territory ${c.region_id}`
        );
        // Synthetic points must never fabricate verified residential addresses
        assert.equal(c.geolocation_status, 'SIMULATED_VALID_LAND_POINT');
        assert.match(c.address_line, /Simulated Point — Exact Address Unavailable/);
        assert.ok(c.nearest_dealer_distance_km >= 0);
        assert.ok(c.assigned_dealer_distance_km >= c.nearest_dealer_distance_km - 0.01);
      } else {
        quarantinedCount++;
        assert.ok(
          c.geolocation_status === 'INVALID_LOCATION' || c.geolocation_status === 'NOT_GEOCODED',
          `Unplottable customer ${c.customer_id} must be explicitly marked INVALID_LOCATION or NOT_GEOCODED`
        );
        assert.ok(c.validation_issue, `Quarantined record ${c.customer_id} must explain issue`);
      }
    }

    assert.ok(plottableCount > 0, `${tenant.name} must have valid plottable customers`);
    assert.equal(plottableCount + quarantinedCount, geocoded.length);

    // Zero competitors in sea/water
    for (const comp of competitors) {
      assert.equal(comp.tenant_id, tenant.id);
      assert.match(comp.location_source, /Illustrative Synthetic/i);
      const compCheck = validatePointAgainstLandAndTerritory(
        comp.latitude,
        comp.longitude,
        provinceGeo,
        comp.region_id
      );
      assert.equal(
        compCheck.landStatus,
        'ON_LAND',
        `${tenant.name} competitor ${comp.competitor_id} must sit on dry land`
      );
    }

    // Zero clusters in sea/water at every zoom level
    for (const zoom of [8, 10, 11]) {
      const clusters = computeZoomClusters(geocoded, zoom, provinceGeo);
      for (const cl of clusters) {
        const clCheck = validatePointAgainstLandAndTerritory(
          cl.latitude,
          cl.longitude,
          provinceGeo,
          cl.regionId
        );
        assert.equal(
          clCheck.landStatus,
          'ON_LAND',
          `${tenant.name} cluster ${cl.id} at zoom ${zoom} must anchor on dry land`
        );
      }
    }
  }
});

test('AT-1..3 Semarang Validation: 0 Astra Motor Semarang markers or clusters appear in the Java Sea', () => {
  const astra = DEMO_TENANTS.find((t) => t.id === 'tenant-astra-motor')!;
  const dataset = generateTenantDataset(astra);
  const provinceGeo = getProvinceMapConfig(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);

  const semarangCustomers = geocoded.filter((c) => c.region_id === 'reg-semarang');
  assert.ok(semarangCustomers.length > 100, 'Astra Motor Semarang cohort must exist');

  // Verify Java Sea probe coordinate is properly caught as IN_SEA_OR_WATER
  const javaSeaProbe = validatePointAgainstLandAndTerritory(
    -6.895,
    110.42,
    provinceGeo,
    'reg-semarang'
  );
  assert.equal(javaSeaProbe.landStatus, 'IN_SEA_OR_WATER');
  assert.equal(javaSeaProbe.isValidLandPoint, false);

  // Verify 0 plotted Semarang customers fall in the Java Sea
  const plottableSemarang = semarangCustomers.filter(isPlottableCustomer);
  let plottedSeaCount = 0;
  for (const c of plottableSemarang) {
    const check = validatePointAgainstLandAndTerritory(
      c.latitude,
      c.longitude,
      provinceGeo,
      'reg-semarang'
    );
    if (check.landStatus === 'IN_SEA_OR_WATER' || !check.isValidLandPoint) {
      plottedSeaCount++;
    }
  }
  assert.equal(plottedSeaCount, 0, 'Semarang must have ZERO plotted sea points');

  // Verify Semarang clusters stay strictly on land and reconcile exact valid count
  for (const zoom of [8, 10, 11, 12]) {
    const clusters = computeZoomClusters(semarangCustomers, zoom, provinceGeo);
    const summed = clusters.reduce((s, cl) => s + cl.count, 0);
    assert.equal(summed, plottableSemarang.length);
    for (const cl of clusters) {
      const check = validatePointAgainstLandAndTerritory(
        cl.latitude,
        cl.longitude,
        provinceGeo,
        'reg-semarang'
      );
      assert.equal(check.landStatus, 'ON_LAND', `Semarang cluster ${cl.id} must stay on land`);
    }
  }
});

test('AT-6 & AT-7: coastal cluster positioning anchors on valid on-land member without mutating customer coordinates', () => {
  const astra = DEMO_TENANTS[0];
  const provinceGeo = getProvinceMapConfig(astra);
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);
  const plottable = geocoded.filter(isPlottableCustomer);

  // Snapshot original coordinates before clustering
  const beforeCoords = plottable.map((c) => `${c.customer_id}:${c.latitude},${c.longitude}`);

  for (const zoom of [8, 9, 10, 11, 12]) {
    const clusters = computeZoomClusters(geocoded, zoom, provinceGeo);
    const totalInClusters = clusters.reduce((acc, cl) => acc + cl.count, 0);
    assert.equal(
      totalInClusters,
      plottable.length,
      `Zoom ${zoom} clusters must sum exactly to plottable count (${plottable.length})`
    );
  }

  // Verify zero mutation of customer coordinates
  const afterCoords = plottable.map((c) => `${c.customer_id}:${c.latitude},${c.longitude}`);
  assert.deepEqual(afterCoords, beforeCoords, 'Clustering must NEVER mutate customer coordinates');

  const lowClusters = computeZoomClusters(geocoded, 8, provinceGeo);
  const medClusters = computeZoomClusters(geocoded, 11, provinceGeo);
  assert.ok(
    medClusters.length > lowClusters.length,
    'Medium zoom must expand provincial clusters into finer spatial sub-clusters'
  );
});

test('AT-5 & AT-8 & AT-9: Forward & Reverse Geocoding report honest service state, cache results, and never fabricate street addresses', () => {
  const astra = DEMO_TENANTS[0];
  const provinceGeo = getProvinceMapConfig(astra);

  const fwdStrict = runForwardGeocoding(
    {
      sourceAddress: 'Jl. Pemuda No. 12',
      village: 'Sekayu',
      district: 'Semarang Tengah',
      city: 'Kota Semarang',
      province: 'Jawa Tengah',
      postalCode: '50132',
    },
    provinceGeo
  );
  assert.equal(fwdStrict.serviceConnected, false);
  assert.match(fwdStrict.statusMessage, /Geocoding Service Not Connected/i);
  assert.equal(fwdStrict.latitude, null);
  assert.equal(fwdStrict.longitude, null);
  assert.equal(fwdStrict.quality, 'NOT_GEOCODED');

  const fwdApprox = runForwardGeocoding(
    {
      sourceAddress: 'Jl. Pemuda No. 12',
      village: 'Sekayu',
      district: 'Semarang Tengah',
      city: 'Kota Semarang',
      province: 'Jawa Tengah',
      postalCode: '50132',
    },
    provinceGeo,
    { allowSyntheticTerritoryFallback: true }
  );
  assert.equal(fwdApprox.serviceConnected, false);
  assert.equal(fwdApprox.quality, 'APPROXIMATE_LOCATION');
  assert.notEqual(fwdApprox.quality, 'VERIFIED_ADDRESS');
  assert.ok(isValidWgs84Coordinate(fwdApprox.latitude, fwdApprox.longitude));

  // Reverse geocoding caching & land classification
  const rev1 = runReverseGeocoding(-6.9895, 110.4229, provinceGeo);
  const rev2 = runReverseGeocoding(-6.9895, 110.4229, provinceGeo);
  assert.equal(rev1.serviceConnected, false);
  assert.match(rev1.statusMessage, /Geocoding Service Not Connected/i);
  assert.equal(rev1.landStatus, 'ON_LAND');
  assert.equal(rev1.city, 'Kota Semarang');
  assert.equal(rev2.cached, true, 'Second reverse geocode lookup must hit cache');

  const revSea = runReverseGeocoding(-6.895, 110.42, provinceGeo);
  assert.equal(revSea.landStatus, 'IN_SEA_OR_WATER');
  assert.match(revSea.approximateAddress, /Offshore|Water/i);
});

test('AT-10 & AT-11 & AT-14: Geolocation Data Quality reconciliation, Validate All non-snapping, and RBAC location privacy', () => {
  const astra = DEMO_TENANTS[0];
  const provinceGeo = getProvinceMapConfig(astra);
  const dataset = generateTenantDataset(astra);
  const allRegionIds = astra.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(astra, 'motorcycle', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(astra, dataset.customers, dealers);

  const validated = validateAllCustomerLocations(geocoded, provinceGeo, '2026-11-24 12:00');
  const summary = computeGeolocationQualitySummary(validated);

  // Strict count reconciliation
  assert.equal(summary.totalCustomers, geocoded.length);
  assert.equal(
    summary.plottableCustomers + summary.invalidCoordinates + summary.unmappedCustomers,
    summary.totalCustomers
  );
  assert.equal(summary.geocodedCustomers + summary.unmappedCustomers, summary.totalCustomers);
  assert.equal(summary.verifiedAddressPoints, 0, 'Synthetic points must never claim VERIFIED_ADDRESS');
  assert.ok(summary.invalidCoordinates > 0, 'Quarantined offshore demo sample is retained & reported');
  assert.ok(summary.unmappedCustomers > 0, 'Unmapped demo sample is retained & reported');

  // Verify invalid coordinates were NOT silently snapped to land
  const invalidRow = validated.find((c) => c.geolocation_status === 'INVALID_LOCATION')!;
  assert.equal(invalidRow.is_plottable, false);
  assert.equal(invalidRow.land_validation_status, 'IN_SEA_OR_WATER');

  // Verify RBAC privacy: Platform Super Admin & Executive Management do NOT get precise coordinates
  const superAdmin = getPersonaById('platform_super_admin');
  const executive = getPersonaById('executive_management');
  const tenantAdmin = getPersonaById('tenant_admin');
  const regionalMgr = getPersonaById('regional_manager');
  const analyst = getPersonaById('business_analyst');

  assert.equal(hasPermission(superAdmin, 'location.view_precise_customer'), false);
  assert.equal(hasPermission(executive, 'location.view_precise_customer'), false);
  assert.equal(hasPermission(tenantAdmin, 'location.view_precise_customer'), true);
  assert.equal(hasPermission(regionalMgr, 'location.view_precise_customer'), true);
  assert.equal(hasPermission(analyst, 'location.view_precise_customer'), true);

  // Verify CSV export masks coordinates & addresses when unauthorized
  const maskedCsv = buildValidationReportCsv(validated.slice(0, 5), astra.name, false);
  const fullCsv = buildValidationReportCsv(validated.slice(0, 5), astra.name, true);
  assert.match(maskedCsv, /MASKED_RBAC/);
  assert.match(maskedCsv, /REDACTED_BY_ROLE_PRIVACY_POLICY/);
  assert.doesNotMatch(fullCsv, /MASKED_RBAC/);
});

test('dealer radius coverage reconciles inside + outside === plottable and grows monotonically from 5 km to 10 km', () => {
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
  const plottableSemarang = semarangCustomers.filter(isPlottableCustomer);
  const semarangDealer = dealers.find((d) => d.region_id === 'reg-semarang')!;
  assert.ok(semarangDealer);

  const cov5 = computeDealerCoverage(semarangDealer, 5, semarangCustomers, dealers);
  const cov10 = computeDealerCoverage(semarangDealer, 10, semarangCustomers, dealers);

  assert.equal(cov5.inside_count + cov5.outside_count, plottableSemarang.length);
  assert.equal(cov10.inside_count + cov10.outside_count, plottableSemarang.length);
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

  const square: Array<[number, number]> = [
    [-7.1, 110.3],
    [-7.1, 110.5],
    [-6.9, 110.5],
    [-6.9, 110.3],
  ];
  assert.equal(isPointInPolygon([-7.0, 110.4], square), true);
  assert.equal(isPointInPolygon([-7.5, 110.8], square), false);

  const rectSel = evaluateGeoSelection(
    { type: 'rectangle', bounds: [[-7.15, 110.25], [-6.95, 110.55]] },
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
    { type: 'radius', center: [-6.993, 110.42], radiusKm: 8 },
    'Semarang 8 km Radius',
    geocoded,
    dealers,
    competitors,
    5
  );
  assert.ok(radiusSel.matching_count > 0);
  for (const c of radiusSel.matching_customers) {
    assert.ok(isPlottableCustomer(c));
    const km = haversineDistanceKm(c.latitude!, c.longitude!, -6.993, 110.42);
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

  const anyChanged = defaultZones.some((z) => {
    const alt = riskHeavyZones.find((r) => r.region_id === z.region_id);
    return alt && alt.composite_score !== z.composite_score;
  });
  assert.ok(anyChanged, 'Weight sliders must meaningfully affect composite opportunity scores');
});

test('customer-to-dealer insights, competitor filters, and Lexus campaign subsetting reconcile properly', () => {
  const lexus = DEMO_TENANTS.find((t) => t.id === 'tenant-lexus')!;
  const dataset = generateTenantDataset(lexus);
  const allRegionIds = lexus.province.regencies.map((r) => r.id);
  const dealers = buildTenantDealerNetwork(lexus, 'automotive', allRegionIds, dataset.customers);
  const geocoded = buildGeocodedCustomers(lexus, dataset.customers, dealers);
  const plottableLexus = geocoded.filter(isPlottableCustomer);
  const competitors = buildTenantCompetitors(lexus, 'automotive', allRegionIds);

  const insights = computeCustomerToDealerInsights(geocoded, dealers, 5);
  assert.equal(insights.near_dealer_count + insights.outside_coverage_count, plottableLexus.length);

  const allComps = filterCompetitors(competitors, 'all', 'ALL');
  const dealerComps = filterCompetitors(competitors, 'dealer', 'ALL');
  const serviceComps = filterCompetitors(competitors, 'service', 'ALL');
  const noComps = filterCompetitors(competitors, 'none', 'ALL');
  assert.equal(dealerComps.length + serviceComps.length, allComps.length);
  assert.equal(noComps.length, 0);

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

test('computeCustomerMapCounts reconciles Total = Mapped + Unmapped (Invalid + NotGeocoded) and tracks viewport Visible subset', () => {
  const sample = [
    { latitude: -6.99, longitude: 110.42, is_plottable: true, geolocation_status: 'SIMULATED_VALID_LAND_POINT' as const },
    { latitude: -7.01, longitude: 110.44, is_plottable: true, geolocation_status: 'SIMULATED_VALID_LAND_POINT' as const },
    { latitude: -7.56, longitude: 110.82, is_plottable: true, geolocation_status: 'SIMULATED_VALID_LAND_POINT' as const },
    { latitude: -6.895, longitude: 110.42, is_plottable: false, geolocation_status: 'INVALID_LOCATION' as const },
    { latitude: null, longitude: null, is_plottable: false, geolocation_status: 'NOT_GEOCODED' as const },
  ];

  const allView = computeCustomerMapCounts(sample, null);
  assert.equal(allView.total, 5);
  assert.equal(allView.mapped, 3);
  assert.equal(allView.unmapped, 2);
  assert.equal(allView.invalid, 1);
  assert.equal(allView.notGeocoded, 1);
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

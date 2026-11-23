import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { getIndustryProfile } from '../industry-config/profiles';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import {
  buildCustomerSpendTimeline,
  computeLifecycleDistribution,
  computeSegmentProfiles,
  computeTerritoryIntelligence,
  getAtRiskCustomers,
  queryCustomers,
} from './customerLocationService';

test('customer segmentation and lifecycle analytics preserve exact totals', () => {
  const autoTenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(autoTenant);
  const industry = getIndustryProfile(autoTenant.defaultIndustryId);

  const segments = computeSegmentProfiles(dataset.customers);
  const segTotal = segments.reduce((acc, s) => acc + s.count, 0);
  assert.equal(segTotal, 1000);
  assert.ok(segments.every((s) => s.avgLtv >= 0 && s.avgChurnScore >= 0));

  const lifecycle = computeLifecycleDistribution(dataset.customers, industry);
  const lcTotal = lifecycle.reduce((acc, l) => acc + l.count, 0);
  assert.equal(lcTotal, 1000);
});

test('at-risk identification and hierarchical territory-segment cross-filtering work consistently', () => {
  const autoTenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(autoTenant);

  const atRisk = getAtRiskCustomers(dataset.customers, 20);
  assert.ok(atRisk.totalAtRisk > 0);
  assert.equal(atRisk.priorityQueue.length, Math.min(20, atRisk.totalAtRisk));
  // Verify descending churn risk ordering
  for (let i = 1; i < atRisk.priorityQueue.length; i++) {
    assert.ok(
      atRisk.priorityQueue[i - 1].model_outputs.churn_risk_score >=
        atRisk.priorityQueue[i].model_outputs.churn_risk_score
    );
  }

  // Hierarchical drilldown: Kota Semarang -> Semarang Tengah -> At-Risk Retention
  const semarang = autoTenant.province.regencies[0];
  const district = semarang.districts[0];
  const crossFiltered = queryCustomers(dataset.customers, {
    regionId: semarang.id,
    districtId: district.id,
    segment: 'At-Risk Retention',
    sortBy: 'churn_desc',
  });
  assert.ok(crossFiltered.length > 0);
  for (const c of crossFiltered) {
    assert.equal(c.region_id, semarang.id);
    assert.equal(c.district_id, district.id);
    assert.equal(c.customer_segment, 'At-Risk Retention');
  }

  // Customer spend timeline is chronologically ordered
  const timeline = buildCustomerSpendTimeline(crossFiltered[0]);
  assert.equal(timeline.length, crossFiltered[0].transactions.length);
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i - 1].date <= timeline[i].date);
  }
});

test('Indonesian WGS-84 geo polygons cover every regency across all demo tenants', () => {
  for (const tenant of DEMO_TENANTS) {
    const geo = getProvinceMapConfig(tenant);
    const polyIds = new Set(geo.territories.map((t) => t.regionId));
    for (const reg of tenant.province.regencies) {
      assert.ok(polyIds.has(reg.id), `Missing WGS-84 polygon for ${reg.id} in ${tenant.id}`);
    }

    const dataset = generateTenantDataset(tenant);
    const intel = computeTerritoryIntelligence(
      tenant,
      dataset.customers,
      tenant.province.regencies.map((r) => r.id)
    );
    assert.equal(intel.length, tenant.province.regencies.length);
    const totalCust = intel.reduce((acc, t) => acc + t.customerCount, 0);
    assert.equal(totalCust, tenant.seedCount);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { computeDashboardAnalytics } from './kpiEngine';
import { getIndustryProfile } from '../industry-config/profiles';
import {
  getPersonaById,
  getPermittedBranchIds,
  getPermittedRegionIds,
} from '../permissions/rbac';
import {
  canDisableModule,
  canEnableModule,
  DEFAULT_MODULE_REGISTRY,
} from '../module-registry/registry';

test('deterministic automotive dataset generates 1,000 customers with full referential integrity', () => {
  const autoTenant = DEMO_TENANTS[0];
  const ds1 = generateTenantDataset(autoTenant);
  const ds2 = generateTenantDataset(autoTenant);

  assert.equal(ds1.customers.length, 1000);
  assert.equal(ds1.customers[0].full_name, ds2.customers[0].full_name);
  assert.equal(ds1.customers[0].lifetime_value, ds2.customers[0].lifetime_value);

  const validRegionIds = new Set(autoTenant.province.regencies.map((r) => r.id));
  const validBranchIds = new Set(autoTenant.branches.map((b) => b.id));

  for (const c of ds1.customers) {
    assert.equal(c.tenant_id, autoTenant.id);
    assert.ok(validRegionIds.has(c.region_id), `Invalid region_id ${c.region_id}`);
    assert.ok(validBranchIds.has(c.branch_id), `Invalid branch_id ${c.branch_id}`);
    assert.ok(c.transactions.length >= 1);
    for (const tx of c.transactions) {
      assert.equal(tx.customer_id, c.customer_id);
      assert.equal(tx.region_id, c.region_id);
      assert.equal(tx.branch_id, c.branch_id);
    }
  }
});

test('KPI calculations remain consistent when filtering by region and persona scope', () => {
  const autoTenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(autoTenant);
  const industry = getIndustryProfile(autoTenant.defaultIndustryId);
  const superAdmin = getPersonaById('platform_super_admin');
  const branchUser = getPersonaById('branch_operational');

  const allRegions = getPermittedRegionIds(superAdmin, autoTenant);
  const allBranches = getPermittedBranchIds(superAdmin, autoTenant);

  const fullSnapshot = computeDashboardAnalytics({
    tenant: autoTenant,
    industry,
    allCustomers: dataset.customers,
    campaigns: dataset.campaigns,
    permittedRegionIds: allRegions,
    permittedBranchIds: allBranches,
    filters: { regionId: 'ALL', dateRange: '6m', segment: 'ALL' },
  });

  assert.equal(fullSnapshot.totalFilteredCustomers, 1000);
  const segmentSum = fullSnapshot.segments.reduce((acc, s) => acc + s.count, 0);
  assert.equal(segmentSum, 1000);

  const regionalSum = fullSnapshot.regionalPerformance.reduce((acc, r) => acc + r.customers, 0);
  assert.equal(regionalSum, 1000);

  // Filter to Semarang only
  const semarangSnapshot = computeDashboardAnalytics({
    tenant: autoTenant,
    industry,
    allCustomers: dataset.customers,
    campaigns: dataset.campaigns,
    permittedRegionIds: allRegions,
    permittedBranchIds: allBranches,
    filters: { regionId: 'reg-semarang', dateRange: '6m', segment: 'ALL' },
  });

  assert.ok(semarangSnapshot.totalFilteredCustomers > 0 && semarangSnapshot.totalFilteredCustomers < 1000);
  assert.equal(semarangSnapshot.regionalPerformance.length, 1);
  assert.equal(semarangSnapshot.regionalPerformance[0].regionId, 'reg-semarang');

  // Branch user scope restricts strictly to one branch
  const branchRegions = getPermittedRegionIds(branchUser, autoTenant);
  const branchIds = getPermittedBranchIds(branchUser, autoTenant);
  assert.equal(branchIds.length, 1);

  const branchSnapshot = computeDashboardAnalytics({
    tenant: autoTenant,
    industry,
    allCustomers: dataset.customers,
    campaigns: dataset.campaigns,
    permittedRegionIds: branchRegions,
    permittedBranchIds: branchIds,
    filters: { regionId: 'ALL', dateRange: '6m', segment: 'ALL' },
  });
  assert.ok(branchSnapshot.totalFilteredCustomers < semarangSnapshot.totalFilteredCustomers || branchSnapshot.totalFilteredCustomers <= semarangSnapshot.totalFilteredCustomers);
});

test('module registry enforces mandatory dependencies on enable and disable', () => {
  // BM02 cannot be disabled while BM04 or BM05 are enabled
  const disableBm02 = canDisableModule(DEFAULT_MODULE_REGISTRY, 'BM02');
  assert.equal(disableBm02.allowed, false);
  assert.ok(disableBm02.blockingModules.includes('BM04'));
  assert.ok(disableBm02.blockingModules.includes('BM05'));

  // BM01 and BM08 are protected core modules
  assert.equal(canDisableModule(DEFAULT_MODULE_REGISTRY, 'BM01').allowed, false);
  assert.equal(canDisableModule(DEFAULT_MODULE_REGISTRY, 'BM08').allowed, false);

  // BM07 can be disabled cleanly, then BM05 can be disabled
  assert.equal(canDisableModule(DEFAULT_MODULE_REGISTRY, 'BM07').allowed, true);
  const afterBm07Off = DEFAULT_MODULE_REGISTRY.map((m) =>
    m.module_id === 'BM07' ? { ...m, enabled: false } : m
  );
  assert.equal(canDisableModule(afterBm07Off, 'BM05').allowed, true);

  // If BM05 is disabled, BM07 cannot be re-enabled until BM05 is enabled
  const afterBm05Off = afterBm07Off.map((m) =>
    m.module_id === 'BM05' ? { ...m, enabled: false } : m
  );
  const enableBm07 = canEnableModule(afterBm05Off, 'BM07');
  assert.equal(enableBm07.allowed, false);
  assert.deepEqual(enableBm07.blockingModules, ['BM05']);
});

test('all 6 demonstration tenants have isolated datasets, industry profiles, and module configs', () => {
  assert.equal(DEMO_TENANTS.length, 6);
  assert.deepEqual(
    DEMO_TENANTS.map((t) => t.name),
    ['Astra Motor', 'Auto2000', 'Daihatsu', 'Lexus', 'BMW', 'Isuzu']
  );

  // Astra Motor must be the default tenant
  assert.equal(DEMO_TENANTS[0].name, 'Astra Motor');
  assert.equal(DEMO_TENANTS[0].defaultIndustryId, 'motorcycle');

  const seenCustomerIds = new Set<string>();
  const seenTxIds = new Set<string>();
  const seenCodes = new Set<string>();

  for (const tenant of DEMO_TENANTS) {
    const profile = getIndustryProfile(tenant.defaultIndustryId);
    assert.ok(profile.kpiDefinitions.length >= 2, `Missing KPIs for ${tenant.name}`);
    assert.ok(profile.aiUseCases.length >= 1, `Missing AI use cases for ${tenant.name}`);
    assert.ok(tenant.defaultModuleConfig && Object.keys(tenant.defaultModuleConfig).length >= 3, `Missing tenant-specific module config for ${tenant.name}`);

    const ds = generateTenantDataset(tenant);
    assert.equal(ds.customers.length, tenant.seedCount);
    assert.ok(ds.campaigns.length === 3);

    for (const c of ds.customers) {
      assert.equal(c.tenant_id, tenant.id, `Customer leaked across tenant boundary in ${tenant.name}`);
      assert.equal(seenCustomerIds.has(c.customer_id), false, `Duplicate customer_id ${c.customer_id}`);
      assert.equal(seenCodes.has(c.code), false, `Duplicate customer code ${c.code}`);
      seenCustomerIds.add(c.customer_id);
      seenCodes.add(c.code);

      for (const tx of c.transactions) {
        assert.equal(tx.tenant_id, tenant.id, `Transaction leaked across tenant boundary in ${tenant.name}`);
        assert.equal(seenTxIds.has(tx.transaction_id), false, `Duplicate tx ${tx.transaction_id}`);
        seenTxIds.add(tx.transaction_id);
      }
    }
  }
});


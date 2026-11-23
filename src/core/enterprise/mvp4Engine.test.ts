import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { DEFAULT_MODULE_REGISTRY, canDisableModule, canEnableModule } from '../module-registry/registry';
import { getPersonaById } from '../permissions/rbac';
import {
  SAMPLE_RETAIL_CSV,
  canDeleteIndustryProfile,
  computeEvidenceBasedReadiness,
  createNextIndustryProfileVersion,
  createTenantOnboardingDraft,
  evaluateModuleGraph,
  parseCsvText,
  provisionTenantTransaction,
  validateAndBuildCsvImport,
  validateEnterpriseAiTransition,
  validateIndustryProfileSchema,
  validateOnboardingStep,
  validateReadinessItemUpdate,
} from './mvp4Engine';
import {
  buildInitialEnterpriseAiModels,
  buildInitialManagedIndustryProfiles,
  buildInitialReadinessCategories,
  buildInitialTenantGovernance,
} from '../state/mvp4SeedState';

test('Tenant onboarding validates inputs and transactionally provisions an isolated Retail tenant', () => {
  const blankDraft = createTenantOnboardingDraft('blank');
  const step1Fail = validateOnboardingStep(blankDraft, 1, DEMO_TENANTS);
  assert.equal(step1Fail.valid, false);
  assert.ok(step1Fail.errors.length >= 2);

  const retailDemo = createTenantOnboardingDraft('retail_demo');
  const fullCheck = validateOnboardingStep(retailDemo, 8, DEMO_TENANTS);
  assert.equal(fullCheck.valid, true, fullCheck.errors.join('; '));

  const provisioned = provisionTenantTransaction(
    retailDemo,
    DEMO_TENANTS,
    'Ardian Kusuma',
    'Platform Super Admin',
    '2026-11-21 10:00'
  );
  assert.equal(provisioned.ok, true);
  assert.ok(provisioned.tenant);
  assert.equal(provisioned.tenant.defaultIndustryId, 'retail');
  assert.equal(provisioned.tenant.code, 'KRN-RET');
  assert.equal(provisioned.governance?.status, 'Active');
  assert.equal(provisioned.adminUser?.roleId, 'tenant_admin');

  // Duplicate tenant code must be blocked
  const dupCheck = validateOnboardingStep(retailDemo, 1, [...DEMO_TENANTS, provisioned.tenant]);
  assert.equal(dupCheck.valid, false);
});

test('Industry Profile Builder enforces schema validation, immutable version bumps, and active-tenant delete guard', () => {
  const profiles = buildInitialManagedIndustryProfiles();
  assert.equal(profiles.length, 8);

  const autoProfile = profiles.find((p) => p.id === 'automotive')!;
  const schemaReport = validateIndustryProfileSchema(autoProfile);
  assert.equal(schemaReport.valid, true);

  const v2Draft = createNextIndustryProfileVersion(
    autoProfile,
    'Ardian Kusuma',
    '2026-11-21 11:00',
    'Add electric vehicle telemetry attribute'
  );
  assert.equal(v2Draft.version, 2);
  assert.equal(v2Draft.lifecycleStatus, 'Draft');
  assert.equal(v2Draft.versionHistory.length, 2);

  const govMap = buildInitialTenantGovernance(DEMO_TENANTS);
  const deleteAttempt = canDeleteIndustryProfile(autoProfile, DEMO_TENANTS, govMap);
  assert.equal(deleteAttempt.allowed, false);
  assert.match(deleteAttempt.reason ?? '', /actively assigned/i);
});

test('Module Marketplace dependency graph detects missing dependencies and blocks invalid toggles', () => {
  assert.equal(DEFAULT_MODULE_REGISTRY.length, 10);

  // Disabling BM02 while BM04/BM05 are active must be blocked
  const disableBm02 = canDisableModule(DEFAULT_MODULE_REGISTRY, 'BM02');
  assert.equal(disableBm02.allowed, false);
  assert.ok(disableBm02.blockingModules.includes('BM04'));

  // Disable dependents first, then BM02 -> BM04 shows Missing Dependency
  const customMods = DEFAULT_MODULE_REGISTRY.map((m) =>
    ['BM02', 'BM04', 'BM05', 'BM06', 'BM07'].includes(m.module_id)
      ? { ...m, enabled: false }
      : { ...m }
  );
  const enableBm04WithoutBm02 = canEnableModule(customMods, 'BM04');
  assert.equal(enableBm04WithoutBm02.allowed, false);

  const graph = evaluateModuleGraph(customMods);
  assert.equal(graph.BM04.availability, 'Missing Dependency');
  assert.equal(graph.BM01.availability, 'Active');
});

test('CSV import parser validates required fields, detects duplicates, and maps to canonical tenant records', () => {
  const retailTenant = DEMO_TENANTS[1];
  const dataset = generateTenantDataset(retailTenant);
  const parsed = parseCsvText(SAMPLE_RETAIL_CSV);
  assert.equal(parsed.rows.length, 5);

  const mapping = {
    full_name: 'full_name',
    code: 'customer_code',
    city: 'city',
    customer_segment: 'segment',
    status: 'status',
    lifetime_value: 'lifetime_value_idr',
    preferred_channel: 'preferred_channel',
  };

  const firstImport = validateAndBuildCsvImport(parsed.rows, mapping, retailTenant, dataset.customers);
  assert.equal(firstImport.report.canImport, true);
  assert.equal(firstImport.records.length, 5);
  assert.ok(firstImport.records.every((r) => r.tenant_id === retailTenant.id));

  // Re-importing same CSV must flag all 5 as duplicates
  const dupImport = validateAndBuildCsvImport(
    parsed.rows,
    mapping,
    retailTenant,
    [...dataset.customers, ...firstImport.records]
  );
  assert.equal(dupImport.report.canImport, false);
  assert.equal(dupImport.report.duplicateCodes, 5);
});

test('Enterprise AI Governance and Evidence-Based Readiness enforce approval & evidence gates', () => {
  const models = buildInitialEnterpriseAiModels(DEMO_TENANTS[0]);
  const candidate = models.find((m) => m.status === 'Validated')!;
  const analyst = getPersonaById('business_analyst');
  const superAdmin = getPersonaById('platform_super_admin');

  // Analyst cannot approve model
  const analystApprove = validateEnterpriseAiTransition(candidate, 'Approved', analyst);
  assert.equal(analystApprove.allowed, false);

  // Cannot skip straight from Validated -> Active without Approved state
  const skipToActive = validateEnterpriseAiTransition(candidate, 'Active', superAdmin);
  assert.equal(skipToActive.allowed, false);

  // Super Admin can move Validated -> Approved
  const adminApprove = validateEnterpriseAiTransition(candidate, 'Approved', superAdmin);
  assert.equal(adminApprove.allowed, true);

  // Evidence-based readiness strictly rejects verifying demo-only or evidence-less items
  const categories = buildInitialReadinessCategories();
  assert.equal(categories.length, 10);
  const summary = computeEvidenceBasedReadiness(categories);
  assert.equal(summary.productionSignOffEligible, false);
  assert.ok(summary.verifiedCount > 0 && summary.verifiedCount < summary.totalItems);

  const demoItem = categories[1].items.find((i) => i.demoOnlyLimitation)!;
  const fakeVerify = validateReadinessItemUpdate(demoItem, 'Verified', 'DOC-123456', 'Owner', '2026-11-21');
  assert.equal(fakeVerify.allowed, false);

  const normalItem = categories[0].items[0];
  const noEvidenceVerify = validateReadinessItemUpdate(normalItem, 'Verified', '', 'Owner', '2026-11-21');
  assert.equal(noEvidenceVerify.allowed, false);
});

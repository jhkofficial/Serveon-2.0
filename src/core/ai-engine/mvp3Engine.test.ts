import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { getIndustryProfile } from '../industry-config/profiles';
import { getPersonaById } from '../permissions/rbac';
import {
  buildDefaultBusinessRules,
  buildTenantPredictions,
  computeCampaignAudience,
  computeEventDrivenPerformance,
  generateDeterministicCampaignEvents,
  generateRecommendations,
  validateCampaignTransition,
} from './mvp3Engine';
import type { Campaign } from '../../types/mvp3';

test('AI predictions include all 4 families, tenant isolation, and honest simulated labels', () => {
  const autoTenant = DEMO_TENANTS[0];
  const retailTenant = DEMO_TENANTS[1];
  const autoDataset = generateTenantDataset(autoTenant);
  const retailDataset = generateTenantDataset(retailTenant);

  const autoPreds = buildTenantPredictions(
    autoTenant,
    getIndustryProfile('automotive'),
    autoDataset.customers
  );
  const retailPreds = buildTenantPredictions(
    retailTenant,
    getIndustryProfile('retail'),
    retailDataset.customers
  );

  // Check all 4 prediction types present
  const types = new Set(autoPreds.map((p) => p.predictionType));
  assert.ok(types.has('churn_risk'));
  assert.ok(types.has('purchase_propensity'));
  assert.ok(types.has('geographic_opportunity'));
  assert.ok(types.has('engagement_index'));

  // Every record strictly belongs to its tenant and is honestly labeled Simulated AI Prediction
  assert.ok(autoPreds.every((p) => p.tenant_id === autoTenant.id));
  assert.ok(retailPreds.every((p) => p.tenant_id === retailTenant.id));
  assert.ok(autoPreds.every((p) => p.modelStatus === 'Simulated AI Prediction'));
  assert.ok(autoPreds.every((p) => p.shapAvailable === false));
  assert.ok(
    autoPreds.every((p) =>
      p.contributingFactors.every(
        (f) => f.attributionMethod === 'Illustrative Feature Attribution (Demo Mode)'
      )
    )
  );
});

test('Next-Best-Action engine adapts rules by industry and supports all 4 strategies', () => {
  const autoTenant = DEMO_TENANTS[0];
  const bankingTenant = DEMO_TENANTS[3];
  const autoDataset = generateTenantDataset(autoTenant);
  const bankDataset = generateTenantDataset(bankingTenant);

  const autoRules = buildDefaultBusinessRules(autoTenant.id, 'automotive');
  const bankRules = buildDefaultBusinessRules(bankingTenant.id, 'banking');

  const autoRecs = generateRecommendations(
    autoTenant,
    getIndustryProfile('automotive'),
    autoDataset.customers,
    autoRules
  );
  const bankRecs = generateRecommendations(
    bankingTenant,
    getIndustryProfile('banking'),
    bankDataset.customers,
    bankRules
  );

  const strategies = new Set(autoRecs.map((r) => r.strategy));
  assert.deepEqual(
    Array.from(strategies).sort(),
    ['ACQUIRE', 'DEFEND', 'DEVELOP', 'RETAIN']
  );
  assert.notEqual(autoRecs[0].recommendedAction, bankRecs[0].recommendedAction);
  assert.ok(autoRecs.every((r) => r.tenant_id === autoTenant.id));
  assert.ok(bankRecs.every((r) => r.tenant_id === bankingTenant.id));
});

test('Campaign audience enforces deduplication, consent, opt-out, suppression, and control holdout', () => {
  const tenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(tenant);
  // Intentionally pass duplicated customer records to verify deduplication
  const duplicatedInput = [...dataset.customers.slice(0, 120), ...dataset.customers.slice(0, 25)];

  const audience = computeCampaignAudience(duplicatedInput, {
    tenantId: tenant.id,
    businessUnitId: 'ALL',
    regionId: 'ALL',
    targetSegment: 'ALL',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    respectConsent: true,
    respectSuppression: true,
    includeControlGroup: true,
  });

  assert.equal(audience.totalMatchedRaw, 145);
  assert.equal(audience.deduplicatedCount, 120);
  assert.ok(audience.optedOutExcluded > 0, 'Should exclude opted-out accounts');
  assert.ok(audience.suppressedExcluded > 0, 'Should exclude unconsented/suppressed accounts');
  assert.ok(audience.controlGroupCount > 0, 'Should allocate deterministic control holdout');
  assert.equal(
    audience.eligibleReachableCount +
      audience.controlGroupCount +
      audience.optedOutExcluded +
      audience.suppressedExcluded,
    audience.deduplicatedCount
  );
});

test('Approval workflow blocks unauthorized approvers, rejected executions, and un-reapproved edits', () => {
  const tenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(tenant);
  const audience = computeCampaignAudience(dataset.customers, {
    tenantId: tenant.id,
    businessUnitId: 'ALL',
    regionId: 'ALL',
    targetSegment: 'At-Risk Retention',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    respectConsent: true,
    respectSuppression: true,
    includeControlGroup: true,
  });

  const baseCampaign: Campaign = {
    id: 'cmp-test-1',
    tenant_id: tenant.id,
    name: 'Test Retention Campaign',
    objective: 'Retain overdue customers',
    strategy: 'RETAIN',
    businessUnitId: tenant.businessUnits[0].id,
    businessUnitName: tenant.businessUnits[0].name,
    targetSegment: 'At-Risk Retention',
    regionId: 'ALL',
    regionName: 'All Jawa Tengah',
    channel: 'WhatsApp',
    channels: ['WhatsApp'],
    messageSubject: 'Service Check-in',
    messageBody: 'Book your inspection.',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    includeControlGroup: true,
    respectConsent: true,
    respectSuppression: true,
    status: 'Pending Approval',
    version: 1,
    scheduledDate: '2026-12-05',
    targetAudienceCount: audience.eligibleReachableCount,
    estimatedConversionRate: 16.5,
    simulatedConversions: 0,
    estimatedRevenueImpact: 120_000_000,
    budgetAllocated: 25_000_000,
    createdBy: 'Dimas Pratama',
    createdAt: '2026-11-20',
    auditTrail: [],
    audience,
    approvalDecisions: [],
    requiresReapproval: false,
    simulationState: 'idle',
    simulationProgressPct: 0,
  };

  const campaignMgr = getPersonaById('campaign_manager');
  const businessMgr = getPersonaById('business_manager');
  const branchUser = getPersonaById('branch_operational');

  // Unauthorized roles CANNOT approve
  assert.equal(validateCampaignTransition(baseCampaign, 'Approved', campaignMgr).allowed, false);
  assert.equal(validateCampaignTransition(baseCampaign, 'Approved', branchUser).allowed, false);

  // Authorized Business Manager CAN approve
  assert.equal(validateCampaignTransition(baseCampaign, 'Approved', businessMgr).allowed, true);

  // Rejected campaign CANNOT execute
  const rejectedCampaign: Campaign = { ...baseCampaign, status: 'Rejected' };
  assert.equal(
    validateCampaignTransition(rejectedCampaign, 'Simulated Running', campaignMgr).allowed,
    false
  );

  // Approved campaign modified (requiresReapproval = true) CANNOT execute
  const editedApproved: Campaign = {
    ...baseCampaign,
    status: 'Approved',
    version: 2,
    requiresReapproval: true,
  };
  assert.equal(
    validateCampaignTransition(editedApproved, 'Simulated Running', campaignMgr).allowed,
    false
  );
});

test('Execution simulator creates deduplicated deterministic events and drives exact ROI metrics', () => {
  const tenant = DEMO_TENANTS[0];
  const dataset = generateTenantDataset(tenant);
  const audience = computeCampaignAudience(dataset.customers, {
    tenantId: tenant.id,
    businessUnitId: 'ALL',
    regionId: 'ALL',
    targetSegment: 'At-Risk Retention',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    respectConsent: true,
    respectSuppression: true,
    includeControlGroup: true,
  });

  const cmp: Campaign = {
    id: 'cmp-sim-roi-1',
    tenant_id: tenant.id,
    name: 'Semarang Service Recovery',
    objective: 'Re-engage overdue accounts',
    strategy: 'RETAIN',
    businessUnitId: tenant.businessUnits[0].id,
    businessUnitName: tenant.businessUnits[0].name,
    targetSegment: 'At-Risk Retention',
    regionId: 'ALL',
    regionName: 'All Jawa Tengah',
    channel: 'WhatsApp',
    channels: ['WhatsApp', 'Email'],
    messageSubject: 'Workshop Voucher',
    messageBody: 'Complimentary inspection.',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    includeControlGroup: true,
    respectConsent: true,
    respectSuppression: true,
    status: 'Completed',
    version: 1,
    scheduledDate: '2026-10-15',
    targetAudienceCount: audience.eligibleReachableCount,
    estimatedConversionRate: 16.4,
    simulatedConversions: 0,
    estimatedRevenueImpact: 0,
    budgetAllocated: 25_000_000,
    createdBy: 'Dimas Pratama',
    createdAt: '2026-10-02',
    auditTrail: [],
    audience,
    approvalDecisions: [],
    requiresReapproval: false,
    simulationState: 'completed',
    simulationProgressPct: 100,
  };

  const simA = generateDeterministicCampaignEvents(cmp, dataset.customers, 100);
  const simB = generateDeterministicCampaignEvents(cmp, dataset.customers, 100);

  // 100% deterministic & no duplicate (campaignId, customerId, status)
  assert.equal(simA.events.length, simB.events.length);
  const keys = new Set(simA.events.map((e) => `${e.campaignId}:${e.customerId}:${e.status}`));
  assert.equal(keys.size, simA.events.length);
  assert.ok(simA.events.every((e) => e.simulatedOnly === true));

  // Event-driven performance calculation matches raw events exactly
  const perf = computeEventDrivenPerformance([cmp], simA.events, simA.conversions);
  const row = perf.campaigns[0];
  assert.equal(row.reach, audience.eligibleReachableCount);
  assert.equal(row.converted, simA.conversions.filter((c) => !c.isControlGroup).length);
  assert.equal(
    row.attributedRevenue,
    simA.conversions
      .filter((c) => !c.isControlGroup)
      .reduce((acc, c) => acc + c.attributedRevenue, 0)
  );
  assert.equal(row.hasControlGroup, true);
  assert.ok(row.roiPct !== null);
});

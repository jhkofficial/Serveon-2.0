import type { Tenant } from '../../types/platform';
import type {
  ApprovalPolicy,
  BusinessRule,
  Campaign,
  CampaignDraftWizardState,
  CampaignEvent,
  ConversionEvent,
  ModelRegistryEntry,
  WorkspaceRouteId,
} from '../../types/mvp3';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import { getIndustryProfile } from '../industry-config/profiles';
import {
  buildDefaultApprovalPolicy,
  buildDefaultBusinessRules,
  buildDefaultModelRegistry,
  computeCampaignAudience,
  generateDeterministicCampaignEvents,
} from '../ai-engine/mvp3Engine';
import type { ModuleId } from '../../types/platform';

export const ROUTE_TO_MODULE: Record<WorkspaceRouteId, ModuleId> = {
  executive: 'BM01',
  customers: 'BM02',
  location: 'BM03',
  ai_predictions: 'BM04',
  explainable_ai: 'BM04',
  next_best_action: 'BM06',
  decision_hub: 'BM06',
  campaign_studio: 'BM05',
  approval_inbox: 'BM05',
  campaign_ops: 'BM05',
  performance: 'BM07',
  learning_governance: 'BM08',
  admin_config: 'BM10',
  ent_overview: 'BM10',
  ent_tenants: 'BM10',
  ent_org: 'BM10',
  ent_industries: 'BM09',
  ent_marketplace: 'BM10',
  ent_users: 'BM10',
  ent_integrations: 'BM10',
  ent_ai_governance: 'BM08',
  ent_security_audit: 'BM10',
  ent_monitoring: 'BM10',
  ent_readiness: 'BM10',
};

export const MODULE_DEFAULT_ROUTE: Record<ModuleId, WorkspaceRouteId> = {
  BM01: 'executive',
  BM02: 'customers',
  BM03: 'location',
  BM04: 'ai_predictions',
  BM05: 'campaign_studio',
  BM06: 'next_best_action',
  BM07: 'performance',
  BM08: 'learning_governance',
  BM09: 'ent_industries',
  BM10: 'ent_overview',
};

export function createEmptyWizardDraft(tenant: Tenant): CampaignDraftWizardState {
  const defaultBu = tenant.businessUnits[0]?.id ?? 'ALL';
  return {
    step: 1,
    name: '',
    objective: '',
    strategy: 'RETAIN',
    businessUnitId: defaultBu,
    regionId: 'ALL',
    targetSegment: 'At-Risk Retention',
    minRiskCategory: 'ALL',
    minPropensityScore: 0,
    includeControlGroup: true,
    respectConsent: true,
    respectSuppression: true,
    channels: ['WhatsApp'],
    messageSubject: '',
    messageBody: '',
    scheduledDate: '2026-12-08',
    budgetAllocated: 25_000_000,
  };
}

export interface InitialTenantMvp3Bundle {
  campaignsByTenant: Record<string, Campaign[]>;
  eventsByTenant: Record<string, CampaignEvent[]>;
  conversionsByTenant: Record<string, ConversionEvent[]>;
  rulesByTenant: Record<string, BusinessRule[]>;
  modelsByTenant: Record<string, ModelRegistryEntry[]>;
  approvalPoliciesByTenant: Record<string, ApprovalPolicy>;
}

export function buildAllInitialMvp3State(): InitialTenantMvp3Bundle {
  const campaignsByTenant: Record<string, Campaign[]> = {};
  const eventsByTenant: Record<string, CampaignEvent[]> = {};
  const conversionsByTenant: Record<string, ConversionEvent[]> = {};
  const rulesByTenant: Record<string, BusinessRule[]> = {};
  const modelsByTenant: Record<string, ModelRegistryEntry[]> = {};
  const approvalPoliciesByTenant: Record<string, ApprovalPolicy> = {};

  for (const tenant of DEMO_TENANTS) {
    const dataset = generateTenantDataset(tenant);
    const industry = getIndustryProfile(tenant.defaultIndustryId);
    const defaultBu = tenant.businessUnits[0];

    const enrichedCampaigns: Campaign[] = [];
    const tenantEvents: CampaignEvent[] = [];
    const tenantConversions: ConversionEvent[] = [];

    dataset.campaigns.forEach((raw, idx) => {
      const audience = computeCampaignAudience(dataset.customers, {
        tenantId: tenant.id,
        businessUnitId: 'ALL',
        regionId: raw.regionId,
        targetSegment: raw.targetSegment,
        minRiskCategory: raw.targetSegment === 'At-Risk Retention' ? 'Medium' : 'ALL',
        minPropensityScore: raw.targetSegment === 'Growth Potential' ? 50 : 0,
        respectConsent: true,
        respectSuppression: true,
        includeControlGroup: true,
      });

      const strategy =
        raw.targetSegment === 'At-Risk Retention'
          ? 'RETAIN'
          : raw.targetSegment === 'High-Value Loyal'
            ? 'DEFEND'
            : 'DEVELOP';

      const isCompleted = raw.status === 'Completed';
      const isApproved = raw.status === 'Approved';

      const cmp: Campaign = {
        ...raw,
        status: raw.status,
        version: 1,
        businessUnitId: defaultBu?.id ?? 'ALL',
        businessUnitName: defaultBu?.name ?? 'All Business Units',
        strategy,
        channels: idx === 0 ? [raw.channel, 'Email'] : [raw.channel],
        messageSubject: `${raw.name} — Priority Offer`,
        messageBody: `${raw.objective} Tailored for ${raw.targetSegment} in ${raw.regionName}. (Simulated demo copy — no live dispatch.)`,
        minRiskCategory: raw.targetSegment === 'At-Risk Retention' ? 'Medium' : 'ALL',
        minPropensityScore: raw.targetSegment === 'Growth Potential' ? 50 : 0,
        includeControlGroup: true,
        respectConsent: true,
        respectSuppression: true,
        targetAudienceCount: audience.eligibleReachableCount,
        audience,
        approvalDecisions:
          isCompleted || isApproved
            ? [
                {
                  id: `apdec-${raw.id}-1`,
                  tenant_id: tenant.id,
                  campaignId: raw.id,
                  campaignVersion: 1,
                  approverName: isCompleted ? 'Hendra Wijaya' : 'Nadia Pramesti',
                  approverRole: isCompleted ? 'Executive Management' : 'Tenant Administrator',
                  decision: 'Approved',
                  timestamp: isCompleted ? '2026-10-04 14:20' : '2026-11-12 09:30',
                  comments: isCompleted
                    ? 'Approved within Q4 retention budget envelope with 10% holdout group.'
                    : 'Compliance verified. Ready for scheduled simulated execution.',
                },
              ]
            : [],
        requiresReapproval: false,
        simulationState: isCompleted ? 'completed' : 'idle',
        simulationProgressPct: isCompleted ? 100 : 0,
      };

      if (isCompleted) {
        const sim = generateDeterministicCampaignEvents(cmp, dataset.customers, 100);
        tenantEvents.push(...sim.events);
        tenantConversions.push(...sim.conversions);
        const realConversions = sim.conversions.filter((c) => !c.isControlGroup);
        cmp.simulatedConversions = realConversions.length;
        cmp.estimatedRevenueImpact = realConversions.reduce((a, c) => a + c.attributedRevenue, 0);
      }

      enrichedCampaigns.push(cmp);
    });

    campaignsByTenant[tenant.id] = enrichedCampaigns;
    eventsByTenant[tenant.id] = tenantEvents;
    conversionsByTenant[tenant.id] = tenantConversions;
    rulesByTenant[tenant.id] = buildDefaultBusinessRules(tenant.id, tenant.defaultIndustryId);
    modelsByTenant[tenant.id] = buildDefaultModelRegistry(
      tenant.id,
      industry,
      dataset.customers.length
    );
    approvalPoliciesByTenant[tenant.id] = buildDefaultApprovalPolicy(tenant.id);
  }

  return {
    campaignsByTenant,
    eventsByTenant,
    conversionsByTenant,
    rulesByTenant,
    modelsByTenant,
    approvalPoliciesByTenant,
  };
}

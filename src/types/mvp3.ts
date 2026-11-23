import type {
  CampaignChannel,
  CampaignRecord,
  CampaignStatus,
  IndustryId,
  RiskCategory,
} from './platform';

export type WorkspaceRouteId =
  | 'executive'
  | 'customers'
  | 'location'
  | 'ai_predictions'
  | 'explainable_ai'
  | 'next_best_action'
  | 'decision_hub'
  | 'campaign_studio'
  | 'approval_inbox'
  | 'campaign_ops'
  | 'performance'
  | 'learning_governance'
  | 'admin_config'
  | 'ent_overview'
  | 'ent_tenants'
  | 'ent_org'
  | 'ent_industries'
  | 'ent_marketplace'
  | 'ent_users'
  | 'ent_integrations'
  | 'ent_ai_governance'
  | 'ent_security_audit'
  | 'ent_monitoring'
  | 'ent_readiness';

export type PredictionType =
  | 'churn_risk'
  | 'purchase_propensity'
  | 'geographic_opportunity'
  | 'engagement_index';

export interface ExplanationFactor {
  id: string;
  featureName: string;
  featureLabel: string;
  featureValue: string;
  impactPoints: number; // signed contribution points
  direction: 'increases_risk' | 'reduces_risk' | 'increases_opportunity' | 'reduces_opportunity';
  normalizedWeightPct: number; // 0-100 share of total absolute contribution
  attributionMethod: 'Illustrative Feature Attribution (Demo Mode)';
}

export interface PredictionResult {
  id: string;
  tenant_id: string;
  entityType: 'customer' | 'territory';
  entityId: string;
  entityCode: string;
  entityName: string;
  regionId: string;
  regionName: string;
  segment: string;
  predictionType: PredictionType;
  score: number; // 0-100
  category: RiskCategory | 'Strong Opportunity' | 'Moderate Opportunity' | 'Emerging';
  contributingFactors: ExplanationFactor[];
  evaluationDate: string;
  dataTimestamp: string;
  modelVersion: string;
  modelName: string;
  modelStatus: 'Simulated AI Prediction';
  missingDataIndicators: string[];
  modelLimitations: string[];
  industryUseCaseLabel: string;
  shapAvailable: boolean;
}

export type NbaStrategy = 'RETAIN' | 'DEFEND' | 'ACQUIRE' | 'DEVELOP';
export type RecommendationPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type RecommendationStatus =
  | 'Open'
  | 'In Review'
  | 'Accepted'
  | 'Dismissed'
  | 'Converted to Campaign';

export interface Recommendation {
  id: string;
  tenant_id: string;
  strategy: NbaStrategy;
  entityType: 'customer' | 'territory';
  entityId: string;
  entityCode: string;
  entityName: string;
  regionId: string;
  regionName: string;
  segment: string;
  priority: RecommendationPriority;
  recommendedAction: string;
  businessRationale: string;
  suggestedChannel: CampaignChannel;
  expectedOutcome: string;
  eligibility: 'Eligible' | 'Suppressed (Opt-Out)' | 'Suppressed (No Consent)' | 'Review Required';
  eligibilityNotes: string;
  status: RecommendationStatus;
  ruleId: string;
  ruleVersion: number;
  score: number;
  estimatedRevenueImpact: number;
  createdAt: string;
  linkedCampaignId?: string;
}

export interface BusinessRuleAuditEntry {
  version: number;
  timestamp: string;
  actorName: string;
  actorRole: string;
  changeNote: string;
}

export interface BusinessRule {
  id: string;
  tenant_id: string;
  industryId: IndustryId;
  name: string;
  strategy: NbaStrategy;
  description: string;
  minChurnScore: number | null;
  minPropensityScore: number | null;
  minOpportunityScore: number | null;
  targetSegment: string; // 'ALL' or segment name
  suggestedChannel: CampaignChannel;
  priority: RecommendationPriority;
  actionTemplate: string;
  active: boolean;
  version: number;
  updatedBy: string;
  updatedAt: string;
  auditHistory: BusinessRuleAuditEntry[];
}

export type Mvp3CampaignStatus =
  | CampaignStatus
  | 'Simulated Running'
  | 'Failed';

export interface CampaignAudience {
  tenant_id: string;
  totalMatchedRaw: number;
  deduplicatedCount: number;
  consentVerifiedCount: number;
  optedOutExcluded: number;
  suppressedExcluded: number;
  controlGroupCount: number;
  eligibleReachableCount: number;
  eligibleCustomerIds: string[];
  controlCustomerIds: string[];
}

export interface ApprovalDecision {
  id: string;
  tenant_id: string;
  campaignId: string;
  campaignVersion: number;
  approverName: string;
  approverRole: string;
  decision: 'Approved' | 'Rejected' | 'Requested Revision';
  timestamp: string;
  comments: string;
}

export type CampaignEventStatus =
  | 'Queued'
  | 'Delivered'
  | 'Responded'
  | 'Converted'
  | 'Failed'
  | 'Opted out';

export interface CampaignEvent {
  id: string;
  tenant_id: string;
  campaignId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  regionId: string;
  regionName: string;
  segment: string;
  channel: CampaignChannel;
  status: CampaignEventStatus;
  timestamp: string;
  detail: string;
  simulatedOnly: true;
}

export interface ConversionEvent {
  id: string;
  tenant_id: string;
  campaignId: string;
  customerId: string;
  regionId: string;
  regionName: string;
  segment: string;
  channel: CampaignChannel;
  attributedRevenue: number;
  convertedAt: string;
  isControlGroup: boolean;
}

export interface Campaign extends Omit<CampaignRecord, 'status'> {
  status: Mvp3CampaignStatus;
  version: number;
  businessUnitId: string;
  businessUnitName: string;
  strategy: NbaStrategy;
  channels: CampaignChannel[];
  messageSubject: string;
  messageBody: string;
  minRiskCategory: 'ALL' | RiskCategory;
  minPropensityScore: number;
  includeControlGroup: boolean;
  respectSuppression: boolean;
  respectConsent: boolean;
  audience: CampaignAudience;
  approvalDecisions: ApprovalDecision[];
  requiresReapproval: boolean;
  simulationState: 'idle' | 'running' | 'paused' | 'completed';
  simulationProgressPct: number;
  linkedRecommendationId?: string;
}

export interface ApprovalPolicy {
  tenant_id: string;
  requireApprovalAboveBudgetIdr: number;
  requireReapprovalOnEdit: boolean;
  allowExecutiveOverride: boolean;
  minimumConsentVerification: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface ModelRegistryEntry {
  id: string;
  tenant_id: string;
  industryId: IndustryId;
  modelName: string;
  predictionType: PredictionType;
  version: string;
  status: 'Simulated Demo' | 'Candidate Pending Approval' | 'Validated (Simulated)';
  lastEvaluatedAt: string;
  evaluationSampleSize: number;
  driftIndicator: 'Stable' | 'Watch' | 'Drift Alert (Sim)';
  monitoringScorePct: number;
  featureCompletenessPct: number;
  retrainingStatus: 'Idle' | 'Requested — Pending Approval' | 'Approved for Scheduled Retrain';
  retrainingRequestedBy?: string;
  retrainingRequestedAt?: string;
  retrainingApprovedBy?: string;
  validationStatus: 'Simulated Baseline Only' | 'Pending Governance Sign-Off' | 'Approved for Demo';
  limitations: string[];
  validationNotes: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  tenant_id: string;
  actorName: string;
  actorRole: string;
  category:
    | 'Auth'
    | 'Module Registry'
    | 'Industry Config'
    | 'Prediction'
    | 'Recommendation'
    | 'Business Rules'
    | 'Campaign'
    | 'Approval'
    | 'Simulation'
    | 'Model Governance'
    | 'AI Query'
    | 'System';
  action: string;
  details: string;
}

export interface CampaignDraftWizardState {
  editingCampaignId?: string;
  step: number;
  name: string;
  objective: string;
  strategy: NbaStrategy;
  businessUnitId: string;
  regionId: string;
  targetSegment: string;
  minRiskCategory: 'ALL' | RiskCategory;
  minPropensityScore: number;
  includeControlGroup: boolean;
  respectConsent: boolean;
  respectSuppression: boolean;
  channels: CampaignChannel[];
  messageSubject: string;
  messageBody: string;
  scheduledDate: string;
  budgetAllocated: number;
  linkedRecommendationId?: string;
}

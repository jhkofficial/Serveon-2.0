import type {
  IndustryId,
  IndustryProfile,
  ModuleId,
  UserRoleId,
} from './platform';

// ============================================================
// 1. MULTI-TENANT GOVERNANCE & 9-STEP ONBOARDING
// ============================================================

export type TenantLifecycleStatus =
  | 'Draft'
  | 'Provisioning'
  | 'Active'
  | 'Suspended'
  | 'Archived';

export type SubscriptionPlanId = 'Enterprise Core' | 'Enterprise AI Suite' | 'Multi-BU Sovereign';

export interface TenantAuditHistoryEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  details: string;
  outcome: 'Success' | 'Blocked' | 'Pending Review';
}

export interface TenantSecurityPolicy {
  requireMfaForAdmins: boolean;
  enforceRegionalDataScope: boolean;
  maskCustomerPiiInLists: boolean;
  requireSensitiveActionConfirmation: boolean;
  sessionTimeoutMinutes: number;
  isolationModeNote: 'Browser Demo Simulation (Requires Backend RLS/IAM in Production)';
}

export interface TenantGovernanceRecord {
  tenantId: string;
  status: TenantLifecycleStatus;
  industryProfileId: string;
  industryProfileVersion: number;
  subscriptionPlan: SubscriptionPlanId;
  assignedAdmins: Array<{
    name: string;
    email: string;
    role: UserRoleId;
  }>;
  dataSourceMode: 'Synthetic Demo Dataset' | 'Validated CSV Import' | 'Connector Pending';
  enabledAiUseCaseIds: string[];
  securityPolicy: TenantSecurityPolicy;
  createdAt: string;
  updatedAt: string;
  auditHistory: TenantAuditHistoryEntry[];
}

export interface TenantOnboardingDraft {
  step: number;
  // Step 1: Company Info
  companyName: string;
  shortName: string;
  tenantCode: string;
  provinceTemplateId: 'prov-jateng' | 'prov-jakarta' | 'prov-jabar' | 'prov-bali' | 'prov-jatim';
  subscriptionPlan: SubscriptionPlanId;
  description: string;
  // Step 2: Industry Profile
  industryId: IndustryId;
  industryProfileId: string;
  // Step 3: Business Units & Hierarchy
  businessUnits: Array<{ name: string; code: string }>;
  initialBranches: Array<{ name: string; code: string; regionIndex: number; buIndex: number; type: string }>;
  // Step 4: Modules
  selectedModules: ModuleId[];
  // Step 5: KPIs & Business Rules
  selectedKpiKeys: string[];
  customBusinessRuleNote: string;
  // Step 6: Data Configuration
  dataSourceMode: 'Synthetic Demo Dataset' | 'Validated CSV Import' | 'Connector Pending';
  seedRecordCount: number;
  // Step 7: Users, Roles & Security
  adminName: string;
  adminEmail: string;
  requireMfa: boolean;
  enforceRegionalScope: boolean;
  maskPii: boolean;
  // Step 8: Validation Tracking
  lastValidatedAt?: string;
}

// ============================================================
// 2. INDUSTRY EXTENSION FRAMEWORK & PROFILE BUILDER
// ============================================================

export type IndustryProfileLifecycle = 'Draft' | 'Published' | 'Archived';

export type CanonicalEntityName =
  | 'Tenant'
  | 'Organization'
  | 'User'
  | 'Customer'
  | 'Product'
  | 'Transaction'
  | 'Interaction'
  | 'Location'
  | 'Campaign'
  | 'BusinessEvent';

export interface SchemaExtensionField {
  key: string;
  label: string;
  dataType: 'string' | 'number' | 'date';
  entity: CanonicalEntityName;
  required: boolean;
  description?: string;
}

export interface IndustryProfileVersionRecord {
  version: number;
  status: IndustryProfileLifecycle;
  publishedAt: string;
  publishedBy: string;
  changeSummary: string;
  snapshot: {
    name: string;
    description: string;
    kpiCount: number;
    extensionCount: number;
    ruleCount: number;
  };
}

export interface ManagedIndustryProfile extends IndustryProfile {
  profileId: string;
  baseIndustryId: IndustryId;
  version: number;
  lifecycleStatus: IndustryProfileLifecycle;
  supportedEntities: CanonicalEntityName[];
  optionalEntities: CanonicalEntityName[];
  schemaExtensions: SchemaExtensionField[];
  dashboardWidgets: string[];
  accessRequirements: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  versionHistory: IndustryProfileVersionRecord[];
}

export interface SchemaCompatibilityReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedEntities: number;
  extensionFieldCount: number;
}

// ============================================================
// 3. MODULE MARKETPLACE & DEPENDENCY GRAPH
// ============================================================

export type ModuleAvailabilityStatus =
  | 'Active'
  | 'Inactive'
  | 'Available'
  | 'Missing Dependency'
  | 'Incompatible Version';

export interface ModuleVersionEntry {
  version: string;
  releasedAt: string;
  summary: string;
}

export interface PlatformServiceDependency {
  id: string;
  name: string;
  layer: 'Core Platform' | 'AI Infrastructure' | 'Data & Geo Services' | 'Activation Adapters';
  status: 'Active (Demo Runtime)' | 'Simulated Adapter';
}

export interface MarketplaceModuleCatalogItem {
  moduleId: ModuleId;
  industryCompatibility: IndustryId[] | 'ALL';
  moduleStatus: 'GA' | 'Preview (Governed)' | 'Core Protected';
  serviceDependencies: string[];
  minPlatformVersion: string;
  versionHistory: ModuleVersionEntry[];
}

// ============================================================
// 4. ENTERPRISE DATA INTEGRATION HUB & CSV PIPELINE
// ============================================================

export type ConnectorType =
  | 'CRM'
  | 'ERP'
  | 'Transaction Database'
  | 'CSV / Excel Import'
  | 'REST API'
  | 'Geospatial Data Source'
  | 'External Analytics Source';

export interface DataConnectorConfig {
  id: string;
  tenantId: string;
  name: string;
  type: ConnectorType;
  status: 'Ready (Local CSV Validator)' | 'Not Connected' | 'Demo Seed Active';
  description: string;
  endpointUrlPlaceholder: string;
  authMode: 'OAuth 2.0 (Backend Secret Vault)' | 'Service Account (Server-Side)' | 'Local File Upload' | 'Internal Seed';
  syncCadence: string;
  lastCheckedAt: string;
  notes: string;
}

export interface CsvFieldMapping {
  full_name: string;
  code: string;
  city: string;
  customer_segment: string;
  status: string;
  lifetime_value: string;
  preferred_channel: string;
}

export interface CsvValidationIssue {
  rowNumber: number;
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CsvValidationReport {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningCount: number;
  duplicateCodes: number;
  completenessPct: number;
  issues: CsvValidationIssue[];
  canImport: boolean;
}

export interface CsvImportHistoryRecord {
  id: string;
  tenantId: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  importedRows: number;
  rejectedRows: number;
  qualityScorePct: number;
  status: 'Completed (Synthetic Demo)' | 'Validation Failed';
}

// ============================================================
// 5. ENTERPRISE USERS, SESSIONS & AI GOVERNANCE
// ============================================================

export interface EnterpriseUserAccount {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roleId: UserRoleId;
  businessUnitScope: string;
  regionScope: string;
  status: 'Active' | 'Invited' | 'Suspended';
  mfaEnabled: boolean;
  lastActiveAt: string;
}

export interface ActiveSessionRecord {
  id: string;
  tenantId: string;
  userName: string;
  roleTitle: string;
  authContext: 'Simulated Demo Session';
  startedAt: string;
  scopeSummary: string;
  status: 'Active' | 'Revoked';
}

export type EnterpriseAiModelStatus =
  | 'Draft'
  | 'Under Review'
  | 'Validated'
  | 'Approved'
  | 'Active'
  | 'Deprecated'
  | 'Retired';

export type AiExecutionMode =
  | 'Simulated AI'
  | 'Real Model Inference'
  | 'Gemini-Generated Explanation';

export interface EnterpriseAiModelRecord {
  id: string;
  tenantId: string;
  useCaseId: string;
  useCaseName: string;
  modelName: string;
  version: string;
  industryCompatibility: IndustryId[];
  executionMode: AiExecutionMode;
  status: EnterpriseAiModelStatus;
  approvalStatus: 'Pending Approval' | 'Approved by Governance' | 'Not Submitted';
  evaluationMetrics: {
    primaryMetricLabel: string;
    primaryMetricValue: string;
    calibrationNote: string;
    sampleSize: number;
  };
  owner: string;
  deploymentEnvironment: 'Demo Sandbox' | 'Staging (Simulated)' | 'Production (Not Connected)';
  monitoringStatus: 'Nominal (Sim)' | 'Watch (Sim)' | 'Not Connected';
  lastValidationDate: string;
  limitations: string[];
  approvedBy?: string;
  approvedAt?: string;
}

// ============================================================
// 6. PLATFORM MONITORING & ENTERPRISE READINESS CENTER
// ============================================================

export type MonitoringTimePeriod = '24h' | '7d' | '30d';
export type MonitoringEnvironment = 'All' | 'Demo Sandbox' | 'Staging (Sim)';

export type ReadinessStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Evidence Required'
  | 'Verified'
  | 'Blocked';

export interface ReadinessCheckItem {
  id: string;
  title: string;
  requirement: string;
  status: ReadinessStatus;
  evidenceReference: string;
  owner: string;
  reviewDate: string;
  openIssue: string;
  demoOnlyLimitation: boolean;
}

export interface ReadinessCategory {
  id: string;
  name: string;
  description: string;
  items: ReadinessCheckItem[];
}

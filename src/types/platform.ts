export type IndustryId =
  | 'motorcycle'
  | 'automotive'
  | 'automotive_parts'
  | 'retail'
  | 'banking'
  | 'insurance'
  | 'property'
  | 'healthcare';

export type ModuleId =
  | 'BM01'
  | 'BM02'
  | 'BM03'
  | 'BM04'
  | 'BM05'
  | 'BM06'
  | 'BM07'
  | 'BM08'
  | 'BM09'
  | 'BM10';

export type UserRoleId =
  | 'platform_super_admin'
  | 'tenant_admin'
  | 'executive_management'
  | 'business_manager'
  | 'regional_manager'
  | 'business_analyst'
  | 'campaign_manager'
  | 'branch_operational';

export type PermissionKey =
  | 'dashboard.view'
  | 'customers.view'
  | 'customers.view_detail'
  | 'location.view'
  | 'location.view_precise_customer'
  | 'predictive.view'
  | 'campaigns.view'
  | 'campaigns.create'
  | 'campaigns.approve'
  | 'campaigns.execute_simulated'
  | 'decision.view'
  | 'decision.ai_query'
  | 'performance.view'
  | 'admin.view'
  | 'admin.manage_modules'
  | 'admin.manage_industry'
  | 'admin.manage_tenants'
  | 'admin.view_audit';

export type ScopeLevel = 'platform' | 'tenant' | 'region' | 'branch';

export interface UserPersona {
  id: UserRoleId;
  name: string;
  title: string;
  email: string;
  department: string;
  scopeLevel: ScopeLevel;
  description: string;
  permissions: PermissionKey[];
  canSwitchTenantInDemo: boolean;
  /** Default region index or branch index constraint for scoped demo roles */
  scopedRegionIndex?: number;
  scopedBranchIndex?: number;
}

export interface ModuleDefinition {
  module_id: ModuleId;
  module_name: string;
  short_name: string;
  module_description: string;
  module_version: string;
  enabled: boolean;
  dependencies: ModuleId[];
  required_permissions: PermissionKey[];
  category: 'Core' | 'Intelligence' | 'Activation' | 'Governance';
  configuration: Record<string, string | boolean | number>;
}

export interface IndustryKpiDefinition {
  key: string;
  label: string;
  unit: string;
  formulaDescription: string;
  targetBenchmark: string;
}

export interface IndustryProfile {
  id: IndustryId;
  name: string;
  description: string;
  terminology: {
    customerSingular: string;
    customerPlural: string;
    branchSingular: string;
    branchPlural: string;
    productSingular: string;
    productPlural: string;
    transactionSingular: string;
    transactionPlural: string;
    primaryRevenueLabel: string;
    retentionMetricLabel: string;
  };
  activatedModules: ModuleId[];
  extensionAttributes: Array<{
    key: string;
    label: string;
    dataType: 'string' | 'number' | 'date';
  }>;
  kpiDefinitions: IndustryKpiDefinition[];
  lifecycleStages: string[];
  aiUseCases: Array<{
    id: string;
    title: string;
    modelType: 'Classification' | 'Propensity' | 'Spatial Scoring' | 'Clustering';
    description: string;
  }>;
  dashboardLayoutEmphasis: string;
  businessRules: string[];
  workflowTemplates: Array<{
    name: string;
    trigger: string;
    channel: CampaignChannel;
    approvalRequired: boolean;
  }>;
}

export interface GeoVillage {
  id: string;
  name: string;
  districtId: string;
}

export interface GeoDistrict {
  id: string;
  name: string;
  regencyId: string;
  villages: GeoVillage[];
}

export interface GeoRegency {
  id: string;
  name: string;
  provinceId: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  populationThousands: number;
  marketPotentialIndex: number;
  districts: GeoDistrict[];
}

export interface GeoProvince {
  id: string;
  name: string;
  country: 'Indonesia';
  regencies: GeoRegency[];
}

export interface BranchRecord {
  id: string;
  tenant_id: string;
  business_unit_id: string;
  region_id: string; // Maps to GeoRegency.id
  district_id: string;
  name: string;
  code: string;
  type: string;
  capacityScore: number;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
}

export interface BusinessUnit {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
}

export interface Tenant {
  id: string;
  name: string;
  shortName: string;
  code: string;
  defaultIndustryId: IndustryId;
  primaryProvinceId: string;
  primaryProvinceName: string;
  country: string;
  currency: 'IDR';
  businessUnits: BusinessUnit[];
  branches: BranchRecord[];
  province: GeoProvince;
  seedCount: number;
  description: string;
  defaultModuleConfig?: Partial<Record<ModuleId, Record<string, string | boolean | number>>>;
}

export type RiskCategory = 'Low' | 'Medium' | 'High';

export interface CustomerTransaction {
  transaction_id: string;
  customer_id: string;
  tenant_id: string;
  branch_id: string;
  region_id: string;
  date: string; // YYYY-MM-DD
  amount: number; // IDR
  category: string;
  product_name: string;
  channel: string;
}

export interface CustomerInteraction {
  interaction_id: string;
  customer_id: string;
  date: string;
  channel: CampaignChannel;
  type: string;
  outcome: 'Positive' | 'Neutral' | 'Follow-up Needed';
  summary: string;
}

export interface CustomerProduct {
  product_id: string;
  name: string;
  category: string;
  acquired_date: string;
  status: 'Active' | 'Renewal Due' | 'Inactive';
  value: number;
}

export interface PredictiveFactor {
  factor: string;
  impact: number; // -100 to +100
  direction: 'increases_risk' | 'reduces_risk' | 'increases_propensity';
}

export interface CustomerModelOutputs {
  churn_risk_score: number; // 0-100
  churn_risk_category: RiskCategory;
  purchase_propensity_score: number; // 0-100
  geographic_opportunity_score: number; // 0-100
  recommended_next_best_action: string;
  contributing_factors: PredictiveFactor[];
  model_version: string;
  model_status: 'Illustrative AI Simulation';
  last_evaluated_at: string;
}

export interface CustomerRecord {
  customer_id: string;
  tenant_id: string;
  business_unit_id: string;
  region_id: string;
  district_id: string;
  village_id: string;
  branch_id: string;
  full_name: string;
  code: string;
  status: 'Active' | 'At-Risk' | 'Dormant';
  lifecycle_stage: string;
  customer_segment: 'High-Value Loyal' | 'Growth Potential' | 'Core Active' | 'At-Risk Retention' | 'New Onboarding';
  demographic_attributes: {
    age_band: string;
    city: string;
    district: string;
    village: string;
    preferred_channel: CampaignChannel;
    tenure_months: number;
    email_masked: string;
    phone_masked: string;
  };
  extension_attributes: Record<string, string | number>;
  transactions: CustomerTransaction[];
  interactions: CustomerInteraction[];
  products: CustomerProduct[];
  lifetime_value: number;
  last_activity_date: string;
  model_outputs: CustomerModelOutputs;
}

export type CampaignChannel =
  | 'WhatsApp'
  | 'Email'
  | 'SMS'
  | 'Call Center'
  | 'Branch Follow-up';

export type CampaignStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Scheduled'
  | 'Simulated Execution'
  | 'Simulated Running'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'
  | 'Failed';

export interface CampaignAuditEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  fromStatus?: CampaignStatus;
  toStatus: CampaignStatus;
  note: string;
}

export interface CampaignRecord {
  id: string;
  tenant_id: string;
  name: string;
  objective: string;
  targetSegment: string;
  regionId: string; // 'ALL' or GeoRegency.id
  regionName: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  scheduledDate: string;
  targetAudienceCount: number;
  estimatedConversionRate: number;
  simulatedConversions: number;
  estimatedRevenueImpact: number;
  budgetAllocated: number;
  createdBy: string;
  createdAt: string;
  auditTrail: CampaignAuditEntry[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  actorName: string;
  actorRole: string;
  category:
    | 'Auth'
    | 'Role Management'
    | 'Tenant Governance'
    | 'Organization'
    | 'Module Registry'
    | 'Industry Config'
    | 'Data Integration'
    | 'Prediction'
    | 'Recommendation'
    | 'Business Rules'
    | 'Campaign'
    | 'Approval'
    | 'Simulation'
    | 'Model Governance'
    | 'Enterprise Readiness'
    | 'AI Query'
    | 'System';
  action: string;
  details: string;
  objectRef?: string;
  outcome?: 'Success' | 'Blocked' | 'Pending Review';
}

export type DateRangeKey = '30d' | '90d' | '6m' | '12m';

export interface DashboardFilters {
  regionId: string; // 'ALL' or regency id
  dateRange: DateRangeKey;
  segment: string; // 'ALL' or segment name
}

export interface KpiCardMetric {
  id: string;
  label: string;
  formattedValue: string;
  rawValue: number;
  deltaPct: number;
  deltaLabel: string;
  trendDirection: 'up' | 'down' | 'neutral';
  tone: 'neutral' | 'positive' | 'warning' | 'critical';
  formulaTitle: string;
  formulaDescription: string;
  dataScopeNote: string;
}

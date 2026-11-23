import type {
  AuditLogEntry,
  BranchRecord,
  BusinessUnit,
  CampaignChannel,
  CustomerRecord,
  GeoProvince,
  IndustryId,
  ModuleDefinition,
  ModuleId,
  Tenant,
  UserPersona,
} from '../../types/platform';
import type { Campaign } from '../../types/mvp3';
import type {
  CsvFieldMapping,
  CsvValidationIssue,
  CsvValidationReport,
  EnterpriseAiModelRecord,
  EnterpriseAiModelStatus,
  EnterpriseUserAccount,
  ManagedIndustryProfile,
  MarketplaceModuleCatalogItem,
  ModuleAvailabilityStatus,
  MonitoringEnvironment,
  MonitoringTimePeriod,
  PlatformServiceDependency,
  ReadinessCategory,
  ReadinessCheckItem,
  ReadinessStatus,
  SchemaCompatibilityReport,
  TenantGovernanceRecord,
  TenantOnboardingDraft,
} from '../../types/mvp4';
import {
  DEMO_TENANTS,
  PROVINCE_BALI,
  PROVINCE_JABAR,
  PROVINCE_JAKARTA,
  PROVINCE_JATENG,
  PROVINCE_JATIM,
} from '../../data/mock/tenants';
import { DEFAULT_MODULE_REGISTRY, canEnableModule } from '../module-registry/registry';
import { getIndustryProfile } from '../industry-config/profiles';
import { hasPermission } from '../permissions/rbac';

// ============================================================
// 1. INDONESIAN PROVINCE TEMPLATES FOR MULTI-TENANT PROVISIONING
// ============================================================

export function getProvinceTemplate(
  templateId: TenantOnboardingDraft['provinceTemplateId']
): GeoProvince {
  switch (templateId) {
    case 'prov-jateng':
      return PROVINCE_JATENG;
    case 'prov-jakarta':
      return PROVINCE_JAKARTA;
    case 'prov-jabar':
      return PROVINCE_JABAR;
    case 'prov-bali':
      return PROVINCE_BALI;
    case 'prov-jatim':
      return PROVINCE_JATIM;
    default:
      return PROVINCE_JAKARTA;
  }
}

export const PROVINCE_TEMPLATE_OPTIONS: Array<{
  id: TenantOnboardingDraft['provinceTemplateId'];
  name: string;
  regencyCount: number;
}> = [
  { id: 'prov-jakarta', name: 'DKI Jakarta', regencyCount: 5 },
  { id: 'prov-jateng', name: 'Jawa Tengah', regencyCount: 8 },
  { id: 'prov-jabar', name: 'Jawa Barat', regencyCount: 4 },
  { id: 'prov-bali', name: 'Bali', regencyCount: 5 },
  { id: 'prov-jatim', name: 'Jawa Timur', regencyCount: 3 },
];

// ============================================================
// 2. TENANT ONBOARDING WIZARD ENGINE (9 STEPS)
// ============================================================

export function createTenantOnboardingDraft(
  preset: 'blank' | 'retail_demo' = 'blank'
): TenantOnboardingDraft {
  if (preset === 'retail_demo') {
    return {
      step: 1,
      companyName: 'Karya Retail Nusantara',
      shortName: 'Karya Retail',
      tenantCode: 'KRN-RET',
      provinceTemplateId: 'prov-jakarta',
      subscriptionPlan: 'Enterprise AI Suite',
      description:
        'Omnichannel modern retail, grocery, and lifestyle loyalty network onboarded via SERVEON Enterprise Administration.',
      industryId: 'retail',
      industryProfileId: 'ind-retail',
      businessUnits: [
        { name: 'Flagship Department Stores', code: 'FDS' },
        { name: 'Omnichannel Loyalty & E-Commerce', code: 'OLE' },
      ],
      initialBranches: [
        { name: 'Kemang Flagship Store', code: 'KRN-JKS1', regionIndex: 0, buIndex: 0, type: 'Flagship Retail Store' },
        { name: 'Menteng Urban Market', code: 'KRN-JKP1', regionIndex: 1, buIndex: 0, type: 'Urban Store' },
        { name: 'Kelapa Gading Pickup Hub', code: 'KRN-JKU1', regionIndex: 3, buIndex: 1, type: 'Omnichannel Hub' },
      ],
      selectedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM05', 'BM06', 'BM07', 'BM08', 'BM09', 'BM10'],
      selectedKpiKeys: ['avg_basket_value', 'repeat_purchase_rate', 'loyalty_engagement', 'store_conversion'],
      customBusinessRuleNote: 'Trigger VIP Loyalty Retention voucher when Gold/Platinum shopper is inactive > 40 days.',
      dataSourceMode: 'Synthetic Demo Dataset',
      seedRecordCount: 220,
      adminName: 'Raka Mahendra',
      adminEmail: 'raka.mahendra@karyaretail.demo',
      requireMfa: true,
      enforceRegionalScope: true,
      maskPii: true,
    };
  }

  return {
    step: 1,
    companyName: '',
    shortName: '',
    tenantCode: '',
    provinceTemplateId: 'prov-jakarta',
    subscriptionPlan: 'Enterprise AI Suite',
    description: '',
    industryId: 'retail',
    industryProfileId: 'ind-retail',
    businessUnits: [{ name: 'Core Commercial Unit', code: 'CCU' }],
    initialBranches: [
      { name: 'Main Regional Hub', code: 'BR-01', regionIndex: 0, buIndex: 0, type: 'Regional Flagship' },
    ],
    selectedModules: ['BM01', 'BM02', 'BM03', 'BM04', 'BM08', 'BM10'],
    selectedKpiKeys: ['avg_basket_value', 'repeat_purchase_rate'],
    customBusinessRuleNote: '',
    dataSourceMode: 'Synthetic Demo Dataset',
    seedRecordCount: 180,
    adminName: '',
    adminEmail: '',
    requireMfa: true,
    enforceRegionalScope: true,
    maskPii: true,
  };
}

export interface OnboardingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOnboardingStep(
  draft: TenantOnboardingDraft,
  step: number,
  existingTenants: Tenant[]
): OnboardingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (step === 1 || step === 8) {
    if (!draft.companyName.trim() || draft.companyName.trim().length < 3) {
      errors.push('Company name is required (minimum 3 characters).');
    }
    if (!draft.shortName.trim()) {
      errors.push('Short display name is required.');
    }
    if (!/^[A-Z0-9-]{3,16}$/.test(draft.tenantCode.trim().toUpperCase())) {
      errors.push('Tenant code must be 3–16 alphanumeric/hyphen characters (e.g. KRN-RET).');
    }
    const normalizedCode = draft.tenantCode.trim().toUpperCase();
    if (existingTenants.some((t) => t.code.toUpperCase() === normalizedCode)) {
      errors.push(`Tenant code "${normalizedCode}" is already registered by another tenant.`);
    }
  }

  if (step === 2 || step === 8) {
    if (!draft.industryId) {
      errors.push('An industry profile must be selected.');
    }
  }

  if (step === 3 || step === 8) {
    if (draft.businessUnits.length === 0) {
      errors.push('Configure at least one Business Unit.');
    }
    if (draft.businessUnits.some((bu) => !bu.name.trim() || !bu.code.trim())) {
      errors.push('Every Business Unit must have both a name and a code.');
    }
    if (draft.initialBranches.length === 0) {
      errors.push('Configure at least one operational branch / unit.');
    }
  }

  if (step === 4 || step === 8) {
    if (!draft.selectedModules.includes('BM01')) {
      errors.push('BM01 (Executive Dashboard) is a core platform dependency and must remain enabled.');
    }
    const simModules = DEFAULT_MODULE_REGISTRY.map((m) => ({
      ...m,
      enabled: draft.selectedModules.includes(m.module_id),
    }));
    for (const modId of draft.selectedModules) {
      const check = canEnableModule(simModules, modId);
      if (!check.allowed && check.reason) {
        errors.push(check.reason);
      }
    }
  }

  if (step === 5 || step === 8) {
    if (draft.selectedKpiKeys.length === 0) {
      errors.push('Select at least one industry KPI for the Executive Dashboard.');
    }
  }

  if (step === 6 || step === 8) {
    if (draft.dataSourceMode === 'Synthetic Demo Dataset') {
      if (draft.seedRecordCount < 50 || draft.seedRecordCount > 1000) {
        errors.push('Demo dataset size must be between 50 and 1,000 synthetic records.');
      }
    } else if (draft.dataSourceMode === 'Connector Pending') {
      warnings.push(
        'External connector selected without credentials: tenant will provision in sandbox mode until connector credentials are configured server-side.'
      );
    }
  }

  if (step === 7 || step === 8) {
    if (!draft.adminName.trim()) {
      errors.push('Initial Tenant Administrator full name is required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.adminEmail.trim())) {
      errors.push('A valid Tenant Administrator email address is required.');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export interface ProvisionedTenantBundle {
  ok: boolean;
  error?: string;
  tenant?: Tenant;
  governance?: TenantGovernanceRecord;
  modules?: ModuleDefinition[];
  adminUser?: EnterpriseUserAccount;
}

export function provisionTenantTransaction(
  draft: TenantOnboardingDraft,
  existingTenants: Tenant[],
  actorName: string,
  actorRole: string,
  timestamp: string
): ProvisionedTenantBundle {
  const validation = validateOnboardingStep(draft, 8, existingTenants);
  if (!validation.valid) {
    return { ok: false, error: validation.errors[0] };
  }

  const slug = draft.tenantCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const tenantId = `tenant-${slug}-${Date.now().toString().slice(-4)}`;
  const province = getProvinceTemplate(draft.provinceTemplateId);
  const industry = getIndustryProfile(draft.industryId);

  const businessUnits: BusinessUnit[] = draft.businessUnits.map((bu, idx) => ({
    id: `bu-${slug}-${idx + 1}`,
    tenant_id: tenantId,
    name: bu.name.trim(),
    code: bu.code.trim().toUpperCase(),
  }));

  const branches: BranchRecord[] = draft.initialBranches.map((br, idx) => {
    const regency = province.regencies[br.regionIndex % province.regencies.length] ?? province.regencies[0];
    const district = regency.districts[0];
    const bu = businessUnits[br.buIndex % businessUnits.length] ?? businessUnits[0];
    return {
      id: `br-${slug}-${idx + 1}`,
      tenant_id: tenantId,
      business_unit_id: bu.id,
      region_id: regency.id,
      district_id: district?.id ?? `dist-${slug}-1`,
      name: br.name.trim(),
      code: br.code.trim().toUpperCase(),
      type: br.type.trim() || industry.terminology.branchSingular,
      capacityScore: 78 + ((idx * 7) % 18),
      lat: regency.lat + (idx % 3) * 0.012,
      lng: regency.lng + (idx % 2) * 0.014,
      mapX: regency.mapX,
      mapY: regency.mapY,
    };
  });

  const tenant: Tenant = {
    id: tenantId,
    name: draft.companyName.trim(),
    shortName: draft.shortName.trim(),
    code: draft.tenantCode.trim().toUpperCase(),
    defaultIndustryId: draft.industryId,
    primaryProvinceId: province.id,
    primaryProvinceName: province.name,
    country: 'Indonesia',
    currency: 'IDR',
    seedCount: draft.dataSourceMode === 'Synthetic Demo Dataset' ? draft.seedRecordCount : 120,
    description:
      draft.description.trim() ||
      `${draft.companyName.trim()} configured on SERVEON with the ${industry.name} industry profile.`,
    businessUnits,
    branches,
    province,
  };

  const modules: ModuleDefinition[] = DEFAULT_MODULE_REGISTRY.map((mod) => ({
    ...mod,
    enabled: draft.selectedModules.includes(mod.module_id),
    configuration: { ...mod.configuration },
  }));

  const governance: TenantGovernanceRecord = {
    tenantId,
    status: 'Active',
    industryProfileId: draft.industryProfileId || `ind-${draft.industryId}`,
    industryProfileVersion: 1,
    subscriptionPlan: draft.subscriptionPlan,
    assignedAdmins: [
      {
        name: draft.adminName.trim(),
        email: draft.adminEmail.trim(),
        role: 'tenant_admin',
      },
    ],
    dataSourceMode: draft.dataSourceMode,
    enabledAiUseCaseIds: industry.aiUseCases.map((u) => u.id),
    securityPolicy: {
      requireMfaForAdmins: draft.requireMfa,
      enforceRegionalDataScope: draft.enforceRegionalScope,
      maskCustomerPiiInLists: draft.maskPii,
      requireSensitiveActionConfirmation: true,
      sessionTimeoutMinutes: 30,
      isolationModeNote: 'Browser Demo Simulation (Requires Backend RLS/IAM in Production)',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    auditHistory: [
      {
        id: `ta-${Date.now()}-1`,
        timestamp,
        actorName,
        actorRole,
        action: 'Tenant Provisioned & Activated',
        details: `Provisioned ${tenant.name} (${tenant.code}) with ${industry.name} profile, ${businessUnits.length} business unit(s), ${branches.length} operational unit(s), and ${draft.selectedModules.length} enabled modules.`,
        outcome: 'Success',
      },
    ],
  };

  const adminUser: EnterpriseUserAccount = {
    id: `usr-${slug}-admin`,
    tenantId,
    name: draft.adminName.trim(),
    email: draft.adminEmail.trim(),
    roleId: 'tenant_admin',
    businessUnitScope: 'All Business Units',
    regionScope: `All ${province.name}`,
    status: 'Active',
    mfaEnabled: draft.requireMfa,
    lastActiveAt: timestamp,
  };

  return { ok: true, tenant, governance, modules, adminUser };
}

// ============================================================
// 3. INDUSTRY PROFILE BUILDER, VERSIONING & SCHEMA VALIDATION
// ============================================================

export function validateIndustryProfileSchema(
  profile: ManagedIndustryProfile
): SchemaCompatibilityReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!profile.name.trim()) {
    errors.push('Industry profile name is required.');
  }
  if (!profile.supportedEntities.includes('Tenant') || !profile.supportedEntities.includes('Organization')) {
    errors.push('Canonical entities Tenant and Organization are mandatory for multi-tenant operation.');
  }
  if (profile.kpiDefinitions.length === 0) {
    errors.push('At least one KPI definition is required before publishing.');
  }
  if (profile.lifecycleStages.length < 2) {
    errors.push('At least two lifecycle stages are required.');
  }

  const seenKeys = new Set<string>();
  for (const field of profile.schemaExtensions) {
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(field.key)) {
      errors.push(`Invalid schema extension key "${field.key}". Use lowercase snake_case.`);
    }
    if (seenKeys.has(field.key)) {
      errors.push(`Duplicate extension attribute key "${field.key}".`);
    }
    seenKeys.add(field.key);
    if (!profile.supportedEntities.includes(field.entity) && !profile.optionalEntities.includes(field.entity)) {
      warnings.push(`Extension "${field.key}" references entity "${field.entity}" not listed in supported entities.`);
    }
  }

  if (profile.aiUseCases.length === 0) {
    warnings.push('No AI use-case definitions assigned; Predictive Intelligence will use generic fallback labels.');
  }

  if (profile.baseIndustryId === 'healthcare' || profile.baseIndustryId === 'banking') {
    if (!profile.accessRequirements.some((r) => r.toLowerCase().includes('synthetic') || r.toLowerCase().includes('mask'))) {
      warnings.push('Regulated industry profile should declare PII masking or synthetic-data-only demo access requirements.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedEntities: profile.supportedEntities.length + profile.optionalEntities.length,
    extensionFieldCount: profile.schemaExtensions.length,
  };
}

export function createNextIndustryProfileVersion(
  source: ManagedIndustryProfile,
  actorName: string,
  timestamp: string,
  changeSummary: string
): ManagedIndustryProfile {
  const nextVersion = source.version + 1;
  return {
    ...source,
    version: nextVersion,
    lifecycleStatus: 'Draft',
    updatedAt: timestamp,
    updatedBy: actorName,
    versionHistory: [
      {
        version: source.version,
        status: source.lifecycleStatus,
        publishedAt: source.updatedAt,
        publishedBy: source.updatedBy,
        changeSummary: changeSummary || `Archived snapshot prior to v${nextVersion} draft`,
        snapshot: {
          name: source.name,
          description: source.description,
          kpiCount: source.kpiDefinitions.length,
          extensionCount: source.schemaExtensions.length,
          ruleCount: source.businessRules.length,
        },
      },
      ...source.versionHistory,
    ],
  };
}

export function canDeleteIndustryProfile(
  profile: ManagedIndustryProfile,
  tenants: Tenant[],
  governanceByTenant: Record<string, TenantGovernanceRecord>
): { allowed: boolean; reason?: string } {
  const referencing = tenants.filter((t) => {
    const gov = governanceByTenant[t.id];
    const isActive = !gov || gov.status === 'Active' || gov.status === 'Provisioning' || gov.status === 'Draft';
    return (
      isActive &&
      (gov?.industryProfileId === profile.profileId || t.defaultIndustryId === profile.id)
    );
  });

  if (referencing.length > 0) {
    return {
      allowed: false,
      reason: `Cannot delete "${profile.name}": actively assigned to ${referencing.length} tenant(s) (${referencing
        .map((t) => t.shortName)
        .join(', ')}). Archive or migrate tenants first.`,
    };
  }
  return { allowed: true };
}

// ============================================================
// 4. MODULE MARKETPLACE & DEPENDENCY GRAPH
// ============================================================

export const PLATFORM_SERVICES: PlatformServiceDependency[] = [
  { id: 'svc-identity', name: 'Identity, RBAC & Tenant Core', layer: 'Core Platform', status: 'Active (Demo Runtime)' },
  { id: 'svc-data-foundation', name: 'Canonical Data Foundation', layer: 'Data & Geo Services', status: 'Active (Demo Runtime)' },
  { id: 'svc-geospatial', name: 'Geospatial Data Service (WGS-84)', layer: 'Data & Geo Services', status: 'Active (Demo Runtime)' },
  { id: 'svc-ai-service', name: 'AI Scoring & Gemini Proxy Service', layer: 'AI Infrastructure', status: 'Active (Demo Runtime)' },
  { id: 'svc-workflow', name: 'Workflow & Approval Service', layer: 'Activation Adapters', status: 'Active (Demo Runtime)' },
  { id: 'svc-channel', name: 'Channel Adapter (Sandbox Only)', layer: 'Activation Adapters', status: 'Simulated Adapter' },
];

export const MARKETPLACE_CATALOG: Record<ModuleId, MarketplaceModuleCatalogItem> = {
  BM01: {
    moduleId: 'BM01',
    industryCompatibility: 'ALL',
    moduleStatus: 'Core Protected',
    serviceDependencies: ['svc-identity', 'svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Dynamic industry KPI configuration and cross-tenant executive routing.' },
      { version: '1.0.0', releasedAt: '2026-08-15', summary: 'Initial multi-tenant Executive Dashboard.' },
    ],
  },
  BM02: {
    moduleId: 'BM02',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Industry schema extension support and CSV-imported record federation.' },
      { version: '1.2.0', releasedAt: '2026-09-20', summary: 'Customer 360 lifecycle timelines and segmentation.' },
    ],
  },
  BM03: {
    moduleId: 'BM03',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-geospatial', 'svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Multi-province Indonesian boundary templates and dynamic tenant territories.' },
      { version: '1.2.0', releasedAt: '2026-09-20', summary: 'Interactive Leaflet territory scoring and village drill-down.' },
    ],
  },
  BM04: {
    moduleId: 'BM04',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-ai-service', 'svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'AI Prediction Center + Explainable AI workspace with illustrative attribution.' },
    ],
  },
  BM05: {
    moduleId: 'BM05',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-workflow', 'svc-channel'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: '7-step Campaign Studio, RBAC Approval Inbox, and Sandbox Execution Simulator.' },
    ],
  },
  BM06: {
    moduleId: 'BM06',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-ai-service', 'svc-workflow'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Next-Best-Action Engine (RETAIN/DEFEND/DEVELOP/ACQUIRE) and versioned Business Rules.' },
    ],
  },
  BM07: {
    moduleId: 'BM07',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Event-driven Performance & ROI Intelligence with non-causal control benchmarks.' },
    ],
  },
  BM08: {
    moduleId: 'BM08',
    industryCompatibility: 'ALL',
    moduleStatus: 'Core Protected',
    serviceDependencies: ['svc-ai-service', 'svc-workflow'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Agentic AI Orchestration, continuous learning feedback, and human-approved retraining.' },
    ],
  },
  BM09: {
    moduleId: 'BM09',
    industryCompatibility: 'ALL',
    moduleStatus: 'GA',
    serviceDependencies: ['svc-data-foundation'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Industry Extension Framework and visual versioned Industry Profile Builder.' },
    ],
  },
  BM10: {
    moduleId: 'BM10',
    industryCompatibility: 'ALL',
    moduleStatus: 'Core Protected',
    serviceDependencies: ['svc-identity', 'svc-workflow'],
    minPlatformVersion: '2.0.0',
    versionHistory: [
      { version: '2.0.0', releasedAt: '2026-11-20', summary: 'Enterprise Administration Console, Tenant Onboarding Wizard, Marketplace, and Readiness.' },
    ],
  },
};

export interface ModuleGraphNodeStatus {
  moduleId: ModuleId;
  availability: ModuleAvailabilityStatus;
  missingDependencies: ModuleId[];
  activeDependents: ModuleId[];
  serviceDependencies: PlatformServiceDependency[];
}

export function evaluateModuleGraph(
  modules: ModuleDefinition[]
): Record<ModuleId, ModuleGraphNodeStatus> {
  const result = {} as Record<ModuleId, ModuleGraphNodeStatus>;

  for (const mod of modules) {
    const missingDeps = mod.dependencies.filter((depId) => {
      const dep = modules.find((m) => m.module_id === depId);
      return !dep || !dep.enabled;
    });
    const activeDependents = modules
      .filter((m) => m.enabled && m.dependencies.includes(mod.module_id))
      .map((m) => m.module_id);

    const catalog = MARKETPLACE_CATALOG[mod.module_id];
    const majorPlatformMismatch = !mod.module_version.startsWith('1.') && !mod.module_version.startsWith('2.');

    let availability: ModuleAvailabilityStatus;
    if (majorPlatformMismatch) {
      availability = 'Incompatible Version';
    } else if (mod.enabled) {
      availability = missingDeps.length > 0 ? 'Missing Dependency' : 'Active';
    } else if (missingDeps.length > 0) {
      availability = 'Missing Dependency';
    } else {
      availability = 'Available';
    }

    result[mod.module_id] = {
      moduleId: mod.module_id,
      availability,
      missingDependencies: missingDeps,
      activeDependents,
      serviceDependencies: (catalog?.serviceDependencies ?? [])
        .map((id) => PLATFORM_SERVICES.find((s) => s.id === id))
        .filter((s): s is PlatformServiceDependency => Boolean(s)),
    };
  }

  return result;
}

// ============================================================
// 5. VALIDATED CSV IMPORT WORKFLOW (SYNTHETIC DEMO DATA)
// ============================================================

export const SAMPLE_RETAIL_CSV = `customer_code,full_name,city,segment,status,lifetime_value_idr,preferred_channel,loyalty_tier,avg_basket_items
KRN-IMP-001,Dina Kartika,Jakarta Selatan,High-Value Loyal,Active,18500000,WhatsApp,Platinum VIP,6
KRN-IMP-002,Fikri Ramadhan,Jakarta Pusat,Growth Potential,Active,9200000,Email,Gold Member,4
KRN-IMP-003,Sinta Dewi,Jakarta Barat,At-Risk Retention,At-Risk,12400000,WhatsApp,Gold Member,3
KRN-IMP-004,Hendra Gunawan,Jakarta Utara,Core Active,Active,6800000,SMS,Silver Member,5
KRN-IMP-005,Novianti Putri,Jakarta Timur,New Onboarding,Active,3150000,WhatsApp,Core Member,2`;

export const SAMPLE_AUTOMOTIVE_CSV = `customer_code,full_name,city,segment,status,lifetime_value_idr,preferred_channel,vehicle_model,warranty_status
NMG-IMP-001,Bambang Wibowo,Kota Semarang,High-Value Loyal,Active,342000000,WhatsApp,Nusantara MPV 1.5 Hybrid,Active 3-Yr Factory
NMG-IMP-002,Ratna Sari,Kota Surakarta (Solo),At-Risk Retention,At-Risk,285000000,Call Center,Cakra Compact SUV,Expiring < 90 Days
NMG-IMP-003,Yogi Prasetyo,Kab. Kudus & Pati,Growth Potential,Active,310000000,Branch Follow-up,Surya Executive Sedan,Extended Care Plus`;

export function parseCsvText(rawText: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const cleaned = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { headers: [], rows: [] };

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = values[idx] ?? '';
    });
    rows.push(rec);
  }
  return { headers, rows };
}

const VALID_SEGMENTS: CustomerRecord['customer_segment'][] = [
  'High-Value Loyal',
  'Growth Potential',
  'Core Active',
  'At-Risk Retention',
  'New Onboarding',
];

const VALID_CHANNELS: CampaignChannel[] = [
  'WhatsApp',
  'Email',
  'SMS',
  'Call Center',
  'Branch Follow-up',
];

export function validateAndBuildCsvImport(
  rows: Array<Record<string, string>>,
  mapping: CsvFieldMapping,
  tenant: Tenant,
  existingCustomers: CustomerRecord[]
): {
  report: CsvValidationReport;
  records: CustomerRecord[];
} {
  const issues: CsvValidationIssue[] = [];
  const records: CustomerRecord[] = [];
  const existingCodes = new Set(existingCustomers.map((c) => c.code.toUpperCase()));
  const seenInFile = new Set<string>();
  let duplicateCodes = 0;
  let totalFieldsChecked = 0;
  let nonEmptyFields = 0;

  const industry = getIndustryProfile(tenant.defaultIndustryId);
  const defaultBu = tenant.businessUnits[0]?.id ?? `bu-${tenant.id}-1`;
  const defaultRegency = tenant.province.regencies[0];
  const defaultBranch = tenant.branches[0];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-based header + row
    const name = (row[mapping.full_name] ?? '').trim();
    const code = (row[mapping.code] ?? '').trim().toUpperCase();
    const city = (row[mapping.city] ?? '').trim();
    const segRaw = (row[mapping.customer_segment] ?? '').trim();
    const statusRaw = (row[mapping.status] ?? '').trim();
    const ltvRaw = (row[mapping.lifetime_value] ?? '').trim().replace(/[^0-9.-]/g, '');
    const channelRaw = (row[mapping.preferred_channel] ?? '').trim();

    const vals = [name, code, city, segRaw, statusRaw, ltvRaw, channelRaw];
    totalFieldsChecked += vals.length;
    nonEmptyFields += vals.filter((v) => v.length > 0).length;

    let rowHasError = false;
    if (!name || name.length < 2) {
      issues.push({ rowNumber, field: 'full_name', severity: 'error', message: 'Customer full name is missing or too short.' });
      rowHasError = true;
    }
    if (!code) {
      issues.push({ rowNumber, field: 'code', severity: 'error', message: 'Customer code is required.' });
      rowHasError = true;
    } else if (existingCodes.has(code) || seenInFile.has(code)) {
      duplicateCodes++;
      issues.push({ rowNumber, field: 'code', severity: 'error', message: `Duplicate customer code "${code}" already exists.` });
      rowHasError = true;
    }
    if (!city) {
      issues.push({ rowNumber, field: 'city', severity: 'warning', message: `City blank; will default to ${defaultRegency.name}.` });
    }

    const ltv = Number(ltvRaw);
    if (!ltvRaw || !Number.isFinite(ltv) || ltv < 0) {
      issues.push({ rowNumber, field: 'lifetime_value', severity: 'error', message: `Invalid numeric lifetime value "${row[mapping.lifetime_value] ?? ''}".` });
      rowHasError = true;
    }

    if (rowHasError) return;
    seenInFile.add(code);

    const matchedRegency =
      tenant.province.regencies.find((r) =>
        r.name.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(r.name.toLowerCase())
      ) ?? defaultRegency;
    const matchedDistrict = matchedRegency.districts[0];
    const matchedVillage = matchedDistrict?.villages[0];
    const matchedBranch =
      tenant.branches.find((b) => b.region_id === matchedRegency.id) ?? defaultBranch;

    const segment: CustomerRecord['customer_segment'] = VALID_SEGMENTS.includes(
      segRaw as CustomerRecord['customer_segment']
    )
      ? (segRaw as CustomerRecord['customer_segment'])
      : 'Core Active';
    const status: CustomerRecord['status'] =
      statusRaw === 'At-Risk' || statusRaw === 'Dormant' ? statusRaw : 'Active';
    const channel: CampaignChannel = VALID_CHANNELS.includes(channelRaw as CampaignChannel)
      ? (channelRaw as CampaignChannel)
      : 'WhatsApp';

    const churnScore = status === 'At-Risk' ? 78 : status === 'Dormant' ? 88 : 26;
    const propensityScore = segment === 'Growth Potential' ? 81 : segment === 'High-Value Loyal' ? 74 : 58;

    const extAttrs: Record<string, string | number> = {};
    industry.extensionAttributes.forEach((attr) => {
      if (row[attr.key]) {
        extAttrs[attr.key] = attr.dataType === 'number' ? Number(row[attr.key]) || 0 : row[attr.key];
      }
    });

    records.push({
      customer_id: `cust-csv-${tenant.id}-${code.toLowerCase()}`,
      tenant_id: tenant.id,
      business_unit_id: matchedBranch?.business_unit_id ?? defaultBu,
      region_id: matchedRegency.id,
      district_id: matchedDistrict?.id ?? `dist-${tenant.id}-1`,
      village_id: matchedVillage?.id ?? `vil-${tenant.id}-1`,
      branch_id: matchedBranch?.id ?? `br-${tenant.id}-1`,
      full_name: name,
      code,
      status,
      lifecycle_stage: industry.lifecycleStages[status === 'At-Risk' ? industry.lifecycleStages.length - 1 : 1] ?? 'Active',
      customer_segment: segment,
      demographic_attributes: {
        age_band: '35-44',
        city: matchedRegency.name,
        district: matchedDistrict?.name ?? 'Central District',
        village: matchedVillage?.name ?? 'Central',
        preferred_channel: channel,
        tenure_months: 18,
        email_masked: `${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 4)}***@csv-import.demo`,
        phone_masked: '+62 812-****-9000',
      },
      extension_attributes: extAttrs,
      transactions: [
        {
          transaction_id: `tx-csv-${code.toLowerCase()}-1`,
          customer_id: `cust-csv-${tenant.id}-${code.toLowerCase()}`,
          tenant_id: tenant.id,
          branch_id: matchedBranch?.id ?? `br-${tenant.id}-1`,
          region_id: matchedRegency.id,
          date: '2026-11-12',
          amount: Math.round(ltv * 0.35),
          category: industry.terminology.transactionSingular,
          product_name: `${industry.terminology.productSingular} (Imported CSV)`,
          channel,
        },
      ],
      interactions: [
        {
          interaction_id: `int-csv-${code.toLowerCase()}-1`,
          customer_id: `cust-csv-${tenant.id}-${code.toLowerCase()}`,
          date: '2026-11-15',
          channel,
          type: 'CSV Record Sync',
          outcome: 'Neutral',
          summary: 'Synthetic customer record validated and imported via Data Integration Hub.',
        },
      ],
      products: [
        {
          product_id: `prd-csv-${code.toLowerCase()}-1`,
          name: `${industry.name} Core Plan`,
          category: industry.terminology.productSingular,
          acquired_date: '2025-05-10',
          status: status === 'At-Risk' ? 'Renewal Due' : 'Active',
          value: Math.round(ltv * 0.6),
        },
      ],
      lifetime_value: Math.round(ltv),
      last_activity_date: '2026-11-12',
      model_outputs: {
        churn_risk_score: churnScore,
        churn_risk_category: churnScore >= 70 ? 'High' : churnScore >= 45 ? 'Medium' : 'Low',
        purchase_propensity_score: propensityScore,
        geographic_opportunity_score: matchedRegency.marketPotentialIndex,
        recommended_next_best_action:
          status === 'At-Risk'
            ? `Prioritize ${industry.terminology.retentionMetricLabel} outreach via ${channel}`
            : `Offer ${industry.terminology.productSingular} expansion in ${matchedRegency.name}`,
        contributing_factors: [
          {
            factor: 'Imported Lifecycle & Activity Status',
            impact: status === 'At-Risk' ? 32 : -14,
            direction: status === 'At-Risk' ? 'increases_risk' : 'reduces_risk',
          },
          {
            factor: 'Territory Market Potential',
            impact: 18,
            direction: 'increases_propensity',
          },
        ],
        model_version: 'serveon-sim-v2.1',
        model_status: 'Illustrative AI Simulation',
        last_evaluated_at: '2026-11-20',
      },
    });
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const completenessPct =
    totalFieldsChecked > 0 ? Math.round((nonEmptyFields / totalFieldsChecked) * 100) : 0;

  return {
    report: {
      totalRows: rows.length,
      validRows: records.length,
      errorRows: rows.length - records.length,
      warningCount,
      duplicateCodes,
      completenessPct,
      issues,
      canImport: records.length > 0 && errorCount === 0,
    },
    records,
  };
}

// ============================================================
// 6. ENTERPRISE AI GOVERNANCE LIFECYCLE VALIDATOR
// ============================================================

const ALLOWED_AI_TRANSITIONS: Record<EnterpriseAiModelStatus, EnterpriseAiModelStatus[]> = {
  Draft: ['Under Review', 'Retired'],
  'Under Review': ['Validated', 'Draft'],
  Validated: ['Approved', 'Under Review'],
  Approved: ['Active', 'Deprecated'],
  Active: ['Deprecated', 'Retired'],
  Deprecated: ['Retired', 'Active'],
  Retired: [],
};

export function validateEnterpriseAiTransition(
  model: EnterpriseAiModelRecord,
  nextStatus: EnterpriseAiModelStatus,
  persona: UserPersona
): { allowed: boolean; reason?: string } {
  const validTargets = ALLOWED_AI_TRANSITIONS[model.status] ?? [];
  if (!validTargets.includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Invalid model transition: cannot move directly from ${model.status} to ${nextStatus}.`,
    };
  }
  const canApprove =
    hasPermission(persona, 'admin.manage_tenants') ||
    hasPermission(persona, 'admin.manage_industry');

  if ((nextStatus === 'Approved' || nextStatus === 'Active' || nextStatus === 'Deprecated' || nextStatus === 'Retired') && !canApprove) {
    return {
      allowed: false,
      reason: `Role "${persona.title}" lacks AI Governance approval authority to move models to ${nextStatus}.`,
    };
  }

  if (nextStatus === 'Active' && model.approvalStatus !== 'Approved by Governance') {
    return {
      allowed: false,
      reason: 'Explicit Governance approval is required before switching an active model version.',
    };
  }

  return { allowed: true };
}

// ============================================================
// 7. EVIDENCE-BASED ENTERPRISE READINESS SCORING
// ============================================================

export function validateReadinessItemUpdate(
  item: ReadinessCheckItem,
  nextStatus: ReadinessStatus,
  evidenceReference: string,
  owner: string,
  reviewDate: string
): { allowed: boolean; reason?: string } {
  if (nextStatus === 'Verified') {
    if (item.demoOnlyLimitation) {
      return {
        allowed: false,
        reason:
          'This control currently runs as a browser demo simulation and cannot be marked Verified until production backend infrastructure is audited.',
      };
    }
    if (evidenceReference.trim().length < 6) {
      return {
        allowed: false,
        reason:
          'A checkbox alone cannot mark a control Verified. Provide a verifiable technical evidence reference (e.g. ADR, Pen-Test ID, CI Report).',
      };
    }
    if (!owner.trim() || !reviewDate.trim()) {
      return {
        allowed: false,
        reason: 'Verified controls require both a named Responsible Owner and a Review Date.',
      };
    }
  }
  return { allowed: true };
}

export interface ReadinessScoreSummary {
  totalItems: number;
  verifiedCount: number;
  inProgressCount: number;
  evidenceRequiredCount: number;
  blockedCount: number;
  notStartedCount: number;
  evidenceBackedScorePct: number;
  productionSignOffEligible: boolean;
  categoryScores: Array<{
    categoryId: string;
    name: string;
    total: number;
    verified: number;
    blocked: number;
    scorePct: number;
  }>;
}

export function computeEvidenceBasedReadiness(
  categories: ReadinessCategory[]
): ReadinessScoreSummary {
  let totalItems = 0;
  let verifiedCount = 0;
  let inProgressCount = 0;
  let evidenceRequiredCount = 0;
  let blockedCount = 0;
  let notStartedCount = 0;

  const categoryScores = categories.map((cat) => {
    let catVerified = 0;
    let catBlocked = 0;
    for (const item of cat.items) {
      totalItems++;
      const genuinelyVerified =
        item.status === 'Verified' &&
        !item.demoOnlyLimitation &&
        item.evidenceReference.trim().length >= 6 &&
        item.owner.trim().length > 0 &&
        item.reviewDate.trim().length > 0;

      if (genuinelyVerified) {
        verifiedCount++;
        catVerified++;
      } else if (item.status === 'Blocked') {
        blockedCount++;
        catBlocked++;
      } else if (item.status === 'Evidence Required' || item.status === 'Verified') {
        // Fallback: if status says Verified without evidence, treat strictly as Evidence Required
        evidenceRequiredCount++;
      } else if (item.status === 'In Progress') {
        inProgressCount++;
      } else {
        notStartedCount++;
      }
    }
    return {
      categoryId: cat.id,
      name: cat.name,
      total: cat.items.length,
      verified: catVerified,
      blocked: catBlocked,
      scorePct: cat.items.length > 0 ? Math.round((catVerified / cat.items.length) * 100) : 0,
    };
  });

  const evidenceBackedScorePct =
    totalItems > 0 ? Math.round((verifiedCount / totalItems) * 100) : 0;

  return {
    totalItems,
    verifiedCount,
    inProgressCount,
    evidenceRequiredCount,
    blockedCount,
    notStartedCount,
    evidenceBackedScorePct,
    productionSignOffEligible: blockedCount === 0 && evidenceRequiredCount === 0 && verifiedCount === totalItems && totalItems > 0,
    categoryScores,
  };
}

// ============================================================
// 8. DETERMINISTIC SIMULATED PLATFORM MONITORING
// ============================================================

export interface PlatformMonitoringSnapshot {
  registeredTenants: number;
  activeTenants: number;
  activeModulesTotal: number;
  simulatedApiRequests: number;
  simulatedAiQueries: number;
  simulatedAvgLatencyMs: number;
  simulatedErrorEvents: number;
  auditEventsCount: number;
  series: Array<{ label: string; apiRequests: number; aiCalls: number; errors: number }>;
  backgroundJobs: Array<{
    id: string;
    jobName: string;
    tenantName: string;
    moduleId: ModuleId;
    status: 'Completed (Sim)' | 'Scheduled (Sim)' | 'Awaiting Connector';
    durationLabel: string;
    lastRunAt: string;
  }>;
  externalConnectorsStatus: Array<{
    name: string;
    status: 'Not Connected' | 'Local Sandbox Active';
    note: string;
  }>;
}

export function computePlatformMonitoring(
  tenants: Tenant[],
  governanceByTenant: Record<string, TenantGovernanceRecord>,
  modulesByTenant: Record<string, ModuleDefinition[]>,
  campaignsByTenant: Record<string, Campaign[]>,
  auditLogs: AuditLogEntry[],
  filters: {
    tenantId: string;
    moduleId: 'ALL' | ModuleId;
    period: MonitoringTimePeriod;
    environment: MonitoringEnvironment;
  }
): PlatformMonitoringSnapshot {
  const scopedTenants =
    filters.tenantId === 'ALL'
      ? tenants
      : tenants.filter((t) => t.id === filters.tenantId);

  const activeTenants = scopedTenants.filter(
    (t) => (governanceByTenant[t.id]?.status ?? 'Active') === 'Active'
  ).length;

  let activeModulesTotal = 0;
  scopedTenants.forEach((t) => {
    const mods = modulesByTenant[t.id] ?? DEFAULT_MODULE_REGISTRY;
    activeModulesTotal += mods.filter(
      (m) => m.enabled && (filters.moduleId === 'ALL' || m.module_id === filters.moduleId)
    ).length;
  });

  const periodFactor = filters.period === '24h' ? 1 : filters.period === '7d' ? 6 : 24;
  const envFactor = filters.environment === 'Staging (Sim)' ? 0.45 : 1;
  const baseReqPerBucket = Math.round(
    Math.max(40, scopedTenants.length * 145 + activeModulesTotal * 22) * envFactor
  );

  const labels =
    filters.period === '24h'
      ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']
      : filters.period === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];

  const series = labels.map((label, idx) => {
    const wave = 0.85 + ((idx * 17 + activeModulesTotal) % 35) / 100;
    const apiRequests = Math.round(baseReqPerBucket * periodFactor * wave * 0.25);
    const aiCalls = Math.round(apiRequests * 0.14);
    const errors = idx === 2 ? Math.max(1, Math.round(scopedTenants.length * 0.5)) : 0;
    return { label, apiRequests, aiCalls, errors };
  });

  const simulatedApiRequests = series.reduce((a, s) => a + s.apiRequests, 0);
  const simulatedAiQueries = series.reduce((a, s) => a + s.aiCalls, 0);
  const simulatedErrorEvents = series.reduce((a, s) => a + s.errors, 0);

  const scopedAuditLogs = auditLogs.filter(
    (l) => filters.tenantId === 'ALL' || l.tenantId === filters.tenantId
  );

  const backgroundJobs = scopedTenants.slice(0, 4).flatMap((t) => {
    const campCount = (campaignsByTenant[t.id] ?? []).length;
    return [
      {
        id: `job-score-${t.id}`,
        jobName: 'Deterministic Synthetic Scoring Refresh',
        tenantName: t.shortName,
        moduleId: 'BM04' as ModuleId,
        status: 'Completed (Sim)' as const,
        durationLabel: '0.4s (In-Browser)',
        lastRunAt: '2026-11-20 06:00 WIB',
      },
      {
        id: `job-camp-${t.id}`,
        jobName: `Campaign Attribution Rollup (${campCount} campaigns)`,
        tenantName: t.shortName,
        moduleId: 'BM07' as ModuleId,
        status: 'Completed (Sim)' as const,
        durationLabel: '0.2s (In-Browser)',
        lastRunAt: '2026-11-20 06:15 WIB',
      },
    ];
  }).filter((j) => filters.moduleId === 'ALL' || j.moduleId === filters.moduleId);

  return {
    registeredTenants: scopedTenants.length,
    activeTenants,
    activeModulesTotal,
    simulatedApiRequests,
    simulatedAiQueries,
    simulatedAvgLatencyMs: Math.round(42 + activeModulesTotal * 0.9),
    simulatedErrorEvents,
    auditEventsCount: scopedAuditLogs.length,
    series,
    backgroundJobs,
    externalConnectorsStatus: [
      {
        name: 'Gemini Server-Side Proxy (/api/ai/insights)',
        status: 'Local Sandbox Active',
        note: 'Executes server-side when GEMINI_API_KEY is configured; deterministic fallback otherwise.',
      },
      {
        name: 'External CRM / ERP / Warehouse Connectors',
        status: 'Not Connected',
        note: 'No external production credentials configured; health checks are intentionally not fabricated.',
      },
      {
        name: 'External WhatsApp / SMS / Email Gateways',
        status: 'Not Connected',
        note: 'Outbound messaging is strictly sandboxed to deterministic simulation events.',
      },
    ],
  };
}

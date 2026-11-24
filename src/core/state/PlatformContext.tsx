import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AuditLogEntry,
  BranchRecord,
  BusinessUnit,
  CampaignChannel,
  CampaignStatus,
  CustomerRecord,
  DashboardFilters,
  IndustryId,
  IndustryProfile,
  ModuleDefinition,
  ModuleId,
  RiskCategory,
  Tenant,
  UserPersona,
  UserRoleId,
} from '../../types/platform';
import type {
  ApprovalPolicy,
  BusinessRule,
  Campaign,
  CampaignDraftWizardState,
  CampaignEvent,
  ConversionEvent,
  ModelRegistryEntry,
  Mvp3CampaignStatus,
  PredictionResult,
  Recommendation,
  RecommendationStatus,
  WorkspaceRouteId,
} from '../../types/mvp3';
import type {
  ActiveSessionRecord,
  CsvImportHistoryRecord,
  CsvValidationReport,
  DataConnectorConfig,
  EnterpriseAiModelRecord,
  EnterpriseAiModelStatus,
  EnterpriseUserAccount,
  ManagedIndustryProfile,
  ReadinessCategory,
  ReadinessCheckItem,
  ReadinessStatus,
  TenantGovernanceRecord,
  TenantLifecycleStatus,
  TenantOnboardingDraft,
} from '../../types/mvp4';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { generateTenantDataset } from '../../data/mock/seedGenerator';
import {
  getPersonaById,
  getPermittedBranchIds,
  getPermittedRegionIds,
  hasAllPermissions,
  hasPermission,
} from '../permissions/rbac';
import {
  canDisableModule,
  canEnableModule,
  DEFAULT_MODULE_REGISTRY,
  getAccessibleModules,
} from '../module-registry/registry';
import { getIndustryProfile } from '../industry-config/profiles';
import { computeDashboardAnalytics, type DashboardAnalyticsSnapshot } from '../analytics/kpiEngine';
import {
  buildDefaultBusinessRules,
  buildDefaultModelRegistry,
  buildTenantPredictions,
  computeCampaignAudience,
  computeEventDrivenPerformance,
  generateDeterministicCampaignEvents,
  generateRecommendations,
  validateCampaignTransition,
  type EventDrivenPerformanceSummary,
} from '../ai-engine/mvp3Engine';
import {
  buildAllInitialMvp3State,
  createEmptyWizardDraft,
  MODULE_DEFAULT_ROUTE,
  ROUTE_TO_MODULE,
} from './mvp3SeedState';
import {
  canDeleteIndustryProfile,
  createNextIndustryProfileVersion,
  createTenantOnboardingDraft,
  provisionTenantTransaction,
  validateEnterpriseAiTransition,
  validateIndustryProfileSchema,
  validateReadinessItemUpdate,
} from '../enterprise/mvp4Engine';
import {
  buildAllInitialMvp4State,
  buildConnectorsForTenant,
  buildInitialEnterpriseAiModels,
  buildInitialUsersForTenant,
} from './mvp4SeedState';

const STORAGE_KEY = 'serveon_platform_state_v5';

export const PLATFORM_ONLY_ROUTES: WorkspaceRouteId[] = [
  'ent_overview',
  'ent_tenants',
  'ent_monitoring',
  'ent_readiness',
];

export const ENTERPRISE_ADMIN_ROUTES: WorkspaceRouteId[] = [
  'ent_overview',
  'ent_tenants',
  'ent_org',
  'ent_industries',
  'ent_marketplace',
  'ent_users',
  'ent_integrations',
  'ent_ai_governance',
  'ent_security_audit',
  'ent_monitoring',
  'ent_readiness',
];

interface PersistedPlatformState {
  isAuthenticated: boolean;
  authMode: 'demo' | 'none';
  activeRoleId: UserRoleId;
  activeTenantId: string;
  activeModuleId: ModuleId;
  activeRoute: WorkspaceRouteId;
  tenantIndustryOverrides: Record<string, IndustryId>;
  tenantIndustryProfileOverrides: Record<string, string>;
  tenantModules: Record<string, ModuleDefinition[]>;
  customTenants: Tenant[];
  tenantOrgOverrides: Record<string, { businessUnits: BusinessUnit[]; branches: BranchRecord[] }>;
  tenantGovernanceByTenant: Record<string, TenantGovernanceRecord>;
  onboardingDraft: TenantOnboardingDraft;
  industryProfiles: ManagedIndustryProfile[];
  connectorsByTenant: Record<string, DataConnectorConfig[]>;
  importHistoryByTenant: Record<string, CsvImportHistoryRecord[]>;
  importedCustomersByTenant: Record<string, CustomerRecord[]>;
  usersByTenant: Record<string, EnterpriseUserAccount[]>;
  sessions: ActiveSessionRecord[];
  enterpriseAiModelsByTenant: Record<string, EnterpriseAiModelRecord[]>;
  readinessCategories: ReadinessCategory[];
  campaignsByTenant: Record<string, Campaign[]>;
  eventsByTenant: Record<string, CampaignEvent[]>;
  conversionsByTenant: Record<string, ConversionEvent[]>;
  rulesByTenant: Record<string, BusinessRule[]>;
  modelsByTenant: Record<string, ModelRegistryEntry[]>;
  approvalPoliciesByTenant: Record<string, ApprovalPolicy>;
  recommendationStatusesByTenant: Record<
    string,
    Record<string, { status: RecommendationStatus; linkedCampaignId?: string }>
  >;
  wizardDraftByTenant: Record<string, CampaignDraftWizardState>;
  auditLogs: AuditLogEntry[];
  filters: DashboardFilters;
}

function normalizeTenantModules(
  list?: ModuleDefinition[],
  tenant?: Tenant
): ModuleDefinition[] {
  const existingMap = new Map((list ?? []).map((m) => [m.module_id, m]));
  return DEFAULT_MODULE_REGISTRY.map((base) => {
    const prev = existingMap.get(base.module_id);
    const tenantDefaults = tenant?.defaultModuleConfig?.[base.module_id] ?? {};
    if (!prev) {
      return {
        ...base,
        dependencies: [...base.dependencies],
        required_permissions: [...base.required_permissions],
        configuration: { ...base.configuration, ...tenantDefaults },
      };
    }
    return {
      ...base,
      enabled: prev.enabled,
      dependencies: [...base.dependencies],
      required_permissions: [...base.required_permissions],
      configuration: { ...base.configuration, ...tenantDefaults, ...prev.configuration },
    };
  });
}

function buildDefaultModulesByTenant(): Record<string, ModuleDefinition[]> {
  const map: Record<string, ModuleDefinition[]> = {};
  for (const t of DEMO_TENANTS) {
    map[t.id] = normalizeTenantModules(undefined, t);
  }
  return map;
}

function buildInitialAuditLogs(): AuditLogEntry[] {
  const defaultTenant = DEMO_TENANTS[0];
  return [
    {
      id: 'log-init-0',
      timestamp: '2026-11-21 08:15',
      tenantId: defaultTenant.id,
      actorName: 'Ardian Kusuma',
      actorRole: 'Platform Super Admin',
      category: 'System',
      action: 'Initialized SERVEON V2.0 Enterprise Modular Platform (MVP 4)',
      details:
        'Loaded 10 business modules (BM01–BM10), 8 versioned industry profiles, 6 isolated enterprise demo tenants, Data Integration Hub, and Evidence-Based Readiness Center.',
      objectRef: 'SERVEON-CORE-V2',
      outcome: 'Success',
    },
    {
      id: 'log-init-1',
      timestamp: '2026-11-20 08:30',
      tenantId: defaultTenant.id,
      actorName: 'Ardian Kusuma',
      actorRole: 'Platform Super Admin',
      category: 'System',
      action: 'Initialized 6 Isolated Enterprise Demo Tenants',
      details:
        'Loaded deterministic synthetic datasets for Astra Motor (default), Auto2000, Daihatsu, Bank Saqu, Astralife, and Autopart with tenant-specific industry profiles and module configurations.',
      objectRef: defaultTenant.id,
      outcome: 'Success',
    },
    {
      id: 'log-init-2',
      timestamp: '2026-11-20 09:05',
      tenantId: defaultTenant.id,
      actorName: 'Nadia Pramesti',
      actorRole: 'Tenant Administrator',
      category: 'Model Governance',
      action: 'Verified Simulated AI Model Registry Baseline',
      details:
        'Registered industry-configured simulated models (v2.1/v2.0/v1.8) with human-approval promotion policy and disabled auto-retraining.',
      objectRef: 'serveon-motorcycle-churn-sim',
      outcome: 'Success',
    },
    {
      id: 'log-init-3',
      timestamp: '2026-11-12 09:30',
      tenantId: defaultTenant.id,
      actorName: 'Nadia Pramesti',
      actorRole: 'Tenant Administrator',
      category: 'Approval',
      action: 'Approved campaign ready for simulated dispatch',
      details: 'Approved Kota Semarang Institutional Two-Wheeler Fleet Drive (v1) after consent & suppression verification.',
      objectRef: 'cmp-asm-mc-03',
      outcome: 'Success',
    },
  ];
}

function createInitialPersistedState(): PersistedPlatformState {
  const urlParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const autostart = urlParams?.get('autostart') === '1';
  const mvp3Seed = buildAllInitialMvp3State();
  const mvp4Seed = buildAllInitialMvp4State();

  const wizardDraftByTenant: Record<string, CampaignDraftWizardState> = {};
  for (const t of DEMO_TENANTS) {
    wizardDraftByTenant[t.id] = createEmptyWizardDraft(t);
  }

  return {
    isAuthenticated: autostart,
    authMode: autostart ? 'demo' : 'none',
    activeRoleId: 'platform_super_admin',
    activeTenantId: DEMO_TENANTS[0].id,
    activeModuleId: 'BM01',
    activeRoute: 'executive',
    tenantIndustryOverrides: {},
    tenantIndustryProfileOverrides: {},
    tenantModules: buildDefaultModulesByTenant(),
    customTenants: [],
    tenantOrgOverrides: {},
    tenantGovernanceByTenant: mvp4Seed.tenantGovernanceByTenant,
    onboardingDraft: createTenantOnboardingDraft('blank'),
    industryProfiles: mvp4Seed.industryProfiles,
    connectorsByTenant: mvp4Seed.connectorsByTenant,
    importHistoryByTenant: mvp4Seed.importHistoryByTenant,
    importedCustomersByTenant: {},
    usersByTenant: mvp4Seed.usersByTenant,
    sessions: mvp4Seed.sessions,
    enterpriseAiModelsByTenant: mvp4Seed.enterpriseAiModelsByTenant,
    readinessCategories: mvp4Seed.readinessCategories,
    campaignsByTenant: mvp3Seed.campaignsByTenant,
    eventsByTenant: mvp3Seed.eventsByTenant,
    conversionsByTenant: mvp3Seed.conversionsByTenant,
    rulesByTenant: mvp3Seed.rulesByTenant,
    modelsByTenant: mvp3Seed.modelsByTenant,
    approvalPoliciesByTenant: mvp3Seed.approvalPoliciesByTenant,
    recommendationStatusesByTenant: {},
    wizardDraftByTenant,
    auditLogs: buildInitialAuditLogs(),
    filters: {
      regionId: 'ALL',
      dateRange: '6m',
      segment: 'ALL',
    },
  };
}

function loadPersistedState(): PersistedPlatformState {
  const base = createInitialPersistedState();
  if (typeof window === 'undefined') return base;

  const urlParams = new URLSearchParams(window.location.search);
  const autostart = urlParams.get('autostart') === '1';

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return autostart ? { ...base, isAuthenticated: true, authMode: 'demo' } : base;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedPlatformState>;
    const mergedModules: Record<string, ModuleDefinition[]> = { ...base.tenantModules };
    const knownTenants = [
      ...DEMO_TENANTS,
      ...(Array.isArray(parsed.customTenants) ? parsed.customTenants : []),
    ];
    if (parsed.tenantModules) {
      for (const [tid, list] of Object.entries(parsed.tenantModules)) {
        const tenantObj = knownTenants.find((t) => t.id === tid);
        mergedModules[tid] = normalizeTenantModules(list, tenantObj);
      }
    }
    return {
      ...base,
      ...parsed,
      isAuthenticated: autostart ? true : Boolean(parsed.isAuthenticated),
      authMode: autostart ? 'demo' : parsed.authMode ?? base.authMode,
      activeRoute: parsed.activeRoute ?? base.activeRoute,
      tenantModules: mergedModules,
      customTenants: Array.isArray(parsed.customTenants) ? parsed.customTenants : base.customTenants,
      tenantOrgOverrides: parsed.tenantOrgOverrides ?? base.tenantOrgOverrides,
      tenantGovernanceByTenant: parsed.tenantGovernanceByTenant ?? base.tenantGovernanceByTenant,
      onboardingDraft: parsed.onboardingDraft ?? base.onboardingDraft,
      industryProfiles:
        Array.isArray(parsed.industryProfiles) && parsed.industryProfiles.length > 0
          ? parsed.industryProfiles
          : base.industryProfiles,
      connectorsByTenant: parsed.connectorsByTenant ?? base.connectorsByTenant,
      importHistoryByTenant: parsed.importHistoryByTenant ?? base.importHistoryByTenant,
      importedCustomersByTenant: parsed.importedCustomersByTenant ?? base.importedCustomersByTenant,
      usersByTenant: parsed.usersByTenant ?? base.usersByTenant,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : base.sessions,
      enterpriseAiModelsByTenant:
        parsed.enterpriseAiModelsByTenant ?? base.enterpriseAiModelsByTenant,
      readinessCategories:
        Array.isArray(parsed.readinessCategories) && parsed.readinessCategories.length > 0
          ? parsed.readinessCategories
          : base.readinessCategories,
      campaignsByTenant: parsed.campaignsByTenant ?? base.campaignsByTenant,
      eventsByTenant: parsed.eventsByTenant ?? base.eventsByTenant,
      conversionsByTenant: parsed.conversionsByTenant ?? base.conversionsByTenant,
      rulesByTenant: parsed.rulesByTenant ?? base.rulesByTenant,
      modelsByTenant: parsed.modelsByTenant ?? base.modelsByTenant,
      approvalPoliciesByTenant: parsed.approvalPoliciesByTenant ?? base.approvalPoliciesByTenant,
      recommendationStatusesByTenant:
        parsed.recommendationStatusesByTenant ?? base.recommendationStatusesByTenant,
      wizardDraftByTenant: parsed.wizardDraftByTenant ?? base.wizardDraftByTenant,
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : base.auditLogs,
      filters: parsed.filters ?? base.filters,
    };
  } catch {
    return base;
  }
}

export interface CreateCampaignInput {
  name: string;
  objective: string;
  targetSegment: string;
  regionId: string;
  channel: CampaignChannel;
  scheduledDate: string;
  budgetAllocated: number;
}

export interface RouteAccessEvaluation {
  allowed: boolean;
  reason?: string;
  blockedModuleId?: ModuleId;
  blockedByRole?: boolean;
}

interface PlatformContextValue {
  isAuthenticated: boolean;
  authMode: 'demo' | 'none';
  persona: UserPersona;
  tenants: Tenant[];
  activeTenant: Tenant;
  activeIndustry: IndustryProfile;
  activeManagedIndustryProfile: ManagedIndustryProfile;
  activeModuleId: ModuleId;
  activeRoute: WorkspaceRouteId;
  routeAccess: RouteAccessEvaluation;
  modules: ModuleDefinition[];
  modulesByTenant: Record<string, ModuleDefinition[]>;
  accessibleModules: ModuleDefinition[];
  customers: CustomerRecord[];
  scopedCustomers: CustomerRecord[];
  campaigns: Campaign[];
  campaignsByTenant: Record<string, Campaign[]>;
  campaignEvents: CampaignEvent[];
  conversionEvents: ConversionEvent[];
  predictions: PredictionResult[];
  recommendations: Recommendation[];
  businessRules: BusinessRule[];
  modelRegistry: ModelRegistryEntry[];
  approvalPolicy: ApprovalPolicy;
  eventPerformance: EventDrivenPerformanceSummary;
  wizardDraft: CampaignDraftWizardState;
  auditLogs: AuditLogEntry[];
  filters: DashboardFilters;
  geoDrilldown: { districtId: string; villageId: string };
  customerRiskFilter: 'ALL' | RiskCategory;
  permittedRegionIds: string[];
  permittedBranchIds: string[];
  analytics: DashboardAnalyticsSnapshot;
  aiPanelOpen: boolean;
  selectedCustomerId: string | null;
  selectedPredictionId: string | null;
  selectedCampaignId: string | null;
  pendingCampaignDraft: Partial<CreateCampaignInput> | null;
  toastMessage: string | null;

  // MVP 4 Enterprise Platform State
  tenantGovernanceByTenant: Record<string, TenantGovernanceRecord>;
  onboardingDraft: TenantOnboardingDraft;
  industryProfiles: ManagedIndustryProfile[];
  connectors: DataConnectorConfig[];
  importHistory: CsvImportHistoryRecord[];
  importedCustomersCount: number;
  tenantUsers: EnterpriseUserAccount[];
  sessions: ActiveSessionRecord[];
  enterpriseAiModels: EnterpriseAiModelRecord[];
  readinessCategories: ReadinessCategory[];

  // MVP 1–3 Actions
  enterDemo: (roleId: UserRoleId, tenantId?: string) => void;
  signOut: () => void;
  switchRole: (roleId: UserRoleId) => void;
  switchTenant: (tenantId: string) => void;
  setIndustryOverride: (industryId: IndustryId, profileId?: string) => void;
  navigateToModule: (moduleId: ModuleId) => void;
  navigateToRoute: (routeId: WorkspaceRouteId) => void;
  canAccessRoute: (routeId: WorkspaceRouteId) => RouteAccessEvaluation;
  setFilters: (patch: Partial<DashboardFilters>) => void;
  setGeoDrilldown: (patch: { regionId?: string; districtId?: string; villageId?: string }) => void;
  setCustomerRiskFilter: (risk: 'ALL' | RiskCategory) => void;
  exploreRegionInLocation: (regionId: string) => void;
  openCustomersForTerritorySegment: (opts: {
    regionId?: string;
    districtId?: string;
    villageId?: string;
    segment?: string;
    risk?: 'ALL' | RiskCategory;
  }) => void;
  toggleModule: (moduleId: ModuleId, nextEnabled: boolean) => { ok: boolean; message: string };
  updateModuleConfiguration: (
    moduleId: ModuleId,
    configPatch: Record<string, string | number | boolean>
  ) => { ok: boolean; message: string };
  createCampaign: (input: CreateCampaignInput) => Campaign;
  saveCampaignFromWizard: (
    draft: CampaignDraftWizardState,
    submitImmediately: boolean
  ) => { ok: boolean; campaign?: Campaign; message: string };
  updateWizardDraft: (patch: Partial<CampaignDraftWizardState>) => void;
  resetWizardDraft: () => void;
  loadCampaignIntoWizard: (campaignId: string) => void;
  transitionCampaignStatus: (
    campaignId: string,
    toStatus: Mvp3CampaignStatus,
    note: string
  ) => { ok: boolean; message: string };
  updateApprovalPolicy: (patch: Partial<ApprovalPolicy>) => void;
  updateSimulationProgress: (
    campaignId: string,
    nextState: 'running' | 'paused' | 'completed',
    progressPct: number
  ) => void;
  updateRecommendationStatus: (
    recommendationId: string,
    status: RecommendationStatus,
    linkedCampaignId?: string
  ) => void;
  saveBusinessRule: (
    rule: Omit<BusinessRule, 'id' | 'version' | 'updatedBy' | 'updatedAt' | 'auditHistory'> & {
      id?: string;
      changeNote: string;
    }
  ) => { ok: boolean; message: string };
  toggleBusinessRuleActive: (ruleId: string) => void;
  requestModelRetraining: (modelId: string, reason: string) => void;
  approveModelRetraining: (modelId: string, notes: string) => { ok: boolean; message: string };
  openCampaignComposerFromAction: (draft: Partial<CreateCampaignInput>) => void;
  openCampaignStudioFromRecommendation: (rec: Recommendation) => void;
  openPredictionExplanation: (predictionId: string) => void;
  openCustomerPredictions: (customerId: string) => void;
  openNbaForCustomer: (customerId: string) => void;
  openCampaignInRoute: (
    campaignId: string,
    route: 'campaign_studio' | 'approval_inbox' | 'campaign_ops' | 'performance'
  ) => void;
  clearPendingCampaignDraft: () => void;
  logAuditEvent: (
    category: AuditLogEntry['category'],
    action: string,
    details: string,
    objectRef?: string,
    outcome?: AuditLogEntry['outcome']
  ) => void;
  resetDemoData: () => void;
  setAiPanelOpen: (open: boolean) => void;
  openCustomer360: (customerId: string | null) => void;
  showToast: (msg: string) => void;

  // MVP 4 Actions
  updateOnboardingDraft: (patch: Partial<TenantOnboardingDraft>) => void;
  resetOnboardingDraft: (preset?: 'blank' | 'retail_demo') => void;
  completeTenantOnboarding: () => { ok: boolean; tenant?: Tenant; message: string };
  updateTenantLifecycle: (
    tenantId: string,
    nextStatus: TenantLifecycleStatus,
    note: string
  ) => { ok: boolean; message: string };
  addBusinessUnit: (name: string, code: string) => { ok: boolean; message: string };
  addBranch: (input: {
    name: string;
    code: string;
    businessUnitId: string;
    regionId: string;
    city: string;
  }) => { ok: boolean; message: string };
  saveIndustryProfileDraft: (profile: ManagedIndustryProfile) => { ok: boolean; message: string };
  createIndustryProfileVersion: (
    profileId: string,
    changeSummary: string
  ) => { ok: boolean; profile?: ManagedIndustryProfile; message: string };
  cloneIndustryProfile: (
    sourceProfileId: string,
    newName: string
  ) => { ok: boolean; profile?: ManagedIndustryProfile; message: string };
  publishIndustryProfile: (profileId: string) => { ok: boolean; message: string };
  archiveIndustryProfile: (profileId: string) => { ok: boolean; message: string };
  deleteIndustryProfile: (profileId: string) => { ok: boolean; message: string };
  commitCsvImport: (
    fileName: string,
    records: CustomerRecord[],
    report: CsvValidationReport
  ) => { ok: boolean; message: string };
  addEnterpriseUser: (input: {
    name: string;
    email: string;
    roleId: UserRoleId;
    businessUnitScope: string;
    regionScope: string;
    mfaEnabled: boolean;
  }) => { ok: boolean; message: string };
  toggleEnterpriseUserStatus: (userId: string) => { ok: boolean; message: string };
  revokeSession: (sessionId: string) => { ok: boolean; message: string };
  transitionEnterpriseAiModel: (
    modelId: string,
    nextStatus: EnterpriseAiModelStatus,
    note: string
  ) => { ok: boolean; message: string };
  updateReadinessItem: (
    categoryId: string,
    itemId: string,
    patch: {
      status: ReadinessStatus;
      evidenceReference: string;
      owner: string;
      reviewDate: string;
      openIssue: string;
    }
  ) => { ok: boolean; message: string };
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

function formatNowStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedPlatformState>(() => loadPersistedState());
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [pendingCampaignDraft, setPendingCampaignDraft] =
    useState<Partial<CreateCampaignInput> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [geoDrilldown, setGeoDrilldownState] = useState<{ districtId: string; villageId: string }>({
    districtId: 'ALL',
    villageId: 'ALL',
  });
  const [customerRiskFilter, setCustomerRiskFilter] = useState<'ALL' | RiskCategory>('ALL');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in constrained environments
    }
  }, [state]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3800);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const persona = useMemo(() => getPersonaById(state.activeRoleId), [state.activeRoleId]);

  const allTenants = useMemo(() => {
    const merged = [...DEMO_TENANTS, ...state.customTenants];
    return merged.map((t) => {
      const orgOv = state.tenantOrgOverrides[t.id];
      if (!orgOv) return t;
      return {
        ...t,
        businessUnits: orgOv.businessUnits,
        branches: orgOv.branches,
      };
    });
  }, [state.customTenants, state.tenantOrgOverrides]);

  const activeTenant = useMemo(
    () => allTenants.find((t) => t.id === state.activeTenantId) ?? allTenants[0],
    [allTenants, state.activeTenantId]
  );

  const activeIndustryId =
    state.tenantIndustryOverrides[activeTenant.id] ?? activeTenant.defaultIndustryId;

  const activeManagedIndustryProfile = useMemo(() => {
    const assignedProfileId =
      state.tenantIndustryProfileOverrides[activeTenant.id] ??
      state.tenantGovernanceByTenant[activeTenant.id]?.industryProfileId;
    if (assignedProfileId) {
      const exact = state.industryProfiles.find((p) => p.profileId === assignedProfileId);
      if (exact && !state.tenantIndustryOverrides[activeTenant.id]) return exact;
    }
    const byIndustry = state.industryProfiles.find(
      (p) => p.id === activeIndustryId && p.lifecycleStatus === 'Published'
    );
    return (
      byIndustry ??
      state.industryProfiles.find((p) => p.id === activeIndustryId) ??
      state.industryProfiles[0]
    );
  }, [
    state.industryProfiles,
    state.tenantIndustryProfileOverrides,
    state.tenantGovernanceByTenant,
    state.tenantIndustryOverrides,
    activeTenant.id,
    activeIndustryId,
  ]);

  const activeIndustry: IndustryProfile = useMemo(
    () => activeManagedIndustryProfile ?? getIndustryProfile(activeIndustryId),
    [activeManagedIndustryProfile, activeIndustryId]
  );

  const modules = useMemo(
    () => normalizeTenantModules(state.tenantModules[activeTenant.id], activeTenant),
    [state.tenantModules, activeTenant]
  );

  const accessibleModules = useMemo(
    () => getAccessibleModules(modules, persona),
    [modules, persona]
  );

  const canAccessRoute = useCallback(
    (routeId: WorkspaceRouteId): RouteAccessEvaluation => {
      const parentModId = ROUTE_TO_MODULE[routeId] ?? 'BM01';
      const mod = modules.find((m) => m.module_id === parentModId);
      if (!mod || !mod.enabled) {
        return {
          allowed: false,
          blockedModuleId: parentModId,
          reason: `Module ${parentModId} (${mod?.module_name ?? parentModId}) is currently disabled for ${activeTenant.shortName}. Tenant data remains preserved and will be restored immediately when re-enabled.`,
        };
      }
      if (PLATFORM_ONLY_ROUTES.includes(routeId) && !hasPermission(persona, 'admin.manage_tenants')) {
        return {
          allowed: false,
          blockedByRole: true,
          reason: `Role "${persona.title}" does not have Platform Super Admin authority to access platform-wide administration (${routeId}).`,
        };
      }
      if (!hasAllPermissions(persona, mod.required_permissions)) {
        return {
          allowed: false,
          blockedByRole: true,
          reason: `Role "${persona.title}" lacks required RBAC permissions for ${mod.module_name}.`,
        };
      }
      return { allowed: true };
    },
    [modules, persona, activeTenant.shortName]
  );

  const routeAccess = useMemo(
    () => canAccessRoute(state.activeRoute),
    [canAccessRoute, state.activeRoute]
  );

  const safeActiveModuleId: ModuleId = ROUTE_TO_MODULE[state.activeRoute] ?? 'BM01';

  const baseDataset = useMemo(() => generateTenantDataset(activeTenant), [activeTenant]);
  const importedCustomers = useMemo(
    () => state.importedCustomersByTenant[activeTenant.id] ?? [],
    [state.importedCustomersByTenant, activeTenant.id]
  );
  const allCustomers = useMemo(
    () => [...importedCustomers, ...baseDataset.customers],
    [importedCustomers, baseDataset.customers]
  );

  const campaigns = useMemo(
    () => state.campaignsByTenant[activeTenant.id] ?? [],
    [state.campaignsByTenant, activeTenant.id]
  );
  const campaignEvents = useMemo(
    () => state.eventsByTenant[activeTenant.id] ?? [],
    [state.eventsByTenant, activeTenant.id]
  );
  const conversionEvents = useMemo(
    () => state.conversionsByTenant[activeTenant.id] ?? [],
    [state.conversionsByTenant, activeTenant.id]
  );

  const permittedRegionIds = useMemo(
    () => getPermittedRegionIds(persona, activeTenant),
    [persona, activeTenant]
  );
  const permittedBranchIds = useMemo(
    () => getPermittedBranchIds(persona, activeTenant),
    [persona, activeTenant]
  );

  const effectiveFilters: DashboardFilters = useMemo(() => {
    const validRegion =
      state.filters.regionId === 'ALL' || permittedRegionIds.includes(state.filters.regionId);
    return {
      ...state.filters,
      regionId: validRegion ? state.filters.regionId : 'ALL',
    };
  }, [state.filters, permittedRegionIds]);

  const scopedCustomers = useMemo(() => {
    const regSet = new Set(permittedRegionIds);
    const brSet = new Set(permittedBranchIds);
    return allCustomers.filter((c) => regSet.has(c.region_id) && brSet.has(c.branch_id));
  }, [allCustomers, permittedRegionIds, permittedBranchIds]);

  const businessRules = useMemo(() => {
    const stored = state.rulesByTenant[activeTenant.id];
    if (stored && stored.length > 0 && stored[0].industryId === activeIndustry.id) {
      return stored;
    }
    return buildDefaultBusinessRules(activeTenant.id, activeIndustry.id);
  }, [state.rulesByTenant, activeTenant.id, activeIndustry.id]);

  const modelRegistry = useMemo(() => {
    const stored = state.modelsByTenant[activeTenant.id];
    if (stored && stored.length > 0 && stored[0].industryId === activeIndustry.id) {
      return stored;
    }
    return buildDefaultModelRegistry(activeTenant.id, activeIndustry, allCustomers.length);
  }, [state.modelsByTenant, activeTenant.id, activeIndustry, allCustomers.length]);

  const approvalPolicy = useMemo(() => {
    return (
      state.approvalPoliciesByTenant[activeTenant.id] ?? {
        tenant_id: activeTenant.id,
        requireApprovalAboveBudgetIdr: 0,
        requireReapprovalOnEdit: true,
        allowExecutiveOverride: true,
        minimumConsentVerification: true,
        updatedBy: 'Nadia Pramesti',
        updatedAt: '2026-11-18 09:00',
      }
    );
  }, [state.approvalPoliciesByTenant, activeTenant.id]);

  const wizardDraft = useMemo(
    () => state.wizardDraftByTenant[activeTenant.id] ?? createEmptyWizardDraft(activeTenant),
    [state.wizardDraftByTenant, activeTenant]
  );

  const predictions = useMemo(
    () => buildTenantPredictions(activeTenant, activeIndustry, scopedCustomers),
    [activeTenant, activeIndustry, scopedCustomers]
  );

  const recommendations = useMemo(() => {
    const base = generateRecommendations(activeTenant, activeIndustry, scopedCustomers, businessRules);
    const overrides = state.recommendationStatusesByTenant[activeTenant.id] ?? {};
    return base.map((rec) => {
      const ov = overrides[rec.id];
      return ov ? { ...rec, status: ov.status, linkedCampaignId: ov.linkedCampaignId } : rec;
    });
  }, [
    activeTenant,
    activeIndustry,
    scopedCustomers,
    businessRules,
    state.recommendationStatusesByTenant,
  ]);

  const eventPerformance = useMemo(
    () => computeEventDrivenPerformance(campaigns, campaignEvents, conversionEvents),
    [campaigns, campaignEvents, conversionEvents]
  );

  const analytics = useMemo(
    () =>
      computeDashboardAnalytics({
        tenant: activeTenant,
        industry: activeIndustry,
        allCustomers,
        campaigns,
        permittedRegionIds,
        permittedBranchIds,
        filters: effectiveFilters,
      }),
    [
      activeTenant,
      activeIndustry,
      allCustomers,
      campaigns,
      permittedRegionIds,
      permittedBranchIds,
      effectiveFilters,
    ]
  );

  const connectors = useMemo(
    () => state.connectorsByTenant[activeTenant.id] ?? buildConnectorsForTenant(activeTenant),
    [state.connectorsByTenant, activeTenant]
  );
  const importHistory = useMemo(
    () => state.importHistoryByTenant[activeTenant.id] ?? [],
    [state.importHistoryByTenant, activeTenant.id]
  );
  const tenantUsers = useMemo(
    () => state.usersByTenant[activeTenant.id] ?? buildInitialUsersForTenant(activeTenant),
    [state.usersByTenant, activeTenant]
  );
  const enterpriseAiModels = useMemo(
    () =>
      state.enterpriseAiModelsByTenant[activeTenant.id] ??
      buildInitialEnterpriseAiModels(activeTenant),
    [state.enterpriseAiModelsByTenant, activeTenant]
  );

  const appendAudit = useCallback(
    (
      prev: PersistedPlatformState,
      category: AuditLogEntry['category'],
      action: string,
      details: string,
      roleOverride?: UserPersona,
      objectRef?: string,
      outcome: AuditLogEntry['outcome'] = 'Success'
    ): AuditLogEntry[] => {
      const actor = roleOverride ?? getPersonaById(prev.activeRoleId);
      const entry: AuditLogEntry = {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: formatNowStamp(),
        tenantId: prev.activeTenantId,
        actorName: actor.name,
        actorRole: actor.title,
        category,
        action,
        details,
        objectRef: objectRef ?? prev.activeTenantId,
        outcome,
      };
      return [entry, ...prev.auditLogs].slice(0, 300);
    },
    []
  );

  const logAuditEvent = useCallback(
    (
      category: AuditLogEntry['category'],
      action: string,
      details: string,
      objectRef?: string,
      outcome: AuditLogEntry['outcome'] = 'Success'
    ) => {
      setState((prev) => ({
        ...prev,
        auditLogs: appendAudit(prev, category, action, details, undefined, objectRef, outcome),
      }));
    },
    [appendAudit]
  );

  const enterDemo = useCallback(
    (roleId: UserRoleId, tenantId?: string) => {
      const nextPersona = getPersonaById(roleId);
      setState((prev) => {
        const nextTenantId = tenantId ?? prev.activeTenantId;
        const nextTenant =
          [...DEMO_TENANTS, ...prev.customTenants].find((t) => t.id === nextTenantId) ??
          DEMO_TENANTS[0];
        return {
          ...prev,
          isAuthenticated: true,
          authMode: 'demo',
          activeRoleId: roleId,
          activeTenantId: nextTenant.id,
          activeModuleId: 'BM01',
          activeRoute: 'executive',
          filters: { regionId: 'ALL', dateRange: '6m', segment: 'ALL' },
          auditLogs: appendAudit(
            { ...prev, activeRoleId: roleId, activeTenantId: nextTenant.id },
            'Auth',
            `Entered Demo Workspace as ${nextPersona.title}`,
            `Active tenant: ${nextTenant.name} (${nextPersona.scopeLevel} scope).`,
            nextPersona,
            nextTenant.code
          ),
        };
      });
      setSelectedCustomerId(null);
      setSelectedPredictionId(null);
      showToast(`Demo session started as ${nextPersona.title}`);
    },
    [appendAudit, showToast]
  );

  const signOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      authMode: 'none',
    }));
    setAiPanelOpen(false);
    setSelectedCustomerId(null);
  }, []);

  const switchRole = useCallback(
    (roleId: UserRoleId) => {
      const nextPersona = getPersonaById(roleId);
      setState((prev) => ({
        ...prev,
        activeRoleId: roleId,
        filters: { ...prev.filters, regionId: 'ALL' },
        auditLogs: appendAudit(
          { ...prev, activeRoleId: roleId },
          'Auth',
          `Switched demo persona to ${nextPersona.title}`,
          `Permission scope changed to ${nextPersona.scopeLevel}.`,
          nextPersona,
          roleId
        ),
      }));
      setSelectedCustomerId(null);
      showToast(`Switched active persona to ${nextPersona.title}`);
    },
    [appendAudit, showToast]
  );

  const switchTenant = useCallback(
    (tenantId: string) => {
      const nextTenant = allTenants.find((t) => t.id === tenantId) ?? allTenants[0];
      const gov = state.tenantGovernanceByTenant[nextTenant.id];
      if (gov && gov.status === 'Archived') {
        showToast(`Tenant "${nextTenant.name}" is Archived and read-only; reactivate before entering.`);
        return;
      }
      setState((prev) => ({
        ...prev,
        activeTenantId: nextTenant.id,
        filters: { regionId: 'ALL', dateRange: prev.filters.dateRange, segment: 'ALL' },
        auditLogs: appendAudit(
          { ...prev, activeTenantId: nextTenant.id },
          'System',
          `Switched tenant context to ${nextTenant.name}`,
          `Primary region: ${nextTenant.primaryProvinceName} · Default industry: ${nextTenant.defaultIndustryId}.`,
          undefined,
          nextTenant.code
        ),
      }));
      setSelectedCustomerId(null);
      setSelectedPredictionId(null);
      setSelectedCampaignId(null);
      setGeoDrilldownState({ districtId: 'ALL', villageId: 'ALL' });
      setCustomerRiskFilter('ALL');
      showToast(`Tenant switched to ${nextTenant.name}`);
    },
    [allTenants, state.tenantGovernanceByTenant, appendAudit, showToast]
  );

  const setIndustryOverride = useCallback(
    (industryId: IndustryId, profileId?: string) => {
      const managed =
        (profileId ? state.industryProfiles.find((p) => p.profileId === profileId) : undefined) ??
        state.industryProfiles.find((p) => p.id === industryId);
      const profile = managed ?? getIndustryProfile(industryId);

      setState((prev) => ({
        ...prev,
        tenantIndustryOverrides: {
          ...prev.tenantIndustryOverrides,
          [prev.activeTenantId]: industryId,
        },
        tenantIndustryProfileOverrides: managed
          ? {
              ...prev.tenantIndustryProfileOverrides,
              [prev.activeTenantId]: managed.profileId,
            }
          : prev.tenantIndustryProfileOverrides,
        rulesByTenant: {
          ...prev.rulesByTenant,
          [prev.activeTenantId]: buildDefaultBusinessRules(prev.activeTenantId, industryId),
        },
        modelsByTenant: {
          ...prev.modelsByTenant,
          [prev.activeTenantId]: buildDefaultModelRegistry(
            prev.activeTenantId,
            profile,
            allCustomers.length
          ),
        },
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Applied ${profile.name} Industry Profile`,
          `Updated terminology, KPIs, model profiles, and NBA recommendation rules for active tenant.`,
          undefined,
          managed?.profileId ?? industryId
        ),
      }));
      showToast(`Industry profile set to ${profile.name}`);
    },
    [state.industryProfiles, appendAudit, allCustomers.length, showToast]
  );

  const navigateToRoute = useCallback(
    (routeId: WorkspaceRouteId) => {
      const check = canAccessRoute(routeId);
      if (!check.allowed) {
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(
            prev,
            'Auth',
            `Blocked unauthorized or disabled route access (${routeId})`,
            check.reason ?? 'Route access denied.',
            undefined,
            routeId,
            'Blocked'
          ),
        }));
        showToast(check.reason ?? 'Workspace is disabled or restricted for your current role.');
        return;
      }
      const parentModuleId = ROUTE_TO_MODULE[routeId];
      setState((prev) => ({
        ...prev,
        activeModuleId: parentModuleId,
        activeRoute: routeId,
      }));
      if (routeId !== 'customers') {
        setSelectedCustomerId(null);
      }
    },
    [canAccessRoute, appendAudit, showToast]
  );

  const navigateToModule = useCallback(
    (moduleId: ModuleId) => {
      navigateToRoute(MODULE_DEFAULT_ROUTE[moduleId]);
    },
    [navigateToRoute]
  );

  const setFilters = useCallback((patch: Partial<DashboardFilters>) => {
    setState((prev) => ({
      ...prev,
      filters: { ...prev.filters, ...patch },
    }));
    if (patch.regionId !== undefined) {
      setGeoDrilldownState({ districtId: 'ALL', villageId: 'ALL' });
    }
  }, []);

  const setGeoDrilldown = useCallback(
    (patch: { regionId?: string; districtId?: string; villageId?: string }) => {
      if (patch.regionId !== undefined) {
        setState((prev) => ({
          ...prev,
          filters: { ...prev.filters, regionId: patch.regionId! },
        }));
      }
      setGeoDrilldownState((prev) => ({
        districtId:
          patch.districtId !== undefined
            ? patch.districtId
            : patch.regionId !== undefined
              ? 'ALL'
              : prev.districtId,
        villageId:
          patch.villageId !== undefined
            ? patch.villageId
            : patch.districtId !== undefined || patch.regionId !== undefined
              ? 'ALL'
              : prev.villageId,
      }));
    },
    []
  );

  const exploreRegionInLocation = useCallback(
    (regionId: string) => {
      setGeoDrilldown({ regionId, districtId: 'ALL', villageId: 'ALL' });
      navigateToRoute('location');
    },
    [setGeoDrilldown, navigateToRoute]
  );

  const openCustomersForTerritorySegment = useCallback(
    (opts: {
      regionId?: string;
      districtId?: string;
      villageId?: string;
      segment?: string;
      risk?: 'ALL' | RiskCategory;
    }) => {
      setState((prev) => ({
        ...prev,
        filters: {
          ...prev.filters,
          regionId: opts.regionId ?? prev.filters.regionId,
          segment: opts.segment ?? prev.filters.segment,
        },
      }));
      setGeoDrilldownState((prev) => ({
        districtId: opts.districtId ?? prev.districtId,
        villageId: opts.villageId ?? prev.villageId,
      }));
      setCustomerRiskFilter(opts.risk ?? 'ALL');
      setSelectedCustomerId(null);
      navigateToRoute('customers');
    },
    [navigateToRoute]
  );

  const toggleModule = useCallback(
    (moduleId: ModuleId, nextEnabled: boolean): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_modules')) {
        const msg = 'Admin permission required to activate or deactivate modules.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      const validation = nextEnabled
        ? canEnableModule(modules, moduleId)
        : canDisableModule(modules, moduleId);

      if (!validation.allowed) {
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(
            prev,
            'Module Registry',
            `Blocked module toggle (${moduleId} -> ${nextEnabled ? 'Enable' : 'Disable'})`,
            validation.reason ?? 'Dependency rule blocked this change.',
            undefined,
            moduleId,
            'Blocked'
          ),
        }));
        return { ok: false, message: validation.reason ?? 'Dependency rule blocked this change.' };
      }

      const mod = modules.find((m) => m.module_id === moduleId);
      setState((prev) => {
        const currentList = normalizeTenantModules(
          prev.tenantModules[prev.activeTenantId],
          activeTenant
        );
        const updatedList = currentList.map((m) =>
          m.module_id === moduleId ? { ...m, enabled: nextEnabled } : m
        );
        return {
          ...prev,
          tenantModules: {
            ...prev.tenantModules,
            [prev.activeTenantId]: updatedList,
          },
          auditLogs: appendAudit(
            prev,
            'Module Registry',
            `${nextEnabled ? 'Enabled' : 'Disabled'} ${moduleId} — ${mod?.short_name ?? moduleId}`,
            `Navigation and route access updated for ${activeTenant.shortName}. Tenant data preserved.`,
            undefined,
            moduleId
          ),
        };
      });
      const msg = `${moduleId} (${mod?.short_name}) ${nextEnabled ? 'enabled' : 'disabled'} for ${activeTenant.shortName}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, modules, appendAudit, activeTenant.shortName, showToast]
  );

  const updateModuleConfiguration = useCallback(
    (
      moduleId: ModuleId,
      configPatch: Record<string, string | number | boolean>
    ): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_modules')) {
        const msg = 'Admin permission required to configure modules.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      setState((prev) => {
        const currentList = normalizeTenantModules(
          prev.tenantModules[prev.activeTenantId],
          activeTenant
        );
        const updatedList = currentList.map((m) =>
          m.module_id === moduleId
            ? { ...m, configuration: { ...m.configuration, ...configPatch } }
            : m
        );
        return {
          ...prev,
          tenantModules: {
            ...prev.tenantModules,
            [prev.activeTenantId]: updatedList,
          },
          auditLogs: appendAudit(
            prev,
            'Module Registry',
            `Updated per-tenant configuration for ${moduleId}`,
            `Applied tenant-isolated settings (${Object.keys(configPatch).join(', ')}) for ${activeTenant.shortName}.`,
            undefined,
            moduleId
          ),
        };
      });
      const msg = `Saved tenant-specific configuration for ${moduleId}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant.shortName, appendAudit, showToast]
  );

  // ============================================================
  // MVP 4 ACTIONS: ONBOARDING, ORG, INDUSTRY BUILDER, CSV, USERS, AI GOV, READINESS
  // ============================================================

  const updateOnboardingDraft = useCallback((patch: Partial<TenantOnboardingDraft>) => {
    setState((prev) => ({
      ...prev,
      onboardingDraft: { ...prev.onboardingDraft, ...patch },
    }));
  }, []);

  const resetOnboardingDraft = useCallback((preset: 'blank' | 'retail_demo' = 'blank') => {
    setState((prev) => ({
      ...prev,
      onboardingDraft: createTenantOnboardingDraft(preset),
    }));
    if (preset === 'retail_demo') {
      showToast('Loaded Retail Cross-Industry Business Demo preset into 9-Step Onboarding Wizard');
    }
  }, [showToast]);

  const completeTenantOnboarding = useCallback((): {
    ok: boolean;
    tenant?: Tenant;
    message: string;
  } => {
    if (!hasPermission(persona, 'admin.manage_tenants')) {
      const msg = 'Only Platform Super Administrators can provision new enterprise tenants.';
      showToast(msg);
      return { ok: false, message: msg };
    }
    const stamp = formatNowStamp();
    const res = provisionTenantTransaction(
      state.onboardingDraft,
      allTenants,
      persona.name,
      persona.title,
      stamp
    );
    if (!res.ok || !res.tenant || !res.governance || !res.modules || !res.adminUser) {
      const msg = res.error ?? 'Tenant onboarding validation failed.';
      showToast(msg);
      return { ok: false, message: msg };
    }

    const { tenant, governance, modules: newModules, adminUser } = res;
    const initialUsers = [adminUser, ...buildInitialUsersForTenant(tenant).slice(1)];
    const indProfile =
      state.industryProfiles.find((p) => p.profileId === governance.industryProfileId) ??
      getIndustryProfile(tenant.defaultIndustryId);

    setState((prev) => ({
      ...prev,
      customTenants: [...prev.customTenants, tenant],
      tenantGovernanceByTenant: {
        ...prev.tenantGovernanceByTenant,
        [tenant.id]: governance,
      },
      tenantModules: {
        ...prev.tenantModules,
        [tenant.id]: normalizeTenantModules(newModules, tenant),
      },
      tenantIndustryProfileOverrides: {
        ...prev.tenantIndustryProfileOverrides,
        [tenant.id]: governance.industryProfileId,
      },
      connectorsByTenant: {
        ...prev.connectorsByTenant,
        [tenant.id]: buildConnectorsForTenant(tenant),
      },
      importHistoryByTenant: {
        ...prev.importHistoryByTenant,
        [tenant.id]: [],
      },
      usersByTenant: {
        ...prev.usersByTenant,
        [tenant.id]: initialUsers,
      },
      enterpriseAiModelsByTenant: {
        ...prev.enterpriseAiModelsByTenant,
        [tenant.id]: buildInitialEnterpriseAiModels(tenant),
      },
      campaignsByTenant: {
        ...prev.campaignsByTenant,
        [tenant.id]: [],
      },
      eventsByTenant: {
        ...prev.eventsByTenant,
        [tenant.id]: [],
      },
      conversionsByTenant: {
        ...prev.conversionsByTenant,
        [tenant.id]: [],
      },
      rulesByTenant: {
        ...prev.rulesByTenant,
        [tenant.id]: buildDefaultBusinessRules(tenant.id, tenant.defaultIndustryId),
      },
      modelsByTenant: {
        ...prev.modelsByTenant,
        [tenant.id]: buildDefaultModelRegistry(tenant.id, indProfile, tenant.seedCount),
      },
      approvalPoliciesByTenant: {
        ...prev.approvalPoliciesByTenant,
        [tenant.id]: {
          tenant_id: tenant.id,
          requireApprovalAboveBudgetIdr: 0,
          requireReapprovalOnEdit: true,
          allowExecutiveOverride: true,
          minimumConsentVerification: true,
          updatedBy: persona.name,
          updatedAt: stamp,
        },
      },
      wizardDraftByTenant: {
        ...prev.wizardDraftByTenant,
        [tenant.id]: createEmptyWizardDraft(tenant),
      },
      onboardingDraft: createTenantOnboardingDraft('blank'),
      auditLogs: appendAudit(
        prev,
        'Tenant Governance',
        `Provisioned & Activated Tenant "${tenant.name}" (${tenant.code})`,
        `Industry: ${indProfile.name} · Province: ${tenant.primaryProvinceName} · BUs: ${tenant.businessUnits.length} · Branches: ${tenant.branches.length} · Seed records: ${tenant.seedCount}.`,
        undefined,
        tenant.code
      ),
    }));

    const msg = `Tenant "${tenant.name}" (${tenant.code}) provisioned and activated!`;
    showToast(msg);
    return { ok: true, tenant, message: msg };
  }, [persona, state.onboardingDraft, state.industryProfiles, allTenants, appendAudit, showToast]);

  const updateTenantLifecycle = useCallback(
    (
      tenantId: string,
      nextStatus: TenantLifecycleStatus,
      note: string
    ): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_tenants')) {
        const msg = 'Only Platform Super Admin can change tenant lifecycle states.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      if (tenantId === activeTenant.id && (nextStatus === 'Suspended' || nextStatus === 'Archived')) {
        const msg = 'Switch to another active tenant before suspending or archiving the currently open tenant.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      const target = allTenants.find((t) => t.id === tenantId);
      if (!target) return { ok: false, message: 'Tenant not found.' };
      const stamp = formatNowStamp();

      setState((prev) => {
        const existingGov = prev.tenantGovernanceByTenant[tenantId];
        if (!existingGov) return prev;
        const updatedGov: TenantGovernanceRecord = {
          ...existingGov,
          status: nextStatus,
          updatedAt: stamp,
          auditHistory: [
            {
              id: `tg-aud-${Date.now()}`,
              timestamp: stamp,
              actorName: persona.name,
              actorRole: persona.title,
              action: `Lifecycle changed to ${nextStatus}`,
              details: note || `Updated by ${persona.title}.`,
              outcome: 'Success',
            },
            ...existingGov.auditHistory,
          ],
        };
        return {
          ...prev,
          tenantGovernanceByTenant: {
            ...prev.tenantGovernanceByTenant,
            [tenantId]: updatedGov,
          },
          auditLogs: appendAudit(
            prev,
            'Tenant Governance',
            `Tenant "${target.name}" status -> ${nextStatus}`,
            note || `Lifecycle updated by Platform Super Admin.`,
            undefined,
            target.code
          ),
        };
      });
      const msg = `Tenant "${target.shortName}" moved to ${nextStatus}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant.id, allTenants, appendAudit, showToast]
  );

  const addBusinessUnit = useCallback(
    (name: string, code: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required to add Business Units.' };
      }
      if (!name.trim() || !code.trim()) {
        return { ok: false, message: 'Business Unit name and code are required.' };
      }
      const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const newBu: BusinessUnit = {
        id: `bu-${activeTenant.id}-${Date.now().toString().slice(-4)}`,
        tenant_id: activeTenant.id,
        name: name.trim(),
        code: cleanCode,
      };
      setState((prev) => ({
        ...prev,
        tenantOrgOverrides: {
          ...prev.tenantOrgOverrides,
          [activeTenant.id]: {
            businessUnits: [...activeTenant.businessUnits, newBu],
            branches: activeTenant.branches,
          },
        },
        auditLogs: appendAudit(
          prev,
          'Organization',
          `Added Business Unit "${newBu.name}" (${newBu.code})`,
          `Scoped strictly to ${activeTenant.name}.`,
          undefined,
          newBu.code
        ),
      }));
      const msg = `Business Unit "${newBu.name}" added to ${activeTenant.shortName}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant, appendAudit, showToast]
  );

  const addBranch = useCallback(
    (input: {
      name: string;
      code: string;
      businessUnitId: string;
      regionId: string;
      city: string;
    }): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required to add Branches.' };
      }
      if (!input.name.trim() || !input.code.trim()) {
        return { ok: false, message: 'Branch name and code are required.' };
      }
      const reg =
        activeTenant.province.regencies.find((r) => r.id === input.regionId) ??
        activeTenant.province.regencies[0];
      const newBranch: BranchRecord = {
        id: `br-${activeTenant.id}-${Date.now().toString().slice(-4)}`,
        tenant_id: activeTenant.id,
        business_unit_id: input.businessUnitId || activeTenant.businessUnits[0]?.id,
        region_id: reg.id,
        district_id: reg.districts[0]?.id ?? `dist-${activeTenant.id}-1`,
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        type: input.city.trim() || activeIndustry.terminology.branchSingular,
        capacityScore: 84,
        lat: reg.lat + 0.015,
        lng: reg.lng + 0.015,
        mapX: reg.mapX,
        mapY: reg.mapY,
      };
      setState((prev) => ({
        ...prev,
        tenantOrgOverrides: {
          ...prev.tenantOrgOverrides,
          [activeTenant.id]: {
            businessUnits: activeTenant.businessUnits,
            branches: [...activeTenant.branches, newBranch],
          },
        },
        auditLogs: appendAudit(
          prev,
          'Organization',
          `Added Operational Unit "${newBranch.name}" (${newBranch.code})`,
          `Assigned to region ${reg.name} under ${activeTenant.name}.`,
          undefined,
          newBranch.code
        ),
      }));
      const msg = `Operational Unit "${newBranch.name}" created in ${reg.name}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant, appendAudit, showToast]
  );

  const saveIndustryProfileDraft = useCallback(
    (profile: ManagedIndustryProfile): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        return { ok: false, message: 'Industry configuration permission required.' };
      }
      if (profile.lifecycleStatus === 'Published') {
        return {
          ok: false,
          message:
            'Published industry profiles are immutable. Create a new Draft version (v+1) before editing.',
        };
      }
      const stamp = formatNowStamp();
      const updatedProfile: ManagedIndustryProfile = {
        ...profile,
        extensionAttributes: profile.schemaExtensions.map((s) => ({
          key: s.key,
          label: s.label,
          dataType: s.dataType,
        })),
        updatedAt: stamp,
        updatedBy: `${persona.name} (${persona.title})`,
      };
      setState((prev) => {
        const exists = prev.industryProfiles.some((p) => p.profileId === profile.profileId);
        const nextList = exists
          ? prev.industryProfiles.map((p) => (p.profileId === profile.profileId ? updatedProfile : p))
          : [updatedProfile, ...prev.industryProfiles];
        return {
          ...prev,
          industryProfiles: nextList,
          auditLogs: appendAudit(
            prev,
            'Industry Config',
            `Saved Draft Industry Profile "${updatedProfile.name}" (v${updatedProfile.version})`,
            `KPIs: ${updatedProfile.kpiDefinitions.length} · Schema extensions: ${updatedProfile.schemaExtensions.length}.`,
            undefined,
            updatedProfile.profileId
          ),
        };
      });
      const msg = `Saved Draft "${updatedProfile.name}" (v${updatedProfile.version})`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, appendAudit, showToast]
  );

  const createIndustryProfileVersion = useCallback(
    (
      profileId: string,
      changeSummary: string
    ): { ok: boolean; profile?: ManagedIndustryProfile; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        return { ok: false, message: 'Industry configuration permission required.' };
      }
      const target = state.industryProfiles.find((p) => p.profileId === profileId);
      if (!target) return { ok: false, message: 'Industry profile not found.' };
      const next = createNextIndustryProfileVersion(
        target,
        `${persona.name} (${persona.title})`,
        formatNowStamp(),
        changeSummary
      );
      setState((prev) => ({
        ...prev,
        industryProfiles: prev.industryProfiles.map((p) => (p.profileId === profileId ? next : p)),
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Created v${next.version} Draft for "${next.name}"`,
          changeSummary || `Branched immutable v${target.version} into editable v${next.version} draft.`,
          undefined,
          next.profileId
        ),
      }));
      const msg = `Created editable Draft v${next.version} for "${next.name}"`;
      showToast(msg);
      return { ok: true, profile: next, message: msg };
    },
    [persona, state.industryProfiles, appendAudit, showToast]
  );

  const cloneIndustryProfile = useCallback(
    (
      sourceProfileId: string,
      newName: string
    ): { ok: boolean; profile?: ManagedIndustryProfile; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        return { ok: false, message: 'Industry configuration permission required.' };
      }
      const source = state.industryProfiles.find((p) => p.profileId === sourceProfileId);
      if (!source) return { ok: false, message: 'Source profile not found.' };
      const stamp = formatNowStamp();
      const cloned: ManagedIndustryProfile = {
        ...source,
        profileId: `ind-custom-${Date.now().toString().slice(-5)}`,
        name: newName.trim() || `${source.name} Custom`,
        version: 1,
        lifecycleStatus: 'Draft',
        createdAt: stamp,
        updatedAt: stamp,
        updatedBy: `${persona.name} (${persona.title})`,
        versionHistory: [
          {
            version: 1,
            status: 'Draft',
            publishedAt: stamp,
            publishedBy: `${persona.name} (${persona.title})`,
            changeSummary: `Cloned from ${source.name} (v${source.version})`,
            snapshot: {
              name: newName.trim() || `${source.name} Custom`,
              description: source.description,
              kpiCount: source.kpiDefinitions.length,
              extensionCount: source.schemaExtensions.length,
              ruleCount: source.businessRules.length,
            },
          },
        ],
      };
      setState((prev) => ({
        ...prev,
        industryProfiles: [cloned, ...prev.industryProfiles],
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Cloned Industry Profile "${cloned.name}" from ${source.name}`,
          `Created custom editable Draft v1 (${cloned.profileId}).`,
          undefined,
          cloned.profileId
        ),
      }));
      const msg = `Cloned "${cloned.name}" as Draft v1`;
      showToast(msg);
      return { ok: true, profile: cloned, message: msg };
    },
    [persona, state.industryProfiles, appendAudit, showToast]
  );

  const publishIndustryProfile = useCallback(
    (profileId: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        return { ok: false, message: 'Industry configuration permission required.' };
      }
      const target = state.industryProfiles.find((p) => p.profileId === profileId);
      if (!target) return { ok: false, message: 'Industry profile not found.' };

      const schemaCheck = validateIndustryProfileSchema(target);
      if (!schemaCheck.valid) {
        const msg = `Schema validation failed: ${schemaCheck.errors.join(' ')}`;
        showToast(msg);
        return { ok: false, message: msg };
      }

      const stamp = formatNowStamp();
      const published: ManagedIndustryProfile = {
        ...target,
        lifecycleStatus: 'Published',
        updatedAt: stamp,
        updatedBy: `${persona.name} (${persona.title})`,
        versionHistory: [
          {
            version: target.version,
            status: 'Published',
            publishedAt: stamp,
            publishedBy: `${persona.name} (${persona.title})`,
            changeSummary: `Validated and published v${target.version} (${schemaCheck.extensionFieldCount} extensions checked).`,
            snapshot: {
              name: target.name,
              description: target.description,
              kpiCount: target.kpiDefinitions.length,
              extensionCount: target.schemaExtensions.length,
              ruleCount: target.businessRules.length,
            },
          },
          ...target.versionHistory.filter((h) => !(h.version === target.version && h.status === 'Draft')),
        ],
      };

      setState((prev) => ({
        ...prev,
        industryProfiles: prev.industryProfiles.map((p) =>
          p.profileId === profileId ? published : p
        ),
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Published Industry Profile "${published.name}" (v${published.version})`,
          `Passed schema compatibility check (${schemaCheck.checkedEntities} canonical entities, ${schemaCheck.extensionFieldCount} extensions).`,
          undefined,
          published.profileId
        ),
      }));
      const msg = `Published "${published.name}" v${published.version}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, state.industryProfiles, appendAudit, showToast]
  );

  const archiveIndustryProfile = useCallback(
    (profileId: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        return { ok: false, message: 'Industry configuration permission required.' };
      }
      const target = state.industryProfiles.find((p) => p.profileId === profileId);
      if (!target) return { ok: false, message: 'Profile not found.' };
      const stamp = formatNowStamp();
      setState((prev) => ({
        ...prev,
        industryProfiles: prev.industryProfiles.map((p) =>
          p.profileId === profileId
            ? { ...p, lifecycleStatus: 'Archived', updatedAt: stamp, updatedBy: persona.name }
            : p
        ),
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Archived Industry Profile "${target.name}" (v${target.version})`,
          `Profile archived; existing tenant references remain preserved for historical auditability.`,
          undefined,
          target.profileId
        ),
      }));
      const msg = `Archived "${target.name}"`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, state.industryProfiles, appendAudit, showToast]
  );

  const deleteIndustryProfile = useCallback(
    (profileId: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_tenants')) {
        return { ok: false, message: 'Only Platform Super Admin can delete industry profiles.' };
      }
      const target = state.industryProfiles.find((p) => p.profileId === profileId);
      if (!target) return { ok: false, message: 'Profile not found.' };
      const check = canDeleteIndustryProfile(target, allTenants, state.tenantGovernanceByTenant);
      if (!check.allowed) {
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(
            prev,
            'Industry Config',
            `Blocked deletion of active Industry Profile "${target.name}"`,
            check.reason ?? 'Referenced by active tenant.',
            undefined,
            target.profileId,
            'Blocked'
          ),
        }));
        showToast(check.reason ?? 'Cannot delete active industry profile.');
        return { ok: false, message: check.reason ?? 'Cannot delete active industry profile.' };
      }

      setState((prev) => ({
        ...prev,
        industryProfiles: prev.industryProfiles.filter((p) => p.profileId !== profileId),
        auditLogs: appendAudit(
          prev,
          'Industry Config',
          `Deleted unreferenced Industry Profile "${target.name}"`,
          `Removed custom profile ${target.profileId}.`,
          undefined,
          target.profileId
        ),
      }));
      const msg = `Deleted industry profile "${target.name}"`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, state.industryProfiles, state.tenantGovernanceByTenant, allTenants, appendAudit, showToast]
  );

  const commitCsvImport = useCallback(
    (
      fileName: string,
      records: CustomerRecord[],
      report: CsvValidationReport
    ): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required to import tenant datasets.' };
      }
      if (!report.canImport || records.length === 0) {
        return {
          ok: false,
          message: 'Resolve all validation errors before confirming CSV import.',
        };
      }
      const stamp = formatNowStamp();
      const historyEntry: CsvImportHistoryRecord = {
        id: `imp-${Date.now()}`,
        tenantId: activeTenant.id,
        fileName,
        importedAt: stamp,
        importedBy: `${persona.name} (${persona.title})`,
        totalRows: report.totalRows,
        importedRows: records.length,
        rejectedRows: report.errorRows,
        qualityScorePct: report.completenessPct,
        status: 'Completed (Synthetic Demo)',
      };

      setState((prev) => ({
        ...prev,
        importedCustomersByTenant: {
          ...prev.importedCustomersByTenant,
          [activeTenant.id]: [...records, ...(prev.importedCustomersByTenant[activeTenant.id] ?? [])],
        },
        importHistoryByTenant: {
          ...prev.importHistoryByTenant,
          [activeTenant.id]: [historyEntry, ...(prev.importHistoryByTenant[activeTenant.id] ?? [])],
        },
        auditLogs: appendAudit(
          prev,
          'Data Integration',
          `Imported ${records.length} validated CSV customer records (${fileName})`,
          `Completeness: ${report.completenessPct}% · Duplicates blocked: ${report.duplicateCodes} · Scoped strictly to ${activeTenant.shortName}.`,
          undefined,
          historyEntry.id
        ),
      }));

      const msg = `Imported ${records.length} verified records into ${activeTenant.shortName} Customer Intelligence`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant, appendAudit, showToast]
  );

  const addEnterpriseUser = useCallback(
    (input: {
      name: string;
      email: string;
      roleId: UserRoleId;
      businessUnitScope: string;
      regionScope: string;
      mfaEnabled: boolean;
    }): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required to add users.' };
      }
      if (!input.name.trim() || !input.email.includes('@')) {
        return { ok: false, message: 'Provide a valid full name and email address.' };
      }
      if (input.roleId === 'platform_super_admin' && !hasPermission(persona, 'admin.manage_tenants')) {
        return {
          ok: false,
          message: 'Tenant Administrators cannot assign Platform Super Admin role.',
        };
      }
      const newUser: EnterpriseUserAccount = {
        id: `usr-${activeTenant.id}-${Date.now().toString().slice(-4)}`,
        tenantId: activeTenant.id,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        roleId: input.roleId,
        businessUnitScope: input.businessUnitScope || 'All Business Units',
        regionScope: input.regionScope || `All ${activeTenant.primaryProvinceName}`,
        status: 'Invited',
        mfaEnabled: input.mfaEnabled,
        lastActiveAt: 'Pending first login',
      };
      setState((prev) => ({
        ...prev,
        usersByTenant: {
          ...prev.usersByTenant,
          [activeTenant.id]: [newUser, ...tenantUsers],
        },
        auditLogs: appendAudit(
          prev,
          'Auth',
          `Provisioned demo user "${newUser.name}" (${newUser.roleId})`,
          `Scope: ${newUser.businessUnitScope} / ${newUser.regionScope} in ${activeTenant.shortName}.`,
          undefined,
          newUser.email
        ),
      }));
      const msg = `Added ${newUser.name} to ${activeTenant.shortName}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant, tenantUsers, appendAudit, showToast]
  );

  const toggleEnterpriseUserStatus = useCallback(
    (userId: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required.' };
      }
      const target = tenantUsers.find((u) => u.id === userId);
      if (!target) return { ok: false, message: 'User not found.' };
      const nextStatus: EnterpriseUserAccount['status'] =
        target.status === 'Suspended' ? 'Active' : 'Suspended';
      setState((prev) => ({
        ...prev,
        usersByTenant: {
          ...prev.usersByTenant,
          [activeTenant.id]: tenantUsers.map((u) =>
            u.id === userId ? { ...u, status: nextStatus } : u
          ),
        },
        auditLogs: appendAudit(
          prev,
          'Auth',
          `${nextStatus === 'Suspended' ? 'Suspended' : 'Reactivated'} user "${target.name}"`,
          `Account ${target.email} status updated to ${nextStatus}.`,
          undefined,
          target.email
        ),
      }));
      const msg = `${target.name} marked as ${nextStatus}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, activeTenant.id, tenantUsers, appendAudit, showToast]
  );

  const revokeSession = useCallback(
    (sessionId: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.view')) {
        return { ok: false, message: 'Administrator permission required.' };
      }
      const target = state.sessions.find((s) => s.id === sessionId);
      if (!target) return { ok: false, message: 'Session not found.' };
      setState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, status: 'Revoked' } : s
        ),
        auditLogs: appendAudit(
          prev,
          'Auth',
          `Revoked demo session for ${target.userName} (${target.roleTitle})`,
          `Session ${sessionId} terminated by ${persona.title}.`,
          undefined,
          sessionId
        ),
      }));
      const msg = `Revoked session ${sessionId}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, state.sessions, appendAudit, showToast]
  );

  const transitionEnterpriseAiModel = useCallback(
    (
      modelId: string,
      nextStatus: EnterpriseAiModelStatus,
      note: string
    ): { ok: boolean; message: string } => {
      const target = enterpriseAiModels.find((m) => m.id === modelId);
      if (!target) return { ok: false, message: 'Model record not found.' };
      const check = validateEnterpriseAiTransition(target, nextStatus, persona);
      if (!check.allowed) {
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(
            prev,
            'Model Governance',
            `Blocked AI Model transition (${target.modelName} -> ${nextStatus})`,
            check.reason ?? 'Governance gate blocked transition.',
            undefined,
            target.modelName,
            'Blocked'
          ),
        }));
        showToast(check.reason ?? 'Transition blocked.');
        return { ok: false, message: check.reason ?? 'Transition blocked.' };
      }

      const stamp = formatNowStamp();
      const updated = enterpriseAiModels.map((m) => {
        if (m.id !== modelId) return m;
        return {
          ...m,
          status: nextStatus,
          approvalStatus:
            nextStatus === 'Approved' || nextStatus === 'Active'
              ? ('Approved by Governance' as const)
              : nextStatus === 'Under Review' || nextStatus === 'Validated'
                ? ('Pending Approval' as const)
                : m.approvalStatus,
          approvedBy:
            nextStatus === 'Approved' ? `${persona.name} (${persona.title})` : m.approvedBy,
          approvedAt: nextStatus === 'Approved' ? stamp : m.approvedAt,
          lastValidationDate: stamp.slice(0, 10),
        };
      });

      setState((prev) => ({
        ...prev,
        enterpriseAiModelsByTenant: {
          ...prev.enterpriseAiModelsByTenant,
          [activeTenant.id]: updated,
        },
        auditLogs: appendAudit(
          prev,
          'Model Governance',
          `AI Model "${target.modelName}" (${target.version}) -> ${nextStatus}`,
          note || `Governed lifecycle transition approved by ${persona.title}.`,
          undefined,
          `${target.modelName}@${target.version}`
        ),
      }));

      const msg = `${target.modelName} transitioned to ${nextStatus}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [enterpriseAiModels, persona, activeTenant.id, appendAudit, showToast]
  );

  const updateReadinessItem = useCallback(
    (
      categoryId: string,
      itemId: string,
      patch: {
        status: ReadinessStatus;
        evidenceReference: string;
        owner: string;
        reviewDate: string;
        openIssue: string;
      }
    ): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_tenants')) {
        return {
          ok: false,
          message: 'Only Platform Super Admin can update Enterprise Readiness assessments.',
        };
      }
      const cat = state.readinessCategories.find((c) => c.id === categoryId);
      const item = cat?.items.find((i) => i.id === itemId);
      if (!cat || !item) return { ok: false, message: 'Readiness item not found.' };

      const check = validateReadinessItemUpdate(
        item,
        patch.status,
        patch.evidenceReference,
        patch.owner,
        patch.reviewDate
      );
      if (!check.allowed) {
        setState((prev) => ({
          ...prev,
          auditLogs: appendAudit(
            prev,
            'Enterprise Readiness',
            `Blocked invalid Readiness verification for "${item.title}"`,
            check.reason ?? 'Evidence gate failed.',
            undefined,
            item.id,
            'Blocked'
          ),
        }));
        showToast(check.reason ?? 'Evidence required before verification.');
        return { ok: false, message: check.reason ?? 'Evidence required.' };
      }

      setState((prev) => ({
        ...prev,
        readinessCategories: prev.readinessCategories.map((c) =>
          c.id !== categoryId
            ? c
            : {
                ...c,
                items: c.items.map((i): ReadinessCheckItem =>
                  i.id !== itemId ? i : { ...i, ...patch }
                ),
              }
        ),
        auditLogs: appendAudit(
          prev,
          'Enterprise Readiness',
          `Updated Readiness Control "${item.title}" -> ${patch.status}`,
          patch.evidenceReference
            ? `Evidence: ${patch.evidenceReference} · Owner: ${patch.owner}`
            : `Status: ${patch.status} · Open issue: ${patch.openIssue || 'None'}`,
          undefined,
          item.id
        ),
      }));
      const msg = `Readiness control "${item.title}" updated to ${patch.status}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, state.readinessCategories, appendAudit, showToast]
  );

  // ============================================================
  // MVP 3 CAMPAIGN, RULE, MODEL & JOURNEY ACTIONS (PRESERVED)
  // ============================================================

  const updateWizardDraft = useCallback(
    (patch: Partial<CampaignDraftWizardState>) => {
      setState((prev) => {
        const current =
          prev.wizardDraftByTenant[prev.activeTenantId] ?? createEmptyWizardDraft(activeTenant);
        return {
          ...prev,
          wizardDraftByTenant: {
            ...prev.wizardDraftByTenant,
            [prev.activeTenantId]: { ...current, ...patch },
          },
        };
      });
    },
    [activeTenant]
  );

  const resetWizardDraft = useCallback(() => {
    setState((prev) => ({
      ...prev,
      wizardDraftByTenant: {
        ...prev.wizardDraftByTenant,
        [prev.activeTenantId]: createEmptyWizardDraft(activeTenant),
      },
    }));
  }, [activeTenant]);

  const loadCampaignIntoWizard = useCallback(
    (campaignId: string) => {
      const target = campaigns.find((c) => c.id === campaignId);
      if (!target) return;
      updateWizardDraft({
        editingCampaignId: target.id,
        step: 1,
        name: target.name,
        objective: target.objective,
        strategy: target.strategy,
        businessUnitId: target.businessUnitId,
        regionId: target.regionId,
        targetSegment: target.targetSegment,
        minRiskCategory: target.minRiskCategory,
        minPropensityScore: target.minPropensityScore,
        includeControlGroup: target.includeControlGroup,
        respectConsent: target.respectConsent,
        respectSuppression: target.respectSuppression,
        channels: target.channels.length > 0 ? target.channels : [target.channel],
        messageSubject: target.messageSubject,
        messageBody: target.messageBody,
        scheduledDate: target.scheduledDate,
        budgetAllocated: target.budgetAllocated,
        linkedRecommendationId: target.linkedRecommendationId,
      });
      navigateToRoute('campaign_studio');
    },
    [campaigns, updateWizardDraft, navigateToRoute]
  );

  const saveCampaignFromWizard = useCallback(
    (
      draft: CampaignDraftWizardState,
      submitImmediately: boolean
    ): { ok: boolean; campaign?: Campaign; message: string } => {
      if (!hasPermission(persona, 'campaigns.create')) {
        const msg = `Role "${persona.title}" does not have permission to create or edit campaigns.`;
        showToast(msg);
        return { ok: false, message: msg };
      }

      const audience = computeCampaignAudience(scopedCustomers, {
        tenantId: activeTenant.id,
        businessUnitId: draft.businessUnitId,
        regionId: draft.regionId,
        targetSegment: draft.targetSegment,
        minRiskCategory: draft.minRiskCategory,
        minPropensityScore: draft.minPropensityScore,
        respectConsent: draft.respectConsent,
        respectSuppression: draft.respectSuppression,
        includeControlGroup: draft.includeControlGroup,
      });

      if (submitImmediately && audience.eligibleReachableCount === 0) {
        const msg = 'Cannot submit campaign with 0 eligible reachable customers.';
        showToast(msg);
        return { ok: false, message: msg };
      }

      const regionName =
        draft.regionId === 'ALL'
          ? `All ${activeTenant.primaryProvinceName}`
          : activeTenant.province.regencies.find((r) => r.id === draft.regionId)?.name ??
            draft.regionId;

      const buName =
        draft.businessUnitId === 'ALL'
          ? 'All Business Units'
          : activeTenant.businessUnits.find((b) => b.id === draft.businessUnitId)?.name ??
            draft.businessUnitId;

      const primaryChannel: CampaignChannel = draft.channels[0] ?? 'WhatsApp';
      const estRate =
        primaryChannel === 'Branch Follow-up'
          ? 21.0
          : primaryChannel === 'WhatsApp'
            ? 16.5
            : primaryChannel === 'Call Center'
              ? 14.8
              : primaryChannel === 'Email'
                ? 11.4
                : 9.8;

      const existing = draft.editingCampaignId
        ? campaigns.find((c) => c.id === draft.editingCampaignId)
        : undefined;

      const wasApprovedOrScheduled =
        existing && (existing.status === 'Approved' || existing.status === 'Scheduled');

      const nextVersion = existing ? existing.version + 1 : 1;
      const nextStatus: Mvp3CampaignStatus = submitImmediately
        ? 'Pending Approval'
        : wasApprovedOrScheduled && approvalPolicy.requireReapprovalOnEdit
          ? 'Pending Approval'
          : 'Draft';

      const stamp = formatNowStamp();
      const savedCampaign: Campaign = {
        id: existing?.id ?? `cmp-${activeTenant.code.toLowerCase()}-${Date.now().toString().slice(-4)}`,
        tenant_id: activeTenant.id,
        name: draft.name.trim(),
        objective: draft.objective.trim(),
        strategy: draft.strategy,
        businessUnitId: draft.businessUnitId,
        businessUnitName: buName,
        targetSegment: draft.targetSegment,
        regionId: draft.regionId,
        regionName,
        channel: primaryChannel,
        channels: draft.channels.length > 0 ? draft.channels : [primaryChannel],
        messageSubject: draft.messageSubject.trim() || `${draft.name.trim()} — Exclusive Offer`,
        messageBody:
          draft.messageBody.trim() ||
          `${draft.objective.trim()} (Simulated enterprise campaign copy.)`,
        minRiskCategory: draft.minRiskCategory,
        minPropensityScore: draft.minPropensityScore,
        includeControlGroup: draft.includeControlGroup,
        respectConsent: draft.respectConsent,
        respectSuppression: draft.respectSuppression,
        status: nextStatus,
        version: nextVersion,
        scheduledDate: draft.scheduledDate,
        targetAudienceCount: audience.eligibleReachableCount,
        estimatedConversionRate: estRate,
        simulatedConversions: existing?.simulatedConversions ?? 0,
        estimatedRevenueImpact: Math.round(
          audience.eligibleReachableCount * (estRate / 100) * 6_500_000
        ),
        budgetAllocated: draft.budgetAllocated,
        createdBy: existing?.createdBy ?? persona.name,
        createdAt: existing?.createdAt ?? stamp.slice(0, 10),
        audience,
        approvalDecisions: existing?.approvalDecisions ?? [],
        requiresReapproval: Boolean(wasApprovedOrScheduled),
        simulationState: 'idle',
        simulationProgressPct: 0,
        linkedRecommendationId: draft.linkedRecommendationId,
        auditTrail: [
          ...(existing?.auditTrail ?? []),
          {
            id: `ca-${Date.now()}`,
            timestamp: stamp,
            actorName: persona.name,
            actorRole: persona.title,
            action: existing
              ? wasApprovedOrScheduled
                ? `Edited approved campaign (v${nextVersion}) — Reapproval required`
                : `Updated campaign (v${nextVersion})`
              : submitImmediately
                ? 'Created & submitted campaign for approval'
                : 'Saved campaign draft',
            fromStatus: existing?.status,
            toStatus: nextStatus as CampaignStatus,
            note: wasApprovedOrScheduled
              ? `Approved campaign modified; moved back to Pending Approval (v${nextVersion}) per governance policy.`
              : `Eligible reachable: ${audience.eligibleReachableCount} (${audience.optedOutExcluded} opt-out, ${audience.suppressedExcluded} suppressed).`,
          },
        ],
      };

      setState((prev) => {
        const current = prev.campaignsByTenant[prev.activeTenantId] ?? [];
        const nextList = existing
          ? current.map((c) => (c.id === existing.id ? savedCampaign : c))
          : [savedCampaign, ...current];

        const nextRecOverrides = {
          ...(prev.recommendationStatusesByTenant[prev.activeTenantId] ?? {}),
        };
        if (draft.linkedRecommendationId) {
          nextRecOverrides[draft.linkedRecommendationId] = {
            status: 'Converted to Campaign',
            linkedCampaignId: savedCampaign.id,
          };
        }

        return {
          ...prev,
          campaignsByTenant: {
            ...prev.campaignsByTenant,
            [prev.activeTenantId]: nextList,
          },
          recommendationStatusesByTenant: {
            ...prev.recommendationStatusesByTenant,
            [prev.activeTenantId]: nextRecOverrides,
          },
          wizardDraftByTenant: {
            ...prev.wizardDraftByTenant,
            [prev.activeTenantId]: createEmptyWizardDraft(activeTenant),
          },
          auditLogs: appendAudit(
            prev,
            'Campaign',
            existing
              ? `Updated "${savedCampaign.name}" (v${nextVersion}) -> ${nextStatus}`
              : `Created "${savedCampaign.name}" -> ${nextStatus}`,
            `Reachable: ${audience.eligibleReachableCount} · Channels: ${savedCampaign.channels.join(', ')} · Budget IDR ${(savedCampaign.budgetAllocated / 1_000_000).toFixed(1)}M.`,
            undefined,
            savedCampaign.id
          ),
        };
      });

      setSelectedCampaignId(savedCampaign.id);
      const msg = wasApprovedOrScheduled
        ? `Campaign v${nextVersion} modified — reapproval required before execution`
        : submitImmediately
          ? `Campaign "${savedCampaign.name}" submitted for approval`
          : `Campaign "${savedCampaign.name}" saved as Draft`;
      showToast(msg);
      return { ok: true, campaign: savedCampaign, message: msg };
    },
    [
      persona,
      scopedCustomers,
      activeTenant,
      campaigns,
      approvalPolicy.requireReapprovalOnEdit,
      appendAudit,
      showToast,
    ]
  );

  const createCampaign = useCallback(
    (input: CreateCampaignInput): Campaign => {
      const draft: CampaignDraftWizardState = {
        ...createEmptyWizardDraft(activeTenant),
        name: input.name,
        objective: input.objective,
        targetSegment: input.targetSegment,
        regionId: input.regionId,
        channels: [input.channel],
        scheduledDate: input.scheduledDate,
        budgetAllocated: input.budgetAllocated,
      };
      const res = saveCampaignFromWizard(draft, false);
      return res.campaign ?? campaigns[0];
    },
    [activeTenant, saveCampaignFromWizard, campaigns]
  );

  const transitionCampaignStatus = useCallback(
    (
      campaignId: string,
      toStatus: Mvp3CampaignStatus,
      note: string
    ): { ok: boolean; message: string } => {
      const target = campaigns.find((c) => c.id === campaignId);
      if (!target) return { ok: false, message: 'Campaign not found.' };

      const validation = validateCampaignTransition(target, toStatus, persona);
      if (!validation.allowed) {
        const msg = validation.reason ?? 'Unauthorized or invalid status transition.';
        showToast(msg);
        return { ok: false, message: msg };
      }

      const stamp = formatNowStamp();
      const isApprovalDecision = toStatus === 'Approved' || toStatus === 'Rejected';

      setState((prev) => {
        const current = prev.campaignsByTenant[prev.activeTenantId] ?? [];
        let updatedEvents = prev.eventsByTenant[prev.activeTenantId] ?? [];
        let updatedConversions = prev.conversionsByTenant[prev.activeTenantId] ?? [];

        const updatedList = current.map((c) => {
          if (c.id !== campaignId) return c;

          let nextProgress = c.simulationProgressPct;
          let nextSimState = c.simulationState;
          let nextSimConversions = c.simulatedConversions;
          let nextEstRevenue = c.estimatedRevenueImpact;

          if (toStatus === 'Simulated Running' || toStatus === 'Simulated Execution') {
            nextProgress = Math.max(35, c.simulationProgressPct);
            nextSimState = 'running';
            const sim = generateDeterministicCampaignEvents(c, allCustomers, nextProgress);
            updatedEvents = [...updatedEvents.filter((e) => e.campaignId !== c.id), ...sim.events];
            updatedConversions = [
              ...updatedConversions.filter((cv) => cv.campaignId !== c.id),
              ...sim.conversions,
            ];
            const treatConvs = sim.conversions.filter((cv) => !cv.isControlGroup);
            nextSimConversions = treatConvs.length;
            nextEstRevenue = treatConvs.reduce((a, cv) => a + cv.attributedRevenue, 0);
          } else if (toStatus === 'Completed') {
            nextProgress = 100;
            nextSimState = 'completed';
            const sim = generateDeterministicCampaignEvents(c, allCustomers, 100);
            updatedEvents = [...updatedEvents.filter((e) => e.campaignId !== c.id), ...sim.events];
            updatedConversions = [
              ...updatedConversions.filter((cv) => cv.campaignId !== c.id),
              ...sim.conversions,
            ];
            const treatConvs = sim.conversions.filter((cv) => !cv.isControlGroup);
            nextSimConversions = treatConvs.length;
            nextEstRevenue = treatConvs.reduce((a, cv) => a + cv.attributedRevenue, 0);
          }

          return {
            ...c,
            status: toStatus,
            requiresReapproval: toStatus === 'Approved' ? false : c.requiresReapproval,
            simulationState: nextSimState,
            simulationProgressPct: nextProgress,
            simulatedConversions: nextSimConversions,
            estimatedRevenueImpact: nextEstRevenue,
            approvalDecisions: isApprovalDecision
              ? [
                  {
                    id: `apdec-${Date.now()}`,
                    tenant_id: c.tenant_id,
                    campaignId: c.id,
                    campaignVersion: c.version,
                    approverName: persona.name,
                    approverRole: persona.title,
                    decision: (toStatus === 'Approved' ? 'Approved' : 'Rejected') as
                      | 'Approved'
                      | 'Rejected',
                    timestamp: stamp,
                    comments: note,
                  },
                  ...c.approvalDecisions,
                ]
              : c.approvalDecisions,
            auditTrail: [
              ...c.auditTrail,
              {
                id: `ca-${Date.now()}`,
                timestamp: stamp,
                actorName: persona.name,
                actorRole: persona.title,
                action: `Moved to ${toStatus} (v${c.version})`,
                fromStatus: c.status as CampaignStatus,
                toStatus: toStatus as CampaignStatus,
                note,
              },
            ],
          };
        });

        return {
          ...prev,
          campaignsByTenant: {
            ...prev.campaignsByTenant,
            [prev.activeTenantId]: updatedList,
          },
          eventsByTenant: {
            ...prev.eventsByTenant,
            [prev.activeTenantId]: updatedEvents,
          },
          conversionsByTenant: {
            ...prev.conversionsByTenant,
            [prev.activeTenantId]: updatedConversions,
          },
          auditLogs: appendAudit(
            prev,
            isApprovalDecision
              ? 'Approval'
              : toStatus === 'Simulated Running'
                ? 'Simulation'
                : 'Campaign',
            `Campaign "${target.name}" (v${target.version}) -> ${toStatus}`,
            note,
            undefined,
            target.id
          ),
        };
      });

      const msg = `Campaign "${target.name}" moved to ${toStatus}`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [campaigns, persona, allCustomers, appendAudit, showToast]
  );

  const updateSimulationProgress = useCallback(
    (campaignId: string, nextState: 'running' | 'paused' | 'completed', progressPct: number) => {
      const target = campaigns.find((c) => c.id === campaignId);
      if (!target) return;
      if (!hasPermission(persona, 'campaigns.execute_simulated')) {
        showToast(`Role "${persona.title}" cannot control simulated campaign execution.`);
        return;
      }
      if (
        !['Approved', 'Scheduled', 'Simulated Running', 'Simulated Execution'].includes(
          target.status
        ) ||
        target.requiresReapproval
      ) {
        showToast('Only Approved/Scheduled campaigns (without pending reapproval) can execute.');
        return;
      }

      const clamped = Math.max(0, Math.min(100, progressPct));
      const finalStatus: Mvp3CampaignStatus =
        nextState === 'completed' || clamped >= 100 ? 'Completed' : 'Simulated Running';
      const sim = generateDeterministicCampaignEvents(target, allCustomers, clamped);
      const treatConvs = sim.conversions.filter((cv) => !cv.isControlGroup);
      const totalRev = treatConvs.reduce((a, cv) => a + cv.attributedRevenue, 0);
      const stamp = formatNowStamp();

      setState((prev) => {
        const current = prev.campaignsByTenant[prev.activeTenantId] ?? [];
        const updatedList = current.map((c) => {
          if (c.id !== campaignId) return c;
          return {
            ...c,
            status: finalStatus,
            simulationState: finalStatus === 'Completed' ? ('completed' as const) : nextState,
            simulationProgressPct: finalStatus === 'Completed' ? 100 : clamped,
            simulatedConversions: treatConvs.length,
            estimatedRevenueImpact: totalRev,
            auditTrail:
              c.simulationState !== nextState || finalStatus === 'Completed'
                ? [
                    ...c.auditTrail,
                    {
                      id: `ca-sim-${Date.now()}`,
                      timestamp: stamp,
                      actorName: persona.name,
                      actorRole: persona.title,
                      action:
                        finalStatus === 'Completed'
                          ? 'Completed simulated execution'
                          : nextState === 'paused'
                            ? `Paused simulation at ${clamped}%`
                            : `Simulated execution running (${clamped}%)`,
                      fromStatus: c.status as CampaignStatus,
                      toStatus: finalStatus as CampaignStatus,
                      note: `Processed ${sim.events.filter((e) => e.status === 'Queued').length} of ${c.audience.eligibleReachableCount} eligible records. No live communications sent.`,
                    },
                  ]
                : c.auditTrail,
          };
        });

        const prevEvents = (prev.eventsByTenant[prev.activeTenantId] ?? []).filter(
          (e) => e.campaignId !== campaignId
        );
        const prevConvs = (prev.conversionsByTenant[prev.activeTenantId] ?? []).filter(
          (cv) => cv.campaignId !== campaignId
        );

        return {
          ...prev,
          campaignsByTenant: {
            ...prev.campaignsByTenant,
            [prev.activeTenantId]: updatedList,
          },
          eventsByTenant: {
            ...prev.eventsByTenant,
            [prev.activeTenantId]: [...sim.events, ...prevEvents],
          },
          conversionsByTenant: {
            ...prev.conversionsByTenant,
            [prev.activeTenantId]: [...sim.conversions, ...prevConvs],
          },
          auditLogs:
            finalStatus === 'Completed' || target.simulationState !== nextState
              ? appendAudit(
                  prev,
                  'Simulation',
                  `Simulation ${finalStatus === 'Completed' ? 'completed' : nextState} for "${target.name}"`,
                  `Progress: ${clamped}% · Simulated events generated: ${sim.events.length} · Zero external dispatches.`,
                  undefined,
                  target.id
                )
              : prev.auditLogs,
        };
      });
    },
    [campaigns, persona, allCustomers, appendAudit, showToast]
  );

  const updateApprovalPolicy = useCallback(
    (patch: Partial<ApprovalPolicy>) => {
      if (!hasPermission(persona, 'admin.view')) {
        showToast('Only Tenant Administrators or Platform Super Admins can modify approval policies.');
        return;
      }
      const stamp = formatNowStamp();
      setState((prev) => ({
        ...prev,
        approvalPoliciesByTenant: {
          ...prev.approvalPoliciesByTenant,
          [prev.activeTenantId]: {
            ...approvalPolicy,
            ...patch,
            tenant_id: prev.activeTenantId,
            updatedBy: persona.name,
            updatedAt: stamp,
          },
        },
        auditLogs: appendAudit(
          prev,
          'Approval',
          'Updated Tenant Campaign Approval Policy',
          `Reapproval on edit: ${patch.requireReapprovalOnEdit ?? approvalPolicy.requireReapprovalOnEdit}`,
          undefined,
          activeTenant.code
        ),
      }));
      showToast('Approval governance policy updated');
    },
    [persona, approvalPolicy, activeTenant.code, appendAudit, showToast]
  );

  const updateRecommendationStatus = useCallback(
    (recommendationId: string, status: RecommendationStatus, linkedCampaignId?: string) => {
      setState((prev) => ({
        ...prev,
        recommendationStatusesByTenant: {
          ...prev.recommendationStatusesByTenant,
          [prev.activeTenantId]: {
            ...(prev.recommendationStatusesByTenant[prev.activeTenantId] ?? {}),
            [recommendationId]: { status, linkedCampaignId },
          },
        },
        auditLogs: appendAudit(
          prev,
          'Recommendation',
          `Recommendation ${recommendationId} marked as ${status}`,
          linkedCampaignId ? `Linked to campaign ${linkedCampaignId}.` : `Updated by ${persona.title}.`,
          undefined,
          recommendationId
        ),
      }));
      showToast(`Recommendation ${recommendationId} updated to ${status}`);
    },
    [appendAudit, persona.title, showToast]
  );

  const saveBusinessRule = useCallback(
    (
      input: Omit<BusinessRule, 'id' | 'version' | 'updatedBy' | 'updatedAt' | 'auditHistory'> & {
        id?: string;
        changeNote: string;
      }
    ): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        const msg = 'Admin permission required to create or update Next-Best-Action business rules.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      if (!input.name.trim() || !input.actionTemplate.trim()) {
        return { ok: false, message: 'Rule name and action template are required.' };
      }
      if (
        input.minChurnScore === null &&
        input.minPropensityScore === null &&
        input.minOpportunityScore === null
      ) {
        return {
          ok: false,
          message: 'Specify at least one threshold (Churn, Propensity, or Geographic Opportunity).',
        };
      }

      const stamp = formatNowStamp();
      const existing = input.id ? businessRules.find((r) => r.id === input.id) : undefined;
      const nextVersion = existing ? existing.version + 1 : 1;

      const savedRule: BusinessRule = {
        id: existing?.id ?? `rule-${activeTenant.id}-${Date.now().toString().slice(-4)}`,
        tenant_id: activeTenant.id,
        industryId: activeIndustry.id,
        name: input.name.trim(),
        strategy: input.strategy,
        description: input.description.trim(),
        minChurnScore: input.minChurnScore,
        minPropensityScore: input.minPropensityScore,
        minOpportunityScore: input.minOpportunityScore,
        targetSegment: input.targetSegment,
        suggestedChannel: input.suggestedChannel,
        priority: input.priority,
        actionTemplate: input.actionTemplate.trim(),
        active: input.active,
        version: nextVersion,
        updatedBy: persona.name,
        updatedAt: stamp,
        auditHistory: [
          {
            version: nextVersion,
            timestamp: stamp,
            actorName: persona.name,
            actorRole: persona.title,
            changeNote:
              input.changeNote.trim() || (existing ? 'Rule parameters updated' : 'Rule created'),
          },
          ...(existing?.auditHistory ?? []),
        ],
      };

      setState((prev) => {
        const nextList = existing
          ? businessRules.map((r) => (r.id === existing.id ? savedRule : r))
          : [savedRule, ...businessRules];
        return {
          ...prev,
          rulesByTenant: {
            ...prev.rulesByTenant,
            [prev.activeTenantId]: nextList,
          },
          auditLogs: appendAudit(
            prev,
            'Business Rules',
            `${existing ? 'Updated' : 'Created'} NBA Rule "${savedRule.name}" (v${nextVersion})`,
            `${savedRule.strategy} · ${input.changeNote || 'Active rule saved'}`,
            undefined,
            savedRule.id
          ),
        };
      });

      const msg = `Business rule "${savedRule.name}" saved (v${nextVersion})`;
      showToast(msg);
      return { ok: true, message: msg };
    },
    [persona, businessRules, activeTenant.id, activeIndustry.id, appendAudit, showToast]
  );

  const toggleBusinessRuleActive = useCallback(
    (ruleId: string) => {
      if (!hasPermission(persona, 'admin.manage_industry')) {
        showToast('Admin permission required to toggle business rules.');
        return;
      }
      const target = businessRules.find((r) => r.id === ruleId);
      if (!target) return;
      const stamp = formatNowStamp();
      const nextActive = !target.active;
      const nextVersion = target.version + 1;
      const updated = businessRules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              active: nextActive,
              version: nextVersion,
              updatedBy: persona.name,
              updatedAt: stamp,
              auditHistory: [
                {
                  version: nextVersion,
                  timestamp: stamp,
                  actorName: persona.name,
                  actorRole: persona.title,
                  changeNote: nextActive ? 'Activated rule' : 'Paused rule',
                },
                ...r.auditHistory,
              ],
            }
          : r
      );
      setState((prev) => ({
        ...prev,
        rulesByTenant: { ...prev.rulesByTenant, [prev.activeTenantId]: updated },
        auditLogs: appendAudit(
          prev,
          'Business Rules',
          `${nextActive ? 'Activated' : 'Paused'} NBA Rule "${target.name}" (v${nextVersion})`,
          `Updated by ${persona.title}.`,
          undefined,
          target.id
        ),
      }));
      showToast(`Rule "${target.name}" ${nextActive ? 'activated' : 'paused'}`);
    },
    [persona, businessRules, appendAudit, showToast]
  );

  const requestModelRetraining = useCallback(
    (modelId: string, reason: string) => {
      const target = modelRegistry.find((m) => m.id === modelId);
      if (!target) return;
      const stamp = formatNowStamp();
      const updated = modelRegistry.map((m) =>
        m.id === modelId
          ? {
              ...m,
              retrainingStatus: 'Requested — Pending Approval' as const,
              retrainingRequestedBy: `${persona.name} (${persona.title})`,
              retrainingRequestedAt: stamp,
              validationStatus: 'Pending Governance Sign-Off' as const,
              validationNotes: `Retraining requested: ${reason}`,
            }
          : m
      );
      setState((prev) => ({
        ...prev,
        modelsByTenant: { ...prev.modelsByTenant, [prev.activeTenantId]: updated },
        auditLogs: appendAudit(
          prev,
          'Model Governance',
          `Requested retraining for ${target.modelName} (${target.version})`,
          `Reason: ${reason}. Automated retraining is disabled; requires Admin approval.`,
          undefined,
          target.modelName,
          'Pending Review'
        ),
      }));
      showToast(`Retraining request submitted for ${target.modelName} (approval required)`);
    },
    [modelRegistry, persona, appendAudit, showToast]
  );

  const approveModelRetraining = useCallback(
    (modelId: string, notes: string): { ok: boolean; message: string } => {
      if (!hasPermission(persona, 'admin.manage_modules')) {
        const msg = 'Only Tenant Admin or Platform Super Admin can approve model retraining.';
        showToast(msg);
        return { ok: false, message: msg };
      }
      const target = modelRegistry.find((m) => m.id === modelId);
      if (!target) return { ok: false, message: 'Model not found.' };
      const updated = modelRegistry.map((m) =>
        m.id === modelId
          ? {
              ...m,
              retrainingStatus: 'Approved for Scheduled Retrain' as const,
              retrainingApprovedBy: `${persona.name} (${persona.title})`,
              validationStatus: 'Approved for Demo' as const,
              status: 'Candidate Pending Approval' as const,
              validationNotes:
                notes || 'Approved for controlled offline retraining cycle (no auto-deployment).',
            }
          : m
      );
      setState((prev) => ({
        ...prev,
        modelsByTenant: { ...prev.modelsByTenant, [prev.activeTenantId]: updated },
        auditLogs: appendAudit(
          prev,
          'Model Governance',
          `Approved retraining schedule for ${target.modelName}`,
          notes || 'Scheduled for governed offline validation.',
          undefined,
          target.modelName
        ),
      }));
      showToast(`Retraining approved for ${target.modelName} (manual promotion still required)`);
      return { ok: true, message: 'Approved' };
    },
    [persona, modelRegistry, appendAudit, showToast]
  );

  const openCampaignComposerFromAction = useCallback(
    (draft: Partial<CreateCampaignInput>) => {
      setPendingCampaignDraft(draft);
      updateWizardDraft({
        editingCampaignId: undefined,
        step: 1,
        name: draft.name ?? '',
        objective: draft.objective ?? '',
        targetSegment: draft.targetSegment ?? 'At-Risk Retention',
        regionId: draft.regionId ?? 'ALL',
        channels: draft.channel ? [draft.channel] : ['WhatsApp'],
        scheduledDate: draft.scheduledDate ?? '2026-12-08',
        budgetAllocated: draft.budgetAllocated ?? 25_000_000,
      });
      navigateToRoute('campaign_studio');
    },
    [updateWizardDraft, navigateToRoute]
  );

  const openCampaignStudioFromRecommendation = useCallback(
    (rec: Recommendation) => {
      const initialTargetSegment =
        rec.entityType === 'territory' ? 'Growth Potential' : rec.segment;
      const initialMinRisk: 'ALL' | RiskCategory = rec.strategy === 'RETAIN' ? 'Medium' : 'ALL';
      const initialMinPropensity = rec.strategy === 'DEVELOP' ? 60 : 0;

      // Ensure the pre-populated campaign audience is reachable after consent & suppression filters
      let resolvedSegment = initialTargetSegment;
      let resolvedMinRisk = initialMinRisk;
      let resolvedMinPropensity = initialMinPropensity;
      let resolvedRegionId = rec.regionId;

      const checkReachable = (
        regionId: string,
        targetSegment: string,
        minRiskCategory: 'ALL' | RiskCategory,
        minPropensityScore: number
      ) =>
        computeCampaignAudience(scopedCustomers, {
          tenantId: activeTenant.id,
          businessUnitId: 'ALL',
          regionId,
          targetSegment,
          minRiskCategory,
          minPropensityScore,
          respectConsent: true,
          respectSuppression: true,
          includeControlGroup: true,
        }).eligibleReachableCount;

      if (
        checkReachable(resolvedRegionId, resolvedSegment, resolvedMinRisk, resolvedMinPropensity) ===
        0
      ) {
        resolvedMinRisk = 'ALL';
        resolvedMinPropensity = 0;
      }
      if (
        checkReachable(resolvedRegionId, resolvedSegment, resolvedMinRisk, resolvedMinPropensity) ===
        0
      ) {
        resolvedSegment = 'ALL';
      }
      if (
        checkReachable(resolvedRegionId, resolvedSegment, resolvedMinRisk, resolvedMinPropensity) ===
        0
      ) {
        resolvedRegionId = 'ALL';
      }

      updateWizardDraft({
        editingCampaignId: undefined,
        step: 1,
        name: `${rec.strategy}: ${rec.regionName} — ${rec.segment}`,
        objective: `${rec.recommendedAction} (${rec.businessRationale})`,
        strategy: rec.strategy,
        businessUnitId: 'ALL',
        regionId: resolvedRegionId,
        targetSegment: resolvedSegment,
        minRiskCategory: resolvedMinRisk,
        minPropensityScore: resolvedMinPropensity,
        channels: [rec.suggestedChannel],
        messageSubject: `${rec.strategy} Program — ${activeTenant.shortName}`,
        messageBody: `${rec.recommendedAction}. Designed for ${rec.segment} in ${rec.regionName}.`,
        scheduledDate: '2026-12-10',
        budgetAllocated: Math.max(
          15_000_000,
          Math.round((rec.estimatedRevenueImpact * 0.25) / 500_000) * 500_000
        ),
        linkedRecommendationId: rec.id,
      });
      navigateToRoute('campaign_studio');
    },
    [activeTenant, scopedCustomers, updateWizardDraft, navigateToRoute]
  );

  const openPredictionExplanation = useCallback(
    (predictionId: string) => {
      setSelectedPredictionId(predictionId);
      navigateToRoute('explainable_ai');
    },
    [navigateToRoute]
  );

  const openCustomerPredictions = useCallback(
    (customerId: string) => {
      const match =
        predictions.find((p) => p.entityId === customerId && p.predictionType === 'churn_risk') ??
        predictions.find((p) => p.entityId === customerId);
      if (match) {
        setSelectedPredictionId(match.id);
      }
      navigateToRoute('ai_predictions');
    },
    [predictions, navigateToRoute]
  );

  const openNbaForCustomer = useCallback(
    (customerId: string) => {
      const cust = scopedCustomers.find((c) => c.customer_id === customerId);
      if (cust) {
        setState((prev) => ({
          ...prev,
          filters: { ...prev.filters, regionId: cust.region_id },
        }));
      }
      navigateToRoute('next_best_action');
    },
    [scopedCustomers, navigateToRoute]
  );

  const openCampaignInRoute = useCallback(
    (
      campaignId: string,
      route: 'campaign_studio' | 'approval_inbox' | 'campaign_ops' | 'performance'
    ) => {
      setSelectedCampaignId(campaignId);
      navigateToRoute(route);
    },
    [navigateToRoute]
  );

  const clearPendingCampaignDraft = useCallback(() => {
    setPendingCampaignDraft(null);
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = createInitialPersistedState();
    fresh.isAuthenticated = true;
    fresh.authMode = 'demo';
    fresh.activeRoleId = state.activeRoleId;
    fresh.activeTenantId = DEMO_TENANTS[0].id;
    fresh.activeModuleId = 'BM01';
    fresh.activeRoute = 'executive';
    fresh.auditLogs = [
      {
        id: `log-reset-${Date.now()}`,
        timestamp: formatNowStamp(),
        tenantId: DEMO_TENANTS[0].id,
        actorName: persona.name,
        actorRole: persona.title,
        category: 'System',
        action: 'Reset Demo Data',
        details:
          'Restored all synthetic tenants, industry profiles, modules (BM01–BM10), AI models, NBA rules, campaigns, and readiness controls.',
        objectRef: 'SERVEON-CORE-V2',
        outcome: 'Success',
      },
      ...fresh.auditLogs,
    ];
    setState(fresh);
    setSelectedCustomerId(null);
    setSelectedPredictionId(null);
    setSelectedCampaignId(null);
    setPendingCampaignDraft(null);
    setGeoDrilldownState({ districtId: 'ALL', villageId: 'ALL' });
    setCustomerRiskFilter('ALL');
    setAiPanelOpen(false);
    showToast('All demo data, tenants, industry profiles, modules, and rules restored.');
  }, [state.activeRoleId, persona, showToast]);

  const openCustomer360 = useCallback(
    (customerId: string | null) => {
      setSelectedCustomerId(customerId);
      if (customerId && state.activeRoute !== 'customers') {
        navigateToRoute('customers');
      }
    },
    [state.activeRoute, navigateToRoute]
  );

  const value: PlatformContextValue = {
    isAuthenticated: state.isAuthenticated,
    authMode: state.authMode,
    persona,
    tenants: allTenants,
    activeTenant,
    activeIndustry,
    activeManagedIndustryProfile,
    activeModuleId: safeActiveModuleId,
    activeRoute: state.activeRoute,
    routeAccess,
    modules,
    modulesByTenant: state.tenantModules,
    accessibleModules,
    customers: allCustomers,
    scopedCustomers,
    campaigns,
    campaignsByTenant: state.campaignsByTenant,
    campaignEvents,
    conversionEvents,
    predictions,
    recommendations,
    businessRules,
    modelRegistry,
    approvalPolicy,
    eventPerformance,
    wizardDraft,
    auditLogs: state.auditLogs,
    filters: effectiveFilters,
    geoDrilldown,
    customerRiskFilter,
    permittedRegionIds,
    permittedBranchIds,
    analytics,
    aiPanelOpen,
    selectedCustomerId,
    selectedPredictionId,
    selectedCampaignId,
    pendingCampaignDraft,
    toastMessage,
    tenantGovernanceByTenant: state.tenantGovernanceByTenant,
    onboardingDraft: state.onboardingDraft,
    industryProfiles: state.industryProfiles,
    connectors,
    importHistory,
    importedCustomersCount: importedCustomers.length,
    tenantUsers,
    sessions: state.sessions,
    enterpriseAiModels,
    readinessCategories: state.readinessCategories,
    enterDemo,
    signOut,
    switchRole,
    switchTenant,
    setIndustryOverride,
    navigateToModule,
    navigateToRoute,
    canAccessRoute,
    setFilters,
    setGeoDrilldown,
    setCustomerRiskFilter,
    exploreRegionInLocation,
    openCustomersForTerritorySegment,
    toggleModule,
    updateModuleConfiguration,
    createCampaign,
    saveCampaignFromWizard,
    updateWizardDraft,
    resetWizardDraft,
    loadCampaignIntoWizard,
    transitionCampaignStatus,
    updateApprovalPolicy,
    updateSimulationProgress,
    updateRecommendationStatus,
    saveBusinessRule,
    toggleBusinessRuleActive,
    requestModelRetraining,
    approveModelRetraining,
    openCampaignComposerFromAction,
    openCampaignStudioFromRecommendation,
    openPredictionExplanation,
    openCustomerPredictions,
    openNbaForCustomer,
    openCampaignInRoute,
    clearPendingCampaignDraft,
    logAuditEvent,
    resetDemoData,
    setAiPanelOpen,
    openCustomer360,
    showToast,
    updateOnboardingDraft,
    resetOnboardingDraft,
    completeTenantOnboarding,
    updateTenantLifecycle,
    addBusinessUnit,
    addBranch,
    saveIndustryProfileDraft,
    createIndustryProfileVersion,
    cloneIndustryProfile,
    publishIndustryProfile,
    archiveIndustryProfile,
    deleteIndustryProfile,
    commitCsvImport,
    addEnterpriseUser,
    toggleEnterpriseUserStatus,
    revokeSession,
    transitionEnterpriseAiModel,
    updateReadinessItem,
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}

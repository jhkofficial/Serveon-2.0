import type { ModuleDefinition, ModuleId, UserPersona } from '../../types/platform';
import { hasAllPermissions } from '../permissions/rbac';

export const DEFAULT_MODULE_REGISTRY: ModuleDefinition[] = [
  {
    module_id: 'BM01',
    module_name: 'Executive Dashboard',
    short_name: 'Executive Dashboard',
    module_description:
      'Unified executive KPI overview, trend telemetry, segment composition, regional rankings, and recommended actions.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: [],
    required_permissions: ['dashboard.view'],
    category: 'Core',
    configuration: {
      defaultDateRange: '6m',
      showFormulaTooltips: true,
      enableRegionalDrilldown: true,
    },
  },
  {
    module_id: 'BM02',
    module_name: 'Customer Intelligence',
    short_name: 'Customer Intelligence',
    module_description:
      'Canonical customer directory with industry extension attributes, lifecycle timelines, transactions, and Customer 360 views.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM01'],
    required_permissions: ['customers.view'],
    category: 'Core',
    configuration: {
      pageSize: 20,
      maskPiiFields: true,
      enableExtensionAttributes: true,
    },
  },
  {
    module_id: 'BM03',
    module_name: 'Location Intelligence',
    short_name: 'Location Intelligence',
    module_description:
      'Interactive Indonesian geospatial territory analysis with province-to-village hierarchy, branch coverage, and opportunity scoring.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM01'],
    required_permissions: ['location.view'],
    category: 'Intelligence',
    configuration: {
      defaultCountry: 'Indonesia',
      illustrativeBoundaryNotice: true,
      enableCoverageOverlay: true,
    },
  },
  {
    module_id: 'BM04',
    module_name: 'Predictive Intelligence',
    short_name: 'Predictive Intelligence',
    module_description:
      'Illustrative AI simulation models for churn risk, purchase propensity, geographic opportunity, and explainable factor weights.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM02'],
    required_permissions: ['predictive.view'],
    category: 'Intelligence',
    configuration: {
      simulationMode: true,
      showExplainabilityFactors: true,
      evaluationCadence: 'Weekly Batch (Simulated)',
    },
  },
  {
    module_id: 'BM05',
    module_name: 'CRM & Campaign Activation',
    short_name: 'CRM & Campaigns',
    module_description:
      'Governed campaign orchestration with multi-step approval workflows, channel selection, audit trails, and simulated execution.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM02'],
    required_permissions: ['campaigns.view'],
    category: 'Activation',
    configuration: {
      requireApprovalBeforeExecution: true,
      externalMessagingSimulated: true,
      supportedChannels: 'WhatsApp, Email, SMS, Call Center, Branch Follow-up',
    },
  },
  {
    module_id: 'BM06',
    module_name: 'Decision Intelligence',
    short_name: 'Decision Intelligence',
    module_description:
      'Descriptive, predictive, prescriptive, and explainable decision hub with Gemini-backed natural-language executive Q&A.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM01', 'BM04'],
    required_permissions: ['decision.view'],
    category: 'Intelligence',
    configuration: {
      geminiGroundedMode: true,
      requireHumanApprovalForActions: true,
    },
  },
  {
    module_id: 'BM07',
    module_name: 'Performance & ROI Intelligence',
    short_name: 'Performance & ROI',
    module_description:
      'Campaign attribution, conversion funnel efficiency, branch scorecards, and regional return-on-activation metrics.',
    module_version: '1.0.0',
    enabled: true,
    dependencies: ['BM01', 'BM05'],
    required_permissions: ['performance.view'],
    category: 'Activation',
    configuration: {
      attributionWindowDays: 30,
      benchmarkBaseline: 'Prior Quarter',
    },
  },
  {
    module_id: 'BM08',
    module_name: 'Agentic AI Orchestration',
    short_name: 'AI Orchestration',
    module_description:
      'Continuous learning feedback loops, governed AI orchestration, model registry workflows, and human-approved retraining controls.',
    module_version: '2.0.0',
    enabled: true,
    dependencies: [],
    required_permissions: ['admin.view'],
    category: 'Governance',
    configuration: {
      requireHumanApprovalForRetrain: true,
      autoDeployDisabled: true,
      auditRetentionDays: 365,
    },
  },
  {
    module_id: 'BM09',
    module_name: 'Industry Configuration',
    short_name: 'Industry Config',
    module_description:
      'Configuration-driven Industry Extension Framework, visual Industry Profile Builder, versioned KPIs, schema extensions, and workflow templates.',
    module_version: '2.0.0',
    enabled: true,
    dependencies: ['BM01'],
    required_permissions: ['admin.manage_industry'],
    category: 'Governance',
    configuration: {
      immutablePublishedVersions: true,
      enforceSchemaCompatibilityChecks: true,
      allowCustomProfiles: true,
    },
  },
  {
    module_id: 'BM10',
    module_name: 'Enterprise Administration',
    short_name: 'Enterprise Admin',
    module_description:
      'Multi-tenant provisioning, organizational hierarchy, Module Marketplace, Data Integration Hub, RBAC, AI Governance, monitoring, and Enterprise Readiness.',
    module_version: '2.0.0',
    enabled: true,
    dependencies: [],
    required_permissions: ['admin.view'],
    category: 'Governance',
    configuration: {
      requireSensitiveActionConfirm: true,
      strictTenantScoping: true,
      evidenceBasedReadiness: true,
    },
  },
];

export interface ModuleToggleValidation {
  allowed: boolean;
  reason?: string;
  blockingModules: ModuleId[];
}

export function canEnableModule(
  modules: ModuleDefinition[],
  targetId: ModuleId
): ModuleToggleValidation {
  const target = modules.find((m) => m.module_id === targetId);
  if (!target) {
    return { allowed: false, reason: 'Module not found in registry.', blockingModules: [] };
  }
  const missingDeps = target.dependencies.filter((depId) => {
    const dep = modules.find((m) => m.module_id === depId);
    return !dep || !dep.enabled;
  });
  if (missingDeps.length > 0) {
    const depNames = missingDeps
      .map((id) => {
        const mod = modules.find((m) => m.module_id === id);
        return mod ? `${mod.module_id} (${mod.short_name})` : id;
      })
      .join(', ');
    return {
      allowed: false,
      reason: `Cannot activate ${target.module_id}: mandatory dependencies are disabled (${depNames}). Enable those modules first.`,
      blockingModules: missingDeps,
    };
  }
  return { allowed: true, blockingModules: [] };
}

export function canDisableModule(
  modules: ModuleDefinition[],
  targetId: ModuleId
): ModuleToggleValidation {
  if (targetId === 'BM01' || targetId === 'BM08' || targetId === 'BM10') {
    return {
      allowed: false,
      reason: `${targetId} is a protected core platform module and cannot be disabled.`,
      blockingModules: [targetId],
    };
  }
  const activeDependents = modules
    .filter((m) => m.enabled && m.dependencies.includes(targetId))
    .map((m) => m.module_id);

  if (activeDependents.length > 0) {
    const depNames = activeDependents
      .map((id) => {
        const mod = modules.find((m) => m.module_id === id);
        return mod ? `${mod.module_id} (${mod.short_name})` : id;
      })
      .join(', ');
    return {
      allowed: false,
      reason: `Cannot disable ${targetId}: active modules depend on it (${depNames}). Disable dependent modules first.`,
      blockingModules: activeDependents,
    };
  }
  return { allowed: true, blockingModules: [] };
}

export function getAccessibleModules(
  modules: ModuleDefinition[],
  persona: UserPersona
): ModuleDefinition[] {
  return modules.filter(
    (mod) => mod.enabled && hasAllPermissions(persona, mod.required_permissions)
  );
}

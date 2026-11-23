import type { IndustryId, Tenant } from '../../types/platform';
import type {
  ActiveSessionRecord,
  CanonicalEntityName,
  CsvImportHistoryRecord,
  DataConnectorConfig,
  EnterpriseAiModelRecord,
  EnterpriseUserAccount,
  ManagedIndustryProfile,
  ReadinessCategory,
  TenantGovernanceRecord,
} from '../../types/mvp4';
import { DEMO_TENANTS } from '../../data/mock/tenants';
import { INDUSTRY_LIST } from '../industry-config/profiles';

const DEFAULT_ENTITIES_BY_INDUSTRY: Record<
  IndustryId,
  { supported: CanonicalEntityName[]; optional: CanonicalEntityName[] }
> = {
  motorcycle: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign', 'BusinessEvent'],
    optional: [],
  },
  automotive: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign', 'BusinessEvent'],
    optional: [],
  },
  automotive_parts: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign', 'BusinessEvent'],
    optional: [],
  },
  retail: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign'],
    optional: ['BusinessEvent'],
  },
  banking: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign'],
    optional: ['BusinessEvent'],
  },
  insurance: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Transaction', 'Interaction', 'Location', 'Campaign'],
    optional: ['BusinessEvent'],
  },
  property: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Location', 'Interaction', 'Campaign', 'BusinessEvent'],
    optional: ['Transaction'],
  },
  healthcare: {
    supported: ['Tenant', 'Organization', 'User', 'Customer', 'Product', 'Location', 'Interaction', 'BusinessEvent'],
    optional: ['Transaction', 'Campaign'],
  },
};

export function buildInitialManagedIndustryProfiles(): ManagedIndustryProfile[] {
  return INDUSTRY_LIST.map((base) => {
    const ents = DEFAULT_ENTITIES_BY_INDUSTRY[base.id];
    const accessRequirements =
      base.id === 'healthcare'
        ? [
            'Synthetic, non-sensitive patient demonstration data only (no real PHI/medical records).',
            'Mask personal contact identifiers in operational directories.',
            'Require explicit consent verification before preventive care reminders.',
          ]
        : base.id === 'banking' || base.id === 'insurance'
          ? [
              'Synthetic financial/policyholder demo data only (no real account or policy numbers).',
              'Compliance & Manager approval required before outbound campaign execution.',
              'Enforce regional & branch data scope for frontline roles.',
            ]
          : [
              'Tenant-scoped role authorization enforced across all modules.',
              'Human approval required before simulated campaign activation.',
            ];

    return {
      ...base,
      profileId: `ind-${base.id}`,
      baseIndustryId: base.id,
      version: 1,
      lifecycleStatus: 'Published',
      supportedEntities: ents.supported,
      optionalEntities: ents.optional,
      schemaExtensions: base.extensionAttributes.map((attr, idx) => ({
        key: attr.key,
        label: attr.label,
        dataType: attr.dataType,
        entity: idx === 0 ? 'Customer' : idx === 1 ? 'Product' : 'Customer',
        required: idx < 2,
        description: `${base.name} domain extension attribute mapped onto canonical schema.`,
      })),
      dashboardWidgets: [
        `${base.terminology.primaryRevenueLabel} Trend`,
        `${base.terminology.customerPlural} Segmentation`,
        `Regional Territory Opportunity Map`,
        `Top Next-Best-Action Queue`,
      ],
      accessRequirements,
      createdAt: '2026-09-01 09:00',
      updatedAt: '2026-11-18 10:00',
      updatedBy: 'Ardian Kusuma (Platform Super Admin)',
      versionHistory: [
        {
          version: 1,
          status: 'Published',
          publishedAt: '2026-11-18 10:00',
          publishedBy: 'Ardian Kusuma (Platform Super Admin)',
          changeSummary: `Initial baseline ${base.name} industry configuration profile.`,
          snapshot: {
            name: base.name,
            description: base.description,
            kpiCount: base.kpiDefinitions.length,
            extensionCount: base.extensionAttributes.length,
            ruleCount: base.businessRules.length,
          },
        },
      ],
    };
  });
}

export function buildInitialTenantGovernance(tenants: Tenant[]): Record<string, TenantGovernanceRecord> {
  const map: Record<string, TenantGovernanceRecord> = {};
  tenants.forEach((tenant, idx) => {
    map[tenant.id] = {
      tenantId: tenant.id,
      status: 'Active',
      industryProfileId: `ind-${tenant.defaultIndustryId}`,
      industryProfileVersion: 1,
      subscriptionPlan: idx === 0 ? 'Multi-BU Sovereign' : 'Enterprise AI Suite',
      assignedAdmins: [
        {
          name: 'Nadia Pramesti',
          email: `admin@${tenant.code.toLowerCase()}.demo`,
          role: 'tenant_admin',
        },
      ],
      dataSourceMode: 'Synthetic Demo Dataset',
      enabledAiUseCaseIds: [`${tenant.defaultIndustryId}-primary`],
      securityPolicy: {
        requireMfaForAdmins: true,
        enforceRegionalDataScope: true,
        maskCustomerPiiInLists: true,
        requireSensitiveActionConfirmation: true,
        sessionTimeoutMinutes: 30,
        isolationModeNote: 'Browser Demo Simulation (Requires Backend RLS/IAM in Production)',
      },
      createdAt: '2026-09-15 08:30',
      updatedAt: '2026-11-20 08:00',
      auditHistory: [
        {
          id: `tg-aud-${tenant.id}-1`,
          timestamp: '2026-09-15 08:30',
          actorName: 'Ardian Kusuma',
          actorRole: 'Platform Super Admin',
          action: 'Tenant Activated',
          details: `Provisioned ${tenant.name} (${tenant.code}) with ${tenant.defaultIndustryId} profile and ${tenant.seedCount} synthetic demo records.`,
          outcome: 'Success',
        },
      ],
    };
  });
  return map;
}

export function buildConnectorsForTenant(tenant: Tenant): DataConnectorConfig[] {
  return [
    {
      id: `conn-csv-${tenant.id}`,
      tenantId: tenant.id,
      name: 'Validated CSV / Excel Import',
      type: 'CSV / Excel Import',
      status: 'Ready (Local CSV Validator)',
      description: 'Upload or test synthetic CSV customer feeds with schema preview, canonical field mapping, and validation checks.',
      endpointUrlPlaceholder: 'Browser local file upload (no secrets stored)',
      authMode: 'Local File Upload',
      syncCadence: 'On-Demand Verified Batch',
      lastCheckedAt: '2026-11-20 08:00',
      notes: 'Supports canonical Customer records and tenant industry extension fields.',
    },
    {
      id: `conn-crm-${tenant.id}`,
      tenantId: tenant.id,
      name: 'Enterprise CRM Connector (Salesforce / Dynamics / HubSpot)',
      type: 'CRM',
      status: 'Not Connected',
      description: 'Bi-directional customer profile, consent preference, and interaction history sync.',
      endpointUrlPlaceholder: 'https://crm.enterprise.internal/api/v2',
      authMode: 'OAuth 2.0 (Backend Secret Vault)',
      syncCadence: 'Every 15 minutes (when connected)',
      lastCheckedAt: 'Not verified — credentials required server-side',
      notes: 'Configure OAuth client credentials in server secret vault before enabling.',
    },
    {
      id: `conn-erp-${tenant.id}`,
      tenantId: tenant.id,
      name: 'ERP & Core Billing Connector (SAP / Oracle / NetSuite)',
      type: 'ERP',
      status: 'Not Connected',
      description: 'Synchronizes canonical Product catalog, Branch hierarchies, and verified order ledgers.',
      endpointUrlPlaceholder: 'https://erp.enterprise.internal/odata/v4',
      authMode: 'Service Account (Server-Side)',
      syncCadence: 'Hourly batch (when connected)',
      lastCheckedAt: 'Not verified — credentials required server-side',
      notes: 'Never store ERP service credentials in browser storage.',
    },
    {
      id: `conn-txdb-${tenant.id}`,
      tenantId: tenant.id,
      name: 'Transaction Database / Warehouse (PostgreSQL / BigQuery)',
      type: 'Transaction Database',
      status: 'Not Connected',
      description: 'Read-only analytical ingestion for high-volume transaction and POS feeds.',
      endpointUrlPlaceholder: 'postgres://readonly-analytics.internal:5432/serveon',
      authMode: 'Service Account (Server-Side)',
      syncCadence: 'Daily 02:00 WIB (when connected)',
      lastCheckedAt: 'Not verified — backend tunnel required',
      notes: 'Requires backend VPC peering and read-only DB role.',
    },
    {
      id: `conn-rest-${tenant.id}`,
      tenantId: tenant.id,
      name: 'Custom REST API Webhook / Feed',
      type: 'REST API',
      status: 'Not Connected',
      description: 'Ingests domain-specific BusinessEvent telemetry from proprietary internal apps.',
      endpointUrlPlaceholder: 'https://api.enterprise.internal/events/v1',
      authMode: 'OAuth 2.0 (Backend Secret Vault)',
      syncCadence: 'Event-driven webhook',
      lastCheckedAt: 'Not verified — endpoint not configured',
      notes: 'Payload signing secret must be stored strictly server-side.',
    },
    {
      id: `conn-geo-${tenant.id}`,
      tenantId: tenant.id,
      name: 'Geospatial Boundary & Demographic Source (BPS / GeoJSON)',
      type: 'Geospatial Data Source',
      status: 'Demo Seed Active',
      description: `Indonesian WGS-84 regency boundaries and synthetic market potential indices for ${tenant.primaryProvinceName}.`,
      endpointUrlPlaceholder: 'Internal WGS-84 Boundary Registry',
      authMode: 'Internal Seed',
      syncCadence: 'Quarterly boundary refresh',
      lastCheckedAt: '2026-11-20 06:00',
      notes: 'Illustrative demo boundaries active; connect licensed GIS/BPS feeds for production.',
    },
    {
      id: `conn-ext-${tenant.id}`,
      tenantId: tenant.id,
      name: 'External Analytics / BI Lakehouse',
      type: 'External Analytics Source',
      status: 'Not Connected',
      description: 'Exports governed campaign attribution and cohort aggregates to enterprise BI warehouses.',
      endpointUrlPlaceholder: 'https://analytics.enterprise.internal/export',
      authMode: 'Service Account (Server-Side)',
      syncCadence: 'Nightly export',
      lastCheckedAt: 'Not verified — credentials required server-side',
      notes: 'Awaiting enterprise data governance sign-off.',
    },
  ];
}

export function buildInitialUsersForTenant(tenant: Tenant): EnterpriseUserAccount[] {
  const domain = `${tenant.code.toLowerCase().replace(/[^a-z0-9]/g, '')}.demo`;
  const primaryRegion = tenant.province.regencies[0]?.name ?? tenant.primaryProvinceName;
  const primaryBranch = tenant.branches[0]?.name ?? 'Primary Unit';
  return [
    {
      id: `usr-${tenant.id}-1`,
      tenantId: tenant.id,
      name: 'Nadia Pramesti',
      email: `nadia.pramesti@${domain}`,
      roleId: 'tenant_admin',
      businessUnitScope: 'All Business Units',
      regionScope: `All ${tenant.primaryProvinceName}`,
      status: 'Active',
      mfaEnabled: true,
      lastActiveAt: '2026-11-20 09:42',
    },
    {
      id: `usr-${tenant.id}-2`,
      tenantId: tenant.id,
      name: 'Rina Santoso',
      email: `rina.santoso@${domain}`,
      roleId: 'business_manager',
      businessUnitScope: tenant.businessUnits[0]?.name ?? 'Core Unit',
      regionScope: `All ${tenant.primaryProvinceName}`,
      status: 'Active',
      mfaEnabled: true,
      lastActiveAt: '2026-11-20 09:15',
    },
    {
      id: `usr-${tenant.id}-3`,
      tenantId: tenant.id,
      name: 'Budi Hartono',
      email: `budi.hartono@${domain}`,
      roleId: 'regional_manager',
      businessUnitScope: tenant.businessUnits[0]?.name ?? 'Core Unit',
      regionScope: primaryRegion,
      status: 'Active',
      mfaEnabled: true,
      lastActiveAt: '2026-11-20 08:50',
    },
    {
      id: `usr-${tenant.id}-4`,
      tenantId: tenant.id,
      name: 'Dimas Pratama',
      email: `dimas.pratama@${domain}`,
      roleId: 'campaign_manager',
      businessUnitScope: 'All Business Units',
      regionScope: `All ${tenant.primaryProvinceName}`,
      status: 'Active',
      mfaEnabled: true,
      lastActiveAt: '2026-11-20 08:25',
    },
    {
      id: `usr-${tenant.id}-5`,
      tenantId: tenant.id,
      name: 'Dewi Anggraini',
      email: `dewi.anggraini@${domain}`,
      roleId: 'branch_operational',
      businessUnitScope: tenant.businessUnits[0]?.name ?? 'Core Unit',
      regionScope: primaryBranch,
      status: 'Active',
      mfaEnabled: false,
      lastActiveAt: '2026-11-19 17:10',
    },
  ];
}

export function buildInitialEnterpriseAiModels(
  tenant: Tenant
): EnterpriseAiModelRecord[] {
  const ind = tenant.defaultIndustryId;
  return [
    {
      id: `eai-${tenant.id}-churn`,
      tenantId: tenant.id,
      useCaseId: `${ind}-churn`,
      useCaseName: 'Customer Retention & Defection Scoring',
      modelName: `serveon-${ind}-churn-sim`,
      version: '2.1.0-sim',
      industryCompatibility: [ind],
      executionMode: 'Simulated AI',
      status: 'Active',
      approvalStatus: 'Approved by Governance',
      evaluationMetrics: {
        primaryMetricLabel: 'Simulated Calibration Proxy',
        primaryMetricValue: '91.4% (Synthetic)',
        calibrationNote: 'Deterministic demo scoring; requires real historical outcome labels before production training.',
        sampleSize: tenant.seedCount,
      },
      owner: 'Enterprise AI Governance Team',
      deploymentEnvironment: 'Demo Sandbox',
      monitoringStatus: 'Nominal (Sim)',
      lastValidationDate: '2026-11-18',
      limitations: [
        'Deterministic synthetic rules — not a trained production ML classifier.',
        'Feature attributions are illustrative relative weights, not live SHAP values.',
      ],
      approvedBy: 'Ardian Kusuma',
      approvedAt: '2026-11-18 14:00',
    },
    {
      id: `eai-${tenant.id}-propensity-v2`,
      tenantId: tenant.id,
      useCaseId: `${ind}-propensity`,
      useCaseName: 'Cross-Sell & Upgrade Propensity',
      modelName: `serveon-${ind}-propensity-candidate`,
      version: '2.2.0-rc1',
      industryCompatibility: [ind],
      executionMode: 'Simulated AI',
      status: 'Validated',
      approvalStatus: 'Pending Approval',
      evaluationMetrics: {
        primaryMetricLabel: 'Candidate Lift Proxy',
        primaryMetricValue: '+8.4% (Sandbox Test)',
        calibrationNote: 'Candidate version awaiting explicit Governance approval before switching Active version.',
        sampleSize: tenant.seedCount,
      },
      owner: 'Applied ML Engineering',
      deploymentEnvironment: 'Staging (Simulated)',
      monitoringStatus: 'Watch (Sim)',
      lastValidationDate: '2026-11-19',
      limitations: [
        'Requires explicit Admin approval to promote from Validated -> Approved -> Active.',
        'Automatic deployment and automatic retraining are permanently disabled.',
      ],
    },
    {
      id: `eai-${tenant.id}-gemini`,
      tenantId: tenant.id,
      useCaseId: `${ind}-executive-briefing`,
      useCaseName: 'Executive Decision & Explanation Synthesis',
      modelName: 'gemini-server-side-proxy',
      version: '2.5-flash-grounded',
      industryCompatibility: ['automotive', 'retail', 'banking', 'insurance', 'property', 'healthcare'],
      executionMode: 'Gemini-Generated Explanation',
      status: 'Active',
      approvalStatus: 'Approved by Governance',
      evaluationMetrics: {
        primaryMetricLabel: 'Grounding Policy',
        primaryMetricValue: 'Tenant KPI Context Only',
        calibrationNote: 'Invoked strictly server-side via /api/ai/insights with masked aggregate metrics (no raw PII).',
        sampleSize: tenant.seedCount,
      },
      owner: 'Platform AI Architecture',
      deploymentEnvironment: 'Demo Sandbox',
      monitoringStatus: 'Nominal (Sim)',
      lastValidationDate: '2026-11-20',
      limitations: [
        'Generates executive narrative explanations only; cannot directly mutate tenant records or execute campaigns.',
      ],
      approvedBy: 'Ardian Kusuma',
      approvedAt: '2026-11-20 08:00',
    },
    {
      id: `eai-${tenant.id}-prod-endpoint`,
      tenantId: tenant.id,
      useCaseId: `${ind}-live-inference`,
      useCaseName: 'Production Real-Time ML Inference Endpoint',
      modelName: `prod-${ind}-xgb-endpoint`,
      version: '0.1.0-draft',
      industryCompatibility: [ind],
      executionMode: 'Real Model Inference',
      status: 'Draft',
      approvalStatus: 'Not Submitted',
      evaluationMetrics: {
        primaryMetricLabel: 'Live Endpoint Status',
        primaryMetricValue: 'Not Connected',
        calibrationNote: 'Awaiting enterprise training dataset, offline backtest, and MLOps endpoint registration.',
        sampleSize: 0,
      },
      owner: 'Data Science Platform Lead',
      deploymentEnvironment: 'Production (Not Connected)',
      monitoringStatus: 'Not Connected',
      lastValidationDate: 'Pending',
      limitations: [
        'Not connected to a live trained ML model endpoint in demo mode.',
      ],
    },
  ];
}

export function buildInitialReadinessCategories(): ReadinessCategory[] {
  return [
    {
      id: 'rd-arch',
      name: '1. Architecture',
      description: 'Modular boundaries, industry-agnostic core platform, and non-destructive extension contracts.',
      items: [
        {
          id: 'rd-arch-1',
          title: 'Modular Business Capability Boundaries (BM01–BM10)',
          requirement: 'Verify clean module registry, dependency enforcement, and dynamic route guarding.',
          status: 'Verified',
          evidenceReference: 'UNIT-TEST: src/core/analytics/kpiEngine.test.ts + mvp4Engine.test.ts',
          owner: 'Principal Platform Architect',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-arch-2',
          title: 'Configuration-Driven Industry Extension Contracts',
          requirement: 'Industry terminology, KPIs, extension attributes, and rules load from versioned profiles without core duplication.',
          status: 'Verified',
          evidenceReference: 'ADR-004: Industry Extension Framework + Profile Schema Validator',
          owner: 'Principal Platform Architect',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
      ],
    },
    {
      id: 'rd-data',
      name: '2. Data Readiness',
      description: 'Canonical schema enforcement, data quality validation, and synthetic vs. production data governance.',
      items: [
        {
          id: 'rd-data-1',
          title: 'CSV Ingestion Schema Validation & Duplicate Detection',
          requirement: 'Validate canonical fields, types, and duplicate codes before committing records.',
          status: 'Verified',
          evidenceReference: 'UNIT-TEST: mvp4Engine.test.ts (CSV Parser & Quality Gate)',
          owner: 'Data Engineering Lead',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-data-2',
          title: 'Production Enterprise Data Warehouse Migration',
          requirement: 'Replace browser localStorage persistence with encrypted server-side relational/document DB.',
          status: 'Blocked',
          evidenceReference: '',
          owner: 'Data Engineering Lead',
          reviewDate: '',
          openIssue: 'Demo currently persists state in browser localStorage; server database provisioning required for production.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-sec',
      name: '3. Security',
      description: 'Authentication, server-side RBAC, secret protection, and penetration testing.',
      items: [
        {
          id: 'rd-sec-1',
          title: 'Server-Side API Key Isolation (Gemini Proxy)',
          requirement: 'Ensure GEMINI_API_KEY is never exposed to frontend bundles.',
          status: 'Verified',
          evidenceReference: 'SEC-REVIEW: server.ts /api/ai/insights proxy boundary',
          owner: 'Application Security Architect',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-sec-2',
          title: 'Enterprise SSO / OIDC & Server-Side RBAC Enforcement',
          requirement: 'Replace simulated demo persona switching with trusted JWT/OIDC verification on every backend API.',
          status: 'Blocked',
          evidenceReference: '',
          owner: 'IAM Security Lead',
          reviewDate: '',
          openIssue: 'Client-side persona switcher is for demonstration only and does not constitute production security.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-mt',
      name: '4. Multi-Tenant Isolation',
      description: 'Strict tenant scoping across datasets, campaigns, models, and administrative actions.',
      items: [
        {
          id: 'rd-mt-1',
          title: 'Application-Layer Tenant Scoping (tenant_id Partitioning)',
          requirement: 'Verify Tenant A cannot view or mutate Tenant B customers, campaigns, or module states.',
          status: 'Verified',
          evidenceReference: 'E2E-TEST: Multi-tenant isolation verified across Automotive & Retail workspaces',
          owner: 'Multi-Tenant Architect',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-mt-2',
          title: 'Database Row-Level Security (RLS) & Tenant Encryption Keys',
          requirement: 'Enforce tenant isolation inside the database engine independent of client-supplied tenant_id.',
          status: 'Evidence Required',
          evidenceReference: '',
          owner: 'Cloud Infrastructure Lead',
          reviewDate: '',
          openIssue: 'Requires backend PostgreSQL RLS / Firestore Security Rules deployment and penetration test sign-off.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-ai',
      name: '5. AI Governance',
      description: 'Model lifecycle approvals, honest simulated vs. live ML disclosure, and explainability guardrails.',
      items: [
        {
          id: 'rd-ai-1',
          title: 'Human-Approved Model Promotion & No Auto-Retrain Guardrail',
          requirement: 'Block unapproved model promotion and disable automatic retraining/redeployment.',
          status: 'Verified',
          evidenceReference: 'UNIT-TEST: validateEnterpriseAiTransition + Learning & Governance audit trail',
          owner: 'AI Governance Officer',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-ai-2',
          title: 'Production ML Calibration & Live SHAP Verification',
          requirement: 'Connect trained model endpoints and verify live SHAP explainability parity.',
          status: 'Not Started',
          evidenceReference: '',
          owner: 'Applied ML Lead',
          reviewDate: '',
          openIssue: 'Demo uses deterministic simulated scores and illustrative feature attributions.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-int',
      name: '6. Integration',
      description: 'CRM, ERP, Warehouse, and messaging channel adapter readiness.',
      items: [
        {
          id: 'rd-int-1',
          title: 'External CRM / ERP / Messaging Secret Vault Configuration',
          requirement: 'Provision server-side secret manager and sandbox webhooks before live channel dispatch.',
          status: 'In Progress',
          evidenceReference: 'INT-SPEC: Data Integration Hub Connector Interfaces v2.0',
          owner: 'Integration Engineering Lead',
          reviewDate: '2026-11-20',
          openIssue: 'External connectors remain honestly marked Not Connected until enterprise credentials are provisioned.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-perf',
      name: '7. Performance',
      description: 'Client bundle hygiene, analytical query speed, and load testing.',
      items: [
        {
          id: 'rd-perf-1',
          title: 'Deterministic Client KPI & 1,000-Record Rendering Budget',
          requirement: 'Executive KPIs, Leaflet territory polygons, and tables render without runtime errors.',
          status: 'Verified',
          evidenceReference: 'BUILD+E2E: Vite build clean + headless Chromium verification',
          owner: 'Frontend Performance Engineer',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-perf-2',
          title: '100k+ Customer Load & Concurrency Benchmark',
          requirement: 'Execute backend k6/Locust load test against paginated server APIs.',
          status: 'Not Started',
          evidenceReference: '',
          owner: 'SRE Performance Lead',
          reviewDate: '',
          openIssue: 'Pending backend database deployment.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-ops',
      name: '8. Operations',
      description: 'Live observability, alerting, and incident runbooks.',
      items: [
        {
          id: 'rd-ops-1',
          title: 'OpenTelemetry / Cloud Monitoring Pipeline Integration',
          requirement: 'Replace simulated monitoring series with live Prometheus/Cloud Trace ingestion.',
          status: 'Evidence Required',
          evidenceReference: '',
          owner: 'Site Reliability Engineering',
          reviewDate: '',
          openIssue: 'Platform Monitoring currently displays clearly labeled deterministic simulated telemetry.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-dr',
      name: '9. Disaster Recovery',
      description: 'Backups, RPO/RTO validation, and failover testing.',
      items: [
        {
          id: 'rd-dr-1',
          title: 'Automated Cross-Region Backup & Restore Drill (RPO <= 15m)',
          requirement: 'Execute documented restore drill on production database cluster.',
          status: 'Not Started',
          evidenceReference: '',
          owner: 'Cloud Infrastructure Lead',
          reviewDate: '',
          openIssue: 'Requires managed production database cluster.',
          demoOnlyLimitation: true,
        },
      ],
    },
    {
      id: 'rd-comp',
      name: '10. Compliance',
      description: 'Indonesian UU PDP (Personal Data Protection), consent logging, and immutable audit trails.',
      items: [
        {
          id: 'rd-comp-1',
          title: 'Marketing Consent, Opt-Out & Suppression Enforcement in Campaigns',
          requirement: 'Ensure opted-out and non-consented customers are excluded prior to campaign dispatch.',
          status: 'Verified',
          evidenceReference: 'UNIT-TEST: mvp3Engine.test.ts (Campaign Audience Consent & Opt-Out)',
          owner: 'Privacy & Compliance Officer',
          reviewDate: '2026-11-21',
          openIssue: '',
          demoOnlyLimitation: false,
        },
        {
          id: 'rd-comp-2',
          title: 'UU PDP Legal Assessment & Immutable Server-Side Audit Store',
          requirement: 'Persist audit logs to append-only backend WORM storage with legal DPO sign-off.',
          status: 'Evidence Required',
          evidenceReference: '',
          owner: 'Data Protection Officer',
          reviewDate: '',
          openIssue: 'Demo audit trail is stored locally in browser; immutable backend log sink required for compliance certification.',
          demoOnlyLimitation: true,
        },
      ],
    },
  ];
}

export interface InitialMvp4Bundle {
  industryProfiles: ManagedIndustryProfile[];
  tenantGovernanceByTenant: Record<string, TenantGovernanceRecord>;
  connectorsByTenant: Record<string, DataConnectorConfig[]>;
  importHistoryByTenant: Record<string, CsvImportHistoryRecord[]>;
  usersByTenant: Record<string, EnterpriseUserAccount[]>;
  sessions: ActiveSessionRecord[];
  enterpriseAiModelsByTenant: Record<string, EnterpriseAiModelRecord[]>;
  readinessCategories: ReadinessCategory[];
}

export function buildAllInitialMvp4State(): InitialMvp4Bundle {
  const connectorsByTenant: Record<string, DataConnectorConfig[]> = {};
  const importHistoryByTenant: Record<string, CsvImportHistoryRecord[]> = {};
  const usersByTenant: Record<string, EnterpriseUserAccount[]> = {};
  const enterpriseAiModelsByTenant: Record<string, EnterpriseAiModelRecord[]> = {};

  for (const tenant of DEMO_TENANTS) {
    connectorsByTenant[tenant.id] = buildConnectorsForTenant(tenant);
    importHistoryByTenant[tenant.id] = [];
    usersByTenant[tenant.id] = buildInitialUsersForTenant(tenant);
    enterpriseAiModelsByTenant[tenant.id] = buildInitialEnterpriseAiModels(tenant);
  }

  return {
    industryProfiles: buildInitialManagedIndustryProfiles(),
    tenantGovernanceByTenant: buildInitialTenantGovernance(DEMO_TENANTS),
    connectorsByTenant,
    importHistoryByTenant,
    usersByTenant,
    sessions: [
      {
        id: 'sess-demo-1',
        tenantId: DEMO_TENANTS[0].id,
        userName: 'Ardian Kusuma',
        roleTitle: 'Platform Super Admin',
        authContext: 'Simulated Demo Session',
        startedAt: '2026-11-21 08:00',
        scopeSummary: 'Platform-wide governance across all registered tenants',
        status: 'Active',
      },
      {
        id: 'sess-demo-2',
        tenantId: DEMO_TENANTS[1].id,
        userName: 'Nadia Pramesti',
        roleTitle: 'Tenant Administrator',
        authContext: 'Simulated Demo Session',
        startedAt: '2026-11-21 08:45',
        scopeSummary: `Tenant-scoped administration (${DEMO_TENANTS[1].name})`,
        status: 'Active',
      },
    ],
    enterpriseAiModelsByTenant,
    readinessCategories: buildInitialReadinessCategories(),
  };
}

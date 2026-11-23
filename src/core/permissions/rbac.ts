import type { PermissionKey, Tenant, UserPersona, UserRoleId } from '../../types/platform';

export const USER_PERSONAS: UserPersona[] = [
  {
    id: 'platform_super_admin',
    name: 'Ardian Kusuma',
    title: 'Platform Super Admin',
    email: 'ardian.kusuma@serveon.demo',
    department: 'Enterprise Architecture',
    scopeLevel: 'platform',
    description: 'Full platform governance across tenants, module registry, industry templates, and audit logs.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'location.view',
      'predictive.view',
      'campaigns.view',
      'campaigns.create',
      'campaigns.approve',
      'campaigns.execute_simulated',
      'decision.view',
      'decision.ai_query',
      'performance.view',
      'admin.view',
      'admin.manage_modules',
      'admin.manage_industry',
      'admin.manage_tenants',
      'admin.view_audit',
    ],
  },
  {
    id: 'tenant_admin',
    name: 'Nadia Pramesti',
    title: 'Tenant Administrator',
    email: 'nadia.pramesti@tenant.demo',
    department: 'Digital Operations',
    scopeLevel: 'tenant',
    description: 'Manages module activation, industry profile tuning, and governance within the active tenant.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'location.view',
      'predictive.view',
      'campaigns.view',
      'campaigns.create',
      'campaigns.approve',
      'campaigns.execute_simulated',
      'decision.view',
      'decision.ai_query',
      'performance.view',
      'admin.view',
      'admin.manage_modules',
      'admin.manage_industry',
      'admin.view_audit',
    ],
  },
  {
    id: 'executive_management',
    name: 'Hendra Wijaya',
    title: 'Executive Management',
    email: 'hendra.wijaya@tenant.demo',
    department: 'Board & Strategy',
    scopeLevel: 'tenant',
    description: 'Reviews approved aggregate KPIs, geographic opportunities, AI briefings, and ROI performance.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'location.view',
      'predictive.view',
      'campaigns.view',
      'campaigns.approve',
      'decision.view',
      'decision.ai_query',
      'performance.view',
    ],
  },
  {
    id: 'business_manager',
    name: 'Rina Santoso',
    title: 'Business Manager',
    email: 'rina.santoso@tenant.demo',
    department: 'Commercial Growth',
    scopeLevel: 'tenant',
    description: 'Oversees customer portfolios, regional growth initiatives, predictive insights, and ROI.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'location.view',
      'predictive.view',
      'campaigns.view',
      'campaigns.create',
      'campaigns.approve',
      'decision.view',
      'decision.ai_query',
      'performance.view',
    ],
  },
  {
    id: 'regional_manager',
    name: 'Budi Hartono',
    title: 'Regional Manager',
    email: 'budi.hartono@tenant.demo',
    department: 'Regional Operations',
    scopeLevel: 'region',
    scopedRegionIndex: 0,
    description: 'Scoped strictly to assigned primary regional territory and its constituent branches.',
    canSwitchTenantInDemo: false,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'location.view',
      'predictive.view',
      'campaigns.view',
      'campaigns.create',
      'decision.view',
      'decision.ai_query',
      'performance.view',
    ],
  },
  {
    id: 'business_analyst',
    name: 'Siti Rahmawati',
    title: 'Business Analyst',
    email: 'siti.rahmawati@tenant.demo',
    department: 'Data & Analytics',
    scopeLevel: 'tenant',
    description: 'Explores customer segments, geospatial distributions, predictive scoring, and ROI analytics.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'location.view',
      'predictive.view',
      'decision.view',
      'decision.ai_query',
      'performance.view',
    ],
  },
  {
    id: 'campaign_manager',
    name: 'Dimas Pratama',
    title: 'Campaign Manager',
    email: 'dimas.pratama@tenant.demo',
    department: 'CRM & Lifecycle',
    scopeLevel: 'tenant',
    description: 'Designs, submits, schedules, and simulates approved multi-channel customer campaigns.',
    canSwitchTenantInDemo: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'predictive.view',
      'campaigns.view',
      'campaigns.create',
      'campaigns.execute_simulated',
      'performance.view',
    ],
  },
  {
    id: 'branch_operational',
    name: 'Dewi Anggraini',
    title: 'Branch Operational User',
    email: 'dewi.anggraini@tenant.demo',
    department: 'Branch Frontline',
    scopeLevel: 'branch',
    scopedRegionIndex: 0,
    scopedBranchIndex: 0,
    description: 'Scoped strictly to assigned branch customers and local operational follow-up tasks.',
    canSwitchTenantInDemo: false,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.view_detail',
      'campaigns.view',
    ],
  },
];

export function getPersonaById(roleId: UserRoleId): UserPersona {
  return USER_PERSONAS.find((p) => p.id === roleId) ?? USER_PERSONAS[0];
}

export function hasPermission(persona: UserPersona, permission: PermissionKey): boolean {
  return persona.permissions.includes(permission);
}

export function hasAllPermissions(persona: UserPersona, required: PermissionKey[]): boolean {
  return required.every((perm) => persona.permissions.includes(perm));
}

export function getPermittedRegionIds(persona: UserPersona, tenant: Tenant): string[] {
  const allRegions = tenant.province.regencies.map((r) => r.id);
  if (persona.scopeLevel === 'platform' || persona.scopeLevel === 'tenant') {
    return allRegions;
  }
  if (persona.scopeLevel === 'region') {
    const idx = persona.scopedRegionIndex ?? 0;
    const primary = allRegions[idx] ?? allRegions[0];
    const secondary = allRegions[idx + 1];
    return secondary ? [primary, secondary] : [primary];
  }
  // Branch operational user: only the region of their assigned branch
  const branch = tenant.branches[persona.scopedBranchIndex ?? 0] ?? tenant.branches[0];
  return branch ? [branch.region_id] : [allRegions[0]];
}

export function getPermittedBranchIds(persona: UserPersona, tenant: Tenant): string[] {
  if (persona.scopeLevel === 'platform' || persona.scopeLevel === 'tenant') {
    return tenant.branches.map((b) => b.id);
  }
  if (persona.scopeLevel === 'region') {
    const permittedRegions = new Set(getPermittedRegionIds(persona, tenant));
    return tenant.branches.filter((b) => permittedRegions.has(b.region_id)).map((b) => b.id);
  }
  const branch = tenant.branches[persona.scopedBranchIndex ?? 0] ?? tenant.branches[0];
  return branch ? [branch.id] : [];
}

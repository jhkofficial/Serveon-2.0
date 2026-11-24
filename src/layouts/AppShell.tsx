import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Activity,
  FileSearch,
  Sparkles,
  BrainCircuit,
  Megaphone,
  ClipboardCheck,
  PlayCircle,
  BarChart3,
  ShieldCheck,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
  MessageSquareText,
  Layers,
  CheckCircle2,
  Building2,
  GitBranch,
  Blocks,
  UserCog,
  Database,
  Cpu,
  Lock,
  Gauge,
  FileCheck2,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import { usePlatform, PLATFORM_ONLY_ROUTES } from '../core/state/PlatformContext';
import { ROUTE_TO_MODULE } from '../core/state/mvp3SeedState';
import { INDUSTRY_LIST } from '../core/industry-config/profiles';
import { USER_PERSONAS, hasPermission } from '../core/permissions/rbac';
import type { IndustryId, UserRoleId } from '../types/platform';
import type { WorkspaceRouteId } from '../types/mvp3';
import { ContextualAiPanel } from '../components/ContextualAiPanel';

interface SidebarNavItem {
  routeId: WorkspaceRouteId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarNavGroup {
  groupLabel: string;
  section?: 'business' | 'enterprise_admin';
  items: SidebarNavItem[];
}

const BUSINESS_SIDEBAR_GROUPS: SidebarNavGroup[] = [
  {
    groupLabel: 'Core Intelligence',
    section: 'business',
    items: [
      { routeId: 'executive', label: 'Executive Dashboard', icon: LayoutDashboard },
      { routeId: 'customers', label: 'Customer Intelligence', icon: Users },
      { routeId: 'location', label: 'Location Intelligence', icon: MapPin },
    ],
  },
  {
    groupLabel: 'AI & Decisions',
    section: 'business',
    items: [
      { routeId: 'ai_predictions', label: 'AI Prediction Center', icon: Activity },
      { routeId: 'explainable_ai', label: 'Explainable AI', icon: FileSearch },
      { routeId: 'next_best_action', label: 'Next-Best-Action', icon: Sparkles },
      { routeId: 'decision_hub', label: 'Decision Hub', icon: BrainCircuit },
    ],
  },
  {
    groupLabel: 'Campaign Orchestration',
    section: 'business',
    items: [
      { routeId: 'campaign_studio', label: 'Campaign Studio', icon: Megaphone },
      { routeId: 'approval_inbox', label: 'Approval Inbox', icon: ClipboardCheck },
      { routeId: 'campaign_ops', label: 'Campaign Operations', icon: PlayCircle },
    ],
  },
  {
    groupLabel: 'Performance & Learning',
    section: 'business',
    items: [
      { routeId: 'performance', label: 'Performance Intelligence', icon: BarChart3 },
      { routeId: 'learning_governance', label: 'Learning & Governance', icon: ShieldCheck },
      { routeId: 'admin_config', label: 'Tenant Quick Config', icon: Settings },
    ],
  },
];

const ENTERPRISE_ADMIN_GROUP: SidebarNavGroup = {
  groupLabel: 'Enterprise Administration',
  section: 'enterprise_admin',
  items: [
    { routeId: 'ent_overview', label: 'Platform Overview', icon: Compass },
    { routeId: 'ent_tenants', label: 'Tenant Management', icon: Building2 },
    { routeId: 'ent_org', label: 'Organization Hierarchy', icon: GitBranch },
    { routeId: 'ent_industries', label: 'Industry Profiles', icon: Layers },
    { routeId: 'ent_marketplace', label: 'Module Marketplace', icon: Blocks },
    { routeId: 'ent_users', label: 'Users & Roles', icon: UserCog },
    { routeId: 'ent_integrations', label: 'Data Integration Hub', icon: Database },
    { routeId: 'ent_ai_governance', label: 'AI Governance', icon: Cpu },
    { routeId: 'ent_security_audit', label: 'Security & Audit', icon: Lock },
    { routeId: 'ent_monitoring', label: 'Platform Monitoring', icon: Gauge },
    { routeId: 'ent_readiness', label: 'Enterprise Readiness', icon: FileCheck2 },
  ],
};

const ALL_NAV_ITEMS: SidebarNavItem[] = [
  ...BUSINESS_SIDEBAR_GROUPS.flatMap((g) => g.items),
  ...ENTERPRISE_ADMIN_GROUP.items,
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    persona,
    tenants,
    activeTenant,
    activeIndustry,
    activeRoute,
    accessibleModules,
    campaigns,
    filters,
    permittedRegionIds,
    aiPanelOpen,
    mapFullscreen,
    toastMessage,
    switchTenant,
    setIndustryOverride,
    setFilters,
    switchRole,
    navigateToRoute,
    setAiPanelOpen,
    setMapFullscreen,
    signOut,
  } = usePlatform();

  const isLocationRoute = activeRoute === 'location';
  const isMapFullscreen = isLocationRoute && mapFullscreen;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeRoute]);

  const permittedRegions = activeTenant.province.regencies.filter((r) =>
    permittedRegionIds.includes(r.id)
  );

  const accessibleModuleIds = new Set(accessibleModules.map((m) => m.module_id));
  const pendingApprovalCount = campaigns.filter((c) => c.status === 'Pending Approval').length;
  const activeNavItem = ALL_NAV_ITEMS.find((item) => item.routeId === activeRoute);

  const isPlatformAdmin = hasPermission(persona, 'admin.manage_tenants');
  const isTenantAdmin = hasPermission(persona, 'admin.view');

  const visibleEnterpriseAdminItems = isTenantAdmin
    ? ENTERPRISE_ADMIN_GROUP.items.filter((item) => {
        if (PLATFORM_ONLY_ROUTES.includes(item.routeId) && !isPlatformAdmin) return false;
        return accessibleModuleIds.has(ROUTE_TO_MODULE[item.routeId]);
      })
    : [];

  const renderNavButton = (item: SidebarNavItem, isMobile: boolean) => {
    const Icon = item.icon;
    const isActive = item.routeId === activeRoute;
    return (
      <button
        key={item.routeId}
        type="button"
        onClick={() => {
          navigateToRoute(item.routeId);
          if (isMobile) setMobileNavOpen(false);
        }}
        aria-current={isActive ? 'page' : undefined}
        title={sidebarCollapsed && !isMobile ? item.label : undefined}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
          isActive
            ? 'bg-[#1769AA] text-white'
            : 'text-slate-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0" />
          {(!sidebarCollapsed || isMobile) && (
            <span className="truncate whitespace-nowrap">{item.label}</span>
          )}
        </span>
        {(!sidebarCollapsed || isMobile) &&
          item.routeId === 'approval_inbox' &&
          pendingApprovalCount > 0 && (
            <span
              aria-label={`${pendingApprovalCount} pending approvals`}
              className={`shrink-0 font-mono text-[11px] font-semibold tabular-nums ${
                isActive ? 'text-white' : 'text-[#16A6BD]'
              }`}
            >
              {pendingApprovalCount}
            </span>
          )}
      </button>
    );
  };

  const sidebarContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col bg-[#102B4D] text-white">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#16A6BD] text-white">
            <Layers className="h-4 w-4" />
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <div className="min-w-0">
              <div className="truncate font-display text-base font-bold tracking-tight text-white">
                SERVEON
              </div>
              <div className="truncate text-[11px] text-slate-300">
                Enterprise AI Platform V2
              </div>
            </div>
          )}
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary workspaces" className="flex-1 space-y-4 overflow-y-auto px-3 py-3.5">
        {BUSINESS_SIDEBAR_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            accessibleModuleIds.has(ROUTE_TO_MODULE[item.routeId])
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.groupLabel} className="space-y-0.5">
              {(!sidebarCollapsed || isMobile) && (
                <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.groupLabel}
                </div>
              )}
              {visibleItems.map((item) => renderNavButton(item, isMobile))}
            </div>
          );
        })}

        {/* Dedicated Separated Enterprise Administration Console */}
        {visibleEnterpriseAdminItems.length > 0 && (
          <div className="space-y-0.5 border-t border-white/15 pt-3.5">
            {(!sidebarCollapsed || isMobile) && (
              <div className="mb-1.5 flex items-center justify-between px-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#16A6BD]">
                  Enterprise Administration
                </span>
                <span className="font-mono text-[9px] uppercase text-slate-400">
                  {isPlatformAdmin ? 'Platform' : 'Tenant'}
                </span>
              </div>
            )}
            {visibleEnterpriseAdminItems.map((item) => renderNavButton(item, isMobile))}
          </div>
        )}

        {isMobile && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div>
              <label htmlFor="mobile-industry-select" className="block text-[11px] text-slate-400">
                Industry Profile
              </label>
              <select
                id="mobile-industry-select"
                value={activeIndustry.id}
                onChange={(e) => setIndustryOverride(e.target.value as IndustryId)}
                className="mt-1 w-full rounded-md border border-white/15 bg-[#0A1D36] px-2.5 py-1.5 text-xs font-medium text-white"
              >
                {INDUSTRY_LIST.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mobile-region-select" className="block text-[11px] text-slate-400">
                Region Scope
              </label>
              <select
                id="mobile-region-select"
                value={filters.regionId}
                onChange={(e) => setFilters({ regionId: e.target.value })}
                className="mt-1 w-full rounded-md border border-white/15 bg-[#0A1D36] px-2.5 py-1.5 text-xs font-medium text-white"
              >
                {permittedRegions.length > 1 && (
                  <option value="ALL">All {activeTenant.primaryProvinceName}</option>
                )}
                {permittedRegions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </nav>

      {/* Active Persona / Scope Summary */}
      <div className="border-t border-white/10 p-3.5">
        {!sidebarCollapsed || isMobile ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor={isMobile ? 'mobile-role-switch' : 'sidebar-role-switch'}
                className="block text-[11px] text-slate-400"
              >
                Demo Persona (RBAC)
              </label>
              <select
                id={isMobile ? 'mobile-role-switch' : 'sidebar-role-switch'}
                value={persona.id}
                onChange={(e) => switchRole(e.target.value as UserRoleId)}
                className="mt-1 w-full rounded-md border border-white/15 bg-[#0A1D36] px-2.5 py-1.5 text-xs font-medium text-white focus:border-[#16A6BD] focus:outline-none"
              >
                {USER_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 truncate text-[11px] text-slate-300">
                {persona.name} · {persona.scopeLevel} scope
              </div>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit Demo Session</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={signOut}
            aria-label="Exit Demo Session"
            title="Exit Demo Session"
            className="flex w-full items-center justify-center rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F8FC] text-slate-900">
      {/* Desktop Left Sidebar (hidden during Location Intelligence fullscreen mode) */}
      {!isMapFullscreen && (
        <aside
          data-testid="app-sidebar"
          className={`hidden shrink-0 transition-[width] duration-200 lg:block ${
            sidebarCollapsed ? 'w-[72px]' : 'w-[258px]'
          }`}
        >
          <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
        </aside>
      )}

      {/* Mobile / Fullscreen Slide-Out Drawer Sidebar */}
      {mobileNavOpen && (
        <div className={`fixed inset-0 z-50 flex ${isMapFullscreen ? '' : 'lg:hidden'}`}>
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw]">{sidebarContent(true)}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-4 xl:gap-4 xl:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className={`inline-flex rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${
                isMapFullscreen ? '' : 'lg:hidden'
              }`}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
              <span className="font-semibold text-[#102B4D] whitespace-nowrap">SERVEON</span>
              <span className="text-slate-300">/</span>
              <span className="truncate font-medium text-slate-700">
                {activeNavItem?.label ?? 'Executive Dashboard'}
              </span>
              {isMapFullscreen && (
                <button
                  type="button"
                  onClick={() => setMapFullscreen(false)}
                  className="ml-1.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-[#102B4D] hover:bg-slate-100 whitespace-nowrap"
                >
                  Show Sidebar
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 xl:gap-2.5">
            {/* Tenant Selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="topbar-tenant-select"
                className="hidden text-xs font-medium text-slate-500 xl:inline whitespace-nowrap"
              >
                Tenant
              </label>
              <select
                id="topbar-tenant-select"
                aria-label="Select tenant"
                value={activeTenant.id}
                onChange={(e) => switchTenant(e.target.value)}
                disabled={!persona.canSwitchTenantInDemo}
                title={
                  persona.canSwitchTenantInDemo
                    ? 'Switch demonstration tenant'
                    : 'Tenant switching is restricted for scoped operational roles'
                }
                className="h-9 max-w-[125px] truncate rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-[#1769AA] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 xl:max-w-[175px] xl:px-2.5"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
            </div>

            {/* Industry Selector */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <label
                htmlFor="topbar-industry-select"
                className="hidden text-xs font-medium text-slate-500 xl:inline whitespace-nowrap"
              >
                Industry
              </label>
              <select
                id="topbar-industry-select"
                aria-label="Select industry profile"
                value={activeIndustry.id}
                onChange={(e) => setIndustryOverride(e.target.value as IndustryId)}
                className="h-9 max-w-[155px] truncate rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-[#1769AA] focus:outline-none xl:max-w-[215px] xl:px-2.5"
              >
                {INDUSTRY_LIST.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Region Selector */}
            <div className="hidden items-center gap-1.5 md:flex">
              <label
                htmlFor="topbar-region-select"
                className="hidden text-xs font-medium text-slate-500 xl:inline whitespace-nowrap"
              >
                Region
              </label>
              <select
                id="topbar-region-select"
                aria-label="Filter by region"
                value={filters.regionId}
                onChange={(e) => setFilters({ regionId: e.target.value })}
                className="h-9 max-w-[135px] truncate rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-[#1769AA] focus:outline-none xl:max-w-[185px] xl:px-2.5"
              >
                {permittedRegions.length > 1 && (
                  <option value="ALL">All {activeTenant.primaryProvinceName}</option>
                )}
                {permittedRegions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Contextual AI Insights Toggle */}
            <button
              type="button"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              aria-expanded={aiPanelOpen}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors whitespace-nowrap xl:gap-2 xl:px-3.5 ${
                aiPanelOpen
                  ? 'bg-[#102B4D] text-white'
                  : 'bg-[#1769AA] text-white hover:bg-[#102B4D]'
              }`}
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              <span>AI Insights</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Canvas */}
        <main
          className={
            isLocationRoute
              ? 'w-full flex-1 px-3 py-2.5 sm:px-4'
              : 'mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8'
          }
        >
          {children}
        </main>
      </div>

      {/* Contextual AI Slide-over Panel */}
      <ContextualAiPanel />

      {/* Toast Notification */}
      {toastMessage && (() => {
        const isRejection = /cannot|blocked|requires|only |invalid|denied|error/i.test(
          toastMessage
        );
        return (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium text-white shadow-lg ${
              isRejection
                ? 'border-rose-400/40 bg-rose-950'
                : 'border-slate-200 bg-[#102B4D]'
            }`}
          >
            {isRejection ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A6BD]" />
            )}
            <span>{toastMessage}</span>
          </div>
        );
      })()}
    </div>
  );
}

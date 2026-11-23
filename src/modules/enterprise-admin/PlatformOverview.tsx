import React, { useMemo } from 'react';
import {
  Building2,
  Blocks,
  Layers,
  ShieldCheck,
  Rocket,
  ArrowRight,
  Database,
  Cpu,
  Activity,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { computeEvidenceBasedReadiness } from '../../core/enterprise/mvp4Engine';

export function PlatformOverview() {
  const {
    tenants,
    activeTenant,
    tenantGovernanceByTenant,
    modulesByTenant,
    industryProfiles,
    readinessCategories,
    auditLogs,
    switchTenant,
    navigateToRoute,
    resetOnboardingDraft,
  } = usePlatform();

  const readiness = useMemo(
    () => computeEvidenceBasedReadiness(readinessCategories),
    [readinessCategories]
  );

  const activeTenantsCount = tenants.filter(
    (t) => (tenantGovernanceByTenant[t.id]?.status ?? 'Active') === 'Active'
  ).length;

  const publishedProfilesCount = industryProfiles.filter(
    (p) => p.lifecycleStatus === 'Published'
  ).length;

  const totalEnabledModules = useMemo(() => {
    return tenants.reduce((acc, t) => {
      const list = modulesByTenant[t.id] ?? [];
      return acc + list.filter((m) => m.enabled).length;
    }, 0);
  }, [tenants, modulesByTenant]);

  const handleLaunchRetailDemo = () => {
    resetOnboardingDraft('retail_demo');
    navigateToRoute('ent_tenants');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise Platform Administration · Shared Core Control Plane
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Platform Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Build once, configure per business, extend when required — govern tenants, industry
            profiles, reusable modules (BM01–BM10), AI models, and readiness from one control plane.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleLaunchRetailDemo}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#1769AA] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D]"
          >
            <Rocket className="h-4 w-4 shrink-0" />
            <span>Launch a New Business on SERVEON</span>
          </button>
          <button
            type="button"
            onClick={() => navigateToRoute('ent_readiness')}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ClipboardCheck className="h-4 w-4 shrink-0 text-[#1769AA]" />
            <span>Enterprise Readiness</span>
          </button>
        </div>
      </div>

      {/* Honest Demo Architecture Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <span className="font-semibold text-slate-800">Control Plane Scope Notice:</span>{' '}
          Multi-tenant orchestration, RBAC enforcement, and configuration workflows operate live in
          this browser session with local persistence. Production deployments require server-side
          OIDC/JWT authentication, database Row-Level Security (RLS), and backend secret vaults.
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Registered Tenants</span>
            <Building2 className="h-4 w-4 text-[#1769AA]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {tenants.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {activeTenantsCount} Active · {tenants.length - activeTenantsCount} Non-Active
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Industry Profiles</span>
            <Layers className="h-4 w-4 text-[#16A6BD]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {industryProfiles.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {publishedProfilesCount} Published · {industryProfiles.length - publishedProfilesCount} Draft/Archived
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Module Entitlements</span>
            <Blocks className="h-4 w-4 text-[#1769AA]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {totalEnabledModules}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            10 Reusable Modules (BM01–BM10)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Evidence-Backed Readiness</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {readiness.evidenceBackedScorePct}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {readiness.verifiedCount}/{readiness.totalItems} Verified · {readiness.blockedCount} Production Blockers
          </div>
        </div>
      </div>

      {/* Cross-Industry Demo Spotlight */}
      <div className="rounded-xl border border-slate-200 bg-[#102B4D] p-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A6BD]">
              Cross-Industry Multi-Tenant Demonstration
            </div>
            <h2 className="mt-1 font-display text-lg font-bold">
              Launch a New Retail Business on the Exact Same SERVEON Core Platform
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Prove industry-agnostic architecture in under 60 seconds: run the 9-Step Tenant
              Onboarding Wizard with our pre-filled Retail template (Karya Retail Nusantara),
              provision isolated Jakarta territories, Retail KPIs, and Loyalty rules, then switch
              directly into the new tenant workspace — zero core code duplication.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLaunchRetailDemo}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#16A6BD] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#138fa3]"
          >
            <span>Start Guided Retail Onboarding</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Control Plane Shortcuts + Tenant Fleet Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#102B4D]">
                Registered Enterprise Tenants
              </h2>
              <p className="text-xs text-slate-500">
                Active workspace: <span className="font-semibold text-slate-700">{activeTenant.name}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateToRoute('ent_tenants')}
              className="text-xs font-semibold text-[#1769AA] hover:underline"
            >
              Manage Tenants →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Province</th>
                  <th className="px-4 py-3">Lifecycle</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => {
                  const gov = tenantGovernanceByTenant[t.id];
                  const status = gov?.status ?? 'Active';
                  const isCurrent = t.id === activeTenant.id;
                  return (
                    <tr key={t.id} className={isCurrent ? 'bg-sky-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{t.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {t.code} · {t.businessUnits.length} BUs · {t.branches.length} Branches
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">{t.defaultIndustryId}</td>
                      <td className="px-4 py-3 text-slate-600">{t.primaryProvinceName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                            status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : status === 'Suspended'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isCurrent ? (
                          <span className="text-[11px] font-semibold text-[#1769AA]">Active Context</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              switchTenant(t.id);
                              navigateToRoute('executive');
                            }}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Enter Workspace
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Control Plane Quick Access */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-semibold text-[#102B4D]">
              Control Plane Modules
            </h2>
            <div className="mt-3 space-y-2">
              {[
                {
                  route: 'ent_industries' as const,
                  title: 'Industry Profile Builder',
                  meta: `${industryProfiles.length} profiles · Schema & KPIs`,
                  icon: Layers,
                },
                {
                  route: 'ent_marketplace' as const,
                  title: 'Module Marketplace (BM01–BM10)',
                  meta: 'Dependency graph & per-tenant config',
                  icon: Blocks,
                },
                {
                  route: 'ent_integrations' as const,
                  title: 'Data Integration Hub',
                  meta: 'Validated CSV import & connectors',
                  icon: Database,
                },
                {
                  route: 'ent_ai_governance' as const,
                  title: 'Enterprise AI Governance',
                  meta: '7-state model registry & approvals',
                  icon: Cpu,
                },
                {
                  route: 'ent_monitoring' as const,
                  title: 'Platform Monitoring',
                  meta: 'Simulated operations & job health',
                  icon: Activity,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => navigateToRoute(item.route)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-left transition-colors hover:border-[#1769AA] hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#1769AA]" />
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                        <div className="text-[11px] text-slate-500">{item.meta}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#102B4D]">
                Recent Governance Audit
              </h2>
              <button
                type="button"
                onClick={() => navigateToRoute('ent_security_audit')}
                className="text-[11px] font-semibold text-[#1769AA] hover:underline"
              >
                Full Ledger
              </button>
            </div>
            <div className="mt-3 space-y-2.5">
              {auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-slate-800">{log.action}</span>
                    <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {log.actorName} · {log.category} · {log.outcome ?? 'Success'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

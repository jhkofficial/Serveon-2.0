import React, { useState } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Building2,
  Layers,
  History,
  Sliders,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { INDUSTRY_LIST } from '../../core/industry-config/profiles';
import { USER_PERSONAS, hasPermission } from '../../core/permissions/rbac';
import { canDisableModule, canEnableModule } from '../../core/module-registry/registry';
import type { IndustryId, ModuleDefinition } from '../../types/platform';

type AdminTab = 'modules' | 'industry' | 'tenants_rbac' | 'audit';

export function AdminConsole() {
  const {
    persona,
    tenants,
    activeTenant,
    activeIndustry,
    modules,
    auditLogs,
    toggleModule,
    setIndustryOverride,
    switchTenant,
    resetDemoData,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<AdminTab>('modules');
  const [confirmToggle, setConfirmToggle] = useState<{
    mod: ModuleDefinition;
    nextEnabled: boolean;
  } | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [selectedIndustryPreview, setSelectedIndustryPreview] = useState<IndustryId>(
    activeIndustry.id
  );

  const canManageModules = hasPermission(persona, 'admin.manage_modules');
  const canManageIndustry = hasPermission(persona, 'admin.manage_industry');

  const previewProfile =
    INDUSTRY_LIST.find((p) => p.id === selectedIndustryPreview) ?? activeIndustry;

  function requestModuleToggle(mod: ModuleDefinition, nextEnabled: boolean) {
    setToggleError(null);
    const check = nextEnabled
      ? canEnableModule(modules, mod.module_id)
      : canDisableModule(modules, mod.module_id);
    if (!check.allowed) {
      setToggleError(check.reason ?? 'Dependency policy blocked this module state change.');
      return;
    }
    setConfirmToggle({ mod, nextEnabled });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin & Platform Configuration"
        subtitle={`Module Registry, Industry Configuration Console, Tenant Hierarchy, RBAC, and Audit History for ${activeTenant.shortName}.`}
        metaItems={[
          'BM08',
          `Tenant: ${activeTenant.code}`,
          `Industry Profile: ${activeIndustry.name}`,
          `Actor: ${persona.title}`,
        ]}
        actions={
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:border-[#D9534F] hover:text-[#D9534F] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo Data</span>
          </button>
        }
      />

      {/* Admin Sub-Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Administration sections"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5"
      >
        {(
          [
            { id: 'modules', label: 'Module Registry', icon: Layers },
            { id: 'industry', label: 'Industry Configuration', icon: Sliders },
            { id: 'tenants_rbac', label: 'Tenants & RBAC Matrix', icon: Building2 },
            { id: 'audit', label: 'Audit & Activity Log', icon: History },
          ] as Array<{
            id: AdminTab;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }>
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => {
                setActiveTab(t.id);
                setToggleError(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[#102B4D] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MODULE REGISTRY */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {toggleError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B47815]" />
              <div>
                <div className="font-semibold">Module Dependency Constraint</div>
                <p className="mt-0.5">{toggleError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {modules.map((mod) => {
              const protectedCore = mod.module_id === 'BM01' || mod.module_id === 'BM08';
              return (
                <div
                  key={mod.module_id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-medium text-slate-500">
                          {mod.module_id} · v{mod.module_version} · {mod.category}
                        </div>
                        <h3 className="mt-0.5 text-base font-semibold text-slate-900">
                          {mod.module_name}
                        </h3>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={mod.enabled}
                        aria-label={`Toggle ${mod.module_id} ${mod.module_name}`}
                        disabled={!canManageModules || protectedCore}
                        onClick={() => requestModuleToggle(mod, !mod.enabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                          mod.enabled ? 'bg-[#1769AA]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            mod.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {mod.module_description}
                    </p>
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <div className="flex justify-between gap-2">
                      <span>Dependencies:</span>
                      <span className="font-mono text-slate-800">
                        {mod.dependencies.length > 0 ? mod.dependencies.join(', ') : 'None (Core)'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Status:</span>
                      <span
                        className={
                          mod.enabled
                            ? 'font-semibold text-[#15946A]'
                            : 'font-semibold text-slate-500'
                        }
                      >
                        {mod.enabled ? 'Enabled in Navigation' : 'Disabled for Tenant'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INDUSTRY CONFIGURATION CONSOLE */}
      {activeTab === 'industry' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 6 Industry Profile Selector List */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-4">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Industry Profiles (6)</h2>
              <p className="text-xs text-slate-500">
                Configuration packages decoupled from tenant security boundaries.
              </p>
            </div>
            <div className="divide-y divide-slate-200">
              {INDUSTRY_LIST.map((profile) => {
                const isApplied = profile.id === activeIndustry.id;
                const isViewing = profile.id === selectedIndustryPreview;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setSelectedIndustryPreview(profile.id)}
                    className={`block w-full px-5 py-3.5 text-left transition-colors ${
                      isViewing ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{profile.name}</span>
                      {isApplied && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15946A]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {profile.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Industry Profile Details */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-xs font-medium text-[#1769AA]">
                  Example Industry Configuration · Not Validated Production Analytics
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {previewProfile.name} Profile
                </h2>
                <p className="mt-1 text-xs text-slate-600">{previewProfile.description}</p>
              </div>
              {canManageIndustry && previewProfile.id !== activeIndustry.id && (
                <button
                  type="button"
                  onClick={() => setIndustryOverride(previewProfile.id)}
                  className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D] whitespace-nowrap"
                >
                  Apply {previewProfile.name} to {activeTenant.shortName}
                </button>
              )}
            </div>

            {/* Terminology Mapping */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Business Terminology Mapping</h3>
              <dl className="mt-2.5 grid grid-cols-2 gap-3 rounded-lg bg-[#F5F8FC] p-4 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Customer Entity</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.customerPlural}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Operational Unit</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.branchPlural}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Primary Revenue KPI</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.primaryRevenueLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Retention KPI</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.retentionMetricLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Product Concept</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.productPlural}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Transaction Concept</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {previewProfile.terminology.transactionPlural}
                  </dd>
                </div>
              </dl>
            </div>

            {/* KPI Definitions */}
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Configured Business KPIs</h3>
              <div className="mt-2.5 divide-y divide-slate-100 border-t border-slate-100 text-xs">
                {previewProfile.kpiDefinitions.map((kpi) => (
                  <div key={kpi.key} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{kpi.label}</span>
                      <span className="font-mono text-[11px] text-[#1769AA]">{kpi.targetBenchmark}</span>
                    </div>
                    <p className="mt-0.5 text-slate-600">{kpi.formulaDescription}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lifecycle & Extension Schema */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Customer Lifecycle Model</h3>
                <ol className="mt-2 space-y-1.5 text-xs text-slate-700">
                  {previewProfile.lifecycleStages.map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">0{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Extension Data Attributes</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                  {previewProfile.extensionAttributes.map((attr) => (
                    <li key={attr.key} className="flex items-center justify-between">
                      <span>{attr.label}</span>
                      <span className="font-mono text-[11px] text-slate-400">{attr.dataType}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TENANTS & RBAC MATRIX */}
      {activeTab === 'tenants_rbac' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Multi-Tenant Organizational Hierarchy
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              SERVEON Platform → Tenant / Company → Business Unit → Region → Branch / Operational Unit
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {tenants.map((t) => {
                const isCurrent = t.id === activeTenant.id;
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-4 ${
                      isCurrent ? 'border-[#1769AA] bg-[#F0F7FC]/50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-[11px] text-slate-500">{t.code}</div>
                        <div className="text-sm font-bold text-slate-900">{t.name}</div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {t.primaryProvinceName}, {t.country} · {t.seedCount.toLocaleString()} demo records
                        </div>
                      </div>
                      {!isCurrent && persona.canSwitchTenantInDemo && (
                        <button
                          type="button"
                          onClick={() => switchTenant(t.id)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA]"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-600">
                      {t.businessUnits.length} Business Units · {t.province.regencies.length} Regions ·{' '}
                      {t.branches.length} Branches
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1769AA]" />
              <h2 className="text-base font-semibold text-slate-900">
                Role-Based Access Control (RBAC) Matrix
              </h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Persona</th>
                    <th className="px-3 py-2.5 font-semibold">Scope Boundary</th>
                    <th className="px-3 py-2.5 font-semibold">Campaign Approval</th>
                    <th className="px-3 py-2.5 font-semibold">Admin Console</th>
                    <th className="py-2.5 pl-3 font-semibold">Key Governance Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {USER_PERSONAS.map((p) => (
                    <tr key={p.id} className={p.id === persona.id ? 'bg-[#F0F7FC]' : undefined}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">{p.title}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">{p.scopeLevel}</td>
                      <td className="px-3 py-2.5">
                        {p.permissions.includes('campaigns.approve') ? 'Authorized' : 'No'}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.permissions.includes('admin.view') ? 'Authorized' : 'Restricted'}
                      </td>
                      <td className="py-2.5 pl-3 text-slate-600">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT & ACTIVITY LOG */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">Audit &amp; Activity Log</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tracks authentication switches, module toggles, industry configuration updates, campaign
            workflows, and AI assistant queries.
          </p>

          <div className="mt-4 divide-y divide-slate-200">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#1769AA]">{log.category}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-semibold text-slate-900">{log.action}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {log.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{log.details}</p>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {log.actorName} ({log.actorRole})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Toggle Module */}
      {confirmToggle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-module-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="confirm-module-title" className="text-base font-bold text-slate-900">
              {confirmToggle.nextEnabled ? 'Enable' : 'Disable'} {confirmToggle.mod.module_id}?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {confirmToggle.nextEnabled
                ? `Activating ${confirmToggle.mod.module_name} will immediately expose it in tenant navigation for permitted roles.`
                : `Disabling ${confirmToggle.mod.module_name} will immediately remove it from navigation for ${activeTenant.shortName}.`}
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmToggle(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = toggleModule(confirmToggle.mod.module_id, confirmToggle.nextEnabled);
                  if (!res.ok) setToggleError(res.message);
                  setConfirmToggle(null);
                }}
                className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Reset Demo Data */}
      {confirmResetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="confirm-reset-title" className="text-base font-bold text-slate-900">
              Reset All SERVEON Demo Data?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              This restores the seeded datasets, resets all Module Registry states to defaults,
              clears custom industry overrides, and restores initial campaigns.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmResetOpen(false);
                }}
                className="rounded-lg bg-[#D9534F] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

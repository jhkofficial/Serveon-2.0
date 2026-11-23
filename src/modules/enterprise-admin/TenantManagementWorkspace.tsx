import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  PauseCircle,
  PlayCircle,
  Archive,
  X,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { IndustryId, ModuleId, Tenant } from '../../types/platform';
import type { TenantLifecycleStatus } from '../../types/mvp4';
import {
  MARKETPLACE_CATALOG,
  PROVINCE_TEMPLATE_OPTIONS,
  getProvinceTemplate,
  validateOnboardingStep,
} from '../../core/enterprise/mvp4Engine';
import { DEFAULT_MODULE_REGISTRY } from '../../core/module-registry/registry';
import { getIndustryProfile } from '../../core/industry-config/profiles';

const WIZARD_STEPS = [
  { num: 1, title: 'Company Info' },
  { num: 2, title: 'Industry Profile' },
  { num: 3, title: 'Org & Branches' },
  { num: 4, title: 'Module Selection' },
  { num: 5, title: 'KPIs & Rules' },
  { num: 6, title: 'Data Setup' },
  { num: 7, title: 'Users & Security' },
  { num: 8, title: 'Pre-Flight Check' },
  { num: 9, title: 'Activate Tenant' },
];

export function TenantManagementWorkspace() {
  const {
    tenants,
    activeTenant,
    tenantGovernanceByTenant,
    onboardingDraft,
    industryProfiles,
    updateOnboardingDraft,
    resetOnboardingDraft,
    completeTenantOnboarding,
    updateTenantLifecycle,
    switchTenant,
    navigateToRoute,
  } = usePlatform();

  const [wizardOpen, setWizardOpen] = useState(() => Boolean(onboardingDraft.companyName.trim()));
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenantLifecycleStatus>('ALL');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    tenant: Tenant;
    nextStatus: TenantLifecycleStatus;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [newlyActivatedTenant, setNewlyActivatedTenant] = useState<Tenant | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const st = tenantGovernanceByTenant[t.id]?.status ?? 'Active';
      return statusFilter === 'ALL' || st === statusFilter;
    });
  }, [tenants, tenantGovernanceByTenant, statusFilter]);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  );

  const selectedProvince = useMemo(
    () => getProvinceTemplate(onboardingDraft.provinceTemplateId),
    [onboardingDraft.provinceTemplateId]
  );

  const selectedIndustryMeta = useMemo(
    () => getIndustryProfile(onboardingDraft.industryId),
    [onboardingDraft.industryId]
  );

  const publishedProfiles = useMemo(
    () => industryProfiles.filter((p) => p.lifecycleStatus !== 'Archived'),
    [industryProfiles]
  );

  const preflightCheck = useMemo(
    () => validateOnboardingStep(onboardingDraft, 8, tenants),
    [onboardingDraft, tenants]
  );

  const handleNextStep = () => {
    const check = validateOnboardingStep(onboardingDraft, onboardingDraft.step, tenants);
    if (!check.valid) {
      setStepErrors(check.errors);
      return;
    }
    setStepErrors([]);
    updateOnboardingDraft({ step: Math.min(9, onboardingDraft.step + 1) });
  };

  const handleFinishProvision = () => {
    const res = completeTenantOnboarding();
    if (!res.ok || !res.tenant) {
      setStepErrors([res.message]);
      return;
    }
    setStepErrors([]);
    setNewlyActivatedTenant(res.tenant);
    setWizardOpen(false);
  };

  const toggleWizardModule = (modId: ModuleId) => {
    if (MARKETPLACE_CATALOG[modId]?.moduleStatus === 'Core Protected') return;
    const exists = onboardingDraft.selectedModules.includes(modId);
    const next = exists
      ? onboardingDraft.selectedModules.filter((id) => id !== modId)
      : [...onboardingDraft.selectedModules, modId];
    updateOnboardingDraft({ selectedModules: next });
  };

  const toggleWizardKpi = (kpiKey: string) => {
    const exists = onboardingDraft.selectedKpiKeys.includes(kpiKey);
    const next = exists
      ? onboardingDraft.selectedKpiKeys.filter((k) => k !== kpiKey)
      : [...onboardingDraft.selectedKpiKeys, kpiKey];
    updateOnboardingDraft({ selectedKpiKeys: next });
  };

  const executeConfirmedLifecycle = () => {
    if (!confirmAction) return;
    updateTenantLifecycle(confirmAction.tenant.id, confirmAction.nextStatus, confirmNote);
    setConfirmAction(null);
    setConfirmNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise Platform Administration · Multi-Tenant Control Plane
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Tenant Management &amp; Guided Onboarding
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Provision new businesses across industries with isolated datasets, module entitlements,
            organizational hierarchies, and lifecycle governance.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              resetOnboardingDraft('retail_demo');
              setStepErrors([]);
              setWizardOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#16A6BD] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#138fa3]"
          >
            <Rocket className="h-4 w-4 shrink-0" />
            <span>Load Retail Business Demo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetOnboardingDraft('blank');
              setStepErrors([]);
              setWizardOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#1769AA] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Onboard New Tenant</span>
          </button>
        </div>
      </div>

      {/* Newly Provisioned Tenant Success Banner */}
      {newlyActivatedTenant && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <div className="text-sm font-semibold text-emerald-950">
                Tenant Activated: {newlyActivatedTenant.name} ({newlyActivatedTenant.code})
              </div>
              <div className="mt-0.5 text-xs text-emerald-800">
                Provisioned isolated {newlyActivatedTenant.defaultIndustryId} configuration in{' '}
                {newlyActivatedTenant.primaryProvinceName} with{' '}
                {newlyActivatedTenant.businessUnits.length} Business Units,{' '}
                {newlyActivatedTenant.branches.length} Operational Branches, and{' '}
                {newlyActivatedTenant.seedCount} synthetic demo records.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                switchTenant(newlyActivatedTenant.id);
                navigateToRoute('executive');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <span>Enter New Tenant Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setNewlyActivatedTenant(null)}
              aria-label="Dismiss activation banner"
              className="rounded p-1.5 text-emerald-700 hover:bg-emerald-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 9-STEP GUIDED TENANT ONBOARDING WIZARD */}
      {wizardOpen && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-slate-200 bg-[#102B4D] px-5 py-4 text-white">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A6BD]">
                9-Step Guided Tenant Onboarding Wizard
              </div>
              <h2 className="font-display text-base font-bold">
                Step {onboardingDraft.step} of 9 — {WIZARD_STEPS[onboardingDraft.step - 1]?.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => resetOnboardingDraft('retail_demo')}
                className="rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-white/10"
              >
                Pre-fill Retail Demo
              </button>
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-md border border-white/20 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-white/10"
              >
                Save Draft &amp; Close
              </button>
            </div>
          </div>

          {/* Stepper Bar */}
          <div className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 px-5 py-3 sm:grid-cols-9">
            {WIZARD_STEPS.map((st) => {
              const isCurrent = st.num === onboardingDraft.step;
              const isDone = st.num < onboardingDraft.step;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => {
                    if (st.num <= onboardingDraft.step) {
                      setStepErrors([]);
                      updateOnboardingDraft({ step: st.num });
                    }
                  }}
                  className={`flex flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors ${
                    isCurrent
                      ? 'bg-[#1769AA] text-white'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'text-slate-400'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold">0{st.num}</span>
                  <span className="w-full truncate text-[10px] font-medium">{st.title}</span>
                </button>
              );
            })}
          </div>

          {/* Validation Errors */}
          {stepErrors.length > 0 && (
            <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <div className="font-semibold">Please resolve before continuing:</div>
              <ul className="mt-1 list-disc pl-4">
                {stepErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step Content */}
          <div className="p-5">
            {onboardingDraft.step === 1 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Company / Enterprise Name *
                  </label>
                  <input
                    type="text"
                    value={onboardingDraft.companyName}
                    onChange={(e) => updateOnboardingDraft({ companyName: e.target.value })}
                    placeholder="e.g. Karya Retail Nusantara"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Short Workspace Name *
                  </label>
                  <input
                    type="text"
                    value={onboardingDraft.shortName}
                    onChange={(e) => updateOnboardingDraft({ shortName: e.target.value })}
                    placeholder="e.g. Karya Retail"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Unique Tenant Code *
                  </label>
                  <input
                    type="text"
                    value={onboardingDraft.tenantCode}
                    onChange={(e) =>
                      updateOnboardingDraft({ tenantCode: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. KRN-RET"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs uppercase text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Primary Province &amp; Subscription Plan
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <select
                      value={onboardingDraft.provinceTemplateId}
                      onChange={(e) =>
                        updateOnboardingDraft({
                          provinceTemplateId: e.target
                            .value as typeof onboardingDraft.provinceTemplateId,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                    >
                      {PROVINCE_TEMPLATE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={onboardingDraft.subscriptionPlan}
                      onChange={(e) =>
                        updateOnboardingDraft({
                          subscriptionPlan: e.target
                            .value as typeof onboardingDraft.subscriptionPlan,
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="Enterprise Core">Enterprise Core</option>
                      <option value="Enterprise AI Suite">Enterprise AI Suite</option>
                      <option value="Multi-BU Sovereign">Multi-BU Sovereign</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Business Description
                  </label>
                  <textarea
                    rows={2}
                    value={onboardingDraft.description}
                    onChange={(e) => updateOnboardingDraft({ description: e.target.value })}
                    placeholder="Describe the business portfolio, channels, and primary intelligence objectives..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {onboardingDraft.step === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Select a published Industry Profile to automatically configure terminology, KPIs,
                  schema extensions, and Next-Best-Action templates without touching core code.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {publishedProfiles.map((prof) => {
                    const selected = onboardingDraft.industryProfileId === prof.profileId;
                    return (
                      <button
                        key={prof.profileId}
                        type="button"
                        onClick={() =>
                          updateOnboardingDraft({
                            industryId: prof.baseIndustryId as IndustryId,
                            industryProfileId: prof.profileId,
                            selectedKpiKeys: prof.kpiDefinitions.map((k) => k.key),
                          })
                        }
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          selected
                            ? 'border-[#1769AA] bg-sky-50/70'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm font-bold text-[#102B4D]">
                            {prof.name}
                          </span>
                          <span className="font-mono text-[10px] font-semibold text-slate-500">
                            v{prof.version} · {prof.lifecycleStatus}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                          {prof.description}
                        </p>
                        <div className="mt-2.5 text-[11px] text-slate-500">
                          {prof.kpiDefinitions.length} KPIs · {prof.schemaExtensions.length}{' '}
                          Extensions · {prof.terminology.customerPlural}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {onboardingDraft.step === 3 && (
              <div className="space-y-5">
                {/* Business Units */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#102B4D]">
                      Business Units ({onboardingDraft.businessUnits.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateOnboardingDraft({
                          businessUnits: [
                            ...onboardingDraft.businessUnits,
                            {
                              name: `Business Unit ${onboardingDraft.businessUnits.length + 1}`,
                              code: `BU${onboardingDraft.businessUnits.length + 1}`,
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add BU</span>
                    </button>
                  </div>
                  {onboardingDraft.businessUnits.map((bu, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12"
                    >
                      <div className="sm:col-span-7">
                        <input
                          type="text"
                          value={bu.name}
                          onChange={(e) =>
                            updateOnboardingDraft({
                              businessUnits: onboardingDraft.businessUnits.map((item, i) =>
                                i === idx ? { ...item, name: e.target.value } : item
                              ),
                            })
                          }
                          placeholder="Business Unit Name"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          value={bu.code}
                          onChange={(e) =>
                            updateOnboardingDraft({
                              businessUnits: onboardingDraft.businessUnits.map((item, i) =>
                                i === idx
                                  ? { ...item, code: e.target.value.toUpperCase() }
                                  : item
                              ),
                            })
                          }
                          placeholder="CODE"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs uppercase"
                        />
                      </div>
                      <div className="flex items-center justify-end sm:col-span-2">
                        {onboardingDraft.businessUnits.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateOnboardingDraft({
                                businessUnits: onboardingDraft.businessUnits.filter(
                                  (_, i) => i !== idx
                                ),
                              })
                            }
                            className="text-xs font-medium text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Operational Branches */}
                <div className="space-y-2.5 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#102B4D]">
                      Initial Operational Branches in {selectedProvince.name} (
                      {onboardingDraft.initialBranches.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateOnboardingDraft({
                          initialBranches: [
                            ...onboardingDraft.initialBranches,
                            {
                              name: `${onboardingDraft.shortName || 'Unit'} Branch ${onboardingDraft.initialBranches.length + 1}`,
                              code: `BR-0${onboardingDraft.initialBranches.length + 1}`,
                              regionIndex:
                                onboardingDraft.initialBranches.length %
                                selectedProvince.regencies.length,
                              buIndex: 0,
                              type: selectedIndustryMeta.terminology.branchSingular,
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Branch</span>
                    </button>
                  </div>

                  {onboardingDraft.initialBranches.map((br, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12"
                    >
                      <input
                        type="text"
                        value={br.name}
                        onChange={(e) =>
                          updateOnboardingDraft({
                            initialBranches: onboardingDraft.initialBranches.map((item, i) =>
                              i === idx ? { ...item, name: e.target.value } : item
                            ),
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
                      />
                      <input
                        type="text"
                        value={br.code}
                        onChange={(e) =>
                          updateOnboardingDraft({
                            initialBranches: onboardingDraft.initialBranches.map((item, i) =>
                              i === idx ? { ...item, code: e.target.value.toUpperCase() } : item
                            ),
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs uppercase sm:col-span-2"
                      />
                      <select
                        value={br.regionIndex}
                        onChange={(e) =>
                          updateOnboardingDraft({
                            initialBranches: onboardingDraft.initialBranches.map((item, i) =>
                              i === idx ? { ...item, regionIndex: Number(e.target.value) } : item
                            ),
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-3"
                      >
                        {selectedProvince.regencies.map((reg, rIdx) => (
                          <option key={reg.id} value={rIdx}>
                            {reg.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={br.buIndex}
                        onChange={(e) =>
                          updateOnboardingDraft({
                            initialBranches: onboardingDraft.initialBranches.map((item, i) =>
                              i === idx ? { ...item, buIndex: Number(e.target.value) } : item
                            ),
                          })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-3"
                      >
                        {onboardingDraft.businessUnits.map((bu, bIdx) => (
                          <option key={bIdx} value={bIdx}>
                            {bu.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {onboardingDraft.step === 4 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Choose which reusable business modules (BM01–BM10) to enable for this tenant.
                  Dependencies are verified automatically.
                </p>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {DEFAULT_MODULE_REGISTRY.map((mod) => {
                    const checked = onboardingDraft.selectedModules.includes(mod.module_id);
                    const isCore =
                      MARKETPLACE_CATALOG[mod.module_id]?.moduleStatus === 'Core Protected';
                    return (
                      <label
                        key={mod.module_id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                          checked ? 'border-[#1769AA] bg-sky-50/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isCore}
                          onChange={() => toggleWizardModule(mod.module_id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1769AA]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              <span className="font-mono text-[#1769AA]">{mod.module_id}</span> ·{' '}
                              {mod.module_name}
                            </span>
                            {isCore && (
                              <span className="text-[10px] font-semibold uppercase text-slate-500">
                                Core
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Depends on:{' '}
                            {mod.dependencies.length > 0 ? mod.dependencies.join(', ') : 'None'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {onboardingDraft.step === 5 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Select Executive KPIs and configure Next-Best-Action business rules for{' '}
                  <span className="font-semibold text-slate-900">{selectedIndustryMeta.name}</span>.
                </p>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {selectedIndustryMeta.kpiDefinitions.map((kpi) => {
                    const checked = onboardingDraft.selectedKpiKeys.includes(kpi.key);
                    return (
                      <label
                        key={kpi.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                          checked ? 'border-[#1769AA] bg-sky-50/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWizardKpi(kpi.key)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1769AA]"
                        />
                        <div className="text-xs">
                          <div className="font-semibold text-slate-900">
                            {kpi.label} ({kpi.unit})
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            {kpi.formulaDescription}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tenant Business Rule Guidance Note
                  </label>
                  <input
                    type="text"
                    value={onboardingDraft.customBusinessRuleNote}
                    onChange={(e) =>
                      updateOnboardingDraft({ customBusinessRuleNote: e.target.value })
                    }
                    placeholder="e.g. Trigger VIP loyalty recovery when churn risk >= 70..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {onboardingDraft.step === 6 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Initial Data Source Mode
                  </label>
                  <select
                    value={onboardingDraft.dataSourceMode}
                    onChange={(e) =>
                      updateOnboardingDraft({
                        dataSourceMode: e.target.value as typeof onboardingDraft.dataSourceMode,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="Synthetic Demo Dataset">
                      Synthetic Demo Dataset (Immediate Isolated Seed)
                    </option>
                    <option value="Validated CSV Import">
                      Synthetic Baseline + Validated CSV Import Ready
                    </option>
                    <option value="Connector Pending">
                      External Connector Pending (Not Connected)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Synthetic Customer Seed Volume (50 – 1,000)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    step={50}
                    value={onboardingDraft.seedRecordCount}
                    onChange={(e) =>
                      updateOnboardingDraft({ seedRecordCount: Number(e.target.value) || 350 })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 md:col-span-2">
                  All records are strictly tagged with the new tenant&apos;s unique{' '}
                  <span className="font-mono font-semibold text-slate-800">tenant_id</span> and
                  isolated from existing Automotive, Retail, Property, and Banking tenants.
                </div>
              </div>
            )}

            {onboardingDraft.step === 7 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Primary Tenant Administrator Name *
                  </label>
                  <input
                    type="text"
                    value={onboardingDraft.adminName}
                    onChange={(e) => updateOnboardingDraft({ adminName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tenant Administrator Email *
                  </label>
                  <input
                    type="email"
                    value={onboardingDraft.adminEmail}
                    onChange={(e) => updateOnboardingDraft({ adminEmail: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={onboardingDraft.requireMfa}
                      onChange={(e) => updateOnboardingDraft({ requireMfa: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-[#1769AA]"
                    />
                    <span>Require MFA for Tenant &amp; Platform Administrators</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={onboardingDraft.enforceRegionalScope}
                      onChange={(e) =>
                        updateOnboardingDraft({ enforceRegionalScope: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#1769AA]"
                    />
                    <span>Enforce regional and branch data scope for frontline roles</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={onboardingDraft.maskPii}
                      onChange={(e) => updateOnboardingDraft({ maskPii: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-[#1769AA]"
                    />
                    <span>Mask customer email &amp; phone PII in operational tables</span>
                  </label>
                </div>
              </div>
            )}

            {onboardingDraft.step === 8 && (
              <div className="space-y-4">
                <div
                  className={`rounded-lg border p-4 text-xs ${
                    preflightCheck.valid
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {preflightCheck.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>
                      {preflightCheck.valid
                        ? 'Pre-Flight Validation Passed — Ready for Transactional Provisioning'
                        : `Found ${preflightCheck.errors.length} Blocking Issue(s)`}
                    </span>
                  </div>
                  {preflightCheck.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-5">
                      {preflightCheck.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {preflightCheck.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-amber-800">
                      {preflightCheck.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  Verified tenant uniqueness, module dependency integrity (BM01–BM10), industry KPI
                  binding, and initial administrator identity. Advance to Step 9 to review and
                  activate.
                </div>
              </div>
            )}

            {onboardingDraft.step === 9 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Company &amp; Industry
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {onboardingDraft.companyName} ({onboardingDraft.tenantCode})
                    </div>
                    <div className="mt-0.5 capitalize text-slate-600">
                      Industry: {onboardingDraft.industryId} · Plan:{' '}
                      {onboardingDraft.subscriptionPlan}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Organization &amp; Geography
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {selectedProvince.name}
                    </div>
                    <div className="mt-0.5 text-slate-600">
                      {onboardingDraft.businessUnits.length} Business Units ·{' '}
                      {onboardingDraft.initialBranches.length} Branches
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-slate-500">
                      Modules &amp; Seed Data
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {onboardingDraft.selectedModules.length} Enabled Modules
                    </div>
                    <div className="mt-0.5 text-slate-600">
                      {onboardingDraft.seedRecordCount} isolated synthetic records · Admin:{' '}
                      {onboardingDraft.adminName}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  Clicking{' '}
                  <span className="font-semibold text-slate-900">
                    Provision &amp; Activate Tenant
                  </span>{' '}
                  executes a transactional setup creating the tenant profile, organizational tree,
                  module entitlements, governance rules, connectors, and audit trail entry.
                </div>
              </div>
            )}
          </div>

          {/* Wizard Footer */}
          <div className="flex items-center justify-between rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3.5">
            <button
              type="button"
              onClick={() => {
                setStepErrors([]);
                if (onboardingDraft.step === 1) {
                  setWizardOpen(false);
                } else {
                  updateOnboardingDraft({ step: onboardingDraft.step - 1 });
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{onboardingDraft.step === 1 ? 'Cancel' : 'Back'}</span>
            </button>

            {onboardingDraft.step < 9 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                <span>Next Step</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishProvision}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Provision &amp; Activate Tenant</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tenant Directory */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#1769AA]" />
            <h2 className="font-display text-base font-semibold text-[#102B4D]">
              Enterprise Tenant Directory ({filteredTenants.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {(['ALL', 'Active', 'Suspended', 'Archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  statusFilter === st
                    ? 'bg-[#102B4D] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Company &amp; Code</th>
                <th className="px-4 py-3">Industry Profile</th>
                <th className="px-4 py-3">Plan &amp; Geography</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTenants.map((tenant) => {
                const gov = tenantGovernanceByTenant[tenant.id];
                const status = gov?.status ?? 'Active';
                const isActiveCtx = tenant.id === activeTenant.id;
                return (
                  <tr key={tenant.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{tenant.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {tenant.code} · {tenant.businessUnits.length} BUs · {tenant.branches.length}{' '}
                        Units
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium capitalize text-slate-800">
                        {tenant.defaultIndustryId}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Profile: {gov?.industryProfileId ?? `ind-${tenant.defaultIndustryId}`} (v
                        {gov?.industryProfileVersion ?? 1})
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{tenant.primaryProvinceName}</div>
                      <div className="text-[11px] text-slate-500">
                        {gov?.subscriptionPlan ?? 'Enterprise AI Suite'}
                      </div>
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTenantId(tenant.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect</span>
                        </button>
                        {status === 'Active' && !isActiveCtx && (
                          <button
                            type="button"
                            onClick={() => {
                              switchTenant(tenant.id);
                              navigateToRoute('executive');
                            }}
                            className="rounded bg-[#1769AA] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#102B4D]"
                          >
                            Switch To
                          </button>
                        )}
                        {status === 'Active' && !isActiveCtx && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ tenant, nextStatus: 'Suspended' })}
                            title="Suspend tenant"
                            className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
                          >
                            <PauseCircle className="h-3 w-3" />
                            <span>Suspend</span>
                          </button>
                        )}
                        {status !== 'Active' && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ tenant, nextStatus: 'Active' })}
                            className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            <PlayCircle className="h-3 w-3" />
                            <span>Activate</span>
                          </button>
                        )}
                        {status !== 'Archived' && !isActiveCtx && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ tenant, nextStatus: 'Archived' })}
                            title="Archive tenant"
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <Archive className="h-3 w-3" />
                            <span>Archive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Inspection Drawer */}
      {selectedTenant && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-[#102B4D]">
                {selectedTenant.name} ({selectedTenant.code})
              </h3>
              <p className="text-xs text-slate-500">{selectedTenant.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTenantId(null)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
            <div>
              <div className="font-semibold text-slate-700">Security &amp; Isolation Policy</div>
              <div className="mt-1 space-y-1 text-slate-600">
                <div>
                  MFA for Admins:{' '}
                  <span className="font-semibold">
                    {tenantGovernanceByTenant[selectedTenant.id]?.securityPolicy.requireMfaForAdmins
                      ? 'Required'
                      : 'Optional'}
                  </span>
                </div>
                <div>
                  Session Timeout:{' '}
                  <span className="font-mono">
                    {tenantGovernanceByTenant[selectedTenant.id]?.securityPolicy
                      .sessionTimeoutMinutes ?? 30}{' '}
                    min
                  </span>
                </div>
                <div className="text-[11px] text-amber-700">
                  {tenantGovernanceByTenant[selectedTenant.id]?.securityPolicy.isolationModeNote}
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-700">Assigned Administrators</div>
              <div className="mt-1 space-y-1 text-slate-600">
                {(tenantGovernanceByTenant[selectedTenant.id]?.assignedAdmins ?? []).map((a, i) => (
                  <div key={i}>
                    {a.name} · <span className="font-mono text-[11px]">{a.email}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-700">Lifecycle Audit History</div>
              <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                {(tenantGovernanceByTenant[selectedTenant.id]?.auditHistory ?? [])
                  .slice(0, 3)
                  .map((ev) => (
                    <div key={ev.id}>
                      <span className="font-semibold text-slate-800">{ev.action}</span> ·{' '}
                      {ev.timestamp}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Action Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="font-display text-base font-bold text-[#102B4D]">
                  Confirm Sensitive Governance Action
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Change lifecycle state of{' '}
                  <span className="font-semibold text-slate-900">{confirmAction.tenant.name}</span>{' '}
                  to <span className="font-semibold">{confirmAction.nextStatus}</span>? This event
                  will be recorded in the Enterprise Audit Ledger.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Governance Justification Note
              </label>
              <input
                type="text"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="Reason for lifecycle state transition..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setConfirmNote('');
                }}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedLifecycle}
                className="rounded-lg bg-[#102B4D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1769AA]"
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import {
  Blocks,
  GitFork,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  X,
  Info,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { ModuleDefinition, ModuleId } from '../../types/platform';
import {
  evaluateModuleGraph,
  MARKETPLACE_CATALOG,
  PLATFORM_SERVICES,
} from '../../core/enterprise/mvp4Engine';

export function ModuleMarketplaceWorkspace() {
  const { activeTenant, modules, toggleModule, updateModuleConfiguration } = usePlatform();

  const [activeTab, setActiveTab] = useState<'marketplace' | 'dependency_graph'>('marketplace');
  const [selectedConfigModId, setSelectedConfigModId] = useState<ModuleId | null>(null);
  const [selectedDetailModId, setSelectedDetailModId] = useState<ModuleId | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  const graphStatus = useMemo(() => evaluateModuleGraph(modules), [modules]);

  const selectedConfigMod = useMemo(
    () => modules.find((m) => m.module_id === selectedConfigModId) ?? null,
    [modules, selectedConfigModId]
  );

  const selectedDetailMod = useMemo(
    () => modules.find((m) => m.module_id === selectedDetailModId) ?? null,
    [modules, selectedDetailModId]
  );

  const handleToggle = (mod: ModuleDefinition) => {
    const res = toggleModule(mod.module_id, !mod.enabled);
    setFeedback({ ok: res.ok, text: res.message });
  };

  const openConfigEditor = (mod: ModuleDefinition) => {
    setSelectedConfigModId(mod.module_id);
    const asStrings: Record<string, string> = {};
    Object.entries(mod.configuration).forEach(([k, v]) => {
      asStrings[k] = String(v);
    });
    if (Object.keys(asStrings).length === 0) {
      asStrings['refreshIntervalMinutes'] = '30';
      asStrings['tenantGovernanceMode'] = 'Strict';
    }
    setConfigDraft(asStrings);
  };

  const saveConfig = () => {
    if (!selectedConfigMod) return;
    const parsed: Record<string, string | number | boolean> = {};
    Object.entries(configDraft).forEach(([k, v]) => {
      if (v === 'true') parsed[k] = true;
      else if (v === 'false') parsed[k] = false;
      else if (v !== '' && !Number.isNaN(Number(v))) parsed[k] = Number(v);
      else parsed[k] = v;
    });
    const res = updateModuleConfiguration(selectedConfigMod.module_id, parsed);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) setSelectedConfigModId(null);
  };

  const statusBadgeClass = (avail: string) => {
    if (avail === 'Active') return 'bg-emerald-50 text-emerald-700';
    if (avail === 'Missing Dependency') return 'bg-amber-50 text-amber-800';
    if (avail === 'Incompatible Version') return 'bg-rose-50 text-rose-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise Modular Platform · Tenant Entitlements ({activeTenant.shortName})
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Module Marketplace &amp; Dependency Graph
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Activate, deactivate, and configure reusable business modules (BM01–BM10) per tenant.
            Disabling a module hides navigation and blocks route access while preserving tenant
            data.
          </p>
        </div>

        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === 'marketplace'
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Blocks className="h-3.5 w-3.5 shrink-0" />
            <span>Marketplace Catalog (BM01–BM10)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dependency_graph')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === 'dependency_graph'
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitFork className="h-3.5 w-3.5 shrink-0" />
            <span>Dependency Viewer</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-xs font-medium ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {activeTab === 'marketplace' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {modules.map((mod) => {
            const node = graphStatus[mod.module_id];
            const catalog = MARKETPLACE_CATALOG[mod.module_id];
            return (
              <div
                key={mod.module_id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#1769AA]">
                          {mod.module_id}
                        </span>
                        <h3 className="font-display text-sm font-bold text-[#102B4D]">
                          {mod.module_name}
                        </h3>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        v{mod.module_version} · {mod.category} · All Industries Compatible
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                        node?.availability ?? 'Available'
                      )}`}
                    >
                      {node?.availability ?? (mod.enabled ? 'Active' : 'Available')}
                    </span>
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                    {mod.module_description}
                  </p>

                  <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-700">Module Dependencies:</span>{' '}
                      {mod.dependencies.length > 0 ? mod.dependencies.join(', ') : 'None (Root)'}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Platform Services:</span>{' '}
                      {(node?.serviceDependencies ?? []).map((s) => s.name).join(' · ')}
                    </div>
                    {node?.activeDependents.length > 0 && (
                      <div className="text-slate-600">
                        <span className="font-semibold">Required by Active:</span>{' '}
                        {node.activeDependents.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConfigEditor(mod)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-3 w-3" />
                      <span>Configure</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailModId(mod.module_id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Info className="h-3 w-3" />
                      <span>Versions ({catalog?.versionHistory.length ?? 1})</span>
                    </button>
                  </div>

                  {catalog?.moduleStatus === 'Core Protected' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Lock className="h-3 w-3" />
                      <span>Core Protected</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggle(mod)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        mod.enabled
                          ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : 'bg-[#1769AA] text-white hover:bg-[#102B4D]'
                      }`}
                    >
                      {mod.enabled ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* INTERACTIVE MODULE DEPENDENCY VIEWER */
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-base font-bold text-[#102B4D]">
              Module Dependency Hierarchy ({activeTenant.name})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Visualizes dependency chains across BM01–BM10 and shared platform services. Attempting
              to disable a foundation module while dependent modules are Active is strictly blocked.
            </p>

            {/* Layered Architecture Diagram */}
            <div className="mt-5 space-y-4">
              {[
                {
                  tier: 'Layer 1 — Shared Core & Administration Foundation',
                  ids: ['BM01', 'BM09', 'BM10'] as ModuleId[],
                },
                {
                  tier: 'Layer 2 — Customer & Geospatial Intelligence Foundation',
                  ids: ['BM02', 'BM03'] as ModuleId[],
                },
                {
                  tier: 'Layer 3 — Predictive, Decision & Activation Engines',
                  ids: ['BM04', 'BM06', 'BM05'] as ModuleId[],
                },
                {
                  tier: 'Layer 4 — Closed-Loop Performance & Agentic Orchestration',
                  ids: ['BM07', 'BM08'] as ModuleId[],
                },
              ].map((layer) => (
                <div
                  key={layer.tier}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {layer.tier}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {layer.ids.map((id) => {
                      const mod = modules.find((m) => m.module_id === id);
                      const node = graphStatus[id];
                      if (!mod || !node) return null;
                      return (
                        <div
                          key={id}
                          className={`rounded-lg border bg-white p-3.5 ${
                            node.availability === 'Active'
                              ? 'border-emerald-300'
                              : node.availability === 'Missing Dependency'
                                ? 'border-amber-300'
                                : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[#1769AA]">
                              {mod.module_id}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(
                                node.availability
                              )}`}
                            >
                              {node.availability}
                            </span>
                          </div>
                          <div className="mt-1 text-xs font-bold text-slate-900">
                            {mod.short_name}
                          </div>
                          <div className="mt-1.5 text-[11px] text-slate-500">
                            Requires:{' '}
                            <span className="font-mono text-slate-700">
                              {mod.dependencies.length > 0 ? mod.dependencies.join(' + ') : 'Core'}
                            </span>
                          </div>
                          {node.missingDependencies.length > 0 && (
                            <div className="mt-1 text-[11px] font-semibold text-amber-700">
                              Missing: {node.missingDependencies.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Underlying Platform Services */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#16A6BD]" />
              <h3 className="font-display text-sm font-bold text-[#102B4D]">
                Shared Platform Service Dependencies
              </h3>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_SERVICES.map((svc) => (
                <div
                  key={svc.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
                >
                  <div className="font-semibold text-slate-900">{svc.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {svc.layer} · <span className="font-medium text-[#1769AA]">{svc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-Tenant Module Configuration Modal */}
      {selectedConfigMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#102B4D]">
                  Configure {selectedConfigMod.module_id} — {selectedConfigMod.module_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Tenant-isolated settings for{' '}
                  <span className="font-semibold text-slate-700">{activeTenant.name}</span>. Does
                  not affect other tenants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConfigModId(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(configDraft).map(([key, val]) => (
                <div key={key}>
                  <label className="block font-mono text-xs font-semibold text-slate-700">
                    {key}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedConfigModId(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConfig}
                className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                Save Tenant Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {selectedDetailMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#102B4D]">
                  {selectedDetailMod.module_id} Release History
                </h3>
                <p className="text-xs text-slate-500">
                  Required Permissions: {selectedDetailMod.required_permissions.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailModId(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5">
              {(MARKETPLACE_CATALOG[selectedDetailMod.module_id]?.versionHistory ?? []).map(
                (v, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span className="font-mono">v{v.version}</span>
                      <span className="font-mono text-[11px] text-slate-500">{v.releasedAt}</span>
                    </div>
                    <p className="mt-1 text-slate-600">{v.summary}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

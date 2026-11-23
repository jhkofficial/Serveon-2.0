import React, { useMemo, useState } from 'react';
import { ShieldCheck, Search, Download, AlertTriangle, Lock } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { AuditLogEntry } from '../../types/platform';

export function SecurityAuditWorkspace() {
  const { activeTenant, persona, auditLogs, tenants, tenantGovernanceByTenant } = usePlatform();

  const isPlatformAdmin = persona.permissions.includes('admin.manage_tenants');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [tenantFilter, setTenantFilter] = useState<string>(isPlatformAdmin ? 'ALL' : activeTenant.id);

  const visibleLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (!isPlatformAdmin && log.tenantId !== activeTenant.id) return false;
      if (isPlatformAdmin && tenantFilter !== 'ALL' && log.tenantId !== tenantFilter) return false;
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
      const out = log.outcome ?? 'Success';
      if (outcomeFilter !== 'ALL' && out !== outcomeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.actorName.toLowerCase().includes(q) ||
          (log.objectRef ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditLogs, isPlatformAdmin, activeTenant.id, tenantFilter, categoryFilter, outcomeFilter, search]);

  const categories = useMemo(() => {
    const set = new Set<AuditLogEntry['category']>(auditLogs.map((l) => l.category));
    return Array.from(set);
  }, [auditLogs]);

  const exportCsv = () => {
    const header = 'Timestamp,Actor,Role,Tenant,Category,Action,Object,Outcome,Details\n';
    const body = visibleLogs
      .map((l) =>
        [
          l.timestamp,
          l.actorName,
          l.actorRole,
          l.tenantId,
          l.category,
          l.action,
          l.objectRef ?? '',
          l.outcome ?? 'Success',
          l.details,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serveon-audit-ledger-${activeTenant.code.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const secPolicy = tenantGovernanceByTenant[activeTenant.id]?.securityPolicy;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise Security &amp; Auditability ·{' '}
            {isPlatformAdmin ? 'Platform-Wide Ledger' : `Tenant-Scoped (${activeTenant.shortName})`}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Security Posture &amp; Audit Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track multi-tenant isolation posture, governance policy guardrails, and every
            administrative, approval, module, and security event.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5 text-[#1769AA]" />
          <span>Export Audit CSV ({visibleLogs.length})</span>
        </button>
      </div>

      {/* Honest Demo vs Production Security Boundary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#102B4D]">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Active Application Controls (Verified in Demo)</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600 list-disc pl-4">
            <li>
              Strict <span className="font-mono font-semibold text-slate-800">tenant_id</span>{' '}
              scoping across datasets, CSV imports, campaigns, predictions, and module toggles.
            </li>
            <li>
              Route-level RBAC and Disabled-Module blocking preventing unauthorized workspace
              access.
            </li>
            <li>
              Server-side Gemini API proxy isolation (<span className="font-mono">/api/ai/insights</span>)
              — zero API keys in browser bundles.
            </li>
            <li>
              Active tenant policy: MFA Required ({secPolicy?.requireMfaForAdmins ? 'Yes' : 'No'}) ·
              PII Masking ({secPolicy?.maskCustomerPiiInLists ? 'Enabled' : 'Disabled'}) · Session
              Timeout ({secPolicy?.sessionTimeoutMinutes ?? 30} min).
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span>Production Security Requirements (Not Yet Deployed)</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-amber-900 list-disc pl-4">
            <li>
              <span className="font-semibold">Simulated Browser RBAC:</span> Persona switching is
              for demonstration only; production requires server-verified OIDC/JWT claims on every
              API endpoint.
            </li>
            <li>
              <span className="font-semibold">Database Row-Level Security (RLS):</span> Current
              persistence runs in browser localStorage; production requires PostgreSQL RLS or
              Firestore Security Rules.
            </li>
            <li>
              <span className="font-semibold">Immutable WORM Audit Sink:</span> Production audit
              records must stream to append-only tamper-evident cloud logging.
            </li>
          </ul>
        </div>
      </div>

      {/* Audit Ledger Filters & Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#1769AA]" />
            <h2 className="font-display text-base font-bold text-[#102B4D]">
              Enterprise Audit Ledger ({visibleLogs.length} events)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search actor, action, object..."
                className="h-8 rounded-lg border border-slate-300 pl-8 pr-3 text-xs focus:border-[#1769AA] focus:outline-none"
              />
            </div>

            {isPlatformAdmin && (
              <select
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
              >
                <option value="ALL">All Tenants</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.shortName}
                  </option>
                ))}
              </select>
            )}

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
            >
              <option value="ALL">All Outcomes</option>
              <option value="Success">Success</option>
              <option value="Blocked">Blocked</option>
              <option value="Pending Review">Pending Review</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Action &amp; Details</th>
                <th className="px-4 py-3">Object</th>
                <th className="px-4 py-3 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLogs.slice(0, 60).map((log) => {
                const outcome = log.outcome ?? 'Success';
                const tenantName =
                  tenants.find((t) => t.id === log.tenantId)?.shortName ?? log.tenantId;
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{log.actorName}</div>
                      <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{tenantName}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        <span className="text-[#1769AA]">[{log.category}]</span> {log.action}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-600">{log.details}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600">
                      {log.objectRef ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${
                          outcome === 'Success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : outcome === 'Blocked'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {outcome}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

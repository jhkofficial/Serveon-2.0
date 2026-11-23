import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Server, Clock, Cpu } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { usePlatform } from '../../core/state/PlatformContext';
import type { ModuleId } from '../../types/platform';
import type { MonitoringEnvironment, MonitoringTimePeriod } from '../../types/mvp4';
import { computePlatformMonitoring } from '../../core/enterprise/mvp4Engine';
import { DEFAULT_MODULE_REGISTRY } from '../../core/module-registry/registry';

export function PlatformMonitoringWorkspace() {
  const {
    tenants,
    tenantGovernanceByTenant,
    modulesByTenant,
    campaignsByTenant,
    auditLogs,
  } = usePlatform();

  const [tenantFilter, setTenantFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<'ALL' | ModuleId>('ALL');
  const [period, setPeriod] = useState<MonitoringTimePeriod>('7d');
  const [environment, setEnvironment] = useState<MonitoringEnvironment>('Demo Sandbox');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const snapshot = useMemo(
    () =>
      computePlatformMonitoring(
        tenants,
        tenantGovernanceByTenant,
        modulesByTenant,
        campaignsByTenant,
        auditLogs,
        {
          tenantId: tenantFilter,
          moduleId: moduleFilter,
          period,
          environment,
        }
      ),
    [
      tenants,
      tenantGovernanceByTenant,
      modulesByTenant,
      campaignsByTenant,
      auditLogs,
      tenantFilter,
      moduleFilter,
      period,
      environment,
    ]
  );

  const selectedJob = snapshot.backgroundJobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Platform Operations · Deterministic Simulated Observability
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Platform Monitoring Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Inspect tenant activity, active module load, AI service usage, and background job
            schedules across environments.
          </p>
        </div>

        {/* Filters */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            aria-label="Filter monitoring by tenant"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
          >
            <option value="ALL">All Tenants ({tenants.length})</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter monitoring by module"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value as 'ALL' | ModuleId)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
          >
            <option value="ALL">All Modules</option>
            {DEFAULT_MODULE_REGISTRY.map((m) => (
              <option key={m.module_id} value={m.module_id}>
                {m.module_id} — {m.short_name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter monitoring time period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as MonitoringTimePeriod)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <select
            aria-label="Filter monitoring environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as MonitoringEnvironment)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
          >
            <option value="Demo Sandbox">Demo Sandbox</option>
            <option value="Staging (Sim)">Staging (Sim)</option>
          </select>
        </div>
      </div>

      {/* Honest Simulated Telemetry Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <span className="font-semibold">Simulated Observability Mode:</span> API volume, AI query
          throughput, and latency metrics shown below are deterministic simulations scaled to your
          active tenants and enabled modules. External CRM/ERP and messaging gateways remain
          honestly reported as <span className="font-semibold">Not Connected</span>.
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Tenants / Modules</span>
            <Server className="h-4 w-4 text-[#1769AA]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {snapshot.activeTenants} / {snapshot.activeModulesTotal}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            of {snapshot.registeredTenants} scoped tenant(s)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Simulated API Requests</span>
            <Activity className="h-4 w-4 text-[#16A6BD]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {snapshot.simulatedApiRequests.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Avg latency {snapshot.simulatedAvgLatencyMs}ms (Simulated)
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Simulated AI Queries</span>
            <Cpu className="h-4 w-4 text-[#1769AA]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {snapshot.simulatedAiQueries.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {environment} · {period} window
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Error Events / Audit Entries</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#102B4D]">
            {snapshot.simulatedErrorEvents} / {snapshot.auditEventsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Simulated errors · Real local audit log</div>
        </div>
      </div>

      {/* Telemetry Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#102B4D]">
              Simulated API &amp; AI Throughput ({period} · {environment})
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic workload profile responding to tenant, module, and period filters.
            </p>
          </div>
          <span className="font-mono text-[11px] font-semibold text-amber-700">
            SIMULATED TELEMETRY
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#CBD5E1',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="apiRequests" name="Simulated API Requests" fill="#1769AA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="aiCalls" name="Simulated AI Queries" fill="#16A6BD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Background Jobs + External Connector Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-display text-base font-bold text-[#102B4D]">
              Background Intelligence Jobs ({snapshot.backgroundJobs.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {snapshot.backgroundJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
                className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-xs transition-colors hover:bg-slate-50 ${
                  selectedJobId === job.id ? 'bg-sky-50/70' : ''
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-900">{job.jobName}</div>
                  <div className="text-[11px] text-slate-500">
                    {job.tenantName} · <span className="font-mono">{job.moduleId}</span> ·{' '}
                    {job.lastRunAt}
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {job.status}
                  </span>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                    {job.durationLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selectedJob && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-700">
              <span className="font-semibold text-[#102B4D]">Job Drill-Down:</span>{' '}
              {selectedJob.jobName} executed deterministically inside the browser sandbox for{' '}
              {selectedJob.tenantName} ({selectedJob.moduleId}). No external cluster queue attached.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5">
          <h2 className="font-display text-base font-bold text-[#102B4D]">
            External Service Health
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Unconfigured external services are honestly reported as Not Connected.
          </p>
          <div className="mt-4 space-y-3">
            {snapshot.externalConnectorsStatus.map((svc) => (
              <div
                key={svc.name}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{svc.name}</span>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      svc.status === 'Not Connected'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {svc.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{svc.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

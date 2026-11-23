import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  FastForward,
  CheckCircle2,
  ShieldCheck,
  Search,
  BarChart3,
  Calendar,
  Ban,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import type { Campaign, CampaignEventStatus } from '../../types/mvp3';

const EVENT_STATUSES: Array<'ALL' | CampaignEventStatus> = [
  'ALL',
  'Queued',
  'Delivered',
  'Responded',
  'Converted',
  'Failed',
  'Opted out',
];

function eventStatusTone(status: CampaignEventStatus): string {
  switch (status) {
    case 'Converted':
      return 'font-bold text-[#15946A]';
    case 'Responded':
      return 'font-semibold text-[#1769AA]';
    case 'Delivered':
      return 'font-medium text-slate-700';
    case 'Failed':
    case 'Opted out':
      return 'font-semibold text-[#D9534F]';
    default:
      return 'text-slate-500';
  }
}

export function CampaignOperations() {
  const {
    activeTenant,
    persona,
    campaigns,
    campaignEvents,
    conversionEvents,
    selectedCampaignId,
    transitionCampaignStatus,
    updateSimulationProgress,
    openCampaignInRoute,
  } = usePlatform();

  const [activeId, setActiveId] = useState<string>(
    selectedCampaignId ??
      campaigns.find((c) => c.status === 'Approved' || c.status === 'Simulated Running')?.id ??
      campaigns[0]?.id ??
      ''
  );
  const [eventFilter, setEventFilter] = useState<'ALL' | CampaignEventStatus>('ALL');
  const [eventSearch, setEventSearch] = useState('');

  const canExecute = hasPermission(persona, 'campaigns.execute_simulated');

  useEffect(() => {
    if (selectedCampaignId && campaigns.some((c) => c.id === selectedCampaignId)) {
      setActiveId(selectedCampaignId);
    }
  }, [selectedCampaignId, campaigns]);

  const selected: Campaign | null =
    campaigns.find((c) => c.id === activeId) ?? campaigns[0] ?? null;

  // Live stepped simulation timer when a campaign is in running state
  useEffect(() => {
    if (!selected || selected.simulationState !== 'running' || selected.simulationProgressPct >= 100) {
      return;
    }
    const timer = window.setInterval(() => {
      const next = Math.min(100, selected.simulationProgressPct + 25);
      updateSimulationProgress(selected.id, next >= 100 ? 'completed' : 'running', next);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [selected, updateSimulationProgress]);

  const activeEvents = useMemo(() => {
    if (!selected) return [];
    const q = eventSearch.trim().toLowerCase();
    return campaignEvents.filter((e) => {
      if (e.campaignId !== selected.id) return false;
      if (eventFilter !== 'ALL' && e.status !== eventFilter) return false;
      if (q) {
        const hay = `${e.customerName} ${e.customerCode} ${e.regionName} ${e.channel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [selected, campaignEvents, eventFilter, eventSearch]);

  const metrics = useMemo(() => {
    if (!selected) {
      return { queued: 0, delivered: 0, responded: 0, converted: 0, failed: 0, optedOut: 0, revenue: 0 };
    }
    const evs = campaignEvents.filter((e) => e.campaignId === selected.id);
    const convs = conversionEvents.filter((c) => c.campaignId === selected.id && !c.isControlGroup);
    return {
      queued: evs.filter((e) => e.status === 'Queued').length,
      delivered: evs.filter((e) => e.status === 'Delivered').length,
      responded: evs.filter((e) => e.status === 'Responded').length,
      converted: convs.length,
      failed: evs.filter((e) => e.status === 'Failed').length,
      optedOut: evs.filter((e) => e.status === 'Opted out').length,
      revenue: convs.reduce((a, c) => a + c.attributedRevenue, 0),
    };
  }, [selected, campaignEvents, conversionEvents]);

  const eligibleForSim =
    selected &&
    ['Approved', 'Scheduled', 'Simulated Running', 'Simulated Execution'].includes(selected.status) &&
    !selected.requiresReapproval;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Operations Console"
        subtitle={`Deterministic campaign execution simulator with start, pause, resume, and customer-level simulated event logs for ${activeTenant.shortName}.`}
        metaItems={[
          'BM05 · Execution Simulator',
          'Simulated Execution Only',
          'Zero External Dispatches',
          `${formatNumber(campaignEvents.length)} Simulated Events Logged`,
        ]}
        actions={
          selected && (
            <button
              type="button"
              onClick={() => openCampaignInRoute(selected.id, 'performance')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 text-xs font-semibold text-white hover:bg-[#102B4D] whitespace-nowrap"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Inspect Performance &amp; ROI</span>
            </button>
          )
        }
      />

      {/* Strict Non-Transmission Guarantee */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15946A]" />
        <div>
          <span className="font-semibold text-slate-900">
            Simulation Sandbox Guarantee (No Real Messages Sent):
          </span>{' '}
          All delivery, response, conversion, failure, and opt-out events generated in this console
          are deterministic synthetic records for operational testing and ROI attribution. SERVEON
          never sends real WhatsApp, SMS, or email messages in demo mode.
        </div>
      </div>

      {/* Main Split: Campaign Selector + Simulator Control & Event Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-4">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Campaigns ({campaigns.length})</h2>
            <p className="text-xs text-slate-500">
              Only Approved or Scheduled campaigns can start simulated execution.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {campaigns.map((cmp) => {
              const isSelected = selected?.id === cmp.id;
              return (
                <button
                  key={cmp.id}
                  type="button"
                  onClick={() => setActiveId(cmp.id)}
                  className={`block w-full px-5 py-4 text-left transition-colors ${
                    isSelected ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold ${
                        cmp.status === 'Completed' || cmp.status === 'Approved'
                          ? 'text-[#15946A]'
                          : cmp.status === 'Simulated Running'
                            ? 'text-[#16A6BD]'
                            : cmp.status === 'Rejected'
                              ? 'text-[#D9534F]'
                              : 'text-slate-600'
                      }`}
                    >
                      {cmp.status}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {cmp.simulationProgressPct}%
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{cmp.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {cmp.channels.join(', ')} · {formatNumber(cmp.audience.eligibleReachableCount)} eligible
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Simulator & Customer Event Log */}
        <div className="space-y-5 xl:col-span-8">
          {selected && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {selected.id} · v{selected.version} · Status:{' '}
                      <strong className="text-[#102B4D]">{selected.status}</strong> · Simulated Sandbox
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {selected.regionName} · {selected.targetSegment} · Channels:{' '}
                      {selected.channels.join(', ')}
                    </p>
                  </div>

                  {/* Execution Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.status === 'Approved' && canExecute && !selected.requiresReapproval && (
                      <button
                        type="button"
                        onClick={() =>
                          transitionCampaignStatus(
                            selected.id,
                            'Scheduled',
                            `Scheduled for simulated execution on ${selected.scheduledDate}.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Schedule</span>
                      </button>
                    )}

                    {eligibleForSim &&
                      canExecute &&
                      selected.simulationState !== 'running' &&
                      selected.simulationProgressPct < 100 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateSimulationProgress(
                              selected.id,
                              'running',
                              Math.max(25, selected.simulationProgressPct)
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>
                            {selected.simulationState === 'paused'
                              ? 'Resume Simulation'
                              : 'Start Simulation'}
                          </span>
                        </button>
                      )}

                    {selected.simulationState === 'running' && canExecute && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSimulationProgress(
                            selected.id,
                            'paused',
                            selected.simulationProgressPct
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause Simulation</span>
                      </button>
                    )}

                    {eligibleForSim && canExecute && selected.simulationProgressPct < 100 && (
                      <button
                        type="button"
                        onClick={() => updateSimulationProgress(selected.id, 'completed', 100)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#15946A] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <FastForward className="h-3.5 w-3.5" />
                        <span>Complete 100%</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Blocked Execution Notice for Unapproved / Rejected Campaigns */}
                {!eligibleForSim && selected.status !== 'Completed' && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                    <Ban className="h-4 w-4 shrink-0 text-[#D9534F]" />
                    <span>
                      Execution blocked: campaign is in <strong>{selected.status}</strong> state
                      {selected.requiresReapproval ? ' (reapproval required)' : ''}. Only approved
                      campaigns may run simulated execution.
                    </span>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Simulated Dispatch Progress ({selected.simulationState})
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {selected.simulationProgressPct}% ({formatNumber(metrics.queued)} /{' '}
                      {formatNumber(selected.audience.eligibleReachableCount)} eligible)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selected.status === 'Completed' ? 'bg-[#15946A]' : 'bg-[#16A6BD]'
                      }`}
                      style={{ width: `${selected.simulationProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* Event Funnel Strip */}
                <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {[
                    { label: 'Queued', val: metrics.queued, tone: 'text-slate-900' },
                    { label: 'Delivered', val: metrics.delivered, tone: 'text-[#1769AA]' },
                    { label: 'Responded', val: metrics.responded, tone: 'text-[#16A6BD]' },
                    { label: 'Converted', val: metrics.converted, tone: 'text-[#15946A]' },
                    { label: 'Failed', val: metrics.failed, tone: 'text-[#D9534F]' },
                    { label: 'Opted Out', val: metrics.optedOut, tone: 'text-[#B47815]' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                      <div className="text-[11px] text-slate-500">{m.label}</div>
                      <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${m.tone}`}>
                        {formatNumber(m.val)}
                      </div>
                    </div>
                  ))}
                </div>

                {metrics.revenue > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#15946A]">
                      <CheckCircle2 className="h-4 w-4" />
                      Simulated Attributed Revenue Recorded from Conversion Events
                    </span>
                    <span className="font-mono font-bold text-[#102B4D] tabular-nums">
                      {formatIdrCompact(metrics.revenue)}
                    </span>
                  </div>
                )}
              </div>

              {/* Customer-Level Simulated Event Inspector */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Customer-Level Simulated Event Log ({formatNumber(activeEvents.length)})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Deterministic, deduplicated event history · Simulated Only
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        aria-label="Search simulated events"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Filter customer or region..."
                        className="h-8 rounded-lg border border-slate-300 pl-8 pr-2.5 text-xs"
                      />
                    </div>
                    <select
                      aria-label="Filter simulated events by status"
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value as 'ALL' | CampaignEventStatus)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium"
                    >
                      {EVENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st === 'ALL' ? 'All Event Statuses' : st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No simulated events recorded yet for this campaign. Click &ldquo;Start
                    Simulation&rdquo; on an approved campaign to generate deterministic execution
                    events.
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2.5 pl-5 pr-3 font-semibold">Timestamp</th>
                          <th className="px-3 py-2.5 font-semibold">Customer</th>
                          <th className="px-3 py-2.5 font-semibold">Channel</th>
                          <th className="px-3 py-2.5 font-semibold">Status</th>
                          <th className="py-2.5 pl-3 pr-5 font-semibold">Simulated Event Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeEvents.slice(0, 60).map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50">
                            <td className="py-2.5 pl-5 pr-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                              {ev.timestamp}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-slate-900">{ev.customerName}</div>
                              <div className="font-mono text-[10px] text-slate-500">
                                {ev.customerCode} · {ev.regionName}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                              {ev.channel}
                            </td>
                            <td className={`px-3 py-2.5 whitespace-nowrap ${eventStatusTone(ev.status)}`}>
                              {ev.status}
                            </td>
                            <td className="py-2.5 pl-3 pr-5 text-slate-600">{ev.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

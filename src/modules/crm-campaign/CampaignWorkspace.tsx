import React, { useEffect, useState } from 'react';
import {
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  Calendar,
  Play,
  Flag,
  Ban,
  ShieldCheck,
  X,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import type { CampaignChannel, CampaignRecord, CampaignStatus } from '../../types/platform';

const CHANNELS: CampaignChannel[] = [
  'WhatsApp',
  'Email',
  'SMS',
  'Call Center',
  'Branch Follow-up',
];

const SEGMENTS = [
  'At-Risk Retention',
  'High-Value Loyal',
  'Growth Potential',
  'Core Active',
  'New Onboarding',
  'ALL',
];

function getStatusTone(status: CampaignStatus): string {
  switch (status) {
    case 'Completed':
    case 'Approved':
      return 'text-[#15946A]';
    case 'Pending Approval':
    case 'Scheduled':
    case 'Simulated Execution':
      return 'text-[#1769AA]';
    case 'Rejected':
    case 'Cancelled':
      return 'text-[#D9534F]';
    default:
      return 'text-slate-600';
  }
}

export function CampaignWorkspace() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    campaigns,
    permittedRegionIds,
    pendingCampaignDraft,
    clearPendingCampaignDraft,
    createCampaign,
    transitionCampaignStatus,
  } = usePlatform();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id ?? '');
  const [composerOpen, setComposerOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [targetSegment, setTargetSegment] = useState('At-Risk Retention');
  const [regionId, setRegionId] = useState('ALL');
  const [channel, setChannel] = useState<CampaignChannel>('WhatsApp');
  const [scheduledDate, setScheduledDate] = useState('2026-12-05');
  const [budget, setBudget] = useState('25000000');
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = hasPermission(persona, 'campaigns.create');
  const canApprove = hasPermission(persona, 'campaigns.approve');
  const canExecute = hasPermission(persona, 'campaigns.execute_simulated');

  const permittedRegions = activeTenant.province.regencies.filter((r) =>
    permittedRegionIds.includes(r.id)
  );

  // Keep selected campaign aligned when switching tenants
  useEffect(() => {
    if (!campaigns.some((c) => c.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0]?.id ?? '');
    }
  }, [campaigns, selectedCampaignId]);

  // Pre-fill composer when launched from a recommended action
  useEffect(() => {
    if (!pendingCampaignDraft) return;
    setName(pendingCampaignDraft.name ?? '');
    setObjective(pendingCampaignDraft.objective ?? '');
    setTargetSegment(pendingCampaignDraft.targetSegment ?? 'At-Risk Retention');
    setRegionId(pendingCampaignDraft.regionId ?? 'ALL');
    setChannel(pendingCampaignDraft.channel ?? 'WhatsApp');
    setComposerOpen(true);
    clearPendingCampaignDraft();
  }, [pendingCampaignDraft, clearPendingCampaignDraft]);

  const selectedCampaign: CampaignRecord | null =
    campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0] ?? null;

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Campaign name is required.');
      return;
    }
    if (!objective.trim()) {
      setFormError('Campaign objective is required.');
      return;
    }
    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setFormError('Please enter a valid non-negative budget in IDR.');
      return;
    }

    const created = createCampaign({
      name: name.trim(),
      objective: objective.trim(),
      targetSegment,
      regionId,
      channel,
      scheduledDate,
      budgetAllocated: parsedBudget,
    });

    setSelectedCampaignId(created.id);
    setComposerOpen(false);
    setName('');
    setObjective('');
    setFormError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Campaign Activation"
        subtitle={`Governed multi-channel orchestration with approval workflows and simulated dispatch for ${activeTenant.shortName}.`}
        metaItems={[
          'BM05',
          'Simulated Execution Only',
          `${campaigns.length} Campaigns`,
          `Channels: WhatsApp, Email, SMS, Call Center, Branch`,
        ]}
        actions={
          canCreate && (
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setComposerOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Campaign</span>
            </button>
          )
        }
      />

      {/* Simulated Safety Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15946A]" />
        <div>
          <span className="font-semibold text-slate-900">Communication Safeguard:</span> All
          external channels (WhatsApp, Email, SMS, Call Center, Branch Follow-up) execute strictly
          in <span className="font-semibold">Simulated Execution</span> mode. No real messages are
          transmitted without explicit production integration, consent verification, and approval.
        </div>
      </div>

      {/* Create Campaign Modal */}
      {composerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-campaign-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 id="create-campaign-title" className="text-base font-bold text-slate-900">
                  Create New Campaign (Draft)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  New campaigns start in Draft and require approval before simulated execution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                aria-label="Close campaign form"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="cmp-name" className="block text-xs font-semibold text-slate-700">
                  Campaign Name
                </label>
                <input
                  id="cmp-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`e.g. ${activeTenant.primaryProvinceName} Q4 Retention Outreach`}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1769AA] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="cmp-objective" className="block text-xs font-semibold text-slate-700">
                  Business Objective
                </label>
                <textarea
                  id="cmp-objective"
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Describe target outcome and offer summary..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1769AA] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cmp-segment" className="block text-xs font-semibold text-slate-700">
                    Target Segment
                  </label>
                  <select
                    id="cmp-segment"
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s} value={s}>
                        {s === 'ALL' ? `All ${activeIndustry.terminology.customerPlural}` : s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cmp-region" className="block text-xs font-semibold text-slate-700">
                    Target Territory
                  </label>
                  <select
                    id="cmp-region"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  >
                    {permittedRegions.length > 1 && (
                      <option value="ALL">All {activeTenant.primaryProvinceName}</option>
                    )}
                    {permittedRegions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cmp-channel" className="block text-xs font-semibold text-slate-700">
                    Communication Channel (Simulated)
                  </label>
                  <select
                    id="cmp-channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CampaignChannel)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  >
                    {CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cmp-date" className="block text-xs font-semibold text-slate-700">
                    Target Schedule Date
                  </label>
                  <input
                    id="cmp-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cmp-budget" className="block text-xs font-semibold text-slate-700">
                  Allocated Budget (IDR)
                </label>
                <input
                  id="cmp-budget"
                  type="number"
                  min={0}
                  step={500000}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                >
                  Save as Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Layout: Campaign List + Detail & Workflow */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Campaign List */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-5">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Campaign Portfolio</h2>
            <p className="text-xs text-slate-500">Select a campaign to inspect workflow &amp; audit trail.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {campaigns.map((cmp) => {
              const isSelected = selectedCampaign?.id === cmp.id;
              return (
                <button
                  key={cmp.id}
                  type="button"
                  onClick={() => setSelectedCampaignId(cmp.id)}
                  className={`block w-full px-5 py-4 text-left transition-colors ${
                    isSelected ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-semibold ${getStatusTone(cmp.status)}`}>
                      {cmp.status}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {cmp.scheduledDate}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{cmp.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {cmp.channel} · {cmp.targetSegment} · {formatNumber(cmp.targetAudienceCount)} audience
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Campaign Detail & Governed State Machine */}
        {selectedCampaign && (
          <div className="space-y-5 lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    {selectedCampaign.id} · Status:{' '}
                    <span className={`font-semibold ${getStatusTone(selectedCampaign.status)}`}>
                      {selectedCampaign.status}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {selectedCampaign.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedCampaign.objective}</p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Target Audience</dt>
                  <dd className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                    {formatNumber(selectedCampaign.targetAudienceCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Channel</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selectedCampaign.channel}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Est. / Sim. Conversion</dt>
                  <dd className="mt-1 font-mono text-base font-semibold text-[#15946A] tabular-nums">
                    {selectedCampaign.estimatedConversionRate}% ({selectedCampaign.simulatedConversions})
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Budget / Est. Impact</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                    {formatIdrCompact(selectedCampaign.budgetAllocated)} /{' '}
                    {formatIdrCompact(selectedCampaign.estimatedRevenueImpact)}
                  </dd>
                </div>
              </dl>

              {/* Workflow Action Bar */}
              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-700">
                  Governed Workflow Controls ({persona.title})
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {selectedCampaign.status === 'Draft' && canCreate && (
                    <button
                      type="button"
                      onClick={() =>
                        transitionCampaignStatus(
                          selectedCampaign.id,
                          'Pending Approval',
                          'Submitted for executive / business manager review.'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit for Approval</span>
                    </button>
                  )}

                  {selectedCampaign.status === 'Pending Approval' && canApprove && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          transitionCampaignStatus(
                            selectedCampaign.id,
                            'Approved',
                            'Approved after audience and channel compliance check.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#15946A] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve Campaign</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          transitionCampaignStatus(
                            selectedCampaign.id,
                            'Rejected',
                            'Returned for targeting and budget revision.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#D9534F] hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {selectedCampaign.status === 'Approved' && canExecute && (
                    <button
                      type="button"
                      onClick={() =>
                        transitionCampaignStatus(
                          selectedCampaign.id,
                          'Scheduled',
                          `Scheduled for simulated dispatch on ${selectedCampaign.scheduledDate}.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Schedule Campaign</span>
                    </button>
                  )}

                  {selectedCampaign.status === 'Scheduled' && canExecute && (
                    <button
                      type="button"
                      onClick={() =>
                        transitionCampaignStatus(
                          selectedCampaign.id,
                          'Simulated Execution',
                          `Started simulated execution via ${selectedCampaign.channel}. No live messages sent.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A6BD] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Run Simulated Execution</span>
                    </button>
                  )}

                  {selectedCampaign.status === 'Simulated Execution' && canExecute && (
                    <button
                      type="button"
                      onClick={() =>
                        transitionCampaignStatus(
                          selectedCampaign.id,
                          'Completed',
                          'Simulated delivery and conversion tracking finalized.'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#15946A] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span>Mark Completed</span>
                    </button>
                  )}

                  {!['Completed', 'Cancelled', 'Rejected'].includes(selectedCampaign.status) &&
                    (canCreate || canApprove) && (
                      <button
                        type="button"
                        onClick={() =>
                          transitionCampaignStatus(
                            selectedCampaign.id,
                            'Cancelled',
                            'Campaign cancelled prior to completion.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>Cancel Campaign</span>
                      </button>
                    )}

                  {selectedCampaign.status === 'Pending Approval' && !canApprove && (
                    <span className="text-xs text-slate-500">
                      Awaiting sign-off from an Executive Management, Business Manager, or Admin persona.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campaign Audit Trail */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Campaign Audit Trail</h3>
              <div className="mt-4 divide-y divide-slate-200">
                {selectedCampaign.auditTrail.map((entry) => (
                  <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {entry.action}{' '}
                        <span className="font-normal text-slate-500">
                          ({entry.toStatus})
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {entry.timestamp}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">{entry.note}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {entry.actorName} · {entry.actorRole}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

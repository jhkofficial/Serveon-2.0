import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Lock,
  Sliders,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import type { Campaign } from '../../types/mvp3';

export function ApprovalInbox() {
  const {
    activeTenant,
    persona,
    campaigns,
    approvalPolicy,
    selectedCampaignId,
    transitionCampaignStatus,
    updateApprovalPolicy,
    openCampaignInRoute,
    loadCampaignIntoWizard,
  } = usePlatform();

  const [activeId, setActiveId] = useState<string>(
    selectedCampaignId ??
      campaigns.find((c) => c.status === 'Pending Approval')?.id ??
      campaigns[0]?.id ??
      ''
  );
  const [comment, setComment] = useState('');
  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('all');

  const canApprove = hasPermission(persona, 'campaigns.approve');
  const canManagePolicy = hasPermission(persona, 'admin.view');

  React.useEffect(() => {
    if (selectedCampaignId && campaigns.some((c) => c.id === selectedCampaignId)) {
      setActiveId(selectedCampaignId);
    }
  }, [selectedCampaignId, campaigns]);

  const pendingCount = campaigns.filter((c) => c.status === 'Pending Approval').length;

  const visibleCampaigns = useMemo(() => {
    const base =
      filterMode === 'pending'
        ? campaigns.filter((c) => c.status === 'Pending Approval')
        : campaigns;
    return base;
  }, [campaigns, filterMode]);

  const selected: Campaign | null =
    visibleCampaigns.find((c) => c.id === activeId) ?? visibleCampaigns[0] ?? null;

  function handleDecision(decision: 'Approved' | 'Rejected') {
    if (!selected) return;
    const noteText =
      comment.trim() ||
      (decision === 'Approved'
        ? `Approved campaign v${selected.version} after audience compliance and budget review.`
        : `Rejected campaign v${selected.version}; revision required before resubmission.`);
    const res = transitionCampaignStatus(selected.id, decision, noteText);
    if (res.ok) {
      setComment('');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Inbox & Governance"
        subtitle={`Role-enforced campaign review queue, decision audit history, reapproval controls, and tenant approval policies for ${activeTenant.shortName}.`}
        metaItems={[
          'BM05 · Approval Workflow',
          `${pendingCount} Pending Approval`,
          `Active Role: ${persona.title}`,
          canApprove ? 'Authorized Approver' : 'Approval Restricted',
        ]}
        actions={
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setFilterMode('pending')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterMode === 'pending' ? 'bg-[#102B4D] text-white' : 'text-slate-600'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterMode === 'all' ? 'bg-[#102B4D] text-white' : 'text-slate-600'
              }`}
            >
              All Campaigns ({campaigns.length})
            </button>
          </div>
        }
      />

      {/* Role Governance Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        {canApprove ? (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15946A]" />
        ) : (
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#D9534F]" />
        )}
        <div>
          <span className="font-semibold text-slate-900">Role Authorization Check:</span>{' '}
          {canApprove
            ? `${persona.name} (${persona.title}) is authorized to approve or reject pending campaigns. All decisions log approver, timestamp, version, and comments.`
            : `${persona.name} (${persona.title}) cannot approve or reject campaigns. Switch to Business Manager, Executive Management, Tenant Administrator, or Platform Super Admin to perform approval decisions.`}
        </div>
      </div>

      {/* Main Split: Queue + Approval Review Panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Queue */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-5">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Approval Queue</h2>
            <p className="text-xs text-slate-500">
              Select a campaign to inspect audience compliance, version history, and decision controls.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleCampaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No campaigns currently awaiting approval.
              </div>
            ) : (
              visibleCampaigns.map((cmp) => {
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
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          cmp.status === 'Pending Approval'
                            ? 'text-[#B47815]'
                            : cmp.status === 'Approved' || cmp.status === 'Completed'
                              ? 'text-[#15946A]'
                              : cmp.status === 'Rejected'
                                ? 'text-[#D9534F]'
                                : 'text-[#1769AA]'
                        }`}
                      >
                        {cmp.status} · v{cmp.version}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {cmp.scheduledDate}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{cmp.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {cmp.regionName} · {cmp.targetSegment} ·{' '}
                      {formatNumber(cmp.audience.eligibleReachableCount)} reachable ·{' '}
                      {formatIdrCompact(cmp.budgetAllocated)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Review & Decision Panel */}
        <div className="space-y-5 xl:col-span-7">
          {selected ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {selected.id} · Version v{selected.version} · Status:{' '}
                      <strong className="text-slate-900">{selected.status}</strong>
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.name}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {selected.objective}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadCampaignIntoWizard(selected.id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#1769AA] hover:text-[#1769AA]"
                  >
                    Edit in Studio
                  </button>
                </div>

                {selected.requiresReapproval && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                    <span>
                      This campaign was modified after an earlier approval and requires fresh sign-off
                      for v{selected.version}.
                    </span>
                  </div>
                )}

                <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-500">Eligible Reachable</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatNumber(selected.audience.eligibleReachableCount)}
                    </dd>
                    <div className="text-[11px] text-slate-500">
                      {selected.audience.optedOutExcluded} opt-out excl.
                    </div>
                  </div>
                  <div>
                    <dt className="text-slate-500">Channels</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {selected.channels.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Budget</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {formatIdrCompact(selected.budgetAllocated)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Submitted By</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{selected.createdBy}</dd>
                    <div className="text-[11px] text-slate-500">{selected.createdAt}</div>
                  </div>
                </dl>

                {/* Approval Action Box */}
                {selected.status === 'Pending Approval' ? (
                  <div className="mt-5 space-y-3">
                    <label htmlFor="approval-comment" className="block text-xs font-semibold text-slate-700">
                      Approval Decision Comments (Logged to Audit Trail)
                    </label>
                    <textarea
                      id="approval-comment"
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={!canApprove}
                      placeholder={
                        canApprove
                          ? 'Enter compliance notes, budget sign-off remarks, or rejection reason...'
                          : 'Switch to Business Manager, Executive Management, or Admin to submit an approval decision.'
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 disabled:bg-slate-100"
                    />
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => handleDecision('Approved')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#15946A] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve Campaign (v{selected.version})</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canApprove}
                        onClick={() => handleDecision('Rejected')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-[#D9534F] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject Campaign</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F5F8FC] px-4 py-3 text-xs">
                    <span className="text-slate-700">
                      Current status is <strong>{selected.status}</strong>.
                      {selected.status === 'Rejected' &&
                        ' Rejected campaigns are blocked from execution until revised and resubmitted.'}
                    </span>
                    {['Approved', 'Scheduled', 'Simulated Running', 'Completed'].includes(
                      selected.status
                    ) && (
                      <button
                        type="button"
                        onClick={() => openCampaignInRoute(selected.id, 'campaign_ops')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 py-2 font-semibold text-white hover:bg-[#102B4D]"
                      >
                        <span>Open in Campaign Operations</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Recorded Approval Decisions */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recorded Approval Decisions &amp; Audit Trail
                </h3>
                <div className="mt-4 divide-y divide-slate-200 text-xs">
                  {selected.approvalDecisions.map((dec) => (
                    <div key={dec.id} className="py-3 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold ${
                            dec.decision === 'Approved' ? 'text-[#15946A]' : 'text-[#D9534F]'
                          }`}
                        >
                          {dec.decision} (v{dec.campaignVersion})
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">{dec.timestamp}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{dec.comments}</p>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Approver: {dec.approverName} · {dec.approverRole}
                      </div>
                    </div>
                  ))}
                  {selected.auditTrail.map((entry) => (
                    <div key={entry.id} className="py-3 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          {entry.action} ({entry.toStatus})
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {entry.timestamp}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600">{entry.note}</p>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {entry.actorName} · {entry.actorRole}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
              Select a campaign on the left to inspect its approval status.
            </div>
          )}

          {/* Tenant Admin Approval Policy Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sliders className="h-4 w-4 text-[#1769AA]" />
                <span>Tenant Approval Policy ({activeTenant.shortName})</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {canManagePolicy ? 'Editable by Admin' : 'Read-Only'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5">
                <span className="font-medium text-slate-700">Require reapproval when edited</span>
                <input
                  type="checkbox"
                  disabled={!canManagePolicy}
                  checked={approvalPolicy.requireReapprovalOnEdit}
                  onChange={(e) =>
                    updateApprovalPolicy({ requireReapprovalOnEdit: e.target.checked })
                  }
                  className="rounded accent-[#1769AA]"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5">
                <span className="font-medium text-slate-700">Mandate consent verification</span>
                <input
                  type="checkbox"
                  disabled={!canManagePolicy}
                  checked={approvalPolicy.minimumConsentVerification}
                  onChange={(e) =>
                    updateApprovalPolicy({ minimumConsentVerification: e.target.checked })
                  }
                  className="rounded accent-[#1769AA]"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

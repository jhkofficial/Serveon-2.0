import React, { useMemo, useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Edit3,
  X,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { ReadinessCheckItem, ReadinessStatus } from '../../types/mvp4';
import { computeEvidenceBasedReadiness } from '../../core/enterprise/mvp4Engine';

const READINESS_STATUSES: ReadinessStatus[] = [
  'Not Started',
  'In Progress',
  'Evidence Required',
  'Verified',
  'Blocked',
];

export function EnterpriseReadinessWorkspace() {
  const { readinessCategories, updateReadinessItem } = usePlatform();

  const [editing, setEditing] = useState<{
    categoryId: string;
    item: ReadinessCheckItem;
  } | null>(null);
  const [draftStatus, setDraftStatus] = useState<ReadinessStatus>('In Progress');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftReviewDate, setDraftReviewDate] = useState('');
  const [draftIssue, setDraftIssue] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const summary = useMemo(
    () => computeEvidenceBasedReadiness(readinessCategories),
    [readinessCategories]
  );

  const openEditor = (categoryId: string, item: ReadinessCheckItem) => {
    setEditing({ categoryId, item });
    setDraftStatus(item.status);
    setDraftEvidence(item.evidenceReference);
    setDraftOwner(item.owner);
    setDraftReviewDate(item.reviewDate);
    setDraftIssue(item.openIssue);
    setFeedback(null);
  };

  const handleSave = () => {
    if (!editing) return;
    const res = updateReadinessItem(editing.categoryId, editing.item.id, {
      status: draftStatus,
      evidenceReference: draftEvidence,
      owner: draftOwner,
      reviewDate: draftReviewDate,
      openIssue: draftIssue,
    });
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setEditing(null);
    }
  };

  const statusColor = (st: ReadinessStatus) => {
    if (st === 'Verified') return 'bg-emerald-50 text-emerald-700';
    if (st === 'Blocked') return 'bg-rose-50 text-rose-700';
    if (st === 'Evidence Required') return 'bg-amber-50 text-amber-800';
    if (st === 'In Progress') return 'bg-sky-50 text-[#1769AA]';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Enterprise Readiness Center · 10 Governance &amp; Production Assurance Domains
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
          Enterprise Readiness Assessment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Evidence-based readiness tracking across Architecture, Data, Security, Multi-Tenant
          Isolation, AI Governance, Integration, Performance, Operations, DR, and Compliance.
        </p>
      </div>

      {/* Evidence-Based Scoring Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Evidence-Backed Score</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#102B4D]">
            {summary.evidenceBackedScorePct}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summary.verifiedCount} of {summary.totalItems} controls genuinely verified
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Production Blockers</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-rose-700">
            {summary.blockedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">Demo-only gaps requiring backend rollout</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Evidence Required / In Progress</div>
          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-700">
            {summary.evidenceRequiredCount + summary.inProgressCount}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {summary.evidenceRequiredCount} awaiting artifact · {summary.inProgressCount} active
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Production Sign-Off Gate</div>
          <div
            className={`mt-2 font-display text-lg font-bold ${
              summary.productionSignOffEligible ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            {summary.productionSignOffEligible ? 'Eligible' : 'Not Yet Ready (Demo Mode)'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Requires 0 Blocked &amp; 100% evidence-backed controls
          </div>
        </div>
      </div>

      {/* Evidence Rule Disclosure */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
        <div>
          <span className="font-semibold text-slate-900">Strict Evidence Gate Enforced:</span> A
          checkbox alone cannot mark a control <span className="font-semibold">Verified</span>.
          Every Verified status requires a non-empty evidence artifact reference, Responsible Owner,
          and Review Date. Controls tagged <span className="font-semibold">Demo-Only Gap</span>{' '}
          cannot be marked Verified in browser demo mode.
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

      {/* 10 Readiness Categories */}
      <div className="space-y-4">
        {readinessCategories.map((cat) => {
          const catScore = summary.categoryScores.find((c) => c.categoryId === cat.id);
          return (
            <div key={cat.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-[#1769AA]" />
                    <h2 className="font-display text-sm font-bold text-[#102B4D]">{cat.name}</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{cat.description}</p>
                </div>
                <div className="font-mono text-xs font-semibold text-slate-700">
                  {catScore?.verified ?? 0}/{catScore?.total ?? cat.items.length} Verified (
                  {catScore?.scorePct ?? 0}%)
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 px-5 py-3.5 text-xs md:flex-row md:items-start md:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.title}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusColor(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                        {item.demoOnlyLimitation && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Demo-Only Gap
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600">{item.requirement}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span>
                          Owner: <span className="font-medium text-slate-700">{item.owner || 'Unassigned'}</span>
                        </span>
                        <span>
                          Review Date:{' '}
                          <span className="font-mono text-slate-700">{item.reviewDate || 'Pending'}</span>
                        </span>
                        <span>
                          Evidence:{' '}
                          <span className="font-mono text-[#1769AA]">
                            {item.evidenceReference || 'None attached'}
                          </span>
                        </span>
                      </div>
                      {item.openIssue && (
                        <div className="text-[11px] text-rose-700">
                          Open Gap: {item.openIssue}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditor(cat.id, item)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Update Control</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Update Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#102B4D]">
                  Update Readiness Control
                </h3>
                <p className="text-xs text-slate-500">{editing.item.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Assessment Status</label>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as ReadinessStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {READINESS_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700">
                  Evidence Reference (Required for Verified)
                </label>
                <input
                  type="text"
                  value={draftEvidence}
                  onChange={(e) => setDraftEvidence(e.target.value)}
                  placeholder="e.g. PEN-TEST-2026-Q4 / CI-BUILD-109"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Responsible Owner</label>
                  <input
                    type="text"
                    value={draftOwner}
                    onChange={(e) => setDraftOwner(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Review Date</label>
                  <input
                    type="date"
                    value={draftReviewDate}
                    onChange={(e) => setDraftReviewDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700">Open Issue / Gap Note</label>
                <textarea
                  rows={2}
                  value={draftIssue}
                  onChange={(e) => setDraftIssue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                Validate &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

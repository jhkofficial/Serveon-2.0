import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  History,
  Database,
  Lock,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';

export function LearningGovernanceWorkspace() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    modelRegistry,
    predictions,
    recommendations,
    eventPerformance,
    auditLogs,
    requestModelRetraining,
    approveModelRetraining,
  } = usePlatform();

  const [retrainReason, setRetrainReason] = useState<Record<string, string>>({});
  const canApproveModel = hasPermission(persona, 'admin.manage_modules');

  const recommendationEffectiveness = useMemo(() => {
    const total = recommendations.length;
    const accepted = recommendations.filter(
      (r) => r.status === 'Accepted' || r.status === 'Converted to Campaign'
    ).length;
    const convertedToCampaign = recommendations.filter(
      (r) => r.status === 'Converted to Campaign'
    ).length;
    const dismissed = recommendations.filter((r) => r.status === 'Dismissed').length;
    return {
      total,
      accepted,
      convertedToCampaign,
      dismissed,
      adoptionPct: total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 0,
    };
  }, [recommendations]);

  const tenantGovernanceAudit = useMemo(
    () =>
      auditLogs.filter(
        (a) =>
          a.tenantId === activeTenant.id &&
          [
            'Model Governance',
            'Approval',
            'Simulation',
            'Business Rules',
            'Recommendation',
            'Prediction',
            'Campaign',
          ].includes(a.category)
      ),
    [auditLogs, activeTenant.id]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Continuous Learning & AI Governance"
        subtitle={`Model Registry, monitoring indicators, campaign feedback loops, recommendation effectiveness, and human-approved retraining workflows for ${activeTenant.shortName}.`}
        metaItems={[
          'BM08 · AI Governance',
          `${modelRegistry.length} Registered Models (${activeIndustry.name})`,
          'No Auto-Retraining / No Auto-Deploy',
          `Role: ${persona.title}`,
        ]}
      />

      {/* Explicit Governance Safeguard */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15946A]" />
        <div>
          <span className="font-semibold text-slate-900">Human-Governed MLOps Safeguard:</span>{' '}
          SERVEON never retrains or redeploys models automatically. Every retraining request logs a
          validation gate requiring explicit Tenant Administrator or Platform Super Admin approval
          before offline evaluation and controlled promotion.
        </div>
      </div>

      {/* Monitoring & Feedback KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Scored Predictions</span>
            <Database className="h-4 w-4 text-[#1769AA]" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(predictions.length)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Snapshot 2026-11-20 · Simulated Baseline
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>NBA Adoption Rate</span>
            <Activity className="h-4 w-4 text-[#16A6BD]" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-[#1769AA] tabular-nums">
            {recommendationEffectiveness.adoptionPct}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {recommendationEffectiveness.accepted} accepted / {recommendationEffectiveness.convertedToCampaign} campaigns
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Campaign Feedback Conversions</span>
            <CheckCircle2 className="h-4 w-4 text-[#15946A]" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-[#15946A] tabular-nums">
            {formatNumber(eventPerformance.totalConverted)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {eventPerformance.conversionRatePct}% conv · {formatIdrCompact(eventPerformance.totalAttributedRevenue)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Retrain Approvals</span>
            <AlertTriangle className="h-4 w-4 text-[#E3A33B]" />
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {modelRegistry.filter((m) => m.retrainingStatus === 'Requested — Pending Approval').length}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {modelRegistry.filter((m) => m.driftIndicator !== 'Stable').length} model(s) on Watch
          </div>
        </div>
      </div>

      {/* Model Registry & Controlled Retraining Workflow */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Model Registry &amp; Monitoring Indicators ({activeIndustry.name})
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Inspect model version, monitoring proxy, feature completeness, validation status, and request governed retraining.
            </p>
          </div>
          {!canApproveModel && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              <Lock className="h-3.5 w-3.5" />
              Retraining approval restricted to Admin roles
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {modelRegistry.map((mdl) => (
            <div key={mdl.id} className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {mdl.version} · Eval {mdl.lastEvaluatedAt} · {formatNumber(mdl.evaluationSampleSize)} records
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">{mdl.modelName}</h3>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    mdl.driftIndicator === 'Stable'
                      ? 'text-[#15946A]'
                      : mdl.driftIndicator === 'Watch'
                        ? 'text-[#B47815]'
                        : 'text-[#D9534F]'
                  }`}
                >
                  Drift: {mdl.driftIndicator}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
                <div>
                  <dt className="text-[11px] text-slate-500">Monitoring Proxy</dt>
                  <dd className="mt-0.5 font-mono font-bold text-slate-900 tabular-nums">
                    {mdl.monitoringScorePct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Feature Health</dt>
                  <dd className="mt-0.5 font-mono font-bold text-[#1769AA] tabular-nums">
                    {mdl.featureCompletenessPct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Validation</dt>
                  <dd className="mt-0.5 truncate font-semibold text-slate-700">
                    {mdl.validationStatus}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-slate-600">{mdl.validationNotes}</p>

              {/* Retraining Governance Action */}
              <div className="mt-4 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Retraining Status:</span>
                  <span className="font-semibold text-[#1769AA]">{mdl.retrainingStatus}</span>
                </div>

                {mdl.retrainingStatus === 'Idle' && (
                  <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      aria-label={`Retraining reason for ${mdl.modelName}`}
                      value={retrainReason[mdl.id] ?? ''}
                      onChange={(e) =>
                        setRetrainReason((prev) => ({ ...prev, [mdl.id]: e.target.value }))
                      }
                      placeholder="Enter reason (e.g. Q4 campaign conversion feedback)..."
                      className="h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        requestModelRetraining(
                          mdl.id,
                          retrainReason[mdl.id]?.trim() ||
                            'Incorporate latest simulated campaign conversion feedback.'
                        );
                        setRetrainReason((prev) => ({ ...prev, [mdl.id]: '' }));
                      }}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1769AA] bg-white px-3 text-xs font-semibold text-[#1769AA] hover:bg-[#1769AA] hover:text-white"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Request Retraining</span>
                    </button>
                  </div>
                )}

                {mdl.retrainingStatus === 'Requested — Pending Approval' && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs">
                    <span className="text-amber-900">
                      Requested by {mdl.retrainingRequestedBy} ({mdl.retrainingRequestedAt})
                    </span>
                    {canApproveModel && (
                      <button
                        type="button"
                        onClick={() =>
                          approveModelRetraining(
                            mdl.id,
                            'Approved for controlled offline retraining & shadow validation.'
                          )
                        }
                        className="rounded-md bg-[#15946A] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Approve Scheduled Retrain
                      </button>
                    )}
                  </div>
                )}

                {mdl.retrainingStatus === 'Approved for Scheduled Retrain' && (
                  <div className="mt-2 text-[11px] font-medium text-[#15946A]">
                    Approved by {mdl.retrainingApprovedBy} · Awaiting manual offline validation before promotion.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Feedback + Governance Audit History */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">
            Campaign Feedback &amp; Recommendation Loop
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Closed-loop telemetry feeding future model evaluation cycles (offline only).
          </p>
          <dl className="mt-4 divide-y divide-slate-100 text-xs">
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Total Recommendations Evaluated</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {recommendationEffectiveness.total}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Accepted / Converted to Campaign</dt>
              <dd className="font-mono font-semibold text-[#15946A] tabular-nums">
                {recommendationEffectiveness.accepted} ({recommendationEffectiveness.convertedToCampaign} campaigns)
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Dismissed by Commercial Teams</dt>
              <dd className="font-mono font-semibold text-slate-600 tabular-nums">
                {recommendationEffectiveness.dismissed}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Executed Campaign Reach</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatNumber(eventPerformance.totalReach)}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-slate-500">Observed Conversion Rate</dt>
              <dd className="font-mono font-semibold text-[#1769AA] tabular-nums">
                {eventPerformance.conversionRatePct}%
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#1769AA]" />
            <h2 className="text-base font-semibold text-slate-900">
              AI &amp; Campaign Governance Audit History
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Tenant-scoped immutable event stream for {activeTenant.name}.
          </p>
          <div className="mt-4 max-h-[280px] divide-y divide-slate-100 overflow-auto text-xs">
            {tenantGovernanceAudit.length === 0 ? (
              <div className="py-6 text-center text-slate-500">
                No governance events recorded for this tenant yet.
              </div>
            ) : (
              tenantGovernanceAudit.slice(0, 20).map((ev) => (
                <div key={ev.id} className="py-2.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      [{ev.category}] {ev.action}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">
                      {ev.timestamp}
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-600">{ev.details}</p>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {ev.actorName} · {ev.actorRole}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

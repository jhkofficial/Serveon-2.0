import React, { useState } from 'react';
import { Cpu, ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { EnterpriseAiModelRecord, EnterpriseAiModelStatus } from '../../types/mvp4';

const NEXT_STAGE_OPTIONS: Record<EnterpriseAiModelStatus, EnterpriseAiModelStatus[]> = {
  Draft: ['Under Review', 'Retired'],
  'Under Review': ['Validated', 'Draft'],
  Validated: ['Approved', 'Under Review'],
  Approved: ['Active', 'Deprecated'],
  Active: ['Deprecated', 'Retired'],
  Deprecated: ['Retired', 'Active'],
  Retired: [],
};

export function EnterpriseAiGovernanceWorkspace() {
  const { activeTenant, enterpriseAiModels, transitionEnterpriseAiModel, navigateToRoute } =
    usePlatform();

  const [noteByModel, setNoteByModel] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleTransition = (model: EnterpriseAiModelRecord, nextStatus: EnterpriseAiModelStatus) => {
    const res = transitionEnterpriseAiModel(
      model.id,
      nextStatus,
      noteByModel[model.id] || `Governed lifecycle transition to ${nextStatus}.`
    );
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setNoteByModel((prev) => ({ ...prev, [model.id]: '' }));
    }
  };

  const executionBadgeClass = (mode: EnterpriseAiModelRecord['executionMode']) => {
    if (mode === 'Simulated AI') return 'bg-amber-50 text-amber-800';
    if (mode === 'Gemini-Generated Explanation') return 'bg-sky-50 text-[#1769AA]';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise AI Governance · Tenant: {activeTenant.name}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            AI Use-Case &amp; Model Registry Governance
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enforce 7-state model lifecycle controls (Draft → Under Review → Validated → Approved →
            Active → Deprecated → Retired) with mandatory human approval before switching active
            versions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateToRoute('learning_governance')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span>Open Continuous Learning Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Explicit Governance Guardrail Banner */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <div className="font-semibold text-[#102B4D]">Explicit Execution Mode Separation</div>
          <p className="mt-1 text-slate-600">
            Every registry entry explicitly declares whether it runs{' '}
            <span className="font-semibold text-amber-800">Simulated AI</span>,{' '}
            <span className="font-semibold text-[#1769AA]">Gemini-Generated Explanation</span>, or{' '}
            <span className="font-semibold text-slate-800">Real Model Inference</span>.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <div className="font-semibold text-[#102B4D]">Zero Auto-Retrain / Auto-Deploy</div>
          <p className="mt-1 text-slate-600">
            Automated model retraining and silent production promotion are permanently disabled.
            Candidate versions must pass Validated → Approved before becoming Active.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <div className="font-semibold text-[#102B4D]">Audit Trail Enforcement</div>
          <p className="mt-1 text-slate-600">
            Every approval, promotion, deprecation, or blocked transition is recorded in the
            Enterprise Audit Ledger with actor, object, and outcome.
          </p>
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

      {/* Registered AI Models & Use Cases */}
      <div className="space-y-4">
        {enterpriseAiModels.map((model) => {
          const nextStates = NEXT_STAGE_OPTIONS[model.status] ?? [];
          return (
            <div key={model.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Cpu className="h-4 w-4 text-[#1769AA]" />
                    <h3 className="font-display text-base font-bold text-[#102B4D]">
                      {model.useCaseName}
                    </h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${executionBadgeClass(
                        model.executionMode
                      )}`}
                    >
                      {model.executionMode}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    Model: {model.modelName} · v{model.version} · Env: {model.deploymentEnvironment}{' '}
                    · Owner: {model.owner}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-semibold ${
                      model.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : model.status === 'Approved'
                          ? 'bg-sky-50 text-[#1769AA]'
                          : model.status === 'Validated' || model.status === 'Under Review'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Lifecycle: {model.status}
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                    {model.approvalStatus}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Evaluation &amp; Calibration
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {model.evaluationMetrics.primaryMetricLabel}:{' '}
                    <span className="font-mono text-[#1769AA]">
                      {model.evaluationMetrics.primaryMetricValue}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {model.evaluationMetrics.calibrationNote}
                  </p>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Monitoring &amp; Governance Metadata
                  </div>
                  <div className="mt-1 space-y-1 text-slate-700">
                    <div>
                      Monitoring: <span className="font-semibold">{model.monitoringStatus}</span>
                    </div>
                    <div>
                      Last Validated:{' '}
                      <span className="font-mono">{model.lastValidationDate}</span>
                    </div>
                    {model.approvedBy && (
                      <div className="text-emerald-700">
                        Approved by {model.approvedBy} ({model.approvedAt})
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Declared Limitations
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-slate-600">
                    {model.limitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {nextStates.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
                  <input
                    type="text"
                    value={noteByModel[model.id] ?? ''}
                    onChange={(e) =>
                      setNoteByModel((prev) => ({ ...prev, [model.id]: e.target.value }))
                    }
                    placeholder="Governance review / approval note..."
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {nextStates.map((targetStatus) => (
                      <button
                        key={targetStatus}
                        type="button"
                        onClick={() => handleTransition(model, targetStatus)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          targetStatus === 'Approved' || targetStatus === 'Active'
                            ? 'bg-[#1769AA] text-white hover:bg-[#102B4D]'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Move to {targetStatus}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

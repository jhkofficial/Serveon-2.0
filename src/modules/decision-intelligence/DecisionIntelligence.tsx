import React, { useState } from 'react';
import { Send, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { serveonAiService } from '../../core/ai-service/aiClient';
import { hasPermission } from '../../core/permissions/rbac';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';

type DecisionTab = 'descriptive' | 'predictive' | 'prescriptive' | 'explainable' | 'assistant';

export function DecisionIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    filters,
    analytics,
    campaigns,
    scopedCustomers,
    openCampaignComposerFromAction,
    logAuditEvent,
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<DecisionTab>('assistant');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; prompt: string; answer: string; model: string; generatedAt: string }>
  >([]);

  const canQueryAi = hasPermission(persona, 'decision.ai_query');
  const canCreateCampaign = hasPermission(persona, 'campaigns.create');

  const sampleCustomer = scopedCustomers.find((c) => c.model_outputs.churn_risk_category === 'High') ?? scopedCustomers[0];

  async function handleSubmitQuestion(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || loading || !canQueryAi) return;
    setLoading(true);
    setErrorMsg(null);
    setQuestion('');

    try {
      const res = await serveonAiService.askBusinessQuestion({
        question: trimmed,
        tenant: activeTenant,
        industry: activeIndustry,
        persona,
        filters,
        analytics,
        campaigns,
      });
      setHistory((prev) => [
        {
          id: `q-${Date.now()}`,
          prompt: trimmed,
          answer: res.answer,
          model: res.model,
          generatedAt: res.generatedAt,
        },
        ...prev,
      ]);
      logAuditEvent(
        'AI Query',
        'Decision Intelligence Assistant query',
        `Tenant: ${activeTenant.shortName} · "${trimmed.slice(0, 72)}"`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Gemini API endpoint.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decision Intelligence"
        subtitle={`Descriptive, predictive, prescriptive, explainable AI, and Gemini executive assistant for ${activeTenant.shortName}.`}
        metaItems={[
          'BM06',
          'Illustrative AI Simulation + Server Gemini API',
          `Grounded Tenant: ${activeTenant.shortName}`,
        ]}
      />

      {/* Segmented Pillar Tabs */}
      <div
        role="tablist"
        aria-label="Decision Intelligence pillars"
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5"
      >
        {(
          [
            { id: 'assistant', label: 'AI Assistant (Gemini)' },
            { id: 'descriptive', label: 'Descriptive Insights' },
            { id: 'predictive', label: 'Predictive Signals' },
            { id: 'prescriptive', label: 'Prescriptive Actions' },
            { id: 'explainable', label: 'Explainable AI' },
          ] as Array<{ id: DecisionTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'assistant' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  SERVEON Business Insights Assistant
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Powered by server-side Gemini API (`gemini-4-hydrogen`). Grounded strictly in{' '}
                  {activeTenant.name} permitted Demo Data.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15946A]">
                <ShieldCheck className="h-4 w-4" />
                Human-in-the-Loop
              </span>
            </div>

            {!canQueryAi ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Your active role ({persona.title}) does not have AI query permission.
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmitQuestion(question);
                  }}
                  className="mt-5 flex flex-col gap-2.5 sm:flex-row"
                >
                  <label htmlFor="decision-ai-prompt" className="sr-only">
                    Ask a natural-language business question
                  </label>
                  <input
                    id="decision-ai-prompt"
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={`Ask about ${activeTenant.shortName} retention, top regencies, or campaign priorities...`}
                    maxLength={1000}
                    className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !question.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1769AA] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D] disabled:opacity-50 whitespace-nowrap"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{loading ? 'Analyzing...' : 'Analyze Context'}</span>
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Which regency in ${activeTenant.primaryProvinceName} should we prioritize next quarter?`,
                    `What is driving our At-Risk ${activeIndustry.terminology.customerPlural} count?`,
                    `Recommend an approval-ready campaign plan based on current KPIs.`,
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSubmitQuestion(sample)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-[#1769AA] hover:text-[#102B4D]"
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D9534F]" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="mt-6 space-y-4">
                  {history.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-[#F5F8FC] p-6 text-center text-xs text-slate-600">
                      Submit a business question above to synthesize structured metrics for{' '}
                      <span className="font-semibold text-slate-900">{activeTenant.name}</span>.
                      The assistant will never invent undocumented numbers and flags unavailable
                      dimensions transparently.
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
                        <div className="text-xs font-semibold text-[#102B4D]">
                          Question: {item.prompt}
                        </div>
                        <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                          {item.answer}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#15946A]" />
                            Model: {item.model} · Grounded in {activeTenant.shortName} · Human approval required
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
            <h3 className="text-sm font-semibold text-slate-900">Grounding Context Sent to AI</h3>
            <p className="mt-1 text-xs text-slate-500">
              Only aggregate, role-permitted metrics from the active tenant are included—never raw
              PII or other tenants&apos; records.
            </p>
            <dl className="mt-4 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Tenant Boundary</dt>
                <dd className="font-semibold text-slate-900">{activeTenant.shortName}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Industry Profile</dt>
                <dd className="font-semibold text-slate-900">{activeIndustry.name}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Role Scope</dt>
                <dd className="font-semibold text-slate-900">{persona.scopeLevel}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Scoped Records</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNumber(analytics.totalFilteredCustomers)}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Period Volume</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatIdrCompact(analytics.totalPeriodRevenue)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'descriptive' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {analytics.aiInsightCards.map((card) => (
            <div key={card.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-semibold text-[#1769AA]">{card.category}</div>
              <h3 className="mt-1.5 text-base font-semibold text-slate-900">{card.headline}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.evidence}</p>
              <div className="mt-4 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                {card.confidenceLabel}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'predictive' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Active Predictive Signals ({activeIndustry.name})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Illustrative AI Simulation · Evaluated 2026-11-20 · Version serveon-sim-v1.4
          </p>
          <div className="mt-4 divide-y divide-slate-200">
            {activeIndustry.aiUseCases.map((uc) => (
              <div key={uc.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#1769AA]">{uc.modelType}</div>
                  <div className="text-sm font-semibold text-slate-900">{uc.title}</div>
                  <p className="mt-0.5 text-xs text-slate-600">{uc.description}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-500">
                  Illustrative AI Simulation
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'prescriptive' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Prescriptive Business Recommendations
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                All actions require human approval via the CRM &amp; Campaign workflow before simulated execution.
              </p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-slate-200">
            {analytics.recommendedActions.map((act) => (
              <div key={act.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    {act.priority} Priority · {act.regionName} · Channel: {act.suggestedChannel}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">{act.title}</div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {act.targetSummary} · Projected impact: {act.estimatedImpact}
                  </p>
                </div>
                {canCreateCampaign && (
                  <button
                    type="button"
                    onClick={() =>
                      openCampaignComposerFromAction({
                        name: act.title,
                        objective: `Prescriptive action approved for drafting: ${act.targetSummary}`,
                        targetSegment: act.segment,
                        regionId: act.regionId,
                        channel:
                          act.suggestedChannel === 'Branch Follow-up'
                            ? 'Branch Follow-up'
                            : act.suggestedChannel === 'Email'
                              ? 'Email'
                              : 'WhatsApp',
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                  >
                    <span>Send to Campaign Draft</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'explainable' && sampleCustomer && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Explainable AI — Sample Feature Attribution
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Illustrative explanation for {sampleCustomer.full_name} ({sampleCustomer.code}) · Churn
            Score {sampleCustomer.model_outputs.churn_risk_score}/100 ({sampleCustomer.model_outputs.churn_risk_category})
          </p>
          <div className="mt-5 space-y-3.5">
            {sampleCustomer.model_outputs.contributing_factors.map((f) => (
              <div key={f.factor} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{f.factor}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {f.impact > 0 ? `+${f.impact} pts` : `${f.impact} pts`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      f.direction === 'increases_risk'
                        ? 'bg-[#D9534F]'
                        : f.direction === 'reduces_risk'
                          ? 'bg-[#15946A]'
                          : 'bg-[#1769AA]'
                    }`}
                    style={{ width: `${Math.min(100, Math.abs(f.impact) * 2.2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

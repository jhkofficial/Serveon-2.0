import React, { useEffect, useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { usePlatform } from '../core/state/PlatformContext';
import { serveonAiService, type AiInsightResponse } from '../core/ai-service/aiClient';
import { hasPermission } from '../core/permissions/rbac';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  generatedAt?: string;
  requiresApproval?: boolean;
}

export function ContextualAiPanel() {
  const {
    aiPanelOpen,
    setAiPanelOpen,
    activeTenant,
    activeIndustry,
    persona,
    filters,
    analytics,
    campaigns,
    logAuditEvent,
    openCampaignComposerFromAction,
  } = usePlatform();

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);

  const canQueryAi = hasPermission(persona, 'decision.ai_query');
  const canCreateCampaign = hasPermission(persona, 'campaigns.create');

  useEffect(() => {
    if (!aiPanelOpen) return;
    let active = true;
    serveonAiService
      .checkHealth()
      .then((h) => {
        if (active) setGeminiReady(h.geminiConfigured);
      })
      .catch(() => {
        if (active) setGeminiReady(false);
      });
    return () => {
      active = false;
    };
  }, [aiPanelOpen]);

  // Reset conversation when tenant switches so private context never bleeds across tenants
  useEffect(() => {
    setMessages([]);
    setErrorMsg(null);
  }, [activeTenant.id]);

  if (!aiPanelOpen) return null;

  const suggestedPrompts = [
    `Which region in ${activeTenant.primaryProvinceName} shows the strongest expansion opportunity?`,
    `Summarize our at-risk ${activeIndustry.terminology.customerPlural.toLowerCase()} and recommended retention steps.`,
    `Compare our top customer segments and campaign readiness.`,
  ];

  async function handleAsk(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || loading || !canQueryAi) return;

    setErrorMsg(null);
    setLoading(true);
    const userMsg: AiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');

    try {
      const response: AiInsightResponse = await serveonAiService.askBusinessQuestion({
        question: trimmed,
        tenant: activeTenant,
        industry: activeIndustry,
        persona,
        filters,
        analytics,
        campaigns,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: response.answer,
          model: response.model,
          generatedAt: response.generatedAt,
          requiresApproval: response.requiresHumanApproval,
        },
      ]);

      logAuditEvent(
        'AI Query',
        'Queried Gemini Business Insights Assistant',
        `Tenant: ${activeTenant.shortName} · Prompt: "${trimmed.slice(0, 80)}"`
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach server-side AI insights service.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      role="complementary"
      aria-label="Contextual AI Insights Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Contextual AI Insights</h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {activeTenant.shortName} · {activeIndustry.name} · Demo Data
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAiPanelOpen(false)}
          aria-label="Close AI Insights Panel"
          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Governance notice */}
        <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3.5 text-xs text-slate-700">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
            <div>
              <p className="font-semibold text-slate-900">Tenant-Grounded Advisory Mode</p>
              <p className="mt-1 leading-relaxed text-slate-600">
                Answers are grounded strictly in {activeTenant.shortName} permitted demo metrics.
                All business actions require explicit human review and approval.
              </p>
            </div>
          </div>
        </div>

        {/* Deterministic simulated insight summaries */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900">Active Context Highlights</h3>
            <span className="text-[11px] text-slate-500">Illustrative AI Simulation</span>
          </div>
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {analytics.aiInsightCards.map((card) => (
              <div key={card.id} className="p-3.5">
                <div className="text-[11px] font-medium text-[#1769AA]">{card.category}</div>
                <p className="mt-1 text-sm font-medium text-slate-900">{card.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{card.evidence}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live Gemini Assistant Q&A */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900">Ask SERVEON Assistant</h3>
            <span className="text-[11px] text-slate-500">
              {geminiReady === null
                ? 'Checking server service...'
                : geminiReady
                  ? 'Server Gemini Ready'
                  : 'Server Key Not Configured'}
            </span>
          </div>

          {!canQueryAi ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              Your active persona ({persona.title}) does not include AI Assistant query permissions.
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Suggested executive questions grounded in the current filters:
                  </p>
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleAsk(prompt)}
                      disabled={loading}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:border-[#1769AA] hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {messages.length > 0 && (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        msg.role === 'user'
                          ? 'ml-6 rounded-lg bg-[#102B4D] px-3.5 py-2.5 text-xs text-white'
                          : 'rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-3 text-xs text-slate-800'
                      }
                    >
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                      {msg.role === 'assistant' && (
                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                          <span>Human approval required before action</span>
                          {canCreateCampaign && analytics.recommendedActions[0] && (
                            <button
                              type="button"
                              onClick={() => {
                                const act = analytics.recommendedActions[0];
                                openCampaignComposerFromAction({
                                  name: act.title,
                                  objective: `Follow-up initiated after AI briefing: ${act.targetSummary}`,
                                  targetSegment: act.segment,
                                  regionId: act.regionId,
                                  channel: 'WhatsApp',
                                });
                                setAiPanelOpen(false);
                              }}
                              className="font-medium text-[#1769AA] hover:underline"
                            >
                              Draft Campaign
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {loading && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                  Analyzing {activeTenant.shortName} authorized context via server Gemini API...
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D9534F]" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Input Footer */}
      {canQueryAi && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="border-t border-slate-200 bg-white p-4"
        >
          <label htmlFor="contextual-ai-input" className="sr-only">
            Ask a business question about {activeTenant.shortName}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="contextual-ai-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask about ${activeTenant.shortName} metrics...`}
              maxLength={1000}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1769AA] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              aria-label="Send question to AI Assistant"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1769AA] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#102B4D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {messages.length > 0 && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#15946A]" />
                Grounded in current filters
              </span>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setErrorMsg(null);
                }}
                className="text-slate-500 hover:text-slate-900"
              >
                Clear conversation
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

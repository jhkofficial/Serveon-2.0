import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  Rocket,
  ShieldCheck,
  Sliders,
  Plus,
  History,
  Info,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import type { CampaignChannel } from '../../types/platform';
import type {
  BusinessRule,
  NbaStrategy,
  Recommendation,
  RecommendationPriority,
  RecommendationStatus,
} from '../../types/mvp3';

const STRATEGIES: Array<'ALL' | NbaStrategy> = ['ALL', 'RETAIN', 'DEFEND', 'ACQUIRE', 'DEVELOP'];
const CHANNELS: CampaignChannel[] = ['WhatsApp', 'Email', 'SMS', 'Call Center', 'Branch Follow-up'];
const PRIORITIES: RecommendationPriority[] = ['Critical', 'High', 'Medium', 'Low'];

function strategyTone(strategy: NbaStrategy): string {
  switch (strategy) {
    case 'RETAIN':
      return 'text-[#D9534F] font-semibold';
    case 'DEFEND':
      return 'text-[#102B4D] font-semibold';
    case 'DEVELOP':
      return 'text-[#1769AA] font-semibold';
    case 'ACQUIRE':
      return 'text-[#15946A] font-semibold';
  }
}

export function NextBestActionWorkspace() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    recommendations,
    businessRules,
    filters,
    updateRecommendationStatus,
    openCampaignStudioFromRecommendation,
    openCustomer360,
    saveBusinessRule,
    toggleBusinessRuleActive,
  } = usePlatform();

  const [tab, setTab] = useState<'inbox' | 'rules'>('inbox');
  const [strategyFilter, setStrategyFilter] = useState<'ALL' | NbaStrategy>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RecommendationStatus>('ALL');
  const [selectedRecId, setSelectedRecId] = useState<string>(recommendations[0]?.id ?? '');

  // Admin Rule Editor State
  const isAdmin = hasPermission(persona, 'admin.manage_industry');
  const canCreateCampaign = hasPermission(persona, 'campaigns.create');
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>(undefined);
  const [ruleName, setRuleName] = useState('');
  const [ruleStrategy, setRuleStrategy] = useState<NbaStrategy>('RETAIN');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleChurn, setRuleChurn] = useState('70');
  const [ruleProp, setRuleProp] = useState('');
  const [ruleOpp, setRuleOpp] = useState('');
  const [ruleSegment, setRuleSegment] = useState('At-Risk Retention');
  const [ruleChannel, setRuleChannel] = useState<CampaignChannel>('WhatsApp');
  const [rulePriority, setRulePriority] = useState<RecommendationPriority>('High');
  const [ruleActionTemplate, setRuleActionTemplate] = useState('');
  const [ruleChangeNote, setRuleChangeNote] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);

  const filteredRecs = useMemo(() => {
    return recommendations.filter((r) => {
      if (strategyFilter !== 'ALL' && r.strategy !== strategyFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (filters.regionId !== 'ALL' && r.regionId !== filters.regionId) return false;
      return true;
    });
  }, [recommendations, strategyFilter, statusFilter, filters.regionId]);

  const activeRec: Recommendation | null =
    filteredRecs.find((r) => r.id === selectedRecId) ?? filteredRecs[0] ?? null;

  const strategySummary = useMemo(() => {
    const map: Record<NbaStrategy, number> = { RETAIN: 0, DEFEND: 0, ACQUIRE: 0, DEVELOP: 0 };
    for (const r of recommendations) {
      map[r.strategy]++;
    }
    return map;
  }, [recommendations]);

  function openNewRuleForm() {
    setEditingRuleId(undefined);
    setRuleName('');
    setRuleStrategy('RETAIN');
    setRuleDesc('');
    setRuleChurn('70');
    setRuleProp('');
    setRuleOpp('');
    setRuleSegment('At-Risk Retention');
    setRuleChannel('WhatsApp');
    setRulePriority('High');
    setRuleActionTemplate('');
    setRuleChangeNote('Created new governance business rule');
    setRuleError(null);
    setRuleFormOpen(true);
  }

  function openEditRuleForm(rule: BusinessRule) {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleStrategy(rule.strategy);
    setRuleDesc(rule.description);
    setRuleChurn(rule.minChurnScore !== null ? String(rule.minChurnScore) : '');
    setRuleProp(rule.minPropensityScore !== null ? String(rule.minPropensityScore) : '');
    setRuleOpp(rule.minOpportunityScore !== null ? String(rule.minOpportunityScore) : '');
    setRuleSegment(rule.targetSegment);
    setRuleChannel(rule.suggestedChannel);
    setRulePriority(rule.priority);
    setRuleActionTemplate(rule.actionTemplate);
    setRuleChangeNote('');
    setRuleError(null);
    setRuleFormOpen(true);
  }

  function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    const parseThreshold = (v: string): number | null => {
      if (!v.trim()) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
    };
    const res = saveBusinessRule({
      id: editingRuleId,
      tenant_id: activeTenant.id,
      industryId: activeIndustry.id,
      name: ruleName,
      strategy: ruleStrategy,
      description: ruleDesc,
      minChurnScore: parseThreshold(ruleChurn),
      minPropensityScore: parseThreshold(ruleProp),
      minOpportunityScore: parseThreshold(ruleOpp),
      targetSegment: ruleSegment,
      suggestedChannel: ruleChannel,
      priority: rulePriority,
      actionTemplate: ruleActionTemplate,
      active: true,
      changeNote: ruleChangeNote || 'Updated rule threshold parameters',
    });
    if (!res.ok) {
      setRuleError(res.message);
      return;
    }
    setRuleFormOpen(false);
    setRuleError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Next-Best-Action Engine"
        subtitle={`Transparent deterministic recommendation inbox (RETAIN, DEFEND, ACQUIRE, DEVELOP) and governed business rules for ${activeIndustry.name}.`}
        metaItems={[
          'BM06 · NBA Engine',
          'Deterministic Rule Ranking (Demo)',
          `${formatNumber(recommendations.length)} Ranked Recommendations`,
          `${businessRules.filter((r) => r.active).length} Active Rules`,
        ]}
        actions={
          <div
            role="tablist"
            aria-label="Next-Best-Action views"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'inbox'}
              onClick={() => setTab('inbox')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'inbox' ? 'bg-[#102B4D] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recommendation Inbox
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'rules'}
              onClick={() => setTab('rules')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'rules' ? 'bg-[#102B4D] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Business Rules {isAdmin ? '(Admin)' : '(Read-Only)'}</span>
            </button>
          </div>
        }
      />

      {tab === 'inbox' && (
        <>
          {/* 4 Strategy Filter Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(['RETAIN', 'DEFEND', 'DEVELOP', 'ACQUIRE'] as NbaStrategy[]).map((strat) => {
              const active = strategyFilter === strat;
              return (
                <button
                  key={strat}
                  type="button"
                  onClick={() => setStrategyFilter(active ? 'ALL' : strat)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-[#1769AA] bg-[#F0F7FC]'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-xs ${strategyTone(strat)}`}>{strat}</div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {strategySummary[strat]}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {strat === 'RETAIN'
                      ? 'High churn prevention'
                      : strat === 'DEFEND'
                        ? 'High-value loyalty protection'
                        : strat === 'DEVELOP'
                          ? 'Upgrade & cross-sell growth'
                          : 'High-index territory expansion'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Strategy:</span>
              {STRATEGIES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStrategyFilter(st)}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    strategyFilter === st
                      ? 'bg-[#1769AA] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="nba-status-filter" className="text-slate-500">
                Status
              </label>
              <select
                id="nba-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | RecommendationStatus)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Accepted">Accepted</option>
                <option value="Converted to Campaign">Converted to Campaign</option>
                <option value="Dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Split Inbox: Table + Detail Card */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-7">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Recommendation Inbox ({filteredRecs.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Generated transparently from active {activeIndustry.name} business rules.
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredRecs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No recommendations match the selected filters.
                  </div>
                ) : (
                  filteredRecs.map((rec) => {
                    const isSelected = activeRec?.id === rec.id;
                    return (
                      <div
                        key={rec.id}
                        onClick={() => setSelectedRecId(rec.id)}
                        className={`cursor-pointer px-5 py-4 transition-colors ${
                          isSelected ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500">{rec.id}</span>
                            <span>·</span>
                            <span className={strategyTone(rec.strategy)}>{rec.strategy}</span>
                            <span>·</span>
                            <span
                              className={
                                rec.priority === 'Critical'
                                  ? 'font-semibold text-[#D9534F]'
                                  : 'font-medium text-slate-700'
                              }
                            >
                              {rec.priority} Priority
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-semibold ${
                              rec.status === 'Converted to Campaign' || rec.status === 'Accepted'
                                ? 'text-[#15946A]'
                                : rec.status === 'Dismissed'
                                  ? 'text-slate-400'
                                  : 'text-[#1769AA]'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </div>

                        <div className="mt-1.5 text-sm font-semibold text-slate-900">
                          {rec.entityName}{' '}
                          <span className="font-normal text-slate-500">
                            ({rec.regionName} · {rec.segment})
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-700">{rec.recommendedAction}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>
                            Channel: <strong className="text-slate-700">{rec.suggestedChannel}</strong> ·
                            Eligibility:{' '}
                            <strong
                              className={
                                rec.eligibility === 'Eligible' ? 'text-[#15946A]' : 'text-[#D9534F]'
                              }
                            >
                              {rec.eligibility}
                            </strong>
                          </span>
                          <span className="font-mono font-semibold text-slate-800 tabular-nums">
                            Est. {formatIdrCompact(rec.estimatedRevenueImpact)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Detail & Actions Panel */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
              {activeRec ? (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-500">
                        {activeRec.id} · Rule v{activeRec.ruleVersion}
                      </span>
                      <span className={strategyTone(activeRec.strategy)}>{activeRec.strategy}</span>
                    </div>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">
                      {activeRec.entityName}
                    </h3>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {activeRec.entityCode} · {activeRec.regionName} · {activeRec.segment}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Recommended Action</div>
                    <p className="mt-1 text-sm font-semibold text-[#102B4D]">
                      {activeRec.recommendedAction}
                    </p>
                  </div>

                  <dl className="divide-y divide-slate-100 text-xs">
                    <div className="py-2.5">
                      <dt className="font-semibold text-slate-700">Business Rationale</dt>
                      <dd className="mt-0.5 leading-relaxed text-slate-600">
                        {activeRec.businessRationale}
                      </dd>
                    </div>
                    <div className="py-2.5">
                      <dt className="font-semibold text-slate-700">Expected Outcome (Simulated)</dt>
                      <dd className="mt-0.5 text-slate-600">{activeRec.expectedOutcome}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Suggested Channel</dt>
                      <dd className="font-semibold text-slate-900">{activeRec.suggestedChannel}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Eligibility &amp; Consent</dt>
                      <dd
                        className={`font-semibold ${
                          activeRec.eligibility === 'Eligible' ? 'text-[#15946A]' : 'text-[#D9534F]'
                        }`}
                      >
                        {activeRec.eligibility}
                      </dd>
                    </div>
                    <div className="py-2 text-[11px] text-slate-500">
                      {activeRec.eligibilityNotes}
                    </div>
                  </dl>

                  {/* Action Controls: View, Accept, Review, Dismiss, Create Campaign */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-4">
                    {canCreateCampaign && (
                      <button
                        type="button"
                        onClick={() => openCampaignStudioFromRecommendation(activeRec)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1769AA] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        <span>Create Campaign from Recommendation</span>
                      </button>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updateRecommendationStatus(activeRec.id, 'Accepted')}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-[#15946A] hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRecommendationStatus(activeRec.id, 'In Review')}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRecommendationStatus(activeRec.id, 'Dismissed')}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-semibold text-[#D9534F] hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>

                    {activeRec.entityType === 'customer' && (
                      <button
                        type="button"
                        onClick={() => openCustomer360(activeRec.entityId)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Customer 360 Profile</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">
                  Select a recommendation to review business rationale and actions.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: ADMIN-ONLY BUSINESS RULES INTERFACE WITH VERSIONING & AUDIT HISTORY */}
      {tab === 'rules' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
              <div>
                <span className="font-semibold text-slate-900">
                  Governed Business Rules ({activeIndustry.name} Profile):
                </span>{' '}
                {isAdmin
                  ? `You are signed in as ${persona.title} and can create, edit, validate, and version NBA rules.`
                  : `Read-only mode for ${persona.title}. Switch to Tenant Administrator or Platform Super Admin to modify rules.`}
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openNewRuleForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Business Rule</span>
              </button>
            )}
          </div>

          {ruleFormOpen && isAdmin && (
            <form
              onSubmit={handleSaveRule}
              className="space-y-4 rounded-xl border border-[#1769AA] bg-white p-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {editingRuleId ? 'Edit Business Rule (Increments Version)' : 'Create New Business Rule'}
                </h3>
                <button
                  type="button"
                  onClick={() => setRuleFormOpen(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              {ruleError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {ruleError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Rule Name</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. High-Risk 90-Day Service Recovery"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Strategy</label>
                  <select
                    value={ruleStrategy}
                    onChange={(e) => setRuleStrategy(e.target.value as NbaStrategy)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    <option value="RETAIN">RETAIN</option>
                    <option value="DEFEND">DEFEND</option>
                    <option value="DEVELOP">DEVELOP</option>
                    <option value="ACQUIRE">ACQUIRE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Min Churn Score (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ruleChurn}
                    onChange={(e) => setRuleChurn(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Min Propensity Score (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ruleProp}
                    onChange={(e) => setRuleProp(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Min Geo Opportunity (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ruleOpp}
                    onChange={(e) => setRuleOpp(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Target Segment</label>
                  <select
                    value={ruleSegment}
                    onChange={(e) => setRuleSegment(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    <option value="ALL">ALL Segments</option>
                    <option value="At-Risk Retention">At-Risk Retention</option>
                    <option value="High-Value Loyal">High-Value Loyal</option>
                    <option value="Growth Potential">Growth Potential</option>
                    <option value="Core Active">Core Active</option>
                    <option value="New Onboarding">New Onboarding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Suggested Channel</label>
                  <select
                    value={ruleChannel}
                    onChange={(e) => setRuleChannel(e.target.value as CampaignChannel)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Priority</label>
                  <select
                    value={rulePriority}
                    onChange={(e) => setRulePriority(e.target.value as RecommendationPriority)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Recommended Action Template
                </label>
                <input
                  type="text"
                  value={ruleActionTemplate}
                  onChange={(e) => setRuleActionTemplate(e.target.value)}
                  placeholder="Describe the concrete action recommended to teams..."
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Description</label>
                  <input
                    type="text"
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Version Change Note (Audit Log)
                  </label>
                  <input
                    type="text"
                    value={ruleChangeNote}
                    onChange={(e) => setRuleChangeNote(e.target.value)}
                    placeholder="Reason for rule update..."
                    className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-3 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRuleFormOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                >
                  Validate &amp; Save Rule
                </button>
              </div>
            </form>
          )}

          {/* Rules List + Version Audit History */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {businessRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={strategyTone(rule.strategy)}>{rule.strategy}</span>
                      <span>·</span>
                      <span className="font-mono text-slate-500">v{rule.version}</span>
                      <span>·</span>
                      <span className={rule.active ? 'font-semibold text-[#15946A]' : 'text-slate-400'}>
                        {rule.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">{rule.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-600">{rule.description}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRuleForm(rule)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleBusinessRuleActive(rule.id)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1769AA] hover:bg-slate-50"
                      >
                        {rule.active ? 'Pause' : 'Activate'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 rounded-lg bg-[#F5F8FC] px-3 py-2 font-mono text-[11px] text-slate-700">
                  {rule.minChurnScore !== null && <span>Churn &gt;= {rule.minChurnScore}</span>}
                  {rule.minPropensityScore !== null && <span>Propensity &gt;= {rule.minPropensityScore}%</span>}
                  {rule.minOpportunityScore !== null && <span>Geo Opp &gt;= {rule.minOpportunityScore}</span>}
                  <span>Segment: {rule.targetSegment}</span>
                  <span>Channel: {rule.suggestedChannel}</span>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <History className="h-3.5 w-3.5" />
                    <span>Rule Version Audit History</span>
                  </div>
                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-500">
                    {rule.auditHistory.slice(0, 3).map((h) => (
                      <div key={`${rule.id}-v${h.version}-${h.timestamp}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          v{h.version}: {h.changeNote} ({h.actorName})
                        </span>
                        <span className="shrink-0 font-mono">{h.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              Changing active business rules immediately recalculates the deterministic Recommendation
              Inbox above and logs a tenant-scoped audit record.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

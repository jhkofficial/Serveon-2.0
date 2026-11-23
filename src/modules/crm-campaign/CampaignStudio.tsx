import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  FileText,
  Save,
  Send,
  ShieldCheck,
  Users,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { computeCampaignAudience } from '../../core/ai-engine/mvp3Engine';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import type { CampaignChannel, RiskCategory } from '../../types/platform';
import type { NbaStrategy } from '../../types/mvp3';

const WIZARD_STEPS = [
  { step: 1, title: 'Objective' },
  { step: 2, title: 'BU & Region' },
  { step: 3, title: 'Audience' },
  { step: 4, title: 'Preview' },
  { step: 5, title: 'Channels' },
  { step: 6, title: 'Content & Budget' },
  { step: 7, title: 'Review & Submit' },
];

const CHANNELS: CampaignChannel[] = [
  'WhatsApp',
  'Email',
  'SMS',
  'Call Center',
  'Branch Follow-up',
];

const SEGMENTS = [
  'ALL',
  'At-Risk Retention',
  'High-Value Loyal',
  'Growth Potential',
  'Core Active',
  'New Onboarding',
];

const STRATEGIES: Array<{ id: NbaStrategy; label: string; desc: string }> = [
  { id: 'RETAIN', label: 'RETAIN — Churn Prevention', desc: 'Win back overdue or high-risk customers before defection.' },
  { id: 'DEFEND', label: 'DEFEND — Loyalty Protection', desc: 'Protect top-value accounts from competitive attrition.' },
  { id: 'DEVELOP', label: 'DEVELOP — Cross-Sell & Upgrade', desc: 'Convert high-propensity customers to next-tier products.' },
  { id: 'ACQUIRE', label: 'ACQUIRE — Territory Expansion', desc: 'Capture demand in high-opportunity Indonesian regencies.' },
];

export function CampaignStudio() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    campaigns,
    scopedCustomers,
    permittedRegionIds,
    wizardDraft,
    updateWizardDraft,
    resetWizardDraft,
    saveCampaignFromWizard,
    loadCampaignIntoWizard,
    openCampaignInRoute,
  } = usePlatform();

  const [viewMode, setViewMode] = useState<'wizard' | 'portfolio'>('wizard');
  const [stepError, setStepError] = useState<string | null>(null);

  const canCreate = hasPermission(persona, 'campaigns.create');
  const permittedRegions = activeTenant.province.regencies.filter((r) =>
    permittedRegionIds.includes(r.id)
  );

  // Live deterministic audience preview with deduplication, consent, opt-out, suppression, control holdout
  const liveAudience = useMemo(
    () =>
      computeCampaignAudience(scopedCustomers, {
        tenantId: activeTenant.id,
        businessUnitId: wizardDraft.businessUnitId,
        regionId: wizardDraft.regionId,
        targetSegment: wizardDraft.targetSegment,
        minRiskCategory: wizardDraft.minRiskCategory,
        minPropensityScore: wizardDraft.minPropensityScore,
        respectConsent: wizardDraft.respectConsent,
        respectSuppression: wizardDraft.respectSuppression,
        includeControlGroup: wizardDraft.includeControlGroup,
      }),
    [scopedCustomers, activeTenant.id, wizardDraft]
  );

  const previewCustomers = useMemo(() => {
    const idSet = new Set(liveAudience.eligibleCustomerIds.slice(0, 10));
    return scopedCustomers.filter((c) => idSet.has(c.customer_id));
  }, [liveAudience.eligibleCustomerIds, scopedCustomers]);

  const editingExisting = wizardDraft.editingCampaignId
    ? campaigns.find((c) => c.id === wizardDraft.editingCampaignId)
    : undefined;

  function toggleChannel(ch: CampaignChannel) {
    const exists = wizardDraft.channels.includes(ch);
    const next = exists
      ? wizardDraft.channels.filter((c) => c !== ch)
      : [...wizardDraft.channels, ch];
    updateWizardDraft({ channels: next.length > 0 ? next : [ch] });
  }

  function validateStep(step: number): string | null {
    if (step === 1) {
      if (!wizardDraft.name.trim()) return 'Please provide a campaign name.';
      if (!wizardDraft.objective.trim()) return 'Please specify the campaign business objective.';
    }
    if (step === 4 && liveAudience.eligibleReachableCount === 0) {
      return 'Eligible reachable audience is 0. Broaden your region, segment, or propensity criteria.';
    }
    if (step === 5 && wizardDraft.channels.length === 0) {
      return 'Select at least one simulated communication channel.';
    }
    if (step === 6) {
      if (!wizardDraft.messageSubject.trim()) return 'Please enter a message headline/subject.';
      if (!wizardDraft.messageBody.trim()) return 'Please compose the campaign message copy.';
      if (!Number.isFinite(wizardDraft.budgetAllocated) || wizardDraft.budgetAllocated < 0) {
        return 'Please enter a valid non-negative IDR budget.';
      }
    }
    return null;
  }

  function handleNext() {
    const err = validateStep(wizardDraft.step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    updateWizardDraft({ step: Math.min(7, wizardDraft.step + 1) });
  }

  function handleBack() {
    setStepError(null);
    updateWizardDraft({ step: Math.max(1, wizardDraft.step - 1) });
  }

  function handleSave(submitForApproval: boolean) {
    for (const s of [1, 4, 5, 6]) {
      const err = validateStep(s);
      if (err) {
        setStepError(err);
        updateWizardDraft({ step: s });
        return;
      }
    }
    const res = saveCampaignFromWizard(wizardDraft, submitForApproval);
    if (!res.ok) {
      setStepError(res.message);
      return;
    }
    setStepError(null);
    if (submitForApproval && res.campaign) {
      openCampaignInRoute(res.campaign.id, 'approval_inbox');
    } else {
      setViewMode('portfolio');
    }
  }

  const regionLabel =
    wizardDraft.regionId === 'ALL'
      ? `All ${activeTenant.primaryProvinceName}`
      : activeTenant.province.regencies.find((r) => r.id === wizardDraft.regionId)?.name ??
        wizardDraft.regionId;

  const buLabel =
    wizardDraft.businessUnitId === 'ALL'
      ? 'All Permitted Business Units'
      : activeTenant.businessUnits.find((b) => b.id === wizardDraft.businessUnitId)?.name ??
        wizardDraft.businessUnitId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaign Studio"
        subtitle={`7-step governed campaign builder with audience deduplication, consent & opt-out verification, persistent drafts, and approval routing.`}
        metaItems={[
          'BM05 · Campaign Studio',
          'Simulated Channels Only',
          `${campaigns.length} Tenant Campaigns`,
          'Drafts Persist Across Navigation',
        ]}
        actions={
          <div
            role="tablist"
            aria-label="Campaign Studio views"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'wizard'}
              onClick={() => setViewMode('wizard')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'wizard' ? 'bg-[#102B4D] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7-Step Campaign Builder
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'portfolio'}
              onClick={() => setViewMode('portfolio')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'portfolio'
                  ? 'bg-[#102B4D] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Campaign Portfolio ({campaigns.length})
            </button>
          </div>
        }
      />

      {/* Simulated Safeguard Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15946A]" />
        <div>
          <span className="font-semibold text-slate-900">Governed Activation Policy:</span>{' '}
          Campaign drafts persist automatically across navigation. Modifying an already-approved
          campaign increments its version and automatically requires reapproval before simulated
          execution. No real WhatsApp, SMS, or email communications are ever transmitted.
        </div>
      </div>

      {viewMode === 'wizard' && (
        <div className="space-y-5">
          {!canCreate && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Your current persona (<strong>{persona.title}</strong>) has read-only access to the
              Campaign Studio. Switch to Campaign Manager, Business Manager, Tenant Admin, or Super
              Admin to create or submit campaigns.
            </div>
          )}

          {editingExisting &&
            (editingExisting.status === 'Approved' || editingExisting.status === 'Scheduled') && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <strong>Reapproval Notice:</strong> You are editing an{' '}
                  <strong>{editingExisting.status}</strong> campaign (v{editingExisting.version}).
                  Saving any modification will create <strong>v{editingExisting.version + 1}</strong>{' '}
                  and return it to <strong>Pending Approval</strong> until reapproved.
                </div>
              </div>
            )}

          {/* 7-Step Progress Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {WIZARD_STEPS.map((s) => {
                const isCurrent = wizardDraft.step === s.step;
                const isDone = wizardDraft.step > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      setStepError(null);
                      updateWizardDraft({ step: s.step });
                    }}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                      isCurrent
                        ? 'border-[#1769AA] bg-[#F0F7FC] font-semibold text-[#102B4D]'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50/50 text-[#15946A]'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono text-[10px]">STEP 0{s.step}</div>
                    <div className="mt-0.5 truncate">{s.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            {stepError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
              >
                {stepError}
              </div>
            )}

            {/* STEP 1: CAMPAIGN OBJECTIVE */}
            {wizardDraft.step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Step 1: Select Campaign Objective &amp; Strategy
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Define the campaign name, strategic intent, and business objective.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetWizardDraft}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear Draft</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {STRATEGIES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => updateWizardDraft({ strategy: st.id })}
                      className={`rounded-lg border p-3.5 text-left transition-colors ${
                        wizardDraft.strategy === st.id
                          ? 'border-[#1769AA] bg-[#F0F7FC]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#102B4D]">{st.label}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{st.desc}</p>
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="wiz-name" className="block text-xs font-semibold text-slate-700">
                    Campaign Name
                  </label>
                  <input
                    id="wiz-name"
                    type="text"
                    value={wizardDraft.name}
                    onChange={(e) => updateWizardDraft({ name: e.target.value })}
                    placeholder={`e.g. ${activeTenant.primaryProvinceName} Q4 ${activeIndustry.terminology.retentionMetricLabel} Program`}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="wiz-obj" className="block text-xs font-semibold text-slate-700">
                    Business Objective &amp; Target Outcome
                  </label>
                  <textarea
                    id="wiz-obj"
                    rows={3}
                    value={wizardDraft.objective}
                    onChange={(e) => updateWizardDraft({ objective: e.target.value })}
                    placeholder="Describe the target metric, offer structure, and expected commercial impact..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#1769AA] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS UNIT & REGION */}
            {wizardDraft.step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 2: Select Permitted Business Unit &amp; Region
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Options are strictly restricted to your role&apos;s tenant and geographic scope ({persona.scopeLevel} scope).
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="wiz-bu" className="block text-xs font-semibold text-slate-700">
                      Permitted Business Unit
                    </label>
                    <select
                      id="wiz-bu"
                      value={wizardDraft.businessUnitId}
                      onChange={(e) => updateWizardDraft({ businessUnitId: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
                    >
                      <option value="ALL">All Tenant Business Units</option>
                      {activeTenant.businessUnits.map((bu) => (
                        <option key={bu.id} value={bu.id}>
                          {bu.name} ({bu.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="wiz-region" className="block text-xs font-semibold text-slate-700">
                      Permitted Region ({activeTenant.primaryProvinceName})
                    </label>
                    <select
                      id="wiz-region"
                      value={wizardDraft.regionId}
                      onChange={(e) => updateWizardDraft({ regionId: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
                    >
                      {permittedRegions.length > 1 && (
                        <option value="ALL">All {activeTenant.primaryProvinceName}</option>
                      )}
                      {permittedRegions.map((reg) => (
                        <option key={reg.id} value={reg.id}>
                          {reg.name} (Opp. Index {reg.marketPotentialIndex})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-4 text-xs text-slate-700">
                  Live Scope Check: <strong>{formatNumber(liveAudience.deduplicatedCount)}</strong>{' '}
                  unique {activeIndustry.terminology.customerPlural.toLowerCase()} in{' '}
                  <strong>{regionLabel}</strong> ({buLabel}) match your current geographic &amp;
                  segment criteria.
                </div>
              </div>
            )}

            {/* STEP 3: TARGET AUDIENCE & COMPLIANCE RULES */}
            {wizardDraft.step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 3: Select Target Audience &amp; Compliance Rules
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Filter by customer segment, simulated risk/propensity thresholds, consent checks, and control holdout.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="wiz-seg" className="block text-xs font-semibold text-slate-700">
                      Customer Segment
                    </label>
                    <select
                      id="wiz-seg"
                      value={wizardDraft.targetSegment}
                      onChange={(e) => updateWizardDraft({ targetSegment: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
                    >
                      {SEGMENTS.map((s) => (
                        <option key={s} value={s}>
                          {s === 'ALL' ? `All ${activeIndustry.terminology.customerPlural}` : s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="wiz-risk" className="block text-xs font-semibold text-slate-700">
                      Minimum Churn Risk Level
                    </label>
                    <select
                      id="wiz-risk"
                      value={wizardDraft.minRiskCategory}
                      onChange={(e) =>
                        updateWizardDraft({ minRiskCategory: e.target.value as 'ALL' | RiskCategory })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900"
                    >
                      <option value="ALL">Any Risk Level</option>
                      <option value="Medium">Medium or High Risk</option>
                      <option value="High">High Risk Only</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="wiz-prop" className="block text-xs font-semibold text-slate-700">
                      Minimum Propensity Score ({wizardDraft.minPropensityScore}%)
                    </label>
                    <input
                      id="wiz-prop"
                      type="range"
                      min={0}
                      max={85}
                      step={5}
                      value={wizardDraft.minPropensityScore}
                      onChange={(e) =>
                        updateWizardDraft({ minPropensityScore: Number(e.target.value) })
                      }
                      className="mt-3 w-full accent-[#1769AA]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs">
                    <input
                      type="checkbox"
                      checked={wizardDraft.respectConsent}
                      onChange={(e) => updateWizardDraft({ respectConsent: e.target.checked })}
                      className="mt-0.5 rounded accent-[#1769AA]"
                    />
                    <span>
                      <strong className="block text-slate-900">Enforce Verified Consent</strong>
                      <span className="text-slate-500">Exclude unconsented accounts automatically.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs">
                    <input
                      type="checkbox"
                      checked={wizardDraft.respectSuppression}
                      onChange={(e) => updateWizardDraft({ respectSuppression: e.target.checked })}
                      className="mt-0.5 rounded accent-[#1769AA]"
                    />
                    <span>
                      <strong className="block text-slate-900">Apply Frequency Suppression</strong>
                      <span className="text-slate-500">Exclude accounts within 7-day contact cap.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs">
                    <input
                      type="checkbox"
                      checked={wizardDraft.includeControlGroup}
                      onChange={(e) => updateWizardDraft({ includeControlGroup: e.target.checked })}
                      className="mt-0.5 rounded accent-[#1769AA]"
                    />
                    <span>
                      <strong className="block text-slate-900">10% Holdout Control Group</strong>
                      <span className="text-slate-500">Reserve deterministic control cohort for benchmarking.</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 4: PREVIEW ELIGIBLE AUDIENCE */}
            {wizardDraft.step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 4: Preview Eligible Reachable Audience
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Deduplicated against active tenant records with opt-out, consent, suppression, and control-group accounting.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div className="text-[11px] text-slate-500">Deduplicated</div>
                    <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {formatNumber(liveAudience.deduplicatedCount)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div className="text-[11px] text-slate-500">Consent Verified</div>
                    <div className="mt-1 font-mono text-lg font-bold text-[#15946A] tabular-nums">
                      {formatNumber(liveAudience.consentVerifiedCount)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div className="text-[11px] text-slate-500">Opt-Out Excluded</div>
                    <div className="mt-1 font-mono text-lg font-bold text-[#D9534F] tabular-nums">
                      -{formatNumber(liveAudience.optedOutExcluded)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div className="text-[11px] text-slate-500">Suppressed / Unconsented</div>
                    <div className="mt-1 font-mono text-lg font-bold text-[#B47815] tabular-nums">
                      -{formatNumber(liveAudience.suppressedExcluded)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div className="text-[11px] text-slate-500">Control Holdout</div>
                    <div className="mt-1 font-mono text-lg font-bold text-slate-700 tabular-nums">
                      {formatNumber(liveAudience.controlGroupCount)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#1769AA] bg-[#F0F7FC] p-3">
                    <div className="text-[11px] font-semibold text-[#1769AA]">Reachable Target</div>
                    <div className="mt-1 font-mono text-lg font-bold text-[#102B4D] tabular-nums">
                      {formatNumber(liveAudience.eligibleReachableCount)}
                    </div>
                  </div>
                </div>

                {/* Sample Eligible Customers */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                      <Users className="h-3.5 w-3.5 text-[#1769AA]" />
                      Sample Eligible Accounts (First 10 of {formatNumber(liveAudience.eligibleReachableCount)})
                    </span>
                    <span className="text-slate-500">Opt-outs always excluded</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pl-4 pr-3 font-semibold">Code</th>
                          <th className="px-3 py-2 font-semibold">Customer</th>
                          <th className="px-3 py-2 font-semibold">Territory</th>
                          <th className="px-3 py-2 font-semibold">Segment</th>
                          <th className="px-3 py-2 text-right font-semibold">Churn / Propensity</th>
                          <th className="py-2 pl-3 pr-4 text-right font-semibold">Consent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewCustomers.map((c) => (
                          <tr key={c.customer_id}>
                            <td className="py-2 pl-4 pr-3 font-mono text-slate-500">{c.code}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{c.full_name}</td>
                            <td className="px-3 py-2 text-slate-600">{c.demographic_attributes.city}</td>
                            <td className="px-3 py-2 text-slate-600">{c.customer_segment}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">
                              {c.model_outputs.churn_risk_score} / {c.model_outputs.purchase_propensity_score}%
                            </td>
                            <td className="py-2 pl-3 pr-4 text-right font-semibold text-[#15946A]">
                              Verified
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: COMMUNICATION CHANNELS */}
            {wizardDraft.step === 5 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 5: Select Communication Channels (Simulated)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Choose one or more channels. All channels run in safe simulated execution mode only.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {CHANNELS.map((ch) => {
                    const checked = wizardDraft.channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannel(ch)}
                        className={`flex items-start justify-between rounded-xl border p-4 text-left transition-colors ${
                          checked
                            ? 'border-[#1769AA] bg-[#F0F7FC]'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold text-slate-900">{ch}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {ch === 'WhatsApp'
                              ? 'High open rate · Simulated interactive template'
                              : ch === 'Branch Follow-up'
                                ? 'Highest simulated conversion · Local advisor queue'
                                : ch === 'Call Center'
                                  ? 'Outbound retention & advisory script'
                                  : ch === 'Email'
                                    ? 'Rich dossier & promotional offer layout'
                                    : 'Concise time-sensitive SMS alert'}
                          </div>
                        </div>
                        <CheckCircle2
                          className={`h-5 w-5 shrink-0 ${
                            checked ? 'text-[#1769AA]' : 'text-slate-200'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 6: CONTENT, SCHEDULE & BUDGET */}
            {wizardDraft.step === 6 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 6: Compose Content, Schedule &amp; Budget
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Draft message template, target schedule date, and budget allocation in IDR.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="wiz-date" className="block text-xs font-semibold text-slate-700">
                      Target Schedule Date
                    </label>
                    <input
                      id="wiz-date"
                      type="date"
                      value={wizardDraft.scheduledDate}
                      onChange={(e) => updateWizardDraft({ scheduledDate: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="wiz-budget" className="block text-xs font-semibold text-slate-700">
                      Campaign Budget (IDR)
                    </label>
                    <input
                      id="wiz-budget"
                      type="number"
                      min={0}
                      step={500000}
                      value={wizardDraft.budgetAllocated}
                      onChange={(e) =>
                        updateWizardDraft({ budgetAllocated: Number(e.target.value) })
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="wiz-subject" className="block text-xs font-semibold text-slate-700">
                    Message Subject / Headline
                  </label>
                  <input
                    id="wiz-subject"
                    type="text"
                    value={wizardDraft.messageSubject}
                    onChange={(e) => updateWizardDraft({ messageSubject: e.target.value })}
                    placeholder="e.g. Priority Service Voucher for Your Next Visit"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="wiz-body" className="block text-xs font-semibold text-slate-700">
                    Message Copy (Simulated Only — Never Sent Externally)
                  </label>
                  <textarea
                    id="wiz-body"
                    rows={4}
                    value={wizardDraft.messageBody}
                    onChange={(e) => updateWizardDraft({ messageBody: e.target.value })}
                    placeholder="Compose outreach offer, call-to-action, and opt-out disclosure..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* STEP 7: REVIEW & SUBMIT */}
            {wizardDraft.step === 7 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Step 7: Review &amp; Submit for Approval
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Verify targeting, compliance counts, channels, and budget before routing to the Approval Inbox.
                  </p>
                </div>

                <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-[#F5F8FC] p-5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Campaign Name</dt>
                    <dd className="mt-1 font-bold text-slate-900">{wizardDraft.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Strategy &amp; Segment</dt>
                    <dd className="mt-1 font-semibold text-[#1769AA]">
                      {wizardDraft.strategy} · {wizardDraft.targetSegment}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">BU &amp; Territory</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {buLabel} · {regionLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Eligible Reachable Audience</dt>
                    <dd className="mt-1 font-mono text-sm font-bold text-[#15946A] tabular-nums">
                      {formatNumber(liveAudience.eligibleReachableCount)} reachable (
                      {liveAudience.controlGroupCount} control holdout)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Channels (Simulated)</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {wizardDraft.channels.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Budget &amp; Schedule</dt>
                    <dd className="mt-1 font-mono font-bold text-slate-900 tabular-nums">
                      {formatIdrCompact(wizardDraft.budgetAllocated)} · {wizardDraft.scheduledDate}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-slate-200 p-4 text-xs">
                  <div className="font-semibold text-slate-800">Message Preview (Simulated)</div>
                  <div className="mt-1 font-semibold text-[#102B4D]">{wizardDraft.messageSubject}</div>
                  <p className="mt-1 text-slate-600">{wizardDraft.messageBody}</p>
                </div>
              </div>
            )}

            {/* Wizard Footer Navigation */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={wizardDraft.step <= 1}
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Draft</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {wizardDraft.step < 7 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
                  >
                    <span>Next Step</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  canCreate && (
                    <button
                      type="button"
                      onClick={() => handleSave(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#15946A] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit for Approval</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PORTFOLIO VIEW (WITH EDIT -> REAPPROVAL TRIGGER) */}
      {viewMode === 'portfolio' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Tenant Campaign Portfolio ({campaigns.length})
            </h2>
            <p className="text-xs text-slate-500">
              Edit drafts or approved campaigns (editing an approved campaign automatically increments version &amp; requires reapproval).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 font-semibold">Campaign</th>
                  <th className="px-3 py-2.5 font-semibold">Status &amp; Version</th>
                  <th className="px-3 py-2.5 font-semibold">Territory &amp; Segment</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Reachable</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Budget</th>
                  <th className="py-2.5 pl-3 pr-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((cmp) => (
                  <tr key={cmp.id} className="hover:bg-slate-50">
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-slate-900">{cmp.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {cmp.id} · {cmp.channels.join(', ')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-[#1769AA]">{cmp.status}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        v{cmp.version}
                        {cmp.requiresReapproval ? ' · Reapproval req.' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div>{cmp.regionName}</div>
                      <div className="text-[11px] text-slate-500">{cmp.targetSegment}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatNumber(cmp.audience.eligibleReachableCount)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-700 tabular-nums">
                      {formatIdrCompact(cmp.budgetAllocated)}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canCreate && cmp.status !== 'Completed' && cmp.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              loadCampaignIntoWizard(cmp.id);
                              setViewMode('wizard');
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#1769AA] hover:text-[#1769AA]"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {cmp.status === 'Pending Approval' && (
                          <button
                            type="button"
                            onClick={() => openCampaignInRoute(cmp.id, 'approval_inbox')}
                            className="inline-flex items-center gap-1 rounded-md bg-[#1769AA] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#102B4D]"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Approvals</span>
                          </button>
                        )}
                        {['Approved', 'Scheduled', 'Simulated Running', 'Completed'].includes(
                          cmp.status
                        ) && (
                          <button
                            type="button"
                            onClick={() => openCampaignInRoute(cmp.id, 'campaign_ops')}
                            className="inline-flex items-center gap-1 rounded-md border border-[#16A6BD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#16A6BD] hover:bg-[#16A6BD] hover:text-white"
                          >
                            <span>Operations</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

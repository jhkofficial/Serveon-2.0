import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Compass,
  Activity,
  Search,
  Download,
  Eye,
  Info,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatNumber } from '../../core/analytics/kpiEngine';
import { triggerCsvDownload } from '../../core/ai-engine/mvp3Engine';
import type { PredictionResult, PredictionType } from '../../types/mvp3';

const PREDICTION_TABS: Array<{
  id: PredictionType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'churn_risk', label: 'Customer Churn Risk', shortLabel: 'Churn Risk', icon: AlertTriangle },
  { id: 'purchase_propensity', label: 'Purchase Propensity', shortLabel: 'Propensity', icon: TrendingUp },
  { id: 'geographic_opportunity', label: 'Geographic Opportunity', shortLabel: 'Geo Opportunity', icon: Compass },
  { id: 'engagement_index', label: 'Engagement Indicators', shortLabel: 'Engagement', icon: Activity },
];

type SortKey = 'score_desc' | 'score_asc' | 'name_asc';

function getCategoryTone(pred: PredictionResult): string {
  if (pred.predictionType === 'churn_risk') {
    if (pred.category === 'High') return 'text-[#D9534F] font-semibold';
    if (pred.category === 'Medium') return 'text-[#B47815] font-semibold';
    return 'text-[#15946A] font-semibold';
  }
  if (pred.category === 'High' || pred.category === 'Strong Opportunity') {
    return 'text-[#15946A] font-semibold';
  }
  if (pred.category === 'Medium' || pred.category === 'Moderate Opportunity') {
    return 'text-[#1769AA] font-semibold';
  }
  return 'text-slate-600 font-medium';
}

export function PredictiveIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    predictions,
    filters,
    permittedRegionIds,
    selectedPredictionId,
    openPredictionExplanation,
    openCustomer360,
    openNbaForCustomer,
    logAuditEvent,
    showToast,
  } = usePlatform();

  const initialTab = useMemo<PredictionType>(() => {
    const pre = predictions.find((p) => p.id === selectedPredictionId);
    return pre?.predictionType ?? 'churn_risk';
  }, [predictions, selectedPredictionId]);

  const [activeType, setActiveType] = useState<PredictionType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>(filters.regionId);
  const [segmentFilter, setSegmentFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('score_desc');
  const [detailPredId, setDetailPredId] = useState<string | null>(selectedPredictionId);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const permittedRegions = activeTenant.province.regencies.filter((r) =>
    permittedRegionIds.includes(r.id)
  );

  // Sync topbar region filter when changed
  React.useEffect(() => {
    setRegionFilter(filters.regionId);
    setPage(1);
  }, [filters.regionId]);

  const countsByType = useMemo(() => {
    const counts: Record<PredictionType, { total: number; priority: number }> = {
      churn_risk: { total: 0, priority: 0 },
      purchase_propensity: { total: 0, priority: 0 },
      geographic_opportunity: { total: 0, priority: 0 },
      engagement_index: { total: 0, priority: 0 },
    };
    for (const p of predictions) {
      counts[p.predictionType].total++;
      if (p.category === 'High' || p.category === 'Strong Opportunity') {
        counts[p.predictionType].priority++;
      }
    }
    return counts;
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = predictions.filter((p) => {
      if (p.predictionType !== activeType) return false;
      if (regionFilter !== 'ALL' && p.regionId !== regionFilter) return false;
      if (segmentFilter !== 'ALL' && p.segment !== segmentFilter) return false;
      if (riskFilter !== 'ALL' && p.category !== riskFilter) return false;
      if (q) {
        const hay = `${p.entityName} ${p.entityCode} ${p.regionName} ${p.segment} ${p.contributingFactors[0]?.featureLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'score_asc') return a.score - b.score;
      if (sortBy === 'name_asc') return a.entityName.localeCompare(b.entityName);
      return b.score - a.score;
    });
  }, [predictions, activeType, regionFilter, segmentFilter, riskFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPredictions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredPredictions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedDetail = useMemo(
    () =>
      filteredPredictions.find((p) => p.id === detailPredId) ??
      predictions.find((p) => p.id === detailPredId) ??
      pageItems[0] ??
      null,
    [filteredPredictions, predictions, detailPredId, pageItems]
  );

  function handleExportCsv() {
    const headers = [
      'Prediction ID',
      'Tenant ID',
      'Entity Code',
      'Entity Name',
      'Territory',
      'Segment',
      'Prediction Type',
      'AI Score (Simulated)',
      'Category',
      'Top Factor',
      'Evaluation Date',
      'Model Version',
      'Model Status',
    ];
    const rows = filteredPredictions.map((p) => [
      p.id,
      p.tenant_id,
      p.entityCode,
      p.entityName,
      p.regionName,
      p.segment,
      p.predictionType,
      p.score,
      p.category,
      p.contributingFactors[0]?.featureLabel ?? '',
      p.evaluationDate,
      p.modelVersion,
      p.modelStatus,
    ]);
    triggerCsvDownload(
      headers,
      rows,
      `serveon-predictions-${activeTenant.code.toLowerCase()}-${activeType}.csv`
    );
    logAuditEvent(
      'Prediction',
      `Exported ${filteredPredictions.length} Simulated AI Predictions (CSV)`,
      `Type: ${activeType} · Tenant: ${activeTenant.shortName}`
    );
    showToast(`Exported ${filteredPredictions.length} simulated predictions to CSV`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Prediction Center"
        subtitle={`Industry-configured ${activeIndustry.name} predictions for churn risk, purchase propensity, geographic opportunity, and engagement indicators.`}
        metaItems={[
          'BM04',
          'Simulated AI Prediction',
          `${formatNumber(predictions.length)} Total Scored Records`,
          activeTenant.shortName,
        ]}
        actions={
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV ({formatNumber(filteredPredictions.length)})</span>
          </button>
        }
      />

      {/* Explicit Simulated AI Prediction Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
        <div>
          <span className="font-semibold text-slate-900">Simulated AI Prediction Notice:</span> All
          scores below are deterministic synthetic outputs computed for demonstration in{' '}
          <span className="font-semibold">{activeTenant.name}</span>. They do not represent
          validated production machine-learning predictions or live model inference.
        </div>
      </div>

      {/* 4 Prediction Family KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PREDICTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeType === tab.id;
          const stat = countsByType[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveType(tab.id);
                setRiskFilter('ALL');
                setPage(1);
              }}
              className={`rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-[#1769AA] bg-[#F0F7FC]'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{tab.label}</span>
                <Icon className={`h-4 w-4 ${isSelected ? 'text-[#1769AA]' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatNumber(stat.priority)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                High-priority of {formatNumber(stat.total)} · Simulated AI Prediction
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            aria-label="Search predictions"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search customer, code, territory, or factor..."
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 focus:border-[#1769AA] focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter predictions by region"
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
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

        <select
          aria-label="Filter predictions by segment"
          value={segmentFilter}
          onChange={(e) => {
            setSegmentFilter(e.target.value);
            setPage(1);
          }}
          disabled={activeType === 'geographic_opportunity'}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 disabled:bg-slate-100 md:col-span-2"
        >
          <option value="ALL">All Segments</option>
          <option value="High-Value Loyal">High-Value Loyal</option>
          <option value="Growth Potential">Growth Potential</option>
          <option value="Core Active">Core Active</option>
          <option value="At-Risk Retention">At-Risk Retention</option>
          <option value="New Onboarding">New Onboarding</option>
        </select>

        <select
          aria-label="Filter predictions by risk or opportunity category"
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
        >
          <option value="ALL">All Categories</option>
          {activeType === 'geographic_opportunity' ? (
            <>
              <option value="Strong Opportunity">Strong Opportunity</option>
              <option value="Moderate Opportunity">Moderate Opportunity</option>
              <option value="Emerging">Emerging</option>
            </>
          ) : (
            <>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </>
          )}
        </select>

        <div className="flex items-center gap-1.5 md:col-span-2">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <select
            aria-label="Sort predictions"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
          >
            <option value="score_desc">Highest Score</option>
            <option value="score_asc">Lowest Score</option>
            <option value="name_asc">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Main Split: Predictions Table + Quick Inspection Drawer Card */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {PREDICTION_TABS.find((t) => t.id === activeType)?.label} Queue
              </h2>
              <p className="text-xs text-slate-500">
                Showing {formatNumber(filteredPredictions.length)} records · Simulated AI Prediction
              </p>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              {selectedDetail?.modelVersion ?? 'serveon-sim-v2.1'}
            </span>
          </div>

          {filteredPredictions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No simulated prediction records match your current filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                      <th className="py-2.5 pl-5 pr-3 font-semibold">Identifier</th>
                      <th className="px-3 py-2.5 text-right font-semibold">AI Score</th>
                      <th className="px-3 py-2.5 font-semibold">Category</th>
                      <th className="px-3 py-2.5 font-semibold">Key Contributing Factor</th>
                      <th className="px-3 py-2.5 font-semibold">Model &amp; Eval Date</th>
                      <th className="py-2.5 pl-3 pr-5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageItems.map((pred) => {
                      const isRowActive = selectedDetail?.id === pred.id;
                      return (
                        <tr
                          key={pred.id}
                          onClick={() => setDetailPredId(pred.id)}
                          className={`cursor-pointer transition-colors ${
                            isRowActive ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 pl-5 pr-3">
                            <div className="font-semibold text-slate-900">{pred.entityName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {pred.entityCode} · {pred.regionName}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {pred.score}
                            <span className="text-[10px] font-normal text-slate-400">/100</span>
                          </td>
                          <td className={`px-3 py-3 ${getCategoryTone(pred)}`}>
                            <div>{pred.category}</div>
                            <div className="text-[10px] font-normal text-slate-400">
                              {pred.modelStatus}
                            </div>
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-3 text-slate-600">
                            {pred.contributingFactors[0]?.featureLabel}
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-slate-500 tabular-nums">
                            <div>{pred.modelVersion}</div>
                            <div>{pred.evaluationDate}</div>
                          </td>
                          <td className="py-3 pl-3 pr-5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPredictionExplanation(pred.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-[#1769AA]/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1769AA] hover:bg-[#1769AA] hover:text-white whitespace-nowrap"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View Explanation</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
                  <span>
                    Page {safePage} of {totalPages} ({formatNumber(filteredPredictions.length)} records)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Detail Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-4">
          {selectedDetail ? (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3.5">
                <div className="text-[11px] font-medium text-[#1769AA]">
                  {selectedDetail.modelStatus} · {selectedDetail.modelVersion}
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedDetail.entityName}
                </h3>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {selectedDetail.entityCode} · {selectedDetail.regionName} · {selectedDetail.segment}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                  <div className="text-[11px] text-slate-500">Simulated Score</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {selectedDetail.score}/100
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                  <div className="text-[11px] text-slate-500">Classification</div>
                  <div className={`mt-1.5 text-sm ${getCategoryTone(selectedDetail)}`}>
                    {selectedDetail.category}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                    Eval: {selectedDetail.evaluationDate}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Use Case: {selectedDetail.industryUseCaseLabel}
                </div>
                <div className="mt-2.5 space-y-2.5">
                  {selectedDetail.contributingFactors.map((f) => (
                    <div key={f.id} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-700">{f.featureLabel}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {f.impactPoints > 0 ? `+${f.impactPoints}` : f.impactPoints}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            f.direction === 'increases_risk'
                              ? 'bg-[#D9534F]'
                              : f.direction === 'reduces_risk'
                                ? 'bg-[#15946A]'
                                : 'bg-[#1769AA]'
                          }`}
                          style={{ width: `${Math.min(100, f.normalizedWeightPct * 1.6)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => openPredictionExplanation(selectedDetail.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1769AA] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Open Full Explainable AI Analysis</span>
                </button>
                {selectedDetail.entityType === 'customer' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openCustomer360(selectedDetail.entityId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Customer 360
                    </button>
                    <button
                      type="button"
                      onClick={() => openNbaForCustomer(selectedDetail.entityId)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#1769AA] hover:border-[#1769AA] hover:bg-slate-50"
                    >
                      Next-Best-Action
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              Select a prediction row to inspect details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

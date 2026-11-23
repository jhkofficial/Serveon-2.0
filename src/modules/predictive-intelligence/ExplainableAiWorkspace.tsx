import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Info,
  Layers,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';

export function ExplainableAiWorkspace() {
  const {
    activeTenant,
    activeIndustry,
    predictions,
    selectedPredictionId,
    openCustomer360,
    openNbaForCustomer,
    navigateToRoute,
  } = usePlatform();

  const [localPredId, setLocalPredId] = useState<string>(
    selectedPredictionId ?? predictions[0]?.id ?? ''
  );

  // Sync when launched from AI Prediction Center or Customer 360
  React.useEffect(() => {
    if (selectedPredictionId && predictions.some((p) => p.id === selectedPredictionId)) {
      setLocalPredId(selectedPredictionId);
    } else if (!predictions.some((p) => p.id === localPredId) && predictions[0]) {
      setLocalPredId(predictions[0].id);
    }
  }, [selectedPredictionId, predictions, localPredId]);

  const activePred = useMemo(
    () => predictions.find((p) => p.id === localPredId) ?? predictions[0] ?? null,
    [predictions, localPredId]
  );

  const quickOptions = useMemo(() => {
    const topChurn = predictions
      .filter((p) => p.predictionType === 'churn_risk')
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const topProp = predictions
      .filter((p) => p.predictionType === 'purchase_propensity')
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const topGeo = predictions.filter((p) => p.predictionType === 'geographic_opportunity').slice(0, 5);
    const combined = [...topChurn, ...topProp, ...topGeo];
    if (activePred && !combined.some((c) => c.id === activePred.id)) {
      combined.unshift(activePred);
    }
    return combined;
  }, [predictions, activePred]);

  const chartData = useMemo(() => {
    if (!activePred) return [];
    return activePred.contributingFactors.map((f) => ({
      label: f.featureLabel.length > 34 ? `${f.featureLabel.slice(0, 34)}…` : f.featureLabel,
      fullLabel: f.featureLabel,
      impactPoints: f.impactPoints,
      weightPct: f.normalizedWeightPct,
      direction: f.direction,
    }));
  }, [activePred]);

  if (!activePred) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        No prediction records available for the current tenant and role scope.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explainable AI Workspace"
        subtitle={`Transparent factor attribution, model metadata, missing-data indicators, and decision guardrails for ${activeTenant.shortName}.`}
        metaItems={[
          'BM04 · Explainability',
          activePred.shapAvailable ? 'Model-Generated SHAP' : 'Illustrative Demo Attribution (Not Live SHAP)',
          activePred.modelVersion,
          activeIndustry.name,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select prediction to explain"
              value={activePred.id}
              onChange={(e) => setLocalPredId(e.target.value)}
              className="h-9 max-w-[280px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
            >
              {quickOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.entityName} · {opt.predictionType.replace('_', ' ')} ({opt.score}/100)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                activePred.entityType === 'customer'
                  ? openNbaForCustomer(activePred.entityId)
                  : navigateToRoute('next_best_action')
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 text-xs font-semibold text-white hover:bg-[#102B4D] whitespace-nowrap"
            >
              <span>Go to Next-Best-Action</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {/* Explicit Demo Attribution Notice (Never Claim Arbitrary Weights Are Live SHAP) */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
        <div>
          <span className="font-semibold text-slate-900">
            Attribution Method Disclosure (Demo Mode):
          </span>{' '}
          The feature contributions below are{' '}
          <span className="font-semibold">illustrative relative contributions</span> calculated
          deterministically from synthetic demo attributes. They are{' '}
          <span className="font-semibold">not live SHAP values</span> from a trained production
          model. When a production model endpoint supplies real SHAP outputs, SERVEON automatically
          switches the attribution badge and renders exact Shapley values.
        </div>
      </div>

      {/* Prediction Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">
              {activePred.id} · {activePred.modelStatus} · {activePred.industryUseCaseLabel}
            </div>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{activePred.entityName}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="font-mono">{activePred.entityCode}</span>
              <span>·</span>
              <span>Territory: {activePred.regionName}</span>
              <span>·</span>
              <span>Segment: {activePred.segment}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Data snapshot: {activePred.dataTimestamp}
              </span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-6 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
            <div>
              <div className="text-xs text-slate-500">Simulated Score</div>
              <div className="mt-0.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {activePred.score}/100
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Classification</div>
              <div
                className={`mt-1 text-base font-bold ${
                  activePred.predictionType === 'churn_risk' && activePred.category === 'High'
                    ? 'text-[#D9534F]'
                    : 'text-[#1769AA]'
                }`}
              >
                {activePred.category}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Model Version</div>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-800">
                {activePred.modelVersion}
              </div>
              <div className="text-[11px] text-slate-500">Eval {activePred.evaluationDate}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Explainability Analysis */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Feature Contribution Chart + Ranked Factor Table */}
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">
              Illustrative Feature Contribution Visualization
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Signed relative contribution points · Positive values push score higher; negative values offset score · Demo Mode
            </p>
            <div className="mt-5 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 16, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={215}
                    tick={{ fontSize: 11, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ReferenceLine x={0} stroke="#94A3B8" />
                  <Tooltip
                    formatter={(val: unknown) => [`${Number(val) > 0 ? '+' : ''}${val} pts`, 'Illustrative Impact']}
                  />
                  <Bar dataKey="impactPoints" radius={[4, 4, 4, 4]} barSize={20} isAnimationActive={false}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={
                          entry.direction === 'increases_risk'
                            ? '#D9534F'
                            : entry.direction === 'reduces_risk'
                              ? '#15946A'
                              : entry.direction === 'increases_opportunity'
                                ? '#1769AA'
                                : '#64748B'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranked Contributing Factors Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">Ranked Contributing Factors</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Ordered by absolute magnitude · Method: {activePred.contributingFactors[0]?.attributionMethod}
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Rank</th>
                    <th className="px-3 py-2 font-semibold">Feature &amp; Observed Value</th>
                    <th className="px-3 py-2 font-semibold">Direction</th>
                    <th className="px-3 py-2 text-right font-semibold">Rel. Share</th>
                    <th className="py-2 pl-3 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePred.contributingFactors.map((f, idx) => (
                    <tr key={f.id}>
                      <td className="py-3 pr-3 font-mono font-semibold text-slate-500">
                        #0{idx + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{f.featureLabel}</div>
                        <div className="font-mono text-[11px] text-slate-500">{f.featureValue}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {f.direction.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-700 tabular-nums">
                        {f.normalizedWeightPct}%
                      </td>
                      <td
                        className={`py-3 pl-3 text-right font-mono font-bold tabular-nums ${
                          f.direction === 'increases_risk'
                            ? 'text-[#D9534F]'
                            : f.direction === 'reduces_risk'
                              ? 'text-[#15946A]'
                              : 'text-[#1769AA]'
                        }`}
                      >
                        {f.impactPoints > 0 ? `+${f.impactPoints}` : f.impactPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Model Metadata, Missing-Data Indicators & Limitations */}
        <div className="space-y-5 xl:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Layers className="h-4 w-4 text-[#1769AA]" />
              <span>Model &amp; Telemetry Metadata</span>
            </div>
            <dl className="mt-3.5 divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Model Name</dt>
                <dd className="font-semibold text-slate-900">{activePred.modelName}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Version</dt>
                <dd className="font-mono text-slate-900">{activePred.modelVersion}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Runtime Status</dt>
                <dd className="font-semibold text-[#1769AA]">{activePred.modelStatus}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Data Snapshot</dt>
                <dd className="font-mono text-slate-700">{activePred.dataTimestamp}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">SHAP Endpoint</dt>
                <dd className="font-mono text-slate-600">
                  {activePred.shapAvailable ? 'Connected' : 'Not Connected (Demo)'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <AlertCircle className="h-4 w-4 text-[#E3A33B]" />
              <span>Missing-Data Indicators</span>
            </div>
            {activePred.missingDataIndicators.length === 0 ? (
              <p className="mt-2.5 text-xs text-[#15946A]">
                All primary synthetic features present for this record (0 missing fields detected).
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                {activePred.missingDataIndicators.map((ind) => (
                  <li key={ind} className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
                    {ind}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-[#D9534F]" />
              <span>Model Limitations &amp; Guardrails</span>
            </div>
            <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-600">
              {activePred.modelLimitations.map((lim) => (
                <li key={lim}>{lim}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            {activePred.entityType === 'customer' && (
              <button
                type="button"
                onClick={() => openCustomer360(activePred.entityId)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA]"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Inspect {activePred.entityName} in Customer 360</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateToRoute('ai_predictions')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Back to AI Prediction Center
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

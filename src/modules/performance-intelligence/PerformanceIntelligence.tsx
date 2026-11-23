import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, Info, ArrowRight, HelpCircle, FlaskConical } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { triggerCsvDownload } from '../../core/ai-engine/mvp3Engine';

type BreakdownTab = 'region' | 'segment' | 'channel';

const METRIC_DEFINITIONS = [
  { metric: 'Reach', formula: 'Count of deduplicated Queued execution events across executed campaigns.' },
  { metric: 'Delivery Rate', formula: 'Delivered events ÷ Reach × 100%.' },
  { metric: 'Response Rate', formula: 'Responded events ÷ Delivered events × 100%.' },
  { metric: 'Conversion Rate', formula: 'Treatment Conversion events ÷ Delivered events × 100%.' },
  { metric: 'Attributed Revenue', formula: 'Sum of simulated attributed revenue on treatment ConversionEvent records.' },
  { metric: 'ROI (%)', formula: '(Attributed Revenue − Campaign Cost) ÷ Campaign Cost × 100% (shown only where Cost > 0 and Reach > 0).' },
];

export function PerformanceIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    eventPerformance,
    scopedCustomers,
    permittedBranchIds,
    navigateToRoute,
    logAuditEvent,
    showToast,
  } = usePlatform();

  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('region');
  const [showDefinitions, setShowDefinitions] = useState(false);

  const comparisonChartData = useMemo(() => {
    return eventPerformance.campaigns.map((c) => ({
      name: c.campaignName.length > 24 ? `${c.campaignName.slice(0, 24)}…` : c.campaignName,
      costM: Number((c.campaignCost / 1_000_000).toFixed(1)),
      revenueM: Number((c.attributedRevenue / 1_000_000).toFixed(1)),
    }));
  }, [eventPerformance.campaigns]);

  const activeBreakdownRows =
    breakdownTab === 'region'
      ? eventPerformance.byRegion
      : breakdownTab === 'segment'
        ? eventPerformance.bySegment
        : eventPerformance.byChannel;

  const controlRows = useMemo(
    () => eventPerformance.campaigns.filter((c) => c.hasControlGroup),
    [eventPerformance.campaigns]
  );

  // Preserve MVP 1 Branch Performance Leaderboard
  const branchScorecard = useMemo(() => {
    const allowed = new Set(permittedBranchIds);
    return activeTenant.branches
      .filter((b) => allowed.has(b.id))
      .map((br) => {
        const brCust = scopedCustomers.filter((c) => c.branch_id === br.id);
        const activeCount = brCust.filter((c) => c.status === 'Active').length;
        const totalLtv = brCust.reduce((acc, c) => acc + c.lifetime_value, 0);
        const avgProp =
          brCust.length > 0
            ? brCust.reduce((acc, c) => acc + c.model_outputs.purchase_propensity_score, 0) /
              brCust.length
            : 0;
        return {
          branch: br,
          customers: brCust.length,
          retentionPct:
            brCust.length > 0 ? Number(((activeCount / brCust.length) * 100).toFixed(1)) : 0,
          totalLtv,
          avgProp: Number(avgProp.toFixed(1)),
        };
      })
      .sort((a, b) => b.totalLtv - a.totalLtv);
  }, [activeTenant.branches, permittedBranchIds, scopedCustomers]);

  function handleExportCsv() {
    const headers = [
      'Campaign ID',
      'Campaign Name',
      'Status',
      'Channel',
      'Region',
      'Segment',
      'Reach',
      'Delivered',
      'Delivery Rate (%)',
      'Responded',
      'Response Rate (%)',
      'Converted',
      'Conversion Rate (%)',
      'Campaign Cost (IDR)',
      'Attributed Revenue (IDR)',
      'ROI (%)',
    ];
    const rows = eventPerformance.campaigns.map((c) => [
      c.campaignId,
      c.campaignName,
      c.status,
      c.channel,
      c.regionName,
      c.segment,
      c.reach,
      c.delivered,
      c.deliveryRatePct,
      c.responded,
      c.responseRatePct,
      c.converted,
      c.conversionRatePct,
      c.campaignCost,
      c.attributedRevenue,
      c.roiPct !== null ? c.roiPct : 'N/A',
    ]);
    triggerCsvDownload(
      headers,
      rows,
      `serveon-performance-roi-${activeTenant.code.toLowerCase()}.csv`
    );
    logAuditEvent(
      'Campaign',
      'Exported Campaign Performance & ROI Report (CSV)',
      `Tenant: ${activeTenant.shortName} · ${eventPerformance.campaigns.length} campaigns`
    );
    showToast('Exported event-driven campaign performance CSV');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & ROI Intelligence"
        subtitle={`Event-driven campaign attribution, channel/region/segment efficiency, control-group benchmarks, and ${activeIndustry.terminology.branchSingular.toLowerCase()} scorecards.`}
        metaItems={[
          'BM07',
          'Computed From Simulated Execution Events',
          `${formatNumber(eventPerformance.totalReach)} Total Reached`,
          activeTenant.shortName,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDefinitions((s) => !s)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <HelpCircle className="h-3.5 w-3.5 text-[#1769AA]" />
              <span>Metric Definitions</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToRoute('learning_governance')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
            >
              <span>Learning &amp; Governance</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {showDefinitions && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Campaign Performance Metric Definitions
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {METRIC_DEFINITIONS.map((d) => (
              <div key={d.metric} className="rounded-lg bg-[#F5F8FC] p-3">
                <dt className="font-semibold text-[#102B4D]">{d.metric}</dt>
                <dd className="mt-1 text-slate-600">{d.formula}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Event-Driven KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Event Reach</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatNumber(eventPerformance.totalReach)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Queued events</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Delivery Rate</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-[#1769AA] tabular-nums">
            {eventPerformance.deliveryRatePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {formatNumber(eventPerformance.totalDelivered)} delivered
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Response Rate</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-[#16A6BD] tabular-nums">
            {eventPerformance.responseRatePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {formatNumber(eventPerformance.totalResponded)} responded
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Conversion Rate</div>
          <div className="mt-1.5 font-mono text-2xl font-bold text-[#15946A] tabular-nums">
            {eventPerformance.conversionRatePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {formatNumber(eventPerformance.totalConverted)} conversions
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Attributed Revenue</div>
          <div className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatIdrCompact(eventPerformance.totalAttributedRevenue)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Cost: {formatIdrCompact(eventPerformance.totalCampaignCost)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Executed ROI</div>
          <div
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              eventPerformance.blendedRoiPct !== null && eventPerformance.blendedRoiPct < 0
                ? 'text-[#D9534F]'
                : 'text-[#15946A]'
            }`}
          >
            {eventPerformance.blendedRoiPct !== null ? `${eventPerformance.blendedRoiPct}%` : 'N/A'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Simulated Attribution</div>
        </div>
      </div>

      {/* Campaign Cost vs Attributed Revenue Chart + Comparison Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
          <h2 className="text-base font-semibold text-slate-900">
            Campaign Cost vs. Attributed Revenue (IDR M)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Derived strictly from executed simulated conversion events · Demo Data
          </p>
          <div className="mt-4 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                layout="vertical"
                margin={{ top: 4, right: 18, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}M`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 10.5, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="costM" name="Budget Cost (M)" fill="#102B4D" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
                <Bar dataKey="revenueM" name="Attributed Revenue (M)" fill="#16A6BD" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-7">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Campaign Comparison Scorecard</h2>
            <p className="text-xs text-slate-500">
              ROI is shown only for executed campaigns with non-zero cost and event logs.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 font-semibold">Campaign</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">Reach</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">Deliv. %</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">Conv. %</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right font-semibold">Attr. Rev</th>
                  <th className="whitespace-nowrap py-2.5 pl-2.5 pr-5 text-right font-semibold">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eventPerformance.campaigns.map((row) => (
                  <tr key={row.campaignId} className="hover:bg-slate-50">
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-slate-900">{row.campaignName}</div>
                      <div className="text-[11px] text-slate-500">
                        {row.status} · {row.channel} · {row.regionName}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-right font-mono tabular-nums">
                      {formatNumber(row.reach)}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-right font-mono tabular-nums">
                      {row.reach > 0 ? `${row.deliveryRatePct}%` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-right font-mono font-semibold text-[#15946A] tabular-nums">
                      {row.reach > 0 ? `${row.conversionRatePct}%` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.reach > 0 ? formatIdrCompact(row.attributedRevenue) : '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap py-3 pl-2.5 pr-5 text-right font-mono font-bold tabular-nums ${
                        row.roiPct !== null && row.roiPct < 0
                          ? 'text-[#D9534F]'
                          : 'text-[#1769AA]'
                      }`}
                    >
                      {row.roiPct !== null ? `${row.roiPct}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance by Region, Segment, and Channel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Event Performance Breakdown by Dimension
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Aggregated directly from simulated customer-level execution and conversion events.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                { id: 'region', label: 'By Region' },
                { id: 'segment', label: 'By Segment' },
                { id: 'channel', label: 'By Channel' },
              ] as Array<{ id: BreakdownTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBreakdownTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  breakdownTab === t.id
                    ? 'bg-[#102B4D] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-3 font-semibold capitalize">{breakdownTab}</th>
                <th className="px-3 py-2.5 text-right font-semibold">Reach</th>
                <th className="px-3 py-2.5 text-right font-semibold">Delivered</th>
                <th className="px-3 py-2.5 text-right font-semibold">Delivery %</th>
                <th className="px-3 py-2.5 text-right font-semibold">Response %</th>
                <th className="px-3 py-2.5 text-right font-semibold">Converted</th>
                <th className="px-3 py-2.5 text-right font-semibold">Conv. %</th>
                <th className="py-2.5 pl-3 text-right font-semibold">Attributed Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeBreakdownRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="py-3 pr-3 font-semibold text-slate-900">{row.key}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.reach)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.delivered)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{row.deliveryRatePct}%</td>
                  <td className="px-3 py-3 text-right font-mono text-[#1769AA] tabular-nums">
                    {row.responseRatePct}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatNumber(row.converted)}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-[#15946A] tabular-nums">
                    {row.conversionRatePct}%
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatIdrCompact(row.attributedRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control-Group Comparison (Honest Experimental Disclaimer) */}
      {controlRows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-2.5">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-[#1769AA]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Holdout Control-Group Comparison (Simulated Benchmark)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Compares treatment conversion rate against the 10% reserved synthetic holdout cohort.
                Observed differences in demo simulations do <strong>not</strong> claim statistically
                validated causal uplift.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Executed Campaign</th>
                  <th className="px-3 py-2 text-right font-semibold">Treatment Conv. %</th>
                  <th className="px-3 py-2 text-right font-semibold">Holdout Size</th>
                  <th className="px-3 py-2 text-right font-semibold">Control Conv. %</th>
                  <th className="py-2 pl-3 text-right font-semibold">Observed Diff (pts)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {controlRows.map((c) => (
                  <tr key={c.campaignId}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">{c.campaignName}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#15946A] tabular-nums">
                      {c.conversionRatePct}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {c.controlGroupSize}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {c.controlConversionRatePct}%
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono font-bold text-[#1769AA] tabular-nums">
                      {c.observedDiffPctPts !== null
                        ? `${c.observedDiffPctPts >= 0 ? '+' : ''}${c.observedDiffPctPts} pts`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              Production causal uplift measurement requires randomized stratified assignment and
              power-tested sample sizes across live transactions.
            </span>
          </div>
        </div>
      )}

      {/* Existing MVP 1 Branch Leaderboard preserved */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          {activeIndustry.terminology.branchSingular} Performance Leaderboard
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Ranked by cumulative customer lifetime value within permitted scope · Demo Data
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-3 font-semibold">{activeIndustry.terminology.branchSingular}</th>
                <th className="px-3 py-2.5 font-semibold">Format</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  {activeIndustry.terminology.customerPlural}
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  {activeIndustry.terminology.retentionMetricLabel}
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">Avg Propensity</th>
                <th className="py-2.5 pl-3 text-right font-semibold">Portfolio LTV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchScorecard.map((row) => (
                <tr key={row.branch.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900">{row.branch.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{row.branch.code}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{row.branch.type}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {formatNumber(row.customers)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#15946A] tabular-nums">
                    {row.retentionPct}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#1769AA] tabular-nums">
                    {row.avgProp}%
                  </td>
                  <td className="py-3 pl-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {formatIdrCompact(row.totalLtv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  Info,
  ArrowUpRight,
  ArrowDownRight,
  X,
  RotateCcw,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import type { DateRangeKey, KpiCardMetric } from '../../types/platform';
import { hasPermission } from '../../core/permissions/rbac';

const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
];

const SEGMENT_OPTIONS = [
  'ALL',
  'High-Value Loyal',
  'Growth Potential',
  'Core Active',
  'At-Risk Retention',
  'New Onboarding',
];

export function ExecutiveDashboard() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    filters,
    analytics,
    setFilters,
    navigateToModule,
    exploreRegionInLocation,
    openCustomersForTerritorySegment,
    openCampaignComposerFromAction,
    setAiPanelOpen,
  } = usePlatform();

  const [activeFormulaKpi, setActiveFormulaKpi] = useState<KpiCardMetric | null>(null);

  const selectedRegencyObj = activeTenant.province.regencies.find((r) => r.id === filters.regionId) ?? null;
  const canCreateCampaign = hasPermission(persona, 'campaigns.create');
  const hasActiveFilters =
    filters.regionId !== 'ALL' || filters.segment !== 'ALL' || filters.dateRange !== '6m';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle={`${activeTenant.name} · ${activeIndustry.dashboardLayoutEmphasis}`}
        metaItems={[
          'BM01',
          'Demo Data',
          `${activeIndustry.name} Profile`,
          `${activeTenant.primaryProvinceName}, Indonesia`,
          `${persona.title} (${persona.scopeLevel} scope)`,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Segmented Control */}
            <div
              role="group"
              aria-label="Date range filter"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              {DATE_RANGES.map((dr) => (
                <button
                  key={dr.key}
                  type="button"
                  onClick={() => setFilters({ dateRange: dr.key })}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    filters.dateRange === dr.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {dr.label}
                </button>
              ))}
            </div>

            {/* Segment Filter */}
            <label htmlFor="dash-segment-filter" className="sr-only">
              Filter by customer segment
            </label>
            <select
              id="dash-segment-filter"
              value={filters.segment}
              onChange={(e) => setFilters({ segment: e.target.value })}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-[#1769AA] focus:outline-none"
            >
              {SEGMENT_OPTIONS.map((seg) => (
                <option key={seg} value={seg}>
                  {seg === 'ALL' ? 'All Segments' : seg}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setFilters({ regionId: 'ALL', dateRange: '6m', segment: 'ALL' })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        }
      />

      {/* Connected Territory Workflow Bar when a specific region is selected */}
      {selectedRegencyObj && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#1769AA]/30 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 text-xs text-slate-700">
            <MapPin className="h-4 w-4 shrink-0 text-[#1769AA]" />
            <span>
              Territory focus active:{' '}
              <strong className="text-slate-900">{selectedRegencyObj.name}</strong> (
              {formatNumber(analytics.totalFilteredCustomers)}{' '}
              {activeIndustry.terminology.customerPlural.toLowerCase()})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exploreRegionInLocation(selectedRegencyObj.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D] whitespace-nowrap"
            >
              <span>Explore in Location Intelligence</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                openCustomersForTerritorySegment({
                  regionId: selectedRegencyObj.id,
                  segment: filters.segment,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
            >
              <span>Inspect Territory Customers</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty state if restrictive filters yield 0 records */}
      {analytics.totalFilteredCustomers === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No {activeIndustry.terminology.customerPlural.toLowerCase()} match the active filter combination
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Broaden the region or segment filter to restore executive telemetry.
          </p>
          <button
            type="button"
            onClick={() => setFilters({ regionId: 'ALL', segment: 'ALL', dateRange: '6m' })}
            className="mt-4 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            Reset Dashboard Filters
          </button>
        </div>
      ) : (
        <>
          {/* 8 Executive KPI Cards */}
          <section aria-label="Key Performance Indicators">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {analytics.kpis.map((kpi) => {
                const deltaColor =
                  kpi.tone === 'critical'
                    ? 'text-[#D9534F]'
                    : kpi.tone === 'warning'
                      ? 'text-[#B47815]'
                      : kpi.tone === 'positive'
                        ? 'text-[#15946A]'
                        : 'text-slate-600';

                return (
                  <div
                    key={kpi.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">{kpi.label}</span>
                      <button
                        type="button"
                        onClick={() => setActiveFormulaKpi(kpi)}
                        aria-label={`How ${kpi.label} is calculated`}
                        title="How this KPI is calculated"
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1769AA]"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-3 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {kpi.formattedValue}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
                      <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${deltaColor}`}>
                        {kpi.trendDirection === 'up' ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {kpi.deltaPct > 0 ? `+${kpi.deltaPct}%` : `${kpi.deltaPct}%`}
                      </span>
                      <span className="truncate text-slate-500">{kpi.deltaLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline KPI Formula Disclosure Drawer/Banner when a user clicks "How this KPI is calculated" */}
            {activeFormulaKpi && (
              <div
                role="region"
                aria-label="KPI calculation methodology"
                className="mt-4 flex flex-col gap-3 rounded-xl border border-[#1769AA]/30 bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold text-[#1769AA]">
                    KPI Methodology · {activeFormulaKpi.dataScopeNote}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">
                    {activeFormulaKpi.formulaTitle}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {activeFormulaKpi.formulaDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFormulaKpi(null)}
                  aria-label="Close KPI calculation info"
                  className="self-start rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          {/* Primary Charts Row: Trend + Segmentation */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {/* Revenue & Activity Trend */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {activeIndustry.terminology.primaryRevenueLabel} Trend
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Monthly synthetic volume (IDR Millions) · Demo Data · Window: {filters.dateRange.toUpperCase()}
                  </p>
                </div>
                <div className="text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {formatIdrCompact(analytics.totalPeriodRevenue)}
                </div>
              </div>

              <div className="mt-5 h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.monthlyTrends}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="serveonRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1769AA" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#1769AA" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, name: string | number | undefined) => [
                        name === 'revenueMillions'
                          ? `IDR ${Number(value).toLocaleString('en-US')}M`
                          : formatNumber(Number(value)),
                        name === 'revenueMillions'
                          ? activeIndustry.terminology.primaryRevenueLabel
                          : activeIndustry.terminology.transactionPlural,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenueMillions"
                      stroke="#1769AA"
                      strokeWidth={2.25}
                      fill="url(#serveonRevGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Segmentation Distribution */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {activeIndustry.terminology.customerSingular} Segmentation
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Distribution across {formatNumber(analytics.totalFilteredCustomers)} scoped records · Demo Data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToModule('BM02')}
                  className="text-xs font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                >
                  Open Directory
                </button>
              </div>

              <div className="mt-5 h-[205px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.segments}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
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
                      dataKey="segment"
                      width={118}
                      tick={{ fontSize: 11, fill: '#334155' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown) => [
                        `${formatNumber(Number(val))} ${activeIndustry.terminology.customerPlural.toLowerCase()}`,
                        'Count',
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                      {analytics.segments.map((entry) => (
                        <Cell key={entry.segment} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-xs">
                {analytics.segments.slice(0, 3).map((seg) => (
                  <div key={seg.segment} className="flex items-center justify-between py-1.5">
                    <span className="text-slate-600">{seg.segment}</span>
                    <span className="font-mono text-slate-900 tabular-nums">
                      {seg.sharePct}% · Avg LTV {formatIdrCompact(seg.avgLtv)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Regional Performance & Geographic Opportunity Visualization */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Regional Performance &amp; Opportunity ({activeTenant.primaryProvinceName})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Click a territory row to filter the dashboard · Demo Data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exploreRegionInLocation(filters.regionId)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Open Location Intelligence</span>
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 pr-3 font-semibold">Regency / City</th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        {activeIndustry.terminology.customerPlural}
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">Active %</th>
                      <th className="px-3 py-2.5 text-right font-semibold">At-Risk</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Period Revenue</th>
                      <th className="py-2.5 pl-3 text-right font-semibold">Opp. Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.regionalPerformance.map((row) => {
                      const isSelected = filters.regionId === row.regionId;
                      return (
                        <tr
                          key={row.regionId}
                          className={`transition-colors ${
                            isSelected ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              onClick={() =>
                                setFilters({
                                  regionId: isSelected ? 'ALL' : row.regionId,
                                })
                              }
                              className="text-left font-medium text-slate-900 hover:text-[#1769AA]"
                            >
                              {row.regionName}
                            </button>
                            <div className="text-[11px] text-slate-500">
                              {row.branchCount} {activeIndustry.terminology.branchPlural.toLowerCase()}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-800 tabular-nums">
                            {formatNumber(row.customers)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[#15946A] tabular-nums">
                            {row.activeRatePct}%
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-[#D9534F] tabular-nums">
                            {formatNumber(row.atRiskCount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-900 tabular-nums">
                            {formatIdrCompact(row.revenue)}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-[#16A6BD]"
                                  style={{ width: `${Math.min(100, row.opportunityScore)}%` }}
                                />
                              </div>
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                {row.opportunityScore}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommended Actions & AI Insight Cards */}
            <div className="space-y-6 xl:col-span-5">
              {/* Top Recommended Actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Top Recommended Actions
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Illustrative AI Simulation · Human approval required
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-slate-200">
                  {analytics.recommendedActions.map((act) => (
                    <div key={act.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-500">
                            {act.priority} Priority · {act.regionName} · {act.suggestedChannel}
                          </div>
                          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
                            {act.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600">
                            {act.targetSummary} · Est. impact {act.estimatedImpact}
                          </p>
                        </div>
                        {canCreateCampaign && (
                          <button
                            type="button"
                            onClick={() =>
                              openCampaignComposerFromAction({
                                name: act.title,
                                objective: `Targeted action for ${act.targetSummary} in ${act.regionName}.`,
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
                            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
                          >
                            Draft Campaign
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insight Cards */}
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">AI Insight Briefings</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Illustrative AI Simulation · Grounded in current tenant
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiPanelOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                  >
                    <span>Ask Assistant</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 divide-y divide-slate-200">
                  {analytics.aiInsightCards.map((card) => (
                    <div key={card.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="text-xs font-medium text-[#1769AA]">
                        {card.category} · {card.confidenceLabel}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-slate-900">{card.headline}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{card.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

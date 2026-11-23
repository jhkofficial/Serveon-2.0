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
  AreaChart,
  Area,
} from 'recharts';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  Building,
  MapPin,
  ShieldAlert,
  TrendingUp,
  Users,
  PieChart,
  AlertTriangle,
  ArrowRight,
  Package,
  Activity,
  Sparkles,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import {
  buildCustomerSpendTimeline,
  computeLifecycleDistribution,
  computeSegmentProfiles,
  getAtRiskCustomers,
  queryCustomers,
  type CustomerDirectoryQuery,
} from '../../core/analytics/customerLocationService';
import type { CustomerRecord, RiskCategory } from '../../types/platform';

const PAGE_SIZE = 15;
type CustomerSubTab = 'directory' | 'segmentation' | 'at_risk';

export function CustomerIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    scopedCustomers,
    filters,
    geoDrilldown,
    customerRiskFilter,
    selectedCustomerId,
    setFilters,
    setGeoDrilldown,
    setCustomerRiskFilter,
    exploreRegionInLocation,
    openCustomer360,
    openCustomerPredictions,
    openNbaForCustomer,
    openCampaignComposerFromAction,
    persona,
  } = usePlatform();

  const [subTab, setSubTab] = useState<CustomerSubTab>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerRecord['status']>('ALL');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<NonNullable<CustomerDirectoryQuery['sortBy']>>('ltv_desc');
  const [page, setPage] = useState(1);

  const selectedCustomer: CustomerRecord | null = useMemo(() => {
    if (!selectedCustomerId) return null;
    return scopedCustomers.find((c) => c.customer_id === selectedCustomerId) ?? null;
  }, [scopedCustomers, selectedCustomerId]);

  const activeRegency = activeTenant.province.regencies.find((r) => r.id === filters.regionId) ?? null;
  const activeDistrict =
    activeRegency?.districts.find((d) => d.id === geoDrilldown.districtId) ?? null;
  const activeVillage =
    activeDistrict?.villages.find((v) => v.id === geoDrilldown.villageId) ?? null;

  // Territory-scoped customers (used for Segmentation & At-Risk dashboards so they mirror territory filters)
  const territoryCustomers = useMemo(
    () =>
      queryCustomers(scopedCustomers, {
        regionId: filters.regionId,
        districtId: geoDrilldown.districtId,
        villageId: geoDrilldown.villageId,
      }),
    [scopedCustomers, filters.regionId, geoDrilldown.districtId, geoDrilldown.villageId]
  );

  // Full filtered directory list
  const filteredList = useMemo(
    () =>
      queryCustomers(scopedCustomers, {
        searchQuery,
        regionId: filters.regionId,
        districtId: geoDrilldown.districtId,
        villageId: geoDrilldown.villageId,
        segment: filters.segment,
        risk: customerRiskFilter,
        status: statusFilter,
        lifecycleStage: lifecycleFilter,
        sortBy,
      }),
    [
      scopedCustomers,
      searchQuery,
      filters.regionId,
      geoDrilldown.districtId,
      geoDrilldown.villageId,
      filters.segment,
      customerRiskFilter,
      statusFilter,
      lifecycleFilter,
      sortBy,
    ]
  );

  const segmentProfiles = useMemo(
    () => computeSegmentProfiles(territoryCustomers),
    [territoryCustomers]
  );

  const lifecycleMetrics = useMemo(
    () => computeLifecycleDistribution(territoryCustomers, activeIndustry),
    [territoryCustomers, activeIndustry]
  );

  const atRiskSummary = useMemo(
    () => getAtRiskCustomers(territoryCustomers, 25),
    [territoryCustomers]
  );

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasGeoFilter =
    filters.regionId !== 'ALL' ||
    geoDrilldown.districtId !== 'ALL' ||
    geoDrilldown.villageId !== 'ALL';

  const hasAnyFilter =
    hasGeoFilter ||
    searchQuery.trim() !== '' ||
    filters.segment !== 'ALL' ||
    customerRiskFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    lifecycleFilter !== 'ALL';

  function resetAllCustomerFilters() {
    setSearchQuery('');
    setFilters({ regionId: 'ALL', segment: 'ALL' });
    setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' });
    setCustomerRiskFilter('ALL');
    setStatusFilter('ALL');
    setLifecycleFilter('ALL');
    setPage(1);
  }

  // ==========================================================
  // CUSTOMER 360 DETAIL PAGE
  // ==========================================================
  if (selectedCustomer) {
    const branch = activeTenant.branches.find((b) => b.id === selectedCustomer.branch_id);
    const currentStageIdx = Math.max(
      0,
      activeIndustry.lifecycleStages.indexOf(selectedCustomer.lifecycle_stage)
    );
    const spendTimeline = buildCustomerSpendTimeline(selectedCustomer);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openCustomer360(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to {activeIndustry.terminology.customerPlural}</span>
            </button>
            <span className="text-xs text-slate-500">
              Customer 360 · {selectedCustomer.code} · Synthetic Demo Record
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openCustomerPredictions(selectedCustomer.customer_id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Inspect AI Prediction</span>
            </button>
            <button
              type="button"
              onClick={() => openNbaForCustomer(selectedCustomer.customer_id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#16A6BD]" />
              <span>Next-Best-Action</span>
            </button>
            <button
              type="button"
              onClick={() => exploreRegionInLocation(selectedCustomer.region_id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#1769AA] hover:border-[#1769AA] hover:bg-slate-50"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Explore {selectedCustomer.demographic_attributes.city} on Map</span>
            </button>
          </div>
        </div>

        {/* Profile Summary Header */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">
                {selectedCustomer.code} · {selectedCustomer.customer_segment} · Status:{' '}
                <span
                  className={
                    selectedCustomer.status === 'Active'
                      ? 'font-semibold text-[#15946A]'
                      : 'font-semibold text-[#D9534F]'
                  }
                >
                  {selectedCustomer.status}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {selectedCustomer.full_name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {selectedCustomer.demographic_attributes.village},{' '}
                  {selectedCustomer.demographic_attributes.district},{' '}
                  {selectedCustomer.demographic_attributes.city}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  {branch?.name ?? selectedCustomer.branch_id}
                </span>
                <span className="font-mono">{selectedCustomer.demographic_attributes.phone_masked}</span>
                <span className="font-mono">{selectedCustomer.demographic_attributes.email_masked}</span>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-6 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
              <div>
                <div className="text-xs text-slate-500 whitespace-nowrap">Lifetime Value</div>
                <div className="mt-0.5 whitespace-nowrap font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {formatIdrCompact(selectedCustomer.lifetime_value)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Churn Risk (Sim)</div>
                <div
                  className={`mt-0.5 whitespace-nowrap font-mono text-lg font-semibold tabular-nums ${
                    selectedCustomer.model_outputs.churn_risk_category === 'High'
                      ? 'text-[#D9534F]'
                      : selectedCustomer.model_outputs.churn_risk_category === 'Medium'
                        ? 'text-[#B47815]'
                        : 'text-[#15946A]'
                  }`}
                >
                  {selectedCustomer.model_outputs.churn_risk_score}/100
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {selectedCustomer.model_outputs.churn_risk_category} Risk
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Propensity (Sim)</div>
                <div className="mt-0.5 font-mono text-lg font-semibold text-[#1769AA] tabular-nums">
                  {selectedCustomer.model_outputs.purchase_propensity_score}%
                </div>
              </div>
            </div>
          </div>

          {/* Customer Lifecycle Visualization */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                {activeIndustry.name} Customer Lifecycle Journey
              </span>
              <span className="font-mono text-slate-500 tabular-nums">
                Tenure: {selectedCustomer.demographic_attributes.tenure_months} months · Last Activity: {selectedCustomer.last_activity_date}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {activeIndustry.lifecycleStages.map((stage, idx) => {
                const isCurrent = idx === currentStageIdx;
                const isDone = idx < currentStageIdx;
                return (
                  <div
                    key={stage}
                    className={`rounded-lg border px-3 py-2.5 text-xs ${
                      isCurrent
                        ? 'border-[#1769AA] bg-[#F0F7FC] font-semibold text-[#102B4D]'
                        : isDone
                          ? 'border-slate-200 bg-slate-50 text-slate-700'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className={isCurrent ? 'text-[#1769AA]' : 'text-slate-400'}>
                        STAGE 0{idx + 1}
                      </span>
                      {isCurrent && <span className="text-[#1769AA]">Current</span>}
                    </div>
                    <div className="mt-1 truncate">{stage}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Two-Column Detail Body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Purchase Spend Timeline + Transactions + Extension Attributes */}
          <div className="space-y-6 lg:col-span-7">
            {/* Purchase & Spend Timeline Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Purchase &amp; Transaction Spend Timeline
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chronological {activeIndustry.terminology.transactionPlural.toLowerCase()} (IDR Millions) · Demo Data
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                  {selectedCustomer.transactions.length} orders
                </span>
              </div>

              <div className="mt-4 h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendTimeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="custSpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A6BD" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#16A6BD" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}M`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: unknown) => [`IDR ${Number(v).toFixed(2)}M`, 'Order Value']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amountMillions"
                      stroke="#16A6BD"
                      strokeWidth={2}
                      fill="url(#custSpendGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transaction History Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">
                {activeIndustry.terminology.transactionPlural} Ledger
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Referentially linked to {branch?.name ?? selectedCustomer.branch_id} · Demo Data
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">{activeIndustry.terminology.productSingular}</th>
                      <th className="px-3 py-2 font-semibold">Category</th>
                      <th className="px-3 py-2 font-semibold">Channel</th>
                      <th className="py-2 pl-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCustomer.transactions.map((tx) => (
                      <tr key={tx.transaction_id}>
                        <td className="py-2.5 pr-3 font-mono text-slate-600 tabular-nums">{tx.date}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{tx.product_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{tx.category}</td>
                        <td className="px-3 py-2.5 text-slate-600">{tx.channel}</td>
                        <td className="py-2.5 pl-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                          {formatIdrCompact(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Industry Extension Attributes & Product Holdings */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">
                {activeIndustry.name} Profile &amp; Extension Attributes
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Extensible industry attributes separated from the core canonical customer schema.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
                {Object.entries(selectedCustomer.extension_attributes).map(([key, val]) => {
                  const def = activeIndustry.extensionAttributes.find((a) => a.key === key);
                  return (
                    <div key={key}>
                      <dt className="text-slate-500">{def?.label ?? key.replace(/_/g, ' ')}</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {typeof val === 'number' ? val.toLocaleString('en-US') : val}
                      </dd>
                    </div>
                  );
                })}
                <div>
                  <dt className="text-slate-500">Preferred Channel</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {selectedCustomer.demographic_attributes.preferred_channel}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Age Band</dt>
                  <dd className="mt-1 font-mono font-medium text-slate-900">
                    {selectedCustomer.demographic_attributes.age_band}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Geo Opportunity</dt>
                  <dd className="mt-1 font-mono font-medium text-[#16A6BD] tabular-nums">
                    {selectedCustomer.model_outputs.geographic_opportunity_score} / 100
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Owned {activeIndustry.terminology.productSingular}</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {selectedCustomer.products[0]?.name ?? 'Active Account'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Right: Recommended Next-Best-Action + Product Ownership + Engagement History */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Recommended Next-Best-Action
                </h2>
                <span className="text-[11px] text-slate-500">Illustrative AI Simulation</span>
              </div>
              <p className="mt-2.5 rounded-lg bg-[#F0F7FC] p-4 text-sm font-medium leading-relaxed text-[#102B4D]">
                {selectedCustomer.model_outputs.recommended_next_best_action}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  Key Contributing Factors ({selectedCustomer.model_outputs.model_version})
                </div>
                {selectedCustomer.model_outputs.contributing_factors.map((f) => (
                  <div key={f.factor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{f.factor}</span>
                      <span
                        className={`font-mono font-medium tabular-nums ${
                          f.direction === 'increases_risk'
                            ? 'text-[#D9534F]'
                            : f.direction === 'reduces_risk'
                              ? 'text-[#15946A]'
                              : 'text-[#1769AA]'
                        }`}
                      >
                        {f.impact > 0 ? `+${f.impact}` : f.impact}
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
                        style={{ width: `${Math.min(100, Math.abs(f.impact) * 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openCustomerPredictions(selectedCustomer.customer_id)}
                  className="w-full rounded-lg border border-[#1769AA] bg-white px-4 py-2 text-xs font-semibold text-[#1769AA] transition-colors hover:bg-[#F0F7FC]"
                >
                  Open Full Prediction &amp; Explainable AI
                </button>
                {persona.permissions.includes('campaigns.create') && (
                  <button
                    type="button"
                    onClick={() =>
                      openCampaignComposerFromAction({
                        name: `${selectedCustomer.customer_segment} Outreach — ${selectedCustomer.demographic_attributes.city}`,
                        objective: selectedCustomer.model_outputs.recommended_next_best_action,
                        targetSegment: selectedCustomer.customer_segment,
                        regionId: selectedCustomer.region_id,
                        channel: selectedCustomer.demographic_attributes.preferred_channel,
                      })
                    }
                    className="w-full rounded-lg bg-[#1769AA] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D]"
                  >
                    Draft Campaign from Recommended Action
                  </button>
                )}
              </div>
            </div>

            {/* Product Holdings */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#1769AA]" />
                <h2 className="text-base font-semibold text-slate-900">
                  {activeIndustry.terminology.productPlural}
                </h2>
              </div>
              <div className="mt-3 divide-y divide-slate-100 text-xs">
                {selectedCustomer.products.map((prod) => (
                  <div key={prod.product_id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-semibold text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {prod.category} · Acquired {prod.acquired_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatIdrCompact(prod.value)}
                      </div>
                      <div
                        className={`text-[11px] font-medium ${
                          prod.status === 'Active' ? 'text-[#15946A]' : 'text-[#B47815]'
                        }`}
                      >
                        {prod.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement History */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">Engagement History</h2>
              <div className="mt-4 divide-y divide-slate-200">
                {selectedCustomer.interactions.map((inter) => (
                  <div key={inter.interaction_id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-800">
                        {inter.type} · {inter.channel}
                      </span>
                      <span className="font-mono tabular-nums">{inter.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{inter.summary}</p>
                    <div className="mt-1 text-[11px] font-medium text-[#1769AA]">
                      Outcome: {inter.outcome}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // CUSTOMER INTELLIGENCE WORKSPACE (DIRECTORY / SEGMENTATION / AT-RISK)
  // ==========================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Intelligence"
        subtitle={`Searchable ${activeIndustry.terminology.customerSingular.toLowerCase()} database, segmentation & lifecycle profiling, at-risk identification, and Customer 360 views.`}
        metaItems={[
          'BM02',
          'Demo Data',
          `${formatNumber(filteredList.length)} matched of ${formatNumber(scopedCustomers.length)} scoped`,
          activeRegency ? `Territory: ${activeRegency.name}` : `All ${activeTenant.primaryProvinceName}`,
        ]}
        actions={
          <button
            type="button"
            onClick={() => exploreRegionInLocation(filters.regionId)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
          >
            <MapPin className="h-3.5 w-3.5 text-[#1769AA]" />
            <span>Explore on Location Map</span>
          </button>
        }
      />

      {/* Sub-view Switcher: Directory / Segmentation & Lifecycle / At-Risk Identification */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Customer Intelligence views"
          className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
        >
          {(
            [
              { id: 'directory', label: `Customer Directory (${formatNumber(filteredList.length)})`, icon: Users },
              { id: 'segmentation', label: 'Segmentation & Lifecycle', icon: PieChart },
              { id: 'at_risk', label: `At-Risk Identification (${formatNumber(atRiskSummary.totalAtRisk)})`, icon: AlertTriangle },
            ] as Array<{
              id: CustomerSubTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
            }>
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={subTab === t.id}
                onClick={() => setSubTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  subTab === t.id
                    ? 'bg-[#102B4D] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Connected Territory Breadcrumb Sync Indicator */}
        {hasGeoFilter && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-[#1769AA]" />
            <span>
              Territory synced:{' '}
              <strong className="text-slate-900">
                {activeRegency?.name ?? activeTenant.primaryProvinceName}
                {activeDistrict ? ` / ${activeDistrict.name}` : ''}
                {activeVillage ? ` / ${activeVillage.name}` : ''}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' })}
              className="font-semibold text-[#1769AA] hover:underline"
            >
              Clear Territory
            </button>
          </div>
        )}
      </div>

      {/* SUB-VIEW 1: SEARCHABLE CUSTOMER DIRECTORY */}
      {subTab === 'directory' && (
        <div className="space-y-4">
          {/* Multi-Dimensional Filter & Profiling Bar */}
          <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="customer-search-input" className="sr-only">
                Search customers by name, code, location, or attribute
              </label>
              <input
                id="customer-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={`Search name, code, city, district, or ${activeIndustry.name.toLowerCase()} attribute...`}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1769AA] focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter customers by segment"
              value={filters.segment}
              onChange={(e) => {
                setFilters({ segment: e.target.value });
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
            >
              <option value="ALL">All Segments</option>
              <option value="High-Value Loyal">High-Value Loyal</option>
              <option value="Growth Potential">Growth Potential</option>
              <option value="Core Active">Core Active</option>
              <option value="At-Risk Retention">At-Risk Retention</option>
              <option value="New Onboarding">New Onboarding</option>
            </select>

            <select
              aria-label="Filter customers by lifecycle stage"
              value={lifecycleFilter}
              onChange={(e) => {
                setLifecycleFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
            >
              <option value="ALL">All Lifecycle Stages</option>
              {activeIndustry.lifecycleStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter customers by churn risk"
              value={customerRiskFilter}
              onChange={(e) => {
                setCustomerRiskFilter(e.target.value as 'ALL' | RiskCategory);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="High">High Churn Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>

            <select
              aria-label="Sort customer directory"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as NonNullable<CustomerDirectoryQuery['sortBy']>)
              }
              className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 md:col-span-2"
            >
              <option value="ltv_desc">Sort: Highest LTV</option>
              <option value="churn_desc">Sort: Highest Churn Risk</option>
              <option value="propensity_desc">Sort: Highest Propensity</option>
              <option value="recent_desc">Sort: Most Recent Activity</option>
              <option value="name_asc">Sort: Name (A–Z)</option>
            </select>

            {hasAnyFilter && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs md:col-span-12">
                <div className="flex flex-wrap items-center gap-3 text-slate-600">
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatNumber(filteredList.length)} matching records
                  </span>
                  <span>·</span>
                  <select
                    aria-label="Filter by account status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as 'ALL' | CustomerRecord['status']);
                      setPage(1);
                    }}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                  >
                    <option value="ALL">Status: All</option>
                    <option value="Active">Status: Active</option>
                    <option value="At-Risk">Status: At-Risk</option>
                    <option value="Dormant">Status: Dormant</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={resetAllCustomerFilters}
                  className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}
          </div>

          {/* Directory Table or Empty State */}
          {filteredList.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <h2 className="text-base font-semibold text-slate-900">
                No matching {activeIndustry.terminology.customerPlural.toLowerCase()} found
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Adjust your search query or reset territory, segment, and risk filters to restore the directory.
              </p>
              <button
                type="button"
                onClick={resetAllCustomerFilters}
                className="mt-4 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="px-4 py-3 font-semibold">{activeIndustry.terminology.customerSingular}</th>
                      <th className="px-4 py-3 font-semibold">Territory</th>
                      <th className="px-4 py-3 font-semibold">Segment &amp; Lifecycle</th>
                      <th className="px-4 py-3 text-right font-semibold">Lifetime Value</th>
                      <th className="px-4 py-3 text-right font-semibold">Churn Risk (Sim)</th>
                      <th className="px-4 py-3 text-right font-semibold">Propensity</th>
                      <th className="px-4 py-3 text-right font-semibold">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageItems.map((c) => (
                      <tr key={c.customer_id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{c.full_name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {c.code} · {c.status}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">{c.demographic_attributes.city}</div>
                          <div className="text-[11px] text-slate-500">
                            {c.demographic_attributes.district}, {c.demographic_attributes.village}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{c.customer_segment}</div>
                          <div className="text-[11px] text-slate-500">{c.lifecycle_stage}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                          {formatIdrCompact(c.lifetime_value)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              c.model_outputs.churn_risk_category === 'High'
                                ? 'text-[#D9534F]'
                                : c.model_outputs.churn_risk_category === 'Medium'
                                  ? 'text-[#B47815]'
                                  : 'text-[#15946A]'
                            }`}
                          >
                            {c.model_outputs.churn_risk_category === 'High' && (
                              <ShieldAlert className="h-3.5 w-3.5" />
                            )}
                            {c.model_outputs.churn_risk_score} ({c.model_outputs.churn_risk_category})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-[#1769AA] tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            {c.model_outputs.purchase_propensity_score >= 70 && (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {c.model_outputs.purchase_propensity_score}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openCustomer360(c.customer_id)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
                          >
                            View 360
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span className="font-mono tabular-nums">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredList.length)} of{' '}
                  {formatNumber(filteredList.length)} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous customer page"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="font-mono tabular-nums">
                    Page {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next customer page"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: CUSTOMER SEGMENTATION & LIFECYCLE DASHBOARD */}
      {subTab === 'segmentation' && (
        <div className="space-y-6">
          {/* Interactive Segment Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {segmentProfiles.map((seg) => (
              <button
                key={seg.segment}
                type="button"
                onClick={() => {
                  setFilters({ segment: seg.segment });
                  setSubTab('directory');
                  setPage(1);
                }}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#1769AA] hover:bg-[#F5F8FC]"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{seg.segment}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {formatNumber(seg.count)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {seg.sharePct}% of territory base
                  </div>
                </div>
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Avg LTV</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatIdrCompact(seg.avgLtv)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Propensity</span>
                    <span className="font-mono text-[#1769AA] tabular-nums">
                      {seg.avgPropensityScore}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Charts: Segment Avg LTV vs Volume & Lifecycle Stage Funnel */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-6">
              <h2 className="text-base font-semibold text-slate-900">
                Segment Volume &amp; Value Profile
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Click any segment card above to inspect its directory cohort · Demo Data
              </p>
              <div className="mt-4 h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={segmentProfiles}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="segment"
                      interval={0}
                      tickFormatter={(val: string) => {
                        const shortMap: Record<string, string> = {
                          'High-Value Loyal': 'High-Value',
                          'Growth Potential': 'Growth',
                          'Core Active': 'Core Active',
                          'At-Risk Retention': 'At-Risk',
                          'New Onboarding': 'Onboarding',
                        };
                        return shortMap[val] ?? val;
                      }}
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Accounts" radius={[6, 6, 0, 0]} barSize={36} isAnimationActive={false}>
                      {segmentProfiles.map((entry) => (
                        <Cell key={entry.segment} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-6">
              <h2 className="text-base font-semibold text-slate-900">
                {activeIndustry.name} Customer Lifecycle Distribution
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Account progression across configured lifecycle stages · Demo Data
              </p>
              <div className="mt-4 space-y-3.5">
                {lifecycleMetrics.map((stage, idx) => (
                  <div key={stage.stage} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleFilter(stage.stage);
                          setSubTab('directory');
                          setPage(1);
                        }}
                        className="font-semibold text-slate-800 hover:text-[#1769AA] hover:underline"
                      >
                        0{idx + 1}. {stage.stage}
                      </button>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {formatNumber(stage.count)} ({stage.sharePct}%) · Avg LTV {formatIdrCompact(stage.avgLtv)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#1769AA]"
                        style={{ width: `${Math.max(4, stage.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: AT-RISK CUSTOMER IDENTIFICATION WORKBENCH */}
      {subTab === 'at_risk' && (
        <div className="space-y-5">
          {/* At-Risk KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">
                Identified At-Risk {activeIndustry.terminology.customerPlural}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#D9534F] tabular-nums">
                {formatNumber(atRiskSummary.totalAtRisk)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Illustrative AI Simulation · Churn Score &gt;= 65 or Status = At-Risk
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Cumulative LTV Exposed</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatIdrCompact(atRiskSummary.revenueAtRisk)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Within active territory scope ({activeRegency?.name ?? activeTenant.primaryProvinceName})
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Mean Simulated Churn Score</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-[#B47815] tabular-nums">
                {atRiskSummary.avgChurnScore} / 100
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Sorted by highest churn score and lifetime value
              </div>
            </div>
          </div>

          {/* Priority Retention Queue */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Prioritized At-Risk Retention Queue (Top 25)
                </h2>
                <p className="text-xs text-slate-500">
                  Open Customer 360 to inspect full risk attribution and trigger approved retention outreach.
                </p>
              </div>
              {persona.permissions.includes('campaigns.create') && (
                <button
                  type="button"
                  onClick={() =>
                    openCampaignComposerFromAction({
                      name: `${activeRegency?.name ?? activeTenant.primaryProvinceName} At-Risk Retention Drive`,
                      objective: `Proactive retention outreach for ${atRiskSummary.totalAtRisk} at-risk ${activeIndustry.terminology.customerPlural.toLowerCase()}.`,
                      targetSegment: 'At-Risk Retention',
                      regionId: filters.regionId,
                      channel: 'WhatsApp',
                    })
                  }
                  className="rounded-lg bg-[#1769AA] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#102B4D] whitespace-nowrap"
                >
                  Draft Retention Campaign
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-4 py-3 font-semibold">{activeIndustry.terminology.customerSingular}</th>
                    <th className="px-4 py-3 font-semibold">Territory</th>
                    <th className="px-4 py-3 text-right font-semibold">Churn Score (Sim)</th>
                    <th className="px-4 py-3 text-right font-semibold">LTV Exposed</th>
                    <th className="px-4 py-3 font-semibold">Primary Churn Factor</th>
                    <th className="px-4 py-3 font-semibold">Next-Best-Action</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskSummary.priorityQueue.map((acc) => (
                    <tr key={acc.customer_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{acc.full_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{acc.code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {acc.demographic_attributes.city}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#D9534F] tabular-nums">
                        {acc.model_outputs.churn_risk_score}/100
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                        {formatIdrCompact(acc.lifetime_value)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {acc.model_outputs.contributing_factors[0]?.factor}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                        {acc.model_outputs.recommended_next_best_action}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openCustomer360(acc.customer_id)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:border-[#1769AA] hover:text-[#1769AA] whitespace-nowrap"
                        >
                          View 360
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

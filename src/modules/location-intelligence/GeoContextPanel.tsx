import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Compass,
  Crosshair,
  Info,
  Lock,
  MapPin,
  Navigation,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import type {
  CompetitorLocation,
  CoverageAnalysisResult,
  CustomerToDealerInsights,
  DealerNetworkNode,
  GeoSelectionSummary,
  GeocodedCustomer,
  IndustryGeoConfig,
  OpportunityGapZone,
  OpportunityWeights,
} from '../../types/geospatial';
import {
  haversineDistanceKm,
  MARKER_GROUP_META,
} from '../../core/geo/geospatialService';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';

export type ContextPanelTab =
  | 'territory'
  | 'customer'
  | 'dealer'
  | 'competitor'
  | 'opportunity'
  | 'selection';

interface GeoContextPanelProps {
  activeTab: ContextPanelTab;
  onChangeTab: (tab: ContextPanelTab) => void;
  geoConfig: IndustryGeoConfig;
  provinceName: string;
  activeTerritoryTitle: string;
  selectedRegionId: string;
  selectedDistrictId: string;
  selectedVillageId: string;
  filteredCustomers: GeocodedCustomer[];
  allDealers: DealerNetworkNode[];
  competitors: CompetitorLocation[];
  selectedCustomer: GeocodedCustomer | null;
  selectedDealer: DealerNetworkNode | null;
  selectedCompetitor: CompetitorLocation | null;
  activeCoverage: CoverageAnalysisResult | null;
  coverageRadiusKm: number;
  onChangeCoverageRadiusKm: (km: number) => void;
  customerToDealerInsights: CustomerToDealerInsights;
  showCustomerToDealerLine: boolean;
  onToggleCustomerToDealerLine: (val: boolean) => void;
  opportunityZones: OpportunityGapZone[];
  opportunityWeights: OpportunityWeights;
  onUpdateOpportunityWeights: (weights: OpportunityWeights) => void;
  selectionSummary: GeoSelectionSummary | null;
  onClearSelection: () => void;
  canViewIndividualCustomers: boolean;
  canCreateCampaign: boolean;
  onSelectCustomer: (customerId: string) => void;
  onSelectDealer: (dealerId: string) => void;
  onSelectRegion: (regionId: string) => void;
  onOpenCustomer360: (customerId: string) => void;
  onOpenCustomerPrediction: (customerId: string) => void;
  onOpenSegmentInCustomerIntel: (segment: string) => void;
  onCreateCampaignFromSelection: (summary: GeoSelectionSummary) => void;
  onOpenNbaForRegion: (regionId: string) => void;
  onOpenAiBriefing: () => void;
  onClose?: () => void;
  isFullscreen?: boolean;
}

const RADIUS_PRESETS = [1, 3, 5, 10, 15];
const DRIVE_TIME_PRESETS = [5, 10, 15, 30];

export function GeoContextPanel({
  activeTab,
  onChangeTab,
  geoConfig,
  provinceName,
  activeTerritoryTitle,
  selectedRegionId,
  filteredCustomers,
  allDealers,
  competitors,
  selectedCustomer,
  selectedDealer,
  selectedCompetitor,
  activeCoverage,
  coverageRadiusKm,
  onChangeCoverageRadiusKm,
  customerToDealerInsights,
  showCustomerToDealerLine,
  onToggleCustomerToDealerLine,
  opportunityZones,
  opportunityWeights,
  onUpdateOpportunityWeights,
  selectionSummary,
  onClearSelection,
  canViewIndividualCustomers,
  canCreateCampaign,
  onSelectCustomer,
  onSelectDealer,
  onSelectRegion,
  onOpenCustomer360,
  onOpenCustomerPrediction,
  onOpenSegmentInCustomerIntel,
  onCreateCampaignFromSelection,
  onOpenNbaForRegion,
  onOpenAiBriefing,
  onClose,
  isFullscreen = false,
}: GeoContextPanelProps) {
  const [coverageMode, setCoverageMode] = useState<'radius' | 'drivetime'>('radius');
  const [selectedDriveMin, setSelectedDriveMin] = useState<number>(15);
  const [customRadiusInput, setCustomRadiusInput] = useState<string>(String(coverageRadiusKm));
  const [showDealerAnalyticsDetail, setShowDealerAnalyticsDetail] = useState(false);

  const territoryStats = useMemo(() => {
    const totalLtv = filteredCustomers.reduce((s, c) => s + c.lifetime_value, 0);
    const atRisk = filteredCustomers.filter((c) => c.marker_group === 'at_risk').length;
    const avgOpp =
      filteredCustomers.length > 0
        ? (
            filteredCustomers.reduce((s, c) => s + c.geographic_opportunity_score, 0) /
            filteredCustomers.length
          ).toFixed(1)
        : '0.0';

    const segs = [
      'High-Value Loyal',
      'Growth Potential',
      'Core Active',
      'At-Risk Retention',
      'New Onboarding',
    ].map((segment) => {
      const count = filteredCustomers.filter((c) => c.customer_segment === segment).length;
      return {
        segment,
        count,
        sharePct:
          filteredCustomers.length > 0
            ? Number(((count / filteredCustomers.length) * 100).toFixed(1))
            : 0,
      };
    });

    const priorityAccounts = [...filteredCustomers]
      .sort((a, b) => b.churn_risk - a.churn_risk || b.lifetime_value - a.lifetime_value)
      .slice(0, 5);

    return { totalLtv, atRisk, avgOpp, segs, priorityAccounts };
  }, [filteredCustomers]);

  const competitorAnalysis = useMemo(() => {
    if (!selectedCompetitor) return null;
    const nearestDealer = allDealers
      .map((d) => ({
        dealer: d,
        distKm: Number(
          haversineDistanceKm(
            selectedCompetitor.latitude,
            selectedCompetitor.longitude,
            d.latitude,
            d.longitude
          ).toFixed(2)
        ),
      }))
      .sort((a, b) => a.distKm - b.distKm)[0];

    const selectedDealerDist = selectedDealer
      ? Number(
          haversineDistanceKm(
            selectedCompetitor.latitude,
            selectedCompetitor.longitude,
            selectedDealer.latitude,
            selectedDealer.longitude
          ).toFixed(2)
        )
      : null;

    const within3km = filteredCustomers.filter(
      (c) =>
        haversineDistanceKm(
          selectedCompetitor.latitude,
          selectedCompetitor.longitude,
          c.latitude,
          c.longitude
        ) <= 3
    );
    const within5km = filteredCustomers.filter(
      (c) =>
        haversineDistanceKm(
          selectedCompetitor.latitude,
          selectedCompetitor.longitude,
          c.latitude,
          c.longitude
        ) <= 5
    );
    const atRiskNear = within5km.filter((c) => c.marker_group === 'at_risk').length;

    return {
      nearestDealer,
      selectedDealerDist,
      within3kmCount: within3km.length,
      within5kmCount: within5km.length,
      atRiskNear,
    };
  }, [selectedCompetitor, allDealers, selectedDealer, filteredCustomers]);

  const tabs: Array<{ id: ContextPanelTab; label: string }> = [
    { id: 'territory', label: 'Territory' },
    { id: 'dealer', label: 'Dealer' },
    { id: 'customer', label: 'Customer' },
    { id: 'competitor', label: 'Competitor' },
    { id: 'opportunity', label: 'Opp & Gap' },
    { id: 'selection', label: 'Selection' },
  ];

  return (
    <aside
      data-testid="geo-context-drawer"
      aria-label="Geospatial Context Panel"
      className={`flex w-full shrink-0 flex-col border-t border-slate-200 bg-white lg:w-[348px] lg:border-l lg:border-t-0 xl:w-[364px] ${
        isFullscreen
          ? 'lg:h-[calc(100vh-172px)] lg:min-h-[520px]'
          : 'lg:h-[calc(100vh-196px)] lg:min-h-[520px]'
      }`}
    >
      {/* Drawer Header with Collapse Control */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-[#102B4D]">
            {activeTab === 'customer'
              ? 'Customer Intelligence Drawer'
              : activeTab === 'dealer'
                ? `${geoConfig.dealerLabel} Coverage Drawer`
                : activeTab === 'competitor'
                  ? 'Competitor Proximity Drawer'
                  : activeTab === 'opportunity'
                    ? 'Market Opportunity & Gap'
                    : activeTab === 'selection'
                      ? 'Spatial Audience Selection'
                      : 'Territory Details'}
          </div>
          <div className="truncate text-[10.5px] text-slate-500">{activeTerritoryTitle}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse Territory Details panel"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dynamic Context Switcher */}
      <div
        role="tablist"
        aria-label="Context panel views"
        className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 p-1.5 sm:grid-cols-6 lg:grid-cols-3"
      >
        {tabs.map((t) => {
          const hasIndicator =
            (t.id === 'selection' && Boolean(selectionSummary)) ||
            (t.id === 'customer' && Boolean(selectedCustomer)) ||
            (t.id === 'dealer' && Boolean(selectedDealer)) ||
            (t.id === 'competitor' && Boolean(selectedCompetitor));
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => onChangeTab(t.id)}
              className={`relative rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[#102B4D] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
              {hasIndicator && activeTab !== t.id && (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#16A6BD]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Scrollable Context Body */}
      <div className="flex-1 overflow-y-auto p-3.5 text-xs">
        {/* 1. TERRITORY ANALYTICS */}
        {activeTab === 'territory' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#1769AA]">Territory Analytics</span>
                <span className="text-slate-400">{provinceName}</span>
              </div>
              <h3 className="mt-0.5 text-base font-bold text-[#102B4D]">{activeTerritoryTitle}</h3>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <dt className="text-[10.5px] text-slate-500">Matched {geoConfig.customerPlural}</dt>
                <dd className="mt-0.5 font-mono text-base font-bold text-[#102B4D] tabular-nums">
                  {formatNumber(filteredCustomers.length)}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">Cumulative LTV</dt>
                <dd className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                  {formatIdrCompact(territoryStats.totalLtv)}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">At-Risk Accounts</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-[#D9534F] tabular-nums">
                  {formatNumber(territoryStats.atRisk)}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-slate-500">Avg Opportunity</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-[#16A6BD] tabular-nums">
                  {territoryStats.avgOpp} / 100
                </dd>
              </div>
            </dl>

            {/* Customer-to-Dealer Network Summary Insights */}
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#102B4D]">
                  Customer-to-{geoConfig.dealerLabel} Coverage
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {customerToDealerInsights.threshold_km} km straight-line
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-emerald-50 p-2">
                  <div className="text-[10px] text-emerald-700">Within Coverage</div>
                  <div className="font-mono text-sm font-bold text-emerald-900">
                    {formatNumber(customerToDealerInsights.near_dealer_count)}
                  </div>
                </div>
                <div className="rounded bg-amber-50 p-2">
                  <div className="text-[10px] text-amber-800">Outside Coverage</div>
                  <div className="font-mono text-sm font-bold text-amber-900">
                    {formatNumber(customerToDealerInsights.outside_coverage_count)}
                  </div>
                </div>
                <div className="rounded bg-slate-50 p-2">
                  <div className="text-[10px] text-slate-600">Non-Nearest Assigned</div>
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {formatNumber(customerToDealerInsights.assigned_non_nearest_count)}
                  </div>
                </div>
                <div className="rounded bg-sky-50 p-2">
                  <div className="text-[10px] text-sky-800">Overlapping Catchment</div>
                  <div className="font-mono text-sm font-bold text-sky-900">
                    {formatNumber(customerToDealerInsights.overlapping_catchment_count)}
                  </div>
                </div>
              </div>
            </div>

            {/* Segment Drill-down */}
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-800">Segment Breakdown</span>
                <span className="text-[10px] text-slate-400">
                  {canViewIndividualCustomers ? 'Click -> Customer Intel' : 'Aggregated Only'}
                </span>
              </div>
              <div className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200 px-2.5">
                {territoryStats.segs.map((seg) => (
                  <button
                    key={seg.segment}
                    type="button"
                    disabled={seg.count === 0 || !canViewIndividualCustomers}
                    onClick={() => onOpenSegmentInCustomerIntel(seg.segment)}
                    className="flex w-full items-center justify-between py-2 text-left text-[11.5px] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="font-medium text-slate-800">{seg.segment}</span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-slate-700">
                      {seg.count} ({seg.sharePct}%)
                      {canViewIndividualCustomers && <ArrowRight className="h-3 w-3 text-[#1769AA]" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Inspect Accounts (RBAC-Gated) */}
            {canViewIndividualCustomers ? (
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800">
                    Priority Accounts (Pseudonymous)
                  </span>
                  <span className="text-[10px] text-slate-400">Highest Churn Risk</span>
                </div>
                <div className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200 px-2.5">
                  {territoryStats.priorityAccounts.map((cust) => (
                    <div key={cust.customer_id} className="flex items-center justify-between py-2">
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(cust.customer_id)}
                        className="min-w-0 flex-1 pr-2 text-left hover:text-[#1769AA]"
                      >
                        <div className="font-mono text-[11.5px] font-semibold text-[#102B4D]">
                          {cust.pseudonym_code}{' '}
                          <span className="font-sans text-[10px] font-normal text-slate-500">
                            · {cust.nearest_dealer_distance_km} km
                          </span>
                        </div>
                        <div className="truncate text-[10.5px] text-slate-500">
                          {cust.customer_segment} · Risk {cust.churn_risk}/100
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCustomer360(cust.customer_id)}
                        className="shrink-0 text-[11px] font-semibold text-[#1769AA] hover:underline"
                      >
                        360
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Lock className="h-3.5 w-3.5" />
                  Customer-Level Privacy Mask Active
                </div>
                <p className="mt-1 leading-snug">
                  Your current role sees aggregated territory clusters, heatmaps, and opportunity
                  summaries only. Individual customer records require <code>customers.view</code>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 2. CUSTOMER DETAIL PANEL (RBAC-PROTECTED, PSEUDONYMOUS) */}
        {activeTab === 'customer' && (
          <div className="space-y-4">
            {!canViewIndividualCustomers ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4 shrink-0" />
                  Restricted: Aggregated Access Only
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed">
                  Individual customer spatial coordinates and profiles are masked for your current
                  role to enforce enterprise privacy governance. Use Territory Analytics, Clusters,
                  or Heatmaps instead.
                </p>
              </div>
            ) : !selectedCustomer ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-500">
                <MapPin className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 font-medium text-slate-700">No Customer Point Selected</p>
                <p className="mt-1 text-[11px]">
                  Zoom to level 12+ and click any color-coded customer marker on the map, or select
                  a priority account from the Territory tab.
                </p>
                {filteredCustomers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const outsideAtRisk =
                        filteredCustomers.find(
                          (c) =>
                            c.marker_group === 'at_risk' &&
                            c.nearest_dealer_distance_km > coverageRadiusKm
                        ) ?? filteredCustomers[0];
                      onSelectCustomer(outsideAtRisk.customer_id);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#102B4D]"
                  >
                    Inspect Sample At-Risk {geoConfig.customerLabel}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10.5px] font-semibold text-[#1769AA]">
                      Pseudonymous {geoConfig.customerLabel} Profile
                    </span>
                    <h3 className="mt-0.5 font-mono text-base font-bold text-[#102B4D]">
                      {selectedCustomer.pseudonym_code}
                    </h3>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {selectedCustomer.customer_segment} · {selectedCustomer.lifecycle_stage}
                    </div>
                  </div>
                  <span
                    className="rounded px-2 py-0.5 text-[10.5px] font-semibold text-white"
                    style={{
                      backgroundColor: MARKER_GROUP_META[selectedCustomer.marker_group].color,
                    }}
                  >
                    {MARKER_GROUP_META[selectedCustomer.marker_group].shortLabel}
                  </span>
                </div>

                {/* AI Risk & Opportunity Indicators */}
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="text-[10.5px] text-slate-500">AI Churn Risk (Sim)</div>
                    <div
                      className={`mt-0.5 font-mono text-base font-bold ${
                        selectedCustomer.churn_risk_category === 'High'
                          ? 'text-[#D9534F]'
                          : selectedCustomer.churn_risk_category === 'Medium'
                            ? 'text-amber-700'
                            : 'text-[#15946A]'
                      }`}
                    >
                      {selectedCustomer.churn_risk} / 100
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500">Purchase Propensity</div>
                    <div className="mt-0.5 font-mono text-base font-bold text-[#1769AA]">
                      {selectedCustomer.purchase_propensity} / 100
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500">Lifetime Value</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                      {formatIdrCompact(selectedCustomer.lifetime_value)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10.5px] text-slate-500">Primary Holding</div>
                    <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-800">
                      {selectedCustomer.product_primary}
                    </div>
                  </div>
                </div>

                {/* Customer-to-Dealer Spatial Relationship */}
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#102B4D]">
                      {geoConfig.customerLabel}-to-{geoConfig.dealerLabel} Intelligence
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        selectedCustomer.nearest_dealer_distance_km <= coverageRadiusKm
                          ? 'text-[#15946A]'
                          : 'text-[#D9534F]'
                      }`}
                    >
                      {selectedCustomer.nearest_dealer_distance_km <= coverageRadiusKm
                        ? `Inside ${coverageRadiusKm} km`
                        : `Outside ${coverageRadiusKm} km`}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Assigned {geoConfig.dealerLabel}:</span>
                      <span className="text-right font-medium text-slate-900">
                        {selectedCustomer.assigned_dealer_name} (
                        <span className="font-mono">
                          {selectedCustomer.assigned_dealer_distance_km} km
                        </span>
                        )
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nearest Available:</span>
                      <span className="text-right font-medium text-[#15946A]">
                        {selectedCustomer.nearest_dealer_name} (
                        <span className="font-mono">
                          {selectedCustomer.nearest_dealer_distance_km} km
                        </span>
                        )
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Latest Interaction:</span>
                      <span className="text-right text-slate-800">
                        {selectedCustomer.latest_interaction_summary}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Travel Time Estimate:</span>
                      <span className="text-right text-slate-500 italic">
                        Unavailable (Routing API not configured)
                      </span>
                    </div>
                  </div>

                  <label className="mt-2 flex items-center gap-2 rounded bg-[#F0F7FC] p-2 text-[11px] font-medium text-[#102B4D]">
                    <input
                      type="checkbox"
                      checked={showCustomerToDealerLine}
                      onChange={(e) => onToggleCustomerToDealerLine(e.target.checked)}
                      className="rounded border-slate-300 text-[#1769AA]"
                    />
                    <span>Show Customer-to-Dealer Connection</span>
                  </label>
                  <p className="text-[10px] leading-snug text-slate-500">
                    Straight-line geographic relationship (Haversine WGS-84) — not a road route.
                    Synthetic demo coordinate ({selectedCustomer.latitude.toFixed(4)},{' '}
                    {selectedCustomer.longitude.toFixed(4)}).
                  </p>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCustomer360(selectedCustomer.customer_id)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1769AA] px-3 text-xs font-semibold text-white hover:bg-[#102B4D]"
                  >
                    <Users className="h-3.5 w-3.5" />
                    View Customer 360
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenCustomerPrediction(selectedCustomer.customer_id)}
                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#16A6BD]" />
                    Inspect AI Risk Drivers
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. DEALER PERFORMANCE & SERVICE COVERAGE CATCHMENT */}
        {activeTab === 'dealer' && (
          <div className="space-y-4">
            {/* Dealer Selector */}
            <div>
              <label htmlFor="dealer-context-select" className="block text-[11px] font-semibold text-[#1769AA]">
                Active {geoConfig.dealerLabel} / {geoConfig.serviceLabel}
              </label>
              <select
                id="dealer-context-select"
                value={selectedDealer?.dealer_id ?? ''}
                onChange={(e) => onSelectDealer(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-[#102B4D] focus:border-[#1769AA] focus:outline-none"
              >
                {allDealers.map((d) => (
                  <option key={d.dealer_id} value={d.dealer_id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {selectedDealer && (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#102B4D]">{selectedDealer.name}</div>
                      <div className="text-[10.5px] text-slate-500">
                        {selectedDealer.dealer_type} · {selectedDealer.region_name}
                      </div>
                    </div>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      {selectedDealer.operational_status}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2.5 text-center">
                    <div>
                      <dt className="text-[10px] text-slate-500">Assigned</dt>
                      <dd className="font-mono text-sm font-bold text-slate-900">
                        {formatNumber(selectedDealer.assigned_customers)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-500">Svc Vol/Mo</dt>
                      <dd className="font-mono text-sm font-bold text-[#1769AA]">
                        {formatNumber(selectedDealer.service_volume_monthly)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-500">Capacity</dt>
                      <dd className="font-mono text-sm font-bold text-[#15946A]">
                        {selectedDealer.service_capacity_pct}%
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Coverage Mode Switcher: Mode A (Radius) vs Mode B (Drive-Time Honest Unavailable) */}
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#102B4D]">
                      Service Coverage Catchment
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setCoverageMode('radius')}
                      className={`rounded-md py-1 text-[11px] font-semibold transition-colors ${
                        coverageMode === 'radius'
                          ? 'bg-white text-[#102B4D] shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Mode A: Radius
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverageMode('drivetime')}
                      className={`rounded-md py-1 text-[11px] font-semibold transition-colors ${
                        coverageMode === 'drivetime'
                          ? 'bg-white text-[#102B4D] shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Mode B: Drive-Time
                    </button>
                  </div>

                  {coverageMode === 'radius' ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between text-[10.5px] text-slate-600">
                        <span>Straight-Line Distance Radius</span>
                        <span className="font-mono font-semibold text-[#16A6BD]">
                          {coverageRadiusKm} km
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {RADIUS_PRESETS.map((km) => (
                          <button
                            key={km}
                            type="button"
                            onClick={() => {
                              onChangeCoverageRadiusKm(km);
                              setCustomRadiusInput(String(km));
                            }}
                            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                              coverageRadiusKm === km
                                ? 'border-[#1769AA] bg-[#1769AA] text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {km} km
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label htmlFor="custom-radius-km" className="text-[10.5px] text-slate-500">
                          Custom (km):
                        </label>
                        <input
                          id="custom-radius-km"
                          type="number"
                          min={0.5}
                          max={60}
                          step={0.5}
                          value={customRadiusInput}
                          onChange={(e) => setCustomRadiusInput(e.target.value)}
                          className="h-7 w-20 rounded border border-slate-300 px-2 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = Number(customRadiusInput);
                            if (Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 60) {
                              onChangeCoverageRadiusKm(parsed);
                            }
                          }}
                          className="h-7 rounded border border-slate-300 bg-slate-50 px-2 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Apply
                        </button>
                      </div>

                      {activeCoverage && (
                        <div className="space-y-2 border-t border-slate-100 pt-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded bg-emerald-50 p-2">
                              <div className="text-[10px] text-emerald-700">Inside {coverageRadiusKm} km</div>
                              <div
                                data-testid="coverage-inside-count"
                                className="font-mono text-base font-bold text-emerald-900"
                              >
                                {formatNumber(activeCoverage.inside_count)}
                              </div>
                            </div>
                            <div className="rounded bg-slate-100 p-2">
                              <div className="text-[10px] text-slate-600">Outside {coverageRadiusKm} km</div>
                              <div
                                data-testid="coverage-outside-count"
                                className="font-mono text-base font-bold text-slate-900"
                              >
                                {formatNumber(activeCoverage.outside_count)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Coverage Rate (Active Scope):</span>
                              <span className="font-mono font-semibold text-[#102B4D]">
                                {activeCoverage.coverage_rate_pct}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Customer Value Inside:</span>
                              <span className="font-mono font-semibold text-slate-900">
                                {formatIdrCompact(activeCoverage.inside_ltv)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">At-Risk Inside Catchment:</span>
                              <span className="font-mono font-semibold text-[#D9534F]">
                                {formatNumber(activeCoverage.inside_at_risk_count)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Avg Straight-Line Distance:</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {activeCoverage.avg_distance_inside_km} km (inside)
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Overlapping Neighbor Units:</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {activeCoverage.overlapping_dealers.length}
                              </span>
                            </div>
                          </div>

                          {activeCoverage.overlapping_dealers.length > 0 && (
                            <div className="rounded bg-slate-50 p-2 text-[10.5px]">
                              <div className="font-semibold text-slate-700">
                                Catchment Overlap Details:
                              </div>
                              {activeCoverage.overlapping_dealers.slice(0, 3).map((ov) => (
                                <div key={ov.dealer_id} className="mt-0.5 flex justify-between text-slate-600">
                                  <span className="truncate pr-2">{ov.dealer_name}</span>
                                  <span className="shrink-0 font-mono">
                                    {ov.distance_km} km · {ov.shared_customer_count} shared
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* HONEST DRIVE-TIME UNAVAILABLE STATE (Never fakes radius as drive-time) */
                    <div className="mt-3 space-y-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {DRIVE_TIME_PRESETS.map((min) => (
                          <button
                            key={min}
                            type="button"
                            onClick={() => setSelectedDriveMin(min)}
                            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                              selectedDriveMin === min
                                ? 'border-slate-700 bg-slate-800 text-white'
                                : 'border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            {min} min
                          </button>
                        ))}
                      </div>

                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <Info className="h-4 w-4 shrink-0 text-amber-700" />
                          Drive-Time Analysis Unavailable
                        </div>
                        <p className="mt-1 leading-relaxed">
                          Real-time road network routing / isochrone API is not configured in this
                          environment, so a <strong>{selectedDriveMin}-minute drive-time polygon</strong>{' '}
                          is not simulated as a circle. Use <strong>Mode A: Radius Coverage</strong>{' '}
                          for verified straight-line distance catchment analysis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* View Dealer Analytics Expansion */}
                <button
                  type="button"
                  onClick={() => setShowDealerAnalyticsDetail((v) => !v)}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#1769AA] bg-white px-3 text-[11.5px] font-semibold text-[#1769AA] hover:bg-[#F0F7FC]"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {showDealerAnalyticsDetail ? 'Hide Dealer Analytics' : 'View Dealer Analytics'}
                </button>

                {showDealerAnalyticsDetail && activeCoverage && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] space-y-1.5">
                    <div className="font-semibold text-[#102B4D]">
                      Operational & Catchment Diagnostics
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Address (Synthetic):</span>
                      <span className="text-right text-slate-700">{selectedDealer.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">WGS-84 Coordinates:</span>
                      <span className="font-mono text-slate-800">
                        {selectedDealer.latitude.toFixed(4)}, {selectedDealer.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Dist (All Filtered):</span>
                      <span className="font-mono text-slate-800">
                        {activeCoverage.avg_distance_all_km} km
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 4. COMPETITOR PROXIMITY PANEL */}
        {activeTab === 'competitor' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10.5px] text-amber-900">
              <strong>Illustrative Synthetic Reference Data:</strong> Competitor locations are
              synthetic demo reference points. Do not treat as verified live competitor branches or
              inferred market share.
            </div>

            {!selectedCompetitor ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-700">
                  Illustrative Competitors in Scope ({competitors.length})
                </div>
                {competitors.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Competitor layer is currently hidden or none match this territory. Enable
                    Competitors in the Layers panel to inspect proximity.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {competitors.slice(0, 8).map((comp) => (
                      <button
                        key={comp.competitor_id}
                        type="button"
                        onClick={() => onChangeTab('competitor')}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-semibold text-slate-900">
                            {comp.location_name}
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            {comp.category_label} · {comp.region_name}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-amber-700">Sim</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              competitorAnalysis && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[10.5px] font-semibold text-amber-700">
                      {selectedCompetitor.category_label}
                    </span>
                    <h3 className="mt-0.5 text-sm font-bold text-[#102B4D]">
                      {selectedCompetitor.location_name}
                    </h3>
                    <div className="text-[11px] text-slate-500">
                      {selectedCompetitor.address}
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <dt className="text-[10px] text-slate-500">Nearest Tenant Unit</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-[#102B4D]">
                        {competitorAnalysis.nearestDealer
                          ? `${competitorAnalysis.nearestDealer.distKm} km`
                          : 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-500">Dist to Selected Unit</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-[#1769AA]">
                        {competitorAnalysis.selectedDealerDist !== null
                          ? `${competitorAnalysis.selectedDealerDist} km`
                          : 'Select dealer'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-500">Our Accounts &le; 3 km</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                        {formatNumber(competitorAnalysis.within3kmCount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-slate-500">At-Risk &le; 5 km</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-[#D9534F]">
                        {formatNumber(competitorAnalysis.atRiskNear)}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-1 rounded-lg border border-slate-200 p-3 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Closest Tenant Network Unit:</span>
                      <span className="text-right font-medium text-slate-900">
                        {competitorAnalysis.nearestDealer?.dealer.name ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Data Source:</span>
                      <span className="text-right text-amber-800">
                        {selectedCompetitor.location_source}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference Baseline:</span>
                      <span className="text-right text-slate-600">
                        {selectedCompetitor.last_verified_date}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* 5. OPPORTUNITY & GAP ANALYSIS */}
        {activeTab === 'opportunity' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#1769AA]">
                  Opportunity & Gap Analysis
                </span>
                <span className="font-mono text-[10px] text-slate-400">Illustrative Model</span>
              </div>
              <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                Configurable weighted spatial index (not a validated forecast). Adjust factor
                weights to reprioritize territory gaps.
              </p>
            </div>

            {/* Interactive Weight Sliders */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10.5px] font-semibold text-[#102B4D]">
                Scoring Formula Weights
              </div>
              {(
                [
                  { key: 'concentration', label: 'Customer Concentration' },
                  { key: 'growthPotential', label: 'Growth Potential' },
                  { key: 'atRiskDensity', label: 'At-Risk Density' },
                  { key: 'coverageGap', label: 'Dealer Coverage Gap' },
                  { key: 'competitorProximity', label: 'Competitor Proximity' },
                ] as const
              ).map((item) => (
                <div key={item.key} className="space-y-0.5">
                  <div className="flex justify-between text-[10.5px]">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {opportunityWeights[item.key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`${item.label} weight`}
                    min={0}
                    max={50}
                    step={5}
                    value={opportunityWeights[item.key]}
                    onChange={(e) =>
                      onUpdateOpportunityWeights({
                        ...opportunityWeights,
                        [item.key]: Number(e.target.value),
                      })
                    }
                    className="h-1.5 w-full accent-[#1769AA]"
                  />
                </div>
              ))}
            </div>

            {/* Ranked Zones A-E */}
            <div className="space-y-2.5">
              {opportunityZones.map((zone) => {
                const isSelected = selectedRegionId === zone.region_id;
                const badgeColor =
                  zone.category_code === 'C'
                    ? 'bg-red-100 text-red-800'
                    : zone.category_code === 'A'
                      ? 'bg-amber-100 text-amber-800'
                      : zone.category_code === 'B'
                        ? 'bg-sky-100 text-sky-900'
                        : zone.category_code === 'D'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-800';
                return (
                  <div
                    key={zone.region_id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isSelected ? 'border-[#1769AA] bg-[#F0F7FC]' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectRegion(zone.region_id)}
                        className="text-left font-semibold text-[#102B4D] hover:underline"
                      >
                        {zone.region_name}
                      </button>
                      <span className="font-mono text-sm font-bold text-[#16A6BD]">
                        {zone.composite_score}/100
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                        Zone {zone.category_code}: {zone.category}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cov {zone.coverage_rate_pct}%
                      </span>
                    </div>

                    <p className="mt-1.5 text-[10.5px] leading-snug text-slate-600">
                      {zone.explanation}
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="text-[10px] text-slate-400">{zone.data_coverage_status}</span>
                      <button
                        type="button"
                        onClick={() => onOpenNbaForRegion(zone.region_id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769AA] hover:underline"
                      >
                        View Recommended Business Action
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. SELECTED GEOGRAPHIC AREA AUDIENCE */}
        {activeTab === 'selection' && (
          <div className="space-y-4">
            {!selectionSummary ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-600">
                <Crosshair className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 font-semibold text-slate-800">No Geographic Area Selected</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Use the map toolbar above to draw a <strong>Rectangle</strong>,{' '}
                  <strong>Polygon</strong>, or <strong>Radius</strong> selection around any cluster
                  or gap zone to build a campaign target audience.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10.5px] font-semibold text-[#16A6BD]">
                      Map-Based Target Audience
                    </span>
                    <h3 className="mt-0.5 text-sm font-bold text-[#102B4D]">
                      {selectionSummary.label}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={onClearSelection}
                    aria-label="Clear geographic selection"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-2.5 rounded-lg border border-[#16A6BD]/30 bg-[#F0FAFC] p-3">
                  <div>
                    <dt className="text-[10px] text-slate-600">Matching {geoConfig.customerPlural}</dt>
                    <dd
                      data-testid="selection-matching-count"
                      className="mt-0.5 font-mono text-base font-bold text-[#102B4D]"
                    >
                      {formatNumber(selectionSummary.matching_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-600">Consent-Verified Eligible</dt>
                    <dd className="mt-0.5 font-mono text-base font-bold text-[#15946A]">
                      {formatNumber(selectionSummary.eligible_consented_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-600">Aggregated LTV</dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                      {formatIdrCompact(selectionSummary.total_ltv)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-600">At-Risk Accounts</dt>
                    <dd className="mt-0.5 font-mono text-sm font-bold text-[#D9534F]">
                      {formatNumber(selectionSummary.at_risk_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-600">Nearby Network Units</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                      {selectionSummary.nearby_dealers.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-600">Coverage / Competitors</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-800">
                      {selectionSummary.approx_coverage_rate_pct}% · {selectionSummary.nearby_competitors.length} comp
                    </dd>
                  </div>
                </dl>

                {/* Segment Distribution in Selected Area */}
                {selectionSummary.segment_distribution.length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-[11px] font-semibold text-slate-800">
                      Selected Area Segment Distribution
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {selectionSummary.segment_distribution.map((s) => (
                        <div key={s.segment} className="space-y-0.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-700">{s.segment}</span>
                            <span className="font-mono text-slate-800">
                              {s.count} ({s.sharePct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#1769AA]"
                              style={{ width: `${Math.min(100, s.sharePct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Activation Actions */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={selectionSummary.matching_count === 0 || !canCreateCampaign}
                    onClick={() => onCreateCampaignFromSelection(selectionSummary)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1769AA] px-3 text-xs font-semibold text-white hover:bg-[#102B4D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Create Target Audience
                  </button>

                  {!canCreateCampaign && (
                    <p className="text-[10px] text-amber-700">
                      Campaign creation requires <code>campaigns.create</code> permission.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!canViewIndividualCustomers}
                      onClick={() => onOpenSegmentInCustomerIntel('ALL')}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Users className="h-3 w-3" />
                      Customer Intel
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAiBriefing}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Sparkles className="h-3 w-3 text-[#16A6BD]" />
                      AI Recommend
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

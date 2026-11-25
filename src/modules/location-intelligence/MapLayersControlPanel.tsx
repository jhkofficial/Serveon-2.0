import React, { useState } from 'react';
import {
  Bookmark,
  Filter,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import type {
  CompetitorFilterMode,
  DealerNetworkNode,
  GeoFilterState,
  GeoLayerVisibility,
  IndustryGeoConfig,
  MapDisplayMode,
  SavedMapView,
} from '../../types/geospatial';
import { DEFAULT_GEO_FILTERS } from '../../core/geo/geospatialService';
import { formatNumber } from '../../core/analytics/kpiEngine';

interface MapLayersControlPanelProps {
  isOpen: boolean;
  activeTab: 'layers' | 'filters' | 'views';
  onChangeTab: (tab: 'layers' | 'filters' | 'views') => void;
  onClose: () => void;
  geoConfig: IndustryGeoConfig;
  layers: GeoLayerVisibility;
  onUpdateLayers: (patch: Partial<GeoLayerVisibility>) => void;
  filters: GeoFilterState;
  onUpdateFilters: (patch: Partial<GeoFilterState>) => void;
  onResetFilters: () => void;
  mapMode: MapDisplayMode;
  onChangeMapMode: (mode: MapDisplayMode) => void;
  heatmapIntensity: number;
  onChangeHeatmapIntensity: (val: number) => void;
  dealers: DealerNetworkNode[];
  productOptions: string[];
  provinceName: string;
  regencies: Array<{ id: string; name: string }>;
  districts: Array<{ id: string; name: string }>;
  villages: Array<{ id: string; name: string }>;
  selectedRegencyId: string;
  selectedDistrictId: string;
  selectedVillageId: string;
  onChangeGeoHierarchy: (patch: {
    regionId?: string;
    districtId?: string;
    villageId?: string;
  }) => void;
  counts: {
    customers: number;
    atRisk: number;
    highValue: number;
    dealers: number;
    serviceCenters: number;
    branches: number;
    competitors: number;
    outsideCoverage: number;
  };
  canViewIndividualCustomers: boolean;
  savedViews: SavedMapView[];
  onApplySavedView: (view: SavedMapView) => void;
  onSaveCurrentView: (name: string) => void;
}

export function MapLayersControlPanel({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  geoConfig,
  layers,
  onUpdateLayers,
  filters,
  onUpdateFilters,
  onResetFilters,
  mapMode,
  onChangeMapMode,
  heatmapIntensity,
  onChangeHeatmapIntensity,
  dealers,
  productOptions,
  provinceName,
  regencies,
  districts,
  villages,
  selectedRegencyId,
  selectedDistrictId,
  selectedVillageId,
  onChangeGeoHierarchy,
  counts,
  canViewIndividualCustomers,
  savedViews,
  onApplySavedView,
  onSaveCurrentView,
}: MapLayersControlPanelProps) {
  const [newViewName, setNewViewName] = useState('');

  if (!isOpen) return null;

  const isHeatmapMode =
    mapMode === 'heatmap_density' || mapMode === 'heatmap_value' || mapMode === 'heatmap_risk';

  return (
    <aside
      data-testid="floating-layers-panel"
      aria-label="Floating Map Layers and Filters"
      className="pointer-events-auto absolute left-3 top-[74px] z-[430] flex max-h-[calc(100%-122px)] w-[288px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-xl border border-slate-200/95 bg-white/95 shadow-lg backdrop-blur"
    >
      {/* Floating Panel Header + Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-2.5 py-2">
        <div role="tablist" aria-label="Floating map control sections" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'layers'}
            onClick={() => onChangeTab('layers')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'layers'
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="h-3 w-3" />
            Layers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'filters'}
            onClick={() => onChangeTab('filters')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'filters'
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Filter className="h-3 w-3" />
            Filters
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'views'}
            onClick={() => onChangeTab('views')}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'views'
                ? 'bg-[#102B4D] text-white'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Bookmark className="h-3 w-3" />
            Views
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close floating map panel"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable Floating Panel Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {activeTab === 'layers' && (
          <div className="space-y-4">
            {/* Heatmap Mode Metric + Intensity Control */}
            {isHeatmapMode && (
              <div className="space-y-2 rounded-lg border border-[#16A6BD]/30 bg-[#F0FAFC] p-2.5">
                <div className="text-[10.5px] font-semibold text-[#102B4D]">Heatmap Metric</div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'heatmap_density', label: 'Density' },
                      { id: 'heatmap_value', label: 'Value' },
                      { id: 'heatmap_risk', label: 'At-Risk' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeMapMode(m.id)}
                      className={`rounded py-1 text-[10.5px] font-semibold transition-colors ${
                        mapMode === m.id
                          ? 'bg-[#102B4D] text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#102B4D]">
                  <label htmlFor="heatmap-intensity">Intensity</label>
                  <span className="font-mono">{Math.round(heatmapIntensity * 100)}%</span>
                </div>
                <input
                  id="heatmap-intensity"
                  type="range"
                  min={0.4}
                  max={1.6}
                  step={0.1}
                  value={heatmapIntensity}
                  onChange={(e) => onChangeHeatmapIntensity(Number(e.target.value))}
                  className="w-full accent-[#1769AA]"
                />
                <p className="text-[10px] leading-snug text-slate-600">
                  Aggregated spatial density derived from authorized filtered dataset.
                </p>
              </div>
            )}

            {/* 1. CUSTOMERS */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Customers ({formatNumber(counts.customers)})
              </div>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.customerPoints && canViewIndividualCustomers}
                      disabled={!canViewIndividualCustomers}
                      onChange={(e) => onUpdateLayers({ customerPoints: e.target.checked })}
                      className="rounded border-slate-300 text-[#1769AA] disabled:opacity-40"
                    />
                    <span>Individual Points (Zoom 12+)</span>
                  </span>
                  {!canViewIndividualCustomers ? (
                    <Lock className="h-3 w-3 text-amber-600" />
                  ) : (
                    <span className="font-mono text-[10.5px] text-slate-500">{counts.customers}</span>
                  )}
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.customerClusters}
                      onChange={(e) => onUpdateLayers({ customerClusters: e.target.checked })}
                      className="rounded border-slate-300 text-[#1769AA]"
                    />
                    <span>Smart Zoom Clusters</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-500">Auto</span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.atRiskHighlight}
                      onChange={(e) => onUpdateLayers({ atRiskHighlight: e.target.checked })}
                      className="rounded border-slate-300 text-[#D9534F]"
                    />
                    <span>At-Risk {geoConfig.customerPlural}</span>
                  </span>
                  <span className="font-mono text-[10.5px] font-semibold text-[#D9534F]">
                    {counts.atRisk}
                  </span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.highValueHighlight}
                      onChange={(e) => onUpdateLayers({ highValueHighlight: e.target.checked })}
                      className="rounded border-slate-300 text-[#15946A]"
                    />
                    <span>High-Value Loyal</span>
                  </span>
                  <span className="font-mono text-[10.5px] font-semibold text-[#15946A]">
                    {counts.highValue}
                  </span>
                </label>
              </div>
            </div>

            {/* 2. BUSINESS NETWORK */}
            <div className="border-t border-slate-100 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Business Network
              </div>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.dealers}
                      onChange={(e) => onUpdateLayers({ dealers: e.target.checked })}
                      className="rounded border-slate-300 text-[#15946A]"
                    />
                    <span>{geoConfig.dealerPlural}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-500">{counts.dealers}</span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.serviceCenters}
                      onChange={(e) => onUpdateLayers({ serviceCenters: e.target.checked })}
                      className="rounded border-slate-300 text-[#0D9488]"
                    />
                    <span>{geoConfig.servicePlural}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-500">
                    {counts.serviceCenters}
                  </span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.branches}
                      onChange={(e) => onUpdateLayers({ branches: e.target.checked })}
                      className="rounded border-slate-300 text-[#102B4D]"
                    />
                    <span>Branch Offices</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-500">{counts.branches}</span>
                </label>
              </div>
            </div>

            {/* 3. COMPETITORS (Illustrative Synthetic) */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Competitors (Illustrative)
                </span>
                <span className="font-mono text-[10.5px] text-amber-700">{counts.competitors}</span>
              </div>
              <select
                aria-label="Competitor layer filter"
                value={layers.competitorMode}
                onChange={(e) =>
                  onUpdateLayers({ competitorMode: e.target.value as CompetitorFilterMode })
                }
                className="mt-1.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-[#1769AA] focus:outline-none"
              >
                <option value="all">Show All Competitors</option>
                <option value="dealer">Show {geoConfig.competitorDealerLabel}s</option>
                <option value="service">Show {geoConfig.competitorServiceLabel}s</option>
                <option value="none">Hide Competitors</option>
              </select>
            </div>

            {/* 4. COVERAGE */}
            <div className="border-t border-slate-100 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Coverage & Connections
              </div>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.coverageRadius}
                      onChange={(e) => onUpdateLayers({ coverageRadius: e.target.checked })}
                      className="rounded border-slate-300 text-[#16A6BD]"
                    />
                    <span>Radius Catchment (Straight-Line)</span>
                  </span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.uncoveredHighlight}
                      disabled={!canViewIndividualCustomers}
                      onChange={(e) => onUpdateLayers({ uncoveredHighlight: e.target.checked })}
                      className="rounded border-slate-300 text-amber-600 disabled:opacity-40"
                    />
                    <span>Uncovered Gap Highlight</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-amber-700">
                    {counts.outsideCoverage}
                  </span>
                </label>

                <label className="flex items-center justify-between gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.customerToDealerLines}
                      disabled={!canViewIndividualCustomers}
                      onChange={(e) => onUpdateLayers({ customerToDealerLines: e.target.checked })}
                      className="rounded border-slate-300 text-[#1769AA] disabled:opacity-40"
                    />
                    <span>Customer-to-Dealer Line</span>
                  </span>
                </label>
              </div>
            </div>

            {/* 5. MARKET INTELLIGENCE */}
            <div className="border-t border-slate-100 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Market Intelligence
              </div>
              <div className="mt-2 space-y-1.5">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.territoryBoundaries}
                    onChange={(e) => onUpdateLayers({ territoryBoundaries: e.target.checked })}
                    className="rounded border-slate-300 text-[#102B4D]"
                  />
                  <span>Territory Boundaries (Illustrative)</span>
                </label>
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={layers.opportunityOverlay}
                    onChange={(e) => onUpdateLayers({ opportunityOverlay: e.target.checked })}
                    className="rounded border-slate-300 text-[#15946A]"
                  />
                  <span>Opportunity & Gap Shading</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-800">
                Geographic & Customer Filters
              </span>
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1769AA] hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>

            {/* Cascading Geographic Hierarchy */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Territory Scope ({provinceName})
              </div>
              <div>
                <label htmlFor="geo-regency" className="block text-[10.5px] font-medium text-slate-600">
                  Regency / City
                </label>
                <select
                  id="geo-regency"
                  value={selectedRegencyId}
                  onChange={(e) =>
                    onChangeGeoHierarchy({
                      regionId: e.target.value,
                      districtId: 'ALL',
                      villageId: 'ALL',
                    })
                  }
                  className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-900"
                >
                  {regencies.length > 1 && (
                    <option value="ALL">All Permitted ({regencies.length})</option>
                  )}
                  {regencies.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label htmlFor="geo-district" className="block text-[10.5px] font-medium text-slate-600">
                    District
                  </label>
                  <select
                    id="geo-district"
                    value={selectedDistrictId}
                    disabled={districts.length === 0}
                    onChange={(e) =>
                      onChangeGeoHierarchy({ districtId: e.target.value, villageId: 'ALL' })
                    }
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="ALL">
                      {districts.length > 0 ? `All (${districts.length})` : 'Pick City'}
                    </option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="geo-village" className="block text-[10.5px] font-medium text-slate-600">
                    Village
                  </label>
                  <select
                    id="geo-village"
                    value={selectedVillageId}
                    disabled={villages.length === 0}
                    onChange={(e) => onChangeGeoHierarchy({ villageId: e.target.value })}
                    className="mt-0.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="ALL">
                      {villages.length > 0 ? `All (${villages.length})` : 'Pick District'}
                    </option>
                    {villages.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="flt-segment" className="block text-[11px] font-medium text-slate-600">
                Customer Segment
              </label>
              <select
                id="flt-segment"
                value={filters.segment}
                onChange={(e) => onUpdateFilters({ segment: e.target.value })}
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Segments</option>
                <option value="High-Value Loyal">High-Value Loyal</option>
                <option value="Growth Potential">Growth Potential</option>
                <option value="Core Active">Core Active</option>
                <option value="At-Risk Retention">At-Risk Retention</option>
                <option value="New Onboarding">New Onboarding</option>
              </select>
            </div>

            <div>
              <label htmlFor="flt-risk" className="block text-[11px] font-medium text-slate-600">
                Churn Risk Level
              </label>
              <select
                id="flt-risk"
                value={filters.churnRisk}
                onChange={(e) =>
                  onUpdateFilters({ churnRisk: e.target.value as GeoFilterState['churnRisk'] })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="High">High Churn Risk</option>
                <option value="Medium">Medium Churn Risk</option>
                <option value="Low">Low Churn Risk</option>
              </select>
            </div>

            <div>
              <label htmlFor="flt-service" className="block text-[11px] font-medium text-slate-600">
                {geoConfig.serviceStatusLabel}
              </label>
              <select
                id="flt-service"
                value={filters.serviceStatus}
                onChange={(e) =>
                  onUpdateFilters({
                    serviceStatus: e.target.value as GeoFilterState['serviceStatus'],
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Recency Bands</option>
                <option value="Current">Current (&le; 45 days)</option>
                <option value="Due Soon">Due Soon (46–90 days)</option>
                <option value="Overdue">Overdue (&gt; 90 days)</option>
              </select>
            </div>

            <div>
              <label htmlFor="flt-purchase" className="block text-[11px] font-medium text-slate-600">
                Purchase Recency
              </label>
              <select
                id="flt-purchase"
                value={filters.purchaseStatus}
                onChange={(e) =>
                  onUpdateFilters({
                    purchaseStatus: e.target.value as GeoFilterState['purchaseStatus'],
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Purchase Statuses</option>
                <option value="Recent">Recent (&le; 45 days)</option>
                <option value="Standard">Standard (46–120 days)</option>
                <option value="Lapsed">Lapsed (&gt; 120 days)</option>
              </select>
            </div>

            <div>
              <label htmlFor="flt-value" className="block text-[11px] font-medium text-slate-600">
                Customer Value Tier (LTV)
              </label>
              <select
                id="flt-value"
                value={filters.valueTier}
                onChange={(e) =>
                  onUpdateFilters({ valueTier: e.target.value as GeoFilterState['valueTier'] })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All LTV Tiers</option>
                <option value="High">Top 30% High Value</option>
                <option value="Mid">Mid Value Tier</option>
                <option value="Standard">Standard Value Tier</option>
              </select>
            </div>

            <div>
              <label htmlFor="flt-product" className="block text-[11px] font-medium text-slate-600">
                {geoConfig.productFilterLabel}
              </label>
              <select
                id="flt-product"
                value={filters.productOwnership}
                onChange={(e) => onUpdateFilters({ productOwnership: e.target.value })}
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Products ({productOptions.length})</option>
                {productOptions.map((prod) => (
                  <option key={prod} value={prod}>
                    {prod}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="flt-dealer" className="block text-[11px] font-medium text-slate-600">
                Assigned {geoConfig.dealerLabel}
              </label>
              <select
                id="flt-dealer"
                value={filters.assignedDealerId}
                onChange={(e) => onUpdateFilters({ assignedDealerId: e.target.value })}
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Network Units ({dealers.length})</option>
                {dealers.map((d) => (
                  <option key={d.dealer_id} value={d.dealer_id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="flt-geo-status" className="block text-[11px] font-medium text-slate-600">
                Geolocation Quality Status
              </label>
              <select
                id="flt-geo-status"
                value={filters.geolocationStatus}
                onChange={(e) =>
                  onUpdateFilters({
                    geolocationStatus: e.target.value as GeoFilterState['geolocationStatus'],
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-800"
              >
                <option value="ALL">All Geolocation Statuses</option>
                <option value="SIMULATED_VALID_LAND_POINT">Simulated Valid Land Point</option>
                <option value="VERIFIED_ADDRESS">Verified Address</option>
                <option value="VERIFIED_POINT">Verified Point</option>
                <option value="APPROXIMATE_LOCATION">Approximate Location</option>
                <option value="INVALID_LOCATION">Invalid Location (Quarantined)</option>
                <option value="NOT_GEOCODED">Not Geocoded (Unmapped)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-900">
              <input
                type="checkbox"
                checked={filters.onlyOutsideCoverage}
                onChange={(e) => onUpdateFilters({ onlyOutsideCoverage: e.target.checked })}
                className="rounded border-amber-400 text-amber-700"
              />
              <span>Only Outside Coverage Radius ({counts.outsideCoverage})</span>
            </label>

            {JSON.stringify(filters) !== JSON.stringify(DEFAULT_GEO_FILTERS) && (
              <div className="text-[10.5px] text-slate-500">
                Showing <strong className="font-mono text-slate-800">{counts.customers}</strong>{' '}
                matching {geoConfig.customerPlural.toLowerCase()}.
              </div>
            )}
          </div>
        )}

        {activeTab === 'views' && (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-slate-800">Saved Map Views</div>
            <div className="space-y-2">
              {savedViews.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onApplySavedView(v)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-left transition-colors hover:border-[#1769AA] hover:bg-[#F0F7FC]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-[#102B4D]">{v.name}</span>
                    {v.isPreset && (
                      <span className="font-mono text-[9.5px] text-slate-400">PRESET</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-slate-600">
                    {v.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3">
              <label htmlFor="save-view-input" className="block text-[11px] font-semibold text-slate-700">
                Save Current Map View
              </label>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  id="save-view-input"
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g. Semarang Outer At-Risk"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-[11px] text-slate-800 focus:border-[#1769AA] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newViewName.trim()) return;
                    onSaveCurrentView(newViewName.trim());
                    setNewViewName('');
                  }}
                  aria-label="Save current map view"
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1769AA] px-2.5 text-[11px] font-semibold text-white hover:bg-[#102B4D]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

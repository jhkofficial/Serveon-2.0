import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Circle,
  Compass,
  Crosshair,
  Filter,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pentagon,
  Radar,
  RotateCcw,
  Ruler,
  Search,
  Square,
  Target,
  Users,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { formatNumber } from '../../core/analytics/kpiEngine';
import { hasPermission } from '../../core/permissions/rbac';
import {
  buildGeocodedCustomers,
  buildPresetSavedViews,
  buildTenantCompetitors,
  buildTenantDealerNetwork,
  computeCustomerToDealerInsights,
  computeDealerCoverage,
  computeOpportunityGapZones,
  DEFAULT_GEO_FILTERS,
  DEFAULT_OPPORTUNITY_WEIGHTS,
  evaluateGeoSelection,
  filterCompetitors,
  filterGeocodedCustomers,
  getIndustryGeoConfig,
} from '../../core/geo/geospatialService';
import type {
  DrawingToolMode,
  GeoFilterState,
  GeoLayerVisibility,
  GeoSelectionGeometry,
  MapDisplayMode,
  OpportunityWeights,
  SavedMapView,
} from '../../types/geospatial';
import { AdvancedLeafletMap } from './AdvancedLeafletMap';
import { MapLayersControlPanel } from './MapLayersControlPanel';
import { GeoContextPanel, type ContextPanelTab } from './GeoContextPanel';
import { GuidedGeoDemoBar } from './GuidedGeoDemoBar';

const DEFAULT_LAYERS: GeoLayerVisibility = {
  customerPoints: true,
  customerClusters: true,
  atRiskHighlight: false,
  highValueHighlight: false,
  dealers: true,
  serviceCenters: true,
  branches: true,
  competitorMode: 'all',
  coverageRadius: true,
  uncoveredHighlight: false,
  customerToDealerLines: true,
  territoryBoundaries: true,
  opportunityOverlay: true,
};

export function LocationIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    persona,
    scopedCustomers,
    permittedRegionIds,
    filters,
    geoDrilldown,
    setGeoDrilldown,
    openCustomersForTerritorySegment,
    openCustomer360,
    openCustomerPredictions,
    openCampaignStudioFromGeoSelection,
    navigateToRoute,
    setAiPanelOpen,
    mapFullscreen,
    setMapFullscreen,
    showToast,
  } = usePlatform();

  const canViewIndividualCustomers =
    hasPermission(persona, 'customers.view') && hasPermission(persona, 'customers.view_detail');
  const canCreateCampaign = hasPermission(persona, 'campaigns.create');

  const geoConfig = useMemo(
    () => getIndustryGeoConfig(activeIndustry.id),
    [activeIndustry.id]
  );

  // Core Map-First GIS UI state
  const [floatingPanelOpen, setFloatingPanelOpen] = useState(false);
  const [floatingPanelTab, setFloatingPanelTab] = useState<'layers' | 'filters' | 'views'>('layers');
  const [openToolbarMenu, setOpenToolbarMenu] = useState<'none' | 'coverage' | 'draw'>('none');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapDisplayMode>('points');
  const [heatmapVariant, setHeatmapVariant] = useState<
    'heatmap_density' | 'heatmap_value' | 'heatmap_risk'
  >('heatmap_risk');
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(1.0);
  const [layers, setLayers] = useState<GeoLayerVisibility>(DEFAULT_LAYERS);
  const [geoFilters, setGeoFilters] = useState<GeoFilterState>(DEFAULT_GEO_FILTERS);
  const [coverageRadiusKm, setCoverageRadiusKm] = useState<number>(geoConfig.defaultRadiusKm);
  const [customCoverageInput, setCustomCoverageInput] = useState<string>(
    String(geoConfig.defaultRadiusKm)
  );
  const [drawingTool, setDrawingTool] = useState<DrawingToolMode>('none');
  const [activeSelection, setActiveSelection] = useState<{
    geometry: GeoSelectionGeometry;
    label: string;
  } | null>(null);
  const [opportunityWeights, setOpportunityWeights] = useState<OpportunityWeights>(
    DEFAULT_OPPORTUNITY_WEIGHTS
  );
  const [contextTab, setContextTab] = useState<ContextPanelTab>('territory');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [fitCustomersSignal, setFitCustomersSignal] = useState(0);
  const [zoomTarget, setZoomTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    nonce: number;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(8);
  const [customViewsByTenant, setCustomViewsByTenant] = useState<Record<string, SavedMapView[]>>(
    {}
  );
  const [guidedDemoStep, setGuidedDemoStep] = useState<number | null>(null);

  // Reset tenant-scoped selections when active tenant changes (strict zero cross-tenant bleed)
  useEffect(() => {
    setSelectedCustomerId(null);
    setSelectedDealerId(null);
    setSelectedCompetitorId(null);
    setActiveSelection(null);
    setDrawingTool('none');
    setGeoFilters(DEFAULT_GEO_FILTERS);
    setCoverageRadiusKm(geoConfig.defaultRadiusKm);
    setCustomCoverageInput(String(geoConfig.defaultRadiusKm));
    setContextTab('territory');
    setDrawerOpen(false);
    setFloatingPanelOpen(false);
    setOpenToolbarMenu('none');
    setGuidedDemoStep(null);
    setZoomTarget(null);
  }, [activeTenant.id, geoConfig.defaultRadiusKm]);

  // Enforce RBAC privacy: if persona switches to one without customers.view, lock out individual points
  useEffect(() => {
    if (!canViewIndividualCustomers) {
      setSelectedCustomerId(null);
      if (contextTab === 'customer') {
        setContextTab('territory');
      }
      if (mapMode === 'points') {
        setMapMode('clusters');
      }
    }
  }, [canViewIndividualCustomers, contextTab, mapMode]);

  const selectedRegencyId = filters.regionId;
  const selectedDistrictId = geoDrilldown.districtId;
  const selectedVillageId = geoDrilldown.villageId;

  const permittedRegencies = useMemo(
    () => activeTenant.province.regencies.filter((r) => permittedRegionIds.includes(r.id)),
    [activeTenant, permittedRegionIds]
  );

  const activeRegency = permittedRegencies.find((r) => r.id === selectedRegencyId) ?? null;
  const districts = activeRegency ? activeRegency.districts : [];
  const activeDistrict = districts.find((d) => d.id === selectedDistrictId) ?? null;
  const villages = activeDistrict ? activeDistrict.villages : [];

  // 1. Build deterministic tenant-scoped geospatial datasets
  const allDealers = useMemo(
    () =>
      buildTenantDealerNetwork(
        activeTenant,
        activeIndustry.id,
        permittedRegionIds,
        scopedCustomers
      ),
    [activeTenant, activeIndustry.id, permittedRegionIds, scopedCustomers]
  );

  const allGeocodedCustomers = useMemo(
    () => buildGeocodedCustomers(activeTenant, scopedCustomers, allDealers),
    [activeTenant, scopedCustomers, allDealers]
  );

  const allCompetitors = useMemo(
    () => buildTenantCompetitors(activeTenant, activeIndustry.id, permittedRegionIds),
    [activeTenant, activeIndustry.id, permittedRegionIds]
  );

  // Default selected dealer to primary regency dealer
  const effectiveSelectedDealer = useMemo(() => {
    if (selectedDealerId) {
      const exact = allDealers.find((d) => d.dealer_id === selectedDealerId);
      if (exact) return exact;
    }
    if (selectedRegencyId !== 'ALL') {
      const inReg = allDealers.find((d) => d.region_id === selectedRegencyId);
      if (inReg) return inReg;
    }
    return allDealers[0] ?? null;
  }, [allDealers, selectedDealerId, selectedRegencyId]);

  const visibleDealers = useMemo(() => {
    return allDealers.filter((d) => {
      if (selectedRegencyId !== 'ALL' && d.region_id !== selectedRegencyId) return false;
      return true;
    });
  }, [allDealers, selectedRegencyId]);

  const filteredCustomers = useMemo(
    () =>
      filterGeocodedCustomers(
        allGeocodedCustomers,
        {
          regionId: selectedRegencyId,
          districtId: selectedDistrictId,
          villageId: selectedVillageId,
        },
        geoFilters,
        coverageRadiusKm
      ),
    [
      allGeocodedCustomers,
      selectedRegencyId,
      selectedDistrictId,
      selectedVillageId,
      geoFilters,
      coverageRadiusKm,
    ]
  );

  const visibleCompetitors = useMemo(
    () => filterCompetitors(allCompetitors, layers.competitorMode, selectedRegencyId),
    [allCompetitors, layers.competitorMode, selectedRegencyId]
  );

  const productOptions = useMemo(() => {
    const set = new Set(allGeocodedCustomers.map((c) => c.product_primary));
    return Array.from(set).sort();
  }, [allGeocodedCustomers]);

  // 2. Coverage Catchment & Customer-to-Dealer Intelligence
  const activeCoverage = useMemo(() => {
    if (!effectiveSelectedDealer) return null;
    return computeDealerCoverage(
      effectiveSelectedDealer,
      coverageRadiusKm,
      filteredCustomers,
      allDealers
    );
  }, [effectiveSelectedDealer, coverageRadiusKm, filteredCustomers, allDealers]);

  const customerToDealerInsights = useMemo(
    () => computeCustomerToDealerInsights(filteredCustomers, allDealers, coverageRadiusKm),
    [filteredCustomers, allDealers, coverageRadiusKm]
  );

  // 3. Opportunity & Gap Zones
  const opportunityZones = useMemo(
    () =>
      computeOpportunityGapZones(
        activeTenant,
        activeIndustry.id,
        permittedRegionIds,
        allGeocodedCustomers,
        allDealers,
        allCompetitors,
        coverageRadiusKm,
        opportunityWeights
      ),
    [
      activeTenant,
      activeIndustry.id,
      permittedRegionIds,
      allGeocodedCustomers,
      allDealers,
      allCompetitors,
      coverageRadiusKm,
      opportunityWeights,
    ]
  );

  // 4. Spatial Selection Evaluation
  const selectionSummary = useMemo(() => {
    if (!activeSelection) return null;
    return evaluateGeoSelection(
      activeSelection.geometry,
      activeSelection.label,
      filteredCustomers,
      allDealers,
      allCompetitors,
      coverageRadiusKm
    );
  }, [activeSelection, filteredCustomers, allDealers, allCompetitors, coverageRadiusKm]);

  const selectedCustomer = useMemo(
    () =>
      selectedCustomerId
        ? filteredCustomers.find((c) => c.customer_id === selectedCustomerId) ??
          allGeocodedCustomers.find((c) => c.customer_id === selectedCustomerId) ??
          null
        : null,
    [selectedCustomerId, filteredCustomers, allGeocodedCustomers]
  );

  const selectedCompetitor = useMemo(
    () =>
      selectedCompetitorId
        ? allCompetitors.find((c) => c.competitor_id === selectedCompetitorId) ?? null
        : null,
    [selectedCompetitorId, allCompetitors]
  );

  const savedViews = useMemo(() => {
    const presets = buildPresetSavedViews(activeTenant, activeIndustry.id);
    const custom = customViewsByTenant[activeTenant.id] ?? [];
    return [...custom, ...presets];
  }, [activeTenant, activeIndustry.id, customViewsByTenant]);

  // Quick search suggestions (dealers + pseudonymous customers if authorized)
  const searchMatches = useMemo(() => {
    const q = geoFilters.searchQuery.trim().toLowerCase();
    if (q.length < 2) return { dealers: [], customers: [] };
    const matchedDealers = allDealers
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.region_name.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedCustomers = canViewIndividualCustomers
      ? allGeocodedCustomers
          .filter((c) => c.pseudonym_code.toLowerCase().includes(q))
          .slice(0, 4)
      : [];
    return { dealers: matchedDealers, customers: matchedCustomers };
  }, [geoFilters.searchQuery, allDealers, allGeocodedCustomers, canViewIndividualCustomers]);

  const layerCounts = useMemo(() => {
    return {
      customers: filteredCustomers.length,
      atRisk: filteredCustomers.filter((c) => c.marker_group === 'at_risk').length,
      highValue: filteredCustomers.filter((c) => c.marker_group === 'high_value').length,
      dealers: visibleDealers.filter((d) => d.network_category === 'dealer').length,
      serviceCenters: visibleDealers.filter((d) => d.network_category === 'service').length,
      branches: visibleDealers.filter((d) => d.network_category === 'branch').length,
      competitors: visibleCompetitors.length,
      outsideCoverage: customerToDealerInsights.outside_coverage_count,
    };
  }, [filteredCustomers, visibleDealers, visibleCompetitors, customerToDealerInsights]);

  const activeTerritoryTitle =
    selectedVillageId !== 'ALL' && activeDistrict
      ? `${villages.find((v) => v.id === selectedVillageId)?.name ?? selectedVillageId}, ${activeDistrict.name}`
      : selectedDistrictId !== 'ALL' && activeDistrict
        ? `${activeDistrict.name} · ${activeRegency?.name ?? ''}`
        : activeRegency
          ? activeRegency.name
          : `All ${activeTenant.primaryProvinceName}`;

  // Handlers (click-to-open contextual detail drawers)
  const handleSelectCustomer = useCallback(
    (customerId: string) => {
      if (!canViewIndividualCustomers) {
        showToast('Individual customer inspection is restricted for your current role.');
        return;
      }
      setSelectedCustomerId(customerId);
      setContextTab('customer');
      setDrawerOpen(true);
      const cust = allGeocodedCustomers.find((c) => c.customer_id === customerId);
      if (cust) {
        setZoomTarget({ lat: cust.latitude, lng: cust.longitude, zoom: 13, nonce: Date.now() });
      }
    },
    [canViewIndividualCustomers, allGeocodedCustomers, showToast]
  );

  const handleSelectDealer = useCallback(
    (dealerId: string) => {
      setSelectedDealerId(dealerId);
      setLayers((prev) => ({ ...prev, coverageRadius: true }));
      setContextTab('dealer');
      setDrawerOpen(true);
      const d = allDealers.find((item) => item.dealer_id === dealerId);
      if (d) {
        setZoomTarget({
          lat: d.latitude,
          lng: d.longitude,
          zoom: Math.max(currentZoom, 12),
          nonce: Date.now(),
        });
      }
    },
    [allDealers, currentZoom]
  );

  const handleSelectCompetitor = useCallback((competitorId: string) => {
    setSelectedCompetitorId(competitorId);
    setContextTab('competitor');
    setDrawerOpen(true);
  }, []);

  const handleCommitSelection = useCallback(
    (geometry: GeoSelectionGeometry, label: string) => {
      setActiveSelection({ geometry, label });
      setDrawingTool('none');
      setOpenToolbarMenu('none');
      setContextTab('selection');
      setDrawerOpen(true);
      showToast(`Geographic area selected: ${label}`);
    },
    [showToast]
  );

  const handleResetWorkspace = useCallback(() => {
    setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' });
    setGeoFilters(DEFAULT_GEO_FILTERS);
    setLayers(DEFAULT_LAYERS);
    setMapMode(canViewIndividualCustomers ? 'points' : 'clusters');
    setCoverageRadiusKm(geoConfig.defaultRadiusKm);
    setCustomCoverageInput(String(geoConfig.defaultRadiusKm));
    setActiveSelection(null);
    setDrawingTool('none');
    setOpenToolbarMenu('none');
    setSelectedCustomerId(null);
    setSelectedDealerId(null);
    setSelectedCompetitorId(null);
    setContextTab('territory');
    setDrawerOpen(false);
    setFloatingPanelOpen(false);
    setGuidedDemoStep(null);
    setResetSignal((n) => n + 1);
  }, [setGeoDrilldown, canViewIndividualCustomers, geoConfig.defaultRadiusKm]);

  const handleApplySavedView = useCallback(
    (view: SavedMapView) => {
      setGeoDrilldown({ regionId: view.regionId, districtId: view.districtId, villageId: 'ALL' });
      setMapMode(!canViewIndividualCustomers && view.mapMode === 'points' ? 'clusters' : view.mapMode);
      setCoverageRadiusKm(view.radiusKm);
      setLayers((prev) => ({ ...prev, ...view.layers }));
      setGeoFilters({ ...DEFAULT_GEO_FILTERS, ...view.filters });
      showToast(`Applied map view: ${view.name}`);
    },
    [setGeoDrilldown, canViewIndividualCustomers, showToast]
  );

  const handleSaveCurrentView = useCallback(
    (name: string) => {
      const newView: SavedMapView = {
        id: `view-${Date.now()}`,
        name,
        description: `${activeTerritoryTitle} · Mode: ${mapMode} · Radius ${coverageRadiusKm} km`,
        regionId: selectedRegencyId,
        districtId: selectedDistrictId,
        mapMode,
        radiusKm: coverageRadiusKm,
        layers,
        filters: geoFilters,
      };
      setCustomViewsByTenant((prev) => ({
        ...prev,
        [activeTenant.id]: [newView, ...(prev[activeTenant.id] ?? [])],
      }));
      showToast(`Saved map view "${name}"`);
    },
    [
      activeTerritoryTitle,
      mapMode,
      coverageRadiusKm,
      selectedRegencyId,
      selectedDistrictId,
      layers,
      geoFilters,
      activeTenant.id,
      showToast,
    ]
  );

  // Interactive 10-step Guided Demo orchestrator ("Central Java Customer & Dealer Coverage Intelligence")
  const applyGuidedDemoStep = useCallback(
    (stepIdx: number) => {
      setGuidedDemoStep(stepIdx);
      setDrawerOpen(true);
      const primaryReg = permittedRegencies[0];
      const primaryDealer =
        allDealers.find((d) => d.region_id === primaryReg?.id) ?? allDealers[0];

      if (stepIdx === 0) {
        setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' });
        setGeoFilters(DEFAULT_GEO_FILTERS);
        setMapMode('clusters');
        setLayers({ ...DEFAULT_LAYERS, competitorMode: 'none', coverageRadius: false });
        setActiveSelection(null);
        setContextTab('territory');
        setResetSignal((n) => n + 1);
      } else if (stepIdx === 1 && primaryReg) {
        setGeoDrilldown({ regionId: primaryReg.id, districtId: 'ALL', villageId: 'ALL' });
        setMapMode('clusters');
        setContextTab('territory');
      } else if (stepIdx === 2 && primaryReg) {
        setGeoDrilldown({ regionId: primaryReg.id, districtId: 'ALL', villageId: 'ALL' });
        setMapMode('dealer_coverage');
        setLayers((prev) => ({
          ...prev,
          dealers: true,
          serviceCenters: true,
          branches: true,
          competitorMode: 'none',
        }));
        setContextTab('territory');
      } else if (stepIdx === 3 && primaryReg) {
        setMapMode('competitor_analysis');
        setLayers((prev) => ({ ...prev, competitorMode: 'all' }));
        const comp = allCompetitors.find((c) => c.region_id === primaryReg.id);
        if (comp) setSelectedCompetitorId(comp.competitor_id);
        setContextTab('competitor');
      } else if (stepIdx === 4 && primaryDealer) {
        setSelectedDealerId(primaryDealer.dealer_id);
        setMapMode('dealer_coverage');
        setCoverageRadiusKm(5);
        setCustomCoverageInput('5');
        setLayers((prev) => ({ ...prev, coverageRadius: true }));
        setContextTab('dealer');
        setZoomTarget({
          lat: primaryDealer.latitude,
          lng: primaryDealer.longitude,
          zoom: 12,
          nonce: Date.now(),
        });
      } else if (stepIdx === 5 && primaryDealer) {
        setSelectedDealerId(primaryDealer.dealer_id);
        setMapMode('dealer_coverage');
        setCoverageRadiusKm(10);
        setCustomCoverageInput('10');
        setLayers((prev) => ({ ...prev, coverageRadius: true }));
        setContextTab('dealer');
      } else if (stepIdx === 6 && primaryDealer) {
        setCoverageRadiusKm(5);
        setCustomCoverageInput('5');
        setMapMode(canViewIndividualCustomers ? 'points' : 'heatmap_risk');
        setLayers((prev) => ({
          ...prev,
          atRiskHighlight: true,
          uncoveredHighlight: true,
          coverageRadius: true,
        }));
        setZoomTarget({
          lat: primaryDealer.latitude,
          lng: primaryDealer.longitude,
          zoom: 13,
          nonce: Date.now(),
        });
      } else if (stepIdx === 7 && primaryReg) {
        const outerRisk =
          allGeocodedCustomers.find(
            (c) =>
              c.region_id === primaryReg.id &&
              c.marker_group === 'at_risk' &&
              c.nearest_dealer_distance_km > 5
          ) ??
          allGeocodedCustomers.find((c) => c.region_id === primaryReg.id) ??
          allGeocodedCustomers[0];
        if (outerRisk && canViewIndividualCustomers) {
          setSelectedCustomerId(outerRisk.customer_id);
          setLayers((prev) => ({ ...prev, customerToDealerLines: true }));
          setContextTab('customer');
          setZoomTarget({
            lat: outerRisk.latitude,
            lng: outerRisk.longitude,
            zoom: 13,
            nonce: Date.now(),
          });
        } else {
          setContextTab('territory');
        }
      } else if (stepIdx === 8 && primaryDealer) {
        const radiusGeom: GeoSelectionGeometry = {
          type: 'radius',
          center: [primaryDealer.latitude - 0.045, primaryDealer.longitude + 0.035],
          radiusKm: 6,
        };
        setActiveSelection({
          geometry: radiusGeom,
          label: `${primaryReg?.name ?? 'Primary'} Outer Catchment (6 km Radius)`,
        });
        setContextTab('selection');
      } else if (stepIdx === 9) {
        setMapMode('opportunity');
        setLayers((prev) => ({ ...prev, opportunityOverlay: true, territoryBoundaries: true }));
        setContextTab('opportunity');
      }
    },
    [
      permittedRegencies,
      allDealers,
      allCompetitors,
      allGeocodedCustomers,
      canViewIndividualCustomers,
      setGeoDrilldown,
    ]
  );

  const isHeatmapMode =
    mapMode === 'heatmap_density' || mapMode === 'heatmap_value' || mapMode === 'heatmap_risk';

  const activePrimaryMode:
    | 'points'
    | 'heatmap'
    | 'dealer_coverage'
    | 'competitor_analysis'
    | 'opportunity' = isHeatmapMode
    ? 'heatmap'
    : mapMode === 'dealer_coverage'
      ? 'dealer_coverage'
      : mapMode === 'competitor_analysis'
        ? 'competitor_analysis'
        : mapMode === 'opportunity'
          ? 'opportunity'
          : 'points';

  const handleSelectPrimaryMode = (
    next: 'points' | 'heatmap' | 'dealer_coverage' | 'competitor_analysis' | 'opportunity'
  ) => {
    setOpenToolbarMenu('none');
    if (next === 'points') {
      setMapMode(canViewIndividualCustomers ? 'points' : 'clusters');
    } else if (next === 'heatmap') {
      setMapMode(heatmapVariant);
    } else if (next === 'dealer_coverage') {
      setMapMode('dealer_coverage');
      setLayers((prev) => ({
        ...prev,
        dealers: true,
        serviceCenters: true,
        branches: true,
        coverageRadius: true,
      }));
    } else if (next === 'competitor_analysis') {
      setMapMode('competitor_analysis');
      setLayers((prev) => ({
        ...prev,
        competitorMode: prev.competitorMode === 'none' ? 'all' : prev.competitorMode,
      }));
    } else if (next === 'opportunity') {
      setMapMode('opportunity');
      setLayers((prev) => ({ ...prev, opportunityOverlay: true, territoryBoundaries: true }));
      setContextTab('opportunity');
      setDrawerOpen(true);
    }
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selectedRegencyId !== 'ALL') n++;
    if (selectedDistrictId !== 'ALL') n++;
    if (selectedVillageId !== 'ALL') n++;
    if (geoFilters.segment !== 'ALL') n++;
    if (geoFilters.purchaseStatus !== 'ALL') n++;
    if (geoFilters.serviceStatus !== 'ALL') n++;
    if (geoFilters.churnRisk !== 'ALL') n++;
    if (geoFilters.valueTier !== 'ALL') n++;
    if (geoFilters.productOwnership !== 'ALL') n++;
    if (geoFilters.assignedDealerId !== 'ALL') n++;
    if (geoFilters.onlyOutsideCoverage) n++;
    return n;
  }, [selectedRegencyId, selectedDistrictId, selectedVillageId, geoFilters]);

  const toggleFloatingTab = (tab: 'layers' | 'filters') => {
    setOpenToolbarMenu('none');
    if (floatingPanelOpen && floatingPanelTab === tab) {
      setFloatingPanelOpen(false);
    } else {
      setFloatingPanelTab(tab);
      setFloatingPanelOpen(true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Compact Map-First Header Strip (no static KPI obstruction) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="font-display text-lg font-bold tracking-tight text-[#102B4D]">
            Location Intelligence
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{activeIndustry.name}</span>
            <span aria-hidden="true">·</span>
            <span>{activeTerritoryTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{allDealers.length} Network Units</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyGuidedDemoStep(0)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#16A6BD] bg-[#F0FAFC] px-2.5 text-xs font-semibold text-[#102B4D] transition-colors hover:bg-[#E0F5F9] whitespace-nowrap"
          >
            <Compass className="h-3.5 w-3.5 text-[#16A6BD]" />
            <span>Guided Demo</span>
          </button>
          {canViewIndividualCustomers && (
            <button
              type="button"
              onClick={() =>
                openCustomersForTerritorySegment({
                  regionId: selectedRegencyId,
                  districtId: selectedDistrictId,
                  villageId: selectedVillageId,
                  segment: geoFilters.segment,
                })
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D] whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Customers ({formatNumber(filteredCustomers.length)})</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleResetWorkspace}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              drawerOpen
                ? 'border-[#102B4D] bg-[#102B4D] text-white'
                : 'border-slate-300 bg-white text-[#102B4D] hover:bg-slate-50'
            }`}
          >
            {drawerOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
            <span>Territory Details</span>
          </button>
        </div>
      </div>

      {/* Optional Guided Geo Demo Walkthrough Bar */}
      {guidedDemoStep !== null && (
        <GuidedGeoDemoBar
          activeStepIndex={guidedDemoStep}
          onSelectStep={applyGuidedDemoStep}
          onClose={() => setGuidedDemoStep(null)}
        />
      )}

      {/* MAP-FIRST ENTERPRISE GEOSPATIAL WORKSPACE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {/* HORIZONTAL TOOLBAR: Search | Filters | Map Mode | Layers | Coverage | Draw Area | Fullscreen */}
        <div
          role="toolbar"
          aria-label="Geospatial analysis toolbar"
          className="relative z-[440] flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2"
        >
          {/* 1. Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              id="geo-search"
              type="text"
              aria-label="Search customer, dealer, or location"
              value={geoFilters.searchQuery}
              onChange={(e) => setGeoFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
              placeholder={
                canViewIndividualCustomers
                  ? `Search dealer, city, or ${allGeocodedCustomers[0]?.pseudonym_code ?? 'ASM-0001'}`
                  : 'Search dealer, branch, or city...'
              }
              className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 text-xs text-slate-900 focus:border-[#1769AA] focus:outline-none"
            />
            {(searchMatches.dealers.length > 0 || searchMatches.customers.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-[470] mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 text-xs shadow-lg">
                {searchMatches.dealers.map((d) => (
                  <button
                    key={d.dealer_id}
                    type="button"
                    onClick={() => {
                      setGeoFilters((prev) => ({ ...prev, searchQuery: '' }));
                      handleSelectDealer(d.dealer_id);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className="truncate font-semibold text-[#102B4D]">{d.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-emerald-700">
                      {d.code}
                    </span>
                  </button>
                ))}
                {searchMatches.customers.map((c) => (
                  <button
                    key={c.customer_id}
                    type="button"
                    onClick={() => {
                      setGeoFilters((prev) => ({ ...prev, searchQuery: '' }));
                      handleSelectCustomer(c.customer_id);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className="font-mono font-semibold text-[#1769AA]">
                      {c.pseudonym_code}
                    </span>
                    <span className="truncate text-[10.5px] text-slate-500">
                      {c.region_name} · {c.customer_segment}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden h-5 w-px bg-slate-200 md:block" aria-hidden="true" />

          {/* 2. Filters */}
          <button
            type="button"
            onClick={() => toggleFloatingTab('filters')}
            aria-expanded={floatingPanelOpen && floatingPanelTab === 'filters'}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              floatingPanelOpen && floatingPanelTab === 'filters'
                ? 'border-[#102B4D] bg-[#102B4D] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className={`font-mono text-[10.5px] tabular-nums ${
                  floatingPanelOpen && floatingPanelTab === 'filters'
                    ? 'text-[#7CE0F0]'
                    : 'text-[#1769AA]'
                }`}
              >
                ({activeFilterCount})
              </span>
            )}
          </button>

          <div className="hidden h-5 w-px bg-slate-200 md:block" aria-hidden="true" />

          {/* 3. Map Mode (5 Requested Enterprise GIS Modes) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="toolbar-map-mode" className="sr-only">
              Map Mode
            </label>
            <select
              id="toolbar-map-mode"
              aria-label="Map Mode"
              value={activePrimaryMode}
              onChange={(e) =>
                handleSelectPrimaryMode(
                  e.target.value as
                    | 'points'
                    | 'heatmap'
                    | 'dealer_coverage'
                    | 'competitor_analysis'
                    | 'opportunity'
                )
              }
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-[#102B4D] focus:border-[#1769AA] focus:outline-none"
            >
              <option value="points">
                {canViewIndividualCustomers ? 'Map Mode: Customer Points' : 'Map Mode: Customer Clusters (RBAC)'}
              </option>
              <option value="heatmap">Map Mode: Customer Heatmap</option>
              <option value="dealer_coverage">Map Mode: Dealer Coverage</option>
              <option value="competitor_analysis">Map Mode: Competitor Analysis</option>
              <option value="opportunity">Map Mode: Market Opportunity</option>
            </select>

            {isHeatmapMode && (
              <div
                role="group"
                aria-label="Heatmap metric selector"
                className="hidden items-center rounded-lg border border-slate-200 bg-white p-0.5 xl:flex"
              >
                {(
                  [
                    { id: 'heatmap_density', label: 'Density' },
                    { id: 'heatmap_value', label: 'Value' },
                    { id: 'heatmap_risk', label: 'At-Risk' },
                  ] as const
                ).map((hm) => (
                  <button
                    key={hm.id}
                    type="button"
                    onClick={() => {
                      setHeatmapVariant(hm.id);
                      setMapMode(hm.id);
                    }}
                    className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      mapMode === hm.id
                        ? 'bg-[#102B4D] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {hm.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden h-5 w-px bg-slate-200 md:block" aria-hidden="true" />

          {/* 4. Layers (Compact Floating Panel over Map) */}
          <button
            type="button"
            onClick={() => toggleFloatingTab('layers')}
            aria-expanded={floatingPanelOpen && floatingPanelTab === 'layers'}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              floatingPanelOpen && floatingPanelTab === 'layers'
                ? 'border-[#102B4D] bg-[#102B4D] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Layers</span>
          </button>

          {/* 5. Coverage Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFloatingPanelOpen(false);
                setOpenToolbarMenu((m) => (m === 'coverage' ? 'none' : 'coverage'));
              }}
              aria-expanded={openToolbarMenu === 'coverage'}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                openToolbarMenu === 'coverage' || mapMode === 'dealer_coverage'
                  ? 'border-[#16A6BD] bg-[#F0FAFC] text-[#102B4D]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Radar className="h-3.5 w-3.5 text-[#15946A]" />
              <span>Coverage · {coverageRadiusKm} km</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {openToolbarMenu === 'coverage' && (
              <div
                data-testid="coverage-popover"
                className="absolute right-0 top-full z-[470] mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#102B4D]">Straight-Line Catchment</span>
                  <span className="font-mono text-[10.5px] text-slate-500">
                    {coverageRadiusKm} km
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[1, 3, 5, 10, 15].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => {
                        setCoverageRadiusKm(km);
                        setCustomCoverageInput(String(km));
                        setLayers((prev) => ({ ...prev, coverageRadius: true }));
                      }}
                      className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold ${
                        coverageRadiusKm === km
                          ? 'bg-[#102B4D] text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    aria-label="Custom straight-line radius km"
                    value={customCoverageInput}
                    onChange={(e) => setCustomCoverageInput(e.target.value)}
                    className="h-7 w-20 rounded border border-slate-300 px-2 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Number(customCoverageInput);
                      if (Number.isFinite(val) && val >= 1 && val <= 50) {
                        setCoverageRadiusKm(val);
                        setLayers((prev) => ({ ...prev, coverageRadius: true }));
                      }
                    }}
                    className="rounded bg-[#1769AA] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#102B4D]"
                  >
                    Apply km
                  </button>
                </div>
                <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2">
                  <label className="flex items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={layers.coverageRadius}
                      onChange={(e) => setLayers((prev) => ({ ...prev, coverageRadius: e.target.checked }))}
                      className="rounded border-slate-300 text-[#15946A]"
                    />
                    <span>Show Radius Circles</span>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      checked={layers.uncoveredHighlight}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, uncoveredHighlight: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-amber-600"
                    />
                    <span>Highlight Uncovered ({layerCounts.outsideCoverage})</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenToolbarMenu('none');
                    setContextTab('dealer');
                    setDrawerOpen(true);
                  }}
                  className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-semibold text-[#1769AA] hover:bg-slate-100"
                >
                  Open Dealer Coverage Drawer
                </button>
              </div>
            )}
          </div>

          {/* 6. Draw Area & Measure Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFloatingPanelOpen(false);
                setOpenToolbarMenu((m) => (m === 'draw' ? 'none' : 'draw'));
              }}
              aria-expanded={openToolbarMenu === 'draw'}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                drawingTool !== 'none'
                  ? 'border-[#16A6BD] bg-[#16A6BD] text-white'
                  : openToolbarMenu === 'draw'
                    ? 'border-[#102B4D] bg-[#102B4D] text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Square className="h-3.5 w-3.5" />
              <span>
                {drawingTool === 'none'
                  ? 'Draw Area'
                  : drawingTool === 'measure'
                    ? 'Measuring'
                    : `Draw: ${drawingTool}`}
              </span>
              <ChevronDown className="h-3 w-3 opacity-75" />
            </button>

            {openToolbarMenu === 'draw' && (
              <div
                data-testid="draw-area-popover"
                className="absolute right-0 top-full z-[470] mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDrawingTool('rectangle');
                    setOpenToolbarMenu('none');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Square className="h-3.5 w-3.5 text-[#1769AA]" />
                  <span>Rectangle Selection</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawingTool('polygon');
                    setOpenToolbarMenu('none');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Pentagon className="h-3.5 w-3.5 text-[#1769AA]" />
                  <span>Polygon Selection</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawingTool('radius');
                    setOpenToolbarMenu('none');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Circle className="h-3.5 w-3.5 text-[#16A6BD]" />
                  <span>Radius Selection ({coverageRadiusKm} km)</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setDrawingTool('measure');
                    setOpenToolbarMenu('none');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Ruler className="h-3.5 w-3.5 text-amber-600" />
                  <span>Measure Straight-Line</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitCustomersSignal((n) => n + 1);
                    setOpenToolbarMenu('none');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Crosshair className="h-3.5 w-3.5 text-slate-600" />
                  <span>Fit Filtered Results</span>
                </button>
              </div>
            )}
          </div>

          {/* 7. Fullscreen (hides sidebar while preserving top navigation) */}
          <button
            type="button"
            onClick={() => setMapFullscreen(!mapFullscreen)}
            className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              mapFullscreen
                ? 'border-[#102B4D] bg-[#102B4D] text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {mapFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Fullscreen</span>
              </>
            )}
          </button>
        </div>

        {/* DOMINANT MAP CANVAS + COLLAPSIBLE CONTEXT-AWARE RIGHT DRAWER */}
        <div className="relative flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1">
            <AdvancedLeafletMap
              tenant={activeTenant}
              industry={activeIndustry}
              geoConfig={geoConfig}
              customers={filteredCustomers}
              dealers={visibleDealers}
              competitors={visibleCompetitors}
              opportunityZones={opportunityZones}
              selectedRegionId={selectedRegencyId}
              selectedDistrictId={selectedDistrictId}
              selectedCustomerId={selectedCustomerId}
              selectedDealerId={effectiveSelectedDealer?.dealer_id ?? null}
              selectedCompetitorId={selectedCompetitorId}
              activeCoverage={activeCoverage}
              coverageRadiusKm={coverageRadiusKm}
              mapMode={mapMode}
              heatmapIntensity={heatmapIntensity}
              layers={layers}
              drawingTool={drawingTool}
              activeSelection={activeSelection?.geometry ?? null}
              canViewIndividualCustomers={canViewIndividualCustomers}
              isFullscreen={mapFullscreen}
              layoutResizeKey={`${drawerOpen ? 'open' : 'closed'}-${mapFullscreen ? 'fs' : 'std'}`}
              resetSignal={resetSignal}
              fitCustomersSignal={fitCustomersSignal}
              zoomTarget={zoomTarget}
              onZoomChange={setCurrentZoom}
              onSelectRegion={(regionId) => {
                setGeoDrilldown({ regionId, districtId: 'ALL', villageId: 'ALL' });
                setContextTab('territory');
                setDrawerOpen(true);
              }}
              onSelectCustomer={handleSelectCustomer}
              onSelectDealer={handleSelectDealer}
              onSelectCompetitor={handleSelectCompetitor}
              onCommitSelection={handleCommitSelection}
              onClearDrawingTool={() => setDrawingTool('none')}
              onToggleFullscreen={() => setMapFullscreen(!mapFullscreen)}
              floatingOverlay={
                <MapLayersControlPanel
                  isOpen={floatingPanelOpen}
                  activeTab={floatingPanelTab}
                  onChangeTab={setFloatingPanelTab}
                  onClose={() => setFloatingPanelOpen(false)}
                  geoConfig={geoConfig}
                  layers={layers}
                  onUpdateLayers={(patch) => setLayers((prev) => ({ ...prev, ...patch }))}
                  filters={geoFilters}
                  onUpdateFilters={(patch) => setGeoFilters((prev) => ({ ...prev, ...patch }))}
                  onResetFilters={() => {
                    setGeoFilters(DEFAULT_GEO_FILTERS);
                    setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' });
                  }}
                  mapMode={mapMode}
                  onChangeMapMode={(m) => {
                    if (
                      m === 'heatmap_density' ||
                      m === 'heatmap_value' ||
                      m === 'heatmap_risk'
                    ) {
                      setHeatmapVariant(m);
                    }
                    setMapMode(m);
                  }}
                  heatmapIntensity={heatmapIntensity}
                  onChangeHeatmapIntensity={setHeatmapIntensity}
                  dealers={allDealers}
                  productOptions={productOptions}
                  provinceName={activeTenant.primaryProvinceName}
                  regencies={permittedRegencies}
                  districts={districts}
                  villages={villages}
                  selectedRegencyId={selectedRegencyId}
                  selectedDistrictId={selectedDistrictId}
                  selectedVillageId={selectedVillageId}
                  onChangeGeoHierarchy={(patch) => setGeoDrilldown(patch)}
                  counts={layerCounts}
                  canViewIndividualCustomers={canViewIndividualCustomers}
                  savedViews={savedViews}
                  onApplySavedView={handleApplySavedView}
                  onSaveCurrentView={handleSaveCurrentView}
                />
              }
            />
          </div>

          {/* Collapsible Context-Aware Right-Side Drawer */}
          {drawerOpen && (
            <GeoContextPanel
              activeTab={contextTab}
              onChangeTab={setContextTab}
              geoConfig={geoConfig}
              provinceName={activeTenant.primaryProvinceName}
              activeTerritoryTitle={activeTerritoryTitle}
              selectedRegionId={selectedRegencyId}
              selectedDistrictId={selectedDistrictId}
              selectedVillageId={selectedVillageId}
              filteredCustomers={filteredCustomers}
              allDealers={allDealers}
              competitors={visibleCompetitors}
              selectedCustomer={selectedCustomer}
              selectedDealer={effectiveSelectedDealer}
              selectedCompetitor={selectedCompetitor}
              activeCoverage={activeCoverage}
              coverageRadiusKm={coverageRadiusKm}
              onChangeCoverageRadiusKm={(km) => {
                setCoverageRadiusKm(km);
                setCustomCoverageInput(String(km));
              }}
              customerToDealerInsights={customerToDealerInsights}
              showCustomerToDealerLine={layers.customerToDealerLines}
              onToggleCustomerToDealerLine={(val) =>
                setLayers((prev) => ({ ...prev, customerToDealerLines: val }))
              }
              opportunityZones={opportunityZones}
              opportunityWeights={opportunityWeights}
              onUpdateOpportunityWeights={setOpportunityWeights}
              selectionSummary={selectionSummary}
              onClearSelection={() => setActiveSelection(null)}
              canViewIndividualCustomers={canViewIndividualCustomers}
              canCreateCampaign={canCreateCampaign}
              onSelectCustomer={handleSelectCustomer}
              onSelectDealer={handleSelectDealer}
              onSelectRegion={(regionId) => {
                setGeoDrilldown({ regionId, districtId: 'ALL', villageId: 'ALL' });
              }}
              onOpenCustomer360={(cid) => openCustomer360(cid)}
              onOpenCustomerPrediction={(cid) => openCustomerPredictions(cid)}
              onOpenSegmentInCustomerIntel={(segment) =>
                openCustomersForTerritorySegment({
                  regionId: selectedRegencyId,
                  districtId: selectedDistrictId,
                  villageId: selectedVillageId,
                  segment,
                })
              }
              onCreateCampaignFromSelection={(summary) =>
                openCampaignStudioFromGeoSelection({
                  label: summary.label,
                  regionId: summary.dominant_region_id,
                  customerIds: summary.matching_customers.map((c) => c.customer_id),
                  strategy:
                    summary.at_risk_count > summary.matching_count * 0.25 ? 'RETAIN' : 'DEVELOP',
                })
              }
              onOpenNbaForRegion={(regionId) => {
                setGeoDrilldown({ regionId, districtId: 'ALL', villageId: 'ALL' });
                navigateToRoute('next_best_action');
              }}
              onOpenAiBriefing={() => setAiPanelOpen(true)}
              onClose={() => setDrawerOpen(false)}
              isFullscreen={mapFullscreen}
            />
          )}
        </div>
      </div>

      {/* BELOW-FOLD ANALYTICS TABLES: Territory Opportunity & Gap Ranking + Network Matrix */}
      {!mapFullscreen && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-[#102B4D]">
                  Territory Opportunity & Gap Ranking ({activeTenant.primaryProvinceName})
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ranked by configurable weighted Opportunity & Gap Score ({coverageRadiusKm} km
                  straight-line radius · Illustrative Spatial Model)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContextTab('opportunity');
                  setDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Target className="h-3.5 w-3.5 text-[#1769AA]" />
                Adjust Scoring Weights
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Rank</th>
                    <th className="px-3 py-2.5 font-semibold">Regency / City</th>
                    <th className="px-3 py-2.5 font-semibold">Zone Classification</th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      {geoConfig.customerPlural}
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Cov ({coverageRadiusKm} km)
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold">At-Risk</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Score</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunityZones.map((zone, index) => {
                    const isSel = selectedRegencyId === zone.region_id;
                    return (
                      <tr
                        key={zone.region_id}
                        className={`transition-colors ${isSel ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-3 pr-3 font-mono font-semibold text-slate-500">
                          #{index + 1}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#1769AA]" />
                            {zone.region_name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] font-medium text-slate-700">
                          <span className="font-mono font-bold text-[#102B4D]">
                            {zone.category_code}
                          </span>{' '}
                          · {zone.category}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          {formatNumber(zone.customer_count)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">
                          <span
                            className={
                              zone.coverage_rate_pct < 50
                                ? 'font-semibold text-[#B47815]'
                                : 'font-semibold text-[#15946A]'
                            }
                          >
                            {zone.coverage_rate_pct}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[#D9534F] tabular-nums">
                          {formatNumber(zone.at_risk_count)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold text-[#16A6BD] tabular-nums">
                          {zone.composite_score} / 100
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setGeoDrilldown({
                                  regionId: isSel ? 'ALL' : zone.region_id,
                                  districtId: 'ALL',
                                  villageId: 'ALL',
                                });
                                setContextTab('territory');
                                if (!isSel) {
                                  setDrawerOpen(true);
                                }
                              }}
                              className="font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                            >
                              {isSel ? 'Clear' : 'Focus'}
                            </button>
                            {canViewIndividualCustomers && (
                              <button
                                type="button"
                                onClick={() =>
                                  openCustomersForTerritorySegment({
                                    regionId: zone.region_id,
                                    districtId: 'ALL',
                                    villageId: 'ALL',
                                    segment: 'ALL',
                                  })
                                }
                                className="font-semibold text-slate-700 hover:text-[#102B4D] hover:underline whitespace-nowrap"
                              >
                                Customers
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Dealer & Service Network Coverage Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#102B4D]">
                  {geoConfig.dealerLabel} & {geoConfig.serviceLabel} Network
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Click any location to inspect straight-line radius catchment
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#15946A]">
                {visibleDealers.length} active
              </span>
            </div>

            <div className="mt-4 max-h-[340px] divide-y divide-slate-100 overflow-y-auto text-xs">
              {visibleDealers.map((d) => {
                const isSelected = effectiveSelectedDealer?.dealer_id === d.dealer_id;
                return (
                  <button
                    key={d.dealer_id}
                    type="button"
                    onClick={() => handleSelectDealer(d.dealer_id)}
                    className={`flex w-full items-center justify-between py-2.5 px-2 text-left transition-colors rounded ${
                      isSelected ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Building2
                          className={`h-3.5 w-3.5 shrink-0 ${
                            d.network_category === 'service'
                              ? 'text-[#0D9488]'
                              : d.network_category === 'branch'
                                ? 'text-[#102B4D]'
                                : 'text-[#15946A]'
                          }`}
                        />
                        <span className="truncate">{d.name}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {d.code} · {d.dealer_type}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px]">
                      <div className="font-semibold text-slate-800">Cap {d.service_capacity_pct}%</div>
                      <div className="text-[10px] text-slate-500">{d.assigned_customers} accts</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

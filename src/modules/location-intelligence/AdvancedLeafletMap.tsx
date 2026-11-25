import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { IndustryProfile, Tenant } from '../../types/platform';
import type {
  CompetitorLocation,
  CoverageAnalysisResult,
  DealerNetworkNode,
  DrawingToolMode,
  GeoClusterNode,
  GeoLayerVisibility,
  GeoSelectionGeometry,
  GeoViewportBounds,
  GeocodedCustomer,
  IndustryGeoConfig,
  MapDisplayMode,
  OpportunityGapZone,
} from '../../types/geospatial';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import {
  computeCustomerMapCounts,
  computeZoomClusters,
  haversineDistanceKm,
  isPlottableCustomer,
  MARKER_GROUP_META,
} from '../../core/geo/geospatialService';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Lock,
  Maximize2,
  Minimize2,
  Ruler,
  X,
} from 'lucide-react';

interface AdvancedLeafletMapProps {
  tenant: Tenant;
  industry: IndustryProfile;
  geoConfig: IndustryGeoConfig;
  customers: GeocodedCustomer[];
  dealers: DealerNetworkNode[];
  competitors: CompetitorLocation[];
  opportunityZones: OpportunityGapZone[];
  selectedRegionId: string;
  selectedDistrictId: string;
  selectedCustomerId: string | null;
  selectedDealerId: string | null;
  selectedCompetitorId: string | null;
  activeCoverage: CoverageAnalysisResult | null;
  coverageRadiusKm: number;
  mapMode: MapDisplayMode;
  heatmapIntensity: number;
  layers: GeoLayerVisibility;
  drawingTool: DrawingToolMode;
  activeSelection: GeoSelectionGeometry | null;
  canViewIndividualCustomers: boolean;
  isFullscreen: boolean;
  layoutResizeKey?: string;
  resetSignal: number;
  fitCustomersSignal: number;
  zoomTarget?: { lat: number; lng: number; zoom: number; nonce: number } | null;
  onZoomChange: (zoom: number) => void;
  onSelectRegion: (regionId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onSelectDealer: (dealerId: string) => void;
  onSelectCompetitor: (competitorId: string) => void;
  onCommitSelection: (geometry: GeoSelectionGeometry, label: string) => void;
  onClearDrawingTool: () => void;
  onToggleFullscreen: () => void;
  floatingOverlay?: React.ReactNode;
}

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

/**
 * Lightweight, zero-dependency Leaflet Canvas Heatmap Layer.
 * Aggregates weighted points smoothly onto a map-synchronized <canvas> without exposing individual PII.
 */
class CanvasHeatmapLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private points: HeatPoint[] = [];
  private intensity = 1;
  private mode: 'density' | 'value' | 'risk' = 'density';

  constructor(
    points: HeatPoint[],
    intensity: number,
    mode: 'density' | 'value' | 'risk'
  ) {
    super();
    this.points = points;
    this.intensity = intensity;
    this.mode = mode;
  }

  onAdd(map: L.Map): this {
    const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '350';
    this.canvas = canvas;

    const pane = map.getPane('overlayPane');
    if (pane) pane.appendChild(canvas);

    map.on('moveend zoomend resize', this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this.redraw, this);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    return this;
  }

  private redraw() {
    if (!this.canvas || !this._map) return;
    const map = this._map;
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this.canvas, topLeft);
    this.canvas.width = size.x;
    this.canvas.height = size.y;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);
    if (this.points.length === 0) return;

    const zoom = map.getZoom();
    const radius = Math.max(28, Math.min(64, 24 + (zoom - 7) * 6));

    // Step 1: accumulate alpha on canvas
    for (const p of this.points) {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      if (pt.x < -radius || pt.y < -radius || pt.x > size.x + radius || pt.y > size.y + radius) {
        continue;
      }
      const alpha = Math.min(0.88, Math.max(0.36, p.weight * 0.62 * this.intensity));
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${alpha * 0.48})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Step 2: colorize accumulated alpha channel cleanly
    const img = ctx.getImageData(0, 0, size.x, size.y);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 8) {
        data[i + 3] = 0;
        continue;
      }
      const t = Math.min(1, a / 175);
      let r = 22;
      let g = 166;
      let b = 189;

      if (this.mode === 'risk') {
        // Warm amber -> coral -> crimson for At-Risk Heatmap
        if (t < 0.35) {
          r = 245;
          g = 179;
          b = 66;
        } else if (t < 0.68) {
          r = 234;
          g = 94;
          b = 46;
        } else {
          r = 198;
          g = 34;
          b = 34;
        }
      } else if (this.mode === 'value') {
        // Teal -> Emerald -> Gold for Customer Value Heatmap
        if (t < 0.38) {
          r = 22;
          g = 166;
          b = 189;
        } else if (t < 0.7) {
          r = 21;
          g = 148;
          b = 106;
        } else {
          r = 217;
          g = 119;
          b = 6;
        }
      } else {
        // Cyan -> Ocean Blue -> Amber -> Red for Density Heatmap
        if (t < 0.32) {
          r = 22;
          g = 166;
          b = 189;
        } else if (t < 0.6) {
          r = 23;
          g = 105;
          b = 170;
        } else if (t < 0.82) {
          r = 234;
          g = 158;
          b = 36;
        } else {
          r = 217;
          g = 72;
          b = 65;
        }
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.min(220, Math.round(Math.pow(t, 0.72) * 230));
    }
    ctx.putImageData(img, 0, 0);
  }
}

function getOpportunityFill(score: number): string {
  if (score >= 82) return '#15946A';
  if (score >= 68) return '#16A6BD';
  if (score >= 54) return '#1769AA';
  return '#64748B';
}

function createDealerIcon(dealer: DealerNetworkNode, isSelected: boolean): L.DivIcon {
  const isService = dealer.network_category === 'service';
  const isBranch = dealer.network_category === 'branch';
  const bg = isService ? '#0D9488' : isBranch ? '#102B4D' : '#15946A';
  const size = isSelected ? 30 : 24;
  const ring = isSelected
    ? 'box-shadow:0 0 0 4px rgba(22,166,189,0.45), 0 2px 8px rgba(16,43,77,0.4);'
    : 'box-shadow:0 2px 6px rgba(16,43,77,0.35);';

  if (isService) {
    // Teal service icon (wrench glyph inside crisp circular badge)
    const iconPx = isSelected ? 15 : 12;
    return L.divIcon({
      className: 'serveon-service-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="width:${size}px;height:${size}px;background:${bg};border:2px solid #ffffff;border-radius:999px;display:flex;align-items:center;justify-content:center;${ring}"><svg width="${iconPx}" height="${iconPx}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>`,
    });
  }

  // Dealer = green square; Branch = navy square
  const badgeText = isBranch ? 'B' : 'D';
  return L.divIcon({
    className: 'serveon-dealer-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:2px solid #ffffff;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:${isSelected ? 12 : 10}px;font-family:Plus Jakarta Sans,Inter,sans-serif;${ring}">${badgeText}</div>`,
  });
}

function createCompetitorIcon(comp: CompetitorLocation, isSelected: boolean): L.DivIcon {
  // Competitor = orange triangle (darker orange for service competitor, vivid orange for dealer competitor)
  const fill = comp.competitor_category === 'dealer' ? '#F97316' : '#EA580C';
  const size = isSelected ? 28 : 22;
  const drop = isSelected
    ? 'filter:drop-shadow(0 0 4px rgba(234,88,12,0.75));'
    : 'filter:drop-shadow(0 1px 3px rgba(15,23,42,0.4));';

  return L.divIcon({
    className: 'serveon-competitor-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size * 0.72],
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;${drop}"><svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 22,20 2,20" fill="${fill}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/><text x="12" y="17.2" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800" font-family="Plus Jakarta Sans,sans-serif">C</text></svg></div>`,
  });
}

function createClusterIcon(cluster: GeoClusterNode, isPrivacyLocked: boolean): L.DivIcon {
  const size = cluster.count >= 150 ? 48 : cluster.count >= 50 ? 42 : cluster.count >= 15 ? 36 : 30;
  const riskRatio = cluster.count > 0 ? cluster.atRiskCount / cluster.count : 0;
  const bg = riskRatio >= 0.35 ? '#C53030' : cluster.count >= 100 ? '#102B4D' : '#1769AA';
  const ringColor = isPrivacyLocked ? 'rgba(217,119,6,0.35)' : 'rgba(22,166,189,0.30)';

  return L.divIcon({
    className: 'serveon-cluster-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:2.5px solid #ffffff;border-radius:999px;box-shadow:0 0 0 5px ${ringColor}, 0 2px 8px rgba(16,43,77,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-family:JetBrains Mono,monospace;font-weight:700;font-size:${size >= 42 ? 12 : 11}px;">${cluster.count}</div>`,
  });
}

export function AdvancedLeafletMap({
  tenant,
  geoConfig,
  customers,
  dealers,
  competitors,
  opportunityZones,
  selectedRegionId,
  selectedDistrictId,
  selectedCustomerId,
  selectedDealerId,
  selectedCompetitorId,
  activeCoverage,
  coverageRadiusKm,
  mapMode,
  heatmapIntensity,
  layers,
  drawingTool,
  activeSelection,
  canViewIndividualCustomers,
  isFullscreen,
  layoutResizeKey,
  resetSignal,
  fitCustomersSignal,
  zoomTarget,
  onZoomChange,
  onSelectRegion,
  onSelectCustomer,
  onSelectDealer,
  onSelectCompetitor,
  onCommitSelection,
  onClearDrawingTool,
  onToggleFullscreen,
  floatingOverlay,
}: AdvancedLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const territoryGroupRef = useRef<L.LayerGroup | null>(null);
  const coverageGroupRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<CanvasHeatmapLayer | null>(null);
  const customerGroupRef = useRef<L.LayerGroup | null>(null);
  const networkGroupRef = useRef<L.LayerGroup | null>(null);
  const competitorGroupRef = useRef<L.LayerGroup | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const draftGroupRef = useRef<L.LayerGroup | null>(null);

  const provinceGeo = useMemo(() => getProvinceMapConfig(tenant), [tenant]);
  const plottableCustomers = useMemo(
    () => customers.filter(isPlottableCustomer),
    [customers]
  );
  const [currentZoom, setCurrentZoom] = useState<number>(provinceGeo.defaultZoom);
  const [viewportBounds, setViewportBounds] = useState<GeoViewportBounds | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);

  // Interactive drawing / measurement states
  const [rectFirstCorner, setRectFirstCorner] = useState<[number, number] | null>(null);
  const [polygonVertices, setPolygonVertices] = useState<Array<[number, number]>>([]);
  const [measurePoints, setMeasurePoints] = useState<Array<[number, number]>>([]);

  // Keep latest callbacks in refs so map click listener stays fresh without tearing down Leaflet
  const drawingRef = useRef({
    drawingTool,
    coverageRadiusKm,
    rectFirstCorner,
    polygonVertices,
    measurePoints,
    onCommitSelection,
  });
  drawingRef.current = {
    drawingTool,
    coverageRadiusKm,
    rectFirstCorner,
    polygonVertices,
    measurePoints,
    onCommitSelection,
  };

  // Clear temporary drawing vertices when tool changes
  useEffect(() => {
    setRectFirstCorner(null);
    setPolygonVertices([]);
    if (drawingTool !== 'measure') {
      setMeasurePoints([]);
    }
  }, [drawingTool]);

  // 1. Mount Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: provinceGeo.center,
      zoom: provinceGeo.defaultZoom,
      minZoom: 6,
      maxZoom: 17,
      zoomControl: true,
      scrollWheelZoom: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    canvasRendererRef.current = L.canvas({ padding: 0.4 });
    territoryGroupRef.current = L.layerGroup().addTo(map);
    coverageGroupRef.current = L.layerGroup().addTo(map);
    customerGroupRef.current = L.layerGroup().addTo(map);
    networkGroupRef.current = L.layerGroup().addTo(map);
    competitorGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    draftGroupRef.current = L.layerGroup().addTo(map);

    const syncViewportBounds = () => {
      const b = map.getBounds();
      setViewportBounds({
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      });
    };

    const handleZoomEnd = () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      onZoomChange(z);
      syncViewportBounds();
    };
    map.on('zoomend', handleZoomEnd);
    map.on('moveend', syncViewportBounds);

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const state = drawingRef.current;
      const lat = Number(e.latlng.lat.toFixed(5));
      const lng = Number(e.latlng.lng.toFixed(5));

      if (state.drawingTool === 'radius') {
        const radiusKm = Math.max(1, state.coverageRadiusKm || 5);
        state.onCommitSelection(
          { type: 'radius', center: [lat, lng], radiusKm },
          `Radius ${radiusKm} km (${lat.toFixed(3)}, ${lng.toFixed(3)})`
        );
        return;
      }

      if (state.drawingTool === 'rectangle') {
        if (!state.rectFirstCorner) {
          setRectFirstCorner([lat, lng]);
        } else {
          const [lat1, lng1] = state.rectFirstCorner;
          const south = Math.min(lat1, lat);
          const north = Math.max(lat1, lat);
          const west = Math.min(lng1, lng);
          const east = Math.max(lng1, lng);
          setRectFirstCorner(null);
          state.onCommitSelection(
            { type: 'rectangle', bounds: [[south, west], [north, east]] },
            `Rectangle Selection (${south.toFixed(2)}..${north.toFixed(2)})`
          );
        }
        return;
      }

      if (state.drawingTool === 'polygon') {
        setPolygonVertices((prev) => [...prev, [lat, lng]]);
        return;
      }

      if (state.drawingTool === 'measure') {
        setMeasurePoints((prev) => (prev.length >= 2 ? [[lat, lng]] : [...prev, [lat, lng]]));
      }
    };
    map.on('click', handleMapClick);

    mapRef.current = map;
    setCurrentZoom(map.getZoom());
    onZoomChange(map.getZoom());
    syncViewportBounds();

    return () => {
      map.off('zoomend', handleZoomEnd);
      map.off('moveend', syncViewportBounds);
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger invalidateSize whenever fullscreen or contextual drawer layout changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => {
      map.invalidateSize();
      const b = map.getBounds();
      setViewportBounds({
        south: b.getSouth(),
        north: b.getNorth(),
        west: b.getWest(),
        east: b.getEast(),
      });
    }, 150);
    return () => window.clearTimeout(t);
  }, [isFullscreen, layoutResizeKey]);

  // Recenter on tenant switch or explicit reset
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(provinceGeo.center, provinceGeo.defaultZoom, { animate: false });
    setCurrentZoom(provinceGeo.defaultZoom);
    onZoomChange(provinceGeo.defaultZoom);
  }, [provinceGeo, resetSignal, onZoomChange]);

  // Zoom smoothly to selected territory / district
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedRegionId === 'ALL') {
      map.fitBounds(provinceGeo.bounds, { padding: [26, 26], animate: false });
      return;
    }
    const territory = provinceGeo.territories.find((t) => t.regionId === selectedRegionId);
    if (!territory) return;

    if (selectedDistrictId !== 'ALL' && territory.districtCentroids[selectedDistrictId]) {
      const [lat, lng] = territory.districtCentroids[selectedDistrictId];
      map.setView([lat, lng], 13, { animate: false });
      return;
    }
    const polyBounds = L.polygon(territory.coordinates).getBounds();
    map.fitBounds(polyBounds, { padding: [36, 36], maxZoom: 12, animate: false });
  }, [provinceGeo, selectedRegionId, selectedDistrictId]);

  // Fit to selected filtered customer results when requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitCustomersSignal === 0 || plottableCustomers.length === 0) return;
    const latLngs = plottableCustomers.map((c) => [c.latitude, c.longitude] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14, animate: false });
  }, [fitCustomersSignal, plottableCustomers]);

  // Programmatic zoomTarget (e.g. from Guided Demo or Search result)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zoomTarget) return;
    map.setView([zoomTarget.lat, zoomTarget.lng], zoomTarget.zoom, { animate: false });
  }, [zoomTarget]);

  // 2. Render Territory Polygons & Opportunity Overlay
  useEffect(() => {
    const group = territoryGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.territoryBoundaries && mapMode !== 'opportunity') return;

    const zoneMap = new Map(opportunityZones.map((z) => [z.region_id, z]));

    for (const geo of provinceGeo.territories) {
      const zone = zoneMap.get(geo.regionId);
      if (!zone) continue;

      const isSelected = selectedRegionId === geo.regionId;
      const showOppFill = layers.opportunityOverlay || mapMode === 'opportunity';
      const fillColor = showOppFill ? getOpportunityFill(zone.composite_score) : '#1769AA';

      const poly = L.polygon(geo.coordinates, {
        color: isSelected ? '#102B4D' : showOppFill ? '#102B4D' : '#475569',
        weight: isSelected ? 2.5 : 1.2,
        dashArray: isSelected ? undefined : '4 3',
        fillColor,
        fillOpacity: isSelected ? (showOppFill ? 0.24 : 0.1) : showOppFill ? 0.16 : 0.04,
      });

      poly.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.4;">
          <div style="font-weight:700;color:#102B4D;">${zone.region_name}</div>
          <div>${geoConfig.customerPlural}: <strong>${formatNumber(zone.customer_count)}</strong> · At-Risk: <strong style="color:#D9534F;">${zone.at_risk_count}</strong></div>
          <div>Opportunity: <strong>${zone.composite_score}/100</strong> (${zone.category})</div>
          <div style="color:#64748B;font-size:10px;">Illustrative territory boundary</div>
        </div>`,
        { sticky: true, direction: 'top' }
      );

      poly.on('click', (ev) => {
        if (drawingRef.current.drawingTool !== 'none') return;
        L.DomEvent.stopPropagation(ev);
        onSelectRegion(geo.regionId);
      });

      poly.addTo(group);
    }
  }, [
    provinceGeo,
    opportunityZones,
    selectedRegionId,
    layers.territoryBoundaries,
    layers.opportunityOverlay,
    mapMode,
    geoConfig.customerPlural,
    onSelectRegion,
  ]);

  // 3. Render Heatmap Layer (Density / Value / At-Risk)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    const isHeatmapMode =
      mapMode === 'heatmap_density' ||
      mapMode === 'heatmap_value' ||
      mapMode === 'heatmap_risk';

    if (!isHeatmapMode || plottableCustomers.length === 0) return;

    const maxLtv = Math.max(1, ...plottableCustomers.map((c) => c.lifetime_value));
    const heatType =
      mapMode === 'heatmap_value'
        ? 'value'
        : mapMode === 'heatmap_risk'
          ? 'risk'
          : 'density';

    const points: HeatPoint[] = [];
    for (const c of plottableCustomers) {
      if (heatType === 'risk') {
        if (c.churn_risk < 55 && c.marker_group !== 'at_risk') continue;
        points.push({
          lat: c.latitude,
          lng: c.longitude,
          weight: Math.max(0.4, c.churn_risk / 100),
        });
      } else if (heatType === 'value') {
        points.push({
          lat: c.latitude,
          lng: c.longitude,
          weight: Math.max(0.25, c.lifetime_value / maxLtv),
        });
      } else {
        points.push({ lat: c.latitude, lng: c.longitude, weight: 0.72 });
      }
    }

    const layer = new CanvasHeatmapLayer(points, heatmapIntensity, heatType);
    layer.addTo(map);
    heatmapLayerRef.current = layer;

    return () => {
      if (heatmapLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
    };
  }, [plottableCustomers, mapMode, heatmapIntensity]);

  // 4. Render Customer Clusters OR Individual Customer Markers (strict RBAC + Zoom reconciliation)
  const shouldRenderIndividualPoints = useMemo(() => {
    if (!canViewIndividualCustomers) return false;
    if (
      mapMode === 'heatmap_density' ||
      mapMode === 'heatmap_value' ||
      mapMode === 'heatmap_risk'
    ) {
      return false;
    }
    if (mapMode === 'clusters') return false;
    if (mapMode === 'opportunity') return false;
    // Smart zoom threshold: individual customer markers appear at zoom >= 12 (or when <= 35 filtered points)
    return currentZoom >= 12 || (layers.customerPoints && plottableCustomers.length <= 35);
  }, [
    canViewIndividualCustomers,
    mapMode,
    currentZoom,
    layers.customerPoints,
    plottableCustomers.length,
  ]);

  const clusters = useMemo(() => {
    if (shouldRenderIndividualPoints) return [];
    return computeZoomClusters(customers, currentZoom, provinceGeo);
  }, [customers, currentZoom, provinceGeo, shouldRenderIndividualPoints]);

  useEffect(() => {
    const group = customerGroupRef.current;
    const renderer = canvasRendererRef.current;
    const map = mapRef.current;
    if (!group || !renderer || !map) return;
    group.clearLayers();

    const isHeatmap =
      mapMode === 'heatmap_density' ||
      mapMode === 'heatmap_value' ||
      mapMode === 'heatmap_risk';

    if (isHeatmap) return;
    if (!layers.customerPoints && !layers.customerClusters && mapMode !== 'clusters') return;

    if (shouldRenderIndividualPoints) {
      // Individual pseudonymous validated terrestrial customer markers (never plots invalid/offshore records)
      for (const c of plottableCustomers) {
        const meta = MARKER_GROUP_META[c.marker_group];
        const isSelected = c.customer_id === selectedCustomerId;
        const isUncovered =
          layers.uncoveredHighlight && c.nearest_dealer_distance_km > coverageRadiusKm;
        const isRiskRing = layers.atRiskHighlight && c.marker_group === 'at_risk';
        const isHvRing = layers.highValueHighlight && c.marker_group === 'high_value';

        if (isUncovered) {
          L.circleMarker([c.latitude, c.longitude], {
            renderer,
            radius: 9,
            color: '#D97706',
            weight: 1.5,
            dashArray: '2 2',
            fillOpacity: 0.08,
            fillColor: '#F59E0B',
            interactive: false,
          }).addTo(group);
        }

        const marker = L.circleMarker([c.latitude, c.longitude], {
          renderer,
          radius: isSelected ? 8 : isRiskRing || isHvRing ? 6.5 : 5,
          color: isSelected ? '#102B4D' : isRiskRing ? '#991B1B' : '#FFFFFF',
          weight: isSelected ? 2.5 : 1.2,
          fillColor: meta.color,
          fillOpacity: isSelected ? 1 : 0.88,
        });

        marker.bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.45;">
            <div style="font-weight:700;color:#102B4D;">${c.pseudonym_code} <span style="font-weight:500;color:${meta.color};">(${meta.shortLabel})</span></div>
            <div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#0F172A;">${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)} (EPSG:4326)</div>
            <div>${c.village_name}, ${c.district_name} · ${c.city_name}</div>
            <div>Nearest: ${c.nearest_dealer_name} (${c.nearest_dealer_distance_km} km straight-line)</div>
            <div style="color:#15946A;font-size:10px;">Validated Land Point · Simulated Point (Exact Address Unavailable)</div>
          </div>`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', (ev) => {
          if (drawingRef.current.drawingTool !== 'none') return;
          L.DomEvent.stopPropagation(ev);
          onSelectCustomer(c.customer_id);
        });

        marker.addTo(group);
      }
    } else if (layers.customerClusters || mapMode === 'clusters' || !canViewIndividualCustomers) {
      // Smart zoom-dependent cluster markers anchored to valid on-land members (never offshore)
      for (const cl of clusters) {
        const marker = L.marker([cl.latitude, cl.longitude], {
          icon: createClusterIcon(cl, !canViewIndividualCustomers),
          zIndexOffset: 450,
        });

        marker.bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.45;">
            <div style="font-weight:700;color:#102B4D;">${cl.label}</div>
            <div>Validated ${geoConfig.customerPlural}: <strong>${formatNumber(cl.count)}</strong> · At-Risk: <strong style="color:#D9534F;">${cl.atRiskCount}</strong></div>
            <div>Cumulative LTV: <strong>${formatIdrCompact(cl.totalLtv)}</strong></div>
            <div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#0F172A;">Display Anchor (On-Land): ${cl.latitude.toFixed(4)}, ${cl.longitude.toFixed(4)}</div>
            <div style="font-family:JetBrains Mono,monospace;font-size:10px;color:#64748B;">Math Centroid: ${cl.centroid_latitude.toFixed(4)}, ${cl.centroid_longitude.toFixed(4)}${cl.centroid_was_over_water ? ' (coastal-shifted)' : ''}</div>
            <div style="color:#64748B;font-size:10px;">${
              canViewIndividualCustomers
                ? 'Click to zoom in and inspect individual coordinates'
                : 'Aggregated view (RBAC location privacy active)'
            }</div>
          </div>`,
          { direction: 'top', offset: [0, -14] }
        );

        marker.on('click', (ev) => {
          if (drawingRef.current.drawingTool !== 'none') return;
          L.DomEvent.stopPropagation(ev);
          onSelectRegion(cl.regionId);
          const nextZoom = Math.min(13, Math.max(map.getZoom() + 2, 11));
          map.fitBounds(cl.bounds, { padding: [48, 48], maxZoom: nextZoom, animate: false });
        });

        marker.addTo(group);
      }
    }
  }, [
    plottableCustomers,
    clusters,
    shouldRenderIndividualPoints,
    selectedCustomerId,
    layers.customerPoints,
    layers.customerClusters,
    layers.atRiskHighlight,
    layers.highValueHighlight,
    layers.uncoveredHighlight,
    coverageRadiusKm,
    mapMode,
    canViewIndividualCustomers,
    geoConfig.customerPlural,
    onSelectCustomer,
    onSelectRegion,
  ]);

  // 5. Render Coverage Radius Circles (Dealer Coverage mode always displays radius catchments; Competitor Analysis shows competitor proximity rings)
  useEffect(() => {
    const group = coverageGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (mapMode === 'competitor_analysis' && layers.competitorMode !== 'none') {
      for (const comp of competitors.slice(0, 14)) {
        const isSelComp = comp.competitor_id === selectedCompetitorId;
        L.circle([comp.latitude, comp.longitude], {
          radius: 3000,
          color: '#EA580C',
          weight: isSelComp ? 2.2 : 1.1,
          dashArray: '5 4',
          fillColor: '#F97316',
          fillOpacity: isSelComp ? 0.16 : 0.06,
          interactive: false,
        }).addTo(group);
      }
    }

    const showDealerCircles = layers.coverageRadius || mapMode === 'dealer_coverage';
    if (!showDealerCircles) return;

    const targetDealers =
      mapMode === 'dealer_coverage'
        ? dealers.slice(0, 14)
        : selectedDealerId
          ? dealers.filter((d) => d.dealer_id === selectedDealerId)
          : dealers.slice(0, 10);

    for (const d of targetDealers) {
      const isPrimary = d.dealer_id === selectedDealerId;
      const circle = L.circle([d.latitude, d.longitude], {
        radius: coverageRadiusKm * 1000,
        color: isPrimary ? '#16A6BD' : '#15946A',
        weight: isPrimary ? 2.4 : mapMode === 'dealer_coverage' ? 1.6 : 1.2,
        dashArray: isPrimary ? '6 4' : '4 4',
        fillColor: isPrimary ? '#16A6BD' : '#15946A',
        fillOpacity: isPrimary ? 0.16 : mapMode === 'dealer_coverage' ? 0.1 : 0.05,
        interactive: isPrimary,
      });

      if (isPrimary) {
        circle.bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:11px;">
            <strong>${d.name}</strong><br/>
            Straight-Line Coverage Radius: <strong>${coverageRadiusKm} km</strong><br/>
            ${
              activeCoverage
                ? `Inside: <strong>${activeCoverage.inside_count}</strong> · Outside: <strong>${activeCoverage.outside_count}</strong>`
                : ''
            }
          </div>`,
          { sticky: true }
        );
      }
      circle.addTo(group);
    }
  }, [
    dealers,
    competitors,
    selectedDealerId,
    selectedCompetitorId,
    layers.coverageRadius,
    layers.competitorMode,
    coverageRadiusKm,
    activeCoverage,
    mapMode,
  ]);

  // 6. Render Dealer, Service/AHASS, and Branch Network Markers
  useEffect(() => {
    const group = networkGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const d of dealers) {
      if (d.network_category === 'dealer' && !layers.dealers) continue;
      if (d.network_category === 'service' && !layers.serviceCenters) continue;
      if (d.network_category === 'branch' && !layers.branches) continue;

      const isSelected = d.dealer_id === selectedDealerId;
      const marker = L.marker([d.latitude, d.longitude], {
        icon: createDealerIcon(d, isSelected),
        zIndexOffset: isSelected ? 650 : 260,
      });

      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.45;">
          <div style="font-weight:700;color:#102B4D;">${d.name}</div>
          <div>${d.dealer_type} · Code: <strong>${d.code}</strong></div>
          <div>Assigned: <strong>${d.assigned_customers}</strong> · Capacity: <strong>${d.service_capacity_pct}%</strong></div>
          <div style="color:#64748B;font-size:10px;">Click for Dealer Performance & Coverage</div>
        </div>`,
        { direction: 'top', offset: [0, -12] }
      );

      marker.on('click', (ev) => {
        if (drawingRef.current.drawingTool !== 'none') return;
        L.DomEvent.stopPropagation(ev);
        onSelectDealer(d.dealer_id);
      });

      marker.addTo(group);
    }
  }, [
    dealers,
    selectedDealerId,
    layers.dealers,
    layers.serviceCenters,
    layers.branches,
    onSelectDealer,
  ]);

  // 7. Render Competitor Markers (Illustrative Synthetic Reference)
  useEffect(() => {
    const group = competitorGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (layers.competitorMode === 'none') return;

    for (const comp of competitors) {
      const isSelected = comp.competitor_id === selectedCompetitorId;
      const marker = L.marker([comp.latitude, comp.longitude], {
        icon: createCompetitorIcon(comp, isSelected),
        zIndexOffset: isSelected ? 550 : 250,
      });

      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.45;">
          <div style="font-weight:700;color:#991B1B;">${comp.location_name}</div>
          <div>${comp.category_label}</div>
          <div style="color:#B45309;font-size:10px;">Illustrative Synthetic Reference Data (Demo Only)</div>
        </div>`,
        { direction: 'top', offset: [0, -10] }
      );

      marker.on('click', (ev) => {
        if (drawingRef.current.drawingTool !== 'none') return;
        L.DomEvent.stopPropagation(ev);
        onSelectCompetitor(comp.competitor_id);
      });

      marker.addTo(group);
    }
  }, [competitors, selectedCompetitorId, layers.competitorMode, onSelectCompetitor]);

  // 8. Render Customer-to-Dealer Straight-Line Connections & Committed Geographic Selection Shape
  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // Customer-to-Dealer straight-line relationship (only for validated plottable customer)
    if (canViewIndividualCustomers && layers.customerToDealerLines && selectedCustomerId) {
      const cust = plottableCustomers.find((c) => c.customer_id === selectedCustomerId);
      if (cust) {
        const assigned = dealers.find((d) => d.dealer_id === cust.assigned_dealer_id);
        const nearest = dealers.find((d) => d.dealer_id === cust.nearest_dealer_id);

        if (assigned) {
          const line = L.polyline(
            [
              [cust.latitude, cust.longitude],
              [assigned.latitude, assigned.longitude],
            ],
            {
              color: '#1769AA',
              weight: 2.5,
              dashArray: '6 5',
            }
          );
          line.bindTooltip(
            `Assigned ${geoConfig.dealerLabel}: ${cust.assigned_dealer_distance_km} km (Straight-line geographic relationship — not a road route)`,
            { sticky: true }
          );
          line.addTo(group);
        }

        if (nearest && (!assigned || nearest.dealer_id !== assigned.dealer_id)) {
          const lineNearest = L.polyline(
            [
              [cust.latitude, cust.longitude],
              [nearest.latitude, nearest.longitude],
            ],
            {
              color: '#15946A',
              weight: 2.2,
              dashArray: '3 5',
            }
          );
          lineNearest.bindTooltip(
            `Nearest ${geoConfig.dealerLabel}: ${cust.nearest_dealer_distance_km} km (Straight-line geographic relationship — not a road route)`,
            { sticky: true }
          );
          lineNearest.addTo(group);
        }
      }
    }

    // Active geographic spatial selection overlay
    if (activeSelection) {
      const style: L.PathOptions = {
        color: '#102B4D',
        weight: 2.5,
        dashArray: '7 4',
        fillColor: '#16A6BD',
        fillOpacity: 0.16,
      };
      if (activeSelection.type === 'rectangle') {
        L.rectangle(activeSelection.bounds, style).addTo(group);
      } else if (activeSelection.type === 'polygon' && activeSelection.points.length >= 3) {
        L.polygon(activeSelection.points, style).addTo(group);
      } else if (activeSelection.type === 'radius') {
        L.circle(activeSelection.center, {
          ...style,
          radius: activeSelection.radiusKm * 1000,
        }).addTo(group);
      }
    }
  }, [
    canViewIndividualCustomers,
    layers.customerToDealerLines,
    selectedCustomerId,
    plottableCustomers,
    dealers,
    activeSelection,
    geoConfig.dealerLabel,
  ]);

  // 9. Render In-Progress Drawing Vertices & Measurement Ruler
  useEffect(() => {
    const group = draftGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (rectFirstCorner) {
      L.circleMarker(rectFirstCorner, {
        radius: 6,
        color: '#102B4D',
        fillColor: '#16A6BD',
        fillOpacity: 1,
      })
        .bindTooltip('Corner 1 set — click opposite corner', { permanent: true, direction: 'top' })
        .addTo(group);
    }

    if (polygonVertices.length > 0) {
      polygonVertices.forEach((pt, idx) => {
        L.circleMarker(pt, {
          radius: 5,
          color: '#102B4D',
          fillColor: '#16A6BD',
          fillOpacity: 1,
        })
          .bindTooltip(`V${idx + 1}`, { direction: 'top' })
          .addTo(group);
      });
      if (polygonVertices.length >= 2) {
        L.polyline(polygonVertices, {
          color: '#102B4D',
          weight: 2,
          dashArray: '5 4',
        }).addTo(group);
      }
    }

    if (measurePoints.length > 0) {
      measurePoints.forEach((pt, idx) => {
        L.circleMarker(pt, {
          radius: 5,
          color: '#102B4D',
          fillColor: '#F59E0B',
          fillOpacity: 1,
        })
          .bindTooltip(idx === 0 ? 'Point A' : 'Point B', { permanent: true, direction: 'top' })
          .addTo(group);
      });
      if (measurePoints.length === 2) {
        const [a, b] = measurePoints;
        const km = haversineDistanceKm(a[0], a[1], b[0], b[1]);
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        L.polyline([a, b], { color: '#D97706', weight: 2.5, dashArray: '6 4' }).addTo(group);
        L.marker(mid, {
          icon: L.divIcon({
            className: 'serveon-measure-label',
            iconSize: [148, 26],
            iconAnchor: [74, 13],
            html: `<div style="background:#102B4D;color:#fff;font-family:JetBrains Mono,monospace;font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;text-align:center;border:1px solid #16A6BD;white-space:nowrap;">${km.toFixed(2)} km straight-line</div>`,
          }),
        }).addTo(group);
      }
    }
  }, [rectFirstCorner, polygonVertices, measurePoints]);

  const measureDistanceKm =
    measurePoints.length === 2
      ? haversineDistanceKm(
          measurePoints[0][0],
          measurePoints[0][1],
          measurePoints[1][0],
          measurePoints[1][1]
        )
      : null;

  const isHeatmapActive =
    mapMode === 'heatmap_density' || mapMode === 'heatmap_value' || mapMode === 'heatmap_risk';

  const mapCounts = useMemo(
    () => computeCustomerMapCounts(customers, viewportBounds),
    [customers, viewportBounds]
  );

  const modeStatusLabel = isHeatmapActive
    ? mapMode === 'heatmap_value'
      ? 'Customer Heatmap · Value'
      : mapMode === 'heatmap_risk'
        ? 'Customer Heatmap · At-Risk'
        : 'Customer Heatmap · Density'
    : mapMode === 'dealer_coverage'
      ? `Dealer Coverage (${coverageRadiusKm} km)`
      : mapMode === 'competitor_analysis'
        ? `Competitor Analysis (${competitors.length} ref)`
        : mapMode === 'opportunity'
          ? 'Market Opportunity'
          : shouldRenderIndividualPoints
            ? `Customer Points (${formatNumber(plottableCustomers.length)})`
            : `Clusters (${clusters.length} groups · ${formatNumber(plottableCustomers.length)})`;

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-slate-100 ${
        isFullscreen
          ? 'h-[calc(100vh-172px)] min-h-[520px] w-full'
          : 'h-[calc(100vh-196px)] min-h-[520px] w-full'
      }`}
    >
      {/* Leaflet Canvas Surface */}
      <div
        ref={containerRef}
        data-testid="advanced-leaflet-map"
        data-zoom={currentZoom}
        data-mode={mapMode}
        data-visible-customers={customers.length}
        data-mapped-customers={mapCounts.mapped}
        data-unmapped-customers={mapCounts.unmapped}
        data-invalid-customers={mapCounts.invalid}
        data-viewport-visible={mapCounts.visible}
        data-cluster-count={clusters.length}
        data-individual-mode={shouldRenderIndividualPoints ? 'true' : 'false'}
        className={`h-full w-full z-0 ${drawingTool !== 'none' ? 'cursor-crosshair' : ''}`}
      />

      {/* Top-Left Floating Customer Count Indicator: Total | Mapped | Visible | Unmapped */}
      <div
        data-testid="floating-customer-counts"
        aria-label="Customer map coverage counts"
        className="pointer-events-auto absolute left-14 top-3 z-[420] hidden items-center divide-x divide-slate-200 rounded-lg border border-slate-200/90 bg-white/95 text-[11px] shadow-sm backdrop-blur sm:flex"
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="text-slate-500">Total</span>
          <span className="font-mono font-bold text-[#102B4D] tabular-nums">
            {formatNumber(mapCounts.total)}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5"
          title="Validated on-land customer points safe to display on map"
        >
          <span className="text-slate-500">Mapped</span>
          <span className="font-mono font-bold text-[#15946A] tabular-nums">
            {formatNumber(mapCounts.mapped)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span className="text-slate-500">Visible</span>
          <span className="font-mono font-bold text-[#1769AA] tabular-nums">
            {formatNumber(mapCounts.visible)}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5"
          title={`Quarantined Invalid Coordinates: ${mapCounts.invalid} · Not Geocoded: ${mapCounts.notGeocoded}`}
        >
          <span className="text-slate-500">Unmapped</span>
          <span
            className={`font-mono font-bold tabular-nums ${
              mapCounts.unmapped > 0 ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            {formatNumber(mapCounts.unmapped)}
          </span>
        </div>
      </div>

      {/* Floating Overlay Slot (Compact Floating Layers / Filters Panel over Map) */}
      {floatingOverlay}

      {/* Top-Right Compact Map Status & Fullscreen Bar */}
      <div className="pointer-events-none absolute right-3 top-3 z-[420] flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm backdrop-blur">
          <span className="font-mono font-semibold text-[#102B4D]">Zoom {currentZoom}</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium whitespace-nowrap">{modeStatusLabel}</span>
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen map' : 'Enter fullscreen map'}
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* RBAC Privacy Notice when role cannot view precise customer coordinates */}
        {!canViewIndividualCustomers && (
          <div
            data-testid="rbac-location-privacy-banner"
            className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50/95 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 shadow-sm"
          >
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <span>
              Aggregated Privacy Mode: Precise customer coordinates restricted (requires{' '}
              <code>location.view_precise_customer</code>)
            </span>
          </div>
        )}
      </div>

      {/* Active Drawing / Distance Measurement Banner */}
      {drawingTool !== 'none' && (
        <div className="absolute left-1/2 top-3 z-[430] flex -translate-x-1/2 items-center gap-2.5 rounded-lg border border-[#16A6BD] bg-[#102B4D] px-3.5 py-2 text-xs text-white shadow-md">
          {drawingTool === 'measure' ? (
            <Ruler className="h-3.5 w-3.5 shrink-0 text-[#16A6BD]" />
          ) : (
            <Crosshair className="h-3.5 w-3.5 shrink-0 text-[#16A6BD]" />
          )}
          <span>
            {drawingTool === 'rectangle' &&
              (rectFirstCorner
                ? 'Click opposite corner on the map to complete Rectangle selection'
                : 'Click Corner 1 on the map to start Rectangle selection')}
            {drawingTool === 'radius' &&
              `Click map center to select all points within ${coverageRadiusKm} km straight-line radius`}
            {drawingTool === 'polygon' &&
              `Click map to add Polygon vertices (${polygonVertices.length} placed)`}
            {drawingTool === 'measure' &&
              (measureDistanceKm !== null
                ? `Measured straight-line distance: ${measureDistanceKm.toFixed(2)} km (${Math.round(measureDistanceKm * 1000)} m)`
                : measurePoints.length === 1
                  ? 'Click Point B to calculate straight-line Haversine distance'
                  : 'Click Point A on the map to measure straight-line distance')}
          </span>
          {drawingTool === 'polygon' && polygonVertices.length >= 3 && (
            <button
              type="button"
              onClick={() => {
                onCommitSelection(
                  { type: 'polygon', points: polygonVertices },
                  `Custom Polygon (${polygonVertices.length} vertices)`
                );
                setPolygonVertices([]);
              }}
              className="inline-flex items-center gap-1 rounded bg-[#16A6BD] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#138fa3]"
            >
              <Check className="h-3 w-3" />
              Finish Polygon
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRectFirstCorner(null);
              setPolygonVertices([]);
              setMeasurePoints([]);
              onClearDrawingTool();
            }}
            aria-label="Cancel map tool"
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bottom-Right Collapsible Map Legend */}
      <div
        className={`absolute bottom-3 right-3 z-[420] rounded-lg border border-slate-200 bg-white/95 text-[11px] shadow-sm backdrop-blur ${
          legendExpanded ? 'w-60' : 'w-auto'
        }`}
      >
        <button
          type="button"
          onClick={() => setLegendExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 font-semibold text-[#102B4D]"
        >
          <span>Map Legend & Data Notice</span>
          {legendExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        {legendExpanded && (
          <div className="max-h-[260px] space-y-2 overflow-y-auto border-t border-slate-100 px-3 py-2 text-[10.5px] text-slate-600">
            {isHeatmapActive ? (
              <div>
                <div className="font-semibold text-slate-800">
                  {mapMode === 'heatmap_risk'
                    ? 'At-Risk Density Scale'
                    : mapMode === 'heatmap_value'
                      ? 'Cumulative LTV Scale'
                      : 'Customer Concentration Scale'}
                </div>
                <div
                  className="mt-1 h-2 w-full rounded"
                  style={{
                    background:
                      mapMode === 'heatmap_risk'
                        ? 'linear-gradient(90deg, #F5B342, #EA683A, #CC2B2B)'
                        : mapMode === 'heatmap_value'
                          ? 'linear-gradient(90deg, #16A6BD, #15946A, #D97706)'
                          : 'linear-gradient(90deg, #16A6BD, #1769AA, #EA9E24, #D9534F)',
                  }}
                />
                <div className="mt-0.5 flex justify-between text-[9.5px] text-slate-500">
                  <span>Lower</span>
                  <span>Moderate</span>
                  <span>Higher</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                {Object.entries(MARKER_GROUP_META).map(([key, m]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-xs"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="truncate">{m.shortLabel}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-slate-100 pt-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[#15946A] text-[8px] font-bold text-white">
                  D
                </span>
                <span className="truncate">{geoConfig.dealerLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-white">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </span>
                <span className="truncate">{geoConfig.serviceLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[#102B4D] text-[8px] font-bold text-white">
                  B
                </span>
                <span className="truncate">Branch Office</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
                  <polygon points="12,2 22,20 2,20" fill="#F97316" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span className="truncate">Competitor (Sim)</span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-1.5 text-[9.5px] leading-snug text-slate-500">
              WGS-84 · Synthetic demo coordinates & illustrative polygons. Radii and lines indicate
              straight-line geographic distance (not road routes).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

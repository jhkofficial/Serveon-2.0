import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { BranchRecord, IndustryProfile, Tenant } from '../../types/platform';
import type { TerritoryDetailedIntelligence } from '../../core/analytics/customerLocationService';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';

interface IndonesiaLeafletMapProps {
  tenant: Tenant;
  industry: IndustryProfile;
  territories: TerritoryDetailedIntelligence[];
  selectedRegionId: string;
  selectedDistrictId: string;
  showOpportunityLayer: boolean;
  showCustomersLayer: boolean;
  showBranchLayer: boolean;
  showCoverageRadius: boolean;
  resetSignal: number;
  onSelectRegion: (regionId: string) => void;
}

function getOpportunityFillColor(score: number): string {
  if (score >= 88) return '#102B4D';
  if (score >= 82) return '#1769AA';
  if (score >= 76) return '#16A6BD';
  return '#64A6C9';
}

export function IndonesiaLeafletMap({
  tenant,
  industry,
  territories,
  selectedRegionId,
  selectedDistrictId,
  showOpportunityLayer,
  showCustomersLayer,
  showBranchLayer,
  showCoverageRadius,
  resetSignal,
  onSelectRegion,
}: IndonesiaLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectRegion);
  onSelectRef.current = onSelectRegion;

  // Mount Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const provinceGeo = getProvinceMapConfig(tenant);
    const map = L.map(containerRef.current, {
      center: provinceGeo.center,
      zoom: provinceGeo.defaultZoom,
      zoomControl: false,
      attributionControl: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      minZoom: 5,
      maxZoom: 15,
    });

    // Standard OpenStreetMap basemap tiles (no API key watermark; gracefully falls back to #EAF2F8 canvas + WGS-84 polygons if offline)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors · Illustrative Demo Polygons',
      maxZoom: 18,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      try {
        map.stop();
        group.clearLayers();
        map.remove();
      } catch {
        // Ignore cleanup errors if container was detached early
      }
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center bounds when tenant changes or resetSignal increments
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;
    const provinceGeo = getProvinceMapConfig(tenant);
    map.stop();
    map.fitBounds(provinceGeo.bounds, {
      padding: [24, 24],
      maxZoom: provinceGeo.defaultZoom + 1,
      animate: false,
    });
  }, [tenant, resetSignal]);

  // Focus map when a specific regency or district is selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !containerRef.current) return;
    const provinceGeo = getProvinceMapConfig(tenant);
    map.stop();
    if (selectedRegionId === 'ALL') {
      map.fitBounds(provinceGeo.bounds, {
        padding: [24, 24],
        maxZoom: provinceGeo.defaultZoom + 1,
        animate: false,
      });
      return;
    }
    const poly = provinceGeo.territories.find((t) => t.regionId === selectedRegionId);
    if (!poly) return;

    if (selectedDistrictId !== 'ALL' && poly.districtCentroids[selectedDistrictId]) {
      map.setView(poly.districtCentroids[selectedDistrictId], Math.min(13, provinceGeo.defaultZoom + 3), {
        animate: false,
      });
    } else {
      const bounds = L.latLngBounds(poly.coordinates);
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: provinceGeo.defaultZoom + 2,
        animate: false,
      });
    }
  }, [tenant, selectedRegionId, selectedDistrictId]);

  // Render interactive vector layers (Polygons, Customer Distribution, Branch Coverage)
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const provinceGeo = getProvinceMapConfig(tenant);
    const territoryMap = new Map(territories.map((t) => [t.regionId, t]));

    for (const polyDef of provinceGeo.territories) {
      const intel = territoryMap.get(polyDef.regionId);
      if (!intel) continue;

      const isSelected = selectedRegionId === polyDef.regionId;
      const fillColor = getOpportunityFillColor(intel.opportunityScore);

      // 1. Territory Polygon Layer (Opportunity Choropleth or Subtle Boundary)
      const polygon = L.polygon(polyDef.coordinates, {
        color: isSelected ? '#102B4D' : '#1769AA',
        weight: isSelected ? 2.5 : 1.25,
        fillColor: showOpportunityLayer ? fillColor : '#FFFFFF',
        fillOpacity: showOpportunityLayer ? (isSelected ? 0.34 : 0.18) : isSelected ? 0.15 : 0.05,
        dashArray: isSelected ? undefined : '4 3',
      });

      polygon.bindTooltip(
        `<div style="line-height:1.4">
          <div style="font-weight:700;color:#102B4D">${intel.regionName}</div>
          <div style="color:#475569">${formatNumber(intel.customerCount)} ${industry.terminology.customerPlural} · Opp. ${intel.opportunityScore}/100</div>
          <div style="color:#64748B">LTV ${formatIdrCompact(intel.cumulativeLtv)} · ${intel.atRiskCount} At-Risk</div>
        </div>`,
        { sticky: true, className: 'serveon-leaflet-tooltip' }
      );

      polygon.on('click', () => {
        onSelectRef.current(isSelected ? 'ALL' : polyDef.regionId);
      });

      polygon.addTo(group);

      // 2. Customer Distribution Proportional Bubble Layer
      if (showCustomersLayer) {
        const radiusPx = Math.max(11, Math.min(26, 7 + Math.sqrt(intel.customerCount) * 1.15));
        const bubble = L.circleMarker(polyDef.center, {
          radius: radiusPx,
          color: '#FFFFFF',
          weight: 2,
          fillColor: isSelected ? '#102B4D' : '#1769AA',
          fillOpacity: 0.9,
        });

        bubble.bindTooltip(
          `<div style="line-height:1.4">
            <div style="font-weight:700;color:#102B4D">${intel.regionName}</div>
            <div>${formatNumber(intel.customerCount)} ${industry.terminology.customerPlural} (${intel.activeRatePct}% active)</div>
            <div style="color:#D9534F">${intel.atRiskCount} at-risk · ${intel.highPropensityCount} high-propensity</div>
          </div>`,
          { direction: 'top', offset: [0, -8], className: 'serveon-leaflet-tooltip' }
        );

        bubble.on('click', () => {
          onSelectRef.current(isSelected ? 'ALL' : polyDef.regionId);
        });

        bubble.addTo(group);

        // Permanent concise count badge on bubble using DivIcon
        const labelMarker = L.marker(polyDef.center, {
          interactive: false,
          zIndexOffset: 600,
          icon: L.divIcon({
            className: 'serveon-count-label',
            html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:20px;margin-left:-18px;margin-top:-10px;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#ffffff;pointer-events:none;text-shadow:0 1px 2px rgba(10,29,54,0.65)">${intel.customerCount}</div>`,
            iconSize: [0, 0],
          }),
        });
        labelMarker.addTo(group);

        // When a regency is selected, show its constituent district cluster pins
        if (isSelected) {
          for (const [distId, distCoords] of Object.entries(polyDef.districtCentroids)) {
            const isDistSelected = selectedDistrictId === distId;
            const distPin = L.circleMarker(distCoords, {
              radius: isDistSelected ? 8 : 5.5,
              color: '#102B4D',
              weight: 1.5,
              fillColor: '#16A6BD',
              fillOpacity: 0.95,
            });
            distPin.addTo(group);
          }
        }
      }

      // 3. Branch Coverage Pins & Service Catchment Radius
      if (showBranchLayer) {
        intel.branches.forEach((br: BranchRecord, brIdx: number) => {
          const brCoords: [number, number] = [br.lat, br.lng];

          if (showCoverageRadius) {
            L.circle(brCoords, {
              radius: polyDef.coverageRadiusMeters,
              color: '#15946A',
              weight: 1,
              fillColor: '#15946A',
              fillOpacity: 0.08,
              interactive: false,
            }).addTo(group);
          }

          // Slightly offset visual branch pin if it overlaps the territory customer count bubble
          const nearCenter =
            showCustomersLayer &&
            Math.abs(br.lat - polyDef.center[0]) < 0.015 &&
            Math.abs(br.lng - polyDef.center[1]) < 0.015;
          const pinCoords: [number, number] = nearCenter
            ? [br.lat - 0.016 - brIdx * 0.008, br.lng + 0.022]
            : brCoords;

          const branchPin = L.marker(pinCoords, {
            zIndexOffset: 400,
            icon: L.divIcon({
              className: 'serveon-branch-pin',
              html: `<div style="width:12px;height:12px;margin-left:-6px;margin-top:-6px;background:#15946A;border:2px solid #FFFFFF;border-radius:3px;box-shadow:0 1px 4px rgba(15,23,42,0.35);"></div>`,
              iconSize: [0, 0],
            }),
          });

          branchPin.bindTooltip(
            `<div style="line-height:1.4">
              <div style="font-weight:700;color:#15946A">${br.name}</div>
              <div style="color:#475569">${br.code} · ${br.type}</div>
              <div style="color:#64748B">Capacity Score: ${br.capacityScore}%</div>
            </div>`,
            { direction: 'top', offset: [0, -6], className: 'serveon-leaflet-tooltip' }
          );

          branchPin.on('click', () => {
            onSelectRef.current(br.region_id);
          });

          branchPin.addTo(group);
        });
      }
    }
  }, [
    tenant,
    industry,
    territories,
    selectedRegionId,
    selectedDistrictId,
    showOpportunityLayer,
    showCustomersLayer,
    showBranchLayer,
    showCoverageRadius,
  ]);

  return (
    <div className="relative h-[460px] w-full">
      <div
        ref={containerRef}
        data-testid="indonesia-leaflet-map"
        aria-label={`Interactive Leaflet geographic map of ${tenant.primaryProvinceName}, Indonesia`}
        className="serveon-leaflet-map h-full w-full"
      />

      {/* Map Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1769AA]" />
            {industry.terminology.customerPlural}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs border border-[#1769AA] bg-[#16A6BD]/30" />
            Opportunity Zone
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#15946A]" />
            {industry.terminology.branchSingular}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-[#15946A] bg-[#15946A]/15" />
            Service Catchment
          </span>
        </div>
      </div>
    </div>
  );
}

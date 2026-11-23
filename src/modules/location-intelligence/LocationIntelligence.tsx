import React, { useMemo, useState } from 'react';
import {
  RotateCcw,
  Layers,
  Building2,
  MapPin,
  Users,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { PageHeader } from '../../components/PageHeader';
import { formatIdrCompact, formatNumber } from '../../core/analytics/kpiEngine';
import { computeTerritoryIntelligence } from '../../core/analytics/customerLocationService';
import { getProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import { IndonesiaLeafletMap } from './IndonesiaLeafletMap';

export function LocationIntelligence() {
  const {
    activeTenant,
    activeIndustry,
    scopedCustomers,
    permittedRegionIds,
    filters,
    geoDrilldown,
    setGeoDrilldown,
    openCustomersForTerritorySegment,
    openCustomer360,
  } = usePlatform();

  const [showOpportunityLayer, setShowOpportunityLayer] = useState(true);
  const [showCustomersLayer, setShowCustomersLayer] = useState(true);
  const [showBranchLayer, setShowBranchLayer] = useState(true);
  const [showCoverageRadius, setShowCoverageRadius] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);

  const selectedRegencyId = filters.regionId;
  const selectedDistrictId = geoDrilldown.districtId;
  const selectedVillageId = geoDrilldown.villageId;

  const permittedRegencies = useMemo(
    () => activeTenant.province.regencies.filter((r) => permittedRegionIds.includes(r.id)),
    [activeTenant, permittedRegionIds]
  );

  const provinceGeo = useMemo(() => getProvinceMapConfig(activeTenant), [activeTenant]);

  const activeRegency = permittedRegencies.find((r) => r.id === selectedRegencyId) ?? null;
  const districts = activeRegency ? activeRegency.districts : [];
  const activeDistrict = districts.find((d) => d.id === selectedDistrictId) ?? null;
  const villages = activeDistrict ? activeDistrict.villages : [];

  const territoryIntelligence = useMemo(
    () => computeTerritoryIntelligence(activeTenant, scopedCustomers, permittedRegionIds),
    [activeTenant, scopedCustomers, permittedRegionIds]
  );

  const geoCustomers = useMemo(() => {
    return scopedCustomers.filter((c) => {
      if (selectedRegencyId !== 'ALL' && c.region_id !== selectedRegencyId) return false;
      if (selectedDistrictId !== 'ALL' && c.district_id !== selectedDistrictId) return false;
      if (selectedVillageId !== 'ALL' && c.village_id !== selectedVillageId) return false;
      return true;
    });
  }, [scopedCustomers, selectedRegencyId, selectedDistrictId, selectedVillageId]);

  const selectedTerritory =
    territoryIntelligence.find((t) => t.regionId === selectedRegencyId) ?? null;

  const activeGeoSummary = useMemo(() => {
    const totalLtv = geoCustomers.reduce((acc, c) => acc + c.lifetime_value, 0);
    const atRiskCount = geoCustomers.filter(
      (c) => c.model_outputs.churn_risk_category === 'High' || c.status === 'At-Risk'
    ).length;
    const oppScore =
      geoCustomers.length > 0
        ? (
            geoCustomers.reduce((acc, c) => acc + c.model_outputs.geographic_opportunity_score, 0) /
            geoCustomers.length
          ).toFixed(1)
        : '0.0';
    const segmentCounts = [
      'High-Value Loyal',
      'Growth Potential',
      'Core Active',
      'At-Risk Retention',
      'New Onboarding',
    ].map((seg) => {
      const count = geoCustomers.filter((c) => c.customer_segment === seg).length;
      return {
        segment: seg,
        count,
        sharePct: geoCustomers.length > 0 ? Number(((count / geoCustomers.length) * 100).toFixed(1)) : 0,
      };
    });

    const topAccounts = [...geoCustomers]
      .sort((a, b) => b.lifetime_value - a.lifetime_value)
      .slice(0, 4);

    return {
      totalLtv,
      atRiskCount,
      oppScore,
      segmentCounts,
      topAccounts,
    };
  }, [geoCustomers]);

  const activeTerritoryTitle =
    selectedVillageId !== 'ALL' && activeDistrict
      ? `${villages.find((v) => v.id === selectedVillageId)?.name ?? selectedVillageId}, ${activeDistrict.name}`
      : selectedDistrictId !== 'ALL' && activeDistrict
        ? `${activeDistrict.name} · ${activeRegency?.name ?? ''}`
        : selectedTerritory
          ? selectedTerritory.regionName
          : `All ${activeTenant.primaryProvinceName}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location Intelligence"
        subtitle={`Interactive Indonesian geographic map, ${activeIndustry.terminology.branchSingular.toLowerCase()} coverage, territory opportunity scoring, and direct customer segment drill-down.`}
        metaItems={[
          'BM03',
          'Interactive Leaflet Map · Illustrative Territory Polygons',
          `Province: ${activeTenant.primaryProvinceName}, Indonesia`,
          `${permittedRegencies.length} Permitted Territories`,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                openCustomersForTerritorySegment({
                  regionId: selectedRegencyId,
                  districtId: selectedDistrictId,
                  villageId: selectedVillageId,
                  segment: 'ALL',
                })
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D] whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Open Matched Customers ({formatNumber(geoCustomers.length)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setGeoDrilldown({ regionId: 'ALL', districtId: 'ALL', villageId: 'ALL' });
                setResetSignal((n) => n + 1);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Map</span>
            </button>
          </div>
        }
      />

      {/* Hierarchical Indonesia Filters: Province -> Regency/City -> District -> Village */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="geo-province" className="block text-[11px] font-semibold text-slate-500">
            Province (Indonesia)
          </label>
          <select
            id="geo-province"
            value={activeTenant.primaryProvinceId}
            disabled
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value={activeTenant.primaryProvinceId}>
              {activeTenant.primaryProvinceName}
            </option>
          </select>
        </div>

        <div>
          <label htmlFor="geo-regency" className="block text-[11px] font-semibold text-slate-500">
            Regency / City (Kabupaten / Kota)
          </label>
          <select
            id="geo-regency"
            value={selectedRegencyId}
            onChange={(e) =>
              setGeoDrilldown({ regionId: e.target.value, districtId: 'ALL', villageId: 'ALL' })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-[#1769AA] focus:outline-none"
          >
            {permittedRegencies.length > 1 && (
              <option value="ALL">All Permitted Regencies ({permittedRegencies.length})</option>
            )}
            {permittedRegencies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="geo-district" className="block text-[11px] font-semibold text-slate-500">
            District (Kecamatan)
          </label>
          <select
            id="geo-district"
            value={selectedDistrictId}
            disabled={!activeRegency}
            onChange={(e) => setGeoDrilldown({ districtId: e.target.value, villageId: 'ALL' })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-[#1769AA] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="ALL">
              {activeRegency ? `All Districts (${districts.length})` : 'Select a Regency first'}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="geo-village" className="block text-[11px] font-semibold text-slate-500">
            Village / Urban Village (Desa / Kelurahan)
          </label>
          <select
            id="geo-village"
            value={selectedVillageId}
            disabled={!activeDistrict}
            onChange={(e) => setGeoDrilldown({ villageId: e.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-[#1769AA] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="ALL">
              {activeDistrict ? `All Villages (${villages.length})` : 'Select a District first'}
            </option>
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Map + Selected Territory Detail Panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Interactive Leaflet Map Card */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                {activeTenant.primaryProvinceName} Interactive Geographic Map
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {provinceGeo.boundaryNotice} Click any territory polygon or marker to filter.
              </p>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-slate-500">
              WGS-84 · Demo Data
            </span>
          </div>

          {/* Interactive Layer Toggles */}
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Map Layers:
            </span>
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={showOpportunityLayer}
                onChange={(e) => setShowOpportunityLayer(e.target.checked)}
                className="rounded border-slate-300 text-[#1769AA]"
              />
              <span>Opportunity Zones</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={showCustomersLayer}
                onChange={(e) => setShowCustomersLayer(e.target.checked)}
                className="rounded border-slate-300 text-[#1769AA]"
              />
              <span>{activeIndustry.terminology.customerSingular} Distribution</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={showBranchLayer}
                onChange={(e) => setShowBranchLayer(e.target.checked)}
                className="rounded border-slate-300 text-[#1769AA]"
              />
              <span>{activeIndustry.terminology.branchPlural}</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <input
                type="checkbox"
                checked={showCoverageRadius}
                disabled={!showBranchLayer}
                onChange={(e) => setShowCoverageRadius(e.target.checked)}
                className="rounded border-slate-300 text-[#1769AA] disabled:opacity-40"
              />
              <span>Coverage Catchment</span>
            </label>
          </div>

          <IndonesiaLeafletMap
            tenant={activeTenant}
            industry={activeIndustry}
            territories={territoryIntelligence}
            selectedRegionId={selectedRegencyId}
            selectedDistrictId={selectedDistrictId}
            showOpportunityLayer={showOpportunityLayer}
            showCustomersLayer={showCustomersLayer}
            showBranchLayer={showBranchLayer}
            showCoverageRadius={showCoverageRadius}
            resetSignal={resetSignal}
            onSelectRegion={(regionId) =>
              setGeoDrilldown({ regionId, districtId: 'ALL', villageId: 'ALL' })
            }
          />
        </div>

        {/* Selected Territory Detail Panel + Connected Segment Drill-down */}
        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#1769AA]">Selected Territory Detail</span>
              <span className="text-[11px] text-slate-500">Demo Data · Synced</span>
            </div>

            <h2 className="mt-1 text-lg font-bold text-slate-900">{activeTerritoryTitle}</h2>
            {selectedTerritory && (
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                Lat {selectedTerritory.lat.toFixed(4)}, Lng {selectedTerritory.lng.toFixed(4)} ·
                Pop. {selectedTerritory.populationThousands.toLocaleString('en-US')}K · Coverage:{' '}
                <span
                  className={
                    selectedTerritory.coverageStatus === 'Underserved'
                      ? 'font-semibold text-[#B47815]'
                      : 'font-semibold text-[#15946A]'
                  }
                >
                  {selectedTerritory.coverageStatus}
                </span>
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3.5 border-y border-slate-100 py-3.5 text-xs">
              <div>
                <dt className="text-slate-500">Matched {activeIndustry.terminology.customerPlural}</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {formatNumber(geoCustomers.length)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Opportunity Score</dt>
                <dd className="mt-0.5 font-mono text-lg font-semibold text-[#16A6BD] tabular-nums">
                  {activeGeoSummary.oppScore} / 100
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Cumulative LTV</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold text-slate-900 tabular-nums">
                  {formatIdrCompact(activeGeoSummary.totalLtv)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">At-Risk Accounts</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-mono text-base font-semibold text-[#D9534F] tabular-nums">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formatNumber(activeGeoSummary.atRiskCount)}
                </dd>
              </div>
            </dl>

            {/* Territory Customer Segments -> Click to explore segment in Customer Intelligence */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Territory Segments (Click to Explore)
                </span>
                <span className="text-[11px] text-slate-500">→ Customer Intelligence</span>
              </div>
              <div className="mt-2.5 divide-y divide-slate-100 text-xs">
                {activeGeoSummary.segmentCounts.map((seg) => (
                  <button
                    key={seg.segment}
                    type="button"
                    disabled={seg.count === 0}
                    onClick={() =>
                      openCustomersForTerritorySegment({
                        regionId: selectedRegencyId,
                        districtId: selectedDistrictId,
                        villageId: selectedVillageId,
                        segment: seg.segment,
                      })
                    }
                    className="flex w-full items-center justify-between py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="font-medium text-slate-800">{seg.segment}</span>
                    <span className="inline-flex items-center gap-2 font-mono text-slate-700 tabular-nums">
                      <span>
                        {seg.count} ({seg.sharePct}%)
                      </span>
                      <ArrowRight className="h-3 w-3 text-[#1769AA]" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top Accounts in Selected Territory -> Direct to Customer 360 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Top {activeIndustry.terminology.customerPlural} in Territory
              </h3>
              <span className="text-[11px] text-slate-500">By LTV</span>
            </div>
            {activeGeoSummary.topAccounts.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                No records match this village/district filter.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 text-xs">
                {activeGeoSummary.topAccounts.map((cust) => (
                  <div key={cust.customer_id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 pr-2">
                      <div className="truncate font-semibold text-slate-900">{cust.full_name}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        {cust.customer_segment} · {formatIdrCompact(cust.lifetime_value)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCustomer360(cust.customer_id)}
                      className="shrink-0 font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                    >
                      View 360
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Split: Territory Opportunity Ranking Table + Branch Coverage Matrix */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Territory Opportunity Ranking ({activeTenant.primaryProvinceName})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ranked by composite Geographic Opportunity Score · Illustrative Spatial Model
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3 font-semibold">Rank</th>
                  <th className="px-3 py-2.5 font-semibold">Regency / City</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {activeIndustry.terminology.customerPlural}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">Coverage</th>
                  <th className="px-3 py-2.5 text-right font-semibold">At-Risk</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Opportunity</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">Drill-Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {territoryIntelligence.map((row, index) => {
                  const isSel = selectedRegencyId === row.regionId;
                  return (
                    <tr
                      key={row.regionId}
                      className={`transition-colors ${isSel ? 'bg-[#F0F7FC]' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3 pr-3 font-mono font-semibold text-slate-500">
                        #{index + 1}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#1769AA]" />
                          {row.regionName}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatNumber(row.customerCount)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-medium ${
                            row.coverageStatus === 'Underserved'
                              ? 'text-[#B47815]'
                              : row.coverageStatus === 'Strong'
                                ? 'text-[#15946A]'
                                : 'text-slate-700'
                          }`}
                        >
                          {row.coverageStatus} ({row.branchCount})
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[#D9534F] tabular-nums">
                        {formatNumber(row.atRiskCount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold text-[#16A6BD] tabular-nums">
                        {row.opportunityScore} / 100
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setGeoDrilldown({
                                regionId: isSel ? 'ALL' : row.regionId,
                                districtId: 'ALL',
                                villageId: 'ALL',
                              })
                            }
                            className="font-semibold text-[#1769AA] hover:underline whitespace-nowrap"
                          >
                            {isSel ? 'Clear' : 'Focus Map'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openCustomersForTerritorySegment({
                                regionId: row.regionId,
                                districtId: 'ALL',
                                villageId: 'ALL',
                                segment: 'ALL',
                              })
                            }
                            className="font-semibold text-slate-700 hover:text-[#102B4D] hover:underline whitespace-nowrap"
                          >
                            Customers
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Branch Coverage Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-4">
          <h2 className="text-base font-semibold text-slate-900">
            {activeIndustry.terminology.branchSingular} Network Coverage
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {selectedTerritory
              ? `Branches serving ${selectedTerritory.regionName}`
              : `Active branches across ${activeTenant.primaryProvinceName}`}
          </p>
          <div className="mt-4 divide-y divide-slate-100 text-xs">
            {(selectedTerritory
              ? selectedTerritory.branches
              : activeTenant.branches.filter((b) => permittedRegionIds.includes(b.region_id))
            ).map((br) => (
              <div key={br.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-[#15946A]" />
                    <span className="truncate">{br.name}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {br.code} · {br.type}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-slate-700 tabular-nums">
                  Cap {br.capacityScore}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

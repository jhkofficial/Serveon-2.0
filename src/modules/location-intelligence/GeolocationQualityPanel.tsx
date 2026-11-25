import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Globe,
  Lock,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  ForwardGeocodingResult,
  GeocodedCustomer,
  GeolocationQualitySummary,
  ReverseGeocodingResult,
} from '../../types/geospatial';
import type { ProvinceMapConfig } from '../../data/geo/indonesiaGeo';
import {
  runForwardGeocoding,
  runReverseGeocoding,
} from '../../core/geo/geoValidationEngine';
import { formatNumber } from '../../core/analytics/kpiEngine';

interface GeolocationQualityPanelProps {
  tenantName: string;
  provinceGeo: ProvinceMapConfig;
  customers: GeocodedCustomer[];
  summary: GeolocationQualitySummary;
  canViewIndividualCustomers: boolean;
  onValidateAllLocations: () => void;
  onExportValidationReport: () => void;
  onInspectCustomer: (customerId: string) => void;
}

const STATUS_BADGE: Record<
  GeocodedCustomer['geolocation_status'],
  { label: string; cls: string }
> = {
  VERIFIED_ADDRESS: {
    label: 'Verified Address',
    cls: 'bg-emerald-100 text-emerald-800',
  },
  VERIFIED_POINT: {
    label: 'Verified Point',
    cls: 'bg-teal-100 text-teal-800',
  },
  APPROXIMATE_LOCATION: {
    label: 'Approximate',
    cls: 'bg-sky-100 text-sky-800',
  },
  SIMULATED_VALID_LAND_POINT: {
    label: 'Simulated Valid Land',
    cls: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  },
  INVALID_LOCATION: {
    label: 'Invalid (Quarantined)',
    cls: 'bg-red-100 text-red-800',
  },
  NOT_GEOCODED: {
    label: 'Not Geocoded',
    cls: 'bg-amber-100 text-amber-800',
  },
};

export function GeolocationQualityPanel({
  tenantName,
  provinceGeo,
  customers,
  summary,
  canViewIndividualCustomers,
  onValidateAllLocations,
  onExportValidationReport,
  onInspectCustomer,
}: GeolocationQualityPanelProps) {
  const [tableFilter, setTableFilter] = useState<'all' | 'issues' | 'valid'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [geocoderOpen, setGeocoderOpen] = useState(false);

  // Forward geocoding interactive workbench state
  const [fwdAddress, setFwdAddress] = useState('Jl. Pandanaran No. 48');
  const [fwdVillage, setFwdVillage] = useState('Miroto');
  const [fwdDistrict, setFwdDistrict] = useState('Semarang Tengah');
  const [fwdCity, setFwdCity] = useState(provinceGeo.territories[0]?.name ?? 'Kota Semarang');
  const [fwdPostal, setFwdPostal] = useState(
    provinceGeo.territories[0]?.defaultPostalCode ?? '50134'
  );
  const [allowFallback, setAllowFallback] = useState(false);
  const [fwdResult, setFwdResult] = useState<ForwardGeocodingResult | null>(null);

  // Reverse geocoding interactive workbench state
  const [revLat, setRevLat] = useState(
    String(provinceGeo.territories[0]?.center[0].toFixed(5) ?? '-6.99320')
  );
  const [revLng, setRevLng] = useState(
    String(provinceGeo.territories[0]?.center[1].toFixed(5) ?? '110.42030')
  );
  const [revResult, setRevResult] = useState<ReverseGeocodingResult | null>(null);

  const issueCount = summary.invalidCoordinates + summary.unmappedCustomers;

  const filteredRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (tableFilter === 'issues' && c.is_plottable) return false;
        if (tableFilter === 'valid' && !c.is_plottable) return false;
        if (!q) return true;
        const hay = `${c.customer_id} ${c.pseudonym_code} ${c.village_name} ${c.district_name} ${c.city_name} ${c.geolocation_status} ${c.validation_issue ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Put invalid / unmapped records first when viewing all so quality issues are immediately visible
        if (a.is_plottable !== b.is_plottable) return a.is_plottable ? 1 : -1;
        return a.pseudonym_code.localeCompare(b.pseudonym_code);
      });
  }, [customers, tableFilter, tableSearch]);

  const displayedRows = filteredRows.slice(0, 18);

  const handleRunForward = (e: React.FormEvent) => {
    e.preventDefault();
    const res = runForwardGeocoding(
      {
        sourceAddress: fwdAddress,
        village: fwdVillage,
        district: fwdDistrict,
        city: fwdCity,
        province: provinceGeo.provinceName,
        postalCode: fwdPostal,
      },
      provinceGeo,
      { allowSyntheticTerritoryFallback: allowFallback }
    );
    setFwdResult(res);
  };

  const handleRunReverse = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(revLat);
    const lng = Number(revLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setRevResult(runReverseGeocoding(lat, lng, provinceGeo));
  };

  return (
    <section
      id="geolocation-quality-dashboard"
      data-testid="geolocation-quality-dashboard"
      aria-label="Geolocation Data Quality Dashboard"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      {/* Header & Enterprise Actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#15946A]" />
            <h2 className="text-base font-semibold text-[#102B4D]">
              Geolocation Data Quality & Validation Center
            </h2>
            <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-emerald-800">
              EPSG:4326 Land-Mask Active
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {tenantName} · {provinceGeo.provinceName} · Zero offshore markers plotted · Quarantined
            or unmapped rows are excluded from map markers and reconciled below · Last verified:{' '}
            <span className="font-mono text-slate-700">{summary.lastValidatedAt}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="btn-validate-all-locations"
            onClick={onValidateAllLocations}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#102B4D]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Validate All Locations
          </button>
          <button
            type="button"
            data-testid="btn-view-invalid-records"
            onClick={() => setTableFilter((f) => (f === 'issues' ? 'all' : 'issues'))}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              tableFilter === 'issues'
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            View Invalid Records ({formatNumber(issueCount)})
          </button>
          <button
            type="button"
            data-testid="btn-export-validation-report"
            onClick={onExportValidationReport}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-[#1769AA]" />
            Export Validation Report
          </button>
        </div>
      </div>

      {/* Reconciled Quality KPI Strip */}
      <dl
        data-testid="geo-quality-metrics"
        className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10.5px] font-medium text-slate-500">Total Customers</dt>
          <dd className="mt-0.5 font-mono text-base font-bold text-[#102B4D] tabular-nums">
            {formatNumber(summary.totalCustomers)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10.5px] font-medium text-slate-500">Geocoded</dt>
          <dd className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
            {formatNumber(summary.geocodedCustomers)}
          </dd>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5">
          <dt className="text-[10.5px] font-medium text-emerald-800">Validated Land Points</dt>
          <dd className="mt-0.5 font-mono text-base font-bold text-[#15946A] tabular-nums">
            {formatNumber(summary.validatedLandPoints)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10.5px] font-medium text-slate-500">Verified Addresses</dt>
          <dd className="mt-0.5 font-mono text-base font-bold text-slate-700 tabular-nums">
            {formatNumber(summary.verifiedAddressPoints)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <dt className="text-[10.5px] font-medium text-slate-500">Approximate</dt>
          <dd className="mt-0.5 font-mono text-base font-bold text-[#1769AA] tabular-nums">
            {formatNumber(summary.approximateLocations)}
          </dd>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/70 p-2.5">
          <dt className="text-[10.5px] font-medium text-red-800">Invalid (Quarantined)</dt>
          <dd
            data-testid="metric-invalid-coords"
            className="mt-0.5 font-mono text-base font-bold text-red-700 tabular-nums"
          >
            {formatNumber(summary.invalidCoordinates)}
          </dd>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
          <dt className="text-[10.5px] font-medium text-amber-800">Unmapped (No Coord)</dt>
          <dd
            data-testid="metric-unmapped-coords"
            className="mt-0.5 font-mono text-base font-bold text-amber-700 tabular-nums"
          >
            {formatNumber(summary.unmappedCustomers)}
          </dd>
        </div>
      </dl>

      {/* Reconciliation & Privacy Banner */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[11px] text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#15946A]" />
          <span>
            Reconciliation:{' '}
            <strong className="font-mono text-[#102B4D]">
              {formatNumber(summary.plottableCustomers)} Plotted On-Land
            </strong>{' '}
            +{' '}
            <strong className="font-mono text-red-700">
              {formatNumber(summary.invalidCoordinates)} Quarantined
            </strong>{' '}
            +{' '}
            <strong className="font-mono text-amber-700">
              {formatNumber(summary.unmappedCustomers)} Not Geocoded
            </strong>{' '}
            ={' '}
            <strong className="font-mono text-[#102B4D]">
              {formatNumber(summary.totalCustomers)} Total
            </strong>{' '}
            · Plotted Sea Points: <strong className="font-mono text-[#15946A]">0</strong>
          </span>
        </div>
        {!canViewIndividualCustomers && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-800">
            <Lock className="h-3 w-3" />
            Coordinate precision masked by RBAC policy
          </span>
        )}
      </div>

      {/* Table Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
          {(
            [
              { id: 'all', label: `All (${formatNumber(customers.length)})` },
              { id: 'issues', label: `Invalid & Unmapped (${formatNumber(issueCount)})` },
              { id: 'valid', label: `Validated Land (${formatNumber(summary.plottableCustomers)})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTableFilter(tab.id)}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                tableFilter === tab.id
                  ? 'bg-[#102B4D] text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            aria-label="Filter validation table"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Filter by ID, village, city, issue..."
            className="h-8 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 text-xs text-slate-800 focus:border-[#1769AA] focus:outline-none"
          />
        </div>
      </div>

      {/* Geolocation Validation Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] text-slate-500">
              <th className="py-2 pr-3 font-semibold">Customer ID</th>
              <th className="px-3 py-2 font-semibold">Coordinates (EPSG:4326)</th>
              <th className="px-3 py-2 font-semibold">Administrative Territory</th>
              <th className="px-3 py-2 font-semibold">Land Validation</th>
              <th className="px-3 py-2 font-semibold">Geolocation Quality</th>
              <th className="px-3 py-2 font-semibold">Issue Description</th>
              <th className="py-2 pl-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedRows.map((c) => {
              const badge = STATUS_BADGE[c.geolocation_status];
              const coordText =
                c.latitude === null || c.longitude === null
                  ? 'Location Not Available'
                  : canViewIndividualCustomers
                    ? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
                    : `${c.latitude.toFixed(2)}, ${c.longitude.toFixed(2)} (Masked)`;

              return (
                <tr key={c.customer_id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3">
                    <div className="font-mono font-semibold text-[#102B4D]">{c.pseudonym_code}</div>
                    <div className="font-mono text-[10px] text-slate-400">{c.customer_id}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 tabular-nums">
                    {coordText}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-700">
                    <div className="font-medium text-slate-900">
                      {c.village_name}, {c.district_name}
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      {c.city_name} · {c.postal_code}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                        c.land_validation_status === 'ON_LAND'
                          ? 'bg-emerald-50 text-emerald-800'
                          : c.land_validation_status === 'IN_SEA_OR_WATER'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.land_validation_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-2.5 text-[11px] text-slate-600">
                    {c.validation_issue ? (
                      <span className="text-red-700">{c.validation_issue}</span>
                    ) : (
                      <span className="text-slate-400">Passed WGS-84, land mask & territory checks</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      disabled={!canViewIndividualCustomers}
                      onClick={() => onInspectCustomer(c.customer_id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769AA] hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      <MapPin className="h-3 w-3" />
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
            {displayedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                  No customer geolocation records match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredRows.length > displayedRows.length && (
          <div className="mt-2 text-[11px] text-slate-500">
            Showing {displayedRows.length} of {formatNumber(filteredRows.length)} matching records
            (use Export Validation Report for the full dataset).
          </div>
        )}
      </div>

      {/* Collapsible Forward & Reverse Geocoding Workbench */}
      <div className="mt-5 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setGeocoderOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#16A6BD]" />
            <span className="text-xs font-semibold text-[#102B4D]">
              Forward & Reverse Geocoding Diagnostics Workbench
            </span>
            <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              External Geocoding Service Not Connected
            </span>
          </div>
          {geocoderOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {geocoderOpen && (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Forward Geocoding Workflow */}
            <form
              onSubmit={handleRunForward}
              className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
            >
              <div className="font-semibold text-[#102B4D]">
                Forward Geocoding (Address &rarr; Coordinate)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={fwdAddress}
                  onChange={(e) => setFwdAddress(e.target.value)}
                  placeholder="Source Address"
                  className="col-span-2 h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                />
                <input
                  type="text"
                  value={fwdVillage}
                  onChange={(e) => setFwdVillage(e.target.value)}
                  placeholder="Village"
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                />
                <input
                  type="text"
                  value={fwdDistrict}
                  onChange={(e) => setFwdDistrict(e.target.value)}
                  placeholder="District"
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                />
                <input
                  type="text"
                  value={fwdCity}
                  onChange={(e) => setFwdCity(e.target.value)}
                  placeholder="City / Regency"
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                />
                <input
                  type="text"
                  value={fwdPostal}
                  onChange={(e) => setFwdPostal(e.target.value)}
                  placeholder="Postal Code"
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={allowFallback}
                  onChange={(e) => setAllowFallback(e.target.checked)}
                  className="rounded border-slate-300 text-[#1769AA]"
                />
                <span>
                  Allow local Approximate Territory Anchor fallback (labeled{' '}
                  <code>APPROXIMATE_LOCATION</code>, never Verified Address)
                </span>
              </label>
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102B4D] px-3 text-xs font-semibold text-white hover:bg-[#1769AA]"
              >
                Test Forward Geocode
              </button>

              {fwdResult && (
                <div className="rounded-lg border border-amber-200 bg-white p-2.5 text-[11px]">
                  <div className="font-semibold text-amber-800">{fwdResult.statusMessage}</div>
                  <div className="mt-1 text-slate-600">
                    Quality: <strong className="font-mono">{fwdResult.quality}</strong> · Confidence:{' '}
                    <strong className="font-mono">{fwdResult.confidence}%</strong>
                  </div>
                  <div className="mt-0.5 font-mono text-slate-800">
                    Result:{' '}
                    {fwdResult.latitude !== null && fwdResult.longitude !== null
                      ? `${fwdResult.latitude.toFixed(5)}, ${fwdResult.longitude.toFixed(5)}`
                      : 'None (NOT_GEOCODED)'}
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-500">{fwdResult.caveat}</div>
                </div>
              )}
            </form>

            {/* Reverse Geocoding Workflow */}
            <form
              onSubmit={handleRunReverse}
              className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#102B4D]">
                  Reverse Geocoding (Coordinate &rarr; Territory &amp; Land Check)
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRevLat('-6.98950');
                      setRevLng('110.42290');
                    }}
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Semarang Land
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRevLat('-6.89500');
                      setRevLng('110.42000');
                    }}
                    className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
                  >
                    Java Sea Test
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={revLat}
                  onChange={(e) => setRevLat(e.target.value)}
                  placeholder="Latitude"
                  className="h-8 rounded border border-slate-300 bg-white px-2 font-mono text-xs"
                />
                <input
                  type="text"
                  value={revLng}
                  onChange={(e) => setRevLng(e.target.value)}
                  placeholder="Longitude"
                  className="h-8 rounded border border-slate-300 bg-white px-2 font-mono text-xs"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102B4D] px-3 text-xs font-semibold text-white hover:bg-[#1769AA]"
              >
                Test Reverse Geocode (Cached)
              </button>

              {revResult && (
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-amber-800">{revResult.statusMessage}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {revResult.cached ? 'Cache Hit' : 'Fresh Lookup'}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-800">{revResult.approximateAddress}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[10px]">
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        revResult.landStatus === 'ON_LAND'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      Land: {revResult.landStatus}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                      Territory: {revResult.city} ({revResult.postalCode})
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-500">{revResult.caveat}</div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

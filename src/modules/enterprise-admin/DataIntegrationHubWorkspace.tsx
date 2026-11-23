import React, { useMemo, useState } from 'react';
import {
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  Plug,
  ShieldAlert,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { CsvFieldMapping } from '../../types/mvp4';
import {
  parseCsvText,
  SAMPLE_AUTOMOTIVE_CSV,
  SAMPLE_RETAIL_CSV,
  validateAndBuildCsvImport,
} from '../../core/enterprise/mvp4Engine';

export function DataIntegrationHubWorkspace() {
  const {
    activeTenant,
    connectors,
    customers,
    importHistory,
    importedCustomersCount,
    commitCsvImport,
    navigateToRoute,
  } = usePlatform();

  const [csvFileName, setCsvFileName] = useState<string>('');
  const [rawCsv, setRawCsv] = useState<string>('');
  const [mapping, setMapping] = useState<CsvFieldMapping>({
    full_name: 'full_name',
    code: 'customer_code',
    city: 'city',
    customer_segment: 'segment',
    status: 'status',
    lifetime_value: 'lifetime_value_idr',
    preferred_channel: 'preferred_channel',
  });
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const parsed = useMemo(() => parseCsvText(rawCsv), [rawCsv]);

  const validation = useMemo(() => {
    if (parsed.rows.length === 0) return null;
    return validateAndBuildCsvImport(parsed.rows, mapping, activeTenant, customers);
  }, [parsed.rows, mapping, activeTenant, customers]);

  const loadSampleCsv = (kind: 'retail' | 'automotive') => {
    const sample = kind === 'retail' ? SAMPLE_RETAIL_CSV : SAMPLE_AUTOMOTIVE_CSV;
    setRawCsv(sample);
    setCsvFileName(
      kind === 'retail' ? 'karya_retail_synthetic_feed.csv' : 'nusantara_auto_synthetic_feed.csv'
    );
    setMapping({
      full_name: 'full_name',
      code: 'customer_code',
      city: 'city',
      customer_segment: 'segment',
      status: 'status',
      lifetime_value: 'lifetime_value_idr',
      preferred_channel: 'preferred_channel',
    });
    setImportFeedback(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setRawCsv(text);
      const p = parseCsvText(text);
      if (p.headers.length > 0) {
        const findCol = (candidates: string[], fallback: string) =>
          p.headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c))) ?? fallback;
        setMapping({
          full_name: findCol(['full_name', 'name'], p.headers[0]),
          code: findCol(['customer_code', 'code', 'id'], p.headers[0]),
          city: findCol(['city', 'region', 'kab'], p.headers[0]),
          customer_segment: findCol(['segment'], p.headers[0]),
          status: findCol(['status'], p.headers[0]),
          lifetime_value: findCol(['lifetime', 'ltv', 'value'], p.headers[0]),
          preferred_channel: findCol(['channel'], p.headers[0]),
        });
      }
      setImportFeedback(null);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!validation) return;
    const res = commitCsvImport(
      csvFileName || 'uploaded_synthetic_customers.csv',
      validation.records,
      validation.report
    );
    setImportFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setRawCsv('');
      setCsvFileName('');
    }
  };

  const selectedConnector = connectors.find((c) => c.id === selectedConnectorId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Enterprise Data Integration Hub · Tenant: {activeTenant.name}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Data Integration Hub &amp; Validated CSV Ingestion
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connect enterprise data sources and validate structured CSV imports against canonical
            SERVEON schemas with duplicate detection and quality scoring.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-mono font-semibold text-[#102B4D]">
            {importedCustomersCount} imported records
          </span>
          <span>·</span>
          <button
            type="button"
            onClick={() => navigateToRoute('customers')}
            className="font-semibold text-[#1769AA] hover:underline"
          >
            View in Customer Intelligence →
          </button>
        </div>
      </div>

      {/* VALIDATED CSV IMPORT WORKFLOW */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#1769AA]" />
            <div>
              <h2 className="font-display text-base font-bold text-[#102B4D]">
                Validated CSV Import Pipeline (Synthetic Demo Data)
              </h2>
              <p className="text-xs text-slate-500">
                1. Upload / Sample → 2. Schema Preview → 3. Field Mapping → 4. Quality Report → 5.
                Confirm Import
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadSampleCsv('retail')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load Retail Sample CSV (5 rows)
            </button>
            <button
              type="button"
              onClick={() => loadSampleCsv('automotive')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Load Automotive Sample CSV (3 rows)
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#102B4D]">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload .CSV</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {importFeedback && (
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium ${
                importFeedback.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <span>{importFeedback.text}</span>
              {importFeedback.ok && (
                <button
                  type="button"
                  onClick={() => navigateToRoute('customers')}
                  className="inline-flex items-center gap-1 font-semibold underline"
                >
                  <span>Inspect Imported Records</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {parsed.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
              <FileSpreadsheet className="mx-auto h-7 w-7 text-slate-400" />
              <div className="mt-2 text-xs font-semibold text-slate-800">
                Upload a synthetic CSV file or load a sample template above
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Records are validated for required fields, numeric LTV types, and duplicate customer
                codes before committing strictly to <span className="font-semibold">{activeTenant.name}</span>.
              </p>
            </div>
          ) : (
            <>
              {/* Source Schema & Field Mapping */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="space-y-3 lg:col-span-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Canonical Field Mapping ({csvFileName})
                  </div>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                    {(
                      [
                        ['full_name', 'Customer Full Name *'],
                        ['code', 'Unique Customer Code *'],
                        ['city', 'City / Regency'],
                        ['customer_segment', 'Customer Segment'],
                        ['status', 'Lifecycle Status'],
                        ['lifetime_value', 'Lifetime Value (IDR) *'],
                        ['preferred_channel', 'Preferred Channel'],
                      ] as const
                    ).map(([fieldKey, label]) => (
                      <div key={fieldKey} className="grid grid-cols-2 items-center gap-2">
                        <span className="font-medium text-slate-700">{label}</span>
                        <select
                          value={mapping[fieldKey]}
                          onChange={(e) =>
                            setMapping((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px]"
                        >
                          {parsed.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Quality & Validation Report */}
                {validation && (
                  <div className="space-y-3 lg:col-span-7">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Validation &amp; Data Quality Report
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-[11px] text-slate-500">Total Rows</div>
                        <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#102B4D]">
                          {validation.report.totalRows}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-[11px] text-slate-500">Valid Records</div>
                        <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-700">
                          {validation.report.validRows}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-[11px] text-slate-500">Errors / Duplicates</div>
                        <div className="mt-1 font-mono text-lg font-bold tabular-nums text-rose-700">
                          {validation.report.errorRows} / {validation.report.duplicateCodes}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-[11px] text-slate-500">Completeness</div>
                        <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#1769AA]">
                          {validation.report.completenessPct}%
                        </div>
                      </div>
                    </div>

                    {validation.report.issues.length > 0 && (
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                        {validation.report.issues.map((iss, idx) => (
                          <div
                            key={idx}
                            className={`py-0.5 ${
                              iss.severity === 'error' ? 'text-rose-800 font-medium' : 'text-amber-800'
                            }`}
                          >
                            Row {iss.rowNumber} ({iss.field}): {iss.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Import Preview Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Code</th>
                            <th className="px-3 py-2">Customer Name</th>
                            <th className="px-3 py-2">Mapped Territory</th>
                            <th className="px-3 py-2">Segment</th>
                            <th className="px-3 py-2 text-right">LTV (IDR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {validation.records.slice(0, 6).map((rec) => (
                            <tr key={rec.customer_id}>
                              <td className="px-3 py-2 font-mono text-[11px] text-[#1769AA]">
                                {rec.code}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {rec.full_name}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {rec.demographic_attributes.city}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{rec.customer_segment}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {(rec.lifetime_value / 1_000_000).toFixed(1)}M
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRawCsv('');
                          setCsvFileName('');
                        }}
                        className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        disabled={!validation.report.canImport}
                        onClick={handleConfirmImport}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          Confirm Import ({validation.records.length} records to{' '}
                          {activeTenant.shortName})
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Import History */}
          {importHistory.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Tenant CSV Import History ({importHistory.length})
              </div>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Imported By</th>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2 text-right">Imported / Total</th>
                      <th className="px-3 py-2 text-right">Completeness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importHistory.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-800">
                          {h.fileName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{h.importedBy}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {h.importedAt}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700">
                          {h.importedRows} / {h.totalRows}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {h.qualityScorePct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ENTERPRISE CONNECTOR REGISTRY */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#16A6BD]" />
            <h2 className="font-display text-base font-bold text-[#102B4D]">
              Enterprise Data Connectors ({connectors.length})
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            <span>Zero plaintext credentials stored in browser · External systems remain Not Connected</span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {connectors.map((conn) => (
            <div
              key={conn.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-bold text-[#102B4D]">{conn.name}</div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      conn.status === 'Not Connected'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {conn.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-medium text-[#1769AA]">{conn.type}</div>
                <p className="mt-1.5 text-xs text-slate-600">{conn.description}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11px] text-slate-500">
                <span>{conn.authMode}</span>
                <button
                  type="button"
                  onClick={() => setSelectedConnectorId(conn.id)}
                  className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline"
                >
                  <Plug className="h-3 w-3" />
                  <span>Inspect Spec</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedConnector && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#102B4D]">
                Connector Interface Specification: {selectedConnector.name}
              </div>
              <button
                type="button"
                onClick={() => setSelectedConnectorId(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
              <div>
                <span className="font-semibold text-slate-700">Endpoint Pattern:</span>{' '}
                <span className="font-mono text-slate-600">
                  {selectedConnector.endpointUrlPlaceholder}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Sync Cadence:</span>{' '}
                <span className="text-slate-600">{selectedConnector.syncCadence}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Last Check:</span>{' '}
                <span className="text-slate-600">{selectedConnector.lastCheckedAt}</span>
              </div>
            </div>
            <p className="mt-2 text-slate-600">{selectedConnector.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

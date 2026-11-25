import React from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Download,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import { formatNumber } from '../../core/analytics/kpiEngine';

interface SemarangValidationBarProps {
  activeStep: number;
  isAstraMotor: boolean;
  semarangTotal: number;
  semarangPlottable: number;
  semarangInvalid: number;
  semarangNotGeocoded: number;
  semarangPlottedSeaCount: number;
  onSelectStep: (stepIdx: number) => void;
  onExportReport: () => void;
  onClose: () => void;
}

const VALIDATION_STEPS = [
  {
    title: '1. Focus Kota Semarang',
    detail: 'Scope Astra Motor -> Jawa Tengah -> Kota Semarang terrestrial boundary.',
  },
  {
    title: '2. Validate All Locations',
    detail: 'Run EPSG:4326 land-mask & sea-exclusion validator (confirm 0 plotted sea points).',
  },
  {
    title: '3. Inspect Cluster Anchor',
    detail: 'Verify coastal-safe cluster display markers anchor on valid on-land members.',
  },
  {
    title: '4. Zoom to Individual Markers',
    detail: 'Zoom level 13 across Semarang inland corridors (zero offshore Java Sea markers).',
  },
  {
    title: '5. Inspect Customer Detail',
    detail: 'Inspect Lat/Lng, Simulated Point provenance, Reverse Geocode & Nearest Dealer.',
  },
  {
    title: '6. Export Validation CSV',
    detail: 'Download privacy-aware Geolocation Validation Report with audit log entry.',
  },
];

export function SemarangValidationBar({
  activeStep,
  isAstraMotor,
  semarangTotal,
  semarangPlottable,
  semarangInvalid,
  semarangNotGeocoded,
  semarangPlottedSeaCount,
  onSelectStep,
  onExportReport,
  onClose,
}: SemarangValidationBarProps) {
  const current = VALIDATION_STEPS[activeStep] ?? VALIDATION_STEPS[0];

  return (
    <div
      data-testid="semarang-validation-bar"
      className="rounded-xl border border-[#15946A]/35 bg-[#F2FBF7] p-3.5 text-xs shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#102B4D]">
            <ShieldCheck className="h-4 w-4 text-[#15946A]" />
            Semarang Customer Location Validation Scenario
          </span>
          <span className="rounded bg-white px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#15946A] border border-emerald-200">
            Plotted Sea Points: {semarangPlottedSeaCount}
          </span>
          <span className="font-mono text-[10.5px] text-slate-600">
            Semarang: {formatNumber(semarangPlottable)} on-land / {formatNumber(semarangInvalid)}{' '}
            quarantined / {formatNumber(semarangNotGeocoded)} unmapped (Total{' '}
            {formatNumber(semarangTotal)})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isAstraMotor && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-900">
              Switch tenant to Astra Motor for Semarang validation
            </span>
          )}
          <button
            type="button"
            onClick={onExportReport}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#15946A] bg-white px-2.5 text-[11px] font-semibold text-[#102B4D] hover:bg-emerald-50"
          >
            <Download className="h-3 w-3 text-[#15946A]" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Semarang validation workflow"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stepper buttons */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {VALIDATION_STEPS.map((step, idx) => {
          const isCurrent = idx === activeStep;
          const isDone = idx < activeStep;
          return (
            <button
              key={step.title}
              type="button"
              onClick={() => onSelectStep(idx)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                isCurrent
                  ? 'border-[#102B4D] bg-[#102B4D] text-white'
                  : isDone
                    ? 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#15946A]" />
              ) : (
                <MapPin className="h-3.5 w-3.5 shrink-0 opacity-75" />
              )}
              <span className="truncate">{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-700">
        <span>
          <strong className="text-[#102B4D]">{current.title}:</strong> {current.detail}
        </span>
        {activeStep < VALIDATION_STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => onSelectStep(activeStep + 1)}
            className="inline-flex items-center gap-1 font-semibold text-[#1769AA] hover:underline"
          >
            Next Validation Step
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

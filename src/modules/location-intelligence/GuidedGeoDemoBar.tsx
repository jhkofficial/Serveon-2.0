import React from 'react';
import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react';

export interface GeoDemoStep {
  step: number;
  title: string;
  description: string;
}

export const CENTRAL_JAVA_GEO_DEMO_STEPS: GeoDemoStep[] = [
  {
    step: 1,
    title: 'Jawa Tengah Provincial Cluster View',
    description: 'Astra Motor riders clustered cleanly across 8 permitted Jawa Tengah territories.',
  },
  {
    step: 2,
    title: 'Drill Down to Kota Semarang',
    description: 'Select Kota Semarang to focus territory bounds and expand into district sub-clusters.',
  },
  {
    step: 3,
    title: 'Enable Main Dealers & AHASS Workshops',
    description: 'Overlay Astra Motor Main Dealers (green) and AHASS Service Centers (teal).',
  },
  {
    step: 4,
    title: 'Overlay Illustrative Competitor Reference',
    description: 'Compare proximity of synthetic competitor dealers and workshops across Semarang.',
  },
  {
    step: 5,
    title: '5 km Straight-Line Dealer Catchment',
    description: 'Select Astra Motor Center Gajahmada Semarang and evaluate its 5 km straight-line radius.',
  },
  {
    step: 6,
    title: 'Expand Catchment to 10 km Comparison',
    description: 'Compare inside vs outside coverage counts and overlapping neighbor catchments.',
  },
  {
    step: 7,
    title: 'Highlight At-Risk Riders Outside Coverage',
    description: 'Zoom to level 13, enable At-Risk & Uncovered highlights, and inspect high-churn points.',
  },
  {
    step: 8,
    title: 'Inspect Pseudonymous Customer & Connection',
    description: 'View pseudonymous rider code, AI churn risk, and straight-line link to assigned & nearest dealer.',
  },
  {
    step: 9,
    title: 'Geographic Area Selection -> Campaign Studio',
    description: 'Select outer Semarang at-risk catchment to build a consent-verified Campaign Target Audience.',
  },
  {
    step: 10,
    title: 'Opportunity & Gap Analysis -> Next-Best-Action',
    description: 'Review weighted A–E Opportunity & Gap zones and launch recommended business actions.',
  },
];

interface GuidedGeoDemoBarProps {
  activeStepIndex: number;
  onSelectStep: (idx: number) => void;
  onClose: () => void;
}

export function GuidedGeoDemoBar({
  activeStepIndex,
  onSelectStep,
  onClose,
}: GuidedGeoDemoBarProps) {
  const current = CENTRAL_JAVA_GEO_DEMO_STEPS[activeStepIndex] ?? CENTRAL_JAVA_GEO_DEMO_STEPS[0];
  const total = CENTRAL_JAVA_GEO_DEMO_STEPS.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#16A6BD]/40 bg-[#102B4D] px-4 py-3 text-white shadow-sm">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#16A6BD]/20 text-[#16A6BD]">
          <Compass className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#7CE0F0]">
            <span>GUIDED DEMO · Central Java Customer & Dealer Coverage Intelligence</span>
            <span className="font-mono text-white/80">
              Step {current.step} / {total}
            </span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-white">{current.title}</div>
          <p className="text-[11px] text-slate-300">{current.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={activeStepIndex <= 0}
          onClick={() => onSelectStep(activeStepIndex - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          disabled={activeStepIndex >= total - 1}
          onClick={() => onSelectStep(activeStepIndex + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#16A6BD] px-3 text-xs font-semibold text-white hover:bg-[#138fa3] disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guided demo bar"
          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-white/80 hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

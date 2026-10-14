import { useState } from 'react';
import { ChevronDown, Calculator } from 'lucide-react';
import type { CalorieDisplay, CalorieEstimate } from '../domain/types';
import { CALORIE_FORMULA_VERSION } from '../domain/calories';
import { Badge, ConfidenceBadge, cx } from './ui';

const INPUT_LABELS: Record<string, string> = {
  activeMinutes: 'Active minutes used',
  confirmedActiveMinutes: 'Timed / entered active minutes',
  inferredActiveMinutes: 'Inferred active minutes',
  weightKg: 'Body weight (kg)',
  weightSource: 'Weight source',
  intensity: 'Intensity',
  met: 'MET',
  metCode: 'Compendium code',
  speedKmh: 'Speed (km/h)',
  speedMPerMin: 'Speed (m/min)',
  gradePct: 'Grade (%)',
  vo2: 'VO₂ (ml/kg/min)',
  massKg: 'Mass moved (kg)',
  powerW: 'Power (W)',
  efficiency: 'Assumed efficiency',
  avgHr: 'Average HR (bpm)',
  age: 'Age',
  sex: 'Sex',
  manualCalories: 'Manual kcal',
  resistance: 'Resistance',
};

export function EstimateSummary({ estimate, mode, manual }: { estimate: CalorieEstimate | null; mode: CalorieDisplay; manual?: boolean }) {
  if (!estimate) return <span className="text-sm text-ink-500">No estimate</span>;
  const v = mode === 'gross' ? estimate.gross : estimate.net;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-semibold text-ink-100">
        {estimate.confidence === 'insufficient' ? '—' : Math.round(v)}
        <span className="ml-1 text-xs font-normal text-ink-400">kcal {mode}</span>
      </span>
      {estimate.confidence !== 'insufficient' && estimate.method !== 'manual' && (
        <span className="text-xs text-ink-500">
          ≈{Math.round(estimate.low)}–{Math.round(estimate.high)}
        </span>
      )}
      {manual || estimate.method === 'manual' ? <Badge tone="info">Manual</Badge> : <ConfidenceBadge confidence={estimate.confidence} />}
    </div>
  );
}

/** Full transparency panel: method, inputs, measured data, assumptions, warnings. */
export function EstimateDetails({ estimate, mode, defaultOpen = false }: { estimate: CalorieEstimate | null; mode: CalorieDisplay; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!estimate) return null;
  const outdated = estimate.formulaVersion !== CALORIE_FORMULA_VERSION;
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-850">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-300">
          <Calculator size={14} className="shrink-0 text-ink-400" aria-hidden />
          <span className="truncate">{estimate.methodLabel}</span>
          {outdated && <Badge tone="warn">Outdated formula</Badge>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink-800 px-3 py-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className={cx('rounded-lg border p-2', mode === 'gross' ? 'border-lime-700/60' : 'border-ink-700')}>
              <div className="text-ink-400">Gross (total during activity)</div>
              <div className="text-base font-semibold text-ink-100">{Math.round(estimate.gross)} kcal</div>
            </div>
            <div className={cx('rounded-lg border p-2', mode === 'net' ? 'border-lime-700/60' : 'border-ink-700')}>
              <div className="text-ink-400">Net (above resting)</div>
              <div className="text-base font-semibold text-ink-100">{Math.round(estimate.net)} kcal</div>
            </div>
          </div>
          {estimate.method === 'met' && estimate.met != null && estimate.weightKg != null && (
            <p className="font-mono text-[11px] text-ink-300">
              {estimate.met} MET × 3.5 × {estimate.weightKg} kg ÷ 200 × {estimate.activeMinutes.toFixed(1)} min = {Math.round(estimate.gross)} kcal
            </p>
          )}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {Object.entries(estimate.inputs)
              .filter(([k, v]) => v !== null && v !== '' && INPUT_LABELS[k])
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-ink-800/70 py-1">
                  <dt className="text-ink-400">{INPUT_LABELS[k]}</dt>
                  <dd className="text-right tabular-nums text-ink-100">{String(v)}</dd>
                </div>
              ))}
          </dl>
          <div>
            <div className="mb-1 font-medium text-ink-300">Measured inputs</div>
            <div className="text-ink-400">{estimate.measured.length ? estimate.measured.join(', ') : 'None — based on entered duration and chosen intensity.'}</div>
          </div>
          {estimate.assumptions.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-ink-300">Assumptions</div>
              <ul className="list-disc space-y-0.5 pl-4 text-ink-400">
                {estimate.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {estimate.warnings.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-amber-300">Warnings</div>
              <ul className="list-disc space-y-0.5 pl-4 text-amber-200/80">
                {estimate.warnings.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink-500">
            Range {Math.round(estimate.low)}–{Math.round(estimate.high)} kcal is a heuristic spread based on data quality, not a statistical confidence interval. Formula v{estimate.formulaVersion}.
          </p>
        </div>
      )}
    </div>
  );
}

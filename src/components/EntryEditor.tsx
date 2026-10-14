import { useId, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, History, Play, Plus, Square, Trash2 } from 'lucide-react';
import type {
  ActivityInterval,
  CalorieDisplay,
  CalorieEstimate,
  CardioData,
  ExerciseDefinition,
  ExerciseEntry,
  ExerciseSet,
  Intensity,
  IntervalPlan,
  LoadBasis,
  Limitation,
} from '../domain/types';
import { emptySet } from '../domain/session';
import { bestSet, entryTotalReps, entryVolumeKg, totalLoadKg } from '../domain/strength';
import { openInterval, type TimerAction } from '../domain/time';
import { formatClock } from '../lib/dates';
import { fmtNum, fmtPace, type Units } from '../lib/units';
import { uid } from '../lib/id';
import { EstimateDetails, EstimateSummary } from './EstimateDetails';
import { Badge, Button, cx, Field, NumberInput, Segmented, Select, TextInput, Toggle } from './ui';

const BASIS_LABEL: Record<LoadBasis, string> = {
  total: 'Total load',
  'per-implement': 'Per dumbbell / hand',
  'plates-only': 'Plates only (+ bar)',
  stack: 'Machine stack',
  bodyweight: 'Bodyweight (+ added)',
  unknown: 'Unknown basis',
};

export function DurationInput({ seconds, onChange, idPrefix }: { seconds: number | null; onChange: (s: number | null) => void; idPrefix?: string }) {
  const m = seconds == null ? null : Math.floor(seconds / 60);
  const s = seconds == null ? null : Math.round(seconds % 60);
  const set = (mm: number | null, ss: number | null) => {
    if (mm == null && ss == null) onChange(null);
    else onChange(Math.max(0, (mm ?? 0) * 60 + (ss ?? 0)));
  };
  return (
    <div className="flex items-center gap-1.5">
      <NumberInput id={idPrefix} ariaLabel="Minutes" value={m} onChange={(v) => set(v, s)} min={0} placeholder="min" className="w-full" />
      <span className="text-ink-500">:</span>
      <NumberInput ariaLabel="Seconds" value={s} onChange={(v) => set(m, v)} min={0} max={59} placeholder="sec" className="w-full" />
    </div>
  );
}

interface Props {
  entry: ExerciseEntry;
  def: ExerciseDefinition;
  intervals: ActivityInterval[];
  now: number;
  units: Units;
  mode: CalorieDisplay;
  estimate: CalorieEstimate | null;
  limitations: Limitation[];
  lastEntry: ExerciseEntry | null;
  restSeconds: number;
  onChange: (e: ExerciseEntry) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onTimer: (a: TimerAction) => void;
}

export function EntryEditor({ entry, def, intervals, now, units, mode, estimate, limitations, lastEntry, restSeconds, onChange, onRemove, onMove, onTimer }: Props) {
  const current = openInterval(intervals);
  const warnings = limitations.filter((l) => l.active && l.appliesToKinds.includes(def.kind));
  const patch = (p: Partial<ExerciseEntry>) => onChange({ ...entry, ...p });

  const useLast = () => {
    if (!lastEntry) return;
    onChange({
      ...entry,
      variation: lastEntry.variation || entry.variation,
      equipment: lastEntry.equipment || entry.equipment,
      machineId: lastEntry.machineId,
      intensity: lastEntry.intensity,
      sets: lastEntry.sets.map((s) => ({ ...s, id: uid(), status: 'completed', activeSeconds: null, activeSource: null, loadRangeKg: null })),
      cardio: lastEntry.cardio ? { ...lastEntry.cardio, activeSeconds: lastEntry.cardio.activeSeconds, activeSource: lastEntry.cardio.activeSeconds != null ? 'manual' : null } : entry.cardio,
    });
  };

  return (
    <article className="rounded-2xl border border-ink-800 bg-ink-900 p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-100">{def.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <EstimateSummary estimate={estimate} mode={mode} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {lastEntry && (
            <Button size="sm" variant="ghost" onClick={useLast} title="Copy sets and load from your previous session">
              <History size={14} aria-hidden /> Use last time
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${def.name}`}>
            <Trash2 size={14} />
          </Button>
        </div>
      </header>

      {warnings.map((w) => (
        <div key={w.id} role="note" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <span className="font-medium">Limitation: {w.label}.</span> {w.notes}
          </div>
        </div>
      ))}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Variation">
          {(id) => (
            <Select id={id} value={entry.variation} onChange={(e) => patch({ variation: e.target.value })}>
              {!def.variations.includes(entry.variation) && entry.variation && <option value={entry.variation}>{entry.variation}</option>}
              {def.variations.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Equipment">
          {(id) => (
            <Select id={id} value={entry.equipment} onChange={(e) => patch({ equipment: e.target.value })}>
              <option value="">—</option>
              {!def.equipment.includes(entry.equipment) && entry.equipment && <option value={entry.equipment}>{entry.equipment}</option>}
              {def.equipment.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          )}
        </Field>
        {(entry.loadMode === 'machine' || entry.loadMode === 'cable') && (
          <Field label="Machine ID / maker" hint="Stack weights differ between machines.">
            {(id) => <TextInput id={id} value={entry.machineId} placeholder="e.g. Technogym, Gym A #3" onChange={(e) => patch({ machineId: e.target.value })} />}
          </Field>
        )}
        <Field label="Intensity" className={cx(entry.loadMode === 'machine' || entry.loadMode === 'cable' ? '' : 'md:col-span-2')}>
          {() => (
            <Segmented<Intensity>
              ariaLabel="Intensity"
              value={entry.intensity}
              onChange={(v) => patch({ intensity: v })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'vigorous', label: 'Vigorous' },
              ]}
            />
          )}
        </Field>
      </div>

      {entry.cardio ? (
        <CardioFields entry={entry} def={def} cardio={entry.cardio} units={units} now={now} current={current} onTimer={onTimer} onChange={(c) => patch({ cardio: c })} />
      ) : (
        <SetTable entry={entry} def={def} units={units} current={current} restSeconds={restSeconds} onTimer={onTimer} onChange={(sets) => patch({ sets })} />
      )}

      <details className="group mt-4">
        <summary className="cursor-pointer select-none text-xs font-medium text-ink-400 hover:text-ink-200">Heart rate, effort, manual calories & notes</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Avg heart rate (bpm)">{(id) => <NumberInput id={id} value={entry.avgHr} onChange={(v) => patch({ avgHr: v })} min={30} max={230} />}</Field>
          <Field label="Max heart rate (bpm)">{(id) => <NumberInput id={id} value={entry.maxHr} onChange={(v) => patch({ maxHr: v })} min={30} max={230} />}</Field>
          <Field label="Perceived exertion (RPE 1–10)">{(id) => <NumberInput id={id} value={entry.rpe} onChange={(v) => patch({ rpe: v })} min={1} max={10} step={0.5} />}</Field>
          <Field label="Manual kcal (overrides estimate)" hint="Labelled as manual everywhere.">
            {(id) => <NumberInput id={id} value={entry.manualCalories} onChange={(v) => patch({ manualCalories: v })} min={0} />}
          </Field>
          <Field label="Notes" className="col-span-2 md:col-span-4">
            {(id) => <TextInput id={id} value={entry.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Form cues, how it felt…" />}
          </Field>
        </div>
      </details>

      <div className="mt-4">
        <EstimateDetails estimate={estimate} mode={mode} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Strength / bodyweight sets
// ---------------------------------------------------------------------------

function SetTable({
  entry,
  def,
  units,
  current,
  restSeconds,
  onTimer,
  onChange,
}: {
  entry: ExerciseEntry;
  def: ExerciseDefinition;
  units: Units;
  current: ActivityInterval | null;
  restSeconds: number;
  onTimer: (a: TimerAction) => void;
  onChange: (sets: ExerciseSet[]) => void;
}) {
  const isHold = def.kind === 'isometric';
  const isCarry = def.kind === 'carry';
  const showLoad = def.kind !== 'isometric';
  const update = (i: number, p: Partial<ExerciseSet>) => onChange(entry.sets.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const addSet = () => {
    const last = entry.sets[entry.sets.length - 1];
    onChange([...entry.sets, emptySet(last ? { reps: last.reps, repsLeft: last.repsLeft, repsRight: last.repsRight, loadKg: last.loadKg, loadBasis: last.loadBasis, implements: last.implements, barKg: last.barKg, repCountMode: last.repCountMode, holdSeconds: last.holdSeconds } : { repCountMode: def.repCountOptions?.[0] })]);
  };
  const bs = bestSet(entry);
  const vol = entryVolumeKg(entry);
  const reps = entryTotalReps(entry);

  return (
    <div>
      <div className="space-y-2">
        {entry.sets.map((s, i) => {
          const running = current?.kind === 'active' && current.entryId === entry.id && current.setId === s.id;
          const pausedHere = current?.kind === 'paused' && current.entryId === entry.id && current.setId === s.id;
          const liveSeconds = s.activeSeconds ?? 0;
          const total = totalLoadKg(s);
          return (
            <div key={s.id} className={cx('rounded-xl border p-3', running ? 'border-lime-500/70 bg-lime-900/10' : 'border-ink-800 bg-ink-850')}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-ink-200">Set {i + 1}</span>
                  {s.status !== 'completed' && <Badge tone={s.status === 'planned' ? 'neutral' : 'warn'}>{s.status === 'planned' ? 'Planned' : 'Estimated'}</Badge>}
                  {s.isWarmup && <Badge>Warm-up</Badge>}
                  {s.loadRangeKg && <Badge tone="warn">Range {s.loadRangeKg[0]}–{s.loadRangeKg[1]} kg</Badge>}
                  {s.activeSource && <span className="text-ink-500">time: {s.activeSource}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {running ? (
                    <Button size="sm" variant="primary" onClick={() => onTimer({ type: 'start-rest' })} aria-label={`Finish set ${i + 1} and start rest`}>
                      <Square size={12} aria-hidden /> Done · rest {formatClock(restSeconds)}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onTimer({ type: 'start-active', entryId: entry.id, setId: s.id })} aria-label={`Start set ${i + 1} timer`} disabled={pausedHere}>
                      <Play size={12} aria-hidden /> {s.activeSeconds ? 'Resume' : 'Start'}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onChange([...entry.sets.slice(0, i + 1), { ...s, id: uid(), activeSeconds: null, activeSource: null }, ...entry.sets.slice(i + 1)])} aria-label={`Duplicate set ${i + 1}`}>
                    <Copy size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onChange(entry.sets.filter((_, k) => k !== i))} aria-label={`Delete set ${i + 1}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {isHold ? (
                  <Mini label="Hold (s)">{(id) => <NumberInput id={id} value={s.holdSeconds ?? null} onChange={(v) => update(i, { holdSeconds: v })} min={0} />}</Mini>
                ) : def.unilateral ? (
                  <>
                    <Mini label="Reps left">{(id) => <NumberInput id={id} value={s.repsLeft ?? null} onChange={(v) => update(i, { repsLeft: v })} min={0} step={1} />}</Mini>
                    <Mini label="Reps right">{(id) => <NumberInput id={id} value={s.repsRight ?? null} onChange={(v) => update(i, { repsRight: v })} min={0} step={1} />}</Mini>
                  </>
                ) : (
                  <Mini label={isCarry ? 'Carries / reps' : 'Reps'}>{(id) => <NumberInput id={id} value={s.reps} onChange={(v) => update(i, { reps: v })} min={0} step={1} />}</Mini>
                )}
                {def.repCountOptions && (
                  <Mini label="Counted as">
                    {(id) => (
                      <Select id={id} value={s.repCountMode ?? 'total'} onChange={(e) => update(i, { repCountMode: e.target.value as ExerciseSet['repCountMode'] })}>
                        <option value="per-leg">Per leg</option>
                        <option value="cycles">Alternating cycles</option>
                        <option value="total">Total (both legs)</option>
                      </Select>
                    )}
                  </Mini>
                )}
                {showLoad && (
                  <>
                    <Mini label={`Load (${units.weightUnit})`}>
                      {(id) => <NumberInput id={id} value={s.loadKg == null ? null : units.weight(s.loadKg)} onChange={(v) => update(i, { loadKg: v == null ? null : units.weightToKg(v), loadRangeKg: null })} min={0} />}
                    </Mini>
                    <Mini label="Load basis">
                      {(id) => (
                        <Select id={id} value={s.loadBasis} onChange={(e) => update(i, { loadBasis: e.target.value as LoadBasis, implements: e.target.value === 'per-implement' ? Math.max(s.implements, 2) : 1 })}>
                          {(Object.keys(BASIS_LABEL) as LoadBasis[]).map((b) => (
                            <option key={b} value={b}>
                              {BASIS_LABEL[b]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Mini>
                    {s.loadBasis === 'per-implement' && (
                      <Mini label="Dumbbells / hands">{(id) => <NumberInput id={id} value={s.implements} onChange={(v) => update(i, { implements: Math.max(1, Math.round(v ?? 1)) })} min={1} max={4} step={1} />}</Mini>
                    )}
                    {s.loadBasis === 'plates-only' && (
                      <Mini label={`Bar (${units.weightUnit})`}>{(id) => <NumberInput id={id} value={s.barKg == null ? null : units.weight(s.barKg)} onChange={(v) => update(i, { barKg: v == null ? null : units.weightToKg(v) })} min={0} placeholder="e.g. 20" />}</Mini>
                    )}
                  </>
                )}
                <Mini label="Active (s)">
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={running ? Math.round(liveSeconds) : s.activeSeconds}
                      onChange={(v) => update(i, { activeSeconds: v, activeSource: v == null ? null : 'manual' })}
                      min={0}
                      placeholder={isHold ? 'uses hold' : 'untimed'}
                      disabled={running}
                    />
                  )}
                </Mini>
                <Mini label="RPE / RIR">
                  {() => (
                    <div className="flex gap-1.5">
                      <NumberInput ariaLabel="RPE" value={s.rpe ?? null} onChange={(v) => update(i, { rpe: v })} min={1} max={10} step={0.5} placeholder="RPE" />
                      <NumberInput ariaLabel="Reps in reserve" value={s.rir ?? null} onChange={(v) => update(i, { rir: v })} min={0} max={10} step={1} placeholder="RIR" />
                    </div>
                  )}
                </Mini>
                <Mini label="Status">
                  {(id) => (
                    <Select id={id} value={s.status} onChange={(e) => update(i, { status: e.target.value as ExerciseSet['status'] })}>
                      <option value="completed">Completed</option>
                      <option value="planned">Planned (not done)</option>
                      <option value="estimated">Estimated / recalled</option>
                    </Select>
                  )}
                </Mini>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
                {showLoad && total != null && total > 0 && (
                  <span>
                    Total external load: {fmtNum(units.weight(total), 1)} {units.weightUnit}
                    {s.loadBasis === 'plates-only' && s.barKg == null && ' (bar weight unknown)'}
                  </span>
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={!!s.isWarmup} onChange={(e) => update(i, { isWarmup: e.target.checked })} className="accent-lime-400" /> Warm-up
                </label>
                {s.activeSeconds == null && !isHold && <span>No timed duration — calories will infer time from reps (flagged low confidence).</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" onClick={addSet}>
          <Plus size={14} aria-hidden /> Add set
        </Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          <span>
            Total reps <strong className="text-ink-200">{reps}</strong>
          </span>
          {vol > 0 && (
            <span>
              Volume <strong className="text-ink-200">{fmtNum(units.weight(vol))}</strong> {units.weightUnit}
            </span>
          )}
          {bs && bs.loadKg > 0 && (
            <span>
              Best set <strong className="text-ink-200">{fmtNum(units.weight(bs.loadKg), 1)} {units.weightUnit} × {bs.reps}</strong>
            </span>
          )}
          {bs?.e1rm && (
            <span>
              e1RM <strong className="text-ink-200">{fmtNum(units.weight(bs.e1rm), 1)}</strong> {units.weightUnit}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-500">Training volume (load × reps) measures work done on the weights. It is not used to calculate calories.</p>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] text-ink-400">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cardio
// ---------------------------------------------------------------------------

function CardioFields({
  entry,
  def,
  cardio,
  units,
  now,
  current,
  onTimer,
  onChange,
}: {
  entry: ExerciseEntry;
  def: ExerciseDefinition;
  cardio: CardioData;
  units: Units;
  now: number;
  current: ActivityInterval | null;
  onTimer: (a: TimerAction) => void;
  onChange: (c: CardioData) => void;
}) {
  const p = (x: Partial<CardioData>) => onChange({ ...cardio, ...x });
  const running = current?.kind === 'active' && current.entryId === entry.id && current.setId == null;
  const k = def.kind;
  const isRunWalk = k === 'run' || k === 'walk';
  const pace = cardio.distanceKm && cardio.activeSeconds ? cardio.activeSeconds / units.distance(cardio.distanceKm) : null;
  const plan = cardio.intervals;
  const setPlan = (x: Partial<IntervalPlan>) => p({ intervals: { workSeconds: 30, restSeconds: 30, rounds: 8, completedRounds: 0, exerciseType: '', ...plan, ...x } });
  void now;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
        {running ? (
          <Button variant="primary" onClick={() => onTimer({ type: 'stop' })}>
            <Square size={14} aria-hidden /> Stop {def.name.toLowerCase()}
          </Button>
        ) : (
          <Button onClick={() => onTimer({ type: 'start-active', entryId: entry.id, setId: null })}>
            <Play size={14} aria-hidden /> {cardio.activeSeconds ? 'Resume timer' : 'Start timer'}
          </Button>
        )}
        <div className="text-sm text-ink-300">
          Active time <span className="font-semibold tabular-nums text-ink-100">{formatClock(cardio.activeSeconds ?? 0)}</span>
          {cardio.activeSource && <span className="ml-2 text-xs text-ink-500">({cardio.activeSource})</span>}
        </div>
        {k === 'hiit' && plan && <span className="text-xs text-ink-500">Interval plan below sets the active time from completed work intervals.</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Active duration (min : sec)" hint="Only time spent moving. Exclude rests and stops.">
          {(id) => <DurationInput idPrefix={id} seconds={cardio.activeSeconds} onChange={(v) => p({ activeSeconds: v, activeSource: v == null ? null : 'manual' })} />}
        </Field>
        {k !== 'jumprope' && k !== 'hiit' && (
          <Field label={`Distance (${units.distanceUnit})`}>
            {(id) => <NumberInput id={id} value={cardio.distanceKm == null ? null : units.distance(cardio.distanceKm)} onChange={(v) => p({ distanceKm: v == null ? null : units.distanceToKm(v) })} min={0} />}
          </Field>
        )}
        {(isRunWalk || k === 'cycle') && (
          <>
            <Field label={`Avg speed (${units.speedUnit})`} hint={pace ? `Pace ${fmtPace(pace)} ${units.paceUnit}` : 'Or enter distance + time'}>
              {(id) => <NumberInput id={id} value={cardio.avgSpeedKmh == null ? null : units.speed(cardio.avgSpeedKmh)} onChange={(v) => p({ avgSpeedKmh: v == null ? null : units.speedToKmh(v) })} min={0} />}
            </Field>
            <Field label={`Max speed (${units.speedUnit})`}>
              {(id) => <NumberInput id={id} value={cardio.maxSpeedKmh == null ? null : units.speed(cardio.maxSpeedKmh)} onChange={(v) => p({ maxSpeedKmh: v == null ? null : units.speedToKmh(v) })} min={0} />}
            </Field>
          </>
        )}
        {isRunWalk && (
          <Field label="Treadmill incline (%)">{(id) => <NumberInput id={id} value={cardio.inclinePct} onChange={(v) => p({ inclinePct: v })} min={-30} max={40} />}</Field>
        )}
        {(isRunWalk || k === 'cycle') && (
          <Field label="Elevation gain (m)">{(id) => <NumberInput id={id} value={cardio.elevationGainM} onChange={(v) => p({ elevationGainM: v })} min={0} />}</Field>
        )}
        {k === 'cycle' && (
          <>
            <Field label="Avg power (W)" hint="Best input for cycling calories.">
              {(id) => <NumberInput id={id} value={cardio.powerW} onChange={(v) => p({ powerW: v })} min={0} />}
            </Field>
            <Field label="Resistance / level">{(id) => <TextInput id={id} value={cardio.resistance} onChange={(e) => p({ resistance: e.target.value })} placeholder="e.g. level 8" />}</Field>
          </>
        )}
        {isRunWalk && (
          <Field label="Steps">{(id) => <NumberInput id={id} value={cardio.steps} onChange={(v) => p({ steps: v })} min={0} step={1} />}</Field>
        )}
        {(isRunWalk || k === 'cycle' || k === 'jumprope') && (
          <Field label={k === 'cycle' ? 'Cadence (rpm)' : k === 'jumprope' ? 'Cadence (jumps/min)' : 'Cadence (steps/min)'}>
            {(id) => <NumberInput id={id} value={cardio.cadence} onChange={(v) => p({ cadence: v })} min={0} />}
          </Field>
        )}
        {k === 'jumprope' && (
          <Field label="Jump count">{(id) => <NumberInput id={id} value={cardio.jumps} onChange={(v) => p({ jumps: v })} min={0} step={1} />}</Field>
        )}
        {k === 'walk' && (
          <Field label={`Carried load (${units.weightUnit})`}>
            {(id) => <NumberInput id={id} value={cardio.carriedLoadKg == null ? null : units.weight(cardio.carriedLoadKg)} onChange={(v) => p({ carriedLoadKg: v == null ? null : units.weightToKg(v) })} min={0} />}
          </Field>
        )}
        <Field label="Setting">
          {(id) => (
            <Select id={id} value={cardio.setting ?? ''} onChange={(e) => p({ setting: (e.target.value || null) as CardioData['setting'] })}>
              <option value="">—</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </Select>
          )}
        </Field>
        {(isRunWalk || k === 'cycle') && (
          <Field label="Terrain">{(id) => <TextInput id={id} value={cardio.terrain} onChange={(e) => p({ terrain: e.target.value })} placeholder="Road, trail, track…" />}</Field>
        )}
      </div>

      {isRunWalk && (
        <div className="flex flex-wrap gap-6">
          <Toggle checked={cardio.treadmill} onChange={(v) => p({ treadmill: v, setting: v ? 'indoor' : cardio.setting })} label="On a treadmill" />
          {cardio.steps != null && cardio.steps > 0 && (
            <Toggle
              checked={cardio.stepsIncludedInDailyTotal}
              onChange={(v) => p({ stepsIncludedInDailyTotal: v })}
              label="These steps are already in my daily step total"
              description="Prevents counting them twice. Turn off if your phone/watch didn't record this workout."
            />
          )}
        </div>
      )}

      {(k === 'hiit' || k === 'jumprope' || entry.variation.toLowerCase().includes('interval')) && (
        <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-300">Interval structure</span>
            {plan ? (
              <Button size="sm" variant="ghost" onClick={() => p({ intervals: null })}>
                Remove
              </Button>
            ) : (
              <Button size="sm" onClick={() => setPlan({})}>
                <Plus size={12} aria-hidden /> Add intervals
              </Button>
            )}
          </div>
          {plan && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Field label="Work (s)">{(id) => <NumberInput id={id} value={plan.workSeconds} onChange={(v) => setPlan({ workSeconds: v ?? 0 })} min={0} />}</Field>
              <Field label="Rest (s)">{(id) => <NumberInput id={id} value={plan.restSeconds} onChange={(v) => setPlan({ restSeconds: v ?? 0 })} min={0} />}</Field>
              <Field label="Planned rounds">{(id) => <NumberInput id={id} value={plan.rounds} onChange={(v) => setPlan({ rounds: v ?? 0 })} min={0} step={1} />}</Field>
              <Field label="Completed rounds">{(id) => <NumberInput id={id} value={plan.completedRounds} onChange={(v) => setPlan({ completedRounds: v ?? 0 })} min={0} step={1} />}</Field>
              <Field label="Exercise">{(id) => <TextInput id={id} value={plan.exerciseType} onChange={(e) => setPlan({ exerciseType: e.target.value })} placeholder="Burpees, sprints…" />}</Field>
              <p className="col-span-2 text-[11px] text-ink-500 md:col-span-5">
                Work time = {plan.completedRounds} × {plan.workSeconds}s = {formatClock(plan.completedRounds * plan.workSeconds)}. Total session incl. rest ≈ {formatClock(plan.completedRounds * plan.workSeconds + Math.max(0, plan.completedRounds - 1) * plan.restSeconds)}. Rest is not counted as active.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

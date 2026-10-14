import { useRef, useState } from 'react';
import { Download, Plus, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useStore } from '../data/store';
import type { ExerciseKind, Limitation, UserProfile } from '../domain/types';
import { ageOn } from '../domain/body';
import { CALORIE_FORMULA_VERSION } from '../domain/calories';
import { dailyCsv, download, exportJson, importDailyCsv, importJson, importMeasurementsCsv, measurementsCsv, mergeStates, sessionsCsv, setsCsv, MEASUREMENT_COLUMNS } from '../data/io';
import { todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { Button, Card, Field, Notice, NumberInput, PageHeader, Segmented, Select, TextInput, Toggle } from '../components/ui';

const KINDS: { k: ExerciseKind; label: string }[] = [
  { k: 'run', label: 'Running / jogging' },
  { k: 'walk', label: 'Walking' },
  { k: 'cycle', label: 'Cycling' },
  { k: 'jumprope', label: 'Jump rope' },
  { k: 'hiit', label: 'HIIT' },
  { k: 'strength', label: 'Weights' },
  { k: 'bodyweight', label: 'Bodyweight' },
  { k: 'isometric', label: 'Holds' },
  { k: 'carry', label: 'Carries' },
  { k: 'band', label: 'Bands' },
];

export function Settings() {
  const store = useStore();
  const { state, units, updateProfile, updateSettings } = store;
  const pr = state.profile;
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warn'; text: string } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const jsonRef = useRef<HTMLInputElement>(null);
  const mCsvRef = useRef<HTMLInputElement>(null);
  const dCsvRef = useRef<HTMLInputElement>(null);
  const age = ageOn(pr, todayISO());
  const P = (p: Partial<UserProfile>) => updateProfile(p);
  const stamp = todayISO();

  const readFile = (f: File) => f.text();

  const onJson = async (f: File) => {
    const r = importJson(await readFile(f));
    if (!r.ok) {
      setMsg({ tone: 'danger', text: `Import failed: ${r.errors.join('; ')}` });
      return;
    }
    if (importMode === 'replace' && !confirm('Replace ALL current data with this file?')) return;
    store.replaceState(importMode === 'replace' ? r.state : mergeStates(state, r.state));
    setMsg({ tone: 'success', text: `Imported ${r.state.sessions.length} sessions and ${r.state.measurements.length} measurements (${importMode}).` });
  };

  const onMeasCsv = async (f: File) => {
    const r = importMeasurementsCsv(await readFile(f));
    if (r.rows.length) store.addMeasurements(r.rows);
    setMsg({ tone: r.errors.length ? 'warn' : 'success', text: `Imported ${r.rows.length} measurements.${r.errors.length ? ` Skipped: ${r.errors.slice(0, 5).join(' ')}` : ''}` });
  };

  const onDailyCsv = async (f: File) => {
    const r = importDailyCsv(await readFile(f));
    if (r.rows.length) store.addDaily(r.rows);
    setMsg({ tone: r.errors.length ? 'warn' : 'success', text: `Imported ${r.rows.length} days.${r.errors.length ? ` Skipped: ${r.errors.slice(0, 5).join(' ')}` : ''}` });
  };

  const setLim = (id: string, p: Partial<Limitation>) => P({ limitations: pr.limitations.map((l) => (l.id === id ? { ...l, ...p } : l)) });

  return (
    <div>
      <PageHeader title="Settings & Profile" subtitle="Everything here is editable. Leave fields empty until you know them — nothing is guessed." />
      {msg && (
        <div className="mb-4">
          <Notice tone={msg.tone} onClose={() => setMsg(null)}>
            {msg.text}
          </Notice>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Profile" subtitle="Used for calorie and heart-rate calculations. Body weight lives in Body Measurements so history is kept.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">{(id) => <TextInput id={id} value={pr.name} onChange={(e) => P({ name: e.target.value })} />}</Field>
            <Field label="Sex (for physiological formulas)">
              {(id) => (
                <Select id={id} value={pr.sex ?? ''} onChange={(e) => P({ sex: (e.target.value || null) as UserProfile['sex'] })}>
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
              )}
            </Field>
            <Field label="Date of birth" hint="If set, age updates exactly.">{(id) => <TextInput id={id} type="date" value={pr.dateOfBirth ?? ''} onChange={(e) => P({ dateOfBirth: e.target.value || null })} />}</Field>
            <Field label="Age" hint={pr.dateOfBirth ? 'From date of birth' : pr.ageAsOf ? `Stated ${pr.statedAge} on ${pr.ageAsOf}; advances yearly` : undefined}>
              {(id) => <NumberInput id={id} value={pr.dateOfBirth ? age : pr.statedAge} disabled={!!pr.dateOfBirth} onChange={(v) => P({ statedAge: v, ageAsOf: todayISO() })} min={0} max={130} step={1} />}
            </Field>
            <Field label={`Height (${units.lengthUnit})`}>{(id) => <NumberInput id={id} value={pr.heightCm == null ? null : units.length(pr.heightCm)} onChange={(v) => P({ heightCm: v == null ? null : units.lengthToCm(v) })} min={0} />}</Field>
            <Field label="Resting heart rate (bpm)">{(id) => <NumberInput id={id} value={pr.restingHr} onChange={(v) => P({ restingHr: v })} min={20} max={150} />}</Field>
            <Field
              label="Max heart rate (bpm)"
              hint={
                pr.maxHrSource === 'estimated' ? (
                  'Estimated (Tanaka: 208 − 0.7 × age)'
                ) : pr.maxHr ? (
                  'Measured'
                ) : age != null ? (
                  <button type="button" className="underline hover:text-ink-300" onClick={() => P({ maxHr: Math.round(208 - 0.7 * age), maxHrSource: 'estimated' })}>
                    Estimate from age
                  </button>
                ) : undefined
              }
            >
              {(id) => <NumberInput id={id} value={pr.maxHr} onChange={(v) => P({ maxHr: v, maxHrSource: v == null ? null : 'measured' })} min={80} max={240} />}
            </Field>
            <Field label="Typical activity level (outside workouts)">
              {(id) => (
                <Select id={id} value={pr.activityLevel ?? ''} onChange={(e) => P({ activityLevel: (e.target.value || null) as UserProfile['activityLevel'] })}>
                  <option value="">Not set</option>
                  <option value="sedentary">Sedentary</option>
                  <option value="lightly-active">Lightly active</option>
                  <option value="moderately-active">Moderately active</option>
                  <option value="very-active">Very active</option>
                </Select>
              )}
            </Field>
            <Field label="Wearable device (optional)">{(id) => <TextInput id={id} value={pr.wearable} onChange={(e) => P({ wearable: e.target.value })} placeholder="e.g. Apple Watch Series 9" />}</Field>
            <Field label="Daily step target">{(id) => <NumberInput id={id} value={pr.dailyStepTarget} onChange={(v) => P({ dailyStepTarget: v })} min={0} step={500} />}</Field>
            <Field label="Daily exercise kcal target">{(id) => <NumberInput id={id} value={pr.dailyExerciseCalorieTarget} onChange={(v) => P({ dailyExerciseCalorieTarget: v })} min={0} step={50} />}</Field>
            <Field label="Units">
              {() => (
                <Segmented
                  ariaLabel="Unit system"
                  value={pr.unitSystem}
                  onChange={(v) => P({ unitSystem: v })}
                  options={[
                    { value: 'metric', label: 'Metric (kg, km)' },
                    { value: 'imperial', label: 'Imperial (lb, mi)' },
                  ]}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card
          title="Limitations"
          subtitle="Warnings appear when you log or view matching exercises."
          actions={
            <Button size="sm" onClick={() => P({ limitations: [...pr.limitations, { id: uid(), label: 'New limitation', appliesToKinds: [], active: true }] })}>
              <Plus size={14} aria-hidden /> Add
            </Button>
          }
        >
          <div className="space-y-3">
            {pr.limitations.length === 0 && <p className="text-sm text-ink-500">None.</p>}
            {pr.limitations.map((l) => (
              <div key={l.id} className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TextInput value={l.label} onChange={(e) => setLim(l.id, { label: e.target.value })} aria-label="Limitation" />
                  <Button size="sm" variant="ghost" aria-label="Delete limitation" onClick={() => P({ limitations: pr.limitations.filter((x) => x.id !== l.id) })}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <TextInput className="mb-2" value={l.notes ?? ''} onChange={(e) => setLim(l.id, { notes: e.target.value })} placeholder="Advice shown with the warning" aria-label="Notes" />
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5">
                  {KINDS.map(({ k, label }) => (
                    <label key={k} className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        className="accent-lime-400"
                        checked={l.appliesToKinds.includes(k)}
                        onChange={(e) => setLim(l.id, { appliesToKinds: e.target.checked ? [...l.appliesToKinds, k] : l.appliesToKinds.filter((x) => x !== k) })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Toggle checked={l.active} onChange={(v) => setLim(l.id, { active: v })} label="Active" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Calories & logging">
          <div className="space-y-4">
            <Field label="Calories shown throughout the app" hint="Gross = all energy during the activity. Net = gross minus what you'd burn at rest anyway (1 MET). Both are always stored.">
              {() => (
                <Segmented
                  ariaLabel="Calorie display"
                  value={state.settings.calorieDisplay}
                  onChange={(v) => updateSettings({ calorieDisplay: v })}
                  options={[
                    { value: 'gross', label: 'Gross' },
                    { value: 'net', label: 'Net (above resting)' },
                  ]}
                />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default rest timer (s)">{(id) => <NumberInput id={id} value={state.settings.defaultRestSeconds} onChange={(v) => updateSettings({ defaultRestSeconds: v ?? 90 })} min={0} max={3600} step={15} />}</Field>
              <Field label="Inferred seconds per rep" hint="Only for untimed sets; flagged low confidence.">
                {(id) => <NumberInput id={id} value={state.settings.inferredSecondsPerRep} onChange={(v) => updateSettings({ inferredSecondsPerRep: v ?? 3 })} min={0.5} max={20} step={0.5} />}
              </Field>
            </div>
            <Field label="Quick-add exercises">
              {() => (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {state.exercises.map((e) => (
                    <label key={e.id} className="inline-flex items-center gap-1.5 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        className="accent-lime-400"
                        checked={state.settings.quickAddExerciseIds.includes(e.id)}
                        onChange={(ev) =>
                          updateSettings({ quickAddExerciseIds: ev.target.checked ? [...state.settings.quickAddExerciseIds, e.id] : state.settings.quickAddExerciseIds.filter((x) => x !== e.id) })
                        }
                      />
                      {e.name}
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setMsg({ tone: 'success', text: `Recalculated ${store.recalcAll()} sessions with formula v${CALORIE_FORMULA_VERSION}.` })}>
                <RefreshCw size={16} aria-hidden /> Recalculate all estimates
              </Button>
              <span className="text-xs text-ink-500">Formula v{CALORIE_FORMULA_VERSION}</span>
            </div>
          </div>
        </Card>

        <Card title="Data" subtitle="Stored only in this browser (localStorage). Export regularly as a backup.">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium text-ink-300">Export</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => download(`exercise-tracker-${stamp}.json`, exportJson(state), 'application/json')}>
                  <Download size={16} aria-hidden /> Full backup (JSON)
                </Button>
                <Button onClick={() => download(`workouts-${stamp}.csv`, sessionsCsv(state), 'text/csv')}>
                  <Download size={16} aria-hidden /> Workouts CSV
                </Button>
                <Button onClick={() => download(`sets-${stamp}.csv`, setsCsv(state), 'text/csv')}>
                  <Download size={16} aria-hidden /> Sets CSV
                </Button>
                <Button onClick={() => download(`measurements-${stamp}.csv`, measurementsCsv(state), 'text/csv')}>
                  <Download size={16} aria-hidden /> Measurements CSV
                </Button>
                <Button onClick={() => download(`daily-activity-${stamp}.csv`, dailyCsv(state), 'text/csv')}>
                  <Download size={16} aria-hidden /> Daily activity CSV
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3 text-xs font-medium text-ink-300">
                Import backup (JSON)
                <Segmented
                  ariaLabel="Import mode"
                  value={importMode}
                  onChange={setImportMode}
                  options={[
                    { value: 'merge', label: 'Merge' },
                    { value: 'replace', label: 'Replace all' },
                  ]}
                />
              </div>
              <input ref={jsonRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onJson(e.target.files[0]).finally(() => (e.target.value = ''))} />
              <Button onClick={() => jsonRef.current?.click()}>
                <Upload size={16} aria-hidden /> Choose JSON file
              </Button>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-ink-300">Import CSV</div>
              <input ref={mCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onMeasCsv(e.target.files[0]).finally(() => (e.target.value = ''))} />
              <input ref={dCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onDailyCsv(e.target.files[0]).finally(() => (e.target.value = ''))} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => mCsvRef.current?.click()}>
                  <Upload size={16} aria-hidden /> Measurements CSV
                </Button>
                <Button onClick={() => dCsvRef.current?.click()}>
                  <Upload size={16} aria-hidden /> Daily steps CSV
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-ink-500">
                Measurements columns: {MEASUREMENT_COLUMNS.join(', ')}. Daily columns: date, steps, sleep_hours, recovery_notes. Dates as YYYY-MM-DD, metric units.
              </p>
            </div>
            <div className="border-t border-ink-800 pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  if (prompt('Type RESET to erase all data and restore the original profile and history.') === 'RESET') {
                    store.resetToSeed();
                    setMsg({ tone: 'success', text: 'Restored the original profile and history.' });
                  }
                }}
              >
                <RotateCcw size={16} aria-hidden /> Reset to initial data
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="About the calorie estimates">
        <div className="space-y-2 text-sm text-ink-400">
          <p>
            No calorie number in this app is a measurement. Each one is an estimate built from your body weight at the time, the actual active duration, and the best available data for that activity. Every estimate shows its method, inputs, assumptions and a confidence level.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-ink-200">MET</strong>: kcal = MET × 3.5 × kg ÷ 200 × active minutes (Compendium of Physical Activities). Net subtracts 1 MET.</li>
            <li><strong className="text-ink-200">Running/walking</strong>: ACSM metabolic equations using speed and grade, when distance+time or speed is known.</li>
            <li><strong className="text-ink-200">Cycling</strong>: power (watts) when available; otherwise speed bands or chosen intensity.</li>
            <li><strong className="text-ink-200">Heart rate</strong>: Keytel et al. (2005) equation for steady cardio when average HR, age and sex are known.</li>
            <li><strong className="text-ink-200">Strength</strong>: resistance-training METs × active set time only. Load and reps don't determine calories; untimed sets infer time from reps and are flagged.</li>
          </ul>
          <p>Better inputs (timed sets, speed, power, heart rate) narrow the estimate, but don't make it exact. Only active time counts — rest, waiting, pauses and the rest of the gym hour are excluded.</p>
        </div>
      </Card>
    </div>
  );
}

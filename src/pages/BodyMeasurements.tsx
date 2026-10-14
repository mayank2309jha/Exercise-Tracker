import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { BodyMeasurement, DailyActivitySummary } from '../domain/types';
import { latestValue, measurementPlotDate, navyBodyFat, weightTrend } from '../domain/body';
import { stepsForDay } from '../domain/aggregate';
import { formatDate, formatMonth, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { uid } from '../lib/id';
import { ChartCard, ChartLegend, LineSeries, WeightChart, CHART } from '../components/charts';
import { Badge, Button, Card, Field, Modal, NumberInput, PageHeader, Stat, TextInput } from '../components/ui';

function blank(): BodyMeasurement {
  return { id: uid(), date: todayISO(), datePrecision: 'day', dateEnd: null, weightKg: null, weightRangeKg: null, waistCm: null, neckCm: null, hipCm: null, bodyFatPct: null, restingHr: null, heightCm: null, source: 'manual' };
}

function dateText(m: BodyMeasurement): string {
  if (m.datePrecision === 'month') return `${formatMonth(m.date)} (month)`;
  if (m.datePrecision === 'range' && m.dateEnd) return `${formatMonth(m.date)} – ${formatMonth(m.dateEnd)}`;
  return formatDate(m.date);
}

export function BodyMeasurements() {
  const { state, units, upsertMeasurement, deleteMeasurement, upsertDaily, deleteDaily } = useStore();
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [daily, setDaily] = useState<DailyActivitySummary | null>(null);
  const sorted = [...state.measurements].sort((a, b) => measurementPlotDate(b).localeCompare(measurementPlotDate(a)));
  const trend = weightTrend(state.measurements);
  const latestW = trend[trend.length - 1];
  const waist = latestValue(state.measurements, 'waistCm');
  const neck = latestValue(state.measurements, 'neckCm');
  const hip = latestValue(state.measurements, 'hipCm');
  const bf = latestValue(state.measurements, 'bodyFatPct');
  const navy = navyBodyFat(state.profile.sex, state.profile.heightCm, (waist?.value as number) ?? null, (neck?.value as number) ?? null, (hip?.value as number) ?? null);
  const waistRows = [...state.measurements]
    .filter((m) => m.waistCm != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ label: formatDate(m.date), value: Math.round(units.length(m.waistCm!) * 10) / 10 }));
  const bmi = latestW && state.profile.heightCm ? latestW.weightKg / (state.profile.heightCm / 100) ** 2 : null;
  const dailySorted = [...state.dailyActivity].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title="Body Measurements"
        subtitle="Every entry is dated and kept. Adding a new weigh-in never changes older ones or past workouts."
        actions={
          <>
            <Button onClick={() => setDaily({ date: todayISO(), steps: null, stepsSource: 'manual', wearableActiveCalories: null, wearableTotalCalories: null, sleepHours: null, recoveryNotes: '' })}>
              <Plus size={16} aria-hidden /> Daily steps
            </Button>
            <Button variant="primary" onClick={() => setEditing(blank())}>
              <Plus size={16} aria-hidden /> Measurement
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Latest weigh-in" value={latestW ? fmtNum(units.weight(latestW.weightKg), 1) : '—'} unit={units.weightUnit} sub={latestW ? formatDate(latestW.date) : 'None'} accent />
        <Stat label="Smoothed trend" value={latestW ? fmtNum(units.weight(latestW.trendKg), 1) : '—'} unit={units.weightUnit} sub="Less sensitive to water swings" />
        <Stat label="Waist" value={waist ? fmtNum(units.length(waist.value as number), 1) : '—'} unit={units.lengthUnit} sub={waist ? formatDate(waist.date) : 'Not measured yet'} />
        <Stat
          label="Body fat"
          value={bf ? fmtNum(bf.value as number, 1) : navy ? fmtNum(navy, 1) : '—'}
          unit="%"
          sub={bf ? `Measured ${formatDate(bf.date)}` : navy ? 'US Navy estimate (waist/neck/height)' : 'Add waist + neck to estimate'}
        />
      </div>
      {bmi && <p className="mb-4 text-xs text-ink-500">BMI {fmtNum(bmi, 1)} (height {state.profile.heightCm} cm). BMI doesn't distinguish fat from muscle; waist and body-fat trends are better for tracking leanness.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Weight"
          subtitle="Dots: weigh-ins (hollow = approximate). Line: smoothed trend."
          unit={units.weightUnit}
          rows={trend.map((p) => ({ label: formatDate(p.date), value: Math.round(units.weight(p.weightKg) * 10) / 10, detail: `trend ${fmtNum(units.weight(p.trendKg), 1)}` }))}
          empty={trend.length === 0}
        >
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <WeightChart unit={units.weightUnit} points={trend.map((p) => ({ date: p.date, weight: units.weight(p.weightKg), trend: units.weight(p.trendKg), approximate: p.approximate }))} />
            </div>
            <ChartLegend
              items={[
                { label: 'Trend', swatch: <span className="h-0.5 w-4 rounded" style={{ background: CHART.accent }} /> },
                { label: 'Weigh-in', swatch: <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.muted }} /> },
                { label: 'Approximate', swatch: <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: CHART.muted }} /> },
              ]}
            />
          </div>
        </ChartCard>
        <ChartCard title="Waist circumference" subtitle={units.lengthUnit} unit={units.lengthUnit} rows={waistRows} empty={waistRows.length === 0}>
          <LineSeries rows={waistRows} unit={units.lengthUnit} />
        </ChartCard>
      </div>

      <Card className="mt-4" title="All measurements">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-ink-500">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Weight ({units.weightUnit})</th>
                <th className="py-2 text-right font-medium">Waist</th>
                <th className="py-2 text-right font-medium">Neck</th>
                <th className="py-2 text-right font-medium">Hip</th>
                <th className="py-2 text-right font-medium">Body fat</th>
                <th className="py-2 text-right font-medium">Rest HR</th>
                <th className="py-2 pl-4 font-medium">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sorted.map((m) => (
                <tr key={m.id} className="border-t border-ink-800 align-top">
                  <td className="py-2 text-ink-300">
                    {dateText(m)}
                    {m.source === 'seed' && <span className="ml-1.5"><Badge>imported</Badge></span>}
                  </td>
                  <td className="py-2 text-right">
                    {m.weightRangeKg ? `${fmtNum(units.weight(m.weightRangeKg[0]), 1)}–${fmtNum(units.weight(m.weightRangeKg[1]), 1)}` : fmtNum(m.weightKg == null ? null : units.weight(m.weightKg), 1)}
                  </td>
                  <td className="py-2 text-right">{fmtNum(m.waistCm == null ? null : units.length(m.waistCm), 1)}</td>
                  <td className="py-2 text-right">{fmtNum(m.neckCm == null ? null : units.length(m.neckCm), 1)}</td>
                  <td className="py-2 text-right">{fmtNum(m.hipCm == null ? null : units.length(m.hipCm), 1)}</td>
                  <td className="py-2 text-right">{m.bodyFatPct != null ? `${m.bodyFatPct}%` : '—'}</td>
                  <td className="py-2 text-right">{m.restingHr ?? '—'}</td>
                  <td className="max-w-[260px] py-2 pl-4 text-xs text-ink-500">{m.notes}</td>
                  <td className="whitespace-nowrap py-2 text-right">
                    <Button size="sm" variant="ghost" aria-label="Edit measurement" onClick={() => setEditing(structuredClone(m))}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Delete measurement" onClick={() => confirm('Delete this measurement?') && deleteMeasurement(m.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4" title="Daily activity" subtitle="Daily step totals, sleep and wearable totals. Wearable calories are shown for reference and never added to exercise calories.">
        {dailySorted.length === 0 ? (
          <p className="text-sm text-ink-500">No daily entries yet. Historical step aggregates (e.g. 83,502 steps over six days) are kept in the Walking exercise's records because their per-day split is unknown.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-ink-500">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Daily steps</th>
                  <th className="py-2 text-right font-medium">Reconciled</th>
                  <th className="py-2 text-right font-medium">Sleep (h)</th>
                  <th className="py-2 text-right font-medium">Wearable active / total kcal</th>
                  <th className="py-2 pl-4 font-medium">Recovery</th>
                  <th />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {dailySorted.map((d) => {
                  const r = stepsForDay(d.date, state.dailyActivity, state.sessions);
                  return (
                    <tr key={d.date} className="border-t border-ink-800">
                      <td className="py-2 text-ink-300">{formatDate(d.date)}</td>
                      <td className="py-2 text-right">{fmtNum(d.steps)}</td>
                      <td className="py-2 text-right" title={r.note}>
                        {fmtNum(r.total)}
                        {r.addedFromWorkouts > 0 && d.steps != null && <span className="ml-1 text-[11px] text-ink-500">+{fmtNum(r.addedFromWorkouts)}</span>}
                      </td>
                      <td className="py-2 text-right">{fmtNum(d.sleepHours, 1)}</td>
                      <td className="py-2 text-right">
                        {fmtNum(d.wearableActiveCalories)} / {fmtNum(d.wearableTotalCalories)}
                      </td>
                      <td className="py-2 pl-4 text-xs text-ink-500">{d.recoveryNotes}</td>
                      <td className="whitespace-nowrap py-2 text-right">
                        <Button size="sm" variant="ghost" aria-label="Edit day" onClick={() => setDaily({ ...d })}>
                          <Pencil size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Delete day" onClick={() => confirm('Delete this day?') && deleteDaily(d.date)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <MeasurementModal m={editing} onClose={() => setEditing(null)} onSave={(m) => { upsertMeasurement(m); setEditing(null); }} />}
      {daily && <DailyModal d={daily} onClose={() => setDaily(null)} onSave={(d) => { upsertDaily(d); setDaily(null); }} />}
    </div>
  );
}

function MeasurementModal({ m, onClose, onSave }: { m: BodyMeasurement; onClose: () => void; onSave: (m: BodyMeasurement) => void }) {
  const { units } = useStore();
  const [v, setV] = useState(m);
  const p = (x: Partial<BodyMeasurement>) => setV((c) => ({ ...c, ...x }));
  const hasAny = [v.weightKg, v.waistCm, v.neckCm, v.hipCm, v.bodyFatPct, v.restingHr].some((x) => x != null);
  const L = (cm: number | null) => (cm == null ? null : units.length(cm));
  const toCm = (x: number | null) => (x == null ? null : units.lengthToCm(x));
  const invalid = (v.weightKg != null && (v.weightKg < 20 || v.weightKg > 400)) || (v.bodyFatPct != null && (v.bodyFatPct < 1 || v.bodyFatPct > 80));
  return (
    <Modal
      open
      onClose={onClose}
      title={m.weightKg == null && m.waistCm == null ? 'New measurement' : 'Edit measurement'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!hasAny || !v.date || invalid} onClick={() => onSave({ ...v, weightRangeKg: v.weightRangeKg && v.weightKg === m.weightKg ? v.weightRangeKg : null })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <TextInput id={id} type="date" value={v.date} onChange={(e) => p({ date: e.target.value, datePrecision: 'day', dateEnd: null })} />}</Field>
        <Field label={`Weight (${units.weightUnit})`}>{(id) => <NumberInput id={id} value={v.weightKg == null ? null : units.weight(v.weightKg)} onChange={(x) => p({ weightKg: x == null ? null : units.weightToKg(x) })} min={0} />}</Field>
        <Field label={`Waist (${units.lengthUnit})`} hint="At the navel, relaxed.">{(id) => <NumberInput id={id} value={L(v.waistCm)} onChange={(x) => p({ waistCm: toCm(x) })} min={0} />}</Field>
        <Field label={`Neck (${units.lengthUnit})`}>{(id) => <NumberInput id={id} value={L(v.neckCm)} onChange={(x) => p({ neckCm: toCm(x) })} min={0} />}</Field>
        <Field label={`Hip (${units.lengthUnit})`}>{(id) => <NumberInput id={id} value={L(v.hipCm)} onChange={(x) => p({ hipCm: toCm(x) })} min={0} />}</Field>
        <Field label="Body fat (%)" hint="Only if measured (scale, DEXA, calipers).">{(id) => <NumberInput id={id} value={v.bodyFatPct} onChange={(x) => p({ bodyFatPct: x })} min={1} max={80} />}</Field>
        <Field label="Body-fat method">{(id) => <TextInput id={id} value={v.bodyFatMethod ?? ''} onChange={(e) => p({ bodyFatMethod: e.target.value || null })} placeholder="e.g. smart scale" />}</Field>
        <Field label="Resting HR (bpm)">{(id) => <NumberInput id={id} value={v.restingHr} onChange={(x) => p({ restingHr: x })} min={20} max={150} />}</Field>
        <Field label="Notes" className="col-span-2">{(id) => <TextInput id={id} value={v.notes ?? ''} onChange={(e) => p({ notes: e.target.value || undefined })} placeholder="Morning, after bathroom, before food…" />}</Field>
      </div>
      {!hasAny && <p className="mt-3 text-xs text-ink-500">Enter at least one measurement. Empty fields stay empty — nothing is guessed.</p>}
    </Modal>
  );
}

function DailyModal({ d, onClose, onSave }: { d: DailyActivitySummary; onClose: () => void; onSave: (d: DailyActivitySummary) => void }) {
  const [v, setV] = useState(d);
  const p = (x: Partial<DailyActivitySummary>) => setV((c) => ({ ...c, ...x }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Daily activity"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!v.date} onClick={() => onSave(v)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <TextInput id={id} type="date" value={v.date} onChange={(e) => p({ date: e.target.value })} />}</Field>
        <Field label="Total steps for the day" hint="From your phone/watch. Workout steps flagged as already included won't be added again.">
          {(id) => <NumberInput id={id} value={v.steps} onChange={(x) => p({ steps: x, stepsSource: x == null ? null : v.stepsSource ?? 'manual' })} min={0} step={1} />}
        </Field>
        <Field label="Steps source">
          {(id) => (
            <select id={id} className="w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm" value={v.stepsSource ?? ''} onChange={(e) => p({ stepsSource: (e.target.value || null) as DailyActivitySummary['stepsSource'] })}>
              <option value="">—</option>
              <option value="manual">Manual</option>
              <option value="wearable">Wearable / phone</option>
            </select>
          )}
        </Field>
        <Field label="Sleep (hours)">{(id) => <NumberInput id={id} value={v.sleepHours} onChange={(x) => p({ sleepHours: x })} min={0} max={24} />}</Field>
        <Field label="Wearable active kcal" hint="Reference only">{(id) => <NumberInput id={id} value={v.wearableActiveCalories} onChange={(x) => p({ wearableActiveCalories: x })} min={0} />}</Field>
        <Field label="Wearable total kcal" hint="Total daily energy; never added to workouts">{(id) => <NumberInput id={id} value={v.wearableTotalCalories} onChange={(x) => p({ wearableTotalCalories: x })} min={0} />}</Field>
        <Field label="Recovery notes" className="col-span-2">{(id) => <TextInput id={id} value={v.recoveryNotes} onChange={(e) => p({ recoveryNotes: e.target.value })} placeholder="Soreness, shin pain, energy…" />}</Field>
      </div>
    </Modal>
  );
}

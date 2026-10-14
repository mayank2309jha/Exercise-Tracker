import type { AppState, BodyMeasurement, DailyActivitySummary } from '../domain/types';
import { findExercise } from '../domain/session';
import { bestSet, entryVolumeKg, setReps, totalLoadKg } from '../domain/strength';
import { entryActiveSeconds } from '../domain/time';
import { isValidISODate } from '../lib/dates';
import { uid } from '../lib/id';
import { migrate } from './persistence';
import { parseState, type ParseResult } from './schema';

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function exportJson(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  return parseState(migrate(raw));
}

/**
 * Merge an imported backup into current data. Records with the same id are
 * replaced by the imported version; everything else is kept. Profile and
 * settings come from the import.
 */
export function mergeStates(current: AppState, incoming: AppState): AppState {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((x) => [x.id, x]));
    b.forEach((x) => map.set(x.id, x));
    return [...map.values()];
  };
  const daily = new Map(current.dailyActivity.map((d) => [d.date, d]));
  incoming.dailyActivity.forEach((d) => daily.set(d.date, d));
  return {
    ...current,
    profile: incoming.profile,
    settings: incoming.settings,
    measurements: byId(current.measurements, incoming.measurements),
    exercises: byId(current.exercises, incoming.exercises),
    historicalRecords: byId(current.historicalRecords, incoming.historicalRecords),
    sessions: byId(current.sessions, incoming.sessions),
    templates: byId(current.templates, incoming.templates),
    goals: byId(current.goals, incoming.goals),
    dailyActivity: [...daily.values()],
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
}

/** Minimal RFC-4180 parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function sessionsCsv(state: AppState): string {
  const rows = state.sessions.flatMap((s) =>
    s.entries.map((e) => {
      const def = findExercise(state.exercises, e.exerciseId);
      const bs = bestSet(e);
      return {
        session_id: s.id,
        date: s.date ?? '',
        start_time: s.startTime ?? '',
        status: s.status,
        session_title: s.title,
        exercise: def?.name ?? e.exerciseId,
        variation: e.variation,
        intensity: e.intensity,
        active_seconds: Math.round(entryActiveSeconds(e)),
        distance_km: e.cardio?.distanceKm ?? '',
        steps: e.cardio?.steps ?? '',
        sets: e.sets.length,
        total_reps: e.sets.reduce((n, x) => n + setReps(x), 0),
        volume_kg: Math.round(entryVolumeKg(e)),
        best_set: bs ? `${bs.loadKg}kg x ${bs.reps}` : '',
        kcal_gross: e.estimate ? Math.round(e.estimate.gross) : '',
        kcal_net: e.estimate ? Math.round(e.estimate.net) : '',
        kcal_method: e.estimate?.methodLabel ?? '',
        kcal_confidence: e.estimate?.confidence ?? '',
        formula_version: e.estimate?.formulaVersion ?? '',
        body_weight_kg: e.estimate?.weightKg ?? '',
      };
    }),
  );
  return toCsv(rows);
}

export function setsCsv(state: AppState): string {
  const rows = state.sessions.flatMap((s) =>
    s.entries.flatMap((e) =>
      e.sets.map((x, i) => ({
        session_id: s.id,
        date: s.date ?? '',
        exercise: findExercise(state.exercises, e.exerciseId)?.name ?? e.exerciseId,
        set: i + 1,
        status: x.status,
        reps: x.reps ?? '',
        reps_left: x.repsLeft ?? '',
        reps_right: x.repsRight ?? '',
        load_entered_kg: x.loadKg ?? '',
        load_basis: x.loadBasis,
        implements: x.implements,
        bar_kg: x.barKg ?? '',
        total_load_kg: totalLoadKg(x) ?? '',
        load_range_kg: x.loadRangeKg ? x.loadRangeKg.join('-') : '',
        active_seconds: x.activeSeconds ?? '',
        active_source: x.activeSource ?? '',
        hold_seconds: x.holdSeconds ?? '',
        rpe: x.rpe ?? '',
        rir: x.rir ?? '',
      })),
    ),
  );
  return toCsv(rows);
}

export const MEASUREMENT_COLUMNS = ['date', 'weight_kg', 'waist_cm', 'neck_cm', 'hip_cm', 'body_fat_pct', 'resting_hr', 'notes'];

export function measurementsCsv(state: AppState): string {
  return toCsv(
    state.measurements.map((m) => ({
      date: m.date,
      date_precision: m.datePrecision,
      weight_kg: m.weightKg ?? '',
      waist_cm: m.waistCm ?? '',
      neck_cm: m.neckCm ?? '',
      hip_cm: m.hipCm ?? '',
      body_fat_pct: m.bodyFatPct ?? '',
      resting_hr: m.restingHr ?? '',
      notes: m.notes ?? '',
    })),
  );
}

export function dailyCsv(state: AppState): string {
  return toCsv(
    state.dailyActivity.map((d) => ({
      date: d.date,
      steps: d.steps ?? '',
      steps_source: d.stepsSource ?? '',
      sleep_hours: d.sleepHours ?? '',
      wearable_active_kcal: d.wearableActiveCalories ?? '',
      wearable_total_kcal: d.wearableTotalCalories ?? '',
      recovery_notes: d.recoveryNotes,
    })),
    ['date', 'steps', 'steps_source', 'sleep_hours', 'wearable_active_kcal', 'wearable_total_kcal', 'recovery_notes'],
  );
}

function optNum(v: string | undefined, min: number, max: number): number | null | 'invalid' {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return 'invalid';
  return n;
}

export interface CsvImport<T> {
  rows: T[];
  errors: string[];
}

/** Import body measurements from CSV (columns: date, weight_kg, waist_cm, neck_cm, hip_cm, body_fat_pct, resting_hr, notes). */
export function importMeasurementsCsv(text: string): CsvImport<BodyMeasurement> {
  const out: BodyMeasurement[] = [];
  const errors: string[] = [];
  parseCsv(text).forEach((r, i) => {
    const line = i + 2;
    if (!isValidISODate(r.date)) {
      errors.push(`Row ${line}: invalid date "${r.date ?? ''}" (use YYYY-MM-DD).`);
      return;
    }
    const fields = {
      weightKg: optNum(r.weight_kg, 20, 400),
      waistCm: optNum(r.waist_cm, 20, 300),
      neckCm: optNum(r.neck_cm, 10, 100),
      hipCm: optNum(r.hip_cm, 20, 300),
      bodyFatPct: optNum(r.body_fat_pct, 1, 80),
      restingHr: optNum(r.resting_hr, 20, 150),
    };
    const bad = Object.entries(fields).filter(([, v]) => v === 'invalid').map(([k]) => k);
    if (bad.length) {
      errors.push(`Row ${line}: out-of-range value for ${bad.join(', ')}.`);
      return;
    }
    const f = fields as Record<keyof typeof fields, number | null>;
    if (Object.values(f).every((v) => v == null)) {
      errors.push(`Row ${line}: no measurements.`);
      return;
    }
    out.push({ id: uid(), date: r.date, datePrecision: 'day', dateEnd: null, ...f, heightCm: null, source: 'import-file', notes: r.notes || undefined });
  });
  return { rows: out, errors };
}

/** Import daily steps from CSV (columns: date, steps[, sleep_hours]). */
export function importDailyCsv(text: string): CsvImport<DailyActivitySummary> {
  const out: DailyActivitySummary[] = [];
  const errors: string[] = [];
  parseCsv(text).forEach((r, i) => {
    const line = i + 2;
    if (!isValidISODate(r.date)) {
      errors.push(`Row ${line}: invalid date.`);
      return;
    }
    const steps = optNum(r.steps, 0, 200000);
    const sleep = optNum(r.sleep_hours, 0, 24);
    if (steps === 'invalid' || sleep === 'invalid') {
      errors.push(`Row ${line}: out-of-range value.`);
      return;
    }
    out.push({ date: r.date, steps, stepsSource: steps != null ? 'manual' : null, sleepHours: sleep, wearableActiveCalories: null, wearableTotalCalories: null, recoveryNotes: r.recovery_notes ?? '' });
  });
  return { rows: out, errors };
}

export function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

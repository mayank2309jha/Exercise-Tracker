import { addDays, addMonths, monthStart, weekStart } from '../lib/dates';
import { bestE1rm, bestSet, countsAsWork, entryVolumeKg, setReps } from './strength';
import { entryActiveSeconds } from './time';
import { countsTowardTotals, entryCalories, findExercise } from './session';
import type {
  CalorieDisplay,
  DailyActivitySummary,
  ExerciseCategory,
  ExerciseDefinition,
  ISODate,
  PersonalRecord,
  WorkoutSession,
} from './types';

export interface SessionFilter {
  category: ExerciseCategory | 'all';
  exerciseId: string | 'all';
  from: ISODate | null;
  to: ISODate | null;
}

export const NO_FILTER: SessionFilter = { category: 'all', exerciseId: 'all', from: null, to: null };

/**
 * Apply a filter. Category/exercise filters keep only the matching entries so totals
 * reflect just the selected work.
 */
export function filterSessions(sessions: WorkoutSession[], exercises: ExerciseDefinition[], f: SessionFilter): WorkoutSession[] {
  return sessions
    .filter(countsTowardTotals)
    .filter((s) => (f.from == null || (s.date != null && s.date >= f.from)) && (f.to == null || (s.date != null && s.date <= f.to)))
    .map((s) => {
      if (f.category === 'all' && f.exerciseId === 'all') return s;
      const entries = s.entries.filter((e) => {
        const def = findExercise(exercises, e.exerciseId);
        if (f.exerciseId !== 'all' && e.exerciseId !== f.exerciseId) return false;
        if (f.category !== 'all' && def?.category !== f.category) return false;
        return true;
      });
      return { ...s, entries };
    })
    .filter((s) => s.entries.length > 0);
}

export interface PeriodTotals {
  sessions: number;
  activeSeconds: number;
  gross: number;
  net: number;
  volumeKg: number;
  distanceKm: number;
}

export function totals(sessions: WorkoutSession[]): PeriodTotals {
  let activeSeconds = 0;
  let gross = 0;
  let net = 0;
  let volumeKg = 0;
  let distanceKm = 0;
  for (const s of sessions) {
    for (const e of s.entries) {
      activeSeconds += entryActiveSeconds(e);
      gross += entryCalories(e, 'gross');
      net += entryCalories(e, 'net');
      volumeKg += entryVolumeKg(e);
      distanceKm += e.cardio?.distanceKm ?? 0;
    }
  }
  return { sessions: sessions.length, activeSeconds, gross, net, volumeKg, distanceKm };
}

export function sessionsBetween(sessions: WorkoutSession[], from: ISODate, to: ISODate): WorkoutSession[] {
  return sessions.filter((s) => s.date != null && s.date >= from && s.date <= to);
}

export interface Bucket extends PeriodTotals {
  key: ISODate;
}

/** Weekly buckets (Monday start), oldest first, ending at the week of `today`. */
export function weeklyBuckets(sessions: WorkoutSession[], today: ISODate, weeks: number): Bucket[] {
  const end = weekStart(today);
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(end, -7 * i);
    out.push({ key: start, ...totals(sessionsBetween(sessions, start, addDays(start, 6))) });
  }
  return out;
}

export function monthlyBuckets(sessions: WorkoutSession[], today: ISODate, months: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(monthStart(today), -i);
    const end = addDays(addMonths(start, 1), -1);
    out.push({ key: start, ...totals(sessionsBetween(sessions, start, end)) });
  }
  return out;
}

/** Calories per day for the heatmap. */
export function dailyCalories(sessions: WorkoutSession[], mode: CalorieDisplay): Map<ISODate, { kcal: number; sessions: number; activeSeconds: number }> {
  const map = new Map<ISODate, { kcal: number; sessions: number; activeSeconds: number }>();
  for (const s of sessions) {
    if (!s.date) continue;
    const cur = map.get(s.date) ?? { kcal: 0, sessions: 0, activeSeconds: 0 };
    cur.sessions += 1;
    for (const e of s.entries) {
      cur.kcal += entryCalories(e, mode);
      cur.activeSeconds += entryActiveSeconds(e);
    }
    map.set(s.date, cur);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Steps reconciliation
// ---------------------------------------------------------------------------

export interface StepsForDay {
  total: number | null;
  dailyRecorded: number | null;
  workoutSteps: number;
  /** Workout steps added on top of the daily total because they were not already in it. */
  addedFromWorkouts: number;
  note: string;
}

/**
 * Steps for a day without double counting.
 * - If a daily total exists, workout steps flagged "included in daily total" are NOT added again.
 * - Workout steps flagged as not included (e.g. phone left in a locker) are added.
 * - With no daily total, the workout steps are the only data.
 */
export function stepsForDay(date: ISODate, daily: DailyActivitySummary[], sessions: WorkoutSession[]): StepsForDay {
  const d = daily.find((x) => x.date === date);
  let workoutSteps = 0;
  let notIncluded = 0;
  for (const s of sessions) {
    if (s.date !== date || !countsTowardTotals(s)) continue;
    for (const e of s.entries) {
      const st = e.cardio?.steps ?? 0;
      workoutSteps += st;
      if (e.cardio && !e.cardio.stepsIncludedInDailyTotal) notIncluded += st;
    }
  }
  if (d?.steps != null) {
    return {
      total: d.steps + notIncluded,
      dailyRecorded: d.steps,
      workoutSteps,
      addedFromWorkouts: notIncluded,
      note: notIncluded > 0 ? `Daily total plus ${notIncluded.toLocaleString()} workout steps not captured by it.` : workoutSteps > 0 ? 'Workout steps are already inside the daily total; not added twice.' : 'Daily total.',
    };
  }
  if (workoutSteps > 0) return { total: workoutSteps, dailyRecorded: null, workoutSteps, addedFromWorkouts: workoutSteps, note: 'No daily total recorded; workout steps only.' };
  return { total: null, dailyRecorded: null, workoutSteps: 0, addedFromWorkouts: 0, note: 'No steps recorded.' };
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

/**
 * PRs from completed/imported sessions only. Planned and historical-estimate
 * records live in HistoricalRecord and never become PRs automatically.
 * Machine exercises are compared per machine id, because stack weights differ between machines.
 */
export function personalRecords(sessions: WorkoutSession[], exercises: ExerciseDefinition[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const consider = (pr: PersonalRecord, higherIsBetter = true) => {
    const key = `${pr.exerciseId}|${pr.type}|${pr.machineId ?? ''}`;
    const cur = best.get(key);
    if (!cur || (higherIsBetter ? pr.value > cur.value : pr.value < cur.value)) best.set(key, pr);
  };

  for (const s of sessions.filter(countsTowardTotals)) {
    for (const e of s.entries) {
      const def = findExercise(exercises, e.exerciseId);
      if (!def) continue;
      const machineId = e.loadMode === 'machine' && e.machineId ? e.machineId : undefined;
      const base = { exerciseId: e.exerciseId, sessionId: s.id, date: s.date, machineId };
      if (e.cardio) {
        const c = e.cardio;
        const active = entryActiveSeconds(e);
        if (c.distanceKm) consider({ ...base, type: 'longest-distance', value: c.distanceKm, unit: 'km', label: 'Longest distance' });
        if (c.distanceKm && active > 0 && c.distanceKm >= 1) consider({ ...base, type: 'fastest-pace', value: active / c.distanceKm, unit: 's/km', label: 'Fastest pace (≥1 km)' }, false);
        if (active > 0) consider({ ...base, type: 'longest-duration', value: active, unit: 's', label: 'Longest active duration' });
        continue;
      }
      const bs = bestSet(e);
      if (bs && bs.loadKg > 0) consider({ ...base, type: 'max-load', value: bs.loadKg, unit: e.loadMode === 'dumbbell' ? 'kg / dumbbell' : 'kg', label: `Heaviest set (${bs.reps} reps)` });
      const e1 = bestE1rm(e);
      if (e1) consider({ ...base, type: 'best-e1rm', value: e1, unit: 'kg', label: 'Best estimated 1RM (Epley)' });
      const maxReps = Math.max(0, ...e.sets.filter(countsAsWork).map(setReps));
      if (maxReps > 0) consider({ ...base, type: 'max-reps', value: maxReps, unit: 'reps', label: 'Most reps in a set' });
      const vol = entryVolumeKg(e);
      if (vol > 0) consider({ ...base, type: 'max-volume-session', value: vol, unit: 'kg', label: 'Most volume in a session' });
      const hold = Math.max(0, ...e.sets.filter(countsAsWork).map((x) => x.holdSeconds ?? 0));
      if (hold > 0) consider({ ...base, type: 'longest-hold', value: hold, unit: 's', label: 'Longest hold' });
    }
  }
  return [...best.values()];
}

/** Per-session strength series for one exercise, for progression charts. */
export function strengthSeries(sessions: WorkoutSession[], exerciseId: string) {
  return sessions
    .filter((s) => countsTowardTotals(s) && s.date)
    .flatMap((s) =>
      s.entries
        .filter((e) => e.exerciseId === exerciseId)
        .map((e) => {
          const bs = bestSet(e);
          return {
            date: s.date!,
            sessionId: s.id,
            machineId: e.machineId,
            bestLoadKg: bs?.loadKg ?? null,
            bestReps: bs?.reps ?? null,
            e1rmKg: bestE1rm(e),
            volumeKg: entryVolumeKg(e),
            totalReps: e.sets.filter(countsAsWork).reduce((n, x) => n + setReps(x), 0),
            sets: e.sets.filter(countsAsWork).length,
            approximate: e.sets.some((x) => x.loadRangeKg != null),
          };
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The previous session's sets for an exercise — used as editable defaults. */
export function lastEntryFor(sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string) {
  const sorted = sessions
    .filter((s) => s.id !== excludeSessionId && countsTowardTotals(s))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt.localeCompare(a.createdAt));
  for (const s of sorted) {
    const e = s.entries.find((x) => x.exerciseId === exerciseId);
    if (e) return { session: s, entry: e };
  }
  return null;
}

export function cardioSeries(sessions: WorkoutSession[], exerciseIds: string[]) {
  return sessions
    .filter((s) => countsTowardTotals(s) && s.date)
    .flatMap((s) =>
      s.entries
        .filter((e) => exerciseIds.includes(e.exerciseId) && e.cardio)
        .map((e) => {
          const active = entryActiveSeconds(e);
          const km = e.cardio!.distanceKm;
          return {
            date: s.date!,
            sessionId: s.id,
            exerciseId: e.exerciseId,
            distanceKm: km,
            activeSeconds: active,
            paceSecPerKm: km && active ? active / km : null,
            speedKmh: e.cardio!.avgSpeedKmh ?? (km && active ? km / (active / 3600) : null),
            steps: e.cardio!.steps,
            gross: e.estimate?.gross ?? 0,
            net: e.estimate?.net ?? 0,
          };
        }),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}


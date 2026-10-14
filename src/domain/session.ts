import { ageOn, weightOn } from './body';
import { CALORIE_FORMULA_VERSION, estimateEntry } from './calories';
import type {
  AppSettings,
  BodyMeasurement,
  CalorieDisplay,
  CardioData,
  ExerciseDefinition,
  ExerciseEntry,
  ExerciseSet,
  Intensity,
  UserProfile,
  WorkoutSession,
} from './types';
import { uid } from '../lib/id';

export interface EstimationDeps {
  profile: UserProfile;
  measurements: BodyMeasurement[];
  exercises: ExerciseDefinition[];
  settings: AppSettings;
}

export function findExercise(exercises: ExerciseDefinition[], id: string): ExerciseDefinition | undefined {
  return exercises.find((e) => e.id === id);
}

/** Body weight to use for a session: what the session records, else the measurement history. */
export function sessionWeight(session: WorkoutSession, measurements: BodyMeasurement[]) {
  if (session.bodyWeightKg != null && session.bodyWeightKg > 0) {
    return { weightKg: session.bodyWeightKg, source: session.bodyWeightSource ?? 'manual' } as const;
  }
  const w = weightOn(measurements, session.date);
  return { weightKg: w.weightKg, source: w.source } as const;
}

/** Recompute every entry's calorie estimate. Pure: returns a new session. */
export function recalcSession(session: WorkoutSession, deps: EstimationDeps): WorkoutSession {
  const w = sessionWeight(session, deps.measurements);
  const age = session.date ? ageOn(deps.profile, session.date) : ageOn(deps.profile, new Date().toISOString().slice(0, 10));
  return {
    ...session,
    entries: session.entries.map((entry) => {
      const def = findExercise(deps.exercises, entry.exerciseId);
      if (!def) return { ...entry, estimate: null };
      return {
        ...entry,
        estimate: estimateEntry(entry, def, {
          weightKg: w.weightKg,
          weightSource: w.source,
          age,
          sex: deps.profile.sex,
          inferredSecondsPerRep: deps.settings.inferredSecondsPerRep,
        }),
      };
    }),
  };
}

export function isEstimateOutdated(entry: ExerciseEntry): boolean {
  return entry.estimate != null && entry.estimate.formulaVersion !== CALORIE_FORMULA_VERSION;
}

export function entryCalories(entry: ExerciseEntry, mode: CalorieDisplay): number {
  if (!entry.estimate) return 0;
  return mode === 'gross' ? entry.estimate.gross : entry.estimate.net;
}

export function sessionCalories(session: WorkoutSession, mode: CalorieDisplay): number {
  return session.entries.reduce((s, e) => s + entryCalories(e, mode), 0);
}

export function sessionCalorieRange(session: WorkoutSession): { low: number; high: number } {
  return session.entries.reduce(
    (acc, e) => ({ low: acc.low + (e.estimate?.low ?? 0), high: acc.high + (e.estimate?.high ?? 0) }),
    { low: 0, high: 0 },
  );
}

/** Sessions that represent work actually done (planned workouts are excluded). */
export function countsTowardTotals(session: WorkoutSession): boolean {
  return session.status === 'completed' || session.status === 'imported-incomplete';
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function emptyCardio(): CardioData {
  return {
    distanceKm: null,
    activeSeconds: null,
    activeSource: null,
    avgSpeedKmh: null,
    maxSpeedKmh: null,
    inclinePct: null,
    elevationGainM: null,
    steps: null,
    stepsIncludedInDailyTotal: true,
    jumps: null,
    cadence: null,
    resistance: '',
    powerW: null,
    setting: null,
    treadmill: false,
    terrain: '',
    cyclingType: '',
    carriedLoadKg: null,
    ropeType: '',
    intervals: null,
  };
}

export function emptySet(partial: Partial<ExerciseSet> = {}): ExerciseSet {
  return {
    id: uid(),
    status: 'completed',
    reps: null,
    loadKg: null,
    loadBasis: 'total',
    implements: 1,
    activeSeconds: null,
    activeSource: null,
    ...partial,
  };
}

const CARDIO_LIKE = new Set(['run', 'walk', 'cycle', 'jumprope', 'hiit']);

export function isCardioKind(kind: ExerciseDefinition['kind']): boolean {
  return CARDIO_LIKE.has(kind);
}

export function newEntry(def: ExerciseDefinition, intensity: Intensity = 'moderate'): ExerciseEntry {
  const cardio = isCardioKind(def.kind) ? emptyCardio() : null;
  const loadBasis = def.defaultLoadMode === 'dumbbell' || def.defaultLoadMode === 'kettlebell' ? 'per-implement' : def.defaultLoadMode === 'bodyweight' ? 'bodyweight' : def.defaultLoadMode === 'machine' ? 'stack' : 'total';
  return {
    id: uid(),
    exerciseId: def.id,
    variation: def.variations[0] ?? '',
    equipment: def.equipment[0] ?? '',
    machineId: '',
    loadMode: def.defaultLoadMode,
    intensity,
    sets: cardio ? [] : [emptySet({ loadBasis, implements: loadBasis === 'per-implement' ? 2 : 1, repCountMode: def.repCountOptions?.[0] })],
    cardio,
    avgHr: null,
    maxHr: null,
    rpe: null,
    manualCalories: null,
    estimate: null,
    notes: '',
  };
}

export function newSession(date: string, startTime: string | null): WorkoutSession {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: 'Workout',
    date,
    datePrecision: 'day',
    startTime,
    category: 'mixed',
    status: 'in-progress',
    bodyWeightKg: null,
    bodyWeightSource: null,
    totalSessionSeconds: null,
    manualRestSeconds: null,
    manualWaitingSeconds: null,
    manualPausedSeconds: null,
    intervals: [],
    entries: [],
    rpe: null,
    notes: '',
    source: 'manual',
    clarifications: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Category from the entries' exercise categories. */
export function deriveCategory(session: WorkoutSession, exercises: ExerciseDefinition[]): WorkoutSession['category'] {
  const cats = new Set(session.entries.map((e) => findExercise(exercises, e.exerciseId)?.category).filter(Boolean));
  if (cats.size === 1) return [...cats][0] as WorkoutSession['category'];
  return 'mixed';
}

/**
 * A likely duplicate: same date and the same exercises, starting within 30 minutes
 * (or both without a start time), or the same external id.
 */
export function findDuplicate(session: WorkoutSession, sessions: WorkoutSession[]): WorkoutSession | null {
  const key = (s: WorkoutSession) => [...new Set(s.entries.map((e) => e.exerciseId))].sort().join('|');
  const k = key(session);
  const toMin = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);
  for (const other of sessions) {
    if (other.id === session.id) continue;
    if (session.externalId && other.externalId === session.externalId) return other;
    if (!session.date || other.date !== session.date) continue;
    if (key(other) !== k || k === '') continue;
    const a = toMin(session.startTime);
    const b = toMin(other.startTime);
    if (a == null || b == null || Math.abs(a - b) <= 30) return other;
  }
  return null;
}

/** Validation messages that block saving. */
export function validateSession(session: WorkoutSession, exercises: ExerciseDefinition[]): string[] {
  const errors: string[] = [];
  if (session.entries.length === 0) errors.push('Add at least one exercise.');
  if (session.date == null && session.status !== 'imported-incomplete') errors.push('Choose a date for the workout.');
  if (session.bodyWeightKg != null && !(session.bodyWeightKg > 20 && session.bodyWeightKg < 400)) errors.push('Body weight looks invalid.');
  session.entries.forEach((entry) => {
    const def = findExercise(exercises, entry.exerciseId);
    const name = def?.name ?? 'Unknown exercise';
    if (!def) errors.push(`${name}: exercise not found in library.`);
    if (entry.cardio) {
      const c = entry.cardio;
      if (c.activeSeconds != null && c.activeSeconds < 0) errors.push(`${name}: active time cannot be negative.`);
      if (c.distanceKm != null && c.distanceKm < 0) errors.push(`${name}: distance cannot be negative.`);
      if (c.avgSpeedKmh != null && c.avgSpeedKmh > 80) errors.push(`${name}: speed looks implausible.`);
      if (c.inclinePct != null && (c.inclinePct < -30 || c.inclinePct > 40)) errors.push(`${name}: incline must be between −30% and 40%.`);
      if (c.intervals && c.intervals.completedRounds > c.intervals.rounds) errors.push(`${name}: completed rounds exceed planned rounds.`);
    } else {
      if (entry.sets.length === 0) errors.push(`${name}: add at least one set.`);
      entry.sets.forEach((s, i) => {
        if (s.reps != null && (s.reps < 0 || !Number.isFinite(s.reps))) errors.push(`${name} set ${i + 1}: reps must be 0 or more.`);
        if (s.loadKg != null && s.loadKg < 0) errors.push(`${name} set ${i + 1}: load cannot be negative.`);
        if (s.activeSeconds != null && s.activeSeconds < 0) errors.push(`${name} set ${i + 1}: active time cannot be negative.`);
      });
    }
    if (entry.manualCalories != null && entry.manualCalories < 0) errors.push(`${name}: manual calories cannot be negative.`);
    if (entry.avgHr != null && (entry.avgHr < 30 || entry.avgHr > 230)) errors.push(`${name}: heart rate must be 30–230 bpm.`);
  });
  return errors;
}

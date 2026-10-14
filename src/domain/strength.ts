import type { ExerciseEntry, ExerciseSet, LoadMode } from './types';

/**
 * Total external load moved per rep, in kg.
 * - per-implement: load × number of dumbbells/kettlebells (e.g. 2 × 15 kg = 30 kg)
 * - plates-only:   plates + bar (bar weight must be known; otherwise plates only, flagged)
 * - total / stack: as entered
 * - bodyweight:    0 external load (body weight is not counted as training volume)
 */
export function totalLoadKg(set: ExerciseSet): number | null {
  if (set.loadKg == null) return set.loadBasis === 'bodyweight' ? 0 : null;
  switch (set.loadBasis) {
    case 'per-implement':
      return set.loadKg * Math.max(1, set.implements || 1);
    case 'plates-only':
      return set.loadKg + (set.barKg ?? 0);
    case 'bodyweight':
      return set.loadKg; // added load, e.g. weighted dips
    default:
      return set.loadKg;
  }
}

/**
 * Load used to compare sets of the same exercise for PRs and e1RM.
 * Dumbbell work compares the per-dumbbell weight (what's written on the dumbbell);
 * everything else compares total load.
 */
export function comparableLoadKg(set: ExerciseSet, loadMode: LoadMode): number | null {
  if (set.loadKg == null) return null;
  if ((loadMode === 'dumbbell' || loadMode === 'kettlebell') && set.loadBasis === 'per-implement') return set.loadKg;
  return totalLoadKg(set);
}

/** Total repetitions in a set, normalised so different counting styles compare. */
export function setReps(set: ExerciseSet): number {
  if (set.repsLeft != null || set.repsRight != null) return (set.repsLeft ?? 0) + (set.repsRight ?? 0);
  const reps = set.reps ?? 0;
  // Per-leg and alternating-cycle counts both describe two leg movements per counted rep.
  if (set.repCountMode === 'per-leg' || set.repCountMode === 'cycles') return reps * 2;
  return reps;
}

export function countsAsWork(set: ExerciseSet): boolean {
  return set.status === 'completed' || set.status === 'estimated';
}

export function entryTotalReps(entry: ExerciseEntry): number {
  return entry.sets.filter(countsAsWork).reduce((sum, s) => sum + setReps(s), 0);
}

/** Sum of load × reps across sets. Not a proxy for energy expenditure. */
export function entryVolumeKg(entry: ExerciseEntry): number {
  return entry.sets.filter(countsAsWork).reduce((sum, s) => {
    const load = totalLoadKg(s);
    return load == null ? sum : sum + load * setReps(s);
  }, 0);
}

export function entryHasApproximateLoad(entry: ExerciseEntry): boolean {
  return entry.sets.some((s) => s.loadRangeKg != null || (s.loadBasis === 'plates-only' && s.barKg == null));
}

/** Epley estimate. Only reported for 1–12 reps, where it is reasonably usable. */
export function estimateOneRepMax(loadKg: number, reps: number): number | null {
  if (!(loadKg > 0) || !(reps >= 1) || reps > 12) return null;
  if (reps === 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

export interface BestSet {
  set: ExerciseSet;
  loadKg: number;
  reps: number;
  e1rm: number | null;
}

/** Heaviest comparable load; ties broken by reps. */
export function bestSet(entry: ExerciseEntry): BestSet | null {
  let best: BestSet | null = null;
  for (const s of entry.sets) {
    if (!countsAsWork(s) || s.isWarmup) continue;
    const load = comparableLoadKg(s, entry.loadMode);
    const reps = setReps(s);
    if (load == null || reps <= 0) continue;
    if (!best || load > best.loadKg || (load === best.loadKg && reps > best.reps)) {
      best = { set: s, loadKg: load, reps, e1rm: estimateOneRepMax(load, s.repsLeft != null ? Math.max(s.repsLeft ?? 0, s.repsRight ?? 0) : (s.reps ?? 0)) };
    }
  }
  return best;
}

export function bestE1rm(entry: ExerciseEntry): number | null {
  let best: number | null = null;
  for (const s of entry.sets) {
    if (!countsAsWork(s) || s.isWarmup) continue;
    const load = comparableLoadKg(s, entry.loadMode);
    if (load == null) continue;
    const reps = s.repsLeft != null || s.repsRight != null ? Math.max(s.repsLeft ?? 0, s.repsRight ?? 0) : s.reps ?? 0;
    const e = estimateOneRepMax(load, reps);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

import { describe, expect, it } from 'vitest';
import { filterSessions, personalRecords, stepsForDay, weeklyBuckets, NO_FILTER } from '../aggregate';
import { emptyCardio, emptySet, findDuplicate, newEntry, newSession, recalcSession, validateSession } from '../session';
import { createSeedState, seedExercises } from '../../data/seed';
import type { DailyActivitySummary, WorkoutSession } from '../types';

const def = (id: string) => seedExercises.find((e) => e.id === id)!;
const daily = (date: string, steps: number | null, extra: Partial<DailyActivitySummary> = {}): DailyActivitySummary => ({
  date,
  steps,
  stepsSource: 'manual',
  wearableActiveCalories: null,
  wearableTotalCalories: null,
  sleepHours: null,
  recoveryNotes: '',
  ...extra,
});

function walk(date: string, steps: number, included: boolean): WorkoutSession {
  const s = { ...newSession(date, '07:00'), status: 'completed' as const };
  s.entries = [{ ...newEntry(def('walking')), cardio: { ...emptyCardio(), steps, activeSeconds: 1800, stepsIncludedInDailyTotal: included } }];
  return s;
}

describe('steps reconciliation', () => {
  it('does not double count workout steps already in the daily total', () => {
    const r = stepsForDay('2026-10-10', [daily('2026-10-10', 10000)], [walk('2026-10-10', 4000, true)]);
    expect(r.total).toBe(10000);
    expect(r.workoutSteps).toBe(4000);
  });

  it('adds workout steps the daily total did not capture', () => {
    const r = stepsForDay('2026-10-10', [daily('2026-10-10', 10000)], [walk('2026-10-10', 4000, false)]);
    expect(r.total).toBe(14000);
  });

  it('uses workout steps when no daily total exists', () => {
    expect(stepsForDay('2026-10-10', [], [walk('2026-10-10', 4000, true)]).total).toBe(4000);
    expect(stepsForDay('2026-10-11', [], []).total).toBeNull();
  });

  it('wearable daily calories are never added to workout calories', () => {
    const state = createSeedState();
    state.dailyActivity = [daily('2026-10-10', 9000, { wearableTotalCalories: 2800, wearableActiveCalories: 600 })];
    const sess = recalcSession(walk('2026-10-10', 4000, true), state);
    const filtered = filterSessions([sess], state.exercises, NO_FILTER);
    const weekly = weeklyBuckets(filtered, '2026-10-10', 1);
    expect(weekly[0].gross).toBeCloseTo(sess.entries[0].estimate!.gross, 6);
  });
});

describe('personal records', () => {
  it('compares machine exercises per machine', () => {
    const mk = (machineId: string, load: number) => {
      const s = { ...newSession('2026-10-01', null), status: 'completed' as const };
      s.entries = [{ ...newEntry(def('lat-pulldown')), machineId, sets: [emptySet({ reps: 8, loadKg: load, loadBasis: 'stack' })] }];
      return s;
    };
    const prs = personalRecords([mk('Gym A', 60), mk('Gym B', 80)], seedExercises).filter((p) => p.type === 'max-load');
    expect(prs).toHaveLength(2);
  });

  it('ignores planned sessions', () => {
    const s = { ...newSession('2026-10-01', null), status: 'planned' as const };
    s.entries = [{ ...newEntry(def('squat')), sets: [emptySet({ reps: 5, loadKg: 200 })] }];
    expect(personalRecords([s], seedExercises)).toHaveLength(0);
  });
});

describe('duplicates and validation', () => {
  it('flags a session with the same date, exercises and nearby start time', () => {
    const a = walk('2026-10-10', 4000, true);
    const b = { ...walk('2026-10-10', 4000, true), startTime: '07:20' };
    const c = { ...walk('2026-10-10', 4000, true), startTime: '12:00' };
    expect(findDuplicate(b, [a])?.id).toBe(a.id);
    expect(findDuplicate(c, [a])).toBeNull();
  });

  it('rejects empty sessions and negative values', () => {
    const s = newSession('2026-10-10', null);
    expect(validateSession(s, seedExercises)).toContain('Add at least one exercise.');
    s.entries = [{ ...newEntry(def('squat')), sets: [emptySet({ reps: -1 })] }];
    expect(validateSession(s, seedExercises).some((e) => e.includes('reps'))).toBe(true);
  });
});

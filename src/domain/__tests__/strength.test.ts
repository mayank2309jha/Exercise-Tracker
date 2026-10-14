import { describe, expect, it } from 'vitest';
import { bestSet, comparableLoadKg, entryTotalReps, entryVolumeKg, estimateOneRepMax, setReps, totalLoadKg } from '../strength';
import { emptySet, newEntry } from '../session';
import { seedExercises } from '../../data/seed';

const def = (id: string) => seedExercises.find((e) => e.id === id)!;

describe('load normalisation', () => {
  it('per-dumbbell load × number of dumbbells', () => {
    const s = emptySet({ loadKg: 15, loadBasis: 'per-implement', implements: 2 });
    expect(totalLoadKg(s)).toBe(30);
    expect(comparableLoadKg(s, 'dumbbell')).toBe(15);
  });

  it('plates-only adds the bar when known', () => {
    expect(totalLoadKg(emptySet({ loadKg: 60, loadBasis: 'plates-only', barKg: 20 }))).toBe(80);
    expect(totalLoadKg(emptySet({ loadKg: 60, loadBasis: 'plates-only', barKg: null }))).toBe(60);
  });

  it('bodyweight sets have zero external load', () => {
    expect(totalLoadKg(emptySet({ loadKg: null, loadBasis: 'bodyweight' }))).toBe(0);
  });
});

describe('reps, volume and best set', () => {
  it('sums volume as load × reps across completed sets only', () => {
    const e = {
      ...newEntry(def('squat')),
      sets: [emptySet({ reps: 10, loadKg: 40 }), emptySet({ reps: 8, loadKg: 50 }), emptySet({ reps: 10, loadKg: 60, status: 'planned' })],
    };
    expect(entryVolumeKg(e)).toBe(400 + 400);
    expect(entryTotalReps(e)).toBe(18);
    expect(bestSet(e)?.loadKg).toBe(50);
  });

  it('unilateral sets add left and right reps', () => {
    expect(setReps(emptySet({ repsLeft: 8, repsRight: 7 }))).toBe(15);
  });

  it('mountain climbers: per-leg and cycle counts normalise to total leg movements', () => {
    expect(setReps(emptySet({ reps: 35, repCountMode: 'per-leg' }))).toBe(70);
    expect(setReps(emptySet({ reps: 35, repCountMode: 'cycles' }))).toBe(70);
    expect(setReps(emptySet({ reps: 70, repCountMode: 'total' }))).toBe(70);
  });

  it('Epley e1RM, only for 1–12 reps', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 15)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
});

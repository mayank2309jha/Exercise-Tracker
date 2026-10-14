import { describe, expect, it } from 'vitest';
import {
  acsmRunningVo2,
  acsmWalkingVo2,
  cyclingPowerKcal,
  estimateEntry,
  keytelKcalPerMin,
  metGrossKcal,
  metNetKcal,
  vo2ToKcal,
  type EstimateContext,
} from '../calories';
import { emptyCardio, emptySet, newEntry } from '../session';
import { seedExercises } from '../../data/seed';
import type { ExerciseDefinition, ExerciseEntry } from '../types';

const def = (id: string): ExerciseDefinition => seedExercises.find((e) => e.id === id)!;
const ctx: EstimateContext = { weightKg: 83.2, weightSource: 'measurement', age: 24, sex: 'male', inferredSecondsPerRep: 3 };

function cardioEntry(id: string, cardio: Partial<ExerciseEntry['cardio']>, extra: Partial<ExerciseEntry> = {}): ExerciseEntry {
  return { ...newEntry(def(id)), cardio: { ...emptyCardio(), ...cardio }, ...extra };
}

describe('primitive formulas', () => {
  it('MET gross: MET × 3.5 × kg ÷ 200 × minutes', () => {
    // 8 × 3.5 × 83.2 / 200 × 30 = 349.44
    expect(metGrossKcal(8, 83.2, 30)).toBeCloseTo(349.44, 2);
    expect(metGrossKcal(1, 70, 60)).toBeCloseTo(73.5, 5);
  });

  it('MET net subtracts 1 MET of resting expenditure', () => {
    expect(metNetKcal(8, 83.2, 30)).toBeCloseTo(305.76, 2);
    expect(metGrossKcal(8, 83.2, 30) - metNetKcal(8, 83.2, 30)).toBeCloseTo(metGrossKcal(1, 83.2, 30), 6);
  });

  it('returns 0 for invalid inputs instead of NaN or negatives', () => {
    expect(metGrossKcal(8, 0, 30)).toBe(0);
    expect(metGrossKcal(8, 80, -5)).toBe(0);
    expect(metGrossKcal(NaN, 80, 30)).toBe(0);
    expect(metNetKcal(0.8, 80, 30)).toBe(0);
  });

  it('ACSM running equation', () => {
    // 10 km/h = 166.67 m/min → 3.5 + 0.2·166.67 = 36.83 ml/kg/min
    expect(acsmRunningVo2(166.6667, 0)).toBeCloseTo(36.83, 2);
    expect(vo2ToKcal(36.8333, 83.2, 30)).toBeCloseTo(459.68, 1);
  });

  it('ACSM walking equation includes grade', () => {
    // 5 km/h = 83.33 m/min at 5% grade → 3.5 + 8.333 + 7.5 = 19.33
    expect(acsmWalkingVo2(83.3333, 0.05)).toBeCloseTo(19.33, 2);
    expect(acsmWalkingVo2(83.3333, 0)).toBeCloseTo(11.83, 2);
  });

  it('cycling power: kJ ÷ efficiency ÷ 4.184', () => {
    // 150 W × 60 min = 540 kJ → 540 / 0.24 / 4.184 ≈ 537.8 kcal
    expect(cyclingPowerKcal(150, 60)).toBeCloseTo(537.76, 1);
  });

  it('Keytel heart-rate equation (male)', () => {
    expect(keytelKcalPerMin(140, 83.2, 24, 'male')).toBeCloseTo(13.05, 1);
  });
});

describe('estimateEntry — method selection', () => {
  it('running with distance and time uses the ACSM running equation', () => {
    const e = cardioEntry('running', { distanceKm: 3, activeSeconds: 27 * 60 });
    const est = estimateEntry(e, def('running'), ctx);
    expect(est.method).toBe('acsm-running');
    expect(est.activeMinutes).toBeCloseTo(27);
    expect(est.gross).toBeGreaterThan(est.net);
    expect(est.weightKg).toBe(83.2);
  });

  it('a short fast run and a long slow run differ in rate, not just duration', () => {
    const fast = estimateEntry(cardioEntry('running', { distanceKm: 1, activeSeconds: 6 * 60 }), def('running'), ctx);
    const slow = estimateEntry(cardioEntry('running', { distanceKm: 3, activeSeconds: 27 * 60 }), def('running'), ctx);
    expect(fast.gross / fast.activeMinutes).toBeGreaterThan(slow.gross / slow.activeMinutes);
  });

  it('walking at normal speed uses the ACSM walking equation and treadmill incline raises it', () => {
    const flat = estimateEntry(cardioEntry('walking', { avgSpeedKmh: 5, activeSeconds: 1800, treadmill: true }), def('walking'), ctx);
    const incline = estimateEntry(cardioEntry('walking', { avgSpeedKmh: 5, activeSeconds: 1800, treadmill: true, inclinePct: 8 }), def('walking'), ctx);
    expect(flat.method).toBe('acsm-walking');
    expect(incline.gross).toBeGreaterThan(flat.gross);
  });

  it('walking with only steps and duration falls back to MET and says so', () => {
    const e = cardioEntry('walking', { steps: 7845, activeSeconds: 74 * 60 }, { intensity: 'light' });
    const est = estimateEntry(e, def('walking'), ctx);
    expect(est.method).toBe('met');
    expect(est.met).toBe(3.5);
    expect(est.confidence).toBe('low');
  });

  it('cycling with power uses the power model at high confidence', () => {
    const est = estimateEntry(cardioEntry('cycling', { powerW: 150, activeSeconds: 3600 }), def('cycling'), ctx);
    expect(est.method).toBe('cycling-power');
    expect(est.confidence).toBe('high');
    expect(est.gross).toBeCloseTo(537.76, 0);
  });

  it('stationary cycling without power uses MET and is low confidence', () => {
    const est = estimateEntry(cardioEntry('cycling', { activeSeconds: 1800, setting: 'indoor' }), def('cycling'), ctx);
    expect(est.method).toBe('met');
    expect(est.confidence).toBe('low');
  });

  it('outdoor cycling with speed uses the speed-banded MET', () => {
    const est = estimateEntry(cardioEntry('cycling', { activeSeconds: 3600, distanceKm: 20, setting: 'outdoor' }), def('cycling'), ctx);
    expect(est.method).toBe('met');
    expect(est.met).toBe(8.0); // 20 km/h ≈ 12.4 mph
  });

  it('jump rope at 180/min uses the fast-pace MET', () => {
    const est = estimateEntry(cardioEntry('skipping', { activeSeconds: 120, cadence: 180 }, { intensity: 'light' }), def('skipping'), ctx);
    expect(est.met).toBe(12.3);
  });

  it('HIIT counts only completed work intervals, not rest', () => {
    const e = cardioEntry('hiit', { activeSeconds: null, intervals: { workSeconds: 20, restSeconds: 10, rounds: 8, completedRounds: 6, exerciseType: 'burpees' } }, { intensity: 'vigorous' });
    const est = estimateEntry(e, def('hiit'), ctx);
    expect(est.activeMinutes).toBeCloseTo(2); // 6 × 20 s
    expect(est.gross).toBeCloseTo(metGrossKcal(8, 83.2, 2), 5);
  });

  it('heart rate is used for cardio when speed/power are unavailable', () => {
    const e = cardioEntry('hiit', { activeSeconds: 600 }, { avgHr: 150 });
    expect(estimateEntry(e, def('hiit'), ctx).method).toBe('heart-rate-keytel');
  });

  it('manual calories are used as-is and labelled manual', () => {
    const e = cardioEntry('running', { distanceKm: 3, activeSeconds: 1620 }, { manualCalories: 300 });
    const est = estimateEntry(e, def('running'), ctx);
    expect(est.method).toBe('manual');
    expect(est.gross).toBe(300);
    expect(est.methodLabel).toMatch(/manual/i);
  });
});

describe('estimateEntry — strength and edge cases', () => {
  const squat = def('squat');

  it('uses timed active seconds, not reps or volume', () => {
    const e: ExerciseEntry = {
      ...newEntry(squat),
      sets: [emptySet({ reps: 10, loadKg: 40, activeSeconds: 40, activeSource: 'timer' }), emptySet({ reps: 10, loadKg: 40, activeSeconds: 40, activeSource: 'timer' })],
    };
    const est = estimateEntry(e, squat, ctx);
    expect(est.method).toBe('met');
    expect(est.activeMinutes).toBeCloseTo(80 / 60);
    expect(est.gross).toBeCloseTo(metGrossKcal(5, 83.2, 80 / 60), 6);
  });

  it('heavier load with the same active time does not change calories (volume is not energy)', () => {
    const light: ExerciseEntry = { ...newEntry(squat), sets: [emptySet({ reps: 10, loadKg: 20, activeSeconds: 40, activeSource: 'timer' })] };
    const heavy: ExerciseEntry = { ...newEntry(squat), sets: [emptySet({ reps: 10, loadKg: 100, activeSeconds: 40, activeSource: 'timer' })] };
    expect(estimateEntry(light, squat, ctx).gross).toBeCloseTo(estimateEntry(heavy, squat, ctx).gross, 6);
  });

  it('infers duration from reps when untimed, flags it, and lowers confidence', () => {
    const e: ExerciseEntry = { ...newEntry(squat), sets: [emptySet({ reps: 15, loadKg: 24 })] };
    const est = estimateEntry(e, squat, ctx);
    expect(est.activeMinutes).toBeCloseTo(45 / 60);
    expect(est.confidence).toBe('low');
    expect(est.inputs.inferredActiveMinutes).toBeCloseTo(0.75);
    expect(est.assumptions.join(' ')).toMatch(/inferred/);
    // Inferred estimates get a wide band.
    expect(est.high / est.gross).toBeCloseTo(1.5, 5);
  });

  it('planned sets contribute nothing', () => {
    const e: ExerciseEntry = { ...newEntry(squat), sets: [emptySet({ reps: 10, status: 'planned', activeSeconds: 40, activeSource: 'manual' })] };
    const est = estimateEntry(e, squat, ctx);
    expect(est.gross).toBe(0);
    expect(est.confidence).toBe('insufficient');
  });

  it('isometric holds use hold seconds', () => {
    const hang = def('dead-hang');
    const e: ExerciseEntry = { ...newEntry(hang), sets: [emptySet({ holdSeconds: 60, loadBasis: 'bodyweight' })] };
    const est = estimateEntry(e, hang, ctx);
    expect(est.activeMinutes).toBeCloseTo(1);
  });

  it('missing weight returns an insufficient estimate rather than a guess', () => {
    const e = cardioEntry('running', { distanceKm: 3, activeSeconds: 1620 });
    const est = estimateEntry(e, def('running'), { ...ctx, weightKg: null, weightSource: null });
    expect(est.confidence).toBe('insufficient');
    expect(est.gross).toBe(0);
    expect(est.warnings[0]).toMatch(/body weight/i);
  });

  it('missing duration returns insufficient', () => {
    const e = cardioEntry('running', { distanceKm: 4 });
    const est = estimateEntry(e, def('running'), ctx);
    expect(est.confidence).toBe('insufficient');
  });

  it('records formula version, inputs and assumptions for auditing', () => {
    const est = estimateEntry(cardioEntry('running', { distanceKm: 3, activeSeconds: 1620 }), def('running'), { ...ctx, weightSource: 'assumed-latest' });
    expect(est.formulaVersion).toBeTruthy();
    expect(est.inputs.weightKg).toBe(83.2);
    expect(est.inputs.speedKmh).toBeCloseTo(6.67, 1);
    expect(est.assumptions.some((a) => a.includes('latest recorded weight'))).toBe(true);
    expect(est.low).toBeLessThan(est.gross);
    expect(est.high).toBeGreaterThan(est.gross);
  });
});

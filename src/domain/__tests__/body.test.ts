import { describe, expect, it } from 'vitest';
import { ageOn, navyBodyFat, weightOn, weightTrend } from '../body';
import { seedMeasurements, seedProfile } from '../../data/seed';
import type { BodyMeasurement } from '../types';

describe('weight history', () => {
  it('uses the weigh-in that applied on the workout date', () => {
    expect(weightOn(seedMeasurements, '2026-09-25').weightKg).toBe(84.5);
    expect(weightOn(seedMeasurements, '2026-10-10').weightKg).toBe(83.2);
    expect(weightOn(seedMeasurements, '2026-09-10').weightKg).toBe(87);
  });

  it('flags undated workouts as using the latest weight', () => {
    const w = weightOn(seedMeasurements, null);
    expect(w.weightKg).toBe(83.2);
    expect(w.source).toBe('assumed-latest');
  });

  it('adding a new weigh-in does not change older lookups', () => {
    const added: BodyMeasurement[] = [...seedMeasurements, { ...seedMeasurements[5], id: 'new', date: '2026-10-13', weightKg: 82.5 }];
    expect(weightOn(added, '2026-09-25').weightKg).toBe(84.5);
    expect(weightOn(added, '2026-10-14').weightKg).toBe(82.5);
  });

  it('trend smooths noise and keeps approximate points flagged', () => {
    const t = weightTrend(seedMeasurements);
    expect(t).toHaveLength(seedMeasurements.length);
    expect(t[0].approximate).toBe(true);
    expect(t[t.length - 1].approximate).toBe(false);
    const last = t[t.length - 1];
    expect(last.trendKg).toBeGreaterThan(last.weightKg); // lags behind a drop
  });
});

describe('age', () => {
  it('advances the stated age over time when DOB is unknown', () => {
    expect(ageOn(seedProfile, '2026-10-14')).toBe(24);
    expect(ageOn(seedProfile, '2027-10-15')).toBe(25);
  });

  it('uses date of birth when set', () => {
    expect(ageOn({ ...seedProfile, dateOfBirth: '2000-05-20' }, '2026-05-19')).toBe(25);
    expect(ageOn({ ...seedProfile, dateOfBirth: '2000-05-20' }, '2026-05-20')).toBe(26);
  });
});

describe('Navy body fat', () => {
  it('returns null when any input is missing', () => {
    expect(navyBodyFat('male', 170, null, 38, null)).toBeNull();
  });
  it('computes a plausible value', () => {
    const bf = navyBodyFat('male', 170, 92, 38, null)!;
    expect(bf).toBeGreaterThan(15);
    expect(bf).toBeLessThan(30);
  });
});

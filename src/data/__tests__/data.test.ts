import { describe, expect, it } from 'vitest';
import { createSeedState } from '../seed';
import { exportJson, importJson, importMeasurementsCsv, mergeStates, parseCsv, sessionsCsv, toCsv } from '../io';
import { parseState } from '../schema';
import { summarizeSession } from '../../domain/time';

const REQUIRED_EXERCISES = [
  'Running', 'Jogging', 'Walking', 'Cycling', 'Skipping rope', 'HIIT',
  'Push-ups', 'Pull-ups', 'Dips', 'Dead hang', 'Mountain climbers', 'Bodyweight squats', 'Resistance-band exercises',
  'Deadlift', 'Squat', 'Bench press', 'Overhead press', 'Lat pulldown', 'Machine lat pull (horizontal)', 'Triceps crushers',
  'Preacher curls', 'Dumbbell curls', 'Hammer curls', 'Bulgarian split squat', "Farmer's carry", 'Machine chest fly',
  'Calf raises', 'Chin-ups', 'Hex press', 'Dumbbell overhead press', 'Dumbbell bench press', 'Horizontal machine row',
];

describe('seed data (acceptance)', () => {
  const state = createSeedState();

  it('preloads the profile', () => {
    expect(state.profile.statedAge).toBe(24);
    expect(state.profile.sex).toBe('male');
    expect(state.profile.heightCm).toBe(170);
    expect(state.profile.limitations[0].label).toMatch(/shin/i);
    // Unknown fields stay empty.
    expect(state.profile.restingHr).toBeNull();
    expect(state.profile.dateOfBirth).toBeNull();
  });

  it('preloads the weight history with ranges preserved', () => {
    const latest = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date))[0];
    expect(latest.date).toBe('2026-10-06');
    expect(latest.weightKg).toBe(83.2);
    expect(state.measurements.find((m) => m.date === '2026-09-23')?.weightKg).toBe(84.5);
    expect(state.measurements.find((m) => m.date === '2026-09-01')?.weightKg).toBe(87);
    expect(state.measurements.filter((m) => m.weightRangeKg).length).toBe(3);
    expect(state.measurements.every((m) => m.waistCm == null)).toBe(true);
  });

  it('includes every exercise in the library', () => {
    const names = state.exercises.map((e) => e.name);
    REQUIRED_EXERCISES.forEach((n) => expect(names).toContain(n));
  });

  it('keeps historical loads distinct from confirmed working sets', () => {
    expect(state.historicalRecords.every((r) => r.confirmed === false)).toBe(true);
    const types = new Set(state.historicalRecords.map((r) => r.type));
    ['estimated-max', 'historical-set', 'planned-load', 'mention'].forEach((t) => expect(types.has(t as never)).toBe(true));
    // No seeded workout is "completed".
    expect(state.sessions.every((s) => s.status === 'imported-incomplete')).toBe(true);
  });

  it('imports the 1-hour gym session without treating the hour as active', () => {
    const gym = state.sessions.find((s) => s.id === 'hist-gym-1h')!;
    expect(gym.entries).toHaveLength(7);
    const t = summarizeSession(gym, 0);
    expect(t.totalSeconds).toBe(3600);
    expect(t.activeSeconds).toBe(0); // nothing confirmed; calories use inferred time, flagged
    expect(gym.entries.every((e) => e.estimate?.confidence === 'low')).toBe(true);
    expect(gym.clarifications.length).toBeGreaterThan(3);
    const deadlift = gym.entries.find((e) => e.exerciseId === 'deadlift')!;
    expect(deadlift.sets[0].loadRangeKg).toEqual([80, 100]);
  });

  it('the 4 km run without durations has no calorie estimate', () => {
    const run = state.sessions.find((s) => s.id === 'hist-run-4k-2sets')!;
    expect(run.entries[0].estimate?.confidence).toBe('insufficient');
  });
});

describe('import / export', () => {
  it('JSON round-trips', () => {
    const state = createSeedState();
    const r = importJson(exportJson(state));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.sessions).toHaveLength(state.sessions.length);
      expect(r.state.profile.heightCm).toBe(170);
    }
  });

  it('rejects malformed JSON and invalid shapes with readable errors', () => {
    expect(importJson('{nope').ok).toBe(false);
    const bad = importJson(JSON.stringify({ schemaVersion: 1, profile: { heightCm: 'tall' } }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/heightCm/);
  });

  it('fills defaults for missing optional fields', () => {
    const r = parseState({ schemaVersion: 1, profile: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.settings.calorieDisplay).toBe('gross');
  });

  it('merge replaces by id and keeps the rest', () => {
    const a = createSeedState();
    const b = createSeedState();
    b.measurements = [{ ...b.measurements[0], id: 'x', date: '2026-10-13', weightKg: 82 }];
    const merged = mergeStates(a, b);
    expect(merged.measurements).toHaveLength(a.measurements.length + 1);
  });

  it('CSV escapes and parses quotes, commas and newlines', () => {
    const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 'line1\nline2' }]);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual({ a: 'x,y', b: 'say "hi"', c: 'line1\nline2' });
  });

  it('measurement CSV import validates rows', () => {
    const r = importMeasurementsCsv('date,weight_kg,waist_cm\n2026-10-13,82.9,90\nbad-date,80,\n2026-10-14,999,\n');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].weightKg).toBe(82.9);
    expect(r.errors).toHaveLength(2);
  });

  it('sessions CSV has one row per exercise entry', () => {
    const state = createSeedState();
    const rows = parseCsv(sessionsCsv(state));
    expect(rows).toHaveLength(state.sessions.reduce((n, s) => n + s.entries.length, 0));
    expect(rows[0]).toHaveProperty('kcal_method');
  });
});

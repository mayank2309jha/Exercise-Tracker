import { daysBetween, parseISODate } from '../lib/dates';
import type { BodyMeasurement, ISODate, Sex, UserProfile } from './types';

/** Age on a given date. Uses DOB when known; otherwise advances the stated age from the date it was stated. */
export function ageOn(profile: UserProfile, date: ISODate): number | null {
  if (profile.dateOfBirth) {
    const dob = parseISODate(profile.dateOfBirth);
    const d = parseISODate(date);
    let age = d.getFullYear() - dob.getFullYear();
    if (d.getMonth() < dob.getMonth() || (d.getMonth() === dob.getMonth() && d.getDate() < dob.getDate())) age -= 1;
    return age;
  }
  if (profile.statedAge != null && profile.ageAsOf) {
    const years = Math.floor(daysBetween(profile.ageAsOf, date) / 365.25);
    return profile.statedAge + Math.max(0, years);
  }
  return profile.statedAge;
}

/** The date a measurement is plotted at: the middle of a range, otherwise its date. */
export function measurementPlotDate(m: BodyMeasurement): ISODate {
  if (m.datePrecision === 'range' && m.dateEnd) {
    const d = parseISODate(m.date);
    d.setDate(d.getDate() + Math.round(daysBetween(m.date, m.dateEnd) / 2));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return m.date;
}

export function sortedWeights(measurements: BodyMeasurement[]): BodyMeasurement[] {
  return measurements.filter((m) => m.weightKg != null).sort((a, b) => measurementPlotDate(a).localeCompare(measurementPlotDate(b)));
}

export interface WeightAt {
  weightKg: number | null;
  source: 'measurement' | 'assumed-latest' | null;
  measurement: BodyMeasurement | null;
}

/**
 * Body weight that applied on `date`: the most recent weigh-in on or before it.
 * Falls back to the earliest later weigh-in, then the latest overall (flagged as assumed).
 */
export function weightOn(measurements: BodyMeasurement[], date: ISODate | null): WeightAt {
  const ws = sortedWeights(measurements);
  if (ws.length === 0) return { weightKg: null, source: null, measurement: null };
  if (!date) {
    const last = ws[ws.length - 1];
    return { weightKg: last.weightKg, source: 'assumed-latest', measurement: last };
  }
  const before = ws.filter((m) => measurementPlotDate(m) <= date);
  if (before.length > 0) {
    const m = before[before.length - 1];
    // Older than 60 days is still used, but flagged.
    const stale = daysBetween(measurementPlotDate(m), date) > 60;
    return { weightKg: m.weightKg, source: stale ? 'assumed-latest' : 'measurement', measurement: m };
  }
  const after = ws[0];
  return { weightKg: after.weightKg, source: 'assumed-latest', measurement: after };
}

export interface TrendPoint {
  date: ISODate;
  weightKg: number;
  trendKg: number;
  approximate: boolean;
}

/**
 * Time-aware exponential moving average (≈10-day half-life-ish smoothing).
 * Smooths out water/food fluctuations so day-to-day noise isn't read as fat change.
 */
export function weightTrend(measurements: BodyMeasurement[], tauDays = 10): TrendPoint[] {
  const ws = sortedWeights(measurements);
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  let prev: ISODate | null = null;
  for (const m of ws) {
    const d = measurementPlotDate(m);
    const w = m.weightKg!;
    if (trend == null || prev == null) trend = w;
    else {
      const dt = Math.max(0, daysBetween(prev, d));
      const alpha = 1 - Math.exp(-dt / tauDays);
      trend = trend + alpha * (w - trend);
    }
    prev = d;
    out.push({ date: d, weightKg: w, trendKg: trend, approximate: m.datePrecision !== 'day' || m.weightRangeKg != null });
  }
  return out;
}

/** US Navy circumference method. Inputs in cm. Returns null when inputs are missing or invalid. */
export function navyBodyFat(sex: Sex | null, heightCm: number | null, waistCm: number | null, neckCm: number | null, hipCm: number | null): number | null {
  if (!sex || !heightCm || !waistCm || !neckCm) return null;
  const toIn = (cm: number) => cm / 2.54;
  if (sex === 'male') {
    const diff = toIn(waistCm) - toIn(neckCm);
    if (diff <= 0) return null;
    return 86.01 * Math.log10(diff) - 70.041 * Math.log10(toIn(heightCm)) + 36.76;
  }
  if (!hipCm) return null;
  const diff = toIn(waistCm) + toIn(hipCm) - toIn(neckCm);
  if (diff <= 0) return null;
  return 163.205 * Math.log10(diff) - 97.684 * Math.log10(toIn(heightCm)) - 78.387;
}

export function latestValue<K extends keyof BodyMeasurement>(measurements: BodyMeasurement[], key: K): { value: BodyMeasurement[K]; date: ISODate } | null {
  const sorted = [...measurements].filter((m) => m[key] != null).sort((a, b) => measurementPlotDate(b).localeCompare(measurementPlotDate(a)));
  return sorted[0] ? { value: sorted[0][key], date: measurementPlotDate(sorted[0]) } : null;
}

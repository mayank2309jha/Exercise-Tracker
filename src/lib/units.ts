import type { UnitSystem } from '../domain/types';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;
export const CM_PER_IN = 2.54;

export interface Units {
  system: UnitSystem;
  weightUnit: 'kg' | 'lb';
  distanceUnit: 'km' | 'mi';
  lengthUnit: 'cm' | 'in';
  speedUnit: 'km/h' | 'mph';
  paceUnit: 'min/km' | 'min/mi';
  /** kg → display number */
  weight(kg: number): number;
  /** display number → kg */
  weightToKg(v: number): number;
  distance(km: number): number;
  distanceToKm(v: number): number;
  length(cm: number): number;
  lengthToCm(v: number): number;
  speed(kmh: number): number;
  speedToKmh(v: number): number;
}

export function makeUnits(system: UnitSystem): Units {
  const imp = system === 'imperial';
  return {
    system,
    weightUnit: imp ? 'lb' : 'kg',
    distanceUnit: imp ? 'mi' : 'km',
    lengthUnit: imp ? 'in' : 'cm',
    speedUnit: imp ? 'mph' : 'km/h',
    paceUnit: imp ? 'min/mi' : 'min/km',
    weight: (kg) => (imp ? kg / KG_PER_LB : kg),
    weightToKg: (v) => (imp ? v * KG_PER_LB : v),
    distance: (km) => (imp ? km / KM_PER_MI : km),
    distanceToKm: (v) => (imp ? v * KM_PER_MI : v),
    length: (cm) => (imp ? cm / CM_PER_IN : cm),
    lengthToCm: (v) => (imp ? v * CM_PER_IN : v),
    speed: (kmh) => (imp ? kmh / KM_PER_MI : kmh),
    speedToKmh: (v) => (imp ? v * KM_PER_MI : v),
  };
}

export function fmtNum(n: number | null | undefined, dp = 0): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

/** Pace in seconds per display-distance-unit → "5:24". */
export function fmtPace(secondsPerUnit: number | null): string {
  if (secondsPerUnit == null || !isFinite(secondsPerUnit) || secondsPerUnit <= 0) return '—';
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

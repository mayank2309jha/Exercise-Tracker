import type { Intensity } from './types';

/**
 * MET database.
 *
 * Values are transcribed from the Compendium of Physical Activities
 * (Ainsworth et al., 2011; codes shown). Where no exact activity exists, the
 * closest entry is used and `proxy` explains the substitution.
 *
 * Maintenance: to update a value, change it here and bump
 * CALORIE_FORMULA_VERSION in calories.ts so stored estimates are flagged as
 * outdated and can be recalculated. Values should be checked against the
 * 2024 Adult Compendium (https://pacompendium.com) before relying on them.
 */
export interface MetEntry {
  code: string;
  description: string;
  met: number;
  proxy?: string;
}

export type MetTable = Record<Intensity, MetEntry>;

export const MET_DB: Record<string, MetTable> = {
  running: {
    light: { code: '12020', description: 'Jogging, general', met: 7.0 },
    moderate: { code: '12150', description: 'Running, general', met: 8.0 },
    vigorous: { code: '12070', description: 'Running, 6 mph (10 min/mile)', met: 9.8 },
  },
  jogging: {
    light: { code: '12030', description: 'Running, 4 mph (15 min/mile)', met: 6.0 },
    moderate: { code: '12020', description: 'Jogging, general', met: 7.0 },
    vigorous: { code: '12050', description: 'Running, 5 mph (12 min/mile)', met: 8.3 },
  },
  walking: {
    light: { code: '17170', description: 'Walking, 2.8–3.2 mph, level, moderate pace', met: 3.5 },
    moderate: { code: '17200', description: 'Walking, 3.5 mph, level, brisk', met: 4.3 },
    vigorous: { code: '17220', description: 'Walking, 4.0 mph, level, very brisk', met: 5.0 },
  },
  cycling: {
    light: { code: '01010', description: 'Bicycling, <10 mph, leisure', met: 4.0 },
    moderate: { code: '01020', description: 'Bicycling, 10–11.9 mph, light effort', met: 6.8 },
    vigorous: { code: '01030', description: 'Bicycling, 12–13.9 mph, moderate effort', met: 8.0 },
  },
  'stationary-cycling': {
    light: { code: '02011', description: 'Stationary bicycling, 30–50 W, very light', met: 3.5 },
    moderate: { code: '02012', description: 'Stationary bicycling, 90–100 W, moderate to vigorous', met: 6.8 },
    vigorous: { code: '02013', description: 'Stationary bicycling, 101–160 W, vigorous', met: 8.8 },
  },
  'jump-rope': {
    light: { code: '15553', description: 'Rope jumping, slow pace, <100 skips/min', met: 8.8 },
    moderate: { code: '15552', description: 'Rope jumping, moderate pace, 100–120 skips/min', met: 11.8 },
    vigorous: { code: '15551', description: 'Rope jumping, fast pace, 120–160 skips/min', met: 12.3 },
  },
  hiit: {
    light: { code: '02030', description: 'Calisthenics, light effort', met: 2.8, proxy: 'Light interval work' },
    moderate: { code: '02035', description: 'Circuit training, moderate effort', met: 4.3 },
    vigorous: { code: '02040', description: 'Circuit training, aerobic movement, minimal rest, vigorous', met: 8.0 },
  },
  'resistance-training': {
    light: { code: '02054', description: 'Resistance training, multiple exercises, 8–15 reps, varied resistance', met: 3.5 },
    moderate: { code: '02052', description: 'Resistance training, squats, slow or explosive effort', met: 5.0 },
    vigorous: { code: '02050', description: 'Resistance training, power lifting or body building, vigorous', met: 6.0 },
  },
  calisthenics: {
    light: { code: '02024', description: 'Calisthenics, light effort (e.g. back exercises)', met: 2.8 },
    moderate: { code: '02022', description: 'Calisthenics, moderate effort (e.g. push-ups, sit-ups)', met: 3.8 },
    vigorous: { code: '02020', description: 'Calisthenics, vigorous effort (push-ups, pull-ups, jumping jacks)', met: 8.0 },
  },
  isometric: {
    light: { code: '02024', description: 'Calisthenics, light effort', met: 2.8, proxy: 'No isometric-hang entry' },
    moderate: { code: '02022', description: 'Calisthenics, moderate effort', met: 3.8, proxy: 'No isometric-hang entry' },
    vigorous: { code: '02022', description: 'Calisthenics, moderate effort', met: 3.8, proxy: 'No isometric-hang entry; capped at moderate' },
  },
  carry: {
    light: { code: '02054', description: 'Resistance training, light', met: 3.5, proxy: 'No loaded-carry entry' },
    moderate: { code: '02052', description: 'Resistance training, moderate', met: 5.0, proxy: 'No loaded-carry entry' },
    vigorous: { code: '02050', description: 'Resistance training, vigorous', met: 6.0, proxy: 'No loaded-carry entry' },
  },
  'resistance-band': {
    light: { code: '02024', description: 'Calisthenics, light effort', met: 2.8, proxy: 'Band work approximated as calisthenics' },
    moderate: { code: '02054', description: 'Resistance training, light to moderate', met: 3.5, proxy: 'Band work approximated as light resistance training' },
    vigorous: { code: '02052', description: 'Resistance training, moderate', met: 5.0, proxy: 'Band work approximated as resistance training' },
  },
};

export function lookupMet(metKey: string, intensity: Intensity): MetEntry | null {
  return MET_DB[metKey]?.[intensity] ?? null;
}

/** Jump-rope intensity from cadence (skips per minute), per the Compendium bands. */
export function jumpRopeIntensityFromCadence(cadence: number): Intensity {
  if (cadence < 100) return 'light';
  if (cadence <= 120) return 'moderate';
  return 'vigorous';
}

/** Outdoor cycling MET by average speed (km/h), Compendium 01010–01050. */
export function cyclingMetFromSpeed(kmh: number): MetEntry {
  const mph = kmh / 1.609344;
  if (mph < 10) return { code: '01010', description: 'Bicycling, <10 mph, leisure', met: 4.0 };
  if (mph < 12) return { code: '01020', description: 'Bicycling, 10–11.9 mph', met: 6.8 };
  if (mph < 14) return { code: '01030', description: 'Bicycling, 12–13.9 mph', met: 8.0 };
  if (mph < 16) return { code: '01040', description: 'Bicycling, 14–15.9 mph', met: 10.0 };
  if (mph < 20) return { code: '01050', description: 'Bicycling, 16–19 mph', met: 12.0 };
  return { code: '01060', description: 'Bicycling, >20 mph, racing', met: 15.8 };
}

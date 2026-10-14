import { z } from 'zod';
import type { AppState } from '../domain/types';

// Validation for anything that enters the app from storage or an import file.
// Missing optional fields get safe defaults; wrong types are rejected.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const num = z.number().finite();
const nnum = num.nullable().default(null);
const intensity = z.enum(['light', 'moderate', 'vigorous']);
const source = z.enum(['manual', 'timer', 'seed', 'import-historical', 'import-file', 'wearable']);
const datePrecision = z.enum(['day', 'month', 'range', 'unknown']);
const kind = z.enum(['run', 'walk', 'cycle', 'jumprope', 'hiit', 'strength', 'bodyweight', 'isometric', 'carry', 'band']);
const loadMode = z.enum(['barbell', 'dumbbell', 'machine', 'bodyweight', 'band', 'kettlebell', 'cable', 'none']);
const loadBasis = z.enum(['total', 'per-implement', 'plates-only', 'stack', 'bodyweight', 'unknown']);
const repCount = z.enum(['total', 'per-leg', 'cycles']);
const activeSource = z.enum(['timer', 'manual', 'inferred']).nullable().default(null);
const range = z.tuple([num, num]).nullable().optional();

export const limitationSchema = z.object({
  id: z.string(),
  label: z.string(),
  appliesToKinds: z.array(kind).default([]),
  active: z.boolean().default(true),
  notes: z.string().optional(),
});

export const profileSchema = z.object({
  name: z.string().default(''),
  dateOfBirth: isoDate.nullable().default(null),
  statedAge: num.min(0).max(130).nullable().default(null),
  ageAsOf: isoDate.nullable().default(null),
  sex: z.enum(['male', 'female']).nullable().default(null),
  heightCm: num.min(50).max(260).nullable().default(null),
  restingHr: num.min(20).max(150).nullable().default(null),
  maxHr: num.min(80).max(240).nullable().default(null),
  maxHrSource: z.enum(['measured', 'estimated']).nullable().default(null),
  activityLevel: z.enum(['sedentary', 'lightly-active', 'moderately-active', 'very-active']).nullable().default(null),
  wearable: z.string().default(''),
  unitSystem: z.enum(['metric', 'imperial']).default('metric'),
  dailyStepTarget: num.min(0).nullable().default(null),
  dailyExerciseCalorieTarget: num.min(0).nullable().default(null),
  limitations: z.array(limitationSchema).default([]),
});

export const measurementSchema = z.object({
  id: z.string(),
  date: isoDate,
  datePrecision: datePrecision.default('day'),
  dateEnd: isoDate.nullable().optional(),
  weightKg: num.min(20).max(400).nullable().default(null),
  weightRangeKg: range,
  waistCm: num.min(20).max(300).nullable().default(null),
  neckCm: num.min(10).max(100).nullable().default(null),
  hipCm: num.min(20).max(300).nullable().default(null),
  bodyFatPct: num.min(1).max(80).nullable().default(null),
  bodyFatMethod: z.string().nullable().optional(),
  restingHr: num.min(20).max(150).nullable().default(null),
  heightCm: num.min(50).max(260).nullable().default(null),
  source: source.default('manual'),
  notes: z.string().optional(),
});

export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.enum(['cardio', 'bodyweight', 'strength', 'conditioning']),
  kind,
  defaultLoadMode: loadMode,
  variations: z.array(z.string()).default([]),
  equipment: z.array(z.string()).default([]),
  unilateral: z.boolean().optional(),
  repCountOptions: z.array(repCount).optional(),
  metKey: z.string(),
  description: z.string().optional(),
  isCustom: z.boolean().optional(),
  common: z.boolean().optional(),
});

export const historicalSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  type: z.enum(['estimated-max', 'historical-set', 'planned-load', 'session-report', 'mention', 'aggregate', 'calorie-estimate-discussed']),
  description: z.string(),
  date: isoDate.nullable().default(null),
  datePrecision: datePrecision.default('unknown'),
  loadKg: nnum.optional(),
  loadRangeKg: range,
  loadBasis: loadBasis.optional(),
  implements: nnum.optional(),
  reps: nnum.optional(),
  durationSeconds: nnum.optional(),
  distanceKm: nnum.optional(),
  steps: nnum.optional(),
  confirmed: z.boolean().default(false),
  source: source.default('import-historical'),
  notes: z.string().optional(),
});

const intervalSchema = z.object({
  id: z.string(),
  kind: z.enum(['active', 'rest', 'waiting', 'paused']),
  start: num,
  end: num.nullable(),
  entryId: z.string().nullable().optional(),
  setId: z.string().nullable().optional(),
  source: z.enum(['timer', 'manual']).default('timer'),
});

const setSchema = z.object({
  id: z.string(),
  status: z.enum(['completed', 'planned', 'estimated']).default('completed'),
  reps: num.min(0).nullable().default(null),
  repsLeft: num.min(0).nullable().optional(),
  repsRight: num.min(0).nullable().optional(),
  repCountMode: repCount.optional(),
  loadKg: num.min(0).nullable().default(null),
  loadRangeKg: range,
  loadBasis: loadBasis.default('total'),
  implements: num.min(1).max(10).default(1),
  barKg: num.min(0).nullable().optional(),
  holdSeconds: num.min(0).nullable().optional(),
  activeSeconds: num.min(0).nullable().default(null),
  activeSource,
  restAfterSeconds: num.min(0).nullable().optional(),
  tempo: z.string().optional(),
  rir: num.nullable().optional(),
  rpe: num.nullable().optional(),
  isWarmup: z.boolean().optional(),
  notes: z.string().optional(),
});

const cardioSchema = z.object({
  distanceKm: num.min(0).nullable().default(null),
  activeSeconds: num.min(0).nullable().default(null),
  activeSource,
  avgSpeedKmh: num.min(0).nullable().default(null),
  maxSpeedKmh: num.min(0).nullable().default(null),
  inclinePct: nnum,
  elevationGainM: num.min(0).nullable().default(null),
  steps: num.min(0).nullable().default(null),
  stepsIncludedInDailyTotal: z.boolean().default(true),
  jumps: num.min(0).nullable().default(null),
  cadence: num.min(0).nullable().default(null),
  resistance: z.string().default(''),
  powerW: num.min(0).nullable().default(null),
  setting: z.enum(['indoor', 'outdoor']).nullable().default(null),
  treadmill: z.boolean().default(false),
  terrain: z.string().default(''),
  cyclingType: z.string().default(''),
  carriedLoadKg: num.min(0).nullable().default(null),
  ropeType: z.string().default(''),
  intervals: z
    .object({ workSeconds: num.min(0), restSeconds: num.min(0), rounds: num.min(0), completedRounds: num.min(0), exerciseType: z.string().default('') })
    .nullable()
    .default(null),
});

const estimateSchema = z.object({
  formulaVersion: z.string(),
  method: z.enum(['met', 'acsm-walking', 'acsm-running', 'cycling-power', 'heart-rate-keytel', 'manual', 'none']),
  methodLabel: z.string(),
  gross: num,
  net: num,
  low: num,
  high: num,
  confidence: z.enum(['high', 'medium', 'low', 'insufficient']),
  met: nnum,
  activeMinutes: num,
  weightKg: nnum,
  inputs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  measured: z.array(z.string()),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  computedAt: z.string(),
});

const entrySchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  variation: z.string().default(''),
  equipment: z.string().default(''),
  machineId: z.string().default(''),
  loadMode: loadMode.default('none'),
  intensity: intensity.default('moderate'),
  sets: z.array(setSchema).default([]),
  cardio: cardioSchema.nullable().default(null),
  avgHr: nnum,
  maxHr: nnum,
  rpe: nnum,
  manualCalories: num.min(0).nullable().default(null),
  estimate: estimateSchema.nullable().default(null),
  notes: z.string().default(''),
});

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string().default('Workout'),
  date: isoDate.nullable(),
  datePrecision: datePrecision.default('day'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  category: z.enum(['cardio', 'bodyweight', 'strength', 'conditioning', 'mixed']).default('mixed'),
  status: z.enum(['completed', 'planned', 'estimated', 'imported-incomplete', 'in-progress']).default('completed'),
  bodyWeightKg: num.min(20).max(400).nullable().default(null),
  bodyWeightSource: z.enum(['measurement', 'manual', 'assumed-latest']).nullable().default(null),
  totalSessionSeconds: num.min(0).nullable().default(null),
  manualRestSeconds: num.min(0).nullable().default(null),
  manualWaitingSeconds: num.min(0).nullable().default(null),
  manualPausedSeconds: num.min(0).nullable().default(null),
  intervals: z.array(intervalSchema).default([]),
  entries: z.array(entrySchema).default([]),
  rpe: nnum,
  notes: z.string().default(''),
  source: source.default('manual'),
  externalId: z.string().nullable().optional(),
  clarifications: z.array(z.object({ id: z.string(), question: z.string(), resolved: z.boolean().default(false), answer: z.string().optional() })).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().optional(),
  entries: z.array(
    z.object({
      exerciseId: z.string(),
      variation: z.string().default(''),
      equipment: z.string().default(''),
      intensity: intensity.default('moderate'),
      sets: z.array(z.object({ reps: nnum, loadKg: nnum, loadBasis: loadBasis.default('total'), implements: num.default(1) })).default([]),
    }),
  ),
});

const dailySchema = z.object({
  date: isoDate,
  steps: num.min(0).nullable().default(null),
  stepsSource: z.enum(['manual', 'wearable']).nullable().default(null),
  wearableActiveCalories: num.min(0).nullable().default(null),
  wearableTotalCalories: num.min(0).nullable().default(null),
  sleepHours: num.min(0).max(24).nullable().default(null),
  recoveryNotes: z.string().default(''),
});

const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['weight-loss', 'weight-target', 'steps', 'exercise-calories', 'strength', 'custom']),
  targetValue: nnum,
  startValue: nnum,
  unit: z.string().default(''),
  startDate: isoDate.nullable().default(null),
  targetDate: isoDate.nullable().default(null),
  exerciseId: z.string().nullable().optional(),
  status: z.enum(['active', 'achieved', 'abandoned', 'historical']).default('active'),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

export const stateSchema = z.object({
  schemaVersion: z.number().int(),
  profile: profileSchema,
  measurements: z.array(measurementSchema).default([]),
  exercises: z.array(exerciseSchema).default([]),
  historicalRecords: z.array(historicalSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  templates: z.array(templateSchema).default([]),
  dailyActivity: z.array(dailySchema).default([]),
  goals: z.array(goalSchema).default([]),
  settings: z
    .object({
      calorieDisplay: z.enum(['gross', 'net']).default('gross'),
      quickAddExerciseIds: z.array(z.string()).default([]),
      defaultRestSeconds: num.min(0).max(3600).default(90),
      inferredSecondsPerRep: num.min(0.5).max(20).default(3),
    })
    .default({}),
  draft: sessionSchema.nullable().default(null),
});

export type ParseResult = { ok: true; state: AppState } | { ok: false; errors: string[] };

export function parseState(data: unknown): ParseResult {
  const r = stateSchema.safeParse(data);
  if (r.success) return { ok: true, state: r.data as AppState };
  return { ok: false, errors: r.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}

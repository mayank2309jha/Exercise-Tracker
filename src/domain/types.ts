// Core data model. All quantities are stored in metric units internally
// (kg, cm, km, seconds). Display conversion happens in src/lib/units.ts.

export type ID = string;

/** ISO date `YYYY-MM-DD`. */
export type ISODate = string;

export type Sex = 'male' | 'female';
export type UnitSystem = 'metric' | 'imperial';
export type CalorieDisplay = 'gross' | 'net';
export type Intensity = 'light' | 'moderate' | 'vigorous';

/** Where a record came from. */
export type RecordSource = 'manual' | 'timer' | 'seed' | 'import-historical' | 'import-file' | 'wearable';

/** How trustworthy / final a record is. Planned and estimated records are never treated as completed work. */
export type RecordStatus = 'completed' | 'planned' | 'estimated' | 'imported-incomplete' | 'in-progress';

/** How precise a date is. `range` uses `dateEnd` too. */
export type DatePrecision = 'day' | 'month' | 'range' | 'unknown';

// ---------------------------------------------------------------------------
// Profile & body
// ---------------------------------------------------------------------------

export interface Limitation {
  id: ID;
  label: string;
  /** Exercise kinds this limitation applies to; a warning is shown when logging them. */
  appliesToKinds: ExerciseKind[];
  active: boolean;
  notes?: string;
}

export interface Goal {
  id: ID;
  title: string;
  type: 'weight-loss' | 'weight-target' | 'steps' | 'exercise-calories' | 'strength' | 'custom';
  /** Target value in the goal's metric unit (kg, steps, kcal…). Null when not set. */
  targetValue: number | null;
  startValue: number | null;
  unit: string;
  startDate: ISODate | null;
  targetDate: ISODate | null;
  exerciseId?: ID | null;
  status: 'active' | 'achieved' | 'abandoned' | 'historical';
  isPrimary?: boolean;
  notes?: string;
}

export interface UserProfile {
  name: string;
  dateOfBirth: ISODate | null;
  /** Used when DOB is unknown: age as stated on `ageAsOf`. Age advances from there. */
  statedAge: number | null;
  ageAsOf: ISODate | null;
  sex: Sex | null;
  heightCm: number | null;
  restingHr: number | null;
  maxHr: number | null;
  maxHrSource: 'measured' | 'estimated' | null;
  activityLevel: 'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active' | null;
  wearable: string;
  unitSystem: UnitSystem;
  dailyStepTarget: number | null;
  dailyExerciseCalorieTarget: number | null;
  limitations: Limitation[];
}

export interface BodyMeasurement {
  id: ID;
  date: ISODate;
  datePrecision: DatePrecision;
  dateEnd?: ISODate | null;
  weightKg: number | null;
  /** When the source gave a range ("85–85.5 kg"), keep it. `weightKg` is the midpoint. */
  weightRangeKg?: [number, number] | null;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
  bodyFatMethod?: string | null;
  restingHr: number | null;
  heightCm: number | null;
  source: RecordSource;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export type ExerciseCategory = 'cardio' | 'bodyweight' | 'strength' | 'conditioning';

/** Drives which logging form and which calorie model is used. */
export type ExerciseKind =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'jumprope'
  | 'hiit'
  | 'strength'
  | 'bodyweight'
  | 'isometric'
  | 'carry'
  | 'band';

export type LoadMode = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'band' | 'kettlebell' | 'cable' | 'none';

export interface ExerciseDefinition {
  id: ID;
  name: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  defaultLoadMode: LoadMode;
  variations: string[];
  equipment: string[];
  /** Per-leg / per-arm movement: log left and right reps separately. */
  unilateral?: boolean;
  /** Mountain climbers etc.: how reps can be counted. */
  repCountOptions?: RepCountMode[];
  /** Key into the MET database. */
  metKey: string;
  description?: string;
  isCustom?: boolean;
  /** Ids of quick-add favourites are kept in settings; this is just a hint. */
  common?: boolean;
}

export type RepCountMode = 'total' | 'per-leg' | 'cycles';

/** Things known from the past that are NOT confirmed workout sessions. */
export type HistoricalRecordType =
  | 'estimated-max'
  | 'historical-set'
  | 'planned-load'
  | 'session-report'
  | 'mention'
  | 'aggregate'
  | 'calorie-estimate-discussed';

export type LoadBasis = 'total' | 'per-implement' | 'plates-only' | 'stack' | 'bodyweight' | 'unknown';

export interface HistoricalRecord {
  id: ID;
  exerciseId: ID;
  type: HistoricalRecordType;
  description: string;
  date: ISODate | null;
  datePrecision: DatePrecision;
  loadKg?: number | null;
  loadRangeKg?: [number, number] | null;
  loadBasis?: LoadBasis;
  implements?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceKm?: number | null;
  steps?: number | null;
  /** Always false for seeded history; the user can mark it confirmed later. */
  confirmed: boolean;
  source: RecordSource;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type IntervalKind = 'active' | 'rest' | 'waiting' | 'paused';

/** A timed span inside a session. Times are epoch milliseconds. */
export interface ActivityInterval {
  id: ID;
  kind: IntervalKind;
  start: number;
  end: number | null;
  entryId?: ID | null;
  setId?: ID | null;
  source: 'timer' | 'manual';
}

export type ActiveSource = 'timer' | 'manual' | 'inferred';

export interface ExerciseSet {
  id: ID;
  status: 'completed' | 'planned' | 'estimated';
  reps: number | null;
  repsLeft?: number | null;
  repsRight?: number | null;
  repCountMode?: RepCountMode;
  /** The number the user entered, in kg. Meaning depends on `loadBasis`. */
  loadKg: number | null;
  loadRangeKg?: [number, number] | null;
  loadBasis: LoadBasis;
  /** Number of dumbbells / kettlebells / hands, used when loadBasis = per-implement. */
  implements: number;
  barKg?: number | null;
  /** Isometric hold or timed set. */
  holdSeconds?: number | null;
  /** Active duration of the set. Null = unknown. */
  activeSeconds: number | null;
  activeSource: ActiveSource | null;
  restAfterSeconds?: number | null;
  tempo?: string;
  rir?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
  notes?: string;
}

export interface CardioData {
  distanceKm: number | null;
  activeSeconds: number | null;
  activeSource: ActiveSource | null;
  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  inclinePct: number | null;
  elevationGainM: number | null;
  steps: number | null;
  /** True when these steps are already contained in the day's step total. */
  stepsIncludedInDailyTotal: boolean;
  jumps: number | null;
  cadence: number | null;
  resistance: string;
  powerW: number | null;
  setting: 'indoor' | 'outdoor' | null;
  treadmill: boolean;
  terrain: string;
  cyclingType: string;
  carriedLoadKg: number | null;
  ropeType: string;
  intervals: IntervalPlan | null;
}

export interface IntervalPlan {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  completedRounds: number;
  exerciseType: string;
}

export interface CalorieEstimate {
  formulaVersion: string;
  method: CalorieMethod;
  methodLabel: string;
  gross: number;
  net: number;
  /** Heuristic band, NOT a statistical confidence interval. */
  low: number;
  high: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  met: number | null;
  activeMinutes: number;
  weightKg: number | null;
  inputs: Record<string, number | string | boolean | null>;
  measured: string[];
  assumptions: string[];
  warnings: string[];
  computedAt: string;
}

export type CalorieMethod =
  | 'met'
  | 'acsm-walking'
  | 'acsm-running'
  | 'cycling-power'
  | 'heart-rate-keytel'
  | 'manual'
  | 'none';

export interface ExerciseEntry {
  id: ID;
  exerciseId: ID;
  variation: string;
  equipment: string;
  machineId: string;
  loadMode: LoadMode;
  intensity: Intensity;
  sets: ExerciseSet[];
  cardio: CardioData | null;
  avgHr: number | null;
  maxHr: number | null;
  rpe: number | null;
  /** User-entered calories, always labelled "manual". Used instead of the estimate when set. */
  manualCalories: number | null;
  estimate: CalorieEstimate | null;
  notes: string;
}

export interface WorkoutSession {
  id: ID;
  title: string;
  date: ISODate | null;
  datePrecision: DatePrecision;
  startTime: string | null; // HH:MM
  category: ExerciseCategory | 'mixed';
  status: RecordStatus;
  bodyWeightKg: number | null;
  bodyWeightSource: 'measurement' | 'manual' | 'assumed-latest' | null;
  /** Wall-clock length of the session. Never used as active time. */
  totalSessionSeconds: number | null;
  /** Manually entered non-active time, added to anything the timer recorded. */
  manualRestSeconds: number | null;
  manualWaitingSeconds: number | null;
  manualPausedSeconds: number | null;
  intervals: ActivityInterval[];
  entries: ExerciseEntry[];
  rpe: number | null;
  notes: string;
  source: RecordSource;
  externalId?: string | null;
  /** Open questions about an incomplete import; shown when editing. */
  clarifications: Clarification[];
  createdAt: string;
  updatedAt: string;
}

export interface Clarification {
  id: ID;
  question: string;
  resolved: boolean;
  answer?: string;
}

export interface TemplateSet {
  reps: number | null;
  loadKg: number | null;
  loadBasis: LoadBasis;
  implements: number;
}

export interface WorkoutTemplate {
  id: ID;
  name: string;
  entries: { exerciseId: ID; variation: string; equipment: string; intensity: Intensity; sets: TemplateSet[] }[];
  notes?: string;
}

export interface DailyActivitySummary {
  date: ISODate;
  steps: number | null;
  stepsSource: 'manual' | 'wearable' | null;
  /** Wearable-reported totals. Shown separately; never added to workout calories. */
  wearableActiveCalories: number | null;
  wearableTotalCalories: number | null;
  sleepHours: number | null;
  recoveryNotes: string;
}

export interface PersonalRecord {
  exerciseId: ID;
  type: 'max-load' | 'best-e1rm' | 'max-reps' | 'max-volume-session' | 'longest-distance' | 'fastest-pace' | 'longest-hold' | 'longest-duration';
  value: number;
  unit: string;
  label: string;
  sessionId: ID;
  date: ISODate | null;
  machineId?: string;
}

export interface AppSettings {
  calorieDisplay: CalorieDisplay;
  quickAddExerciseIds: ID[];
  defaultRestSeconds: number;
  /** Seconds per rep used when inferring active time of a set with no timer data. */
  inferredSecondsPerRep: number;
}

export interface AppState {
  schemaVersion: number;
  profile: UserProfile;
  measurements: BodyMeasurement[];
  exercises: ExerciseDefinition[];
  historicalRecords: HistoricalRecord[];
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  dailyActivity: DailyActivitySummary[];
  goals: Goal[];
  settings: AppSettings;
  /** The in-progress workout, saved continuously. */
  draft: WorkoutSession | null;
}

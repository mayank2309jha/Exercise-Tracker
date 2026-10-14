import type {
  AppState,
  BodyMeasurement,
  ExerciseDefinition,
  ExerciseEntry,
  ExerciseSet,
  Goal,
  HistoricalRecord,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types';
import { emptyCardio, recalcSession } from '../domain/session';

export const SCHEMA_VERSION = 1;
/** Date the seed profile was written; the stated age advances from here. */
const SEED_DATE = '2026-10-14';
const SEED_TS = '2026-10-14T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export const seedProfile: UserProfile = {
  name: '',
  dateOfBirth: null,
  statedAge: 24,
  ageAsOf: SEED_DATE,
  sex: 'male',
  heightCm: 170,
  restingHr: null,
  maxHr: null,
  maxHrSource: null,
  activityLevel: null,
  wearable: '',
  unitSystem: 'metric',
  dailyStepTarget: null,
  dailyExerciseCalorieTarget: null,
  limitations: [
    {
      id: 'lim-shin',
      label: 'Shin pain associated with running',
      appliesToKinds: ['run'],
      active: true,
      notes: 'Consider lower-impact cardio (cycling, incline walking, rowing) or shorter runs on softer surfaces.',
    },
  ],
};

const m = (id: string, date: string, weightKg: number, extra: Partial<BodyMeasurement> = {}): BodyMeasurement => ({
  id,
  date,
  datePrecision: 'day',
  dateEnd: null,
  weightKg,
  weightRangeKg: null,
  waistCm: null,
  neckCm: null,
  hipCm: null,
  bodyFatPct: null,
  restingHr: null,
  heightCm: null,
  source: 'seed',
  ...extra,
});

export const seedMeasurements: BodyMeasurement[] = [
  m('bm-2026-01', '2026-01-01', 85.25, { datePrecision: 'month', weightRangeKg: [85, 85.5], notes: 'Reported as 85–85.5 kg in January 2026; exact day unknown.' }),
  m('bm-2026-02-03', '2026-02-01', 83.25, { datePrecision: 'range', dateEnd: '2026-03-31', weightRangeKg: [83, 83.5], notes: 'Reported as 83–83.5 kg across February–March 2026.' }),
  m('bm-2026-06', '2026-06-01', 85.25, { datePrecision: 'month', weightRangeKg: [85, 85.5], notes: 'Reported as 85–85.5 kg in June 2026; exact day unknown.' }),
  m('bm-2026-09-01', '2026-09-01', 87),
  m('bm-2026-09-23', '2026-09-23', 84.5),
  m('bm-2026-10-06', '2026-10-06', 83.2, { heightCm: 170 }),
];

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

const ex = (e: ExerciseDefinition): ExerciseDefinition => e;

export const seedExercises: ExerciseDefinition[] = [
  // Cardio
  ex({ id: 'running', name: 'Running', category: 'cardio', kind: 'run', defaultLoadMode: 'none', metKey: 'running', variations: ['Outdoor run', 'Treadmill run', 'Track', 'Intervals'], equipment: ['None', 'Treadmill'], common: true }),
  ex({ id: 'jogging', name: 'Jogging', category: 'cardio', kind: 'run', defaultLoadMode: 'none', metKey: 'jogging', variations: ['Jog', 'Treadmill jog'], equipment: ['None', 'Treadmill'] }),
  ex({ id: 'walking', name: 'Walking', category: 'cardio', kind: 'walk', defaultLoadMode: 'none', metKey: 'walking', variations: ['Outdoor walk', 'Treadmill walk', 'Incline treadmill walk', 'Hike', 'Rucking'], equipment: ['None', 'Treadmill'], common: true }),
  ex({ id: 'cycling', name: 'Cycling', category: 'cardio', kind: 'cycle', defaultLoadMode: 'none', metKey: 'cycling', variations: ['Outdoor road', 'Stationary bike', 'Spin bike', 'Mountain bike', 'Commute'], equipment: ['Road bike', 'Stationary bike', 'Spin bike', 'Mountain bike'] }),
  ex({ id: 'skipping', name: 'Skipping rope', category: 'cardio', kind: 'jumprope', defaultLoadMode: 'none', metKey: 'jump-rope', variations: ['Basic bounce', 'Alternate foot', 'Double unders', 'Intervals'], equipment: ['Speed rope', 'Weighted rope', 'Beaded rope'], common: true }),
  ex({ id: 'hiit', name: 'HIIT', category: 'conditioning', kind: 'hiit', defaultLoadMode: 'none', metKey: 'hiit', variations: ['Tabata', 'EMOM', 'Circuit', 'Sprint intervals', 'Other'], equipment: ['None'] }),

  // Bodyweight & conditioning
  ex({ id: 'push-ups', name: 'Push-ups', category: 'bodyweight', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Standard', 'Incline', 'Decline', 'Diamond', 'Weighted'], equipment: ['None'], common: true }),
  ex({ id: 'pull-ups', name: 'Pull-ups', category: 'bodyweight', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Standard', 'Assisted', 'Weighted', 'Negative'], equipment: ['Pull-up bar', 'Assisted machine'] }),
  ex({ id: 'chin-ups', name: 'Chin-ups', category: 'bodyweight', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Standard', 'Assisted', 'Weighted'], equipment: ['Pull-up bar'] }),
  ex({ id: 'dips', name: 'Dips', category: 'bodyweight', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Parallel bar', 'Bench', 'Assisted', 'Weighted'], equipment: ['Dip bars', 'Bench', 'Assisted machine'] }),
  ex({ id: 'dead-hang', name: 'Dead hang', category: 'bodyweight', kind: 'isometric', defaultLoadMode: 'bodyweight', metKey: 'isometric', variations: ['Two-arm', 'One-arm', 'Active hang'], equipment: ['Pull-up bar'] }),
  ex({ id: 'mountain-climbers', name: 'Mountain climbers', category: 'conditioning', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Standard', 'Cross-body', 'Slow'], equipment: ['None'], repCountOptions: ['per-leg', 'cycles', 'total'] }),
  ex({ id: 'bw-squats', name: 'Bodyweight squats', category: 'bodyweight', kind: 'bodyweight', defaultLoadMode: 'bodyweight', metKey: 'calisthenics', variations: ['Air squat', 'Jump squat', 'Pause squat'], equipment: ['None'] }),
  ex({ id: 'bands', name: 'Resistance-band exercises', category: 'bodyweight', kind: 'band', defaultLoadMode: 'band', metKey: 'resistance-band', variations: ['Band row', 'Band pull-apart', 'Band chest press', 'Band curl', 'Band squat', 'Band face pull', 'Other'], equipment: ['Light band', 'Medium band', 'Heavy band', 'Extra-heavy band'] }),

  // Barbell, dumbbell & machine
  ex({ id: 'deadlift', name: 'Deadlift', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['Conventional', 'Sumo', 'Romanian', 'Trap bar', 'Other'], equipment: ['Barbell', 'Trap bar', 'Dumbbells'], common: true }),
  ex({ id: 'squat', name: 'Squat', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['Barbell back squat', 'Front squat', 'Dumbbell squat', 'Goblet squat', 'Bodyweight', 'Machine (hack / Smith)'], equipment: ['Barbell', 'Dumbbells', 'Kettlebell', 'Smith machine', 'Hack squat machine'], common: true }),
  ex({ id: 'bench-press', name: 'Bench press', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['Flat', 'Incline', 'Decline', 'Close-grip'], equipment: ['Barbell', 'Smith machine'], common: true }),
  ex({ id: 'db-bench-press', name: 'Dumbbell bench press', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Flat', 'Incline', 'Decline'], equipment: ['Dumbbells'] }),
  ex({ id: 'overhead-press', name: 'Overhead press', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['Standing barbell', 'Seated barbell', 'Push press', 'Machine'], equipment: ['Barbell', 'Smith machine', 'Shoulder press machine'] }),
  ex({ id: 'db-overhead-press', name: 'Dumbbell overhead press', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Seated', 'Standing', 'Arnold press'], equipment: ['Dumbbells'] }),
  ex({ id: 'lat-pulldown', name: 'Lat pulldown', category: 'strength', kind: 'strength', defaultLoadMode: 'machine', metKey: 'resistance-training', variations: ['Wide grip', 'Close grip', 'Neutral grip', 'Single arm'], equipment: ['Lat pulldown machine', 'Cable station'], common: true }),
  ex({ id: 'machine-lat-pull', name: 'Machine lat pull (horizontal)', category: 'strength', kind: 'strength', defaultLoadMode: 'machine', metKey: 'resistance-training', variations: ['Horizontal lat pull', 'Plate-loaded'], equipment: ['Selectorised machine', 'Plate-loaded machine'], description: 'Stack readings differ between machines — record the machine identifier.' }),
  ex({ id: 'machine-row', name: 'Horizontal machine row', category: 'strength', kind: 'strength', defaultLoadMode: 'machine', metKey: 'resistance-training', variations: ['Seated row', 'Chest-supported row', 'Cable row'], equipment: ['Row machine', 'Cable station'] }),
  ex({ id: 'triceps-crushers', name: 'Triceps crushers', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['EZ bar', 'Straight bar', 'Dumbbell'], equipment: ['EZ bar', 'Barbell', 'Dumbbells'] }),
  ex({ id: 'preacher-curls', name: 'Preacher curls', category: 'strength', kind: 'strength', defaultLoadMode: 'barbell', metKey: 'resistance-training', variations: ['EZ bar', 'Dumbbell', 'Machine'], equipment: ['EZ bar', 'Dumbbells', 'Preacher machine'] }),
  ex({ id: 'db-curls', name: 'Dumbbell curls', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Alternating', 'Simultaneous', 'Incline'], equipment: ['Dumbbells'] }),
  ex({ id: 'hammer-curls', name: 'Hammer curls', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Alternating', 'Simultaneous', 'Cross-body', 'Rope cable'], equipment: ['Dumbbells', 'Cable station'] }),
  ex({ id: 'bulgarian-split-squat', name: 'Bulgarian split squat', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Dumbbell', 'Barbell', 'Bodyweight'], equipment: ['Dumbbells', 'Barbell', 'Bench'], unilateral: true }),
  ex({ id: 'farmers-carry', name: "Farmer's carry", category: 'strength', kind: 'carry', defaultLoadMode: 'dumbbell', metKey: 'carry', variations: ['Two-hand', 'Suitcase (one hand)'], equipment: ['Dumbbells', 'Kettlebells', 'Trap bar', 'Farmer handles'] }),
  ex({ id: 'machine-chest-fly', name: 'Machine chest fly', category: 'strength', kind: 'strength', defaultLoadMode: 'machine', metKey: 'resistance-training', variations: ['Pec deck', 'Cable fly'], equipment: ['Pec deck machine', 'Cable station'] }),
  ex({ id: 'calf-raises', name: 'Calf raises', category: 'strength', kind: 'strength', defaultLoadMode: 'machine', metKey: 'resistance-training', variations: ['Standing machine', 'Seated machine', 'Leg-press calf raise', 'Smith machine', 'Bodyweight'], equipment: ['Calf raise machine', 'Leg press', 'Smith machine'] }),
  ex({ id: 'hex-press', name: 'Hex press', category: 'strength', kind: 'strength', defaultLoadMode: 'dumbbell', metKey: 'resistance-training', variations: ['Flat', 'Incline'], equipment: ['Dumbbells'] }),
];

// ---------------------------------------------------------------------------
// Historical records (not workouts). Nothing here counts as a completed session.
// ---------------------------------------------------------------------------

let hrN = 0;
const hr = (r: Omit<HistoricalRecord, 'id' | 'confirmed' | 'source' | 'date' | 'datePrecision'> & Partial<HistoricalRecord>): HistoricalRecord => ({
  id: `hist-${++hrN}`,
  date: null,
  datePrecision: 'unknown',
  confirmed: false,
  source: 'import-historical',
  ...r,
});

export const seedHistoricalRecords: HistoricalRecord[] = [
  hr({ exerciseId: 'jogging', type: 'mention', description: 'Previously performed or considered; no confirmed standard duration or distance.' }),
  hr({ exerciseId: 'walking', type: 'aggregate', description: '83,502 steps over six days', steps: 83502, notes: 'Daily totals — may include walking workouts. Not added to any day to avoid double counting.' }),
  hr({ exerciseId: 'walking', type: 'aggregate', description: '≈4,000,000 steps over 14 months', steps: 4_000_000, notes: 'Approximate long-term total.' }),
  hr({ exerciseId: 'cycling', type: 'mention', description: 'Previously performed; no details recorded.' }),
  hr({ exerciseId: 'skipping', type: 'historical-set', description: 'Cadence ≈180 jumps per minute', notes: 'Duration and jump count not recorded.' }),
  hr({ exerciseId: 'skipping', type: 'calorie-estimate-discussed', description: 'Older estimate of ≈20–25 kcal discussed', notes: 'Duration basis unconfirmed — not used as a calibrated per-minute rate.' }),
  hr({ exerciseId: 'hiit', type: 'mention', description: 'Previously performed; no interval structure recorded.' }),
  hr({ exerciseId: 'push-ups', type: 'historical-set', description: '25 repetitions', reps: 25, loadBasis: 'bodyweight' }),
  hr({ exerciseId: 'pull-ups', type: 'historical-set', description: '2 repetitions', reps: 2, loadBasis: 'bodyweight' }),
  hr({ exerciseId: 'dips', type: 'historical-set', description: '10 repetitions in a gym session', reps: 10, loadBasis: 'bodyweight', notes: 'Also part of the imported ~1 h gym session.' }),
  hr({ exerciseId: 'dead-hang', type: 'historical-set', description: '60-second hang', durationSeconds: 60 }),
  hr({ exerciseId: 'dead-hang', type: 'historical-set', description: 'Older record: 25-second hang', durationSeconds: 25 }),
  hr({ exerciseId: 'dead-hang', type: 'calorie-estimate-discussed', description: 'Older estimate of 2–3 kcal for the 25 s hang', notes: 'Not a validated personal measurement.' }),
  hr({ exerciseId: 'mountain-climbers', type: 'historical-set', description: '70 total reps in 25 s (35 per leg)', reps: 70, durationSeconds: 25 }),
  hr({ exerciseId: 'bw-squats', type: 'historical-set', description: '40 repetitions in one session', reps: 40, loadBasis: 'bodyweight' }),
  hr({ exerciseId: 'bands', type: 'mention', description: 'Previously performed; specific exercises and bands not recorded.' }),

  hr({ exerciseId: 'deadlift', type: 'estimated-max', description: 'Estimated strength: 100 kg', loadKg: 100, loadBasis: 'total', notes: 'Estimate, not a tested 1RM.' }),
  hr({ exerciseId: 'deadlift', type: 'historical-set', description: '30 kg × 3 reps', loadKg: 30, reps: 3, loadBasis: 'total' }),
  hr({ exerciseId: 'deadlift', type: 'historical-set', description: '70 kg × 2 reps', loadKg: 70, reps: 2, loadBasis: 'total' }),
  hr({ exerciseId: 'deadlift', type: 'session-report', description: '15 reps using 80–100 kg of plates', loadRangeKg: [80, 100], reps: 15, loadBasis: 'plates-only', notes: 'Set structure and bar weight unclear.' }),
  hr({ exerciseId: 'squat', type: 'estimated-max', description: 'Estimated strength: 40 kg', loadKg: 40, loadBasis: 'total' }),
  hr({ exerciseId: 'squat', type: 'historical-set', description: '35–45 kg × 10 reps', loadRangeKg: [35, 45], reps: 10, loadBasis: 'total' }),
  hr({ exerciseId: 'squat', type: 'historical-set', description: '24 kg barbell × 15 reps', loadKg: 24, reps: 15, loadBasis: 'total' }),
  hr({ exerciseId: 'bench-press', type: 'estimated-max', description: 'Estimated strength: 50 kg', loadKg: 50, loadBasis: 'total' }),
  hr({ exerciseId: 'bench-press', type: 'historical-set', description: '30 kg × 5 reps', loadKg: 30, reps: 5, loadBasis: 'total' }),
  hr({ exerciseId: 'db-bench-press', type: 'mention', description: 'Used 20 kg dumbbells', loadKg: 20, loadBasis: 'per-implement', implements: 2, notes: 'Per dumbbell. Session details not confirmed.' }),
  hr({ exerciseId: 'overhead-press', type: 'estimated-max', description: 'Estimated strength: 50 kg', loadKg: 50, loadBasis: 'unknown', notes: 'Implement (barbell vs dumbbells) and rep scheme unconfirmed.' }),
  hr({ exerciseId: 'db-overhead-press', type: 'planned-load', description: 'Planned 15 kg per dumbbell', loadKg: 15, loadBasis: 'per-implement', implements: 2, notes: '30 kg combined.' }),
  hr({ exerciseId: 'db-overhead-press', type: 'planned-load', description: 'Planned 20 kg per dumbbell', loadKg: 20, loadBasis: 'per-implement', implements: 2, notes: '40 kg combined.' }),
  hr({ exerciseId: 'lat-pulldown', type: 'historical-set', description: '50 kg × 5 reps', loadKg: 50, reps: 5, loadBasis: 'stack' }),
  hr({ exerciseId: 'lat-pulldown', type: 'historical-set', description: '40–50 kg × 15 reps', loadRangeKg: [40, 50], reps: 15, loadBasis: 'stack' }),
  hr({ exerciseId: 'machine-lat-pull', type: 'historical-set', description: '80–90 kg × 20 reps', loadRangeKg: [80, 90], reps: 20, loadBasis: 'stack', notes: 'Machine identity unknown; stack weight not comparable across machines.' }),
  hr({ exerciseId: 'machine-row', type: 'mention', description: 'Listed as a separate variation; no performance recorded.' }),
  hr({ exerciseId: 'triceps-crushers', type: 'historical-set', description: '10 kg × 15 reps', loadKg: 10, reps: 15, loadBasis: 'total' }),
  hr({ exerciseId: 'preacher-curls', type: 'historical-set', description: '10 kg × 10 reps', loadKg: 10, reps: 10, loadBasis: 'total' }),
  hr({ exerciseId: 'db-curls', type: 'planned-load', description: 'Planned 12.5 kg per dumbbell', loadKg: 12.5, loadBasis: 'per-implement' }),
  hr({ exerciseId: 'db-curls', type: 'planned-load', description: 'Planned 15 kg per dumbbell', loadKg: 15, loadBasis: 'per-implement' }),
  hr({ exerciseId: 'db-curls', type: 'planned-load', description: 'Planned 17.5 kg per dumbbell', loadKg: 17.5, loadBasis: 'per-implement' }),
  hr({ exerciseId: 'hammer-curls', type: 'mention', description: 'Previously mentioned; load unknown.' }),
  hr({ exerciseId: 'bulgarian-split-squat', type: 'historical-set', description: '15 kg per dumbbell, two dumbbells (30 kg combined)', loadKg: 15, loadBasis: 'per-implement', implements: 2, notes: 'Combined load assumes both dumbbells held at once. Reps per leg not recorded.' }),
  hr({ exerciseId: 'farmers-carry', type: 'historical-set', description: '35 kg per hand (70 kg total)', loadKg: 35, loadBasis: 'per-implement', implements: 2, notes: 'Distance and duration not recorded.' }),
  hr({ exerciseId: 'machine-chest-fly', type: 'session-report', description: '40–50 kg × 40 reps', loadRangeKg: [40, 50], reps: 40, loadBasis: 'stack', notes: 'Set breakdown unknown.' }),
  hr({ exerciseId: 'calf-raises', type: 'planned-load', description: 'Planned 75 kg', loadKg: 75, loadBasis: 'unknown', notes: 'Variation and actual performance not confirmed.' }),
  hr({ exerciseId: 'chin-ups', type: 'mention', description: 'Previously mentioned; no confirmed performance.' }),
  hr({ exerciseId: 'hex-press', type: 'mention', description: 'Previously mentioned; load and performance unknown.' }),
];

// ---------------------------------------------------------------------------
// Imported historical sessions (undated, incomplete)
// ---------------------------------------------------------------------------

const set = (p: Partial<ExerciseSet>): ExerciseSet => ({
  id: `set-${Math.random().toString(36).slice(2, 10)}`,
  status: 'estimated',
  reps: null,
  loadKg: null,
  loadBasis: 'total',
  implements: 1,
  activeSeconds: null,
  activeSource: null,
  ...p,
});

const entry = (id: string, exerciseId: string, p: Partial<ExerciseEntry>): ExerciseEntry => ({
  id,
  exerciseId,
  variation: '',
  equipment: '',
  machineId: '',
  loadMode: 'barbell',
  intensity: 'moderate',
  sets: [],
  cardio: null,
  avgHr: null,
  maxHr: null,
  rpe: null,
  manualCalories: null,
  estimate: null,
  notes: '',
  ...p,
});

const session = (p: Partial<WorkoutSession> & Pick<WorkoutSession, 'id' | 'title' | 'entries'>): WorkoutSession => ({
  date: null,
  datePrecision: 'unknown',
  startTime: null,
  category: 'cardio',
  status: 'imported-incomplete',
  bodyWeightKg: null,
  bodyWeightSource: null,
  totalSessionSeconds: null,
  manualRestSeconds: null,
  manualWaitingSeconds: null,
  manualPausedSeconds: null,
  intervals: [],
  rpe: null,
  notes: '',
  source: 'import-historical',
  clarifications: [],
  createdAt: SEED_TS,
  updatedAt: SEED_TS,
  ...p,
});

const q = (id: string, question: string) => ({ id, question, resolved: false });

const rawSessions: WorkoutSession[] = [
  session({
    id: 'hist-run-3k',
    title: 'Run — 3 km in 27 min',
    entries: [entry('e-run-3k', 'running', { loadMode: 'none', variation: 'Outdoor run', cardio: { ...emptyCardio(), distanceKm: 3, activeSeconds: 27 * 60, activeSource: 'manual' } })],
    clarifications: [q('c1', 'What date was this run?'), q('c2', 'Treadmill or outdoor? Any incline or hills?')],
  }),
  session({
    id: 'hist-run-1k-treadmill',
    title: 'Treadmill run — 1 km in 6 min',
    entries: [entry('e-run-1k', 'running', { loadMode: 'none', variation: 'Treadmill run', equipment: 'Treadmill', cardio: { ...emptyCardio(), distanceKm: 1, activeSeconds: 6 * 60, activeSource: 'manual', treadmill: true, setting: 'indoor' } })],
    clarifications: [q('c1', 'What date was this run?'), q('c2', 'What was the treadmill incline?')],
  }),
  session({
    id: 'hist-run-4k-2sets',
    title: 'Run — 4 km in two sets',
    notes: 'Durations of the two sets were not recorded, so calories cannot be estimated yet.',
    entries: [entry('e-run-4k', 'running', { loadMode: 'none', variation: 'Intervals', cardio: { ...emptyCardio(), distanceKm: 4 } })],
    clarifications: [q('c1', 'What date was this run?'), q('c2', 'How long did each of the two sets take?'), q('c3', 'How were the 4 km split between the two sets?')],
  }),
  session({
    id: 'hist-walk-7845',
    title: 'Walk — 7,845 steps in 74 min',
    entries: [entry('e-walk', 'walking', { loadMode: 'none', variation: 'Outdoor walk', intensity: 'light', cardio: { ...emptyCardio(), steps: 7845, activeSeconds: 74 * 60, activeSource: 'manual', setting: 'outdoor', stepsIncludedInDailyTotal: true } })],
    notes: 'Distance unknown — estimate uses the light walking MET. Adding distance enables the speed-based equation.',
    clarifications: [q('c1', 'What date was this walk?'), q('c2', 'Roughly what distance did you cover?')],
  }),
  session({
    id: 'hist-gym-1h',
    title: 'Gym session (~1 hour, incomplete details)',
    category: 'mixed',
    totalSessionSeconds: 3600,
    notes: 'Imported from a verbal report. Set structure, active time and exact loads are unknown. The hour is NOT counted as active time.',
    entries: [
      entry('g-bw-squat', 'bw-squats', { loadMode: 'bodyweight', variation: 'Air squat', sets: [set({ reps: 40, loadBasis: 'bodyweight' })], notes: '40 reps; number of sets unknown.' }),
      entry('g-squat', 'squat', { variation: 'Barbell back squat', equipment: 'Barbell', sets: [set({ reps: 15, loadKg: 24, loadBasis: 'total' })], notes: '“24 kg barbell” — unclear whether 24 kg is total or plates.' }),
      entry('g-deadlift', 'deadlift', { variation: 'Conventional', equipment: 'Barbell', sets: [set({ reps: 15, loadKg: 90, loadRangeKg: [80, 100], loadBasis: 'plates-only', barKg: null })], notes: '15 reps with 80–100 kg of plates; set structure and bar weight unclear. Midpoint 90 kg used.' }),
      entry('g-dips', 'dips', { loadMode: 'bodyweight', variation: 'Parallel bar', sets: [set({ reps: 10, loadBasis: 'bodyweight' })] }),
      entry('g-fly', 'machine-chest-fly', { loadMode: 'machine', variation: 'Pec deck', sets: [set({ reps: 40, loadKg: 45, loadRangeKg: [40, 50], loadBasis: 'stack' })], notes: '40 reps at 40–50 kg; set breakdown unknown.' }),
      entry('g-latpull', 'machine-lat-pull', { loadMode: 'machine', variation: 'Horizontal lat pull', sets: [set({ reps: 20, loadKg: 85, loadRangeKg: [80, 90], loadBasis: 'stack' })], notes: '20 reps at 80–90 kg; machine unknown.' }),
      entry('g-pulldown', 'lat-pulldown', { loadMode: 'machine', variation: 'Wide grip', sets: [set({ reps: 10, loadKg: 50, loadBasis: 'stack' })] }),
    ],
    clarifications: [
      q('c1', 'What date was this session?'),
      q('c2', 'How many sets were the 15 deadlift reps split into, and what was the bar weight?'),
      q('c3', 'Was the 24 kg squat load the total including the bar?'),
      q('c4', 'How were the 40 bodyweight squats, 40 chest-fly reps and 20 lat-pull reps split into sets?'),
      q('c5', 'Roughly how much of the hour was actual lifting vs rest and waiting?'),
      q('c6', 'Which machine was used for the horizontal lat pull?'),
    ],
  }),
];

// ---------------------------------------------------------------------------
// Templates & goals
// ---------------------------------------------------------------------------

export const seedTemplates: WorkoutTemplate[] = [
  {
    id: 'tpl-full-body',
    name: 'Full body (based on past gym session)',
    notes: 'Loads left blank where only ranges or estimates are known.',
    entries: [
      { exerciseId: 'squat', variation: 'Barbell back squat', equipment: 'Barbell', intensity: 'moderate', sets: [{ reps: 10, loadKg: null, loadBasis: 'total', implements: 1 }, { reps: 10, loadKg: null, loadBasis: 'total', implements: 1 }, { reps: 10, loadKg: null, loadBasis: 'total', implements: 1 }] },
      { exerciseId: 'deadlift', variation: 'Conventional', equipment: 'Barbell', intensity: 'moderate', sets: [{ reps: 5, loadKg: null, loadBasis: 'total', implements: 1 }, { reps: 5, loadKg: null, loadBasis: 'total', implements: 1 }, { reps: 5, loadKg: null, loadBasis: 'total', implements: 1 }] },
      { exerciseId: 'lat-pulldown', variation: 'Wide grip', equipment: 'Lat pulldown machine', intensity: 'moderate', sets: [{ reps: 10, loadKg: null, loadBasis: 'stack', implements: 1 }, { reps: 10, loadKg: null, loadBasis: 'stack', implements: 1 }, { reps: 10, loadKg: null, loadBasis: 'stack', implements: 1 }] },
      { exerciseId: 'dips', variation: 'Parallel bar', equipment: 'Dip bars', intensity: 'moderate', sets: [{ reps: 10, loadKg: null, loadBasis: 'bodyweight', implements: 1 }, { reps: 10, loadKg: null, loadBasis: 'bodyweight', implements: 1 }] },
    ],
  },
  {
    id: 'tpl-low-impact-cardio',
    name: 'Low-impact cardio (shin-friendly)',
    entries: [
      { exerciseId: 'walking', variation: 'Incline treadmill walk', equipment: 'Treadmill', intensity: 'moderate', sets: [] },
      { exerciseId: 'cycling', variation: 'Stationary bike', equipment: 'Stationary bike', intensity: 'moderate', sets: [] },
    ],
  },
  {
    id: 'tpl-bodyweight',
    name: 'Bodyweight circuit',
    entries: [
      { exerciseId: 'push-ups', variation: 'Standard', equipment: 'None', intensity: 'moderate', sets: [{ reps: 15, loadKg: null, loadBasis: 'bodyweight', implements: 1 }, { reps: 15, loadKg: null, loadBasis: 'bodyweight', implements: 1 }] },
      { exerciseId: 'bw-squats', variation: 'Air squat', equipment: 'None', intensity: 'moderate', sets: [{ reps: 20, loadKg: null, loadBasis: 'bodyweight', implements: 1 }, { reps: 20, loadKg: null, loadBasis: 'bodyweight', implements: 1 }] },
      { exerciseId: 'dead-hang', variation: 'Two-arm', equipment: 'Pull-up bar', intensity: 'moderate', sets: [{ reps: null, loadKg: null, loadBasis: 'bodyweight', implements: 1 }] },
    ],
  },
];

export const seedGoals: Goal[] = [
  {
    id: 'goal-fat-loss',
    title: 'Fat loss and improved leanness while maintaining reasonable strength',
    type: 'custom',
    targetValue: null,
    startValue: null,
    unit: '',
    startDate: null,
    targetDate: null,
    status: 'active',
    isPrimary: true,
  },
  {
    id: 'goal-hist-5kg',
    title: 'Lose at least 5 kg over 50 days',
    type: 'weight-loss',
    targetValue: 5,
    startValue: null,
    unit: 'kg',
    startDate: null,
    targetDate: null,
    status: 'historical',
    notes: 'Historical goal; start date and starting weight not recorded.',
  },
];

export function createSeedState(): AppState {
  const base: AppState = {
    schemaVersion: SCHEMA_VERSION,
    profile: structuredClone(seedProfile),
    measurements: structuredClone(seedMeasurements),
    exercises: structuredClone(seedExercises),
    historicalRecords: structuredClone(seedHistoricalRecords),
    sessions: [],
    templates: structuredClone(seedTemplates),
    dailyActivity: [],
    goals: structuredClone(seedGoals),
    settings: {
      calorieDisplay: 'gross',
      quickAddExerciseIds: ['running', 'walking', 'skipping', 'push-ups', 'squat', 'deadlift', 'bench-press', 'lat-pulldown'],
      defaultRestSeconds: 90,
      inferredSecondsPerRep: 3,
    },
    draft: null,
  };
  base.sessions = structuredClone(rawSessions).map((s) => recalcSession(s, base));
  return base;
}

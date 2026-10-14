import { cyclingMetFromSpeed, jumpRopeIntensityFromCadence, lookupMet, type MetEntry } from './met';
import { intervalPlanActiveSeconds } from './time';
import { setReps } from './strength';
import type { CalorieEstimate, ExerciseDefinition, ExerciseEntry, Intensity, Sex } from './types';

/**
 * Calorie estimation engine.
 *
 * Every result is an ESTIMATE. No metabolic measurement exists in this app, so
 * every estimate carries its method, inputs, assumptions and a qualitative
 * confidence. The low/high band is a heuristic spread tied to that confidence;
 * it is not a statistical confidence interval.
 *
 * Gross  = total energy spent during the active minutes.
 * Net    = gross minus what you would have burned at rest (1 MET) anyway.
 *
 * Bump this version whenever a formula or MET value changes so stored
 * estimates can be flagged as outdated and recalculated.
 */
export const CALORIE_FORMULA_VERSION = '2026.10.1';

/** kcal per litre of O2, standard approximation used with ACSM/MET equations. */
const KCAL_PER_L_O2 = 5;
/** Assumed gross mechanical efficiency of cycling (typical 20–25%). */
const CYCLING_EFFICIENCY = 0.24;

const BAND: Record<CalorieEstimate['confidence'], number> = {
  high: 0.1,
  medium: 0.2,
  low: 0.35,
  insufficient: 0,
};

// ---------------------------------------------------------------------------
// Primitive formulas (exported for tests and for the explanation UI)
// ---------------------------------------------------------------------------

/** Gross kcal = MET × 3.5 × kg ÷ 200 × minutes */
export function metGrossKcal(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return (met * 3.5 * weightKg) / 200 * minutes;
}

/** Net kcal = (MET − 1) × 3.5 × kg ÷ 200 × minutes */
export function metNetKcal(met: number, weightKg: number, minutes: number): number {
  if (!(met > 1) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return ((met - 1) * 3.5 * weightKg) / 200 * minutes;
}

export function restingKcal(weightKg: number, minutes: number): number {
  return metGrossKcal(1, weightKg, minutes);
}

/** ACSM walking: VO2 (ml/kg/min) = 3.5 + 0.1·S + 1.8·S·G, S in m/min, G as fraction. */
export function acsmWalkingVo2(speedMPerMin: number, grade: number): number {
  return 3.5 + 0.1 * speedMPerMin + 1.8 * speedMPerMin * Math.max(0, grade);
}

/** ACSM running: VO2 (ml/kg/min) = 3.5 + 0.2·S + 0.9·S·G */
export function acsmRunningVo2(speedMPerMin: number, grade: number): number {
  return 3.5 + 0.2 * speedMPerMin + 0.9 * speedMPerMin * Math.max(0, grade);
}

export function vo2ToKcal(vo2MlKgMin: number, weightKg: number, minutes: number): number {
  return (vo2MlKgMin * weightKg) / 1000 * KCAL_PER_L_O2 * minutes;
}

/** Cycling from power: mechanical work (kJ) ÷ efficiency → kcal. */
export function cyclingPowerKcal(watts: number, minutes: number, efficiency = CYCLING_EFFICIENCY): number {
  if (!(watts > 0) || !(minutes > 0)) return 0;
  const workKj = (watts * minutes * 60) / 1000;
  return workKj / efficiency / 4.184;
}

/** Keytel et al. (2005) heart-rate equation, kcal per minute (gross, no VO2max term). */
export function keytelKcalPerMin(hr: number, weightKg: number, age: number, sex: Sex): number {
  const kj =
    sex === 'male'
      ? -55.0969 + 0.6309 * hr + 0.1988 * weightKg + 0.2017 * age
      : -20.4022 + 0.4472 * hr - 0.1263 * weightKg + 0.074 * age;
  return Math.max(0, kj / 4.184);
}

// ---------------------------------------------------------------------------
// Entry-level estimation
// ---------------------------------------------------------------------------

export interface EstimateContext {
  weightKg: number | null;
  weightSource: 'measurement' | 'manual' | 'assumed-latest' | null;
  age: number | null;
  sex: Sex | null;
  /** Seconds per rep used when a set has no timed duration. */
  inferredSecondsPerRep: number;
}

interface ActiveTime {
  seconds: number;
  confirmedSeconds: number;
  inferredSeconds: number;
  unknownSets: number;
  notes: string[];
}

const CARDIO_KINDS = new Set(['run', 'walk', 'cycle', 'jumprope', 'hiit']);

/** Active time for an entry, separating user-confirmed time from inferred time. */
export function resolveActiveTime(entry: ExerciseEntry, def: ExerciseDefinition, secondsPerRep: number): ActiveTime {
  const notes: string[] = [];
  if (entry.cardio) {
    const c = entry.cardio;
    const planSeconds = intervalPlanActiveSeconds(c.intervals);
    if (planSeconds != null) {
      notes.push(`Active time from ${c.intervals!.completedRounds} completed work intervals × ${c.intervals!.workSeconds}s; rest intervals excluded.`);
      return { seconds: planSeconds, confirmedSeconds: planSeconds, inferredSeconds: 0, unknownSets: 0, notes };
    }
    if (c.activeSeconds != null && c.activeSeconds > 0) {
      return { seconds: c.activeSeconds, confirmedSeconds: c.activeSeconds, inferredSeconds: 0, unknownSets: 0, notes };
    }
    if (def.kind === 'jumprope' && c.jumps && c.cadence) {
      const s = (c.jumps / c.cadence) * 60;
      notes.push(`Active time inferred from ${c.jumps} jumps at ${c.cadence}/min.`);
      return { seconds: s, confirmedSeconds: 0, inferredSeconds: s, unknownSets: 0, notes };
    }
    return { seconds: 0, confirmedSeconds: 0, inferredSeconds: 0, unknownSets: 1, notes };
  }

  let confirmed = 0;
  let inferred = 0;
  let unknown = 0;
  for (const s of entry.sets) {
    if (s.status === 'planned') continue;
    if (s.activeSeconds != null && s.activeSeconds > 0 && s.activeSource !== 'inferred') confirmed += s.activeSeconds;
    else if (s.holdSeconds != null && s.holdSeconds > 0) confirmed += s.holdSeconds;
    else {
      const reps = setReps(s);
      if (reps > 0) inferred += reps * secondsPerRep;
      else unknown += 1;
    }
  }
  if (inferred > 0) notes.push(`Some set durations were not timed; inferred at ${secondsPerRep}s per rep.`);
  return { seconds: confirmed + inferred, confirmedSeconds: confirmed, inferredSeconds: inferred, unknownSets: unknown, notes };
}

function speedKmh(entry: ExerciseEntry, activeSeconds: number): { kmh: number | null; measured: boolean } {
  const c = entry.cardio;
  if (!c) return { kmh: null, measured: false };
  if (c.avgSpeedKmh != null && c.avgSpeedKmh > 0) return { kmh: c.avgSpeedKmh, measured: true };
  if (c.distanceKm != null && c.distanceKm > 0 && activeSeconds > 0) return { kmh: c.distanceKm / (activeSeconds / 3600), measured: false };
  return { kmh: null, measured: false };
}

function gradeOf(entry: ExerciseEntry): { grade: number; note: string | null } {
  const c = entry.cardio;
  if (!c) return { grade: 0, note: null };
  if (c.inclinePct != null && c.inclinePct > 0) return { grade: c.inclinePct / 100, note: `Incline ${c.inclinePct}%` };
  if (c.elevationGainM != null && c.elevationGainM > 0 && c.distanceKm) {
    const g = c.elevationGainM / (c.distanceKm * 1000);
    return { grade: g, note: `Average grade ${(g * 100).toFixed(1)}% from elevation gain; descents not modelled` };
  }
  return { grade: 0, note: null };
}

function finish(
  partial: Omit<CalorieEstimate, 'low' | 'high' | 'formulaVersion' | 'computedAt' | 'net'> & { net?: number },
  weightKg: number | null,
): CalorieEstimate {
  const resting = weightKg ? restingKcal(weightKg, partial.activeMinutes) : 0;
  const gross = Math.max(0, partial.gross);
  const net = partial.net != null ? Math.max(0, partial.net) : Math.max(0, gross - resting);
  let band = BAND[partial.confidence];
  // Inferred durations widen the band further.
  if (partial.assumptions.some((a) => a.includes('inferred'))) band = Math.max(band, 0.5);
  return {
    ...partial,
    gross,
    net,
    low: gross * (1 - band),
    high: gross * (1 + band),
    formulaVersion: CALORIE_FORMULA_VERSION,
    computedAt: new Date().toISOString(),
  };
}

export function estimateEntry(entry: ExerciseEntry, def: ExerciseDefinition, ctx: EstimateContext): CalorieEstimate {
  const time = resolveActiveTime(entry, def, ctx.inferredSecondsPerRep);
  const minutes = time.seconds / 60;
  const weight = ctx.weightKg;
  const assumptions: string[] = [...time.notes];
  const warnings: string[] = [];
  const measured: string[] = [];
  const inputs: CalorieEstimate['inputs'] = {
    exercise: def.name,
    kind: def.kind,
    intensity: entry.intensity,
    activeMinutes: round(minutes, 2),
    confirmedActiveMinutes: round(time.confirmedSeconds / 60, 2),
    inferredActiveMinutes: round(time.inferredSeconds / 60, 2),
    weightKg: weight,
    weightSource: ctx.weightSource,
  };

  if (ctx.weightSource === 'assumed-latest') assumptions.push('Body weight at the time is unknown; the latest recorded weight was used.');
  if (time.inferredSeconds > 0) assumptions.push('Duration partly inferred from rep counts, not timed.');
  if (time.unknownSets > 0) warnings.push(`${time.unknownSets} set(s) or segment(s) have no duration or reps and contribute nothing.`);

  // Manual override — always labelled.
  if (entry.manualCalories != null && entry.manualCalories >= 0) {
    return finish(
      {
        method: 'manual',
        methodLabel: 'Manual entry (user-provided)',
        gross: entry.manualCalories,
        confidence: 'medium',
        met: null,
        activeMinutes: minutes,
        weightKg: weight,
        inputs: { ...inputs, manualCalories: entry.manualCalories },
        measured: ['manual calorie value'],
        assumptions: [...assumptions, 'Manual value treated as gross calories for the activity.'],
        warnings,
      },
      weight,
    );
  }

  if (weight == null || !(weight > 0)) {
    return none('No body weight available — add a weight measurement or enter the weight for this session.', minutes, inputs, assumptions, warnings);
  }
  if (!(minutes > 0)) {
    return none('No active duration — time the exercise, enter active minutes, or log reps so time can be inferred.', minutes, inputs, assumptions, warnings);
  }

  const c = entry.cardio;
  const hrUsable = entry.avgHr != null && entry.avgHr >= 90 && entry.avgHr <= 200 && ctx.age != null && ctx.sex != null;

  // --- Cycling with power: most direct measurement available.
  if (def.kind === 'cycle' && c?.powerW && c.powerW > 0) {
    measured.push('power (W)');
    const gross = cyclingPowerKcal(c.powerW, minutes);
    return finish(
      {
        method: 'cycling-power',
        methodLabel: 'Cycling power: work (kJ) ÷ 24% efficiency',
        gross,
        confidence: 'high',
        met: null,
        activeMinutes: minutes,
        weightKg: weight,
        inputs: { ...inputs, powerW: c.powerW, efficiency: CYCLING_EFFICIENCY },
        measured,
        assumptions: [...assumptions, 'Gross mechanical efficiency assumed 24% (typical range 20–25%).'],
        warnings,
      },
      weight,
    );
  }

  // --- Walking / running: ACSM metabolic equations when speed is known.
  if ((def.kind === 'run' || def.kind === 'walk') && c) {
    const sp = speedKmh(entry, time.seconds);
    if (sp.kmh != null) {
      const mPerMin = (sp.kmh * 1000) / 60;
      const g = gradeOf(entry);
      const useRunning = def.kind === 'run' ? mPerMin >= 80 : mPerMin > 134;
      const vo2 = useRunning ? acsmRunningVo2(mPerMin, g.grade) : acsmWalkingVo2(mPerMin, g.grade);
      const mass = weight + (c.carriedLoadKg ?? 0);
      const gross = vo2ToKcal(vo2, mass, minutes);
      measured.push(sp.measured ? 'speed' : 'distance + duration');
      if (g.note) {
        measured.push(c.inclinePct ? 'treadmill incline' : 'elevation gain');
        assumptions.push(g.note);
      }
      if (c.carriedLoadKg) assumptions.push(`Carried load of ${c.carriedLoadKg} kg added to body mass.`);
      if (!useRunning && mPerMin > 100) warnings.push('Speed is above the range the ACSM walking equation was validated for (50–100 m/min).');
      if (useRunning && mPerMin < 134) assumptions.push('Running equation applied below 8 km/h because the activity was logged as running/jogging.');
      if (!c.treadmill && c.setting === 'outdoor') assumptions.push('Wind, terrain and surface are not modelled.');
      const met = vo2 / 3.5;
      return finish(
        {
          method: useRunning ? 'acsm-running' : 'acsm-walking',
          methodLabel: useRunning ? 'ACSM running equation (speed + grade)' : 'ACSM walking equation (speed + grade)',
          gross,
          confidence: 'medium',
          met: round(met, 2),
          activeMinutes: minutes,
          weightKg: weight,
          inputs: { ...inputs, speedKmh: round(sp.kmh, 2), speedMPerMin: round(mPerMin, 1), gradePct: round(g.grade * 100, 2), vo2: round(vo2, 2), massKg: mass },
          measured,
          assumptions: [...assumptions, '1 L O₂ ≈ 5 kcal.'],
          warnings,
        },
        weight,
      );
    }
  }

  // --- Heart-rate equation for cardio when HR, age and sex are available.
  if (CARDIO_KINDS.has(def.kind) && hrUsable) {
    measured.push('average heart rate');
    const gross = keytelKcalPerMin(entry.avgHr!, weight, ctx.age!, ctx.sex!) * minutes;
    return finish(
      {
        method: 'heart-rate-keytel',
        methodLabel: 'Heart-rate equation (Keytel et al., 2005)',
        gross,
        confidence: 'medium',
        met: null,
        activeMinutes: minutes,
        weightKg: weight,
        inputs: { ...inputs, avgHr: entry.avgHr, age: ctx.age, sex: ctx.sex },
        measured,
        assumptions: [...assumptions, 'Assumes steady-state aerobic exercise; HR equations are less reliable for intervals, heat, or stress.'],
        warnings,
      },
      weight,
    );
  }

  // --- MET fallback, with activity-specific refinements.
  let entryMet: MetEntry | null = null;
  let intensity: Intensity = entry.intensity;
  let confidence: CalorieEstimate['confidence'] = 'low';

  if (def.kind === 'jumprope' && c?.cadence) {
    intensity = jumpRopeIntensityFromCadence(c.cadence);
    measured.push('cadence');
    assumptions.push(`Intensity set from cadence (${c.cadence}/min).`);
    confidence = 'medium';
  }
  if (def.kind === 'cycle' && c) {
    const sp = speedKmh(entry, time.seconds);
    if (!c.treadmill && c.setting !== 'indoor' && sp.kmh != null) {
      entryMet = cyclingMetFromSpeed(sp.kmh);
      measured.push(sp.measured ? 'speed' : 'distance + duration');
      confidence = 'medium';
      if (c.elevationGainM) warnings.push('Elevation gain is not modelled in the speed-based cycling estimate.');
    } else {
      entryMet = lookupMet('stationary-cycling', intensity);
      assumptions.push('Stationary cycling with no power data: intensity chosen by the user.');
      if (c.resistance) inputs.resistance = c.resistance;
    }
  }
  if (!entryMet) {
    const key = def.kind === 'run' && entry.variation.toLowerCase().includes('jog') ? 'jogging' : def.metKey;
    entryMet = lookupMet(key, intensity);
  }
  if (!entryMet) {
    return none(`No MET value for "${def.metKey}".`, minutes, inputs, assumptions, warnings);
  }
  if (entryMet.proxy) assumptions.push(`Proxy MET: ${entryMet.proxy}.`);
  if (['strength', 'bodyweight', 'isometric', 'carry', 'band'].includes(def.kind)) {
    assumptions.push('Resistance-training METs describe whole-workout effort; per-set calories from load and reps are not measurable.');
  }
  if (CARDIO_KINDS.has(def.kind) && confidence === 'low') assumptions.push('No speed, power or heart-rate data — estimate depends on the chosen intensity.');

  const gross = metGrossKcal(entryMet.met, weight, minutes);
  return finish(
    {
      method: 'met',
      methodLabel: `MET ${entryMet.met} — ${entryMet.description} (Compendium ${entryMet.code})`,
      gross,
      net: metNetKcal(entryMet.met, weight, minutes),
      confidence: time.inferredSeconds > time.confirmedSeconds ? 'low' : confidence,
      met: entryMet.met,
      activeMinutes: minutes,
      weightKg: weight,
      inputs: { ...inputs, intensity, met: entryMet.met, metCode: entryMet.code },
      measured,
      assumptions,
      warnings,
    },
    weight,
  );
}

function none(reason: string, minutes: number, inputs: CalorieEstimate['inputs'], assumptions: string[], warnings: string[]): CalorieEstimate {
  return {
    formulaVersion: CALORIE_FORMULA_VERSION,
    method: 'none',
    methodLabel: 'Not enough data',
    gross: 0,
    net: 0,
    low: 0,
    high: 0,
    confidence: 'insufficient',
    met: null,
    activeMinutes: minutes,
    weightKg: (inputs.weightKg as number | null) ?? null,
    inputs,
    measured: [],
    assumptions,
    warnings: [reason, ...warnings],
    computedAt: new Date().toISOString(),
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

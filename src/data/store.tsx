import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppSettings,
  AppState,
  BodyMeasurement,
  DailyActivitySummary,
  ExerciseDefinition,
  Goal,
  HistoricalRecord,
  UserProfile,
  WorkoutSession,
  WorkoutTemplate,
} from '../domain/types';
import { deriveCategory, recalcSession } from '../domain/session';
import { makeUnits, type Units } from '../lib/units';
import { loadState, saveState } from './persistence';
import { createSeedState } from './seed';

interface Store {
  state: AppState;
  units: Units;
  loadError: string | null;
  saveError: boolean;
  updateProfile(p: Partial<UserProfile>): void;
  upsertMeasurement(m: BodyMeasurement): void;
  deleteMeasurement(id: string): void;
  addMeasurements(ms: BodyMeasurement[]): void;
  upsertExercise(e: ExerciseDefinition): void;
  deleteExercise(id: string): boolean;
  upsertHistorical(r: HistoricalRecord): void;
  deleteHistorical(id: string): void;
  saveSession(s: WorkoutSession): WorkoutSession;
  deleteSession(id: string): void;
  setDraft(s: WorkoutSession | null): void;
  upsertTemplate(t: WorkoutTemplate): void;
  deleteTemplate(id: string): void;
  upsertDaily(d: DailyActivitySummary): void;
  addDaily(ds: DailyActivitySummary[]): void;
  deleteDaily(date: string): void;
  upsertGoal(g: Goal): void;
  deleteGoal(id: string): void;
  updateSettings(s: Partial<AppSettings>): void;
  recalcAll(): number;
  replaceState(s: AppState): void;
  resetToSeed(): void;
}

const Ctx = createContext<Store | null>(null);

function upsert<T>(list: T[], item: T, key: (x: T) => string): T[] {
  const k = key(item);
  const i = list.findIndex((x) => key(x) === k);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

const byId = <T extends { id: string }>(x: T) => x.id;

export function StoreProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const loaded = useRef(initial ? { state: initial, error: null, fresh: false } : loadState());
  const [state, setState] = useState<AppState>(loaded.current.state);
  const [saveError, setSaveError] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setSaveError(!saveState(state));
  }, [state]);

  const recalc = useCallback((s: WorkoutSession, st: AppState) => recalcSession(s, st), []);

  const store = useMemo<Store>(
    () => ({
      state,
      units: makeUnits(state.profile.unitSystem),
      loadError: loaded.current.error,
      saveError,
      updateProfile: (p) => setState((s) => ({ ...s, profile: { ...s.profile, ...p } })),
      upsertMeasurement: (m) => setState((s) => ({ ...s, measurements: upsert(s.measurements, m, byId) })),
      deleteMeasurement: (id) => setState((s) => ({ ...s, measurements: s.measurements.filter((m) => m.id !== id) })),
      addMeasurements: (ms) => setState((s) => ({ ...s, measurements: [...s.measurements, ...ms] })),
      upsertExercise: (e) => setState((s) => ({ ...s, exercises: upsert(s.exercises, e, byId) })),
      deleteExercise: (id) => {
        const st = stateRef.current;
        const used = st.sessions.some((x) => x.entries.some((e) => e.exerciseId === id)) || st.historicalRecords.some((r) => r.exerciseId === id);
        if (used) return false;
        setState((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== id) }));
        return true;
      },
      upsertHistorical: (r) => setState((s) => ({ ...s, historicalRecords: upsert(s.historicalRecords, r, byId) })),
      deleteHistorical: (id) => setState((s) => ({ ...s, historicalRecords: s.historicalRecords.filter((r) => r.id !== id) })),
      saveSession: (session) => {
        const st = stateRef.current;
        const finalSession = recalc({ ...session, category: deriveCategory(session, st.exercises), updatedAt: new Date().toISOString() }, st);
        setState((s) => ({ ...s, sessions: upsert(s.sessions, finalSession, byId) }));
        return finalSession;
      },
      deleteSession: (id) => setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) })),
      setDraft: (d) => setState((s) => ({ ...s, draft: d })),
      upsertTemplate: (t) => setState((s) => ({ ...s, templates: upsert(s.templates, t, byId) })),
      deleteTemplate: (id) => setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) })),
      upsertDaily: (d) => setState((s) => ({ ...s, dailyActivity: upsert(s.dailyActivity, d, (x) => x.date) })),
      addDaily: (ds) =>
        setState((s) => {
          let list = s.dailyActivity;
          ds.forEach((d) => (list = upsert(list, d, (x) => x.date)));
          return { ...s, dailyActivity: list };
        }),
      deleteDaily: (date) => setState((s) => ({ ...s, dailyActivity: s.dailyActivity.filter((d) => d.date !== date) })),
      upsertGoal: (g) => setState((s) => ({ ...s, goals: upsert(s.goals, g, byId) })),
      deleteGoal: (id) => setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
      updateSettings: (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      recalcAll: () => {
        const st = stateRef.current;
        setState((s) => ({ ...s, sessions: s.sessions.map((x) => recalc(x, s)) }));
        return st.sessions.length;
      },
      replaceState: (s) => setState({ ...s, sessions: s.sessions.map((x) => (x.entries.some((e) => e.estimate == null) ? recalc(x, s) : x)) }),
      resetToSeed: () => setState(createSeedState()),
    }),
    [state, saveError, recalc],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

import type { ActivityInterval, ExerciseEntry, IntervalKind, IntervalPlan, WorkoutSession } from './types';
import { uid } from '../lib/id';

/**
 * Time accounting.
 *
 * A session is split into five buckets:
 *   total   – wall-clock length of the session
 *   active  – actual exercise (sets, cardio work). The ONLY bucket that drives calories.
 *   rest    – rest between sets / intervals
 *   waiting – waiting for equipment, changing weights
 *   paused  – interruptions
 * Whatever is left over is "untracked" and is never promoted to active time.
 */

export function intervalSeconds(i: ActivityInterval, now: number): number {
  const end = i.end ?? now;
  return Math.max(0, (end - i.start) / 1000);
}

export function openInterval(intervals: ActivityInterval[]): ActivityInterval | null {
  for (let k = intervals.length - 1; k >= 0; k--) if (intervals[k].end == null) return intervals[k];
  return null;
}

export function sumIntervals(intervals: ActivityInterval[], kind: IntervalKind, now: number, filter?: (i: ActivityInterval) => boolean): number {
  return intervals.filter((i) => i.kind === kind && (!filter || filter(i))).reduce((s, i) => s + intervalSeconds(i, now), 0);
}

/** Active seconds the timer recorded for one set (or for a cardio entry when setId is null). */
export function timerActiveSeconds(intervals: ActivityInterval[], entryId: string, setId: string | null, now: number): number {
  return sumIntervals(intervals, 'active', now, (i) => i.entryId === entryId && (i.setId ?? null) === setId);
}

export type TimerAction =
  | { type: 'start-active'; entryId: string; setId: string | null }
  | { type: 'start-rest' }
  | { type: 'start-waiting' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

function close(intervals: ActivityInterval[], now: number): ActivityInterval[] {
  return intervals.map((i) => (i.end == null ? { ...i, end: Math.max(i.start, now) } : i));
}

function open(kind: IntervalKind, now: number, entryId: string | null = null, setId: string | null = null): ActivityInterval {
  return { id: uid(), kind, start: now, end: null, entryId, setId, source: 'timer' };
}

/**
 * Pure timer state machine. Exactly one interval can be open at a time.
 * Starting anything closes whatever was running, so time is never counted twice.
 */
export function applyTimer(intervals: ActivityInterval[], action: TimerAction, now: number): ActivityInterval[] {
  const current = openInterval(intervals);
  switch (action.type) {
    case 'start-active':
      return [...close(intervals, now), open('active', now, action.entryId, action.setId)];
    case 'start-rest':
      if (current?.kind === 'rest') return intervals;
      return [...close(intervals, now), open('rest', now)];
    case 'start-waiting':
      if (current?.kind === 'waiting') return intervals;
      return [...close(intervals, now), open('waiting', now)];
    case 'pause':
      if (current?.kind === 'paused') return intervals;
      return [...close(intervals, now), open('paused', now, current?.entryId ?? null, current?.setId ?? null)];
    case 'resume': {
      if (current?.kind !== 'paused') return intervals;
      // Resume what was interrupted (the interval just before the pause).
      const closed = close(intervals, now);
      const before = [...intervals].reverse().find((i) => i.id !== current.id);
      if (before && before.end != null && before.end <= current.start && before.kind !== 'paused') {
        return [...closed, open(before.kind, now, before.entryId ?? null, before.setId ?? null)];
      }
      return closed;
    }
    case 'stop':
      return close(intervals, now);
  }
}

/**
 * Copy timer-recorded active time into sets / cardio entries. Values the user
 * corrected manually (activeSource = 'manual') are left alone.
 */
export function syncTimerActive(session: WorkoutSession, now: number): WorkoutSession {
  if (session.intervals.length === 0) return session;
  const has = (entryId: string, setId: string | null) => session.intervals.some((i) => i.kind === 'active' && i.entryId === entryId && (i.setId ?? null) === setId);
  return {
    ...session,
    entries: session.entries.map((e) => {
      if (e.cardio) {
        if (!has(e.id, null) || e.cardio.activeSource === 'manual') return e;
        return { ...e, cardio: { ...e.cardio, activeSeconds: Math.round(timerActiveSeconds(session.intervals, e.id, null, now)), activeSource: 'timer' } };
      }
      return {
        ...e,
        sets: e.sets.map((s) => (has(e.id, s.id) && s.activeSource !== 'manual' ? { ...s, activeSeconds: Math.round(timerActiveSeconds(session.intervals, e.id, s.id, now)), activeSource: 'timer' } : s)),
      };
    }),
  };
}

/** Active seconds for an entry: sum of sets (strength) or cardio active time. */
export function entryActiveSeconds(entry: ExerciseEntry): number {
  if (entry.cardio) {
    // A structured interval plan wins: only completed work intervals are active.
    const fromPlan = intervalPlanActiveSeconds(entry.cardio.intervals);
    if (fromPlan != null) return fromPlan;
    return entry.cardio.activeSeconds ?? 0;
  }
  return entry.sets.reduce((s, set) => s + (set.activeSeconds ?? set.holdSeconds ?? 0), 0);
}

/** Active time of an interval workout = completed work intervals only. */
export function intervalPlanActiveSeconds(plan: IntervalPlan | null | undefined): number | null {
  if (!plan || !(plan.workSeconds > 0)) return null;
  return plan.workSeconds * Math.max(0, plan.completedRounds);
}

export interface TimeSummary {
  totalSeconds: number;
  activeSeconds: number;
  restSeconds: number;
  waitingSeconds: number;
  pausedSeconds: number;
  untrackedSeconds: number;
  /** Total was entered/derived rather than from start/end. */
  totalKnown: boolean;
}

export function summarizeSession(session: WorkoutSession, now: number): TimeSummary {
  const active = session.entries.reduce((s, e) => s + entryActiveSeconds(e), 0);
  const rest = sumIntervals(session.intervals, 'rest', now) + (session.manualRestSeconds ?? 0);
  const waiting = sumIntervals(session.intervals, 'waiting', now) + (session.manualWaitingSeconds ?? 0);
  const paused = sumIntervals(session.intervals, 'paused', now) + (session.manualPausedSeconds ?? 0);

  let total = session.totalSessionSeconds;
  let totalKnown = total != null;
  if (total == null && session.intervals.length > 0) {
    const first = Math.min(...session.intervals.map((i) => i.start));
    const last = Math.max(...session.intervals.map((i) => i.end ?? now));
    total = (last - first) / 1000;
    totalKnown = true;
  }
  const tracked = active + rest + waiting + paused;
  const totalSeconds = Math.max(total ?? 0, tracked);
  return {
    totalSeconds,
    activeSeconds: active,
    restSeconds: rest,
    waitingSeconds: waiting,
    pausedSeconds: paused,
    untrackedSeconds: totalKnown ? Math.max(0, totalSeconds - tracked) : 0,
    totalKnown,
  };
}

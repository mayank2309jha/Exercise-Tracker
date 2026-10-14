import { describe, expect, it } from 'vitest';
import { applyTimer, intervalPlanActiveSeconds, openInterval, summarizeSession, sumIntervals, timerActiveSeconds, type TimerAction } from '../time';
import { emptySet, newEntry, newSession } from '../session';
import { seedExercises } from '../../data/seed';
import type { ActivityInterval } from '../types';

const s = (sec: number) => sec * 1000;

function run(actions: [number, TimerAction][]): ActivityInterval[] {
  return actions.reduce<ActivityInterval[]>((iv, [t, a]) => applyTimer(iv, a, s(t)), []);
}

describe('timer state machine', () => {
  const seq = run([
    [0, { type: 'start-active', entryId: 'e1', setId: 's1' }],
    [30, { type: 'start-rest' }],
    [90, { type: 'start-waiting' }],
    [120, { type: 'start-active', entryId: 'e1', setId: 's2' }],
    [150, { type: 'pause' }],
    [180, { type: 'resume' }],
    [200, { type: 'stop' }],
  ]);

  it('keeps exactly one interval open at a time', () => {
    let iv: ActivityInterval[] = [];
    iv = applyTimer(iv, { type: 'start-active', entryId: 'e', setId: 'x' }, 0);
    iv = applyTimer(iv, { type: 'start-rest' }, 1000);
    expect(iv.filter((i) => i.end == null)).toHaveLength(1);
    expect(openInterval(iv)?.kind).toBe('rest');
  });

  it('rest and paused time do not increase active time', () => {
    expect(timerActiveSeconds(seq, 'e1', 's1', s(999))).toBe(30);
    // set 2: 120→150 active, 150→180 paused, resumed 180→200 active
    expect(timerActiveSeconds(seq, 'e1', 's2', s(999))).toBe(50);
    expect(sumIntervals(seq, 'active', s(999))).toBe(80);
    expect(sumIntervals(seq, 'rest', s(999))).toBe(60);
    expect(sumIntervals(seq, 'paused', s(999))).toBe(30);
  });

  it('waiting for equipment is tracked separately and excluded from active', () => {
    expect(sumIntervals(seq, 'waiting', s(999))).toBe(30);
  });

  it('resume continues the interrupted set', () => {
    const resumed = seq.filter((i) => i.kind === 'active' && i.setId === 's2');
    expect(resumed).toHaveLength(2);
  });

  it('resume does nothing when not paused; repeated rest is idempotent', () => {
    const iv = run([[0, { type: 'start-rest' }]]);
    expect(applyTimer(iv, { type: 'resume' }, s(5))).toBe(iv);
    expect(applyTimer(iv, { type: 'start-rest' }, s(5))).toBe(iv);
  });

  it('stop closes everything; open intervals count up to "now"', () => {
    expect(seq.every((i) => i.end != null)).toBe(true);
    const live = run([[0, { type: 'start-active', entryId: 'e', setId: null }]]);
    expect(timerActiveSeconds(live, 'e', null, s(42))).toBe(42);
  });
});

describe('session time summary', () => {
  const squat = seedExercises.find((e) => e.id === 'squat')!;

  it('never treats an open or long session as active time by default', () => {
    const session = { ...newSession('2026-10-14', '18:00'), totalSessionSeconds: 3600 };
    session.entries = [{ ...newEntry(squat), sets: [emptySet({ reps: 10, loadKg: 40 })] }];
    const sum = summarizeSession(session, 0);
    expect(sum.totalSeconds).toBe(3600);
    expect(sum.activeSeconds).toBe(0);
    expect(sum.untrackedSeconds).toBe(3600);
  });

  it('separates active, rest, waiting, paused and untracked', () => {
    const session = { ...newSession('2026-10-14', '18:00'), totalSessionSeconds: 1800, manualRestSeconds: 300, manualWaitingSeconds: 120, manualPausedSeconds: 60 };
    session.entries = [{ ...newEntry(squat), sets: [emptySet({ reps: 10, activeSeconds: 45, activeSource: 'manual' }), emptySet({ reps: 10, activeSeconds: 45, activeSource: 'timer' })] }];
    const sum = summarizeSession(session, 0);
    expect(sum.activeSeconds).toBe(90);
    expect(sum.restSeconds).toBe(300);
    expect(sum.waitingSeconds).toBe(120);
    expect(sum.pausedSeconds).toBe(60);
    expect(sum.untrackedSeconds).toBe(1800 - 90 - 300 - 120 - 60);
  });

  it('derives total time from timer intervals when not entered', () => {
    const session = newSession('2026-10-14', null);
    session.intervals = run([
      [0, { type: 'start-active', entryId: 'e', setId: 's' }],
      [40, { type: 'start-rest' }],
      [130, { type: 'stop' }],
    ]);
    expect(summarizeSession(session, s(500)).totalSeconds).toBe(130);
  });

  it('interval plans count completed work only', () => {
    expect(intervalPlanActiveSeconds({ workSeconds: 30, restSeconds: 30, rounds: 10, completedRounds: 7, exerciseType: '' })).toBe(210);
    expect(intervalPlanActiveSeconds(null)).toBeNull();
    expect(intervalPlanActiveSeconds({ workSeconds: 0, restSeconds: 30, rounds: 10, completedRounds: 7, exerciseType: '' })).toBeNull();
  });
});

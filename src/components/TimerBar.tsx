import { Coffee, Hourglass, Pause, Play, Square, Timer } from 'lucide-react';
import type { WorkoutSession } from '../domain/types';
import { openInterval, summarizeSession, type TimerAction } from '../domain/time';
import { formatClock } from '../lib/dates';
import { Button, cx } from './ui';

const MODE_LABEL = { active: 'Exercising', rest: 'Resting', waiting: 'Waiting / changing weights', paused: 'Paused' } as const;

/**
 * Live session clocks. Five separate buckets are always visible so it's obvious
 * that rest, waiting and paused time are not counted as active exercise.
 */
export function TimerBar({ session, now, onTimer, restTarget }: { session: WorkoutSession; now: number; onTimer: (a: TimerAction) => void; restTarget: number }) {
  const t = summarizeSession(session, now);
  const current = openInterval(session.intervals);
  const currentSeconds = current ? (now - current.start) / 1000 : 0;
  const entry = current?.entryId ? session.entries.find((e) => e.id === current.entryId) : null;
  const setIndex = entry && current?.setId ? entry.sets.findIndex((s) => s.id === current.setId) : -1;
  const overRest = current?.kind === 'rest' && currentSeconds > restTarget;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-ink-800 bg-ink-950/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-ink-900/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', current?.kind === 'active' ? 'bg-lime-400 text-ink-950' : 'bg-ink-800 text-ink-300')}>
            {current?.kind === 'active' ? <Play size={18} aria-hidden /> : current?.kind === 'rest' ? <Coffee size={18} aria-hidden /> : current?.kind === 'waiting' ? <Hourglass size={18} aria-hidden /> : current?.kind === 'paused' ? <Pause size={18} aria-hidden /> : <Timer size={18} aria-hidden />}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-ink-400" aria-live="polite">
              {current ? MODE_LABEL[current.kind] : 'Timer idle — time here is not counted as exercise'}
              {current?.kind === 'active' && entry && <> · set {setIndex >= 0 ? setIndex + 1 : ''}</>}
            </div>
            <div className={cx('text-2xl font-semibold tabular-nums', overRest ? 'text-amber-300' : 'text-ink-100')}>
              {current ? formatClock(currentSeconds) : '--:--'}
              {current?.kind === 'rest' && <span className="ml-2 text-xs font-normal text-ink-400">/ {formatClock(restTarget)} {overRest && '· rest target passed'}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onTimer({ type: 'start-rest' })} disabled={current?.kind === 'rest'} aria-label="Start rest timer">
            <Coffee size={14} aria-hidden /> Rest
          </Button>
          <Button size="sm" onClick={() => onTimer({ type: 'start-waiting' })} disabled={current?.kind === 'waiting'} aria-label="Waiting for equipment or changing weights">
            <Hourglass size={14} aria-hidden /> Waiting
          </Button>
          {current?.kind === 'paused' ? (
            <Button size="sm" variant="primary" onClick={() => onTimer({ type: 'resume' })}>
              <Play size={14} aria-hidden /> Resume
            </Button>
          ) : (
            <Button size="sm" onClick={() => onTimer({ type: 'pause' })} disabled={!current}>
              <Pause size={14} aria-hidden /> Pause
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onTimer({ type: 'stop' })} disabled={!current} aria-label="Stop timer">
            <Square size={14} aria-hidden /> Stop
          </Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {[
          ['Session', t.totalSeconds],
          ['Active', t.activeSeconds],
          ['Rest', t.restSeconds],
          ['Waiting', t.waitingSeconds],
          ['Paused', t.pausedSeconds],
          ['Untracked', t.untrackedSeconds],
        ].map(([label, v]) => (
          <div key={label as string} className={cx('rounded-lg border px-2 py-1.5', label === 'Active' ? 'border-lime-700/50 bg-lime-900/10' : 'border-ink-800 bg-ink-900')}>
            <dt className="text-[10px] uppercase tracking-wide text-ink-500">{label}</dt>
            <dd className={cx('text-sm font-semibold tabular-nums', label === 'Active' ? 'text-lime-300' : 'text-ink-200')}>{formatClock(v as number)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

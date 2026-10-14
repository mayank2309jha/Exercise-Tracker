import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, HelpCircle, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { RecordStatus, WorkoutSession } from '../domain/types';
import { findExercise, isEstimateOutdated, sessionCalorieRange, sessionCalories } from '../domain/session';
import { entryTotalReps, entryVolumeKg, bestSet } from '../domain/strength';
import { entryActiveSeconds, summarizeSession } from '../domain/time';
import { formatDate, formatDuration, formatMonth } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { EstimateDetails } from '../components/EstimateDetails';
import { Badge, Button, Card, Empty, Field, Notice, PageHeader, Select, StatusBadge, TextInput, cx } from '../components/ui';
import { CATEGORY_LABEL } from '../components/ExercisePicker';

export function WorkoutHistory() {
  const { state, deleteSession, recalcAll } = useStore();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RecordStatus | 'all'>('all');
  const [category, setCategory] = useState<string>('all');
  const [recalced, setRecalced] = useState<number | null>(null);

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return state.sessions
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => category === 'all' || s.category === category || s.entries.some((e) => findExercise(state.exercises, e.exerciseId)?.category === category))
      .filter((s) => !ql || s.title.toLowerCase().includes(ql) || s.notes.toLowerCase().includes(ql) || s.entries.some((e) => (findExercise(state.exercises, e.exerciseId)?.name ?? '').toLowerCase().includes(ql)))
      .sort((a, b) => (b.date ?? '0000').localeCompare(a.date ?? '0000') || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  }, [state.sessions, state.exercises, q, status, category]);

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of list) {
      const k = s.date ? s.date.slice(0, 7) : 'undated';
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [list]);

  const outdated = state.sessions.some((s) => s.entries.some(isEstimateOutdated));

  return (
    <div>
      <PageHeader
        title="Workout History"
        subtitle={`${state.sessions.length} sessions · edit any workout to correct details; estimates recalculate on save.`}
        actions={
          <Button onClick={() => setRecalced(recalcAll())} title="Recompute every calorie estimate with the current formulas and data">
            <RefreshCw size={16} aria-hidden /> Recalculate all
          </Button>
        }
      />
      {params.get('saved') && (
        <div className="mb-4">
          <Notice tone="success" onClose={() => setParams({})}>
            Workout saved.
          </Notice>
        </div>
      )}
      {recalced != null && (
        <div className="mb-4">
          <Notice tone="success" onClose={() => setRecalced(null)}>
            Recalculated estimates for {recalced} sessions.
          </Notice>
        </div>
      )}
      {outdated && (
        <div className="mb-4">
          <Notice tone="warn">Some estimates were made with an older formula version. Use “Recalculate all” to update them.</Notice>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden />
          <TextInput placeholder="Search workouts, exercises, notes" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search history" />
        </div>
        <Field label="Status" className="w-full sm:w-48">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as RecordStatus | 'all')}>
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="imported-incomplete">Imported · incomplete</option>
              <option value="planned">Planned</option>
            </Select>
          )}
        </Field>
        <Field label="Category" className="w-full sm:w-48">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {(['cardio', 'conditioning', 'bodyweight', 'strength', 'mixed'] as const).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {list.length === 0 ? (
        <Empty action={<Link to="/log"><Button variant="primary">Log a workout</Button></Link>}>No workouts match.</Empty>
      ) : (
        <div className="space-y-6">
          {groups.map(([k, sessions]) => (
            <section key={k}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">{k === 'undated' ? 'Undated imports' : formatMonth(`${k}-01`)}</h2>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    onDelete={() => {
                      if (confirm(`Delete “${s.title}”? This can't be undone (export a backup first if unsure).`)) deleteSession(s.id);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onDelete }: { session: WorkoutSession; onDelete: () => void }) {
  const { state, units } = useStore();
  const [open, setOpen] = useState(false);
  const mode = state.settings.calorieDisplay;
  const t = summarizeSession(session, Date.now());
  const kcal = sessionCalories(session, mode);
  const range = sessionCalorieRange(session);
  const insufficient = session.entries.some((e) => e.estimate?.confidence === 'insufficient');
  const lowConf = session.entries.some((e) => e.estimate?.confidence === 'low');
  const openQ = session.clarifications.filter((c) => !c.resolved).length;

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ChevronDown size={18} className={cx('mt-0.5 shrink-0 text-ink-500 transition-transform', open && 'rotate-180')} aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink-100">{session.title}</span>
              <StatusBadge status={session.status} />
              {openQ > 0 && (
                <Badge tone="warn" icon={<HelpCircle size={12} aria-hidden />}>
                  {openQ} open question{openQ === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {session.date ? formatDate(session.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unknown'}
              {session.startTime && ` · ${session.startTime}`}
              {' · '}
              {session.entries.map((e) => findExercise(state.exercises, e.exerciseId)?.name ?? '?').join(', ')}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-5 text-right">
          <div>
            <div className="text-[11px] text-ink-500">Active</div>
            <div className="text-sm font-semibold tabular-nums">{formatDuration(t.activeSeconds)}</div>
          </div>
          <div>
            <div className="text-[11px] text-ink-500">kcal · {mode}</div>
            <div className="text-sm font-semibold tabular-nums">
              {insufficient && kcal === 0 ? '—' : fmtNum(kcal)}
              {lowConf && <span className="ml-1 text-[11px] font-normal text-amber-300">low conf.</span>}
            </div>
            {kcal > 0 && <div className="text-[10px] text-ink-500">≈{fmtNum(range.low)}–{fmtNum(range.high)} gross</div>}
          </div>
          <div className="flex gap-1">
            <Link to={`/log/${session.id}`} aria-label={`Edit ${session.title}`}>
              <Button size="sm" variant="ghost">
                <Pencil size={14} />
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`Delete ${session.title}`}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>
      {open && (
        <div className="space-y-3 border-t border-ink-800 p-4">
          <dl className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
            {[
              ['Session', t.totalKnown ? formatDuration(t.totalSeconds) : '—'],
              ['Active', formatDuration(t.activeSeconds)],
              ['Rest', formatDuration(t.restSeconds)],
              ['Waiting', formatDuration(t.waitingSeconds)],
              ['Paused', formatDuration(t.pausedSeconds)],
              ['Untracked', t.totalKnown ? formatDuration(t.untrackedSeconds) : '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-ink-800 bg-ink-850 p-2">
                <dt className="text-ink-500">{l}</dt>
                <dd className="font-semibold tabular-nums text-ink-200">{v}</dd>
              </div>
            ))}
          </dl>
          {session.notes && <p className="text-sm text-ink-400">{session.notes}</p>}
          {session.entries.map((e) => {
            const def = findExercise(state.exercises, e.exerciseId);
            const bs = bestSet(e);
            return (
              <div key={e.id} className="rounded-xl border border-ink-800 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {def?.name ?? e.exerciseId}
                    {e.variation && <span className="ml-2 text-xs font-normal text-ink-500">{e.variation}</span>}
                    {e.machineId && <span className="ml-2 text-xs font-normal text-ink-500">· {e.machineId}</span>}
                  </div>
                  <div className="text-xs text-ink-400">
                    {e.cardio ? (
                      <>
                        {e.cardio.distanceKm != null && `${fmtNum(units.distance(e.cardio.distanceKm), 2)} ${units.distanceUnit} · `}
                        {formatDuration(entryActiveSeconds(e))}
                        {e.cardio.steps != null && ` · ${fmtNum(e.cardio.steps)} steps`}
                      </>
                    ) : (
                      <>
                        {e.sets.length} sets · {entryTotalReps(e)} reps
                        {entryVolumeKg(e) > 0 && ` · ${fmtNum(units.weight(entryVolumeKg(e)))} ${units.weightUnit} volume`}
                        {bs && bs.loadKg > 0 && ` · best ${fmtNum(units.weight(bs.loadKg), 1)}×${bs.reps}`}
                      </>
                    )}
                  </div>
                </div>
                {e.notes && <p className="mb-2 text-xs text-ink-500">{e.notes}</p>}
                <EstimateDetails estimate={e.estimate} mode={mode} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

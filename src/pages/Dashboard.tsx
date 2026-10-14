import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus, Plus, Trophy } from 'lucide-react';
import { useStore } from '../data/store';
import { dailyCalories, filterSessions, monthlyBuckets, personalRecords, sessionsBetween, stepsForDay, totals, weeklyBuckets, type SessionFilter } from '../domain/aggregate';
import { weightTrend } from '../domain/body';
import { countsTowardTotals, findExercise } from '../domain/session';
import type { ExerciseCategory } from '../domain/types';
import { addDays, addMonths, daysBetween, formatDate, formatDuration, formatMonth, formatShortDate, monthStart, todayISO, weekStart } from '../lib/dates';
import { fmtNum, fmtPace } from '../lib/units';
import { BarSeries, ChartCard, ChartLegend, Heatmap, WeightChart, CHART } from '../components/charts';
import { Badge, Button, Card, Field, PageHeader, Select, Stat, TextInput, cx } from '../components/ui';
import { CATEGORY_LABEL } from '../components/ExercisePicker';

type RangePreset = '4w' | '12w' | '26w' | '1y' | 'all' | 'custom';

export function Dashboard() {
  const { state, units } = useStore();
  const today = todayISO();
  const mode = state.settings.calorieDisplay;
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [exerciseId, setExerciseId] = useState<string>('all');
  const [preset, setPreset] = useState<RangePreset>('12w');
  const [from, setFrom] = useState(addDays(today, -84));
  const [to, setTo] = useState(today);

  const range = useMemo(() => {
    switch (preset) {
      case '4w':
        return { from: addDays(weekStart(today), -21), to: today };
      case '12w':
        return { from: addDays(weekStart(today), -77), to: today };
      case '26w':
        return { from: addDays(weekStart(today), -175), to: today };
      case '1y':
        return { from: addMonths(monthStart(today), -11), to: today };
      case 'all': {
        const dates = state.sessions.map((s) => s.date).filter((d): d is string => !!d).sort();
        return { from: dates[0] ?? addDays(today, -84), to: today };
      }
      default:
        return { from: from || addDays(today, -84), to: to || today };
    }
  }, [preset, from, to, today, state.sessions]);

  const filter: SessionFilter = { category, exerciseId, from: range.from, to: range.to };
  const filtered = useMemo(() => filterSessions(state.sessions, state.exercises, filter), [state.sessions, state.exercises, category, exerciseId, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const allCounted = useMemo(() => filterSessions(state.sessions, state.exercises, { ...filter, from: null, to: null }), [state.sessions, state.exercises, category, exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const spanDays = Math.max(7, daysBetween(range.from, range.to) + 1);
  const monthly = spanDays > 190;
  const buckets = monthly ? monthlyBuckets(filtered, range.to, Math.ceil(spanDays / 30.4)) : weeklyBuckets(filtered, range.to, Math.ceil(spanDays / 7));
  const bucketLabel = (k: string) => (monthly ? formatMonth(k) : formatShortDate(k));
  const periodWord = monthly ? 'Monthly' : 'Weekly';

  // Today
  const todaySessions = sessionsBetween(allCounted, today, today);
  const todayTotals = totals(todaySessions);
  const steps = stepsForDay(today, state.dailyActivity, state.sessions);
  const todayDaily = state.dailyActivity.find((d) => d.date === today);

  // Weight
  const trend = weightTrend(state.measurements);
  const latest = trend[trend.length - 1];
  const monthAgo = [...trend].reverse().find((p) => daysBetween(p.date, latest?.date ?? today) >= 28);

  // Comparisons
  const thisWeek = totals(sessionsBetween(allCounted, weekStart(today), today));
  const lastWeek = totals(sessionsBetween(allCounted, addDays(weekStart(today), -7), addDays(weekStart(today), -1)));
  const thisMonth = totals(sessionsBetween(allCounted, monthStart(today), today));
  const lastMonth = totals(sessionsBetween(allCounted, addMonths(monthStart(today), -1), addDays(monthStart(today), -1)));

  const prs = personalRecords(allCounted, state.exercises)
    .filter((p) => ['max-load', 'best-e1rm', 'longest-distance', 'fastest-pace', 'longest-hold'].includes(p.type))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 8);

  const undated = state.sessions.filter((s) => countsTowardTotals(s) && !s.date).length;
  const rangeTotals = totals(filtered);
  const weeksInRange = spanDays / 7;

  const stepsRows = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    const s = stepsForDay(d, state.dailyActivity, state.sessions);
    return { label: formatShortDate(d), value: s.total, detail: s.total != null && s.addedFromWorkouts > 0 && s.dailyRecorded != null ? `incl. ${fmtNum(s.addedFromWorkouts)} workout steps` : undefined };
  });

  const exercisesForFilter = state.exercises.filter((e) => category === 'all' || e.category === category).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })} · calories shown as ${mode} (change in Settings)`}
        actions={
          <Link to="/log">
            <Button variant="primary">
              <Plus size={16} aria-hidden /> {state.draft ? 'Resume workout' : 'Log workout'}
            </Button>
          </Link>
        }
      />

      {/* Today */}
      <section aria-label="Today" className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">Today</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Workouts" value={todaySessions.length} sub={todaySessions.length ? todaySessions.map((s) => s.title).join(', ') : 'None logged yet'} />
          <Stat label="Active exercise" value={Math.round(todayTotals.activeSeconds / 60)} unit="min" sub="Excludes rest & waiting" />
          <Stat label={`Exercise kcal · ${mode === 'gross' ? 'gross' : 'net'}`} value={fmtNum(mode === 'gross' ? todayTotals.gross : todayTotals.net)} unit="kcal" accent sub="Estimated" />
          <Stat label={`Exercise kcal · ${mode === 'gross' ? 'net' : 'gross'}`} value={fmtNum(mode === 'gross' ? todayTotals.net : todayTotals.gross)} unit="kcal" sub={mode === 'gross' ? 'Above resting' : 'Total incl. resting'} />
          <Stat
            label="Steps"
            value={steps.total == null ? '—' : fmtNum(steps.total)}
            sub={
              <>
                {state.profile.dailyStepTarget ? `Target ${fmtNum(state.profile.dailyStepTarget)} · ` : ''}
                {steps.note}
              </>
            }
          />
          <Stat
            label="Body weight"
            value={latest ? fmtNum(units.weight(latest.weightKg), 1) : '—'}
            unit={units.weightUnit}
            sub={latest ? `${formatDate(latest.date)} · trend ${fmtNum(units.weight(latest.trendKg), 1)}${monthAgo ? ` (${signed(units.weight(latest.trendKg - monthAgo.trendKg))} in ~${daysBetween(monthAgo.date, latest.date)}d)` : ''}` : 'No weigh-ins'}
          />
        </div>
        {todayDaily?.wearableTotalCalories != null && (
          <p className="mt-2 text-xs text-ink-500">
            Wearable total daily energy: {fmtNum(todayDaily.wearableTotalCalories)} kcal (shown separately — not added to exercise calories).
          </p>
        )}
      </section>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-3">
        <Field label="Category" className="w-full sm:w-44">
          {(id) => (
            <Select
              id={id}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ExerciseCategory | 'all');
                setExerciseId('all');
              }}
            >
              <option value="all">All categories</option>
              {(['cardio', 'conditioning', 'bodyweight', 'strength'] as ExerciseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Exercise" className="w-full sm:w-52">
          {(id) => (
            <Select id={id} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="all">All exercises</option>
              {exercisesForFilter.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date range" className="w-full sm:w-40">
          {(id) => (
            <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
              <option value="4w">Last 4 weeks</option>
              <option value="12w">Last 12 weeks</option>
              <option value="26w">Last 6 months</option>
              <option value="1y">Last 12 months</option>
              <option value="all">All time</option>
              <option value="custom">Custom…</option>
            </Select>
          )}
        </Field>
        {preset === 'custom' && (
          <>
            <Field label="From" className="w-full sm:w-40">
              {(id) => <TextInput id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}
            </Field>
            <Field label="To" className="w-full sm:w-40">
              {(id) => <TextInput id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}
            </Field>
          </>
        )}
        <div className="w-full text-xs text-ink-400 sm:ml-auto sm:w-auto">
          {rangeTotals.sessions} workouts · {fmtNum(rangeTotals.sessions / weeksInRange, 1)}/week · {fmtNum(rangeTotals.activeSeconds / 3600, 1)} active h
        </div>
      </div>
      {undated > 0 && (
        <p className="mb-4 text-xs text-ink-500">
          {undated} imported historical session{undated === 1 ? ' has' : 's have'} no date and {undated === 1 ? 'is' : 'are'} excluded from date-based charts. <Link className="underline hover:text-ink-300" to="/history">Add dates in History</Link>.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`${periodWord} exercise calories`}
          subtitle={`Estimated ${mode} kcal from active exercise time`}
          unit="kcal"
          rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(mode === 'gross' ? b.gross : b.net), detail: `${b.sessions} workouts` }))}
          empty={buckets.every((b) => b.sessions === 0)}
        >
          <BarSeries unit="kcal" rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(mode === 'gross' ? b.gross : b.net), detail: `${b.sessions} workouts` }))} valueFmt={(v) => fmtNum(v)} />
        </ChartCard>
        <ChartCard
          title={`${periodWord} active exercise time`}
          subtitle="Minutes of actual exercise (rest, waiting and pauses excluded)"
          unit="min"
          rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(b.activeSeconds / 60) }))}
          empty={buckets.every((b) => b.sessions === 0)}
        >
          <BarSeries unit="min" rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(b.activeSeconds / 60) }))} />
        </ChartCard>
        <ChartCard
          title={`${periodWord} strength volume`}
          subtitle={`Σ load × reps (${units.weightUnit}). A training-load measure, not calories.`}
          unit={units.weightUnit}
          rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(units.weight(b.volumeKg)) }))}
          empty={buckets.every((b) => b.volumeKg === 0)}
        >
          <BarSeries unit={units.weightUnit} rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(units.weight(b.volumeKg)) }))} />
        </ChartCard>
        <ChartCard
          title={`${periodWord} cardio distance`}
          subtitle={`Running, walking & cycling (${units.distanceUnit})`}
          unit={units.distanceUnit}
          rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(units.distance(b.distanceKm) * 10) / 10 }))}
          empty={buckets.every((b) => b.distanceKm === 0)}
          actions={<CardioPaceBadge sessions={filtered} />}
        >
          <BarSeries unit={units.distanceUnit} rows={buckets.map((b) => ({ label: bucketLabel(b.key), value: Math.round(units.distance(b.distanceKm) * 10) / 10 }))} />
        </ChartCard>
        <ChartCard title="Daily steps · last 14 days" subtitle="Reconciled: workout steps already in the daily total are not added twice" unit="steps" rows={stepsRows} empty={stepsRows.every((r) => r.value == null)}>
          <BarSeries unit="steps" rows={stepsRows} valueFmt={(v) => fmtNum(v)} />
        </ChartCard>
        <ChartCard
          title="Body weight"
          subtitle="Weigh-ins and smoothed trend. Day-to-day swings are mostly water, not fat."
          unit={units.weightUnit}
          rows={trend.map((p) => ({ label: formatDate(p.date), value: Math.round(units.weight(p.weightKg) * 10) / 10, detail: `trend ${fmtNum(units.weight(p.trendKg), 1)}${p.approximate ? ' · approx.' : ''}` }))}
          empty={trend.length === 0}
        >
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <WeightChart unit={units.weightUnit} points={trend.map((p) => ({ date: p.date, weight: units.weight(p.weightKg), trend: units.weight(p.trendKg), approximate: p.approximate }))} />
            </div>
            <ChartLegend
              items={[
                { label: 'Trend', swatch: <span className="h-0.5 w-4 rounded" style={{ background: CHART.accent }} /> },
                { label: 'Weigh-in', swatch: <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.muted }} /> },
                { label: 'Approximate (range / month)', swatch: <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: CHART.muted }} /> },
              ]}
            />
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card title="Consistency" subtitle={`Last 26 weeks · colour = ${mode} exercise kcal per day`} className="lg:col-span-2">
          <Heatmap data={dailyCalories(allCounted, mode)} today={today} unit="kcal" />
        </Card>
        <Card title="Comparisons">
          <Compare label="This week vs last" a={thisWeek} b={lastWeek} mode={mode} />
          <div className="my-4 border-t border-ink-800" />
          <Compare label="This month vs last" a={thisMonth} b={lastMonth} mode={mode} />
        </Card>
      </div>

      <div className="mt-4">
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <Trophy size={16} className="text-lime-400" aria-hidden /> Personal records
            </span>
          }
          subtitle="From logged workouts only. Historical estimates and planned loads are listed in the Exercise Library."
          actions={
            <Link to="/strength" className="text-xs text-ink-400 hover:text-ink-100">
              Strength progress →
            </Link>
          }
        >
          {prs.length === 0 ? (
            <p className="text-sm text-ink-500">Log a dated workout to start tracking PRs.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {prs.map((p) => (
                <div key={`${p.exerciseId}-${p.type}-${p.machineId ?? ''}`} className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                  <div className="text-xs text-ink-400">{findExercise(state.exercises, p.exerciseId)?.name}</div>
                  <div className="mt-1 text-lg font-semibold">{formatPR(p.type, p.value, units)}</div>
                  <div className="text-[11px] text-ink-500">
                    {p.label} · {p.date ? formatDate(p.date) : 'undated'}
                    {p.machineId ? ` · ${p.machineId}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}`;
}

export function formatPR(type: string, value: number, units: ReturnType<typeof useStore>['units']): string {
  switch (type) {
    case 'max-load':
    case 'best-e1rm':
    case 'max-volume-session':
      return `${fmtNum(units.weight(value), 1)} ${units.weightUnit}`;
    case 'longest-distance':
      return `${fmtNum(units.distance(value), 2)} ${units.distanceUnit}`;
    case 'fastest-pace':
      return `${fmtPace(units.system === 'imperial' ? value * 1.609344 : value)} ${units.paceUnit}`;
    case 'longest-hold':
    case 'longest-duration':
      return formatDuration(value);
    default:
      return `${fmtNum(value)} reps`;
  }
}

function CardioPaceBadge({ sessions }: { sessions: ReturnType<typeof filterSessions> }) {
  const { units } = useStore();
  let km = 0;
  let sec = 0;
  for (const s of sessions) for (const e of s.entries) if (e.cardio?.distanceKm && e.cardio.activeSeconds && e.exerciseId !== 'cycling') {
    km += e.cardio.distanceKm;
    sec += e.cardio.activeSeconds;
  }
  if (!km) return null;
  return <Badge>Avg run/walk pace {fmtPace(sec / units.distance(km))} {units.paceUnit}</Badge>;
}

function Compare({ label, a, b, mode }: { label: string; a: ReturnType<typeof totals>; b: ReturnType<typeof totals>; mode: 'gross' | 'net' }) {
  const { units } = useStore();
  const rows: [string, number, number, (n: number) => string][] = [
    ['Workouts', a.sessions, b.sessions, (n) => fmtNum(n)],
    ['Active min', a.activeSeconds / 60, b.activeSeconds / 60, (n) => fmtNum(n)],
    [`kcal (${mode})`, mode === 'gross' ? a.gross : a.net, mode === 'gross' ? b.gross : b.net, (n) => fmtNum(n)],
    [`Volume (${units.weightUnit})`, units.weight(a.volumeKg), units.weight(b.volumeKg), (n) => fmtNum(n)],
    [`Distance (${units.distanceUnit})`, units.distance(a.distanceKm), units.distance(b.distanceKm), (n) => fmtNum(n, 1)],
  ];
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-300">{label}</div>
      <table className="w-full text-sm">
        <tbody className="tabular-nums">
          {rows.map(([name, x, y, f]) => {
            const diff = x - y;
            const Icon = Math.abs(diff) < 1e-9 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <tr key={name} className="border-t border-ink-800/70">
                <td className="py-1.5 text-ink-400">{name}</td>
                <td className="py-1.5 text-right text-ink-100">{f(x)}</td>
                <td className="w-24 py-1.5 text-right text-xs text-ink-500">
                  <span className={cx('inline-flex items-center gap-0.5', diff > 0 ? 'text-ink-200' : '')}>
                    <Icon size={12} aria-hidden />
                    <span className="sr-only">{diff > 0 ? 'up' : diff < 0 ? 'down' : 'unchanged'}</span>
                    vs {f(y)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

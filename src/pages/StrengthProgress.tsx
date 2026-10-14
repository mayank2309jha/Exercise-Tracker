import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { personalRecords, strengthSeries } from '../domain/aggregate';
import { formatDate, formatShortDate } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { BarSeries, ChartCard, LineSeries } from '../components/charts';
import { Badge, Card, Empty, Field, PageHeader, Select, Stat } from '../components/ui';
import { RECORD_TYPE_LABEL } from './ExerciseLibrary';
import { formatPR } from './Dashboard';

export function StrengthProgress() {
  const { state, units } = useStore();
  const candidates = useMemo(() => {
    const list = state.exercises.filter((e) => ['strength', 'bodyweight', 'isometric', 'carry', 'band'].includes(e.kind));
    const count = (id: string) => strengthSeries(state.sessions, id).length;
    return list.map((e) => ({ e, n: count(e.id) })).sort((a, b) => b.n - a.n || a.e.name.localeCompare(b.e.name));
  }, [state.exercises, state.sessions]);
  const [exerciseId, setExerciseId] = useState(candidates[0]?.e.id ?? 'squat');
  const [machine, setMachine] = useState('all');

  const def = state.exercises.find((e) => e.id === exerciseId);
  const all = strengthSeries(state.sessions, exerciseId);
  const machines = [...new Set(all.map((r) => r.machineId).filter(Boolean))];
  const series = machine === 'all' ? all : all.filter((r) => r.machineId === machine);
  const prs = personalRecords(state.sessions, state.exercises).filter((p) => p.exerciseId === exerciseId && (machine === 'all' || p.machineId === machine || !p.machineId));
  const history = state.historicalRecords.filter((r) => r.exerciseId === exerciseId);
  const perDumbbell = def?.defaultLoadMode === 'dumbbell';
  const w = (kg: number | null) => (kg == null ? null : Math.round(units.weight(kg) * 10) / 10);

  const first = series[0];
  const last = series[series.length - 1];
  const e1rmRows = series.map((r) => ({ label: formatShortDate(r.date), value: w(r.e1rmKg), detail: r.approximate ? 'approx. load' : undefined }));
  const loadRows = series.map((r) => ({ label: formatShortDate(r.date), value: w(r.bestLoadKg), detail: r.bestReps ? `× ${r.bestReps} reps` : undefined }));
  const volRows = series.map((r) => ({ label: formatShortDate(r.date), value: w(r.volumeKg), detail: `${r.sets} sets · ${r.totalReps} reps` }));
  const repRows = series.map((r) => ({ label: formatShortDate(r.date), value: r.totalReps }));
  const hasLoad = series.some((r) => r.bestLoadKg);

  return (
    <div>
      <PageHeader title="Strength Progress" subtitle="Progression from logged, dated workouts. Historical estimates and planned loads are shown separately for reference." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Field label="Exercise" className="w-full sm:w-64">
          {(id) => (
            <Select
              id={id}
              value={exerciseId}
              onChange={(e) => {
                setExerciseId(e.target.value);
                setMachine('all');
              }}
            >
              {candidates.map(({ e, n }) => (
                <option key={e.id} value={e.id}>
                  {e.name} {n ? `(${n})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {machines.length > 0 && (
          <Field label="Machine" className="w-full sm:w-56">
            {(id) => (
              <Select id={id} value={machine} onChange={(e) => setMachine(e.target.value)}>
                <option value="all">All machines (not comparable)</option>
                {machines.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      {series.length === 0 ? (
        <Empty>No dated workouts with {def?.name ?? 'this exercise'} yet. Log one to see progression.</Empty>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Sessions" value={series.length} sub={`${formatDate(first.date)} → ${formatDate(last.date)}`} />
            <Stat label={`Best set${perDumbbell ? ' (per dumbbell)' : ''}`} value={last.bestLoadKg ? fmtNum(units.weight(last.bestLoadKg), 1) : '—'} unit={units.weightUnit} sub={last.bestReps ? `latest · ${last.bestReps} reps` : 'latest'} />
            <Stat label="Estimated 1RM" value={last.e1rmKg ? fmtNum(units.weight(last.e1rmKg), 1) : '—'} unit={units.weightUnit} sub={first.e1rmKg && last.e1rmKg && series.length > 1 ? `${last.e1rmKg >= first.e1rmKg ? '+' : ''}${fmtNum(units.weight(last.e1rmKg - first.e1rmKg), 1)} since first` : 'Epley, 1–12 reps'} accent />
            <Stat label="Latest volume" value={fmtNum(units.weight(last.volumeKg))} unit={units.weightUnit} sub={`${last.sets} sets · ${last.totalReps} reps`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {hasLoad && (
              <>
                <ChartCard title="Estimated 1RM" subtitle={`Epley formula; sets over 12 reps excluded (${units.weightUnit})`} unit={units.weightUnit} rows={e1rmRows} empty={e1rmRows.every((r) => r.value == null)}>
                  <LineSeries rows={e1rmRows} unit={units.weightUnit} />
                </ChartCard>
                <ChartCard title={`Heaviest set${perDumbbell ? ' (per dumbbell)' : ''}`} subtitle={`Best load per session (${units.weightUnit})`} unit={units.weightUnit} rows={loadRows}>
                  <LineSeries rows={loadRows} unit={units.weightUnit} />
                </ChartCard>
                <ChartCard title="Training volume" subtitle={`Σ load × reps per session (${units.weightUnit})`} unit={units.weightUnit} rows={volRows}>
                  <BarSeries rows={volRows} unit={units.weightUnit} highlightLast={false} />
                </ChartCard>
              </>
            )}
            <ChartCard title="Total reps" subtitle="Per session" unit="reps" rows={repRows}>
              <BarSeries rows={repRows} unit="reps" highlightLast={false} />
            </ChartCard>
          </div>
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Personal records" subtitle="Logged workouts only">
          {prs.length === 0 ? (
            <p className="text-sm text-ink-500">None yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {prs.map((p) => (
                <li key={`${p.type}-${p.machineId ?? ''}`} className="flex justify-between gap-2 border-b border-ink-800/60 pb-1.5">
                  <span className="text-ink-400">
                    {p.label}
                    {p.machineId ? ` · ${p.machineId}` : ''} · {p.date ? formatDate(p.date) : 'undated'}
                  </span>
                  <span className="font-medium">{formatPR(p.type, p.value, units)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Historical reference (not plotted)" subtitle="Estimates, planned loads and recalled sets — kept separate from confirmed working weights">
          {history.length === 0 ? (
            <p className="text-sm text-ink-500">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink-200">{r.description}</span>
                  <span className="flex gap-1.5">
                    <Badge>{RECORD_TYPE_LABEL[r.type]}</Badge>
                    {!r.confirmed && <Badge tone="warn">Unconfirmed</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

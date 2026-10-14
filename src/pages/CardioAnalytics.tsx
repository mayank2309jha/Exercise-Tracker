import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '../data/store';
import { cardioSeries, filterSessions, weeklyBuckets, NO_FILTER } from '../domain/aggregate';
import { formatDate, formatDuration, formatShortDate, todayISO } from '../lib/dates';
import { fmtNum, fmtPace } from '../lib/units';
import { BarSeries, ChartCard, LineSeries } from '../components/charts';
import { Card, Empty, Field, PageHeader, Select, Stat } from '../components/ui';

const GROUPS: Record<string, { label: string; ids: string[] }> = {
  run: { label: 'Running & jogging', ids: ['running', 'jogging'] },
  walk: { label: 'Walking', ids: ['walking'] },
  cycle: { label: 'Cycling', ids: ['cycling'] },
  rope: { label: 'Skipping rope', ids: ['skipping'] },
  hiit: { label: 'HIIT', ids: ['hiit'] },
};

export function CardioAnalytics() {
  const { state, units } = useStore();
  const [group, setGroup] = useState('run');
  const mode = state.settings.calorieDisplay;
  const custom = state.exercises.filter((e) => e.isCustom && e.category === 'cardio').map((e) => e.id);
  const ids = group === 'all' ? [...Object.values(GROUPS).flatMap((g) => g.ids), ...custom] : GROUPS[group].ids;
  const series = useMemo(() => cardioSeries(state.sessions, ids), [state.sessions, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const undated = state.sessions.filter((s) => !s.date && s.entries.some((e) => ids.includes(e.exerciseId))).length;
  const weekly = weeklyBuckets(
    filterSessions(state.sessions, state.exercises, NO_FILTER).map((s) => ({ ...s, entries: s.entries.filter((e) => ids.includes(e.exerciseId)) })).filter((s) => s.entries.length),
    todayISO(),
    12,
  );

  const totalKm = series.reduce((n, r) => n + (r.distanceKm ?? 0), 0);
  const totalSec = series.reduce((n, r) => n + r.activeSeconds, 0);
  const pacedSec = series.filter((r) => r.distanceKm).reduce((n, r) => n + r.activeSeconds, 0);
  const avgPace = totalKm > 0 ? pacedSec / units.distance(totalKm) : null;
  const kcal = series.reduce((n, r) => n + (mode === 'gross' ? r.gross : r.net), 0);
  const isDistance = group === 'run' || group === 'walk' || group === 'cycle' || group === 'all';
  const shin = group === 'run' && state.profile.limitations.find((l) => l.active && l.appliesToKinds.includes('run'));

  const distRows = series.map((r) => ({ label: formatShortDate(r.date), value: r.distanceKm == null ? null : Math.round(units.distance(r.distanceKm) * 100) / 100 }));
  const paceRows = series.filter((r) => r.paceSecPerKm).map((r) => ({ label: formatShortDate(r.date), value: Math.round(units.system === 'imperial' ? r.paceSecPerKm! * 1.609344 : r.paceSecPerKm!) }));
  const speedRows = series.filter((r) => r.speedKmh).map((r) => ({ label: formatShortDate(r.date), value: Math.round(units.speed(r.speedKmh!) * 10) / 10 }));
  const minRows = weekly.map((b) => ({ label: formatShortDate(b.key), value: Math.round(b.activeSeconds / 60) }));
  const stepRows = series.filter((r) => r.steps).map((r) => ({ label: formatShortDate(r.date), value: r.steps }));

  return (
    <div>
      <PageHeader title="Cardio Analytics" subtitle="Distance, pace, speed and active time from logged cardio." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Activity" className="w-full sm:w-56">
          {(id) => (
            <Select id={id} value={group} onChange={(e) => setGroup(e.target.value)}>
              {Object.entries(GROUPS).map(([k, g]) => (
                <option key={k} value={k}>
                  {g.label}
                </option>
              ))}
              <option value="all">All cardio</option>
            </Select>
          )}
        </Field>
        {undated > 0 && <p className="pb-2 text-xs text-ink-500">{undated} undated import(s) excluded from charts.</p>}
      </div>
      {shin && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{shin.label}.</span> {shin.notes}
          </span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions" value={series.length} sub={series.length ? `since ${formatDate(series[0].date)}` : undefined} />
        {isDistance && <Stat label="Distance" value={fmtNum(units.distance(totalKm), 1)} unit={units.distanceUnit} />}
        <Stat label="Active time" value={formatDuration(totalSec)} />
        {isDistance && group !== 'cycle' ? <Stat label="Average pace" value={fmtPace(avgPace)} unit={units.paceUnit} sub="Sessions with distance" /> : <Stat label={`kcal (${mode})`} value={fmtNum(kcal)} accent />}
      </div>

      {series.length === 0 ? (
        <Empty>No dated sessions for this activity yet.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Weekly active minutes" subtitle="Last 12 weeks · moving time only" unit="min" rows={minRows} empty={minRows.every((r) => !r.value)}>
            <BarSeries rows={minRows} unit="min" />
          </ChartCard>
          {isDistance && (
            <ChartCard title="Distance per session" subtitle={units.distanceUnit} unit={units.distanceUnit} rows={distRows} empty={distRows.every((r) => r.value == null)}>
              <BarSeries rows={distRows} unit={units.distanceUnit} highlightLast={false} valueFmt={(v) => fmtNum(v, 2)} />
            </ChartCard>
          )}
          {isDistance && group !== 'cycle' && (
            <ChartCard title="Pace" subtitle={`${units.paceUnit} · lower is faster (axis inverted so faster is higher)`} unit={units.paceUnit} rows={paceRows.map((r) => ({ ...r, value: r.value }))} valueFmt={(v) => fmtPace(v)} empty={paceRows.length === 0}>
              <LineSeries rows={paceRows} unit={units.paceUnit} valueFmt={(v) => fmtPace(v)} reversed />
            </ChartCard>
          )}
          {isDistance && (
            <ChartCard title="Average speed" subtitle={units.speedUnit} unit={units.speedUnit} rows={speedRows} empty={speedRows.length === 0}>
              <LineSeries rows={speedRows} unit={units.speedUnit} />
            </ChartCard>
          )}
          {stepRows.length > 0 && (
            <ChartCard title="Workout steps" subtitle="Steps recorded during these workouts" unit="steps" rows={stepRows}>
              <BarSeries rows={stepRows} unit="steps" highlightLast={false} />
            </ChartCard>
          )}
        </div>
      )}

      {series.length > 0 && (
        <Card className="mt-4" title="Sessions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-ink-500">
                <tr>
                  <th className="py-1.5 font-medium">Date</th>
                  <th className="py-1.5 text-right font-medium">Distance</th>
                  <th className="py-1.5 text-right font-medium">Active</th>
                  <th className="py-1.5 text-right font-medium">Pace</th>
                  <th className="py-1.5 text-right font-medium">Speed</th>
                  <th className="py-1.5 text-right font-medium">kcal ({mode})</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...series].reverse().map((r) => (
                  <tr key={`${r.sessionId}-${r.exerciseId}`} className="border-t border-ink-800">
                    <td className="py-1.5 text-ink-300">{formatDate(r.date)}</td>
                    <td className="py-1.5 text-right">{r.distanceKm != null ? `${fmtNum(units.distance(r.distanceKm), 2)} ${units.distanceUnit}` : '—'}</td>
                    <td className="py-1.5 text-right">{formatDuration(r.activeSeconds)}</td>
                    <td className="py-1.5 text-right">{r.paceSecPerKm ? fmtPace(units.system === 'imperial' ? r.paceSecPerKm * 1.609344 : r.paceSecPerKm) : '—'}</td>
                    <td className="py-1.5 text-right">{r.speedKmh ? `${fmtNum(units.speed(r.speedKmh), 1)}` : '—'}</td>
                    <td className="py-1.5 text-right">{fmtNum(mode === 'gross' ? r.gross : r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

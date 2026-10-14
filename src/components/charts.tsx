import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Card, cx } from './ui';
import { addDays, formatDate, parseISODate, weekStart } from '../lib/dates';

// Chart tokens (dark surface #111316). Single-series charts use the lime accent;
// secondary reference marks use a neutral gray. Text never takes the series colour.
export const CHART = {
  accent: '#a3e635',
  muted: '#8a919a',
  grid: '#24282d',
  axis: '#8a919a',
  surface: '#111316',
};

const axisProps = {
  tick: { fill: CHART.axis, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(Math.round(n * 10) / 10);
}

interface TooltipPayload {
  payload: Record<string, unknown>;
  value: number;
  name: string;
}

function ChartTooltip({ active, payload, fmt }: { active?: boolean; payload?: TooltipPayload[]; fmt: (row: Record<string, unknown>) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-100 shadow-lg">{fmt(payload[0].payload)}</div>;
}

export interface SeriesRow {
  label: string;
  value: number | null;
  /** Shown in the tooltip and table. */
  detail?: string;
}

/** Card with a chart/table switch so values are never available only as colour or geometry. */
export function ChartCard({ title, subtitle, rows, unit, valueFmt, children, actions, empty }: { title: string; subtitle?: string; rows: SeriesRow[]; unit: string; valueFmt?: (v: number) => string; children: ReactNode; actions?: ReactNode; empty?: boolean }) {
  const [table, setTable] = useState(false);
  const fmt = valueFmt ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  return (
    <Card
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {actions}
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            aria-label={table ? 'Show chart' : 'Show data table'}
            title={table ? 'Show chart' : 'Show data table'}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            {table ? <BarChart3 size={16} /> : <Table2 size={16} />}
          </button>
        </>
      }
    >
      {empty ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-ink-700 text-sm text-ink-500">No data in this range yet</div>
      ) : table ? (
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-900 text-left text-xs text-ink-400">
              <tr>
                <th className="py-1.5 font-medium">Period</th>
                <th className="py-1.5 text-right font-medium">{unit}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-ink-800">
                  <td className="py-1.5 text-ink-300">{r.label}</td>
                  <td className="py-1.5 text-right text-ink-100">
                    {r.value == null ? '—' : fmt(r.value)}
                    {r.detail && <span className="ml-2 text-xs text-ink-500">{r.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56">{children}</div>
      )}
    </Card>
  );
}

export function BarSeries({ rows, unit, valueFmt, highlightLast = true }: { rows: SeriesRow[]; unit: string; valueFmt?: (v: number) => string; highlightLast?: boolean }) {
  const fmt = valueFmt ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  const data = rows.map((r, i) => ({ ...r, v: r.value ?? 0, isLast: highlightLast && i === rows.length - 1 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
        <YAxis {...axisProps} axisLine={false} tickFormatter={compact} width={44} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={
            <ChartTooltip
              fmt={(p) => (
                <>
                  <div className="text-ink-400">{String(p.label)}</div>
                  <div className="mt-0.5 font-semibold">
                    {fmt(Number(p.v))} {unit}
                  </div>
                  {p.detail ? <div className="text-ink-400">{String(p.detail)}</div> : null}
                </>
              )}
            />
          }
        />
        <Bar dataKey="v" fill={CHART.accent} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({ rows, unit, valueFmt, reversed }: { rows: SeriesRow[]; unit: string; valueFmt?: (v: number) => string; reversed?: boolean }) {
  const fmt = valueFmt ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axisProps} axisLine={false} reversed={reversed} tickFormatter={(v) => (valueFmt ? valueFmt(v) : compact(v))} width={48} domain={['auto', 'auto']} />
        <Tooltip
          cursor={{ stroke: CHART.muted, strokeWidth: 1 }}
          content={
            <ChartTooltip
              fmt={(p) => (
                <>
                  <div className="text-ink-400">{String(p.label)}</div>
                  <div className="mt-0.5 font-semibold">{p.value == null ? '—' : `${fmt(Number(p.value))} ${unit}`}</div>
                  {p.detail ? <div className="text-ink-400">{String(p.detail)}</div> : null}
                </>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export interface WeightPoint {
  date: string;
  weight: number;
  trend: number;
  approximate: boolean;
  note?: string;
}

/** Raw weigh-ins (gray dots; hollow when approximate) with the smoothed trend (lime line). Same axis, same unit. */
export function WeightChart({ points, unit }: { points: WeightPoint[]; unit: string }) {
  const data = points.map((p) => ({ ...p, t: parseISODate(p.date).getTime() }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axisProps} tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} minTickGap={24} />
        <YAxis {...axisProps} axisLine={false} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} width={44} />
        <Tooltip
          cursor={{ stroke: CHART.muted, strokeWidth: 1 }}
          content={
            <ChartTooltip
              fmt={(p) => (
                <>
                  <div className="text-ink-400">{formatDate(String(p.date))}{p.approximate ? ' (approx.)' : ''}</div>
                  <div className="mt-0.5 font-semibold">Weigh-in: {Number(p.weight).toFixed(1)} {unit}</div>
                  <div>Trend: {Number(p.trend).toFixed(1)} {unit}</div>
                  {p.note ? <div className="mt-1 max-w-[220px] text-ink-400">{String(p.note)}</div> : null}
                </>
              )}
            />
          }
        />
        <Line type="monotone" dataKey="trend" stroke={CHART.accent} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
        <Scatter
          dataKey="weight"
          isAnimationActive={false}
          shape={(props: { cx?: number; cy?: number; payload?: { approximate: boolean } }) => (
            <circle cx={props.cx} cy={props.cy} r={4.5} fill={props.payload?.approximate ? CHART.surface : CHART.muted} stroke={props.payload?.approximate ? CHART.muted : CHART.surface} strokeWidth={2} />
          )}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ChartLegend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-400">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.swatch}
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consistency heatmap — one sequential lime ramp, dark → bright = more kcal
// ---------------------------------------------------------------------------

const HEAT = ['#1d2024', '#2c3d14', '#3f6212', '#65a30d', '#a3e635'];

export function Heatmap({ data, today, weeks = 26, unit }: { data: Map<string, { kcal: number; sessions: number; activeSeconds: number }>; today: string; weeks?: number; unit: string }) {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const max = Math.max(1, ...[...data.values()].map((d) => d.kcal));
  const level = (kcal: number, sessions: number) => (sessions === 0 ? 0 : kcal <= 0 ? 1 : Math.min(4, 1 + Math.floor((kcal / max) * 3.999)));
  const cols: { date: string; lvl: number; label: string; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const v = data.get(date);
      const future = date > today;
      col.push({
        date,
        future,
        lvl: v ? level(v.kcal, v.sessions) : 0,
        label: v ? `${formatDate(date)}: ${v.sessions} workout${v.sessions === 1 ? '' : 's'}, ${Math.round(v.kcal)} ${unit}, ${Math.round(v.activeSeconds / 60)} active min` : `${formatDate(date)}: no workouts`,
      });
    }
    cols.push(col);
  }
  const months = cols.map((c, i) => {
    const d = parseISODate(c[0].date);
    const prev = i > 0 ? parseISODate(cols[i - 1][0].date) : null;
    return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
  });
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] pl-7 text-[10px] text-ink-500">
            {months.map((m, i) => (
              <div key={i} className="w-3 overflow-visible whitespace-nowrap">
                {m}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex w-6 flex-col gap-[3px] text-[10px] leading-3 text-ink-500">
              {['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => (
                <div key={i} className="h-3">
                  {d}
                </div>
              ))}
            </div>
            {cols.map((col, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {col.map((c) => (
                  <div
                    key={c.date}
                    role="img"
                    aria-label={c.label}
                    title={c.label}
                    className={cx('h-3 w-3 rounded-[3px]', c.date === today && 'ring-1 ring-ink-300', c.future && 'opacity-30')}
                    style={{ background: HEAT[c.lvl] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-500">
        <span>Less</span>
        {HEAT.map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
        ))}
        <span>More {unit}</span>
      </div>
    </div>
  );
}

export function dateLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}


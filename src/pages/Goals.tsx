import { useState } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Goal } from '../domain/types';
import { weightOn, weightTrend } from '../domain/body';
import { filterSessions, sessionsBetween, stepsForDay, strengthSeries, totals, NO_FILTER } from '../domain/aggregate';
import { addDays, daysBetween, formatDate, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { uid } from '../lib/id';
import { Badge, Button, Card, Field, Modal, NumberInput, PageHeader, Select, TextInput, cx } from '../components/ui';

const TYPE_LABEL: Record<Goal['type'], string> = {
  'weight-loss': 'Lose weight (kg)',
  'weight-target': 'Reach a body weight',
  steps: 'Daily steps',
  'exercise-calories': 'Daily exercise calories',
  strength: 'Strength target (e1RM)',
  custom: 'Custom / qualitative',
};

interface Progress {
  current: number | null;
  pct: number | null;
  text: string;
}

function useProgress(goal: Goal): Progress {
  const { state, units } = useStore();
  const today = todayISO();
  const trend = weightTrend(state.measurements);
  const latest = trend[trend.length - 1];
  switch (goal.type) {
    case 'weight-loss': {
      const start = goal.startValue ?? (goal.startDate ? weightOn(state.measurements, goal.startDate).weightKg : null);
      if (start == null || !latest || !goal.targetValue) return { current: null, pct: null, text: 'Set a start weight or start date to track progress.' };
      const lost = start - latest.trendKg;
      return { current: lost, pct: lost / goal.targetValue, text: `${fmtNum(units.weight(lost), 1)} of ${fmtNum(units.weight(goal.targetValue), 1)} ${units.weightUnit} lost (trend weight)` };
    }
    case 'weight-target': {
      if (!latest || goal.targetValue == null) return { current: null, pct: null, text: 'Needs a target weight and a weigh-in.' };
      const start = goal.startValue ?? trend[0]?.weightKg ?? latest.weightKg;
      const total = start - goal.targetValue;
      const done = start - latest.trendKg;
      return { current: latest.trendKg, pct: total !== 0 ? done / total : 1, text: `Trend ${fmtNum(units.weight(latest.trendKg), 1)} → target ${fmtNum(units.weight(goal.targetValue), 1)} ${units.weightUnit}` };
    }
    case 'steps': {
      if (!goal.targetValue) return { current: null, pct: null, text: 'Set a daily step target.' };
      const days = Array.from({ length: 7 }, (_, i) => stepsForDay(addDays(today, -i), state.dailyActivity, state.sessions).total).filter((x): x is number => x != null);
      if (!days.length) return { current: null, pct: null, text: 'No step data in the last 7 days.' };
      const avg = days.reduce((a, b) => a + b, 0) / days.length;
      return { current: avg, pct: avg / goal.targetValue, text: `7-day average ${fmtNum(avg)} / ${fmtNum(goal.targetValue)} steps (${days.length} days with data)` };
    }
    case 'exercise-calories': {
      if (!goal.targetValue) return { current: null, pct: null, text: 'Set a daily target.' };
      const t = totals(sessionsBetween(filterSessions(state.sessions, state.exercises, NO_FILTER), addDays(today, -6), today));
      const v = (state.settings.calorieDisplay === 'gross' ? t.gross : t.net) / 7;
      return { current: v, pct: v / goal.targetValue, text: `7-day average ${fmtNum(v)} / ${fmtNum(goal.targetValue)} kcal (${state.settings.calorieDisplay})` };
    }
    case 'strength': {
      if (!goal.exerciseId || !goal.targetValue) return { current: null, pct: null, text: 'Choose an exercise and target.' };
      const s = strengthSeries(state.sessions, goal.exerciseId);
      const best = Math.max(0, ...s.map((r) => r.e1rmKg ?? 0));
      if (!best) return { current: null, pct: null, text: 'No logged sets with ≤12 reps yet.' };
      return { current: best, pct: best / goal.targetValue, text: `Best e1RM ${fmtNum(units.weight(best), 1)} / ${fmtNum(units.weight(goal.targetValue), 1)} ${units.weightUnit}` };
    }
    default:
      return { current: null, pct: null, text: 'Qualitative goal — track via weight, waist and strength trends.' };
  }
}

export function Goals() {
  const { state, upsertGoal, deleteGoal } = useStore();
  const [editing, setEditing] = useState<Goal | null>(null);
  const active = state.goals.filter((g) => g.status === 'active').sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  const other = state.goals.filter((g) => g.status !== 'active');
  const blank = (): Goal => ({ id: uid(), title: '', type: 'weight-loss', targetValue: null, startValue: null, unit: 'kg', startDate: todayISO(), targetDate: null, status: 'active' });

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Targets with dates. Weight goals use the smoothed trend so a single heavy day doesn't look like failure."
        actions={
          <Button variant="primary" onClick={() => setEditing(blank())}>
            <Plus size={16} aria-hidden /> New goal
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {active.map((g) => (
          <GoalCard key={g.id} goal={g} onEdit={() => setEditing(structuredClone(g))} onDelete={() => confirm('Delete this goal?') && deleteGoal(g.id)} />
        ))}
      </div>
      {other.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xs font-medium uppercase tracking-wide text-ink-500">Historical & closed</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {other.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={() => setEditing(structuredClone(g))} onDelete={() => confirm('Delete this goal?') && deleteGoal(g.id)} />
            ))}
          </div>
        </>
      )}
      {editing && (
        <GoalModal
          goal={editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            upsertGoal(g);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  const p = useProgress(goal);
  const today = todayISO();
  const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) : null;
  const pct = p.pct == null ? null : Math.max(0, Math.min(1, p.pct));
  return (
    <Card
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {goal.isPrimary && <Star size={14} className="text-lime-400" aria-label="Primary goal" />}
          {goal.title}
        </span>
      }
      subtitle={TYPE_LABEL[goal.type]}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit goal">
            <Pencil size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete goal">
            <Trash2 size={14} />
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge tone={goal.status === 'active' ? 'lime' : goal.status === 'achieved' ? 'info' : 'neutral'}>{goal.status}</Badge>
        {goal.startDate && <Badge>from {formatDate(goal.startDate)}</Badge>}
        {goal.targetDate && <Badge tone={daysLeft != null && daysLeft < 0 ? 'warn' : 'neutral'}>{daysLeft != null && daysLeft >= 0 ? `${daysLeft} days left` : `ended ${formatDate(goal.targetDate)}`}</Badge>}
      </div>
      {pct != null && (
        <div className="mb-2" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Goal progress">
          <div className="h-2 overflow-hidden rounded-full bg-ink-800">
            <div className={cx('h-full rounded-full', pct >= 1 ? 'bg-lime-400' : 'bg-lime-500')} style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="mt-1 text-right text-xs text-ink-400">{Math.round((p.pct ?? 0) * 100)}%</div>
        </div>
      )}
      <p className="text-sm text-ink-300">{p.text}</p>
      {goal.notes && <p className="mt-2 text-xs text-ink-500">{goal.notes}</p>}
    </Card>
  );
}

function GoalModal({ goal, onClose, onSave }: { goal: Goal; onClose: () => void; onSave: (g: Goal) => void }) {
  const { state, units, updateProfile } = useStore();
  const [g, setG] = useState(goal);
  const p = (x: Partial<Goal>) => setG((c) => ({ ...c, ...x }));
  const isWeight = g.type === 'weight-loss' || g.type === 'weight-target' || g.type === 'strength';
  const toDisp = (kg: number | null) => (kg == null ? null : isWeight ? units.weight(kg) : kg);
  const fromDisp = (v: number | null) => (v == null ? null : isWeight ? units.weightToKg(v) : v);
  const save = () => {
    onSave(g);
    // Keep the profile's daily targets in sync with the corresponding goals.
    if (g.type === 'steps' && g.status === 'active') updateProfile({ dailyStepTarget: g.targetValue });
    if (g.type === 'exercise-calories' && g.status === 'active') updateProfile({ dailyExerciseCalorieTarget: g.targetValue });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={goal.title ? 'Edit goal' : 'New goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!g.title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title" className="col-span-2">{(id) => <TextInput id={id} value={g.title} onChange={(e) => p({ title: e.target.value })} placeholder="e.g. Lose 4 kg by December" />}</Field>
        <Field label="Type">
          {(id) => (
            <Select id={id} value={g.type} onChange={(e) => p({ type: e.target.value as Goal['type'] })}>
              {(Object.keys(TYPE_LABEL) as Goal['type'][]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={g.status} onChange={(e) => p({ status: e.target.value as Goal['status'] })}>
              <option value="active">Active</option>
              <option value="achieved">Achieved</option>
              <option value="abandoned">Abandoned</option>
              <option value="historical">Historical</option>
            </Select>
          )}
        </Field>
        {g.type === 'strength' && (
          <Field label="Exercise" className="col-span-2">
            {(id) => (
              <Select id={id} value={g.exerciseId ?? ''} onChange={(e) => p({ exerciseId: e.target.value || null })}>
                <option value="">Choose…</option>
                {state.exercises
                  .filter((e) => e.kind === 'strength')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        {g.type !== 'custom' && (
          <>
            <Field label={`Target${isWeight ? ` (${units.weightUnit})` : ''}`}>{(id) => <NumberInput id={id} value={toDisp(g.targetValue)} onChange={(v) => p({ targetValue: fromDisp(v) })} min={0} />}</Field>
            {(g.type === 'weight-loss' || g.type === 'weight-target') && (
              <Field label={`Start weight (${units.weightUnit})`} hint="Blank = weigh-in on the start date">
                {(id) => <NumberInput id={id} value={toDisp(g.startValue)} onChange={(v) => p({ startValue: fromDisp(v) })} min={0} />}
              </Field>
            )}
          </>
        )}
        <Field label="Start date">{(id) => <TextInput id={id} type="date" value={g.startDate ?? ''} onChange={(e) => p({ startDate: e.target.value || null })} />}</Field>
        <Field label="Target date">{(id) => <TextInput id={id} type="date" value={g.targetDate ?? ''} onChange={(e) => p({ targetDate: e.target.value || null })} />}</Field>
        <Field label="Notes" className="col-span-2">{(id) => <TextInput id={id} value={g.notes ?? ''} onChange={(e) => p({ notes: e.target.value || undefined })} />}</Field>
        <label className="col-span-2 inline-flex items-center gap-2 text-sm text-ink-300">
          <input type="checkbox" className="accent-lime-400" checked={!!g.isPrimary} onChange={(e) => p({ isPrimary: e.target.checked })} /> Primary goal
        </label>
      </div>
    </Modal>
  );
}

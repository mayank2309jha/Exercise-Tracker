import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, ClipboardList, HelpCircle, Play, Plus, Save, Trash2, Zap } from 'lucide-react';
import { useStore } from '../data/store';
import type { ExerciseDefinition, ExerciseEntry, WorkoutSession } from '../domain/types';
import { emptySet, findDuplicate, findExercise, newEntry, newSession, recalcSession, sessionCalories, sessionWeight, validateSession } from '../domain/session';
import { applyTimer, openInterval, summarizeSession, syncTimerActive, type TimerAction } from '../domain/time';
import { lastEntryFor } from '../domain/aggregate';
import { weightOn } from '../domain/body';
import { formatDate, formatDuration, todayISO } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { uid } from '../lib/id';
import { useNow } from '../hooks/useNow';
import { TimerBar } from '../components/TimerBar';
import { EntryEditor, DurationInput } from '../components/EntryEditor';
import { ExercisePicker } from '../components/ExercisePicker';
import { Badge, Button, Card, Field, Modal, Notice, NumberInput, PageHeader, Select, StatusBadge, TextInput } from '../components/ui';

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function LogWorkout() {
  const { sessionId } = useParams();
  return sessionId ? <EditExisting id={sessionId} /> : <DraftFlow />;
}

// ---------------------------------------------------------------------------
// New workout (draft, persisted continuously)
// ---------------------------------------------------------------------------

function DraftFlow() {
  const { state, setDraft } = useStore();
  const navigate = useNavigate();
  if (!state.draft) return <StartScreen />;
  return (
    <SessionEditor
      session={state.draft}
      onChange={setDraft}
      onSaved={() => {
        setDraft(null);
        navigate('/history?saved=1');
      }}
      onCancel={() => {
        if (confirm('Discard this workout? Everything logged so far will be lost.')) setDraft(null);
      }}
      cancelLabel="Discard"
    />
  );
}

function StartScreen() {
  const { state, setDraft } = useStore();
  const [pastDate, setPastDate] = useState(todayISO());
  const exById = (id: string) => findExercise(state.exercises, id);

  const withPrefill = (def: ExerciseDefinition): ExerciseEntry => prefillEntry(def, state.sessions);

  const startLive = (defs: ExerciseDefinition[] = []) => {
    const s = { ...newSession(todayISO(), nowHHMM()), entries: defs.map(withPrefill) };
    setDraft(s);
  };

  const startFromTemplate = (tplId: string) => {
    const t = state.templates.find((x) => x.id === tplId);
    if (!t) return;
    const s = newSession(todayISO(), nowHHMM());
    s.title = t.name;
    s.entries = t.entries
      .map((te) => {
        const def = exById(te.exerciseId);
        if (!def) return null;
        const e = newEntry(def, te.intensity);
        e.variation = te.variation || e.variation;
        e.equipment = te.equipment || e.equipment;
        if (!e.cardio) e.sets = te.sets.length ? te.sets.map((ts) => emptySet({ reps: ts.reps, loadKg: ts.loadKg, loadBasis: ts.loadBasis, implements: ts.implements })) : e.sets;
        return e;
      })
      .filter((e): e is ExerciseEntry => e != null);
    setDraft(s);
  };

  const quick = state.settings.quickAddExerciseIds.map(exById).filter((e): e is ExerciseDefinition => !!e);

  return (
    <div>
      <PageHeader title="Log Workout" subtitle="Start a live session with timers, or log one you've already done." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Start now" subtitle="Live timers separate active, rest, waiting and paused time.">
          <Button variant="primary" size="lg" className="w-full" onClick={() => startLive()}>
            <Play size={18} aria-hidden /> Start live workout
          </Button>
        </Card>
        <Card title="Log a past workout" subtitle="Enter sets and durations after the fact.">
          <div className="flex gap-2">
            <TextInput type="date" value={pastDate} max={todayISO()} onChange={(e) => setPastDate(e.target.value)} aria-label="Workout date" />
            <Button onClick={() => pastDate && setDraft({ ...newSession(pastDate, null) })} disabled={!pastDate}>
              <CalendarPlus size={16} aria-hidden /> Log
            </Button>
          </div>
        </Card>
        <Card title="Quick add" subtitle="Starts a live workout with this exercise.">
          <div className="flex flex-wrap gap-2">
            {quick.map((e) => (
              <Button key={e.id} size="sm" onClick={() => startLive([e])}>
                <Zap size={12} aria-hidden /> {e.name}
              </Button>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4">
        <Card title="Templates" subtitle="Start from a saved workout. Sets and loads are editable defaults.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {state.templates.map((t) => (
              <button key={t.id} type="button" onClick={() => startFromTemplate(t.id)} className="rounded-xl border border-ink-800 bg-ink-850 p-3 text-left hover:border-lime-700/60">
                <div className="flex items-center gap-2 text-sm font-medium text-ink-100">
                  <ClipboardList size={16} className="text-ink-400" aria-hidden /> {t.name}
                </div>
                <div className="mt-1 text-xs text-ink-500">{t.entries.map((e) => exById(e.exerciseId)?.name).filter(Boolean).join(' · ')}</div>
              </button>
            ))}
            {state.templates.length === 0 && <p className="text-sm text-ink-500">No templates yet. Save one from any workout.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function prefillEntry(def: ExerciseDefinition, sessions: WorkoutSession[]): ExerciseEntry {
  const e = newEntry(def);
  const last = lastEntryFor(sessions, def.id);
  if (last && !e.cardio && last.entry.sets.length > 0) {
    e.variation = last.entry.variation || e.variation;
    e.equipment = last.entry.equipment || e.equipment;
    e.machineId = last.entry.machineId;
    e.loadMode = last.entry.loadMode;
    e.sets = last.entry.sets
      .filter((s) => s.status !== 'planned')
      .map((s) => ({ ...s, id: uid(), status: 'completed' as const, activeSeconds: null, activeSource: null, loadRangeKg: null, rpe: null, rir: null }));
    e.notes = `Prefilled from ${last.session.date ? formatDate(last.session.date) : 'an undated session'} — edit to match today.`;
    if (e.sets.length === 0) e.sets = [emptySet()];
  }
  return e;
}

// ---------------------------------------------------------------------------
// Edit an existing session
// ---------------------------------------------------------------------------

function EditExisting({ id }: { id: string }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const original = state.sessions.find((s) => s.id === id);
  const [session, setSession] = useState<WorkoutSession | null>(original ? structuredClone(original) : null);
  if (!session) {
    return (
      <div>
        <PageHeader title="Workout not found" />
        <Notice tone="warn">This workout doesn't exist (it may have been deleted).</Notice>
      </div>
    );
  }
  return <SessionEditor session={session} onChange={setSession} onSaved={() => navigate('/history?saved=1')} onCancel={() => navigate(-1)} cancelLabel="Cancel" editing />;
}

// ---------------------------------------------------------------------------
// Shared editor
// ---------------------------------------------------------------------------

function SessionEditor({
  session,
  onChange,
  onSaved,
  onCancel,
  cancelLabel,
  editing,
}: {
  session: WorkoutSession;
  onChange: (s: WorkoutSession) => void;
  onSaved: (s: WorkoutSession) => void;
  onCancel: () => void;
  cancelLabel: string;
  editing?: boolean;
}) {
  const store = useStore();
  const { state, units } = store;
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dup, setDup] = useState<WorkoutSession | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const timerRunning = openInterval(session.intervals) != null;
  const now = useNow(timerRunning);
  const isToday = session.date === todayISO();
  const showTimer = isToday || session.intervals.length > 0;

  const live = useMemo(() => syncTimerActive(session, now), [session, now]);
  const estimated = useMemo(() => recalcSession(live, state), [live, state]);
  const time = summarizeSession(live, now);
  const mode = state.settings.calorieDisplay;
  const autoWeight = weightOn(state.measurements, session.date);
  const usedWeight = sessionWeight(session, state.measurements);
  const openQuestions = session.clarifications.filter((c) => !c.resolved);

  const patch = (p: Partial<WorkoutSession>) => onChange({ ...session, ...p });

  const handleTimer = (a: TimerAction) => {
    const t = Date.now();
    let next: WorkoutSession = { ...session, intervals: applyTimer(session.intervals, a, t) };
    if (a.type === 'start-active' && !next.startTime) next.startTime = nowHHMM();
    next = syncTimerActive(next, t);
    onChange(next);
  };

  const addExercise = (def: ExerciseDefinition) => patch({ entries: [...session.entries, prefillEntry(def, state.sessions)] });

  const updateEntry = (i: number, e: ExerciseEntry) => patch({ entries: session.entries.map((x, k) => (k === i ? e : x)) });
  const removeEntry = (i: number) => {
    const entry = session.entries[i];
    patch({ entries: session.entries.filter((_, k) => k !== i), intervals: session.intervals.filter((iv) => iv.entryId !== entry.id || iv.end != null) });
  };
  const moveEntry = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= session.entries.length) return;
    const copy = session.entries.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    patch({ entries: copy });
  };

  const finalize = (): WorkoutSession => {
    const t = Date.now();
    let s: WorkoutSession = { ...session, intervals: applyTimer(session.intervals, { type: 'stop' }, t) };
    s = syncTimerActive(s, t);
    if (s.totalSessionSeconds == null && s.intervals.length > 0) s.totalSessionSeconds = Math.round(summarizeSession(s, t).totalSeconds);
    if (s.status === 'in-progress') s.status = 'completed';
    // Freeze the body weight used, so later weigh-ins don't silently rewrite history.
    if (s.bodyWeightKg == null && s.date) {
      const w = weightOn(state.measurements, s.date);
      if (w.weightKg != null) {
        s.bodyWeightKg = w.weightKg;
        s.bodyWeightSource = w.source;
      }
    }
    if (s.title === 'Workout' || !s.title.trim()) {
      const names = s.entries.map((e) => findExercise(state.exercises, e.exerciseId)?.name).filter(Boolean);
      s.title = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '') || 'Workout';
    }
    return s;
  };

  const save = (force = false) => {
    const s = finalize();
    const errs = validateSession(s, state.exercises);
    setErrors(errs);
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const d = findDuplicate(s, state.sessions);
    if (d && !force) {
      setDup(d);
      return;
    }
    setDup(null);
    const saved = store.saveSession(s);
    onSaved(saved);
  };

  const saveTemplate = () => {
    store.upsertTemplate({
      id: uid(),
      name: session.title && session.title !== 'Workout' ? session.title : `Template ${state.templates.length + 1}`,
      entries: session.entries.map((e) => ({
        exerciseId: e.exerciseId,
        variation: e.variation,
        equipment: e.equipment,
        intensity: e.intensity,
        sets: e.sets.filter((s) => s.status !== 'planned').map((s) => ({ reps: s.reps, loadKg: s.loadKg, loadBasis: s.loadBasis, implements: s.implements })),
      })),
    });
    setTemplateSaved(true);
  };

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit workout' : 'Workout in progress'}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={session.status} />
            {!editing && <span>Saved automatically on this device as you go.</span>}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel === 'Discard' && <Trash2 size={16} aria-hidden />} {cancelLabel}
            </Button>
            <Button variant="primary" onClick={() => save()}>
              <Save size={16} aria-hidden /> {editing ? 'Save changes' : 'Finish & save'}
            </Button>
          </>
        }
      />

      {errors.length > 0 && (
        <div className="mb-4">
          <Notice tone="danger" onClose={() => setErrors([])}>
            <div className="font-medium">Fix these before saving:</div>
            <ul className="mt-1 list-disc pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      {showTimer && <TimerBar session={live} now={now} onTimer={handleTimer} restTarget={state.settings.defaultRestSeconds} />}

      {openQuestions.length > 0 && (
        <Card className="mb-4" title={<span className="inline-flex items-center gap-2"><HelpCircle size={16} className="text-amber-300" aria-hidden /> This imported session has missing details</span>} subtitle="Answer what you remember, then update the sets below. Mark a question resolved when done.">
          <div className="space-y-3">
            {session.clarifications.map((c) => (
              <div key={c.id} className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className={c.resolved ? 'text-sm text-ink-500 line-through' : 'text-sm text-ink-200'}>{c.question}</p>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-400">
                    <input type="checkbox" className="accent-lime-400" checked={c.resolved} onChange={(e) => patch({ clarifications: session.clarifications.map((x) => (x.id === c.id ? { ...x, resolved: e.target.checked } : x)) })} />
                    Resolved
                  </label>
                </div>
                <TextInput className="mt-2" placeholder="Your answer (saved as a note)" value={c.answer ?? ''} onChange={(e) => patch({ clarifications: session.clarifications.map((x) => (x.id === c.id ? { ...x, answer: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4" title="Session details">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Field label="Title" className="col-span-2">
            {(id) => <TextInput id={id} value={session.title} onChange={(e) => patch({ title: e.target.value })} />}
          </Field>
          <Field label="Date">
            {(id) => <TextInput id={id} type="date" value={session.date ?? ''} onChange={(e) => patch({ date: e.target.value || null, datePrecision: e.target.value ? 'day' : 'unknown' })} />}
          </Field>
          <Field label="Start time">{(id) => <TextInput id={id} type="time" value={session.startTime ?? ''} onChange={(e) => patch({ startTime: e.target.value || null })} />}</Field>
          <Field
            label={`Body weight (${units.weightUnit})`}
            hint={session.bodyWeightKg == null ? (autoWeight.weightKg != null ? `Using ${fmtNum(units.weight(autoWeight.weightKg), 1)} ${units.weightUnit} from ${formatDate(autoWeight.measurement?.date)}${autoWeight.source === 'assumed-latest' ? ' (assumed)' : ''}` : 'No weigh-in found — enter one') : 'Entered for this session'}
          >
            {(id) => (
              <NumberInput
                id={id}
                value={session.bodyWeightKg == null ? null : units.weight(session.bodyWeightKg)}
                placeholder={autoWeight.weightKg != null ? fmtNum(units.weight(autoWeight.weightKg), 1) : ''}
                onChange={(v) => patch({ bodyWeightKg: v == null ? null : units.weightToKg(v), bodyWeightSource: v == null ? null : 'manual' })}
                min={0}
              />
            )}
          </Field>
          {editing && (
            <Field label="Status">
              {(id) => (
                <Select id={id} value={session.status} onChange={(e) => patch({ status: e.target.value as WorkoutSession['status'] })}>
                  <option value="completed">Completed</option>
                  <option value="planned">Planned (not done)</option>
                  <option value="imported-incomplete">Imported · incomplete</option>
                </Select>
              )}
            </Field>
          )}
          <Field label="Total session length (min:sec)" hint="Wall-clock time. Never counted as exercise.">
            {(id) => <DurationInput idPrefix={id} seconds={session.totalSessionSeconds} onChange={(v) => patch({ totalSessionSeconds: v })} />}
          </Field>
          <Field label="Extra rest (min:sec)" hint="Rest not captured by the timer.">
            {(id) => <DurationInput idPrefix={id} seconds={session.manualRestSeconds} onChange={(v) => patch({ manualRestSeconds: v })} />}
          </Field>
          <Field label="Waiting / equipment (min:sec)">{(id) => <DurationInput idPrefix={id} seconds={session.manualWaitingSeconds} onChange={(v) => patch({ manualWaitingSeconds: v })} />}</Field>
          <Field label="Paused / interrupted (min:sec)">{(id) => <DurationInput idPrefix={id} seconds={session.manualPausedSeconds} onChange={(v) => patch({ manualPausedSeconds: v })} />}</Field>
          <Field label="Session RPE (1–10)">{(id) => <NumberInput id={id} value={session.rpe} onChange={(v) => patch({ rpe: v })} min={1} max={10} step={0.5} />}</Field>
          <Field label="Notes" className="col-span-2 md:col-span-4 xl:col-span-6">
            {(id) => <TextInput id={id} value={session.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Sleep, energy, anything relevant" />}
          </Field>
        </div>
      </Card>

      <div className="space-y-4">
        {estimated.entries.map((entry, i) => {
          const def = findExercise(state.exercises, entry.exerciseId);
          if (!def) {
            return (
              <Notice key={entry.id} tone="warn">
                Unknown exercise “{entry.exerciseId}”. <button className="underline" onClick={() => removeEntry(i)}>Remove</button>
              </Notice>
            );
          }
          const last = lastEntryFor(state.sessions, def.id, session.id);
          return (
            <EntryEditor
              key={entry.id}
              entry={live.entries[i]}
              def={def}
              intervals={session.intervals}
              now={now}
              units={units}
              mode={mode}
              estimate={entry.estimate}
              limitations={state.profile.limitations}
              lastEntry={last?.entry ?? null}
              restSeconds={state.settings.defaultRestSeconds}
              onChange={(e) => updateEntry(i, e)}
              onRemove={() => removeEntry(i)}
              onMove={(d) => moveEntry(i, d)}
              onTimer={handleTimer}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setPicker(true)} size="lg">
          <Plus size={18} aria-hidden /> Add exercise
        </Button>
        {state.settings.quickAddExerciseIds
          .map((id) => findExercise(state.exercises, id))
          .filter((d): d is ExerciseDefinition => !!d)
          .slice(0, 6)
          .map((d) => (
            <Button key={d.id} variant="ghost" size="sm" onClick={() => addExercise(d)}>
              <Zap size={12} aria-hidden /> {d.name}
            </Button>
          ))}
      </div>

      <Card className="mt-6" title="Session summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryItem label={`Estimated kcal (${mode})`} value={fmtNum(sessionCalories(estimated, mode))} />
          <SummaryItem label="Active exercise" value={formatDuration(time.activeSeconds)} />
          <SummaryItem label="Rest + waiting + paused" value={formatDuration(time.restSeconds + time.waitingSeconds + time.pausedSeconds)} />
          <SummaryItem label="Body weight used" value={usedWeight.weightKg != null ? `${fmtNum(units.weight(usedWeight.weightKg), 1)} ${units.weightUnit}` : '—'} sub={usedWeight.source === 'assumed-latest' ? 'assumed' : undefined} />
        </div>
        {estimated.entries.some((e) => e.estimate && e.estimate.inputs.inferredActiveMinutes && Number(e.estimate.inputs.inferredActiveMinutes) > 0) && (
          <p className="mt-3 text-xs text-ink-500">
            <Badge tone="warn">Inferred</Badge> Some set durations weren't timed, so their active time is inferred from reps at {state.settings.inferredSecondsPerRep}s/rep. Inferred time is not shown in the Active total above.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => save()}>
            <Save size={16} aria-hidden /> {editing ? 'Save changes' : 'Finish & save'}
          </Button>
          <Button onClick={saveTemplate} disabled={session.entries.length === 0}>
            {templateSaved ? <CheckCircle2 size={16} aria-hidden /> : <ClipboardList size={16} aria-hidden />} {templateSaved ? 'Saved as template' : 'Save as template'}
          </Button>
        </div>
      </Card>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} exercises={state.exercises} onPick={addExercise} />

      <Modal
        open={dup != null}
        onClose={() => setDup(null)}
        title="Possible duplicate"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDup(null)}>
              Go back
            </Button>
            <Button variant="primary" onClick={() => save(true)}>
              Save anyway
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-300">
          You already have “{dup?.title}” on {formatDate(dup?.date)}
          {dup?.startTime ? ` at ${dup.startTime}` : ''} with the same exercises. Saving again would count the same work twice.
        </p>
      </Modal>
    </div>
  );
}

function SummaryItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink-100">{value}</div>
      {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

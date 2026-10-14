import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { ExerciseCategory, ExerciseDefinition, ExerciseKind, HistoricalRecord, HistoricalRecordType, LoadBasis, LoadMode } from '../domain/types';
import { MET_DB } from '../domain/met';
import { personalRecords, strengthSeries, cardioSeries } from '../domain/aggregate';
import { formatDate, formatDuration } from '../lib/dates';
import { fmtNum } from '../lib/units';
import { uid } from '../lib/id';
import { Badge, Button, Card, Field, Modal, NumberInput, PageHeader, Select, TextInput, Toggle, cx } from '../components/ui';
import { CATEGORY_LABEL } from '../components/ExercisePicker';
import { formatPR } from './Dashboard';

export const RECORD_TYPE_LABEL: Record<HistoricalRecordType, string> = {
  'estimated-max': 'Estimated max',
  'historical-set': 'Historical set',
  'planned-load': 'Planned load',
  'session-report': 'Session report',
  mention: 'Mentioned',
  aggregate: 'Aggregate total',
  'calorie-estimate-discussed': 'Old calorie estimate',
};

const BASIS_SHORT: Record<LoadBasis, string> = {
  total: 'total',
  'per-implement': 'per dumbbell/hand',
  'plates-only': 'plates only',
  stack: 'machine stack',
  bodyweight: 'bodyweight',
  unknown: 'basis unknown',
};

const KIND_LABEL: Record<ExerciseKind, string> = {
  run: 'Running',
  walk: 'Walking',
  cycle: 'Cycling',
  jumprope: 'Jump rope',
  hiit: 'Intervals',
  strength: 'Resistance',
  bodyweight: 'Bodyweight',
  isometric: 'Isometric hold',
  carry: 'Loaded carry',
  band: 'Band',
};

export function ExerciseLibrary() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ExerciseCategory | 'all'>('all');
  const [selected, setSelected] = useState<string>(() => [...state.exercises].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? '');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () =>
      state.exercises
        .filter((e) => cat === 'all' || e.category === cat)
        .filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.variations.some((v) => v.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.exercises, q, cat],
  );
  const def = state.exercises.find((e) => e.id === selected) ?? filtered[0];

  return (
    <div>
      <PageHeader
        title="Exercise Library"
        subtitle={`${state.exercises.length} exercises. Historical records are kept separate from logged workouts and never count as confirmed sets.`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> Custom exercise
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div>
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden />
              <TextInput placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search exercises" />
            </div>
            <Select value={cat} onChange={(e) => setCat(e.target.value as ExerciseCategory | 'all')} aria-label="Category">
              <option value="all">All categories</option>
              {(['cardio', 'conditioning', 'bodyweight', 'strength'] as ExerciseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1" aria-label="Exercises">
            {filtered.map((e) => {
              const n = state.historicalRecords.filter((r) => r.exerciseId === e.id).length;
              const logged = state.sessions.filter((s) => s.entries.some((x) => x.exerciseId === e.id)).length;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e.id)}
                    aria-current={def?.id === e.id}
                    className={cx('w-full rounded-xl border px-3 py-2.5 text-left', def?.id === e.id ? 'border-lime-700/60 bg-ink-800' : 'border-transparent hover:bg-ink-900')}
                  >
                    <div className="text-sm font-medium text-ink-100">{e.name}</div>
                    <div className="text-[11px] text-ink-500">
                      {CATEGORY_LABEL[e.category]} · {logged} logged · {n} historical
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {def && <ExerciseDetail def={def} />}
      </div>
      <CustomExerciseModal open={adding} onClose={() => setAdding(false)} onCreated={(id) => setSelected(id)} />
    </div>
  );
}

function ExerciseDetail({ def }: { def: ExerciseDefinition }) {
  const { state, units, upsertHistorical, deleteHistorical, deleteExercise } = useStore();
  const [addRec, setAddRec] = useState(false);
  const records = state.historicalRecords.filter((r) => r.exerciseId === def.id);
  const limits = state.profile.limitations.filter((l) => l.active && l.appliesToKinds.includes(def.kind));
  const prs = personalRecords(state.sessions, state.exercises).filter((p) => p.exerciseId === def.id);
  const met = MET_DB[def.metKey];
  const isCardio = ['run', 'walk', 'cycle', 'jumprope', 'hiit'].includes(def.kind);
  const strength = !isCardio ? strengthSeries(state.sessions, def.id).slice(-6).reverse() : [];
  const cardio = isCardio ? cardioSeries(state.sessions, [def.id]).slice(-6).reverse() : [];
  const undatedLogged = state.sessions.filter((s) => !s.date && s.entries.some((e) => e.exerciseId === def.id));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{def.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge>{CATEGORY_LABEL[def.category]}</Badge>
              <Badge>{KIND_LABEL[def.kind]}</Badge>
              {def.unilateral && <Badge>Per-leg reps</Badge>}
              {def.isCustom && <Badge tone="info">Custom</Badge>}
            </div>
          </div>
          {def.isCustom && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!deleteExercise(def.id)) alert('This exercise is used by workouts or historical records and cannot be deleted.');
              }}
            >
              <Trash2 size={14} aria-hidden /> Delete
            </Button>
          )}
        </div>
        {def.description && <p className="mt-3 text-sm text-ink-400">{def.description}</p>}
        {limits.map((l) => (
          <div key={l.id} className="mt-3 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <span className="font-medium">{l.label}.</span> {l.notes}
            </div>
          </div>
        ))}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-ink-400">Variations</div>
            <div className="flex flex-wrap gap-1.5">{def.variations.map((v) => <Badge key={v}>{v}</Badge>)}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-ink-400">Equipment</div>
            <div className="flex flex-wrap gap-1.5">{def.equipment.map((v) => <Badge key={v}>{v}</Badge>)}</div>
          </div>
        </div>
      </Card>

      <Card title="Historical records" subtitle="Imported or remembered information. Unconfirmed records never count as workouts or PRs." actions={<Button size="sm" onClick={() => setAddRec(true)}><Plus size={14} aria-hidden /> Add</Button>}>
        {records.length === 0 ? (
          <p className="text-sm text-ink-500">None.</p>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-800 bg-ink-850 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={r.type === 'planned-load' ? 'neutral' : r.type === 'estimated-max' ? 'info' : r.type === 'calorie-estimate-discussed' ? 'warn' : 'neutral'}>{RECORD_TYPE_LABEL[r.type]}</Badge>
                    {r.confirmed ? (
                      <Badge tone="lime" icon={<CheckCircle2 size={12} aria-hidden />}>Confirmed</Badge>
                    ) : (
                      <Badge tone="warn" icon={<CircleHelp size={12} aria-hidden />}>Unconfirmed</Badge>
                    )}
                    {r.loadBasis && r.loadBasis !== 'total' && <Badge>{BASIS_SHORT[r.loadBasis]}</Badge>}
                  </div>
                  <div className="mt-1.5 text-sm text-ink-100">{r.description}</div>
                  {r.notes && <div className="mt-0.5 text-xs text-ink-500">{r.notes}</div>}
                  <div className="mt-0.5 text-[11px] text-ink-500">{r.date ? formatDate(r.date) : 'Date unknown'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle checked={r.confirmed} onChange={(v) => upsertHistorical({ ...r, confirmed: v })} label="Confirmed" />
                  <Button size="sm" variant="ghost" aria-label="Delete record" onClick={() => confirm('Delete this historical record?') && deleteHistorical(r.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Recent logged sessions" subtitle={undatedLogged.length ? `Plus ${undatedLogged.length} undated import(s)` : undefined}>
          {strength.length === 0 && cardio.length === 0 ? (
            <p className="text-sm text-ink-500">No dated sessions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="tabular-nums">
                {strength.map((r) => (
                  <tr key={r.sessionId} className="border-t border-ink-800 first:border-0">
                    <td className="py-1.5 text-ink-400">{formatDate(r.date)}</td>
                    <td className="py-1.5 text-right">
                      {r.sets} sets · {r.totalReps} reps
                    </td>
                    <td className="py-1.5 text-right text-ink-300">{r.bestLoadKg ? `${fmtNum(units.weight(r.bestLoadKg), 1)} ${units.weightUnit} × ${r.bestReps}` : '—'}</td>
                  </tr>
                ))}
                {cardio.map((r) => (
                  <tr key={r.sessionId} className="border-t border-ink-800 first:border-0">
                    <td className="py-1.5 text-ink-400">{formatDate(r.date)}</td>
                    <td className="py-1.5 text-right">{r.distanceKm != null ? `${fmtNum(units.distance(r.distanceKm), 2)} ${units.distanceUnit}` : '—'}</td>
                    <td className="py-1.5 text-right text-ink-300">{formatDuration(r.activeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Personal records" subtitle="Logged workouts only">
          {prs.length === 0 ? (
            <p className="text-sm text-ink-500">No PRs yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {prs.map((p) => (
                <li key={`${p.type}-${p.machineId ?? ''}`} className="flex justify-between gap-2">
                  <span className="text-ink-400">
                    {p.label}
                    {p.machineId ? ` · ${p.machineId}` : ''}
                  </span>
                  <span className="font-medium">{formatPR(p.type, p.value, units)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Calorie model" subtitle="How this exercise is estimated">
        <p className="mb-3 text-sm text-ink-400">
          {def.kind === 'run' || def.kind === 'walk'
            ? 'With speed (or distance + time), the ACSM metabolic equation is used, including incline. Otherwise heart rate (Keytel) if available, else the MET values below.'
            : def.kind === 'cycle'
              ? 'Power data is used first (work ÷ efficiency). Outdoor rides with speed use speed-banded METs; stationary rides without power use the intensity you choose.'
              : def.kind === 'jumprope'
                ? 'Cadence selects the Compendium pace band (<100, 100–120, >120 skips/min). Only active skipping time counts.'
                : def.kind === 'hiit'
                  ? 'Only completed work intervals count; rest intervals are excluded. Heart rate improves the estimate.'
                  : 'Whole-workout resistance-training METs applied to active set time only. Per-set calories cannot be measured from load and reps; untimed sets infer duration from reps and are flagged low-confidence.'}
        </p>
        {met && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-500">
              <tr>
                <th className="py-1 font-medium">Intensity</th>
                <th className="py-1 font-medium">MET</th>
                <th className="py-1 font-medium">Compendium activity</th>
              </tr>
            </thead>
            <tbody>
              {(['light', 'moderate', 'vigorous'] as const).map((k) => (
                <tr key={k} className="border-t border-ink-800">
                  <td className="py-1.5 capitalize text-ink-300">{k}</td>
                  <td className="py-1.5 tabular-nums">{met[k].met}</td>
                  <td className="py-1.5 text-xs text-ink-400">
                    {met[k].code} · {met[k].description}
                    {met[k].proxy && <span className="text-amber-300/80"> (proxy: {met[k].proxy})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddRecordModal open={addRec} onClose={() => setAddRec(false)} exerciseId={def.id} onSave={upsertHistorical} />
    </div>
  );
}

function AddRecordModal({ open, onClose, exerciseId, onSave }: { open: boolean; onClose: () => void; exerciseId: string; onSave: (r: HistoricalRecord) => void }) {
  const { units } = useStore();
  const [type, setType] = useState<HistoricalRecordType>('historical-set');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [load, setLoad] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);
  const [basis, setBasis] = useState<LoadBasis>('total');
  const [notes, setNotes] = useState('');
  const submit = () => {
    if (!desc.trim()) return;
    onSave({
      id: uid(),
      exerciseId,
      type,
      description: desc.trim(),
      date: date || null,
      datePrecision: date ? 'day' : 'unknown',
      loadKg: load == null ? null : units.weightToKg(load),
      reps,
      loadBasis: basis,
      confirmed: false,
      source: 'manual',
      notes: notes || undefined,
    });
    setDesc('');
    setLoad(null);
    setReps(null);
    setNotes('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add historical record" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!desc.trim()}>Add</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as HistoricalRecordType)}>
              {(Object.keys(RECORD_TYPE_LABEL) as HistoricalRecordType[]).map((t) => (
                <option key={t} value={t}>
                  {RECORD_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date (if known)">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Description" className="col-span-2">
          {(id) => <TextInput id={id} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. 60 kg × 5 reps" />}
        </Field>
        <Field label={`Load (${units.weightUnit})`}>{(id) => <NumberInput id={id} value={load} onChange={setLoad} min={0} />}</Field>
        <Field label="Reps">{(id) => <NumberInput id={id} value={reps} onChange={setReps} min={0} step={1} />}</Field>
        <Field label="Load basis" className="col-span-2">
          {(id) => (
            <Select id={id} value={basis} onChange={(e) => setBasis(e.target.value as LoadBasis)}>
              {(Object.keys(BASIS_SHORT) as LoadBasis[]).map((b) => (
                <option key={b} value={b}>
                  {BASIS_SHORT[b]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notes" className="col-span-2">{(id) => <TextInput id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

function CustomExerciseModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { state, upsertExercise } = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('strength');
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [loadMode, setLoadMode] = useState<LoadMode>('barbell');
  const [metKey, setMetKey] = useState('resistance-training');
  const [variations, setVariations] = useState('');
  const [equipment, setEquipment] = useState('');
  const exists = state.exercises.some((e) => e.name.toLowerCase() === name.trim().toLowerCase());
  const submit = () => {
    if (!name.trim() || exists) return;
    const id = `custom-${uid().slice(0, 8)}`;
    upsertExercise({
      id,
      name: name.trim(),
      category,
      kind,
      defaultLoadMode: loadMode,
      metKey,
      variations: variations.split(',').map((s) => s.trim()).filter(Boolean),
      equipment: equipment.split(',').map((s) => s.trim()).filter(Boolean),
      isCustom: true,
      unilateral: false,
    });
    onCreated(id);
    setName('');
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Custom exercise" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={!name.trim() || exists}>Create</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2" hint={exists ? 'An exercise with this name already exists.' : undefined}>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
              {(['cardio', 'conditioning', 'bodyweight', 'strength'] as ExerciseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Logging type" hint="Decides the form and calorie model.">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
              {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Default load">
          {(id) => (
            <Select id={id} value={loadMode} onChange={(e) => setLoadMode(e.target.value as LoadMode)}>
              {(['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'none'] as LoadMode[]).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="MET table">
          {(id) => (
            <Select id={id} value={metKey} onChange={(e) => setMetKey(e.target.value)}>
              {Object.keys(MET_DB).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Variations (comma-separated)" className="col-span-2">{(id) => <TextInput id={id} value={variations} onChange={(e) => setVariations(e.target.value)} />}</Field>
        <Field label="Equipment (comma-separated)" className="col-span-2">{(id) => <TextInput id={id} value={equipment} onChange={(e) => setEquipment(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

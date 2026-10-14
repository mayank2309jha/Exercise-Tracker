import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ExerciseCategory, ExerciseDefinition } from '../domain/types';
import { Modal, TextInput } from './ui';

export const CATEGORY_LABEL: Record<ExerciseCategory | 'mixed', string> = {
  cardio: 'Cardio & endurance',
  bodyweight: 'Bodyweight',
  conditioning: 'Conditioning',
  strength: 'Barbell, dumbbell & machine',
  mixed: 'Mixed',
};

export function ExercisePicker({ open, onClose, exercises, onPick }: { open: boolean; onClose: () => void; exercises: ExerciseDefinition[]; onPick: (e: ExerciseDefinition) => void }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const match = exercises.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.variations.some((v) => v.toLowerCase().includes(q.toLowerCase())));
    const order: ExerciseCategory[] = ['cardio', 'conditioning', 'bodyweight', 'strength'];
    return order.map((c) => ({ c, items: match.filter((e) => e.category === c).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.items.length);
  }, [exercises, q]);

  return (
    <Modal open={open} onClose={onClose} title="Add exercise">
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden />
        <TextInput autoFocus placeholder="Search exercises or variations" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search exercises" />
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.c}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">{CATEGORY_LABEL[g.c]}</h3>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {g.items.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onPick(e);
                    setQ('');
                    onClose();
                  }}
                  className="rounded-xl border border-ink-800 bg-ink-850 px-3 py-2.5 text-left text-sm hover:border-lime-700/60 hover:bg-ink-800"
                >
                  <div className="font-medium text-ink-100">{e.name}</div>
                  <div className="truncate text-xs text-ink-500">{e.variations.slice(0, 3).join(' · ')}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-ink-500">No exercises match. Add a custom exercise in the Exercise Library.</p>}
      </div>
    </Modal>
  );
}

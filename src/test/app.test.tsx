import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { STORAGE_KEY } from '../data/persistence';
import { createSeedState } from '../data/seed';
import type { AppState } from '../domain/types';

function go(hash: string) {
  window.location.hash = hash;
}

function stored(): AppState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!);
}

beforeEach(() => {
  localStorage.clear();
  go('#/');
});
afterEach(() => cleanup());

describe('every page renders with the seeded data', () => {
  const pages: [string, RegExp][] = [
    ['#/', /^Dashboard$/],
    ['#/log', /^Log Workout$/],
    ['#/library', /^Exercise Library$/],
    ['#/history', /^Workout History$/],
    ['#/strength', /^Strength Progress$/],
    ['#/cardio', /^Cardio Analytics$/],
    ['#/body', /^Body Measurements$/],
    ['#/goals', /^Goals$/],
    ['#/settings', /^Settings & Profile$/],
  ];
  for (const [hash, title] of pages) {
    it(`renders ${hash}`, () => {
      go(hash);
      render(<App />);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    });
  }
});

describe('workflows', () => {
  it('logs a strength workout end to end and persists it', () => {
    go('#/log');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Start live workout/ }));
    // Add an exercise via the picker.
    fireEvent.click(screen.getAllByRole('button', { name: /Add exercise/ })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Add exercise' });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Bench press/ }));

    // Fill set 1: reps 5, load 40, active 30s.
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Load \(kg\)/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Active (s)'), { target: { value: '30' } });

    // Draft is saved continuously.
    expect(stored().draft?.entries[0].sets[0].reps).toBe(5);

    fireEvent.click(screen.getAllByRole('button', { name: /Finish & save/ })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Workout History' })).toBeInTheDocument();

    const saved = stored().sessions.find((s) => s.source === 'manual')!;
    expect(saved.status).toBe('completed');
    expect(saved.bodyWeightKg).toBe(83.2);
    const est = saved.entries[0].estimate!;
    expect(est.activeMinutes).toBeCloseTo(0.5);
    // Resistance-training moderate MET 5.0 × 3.5 × 83.2 / 200 × 0.5
    expect(est.gross).toBeCloseTo((5 * 3.5 * 83.2) / 200 * 0.5, 5);
    expect(stored().draft).toBeNull();
  });

  it('blocks saving an empty workout with a clear validation error', () => {
    go('#/log');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Start live workout/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /Finish & save/ })[0]);
    expect(screen.getByText('Add at least one exercise.')).toBeInTheDocument();
  });

  it('data survives a reload (remount reading from localStorage)', () => {
    go('#/body');
    const first = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Measurement$/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Weight/), { target: { value: '82.4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    first.unmount();

    render(<App />);
    const ms = stored().measurements;
    expect(ms.some((m) => m.weightKg === 82.4)).toBe(true);
    // Older measurements untouched.
    expect(ms.find((m) => m.date === '2026-10-06')?.weightKg).toBe(83.2);
    expect(ms.find((m) => m.date === '2026-09-23')?.weightKg).toBe(84.5);
  });

  it('switching to net calories is reflected in settings and the dashboard', () => {
    go('#/settings');
    const r = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Net (above resting)' }));
    expect(stored().settings.calorieDisplay).toBe('net');
    r.unmount();
    go('#/');
    render(<App />);
    expect(screen.getByText(/calories shown as net/)).toBeInTheDocument();
  });

  it('imported gym session asks clarifying questions when edited', () => {
    go('#/log/hist-gym-1h');
    render(<App />);
    expect(screen.getByText(/This imported session has missing details/)).toBeInTheDocument();
    expect(screen.getByText(/How many sets were the 15 deadlift reps/)).toBeInTheDocument();
  });

  it('shows the shin-pain warning when logging running', () => {
    go('#/log');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Running$/ }));
    expect(screen.getAllByText(/Shin pain associated with running/).length).toBeGreaterThan(0);
  });

  it('a corrupt store falls back safely with a visible message', () => {
    localStorage.setItem(STORAGE_KEY, '{"broken":');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/unreadable/);
  });

  it('renders with an injected state', () => {
    const s = createSeedState();
    s.profile.name = 'Test';
    vi.stubGlobal('confirm', () => true);
    go('#/settings');
    render(<App initialState={s} />);
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

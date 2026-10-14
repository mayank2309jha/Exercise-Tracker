import type { AppState } from '../domain/types';
import { createSeedState, SCHEMA_VERSION } from './seed';
import { parseState } from './schema';

export const STORAGE_KEY = 'exercise-tracker:v1';
const BACKUP_KEY = 'exercise-tracker:corrupt-backup';

export interface LoadResult {
  state: AppState;
  /** Set when stored data could not be read and the app fell back to seed data. */
  error: string | null;
  fresh: boolean;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Upgrade older stored shapes. Add a case per schema version bump. */
export function migrate(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !('schemaVersion' in raw)) {
    return { ...(raw as object), schemaVersion: SCHEMA_VERSION };
  }
  return raw;
}

export function loadState(): LoadResult {
  const ls = storage();
  const text = ls?.getItem(STORAGE_KEY) ?? null;
  if (!text) return { state: createSeedState(), error: null, fresh: true };
  try {
    const parsed = parseState(migrate(JSON.parse(text)));
    if (parsed.ok) return { state: parsed.state, error: null, fresh: false };
    ls?.setItem(BACKUP_KEY, text);
    return { state: createSeedState(), error: `Saved data failed validation and was backed up (${parsed.errors[0]}). Starting from the default profile.`, fresh: true };
  } catch {
    ls?.setItem(BACKUP_KEY, text);
    return { state: createSeedState(), error: 'Saved data was unreadable and was backed up. Starting from the default profile.', fresh: true };
  }
}

export function saveState(state: AppState): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

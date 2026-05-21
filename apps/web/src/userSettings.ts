import { useSyncExternalStore } from 'react';

/**
 * User-level settings that persist across projects and live in localStorage.
 * These are intentionally separate from project-level `EditorSettings` — they
 * reflect personal UI preferences (units, themes, etc.) rather than per-game
 * configuration.
 */
export type UserLengthUnit = 'mm' | 'inches';

export interface UserSettings {
  /** Display unit for physical dimensions in every editor surface. */
  preferredUnits: UserLengthUnit;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  // Default to inches — our primary supplier catalog expresses board/tile
  // sizes in inches (18×18, 24×24…), so that matches the dropdown labels.
  preferredUnits: 'inches',
};

const STORAGE_KEY = 'turnbased.user.settings';

function loadFromStorage(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT_USER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

/** In-memory snapshot. Kept in sync with localStorage + cross-tab storage events. */
let currentSnapshot: UserSettings = loadFromStorage();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

// Sync across tabs: if another tab writes new settings, pick them up.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    currentSnapshot = loadFromStorage();
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): UserSettings {
  return currentSnapshot;
}

/** Mutate user settings via an updater function. Persists to localStorage. */
export function updateUserSettings(updater: (prev: UserSettings) => UserSettings): void {
  const next = updater(currentSnapshot);
  if (next === currentSnapshot) return;
  currentSnapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable (private mode, quota, etc.) — fail soft.
  }
  emit();
}

/** Read the current user settings without subscribing to changes. */
export function getUserSettings(): UserSettings {
  return currentSnapshot;
}

/** React hook: subscribes to user settings changes and re-renders on update. */
export function useUserSettings(): UserSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// The model the student picked — in Settings or from the chat bar.
//
// Kept in localStorage alongside the other global preferences (language,
// level, theme) rather than on the server: this app is single-user and the
// choice is a per-device preference, not part of a conversation's saved
// configuration. Switching models never starts a new chat; the current
// conversation simply continues with the new model.
//
// Two places can change it now, so it is a tiny store with subscribers: both
// the chat bar and the Settings page read the same value and re-render when
// either one changes it.

const STORAGE_KEY = "tutor.model";

/** Sentinel meaning "no preference — let the server pick". */
export const AUTO_MODEL = "auto";

const listeners = new Set<() => void>();
let current: string | null = null;

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || AUTO_MODEL;
  } catch {
    return AUTO_MODEL;
  }
}

export function getPreferredModel(): string {
  if (current === null) current = read();
  return current;
}

export function setPreferredModel(model: string): void {
  current = model;
  try {
    if (model === AUTO_MODEL) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, model);
    }
  } catch {
    // Storage unavailable (private mode): the choice just won't persist.
  }
  for (const listener of listeners) listener();
}

export function subscribeToPreferredModel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The model the student picked in Settings.
//
// Kept in localStorage alongside the other global preferences (language, level,
// theme) rather than on the server: this app is single-user and the choice is a
// per-device preference, not part of a conversation's saved configuration.

const STORAGE_KEY = "tutor.model";

/** Sentinel meaning "no preference — let the server pick". */
export const AUTO_MODEL = "auto";

export function getPreferredModel(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || AUTO_MODEL;
  } catch {
    return AUTO_MODEL;
  }
}

export function setPreferredModel(model: string): void {
  try {
    if (model === AUTO_MODEL) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, model);
    }
  } catch {
    // Storage unavailable (private mode): the choice just won't persist.
  }
}

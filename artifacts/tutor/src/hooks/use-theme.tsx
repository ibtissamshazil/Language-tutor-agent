import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Theme handling for the tutor.
//
// Three modes are offered: an explicit "light" / "dark" choice and "system",
// which follows the OS preference live. The resolved theme is applied as the
// `dark` class on <html> (the Tailwind `dark` variant hooks off that) plus the
// native `color-scheme` property so scrollbars, form controls and the browser
// chrome match the app instead of flashing white during long study sessions.
//
// The same storage key is read by the inline boot script in `index.html`, which
// applies the theme BEFORE first paint so there is never a white flash.

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tutor.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyResolved(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

type ThemeContextValue = {
  /** What the learner picked: an explicit theme, or "system" to follow the OS. */
  mode: ThemeMode;
  /** The theme actually in effect right now. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Flip between light and dark, leaving "system" behind. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStoredMode()));

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for
      // this session.
    }
  }, []);

  // Apply the resolved theme whenever the mode changes.
  useEffect(() => {
    const next = resolve(mode);
    setResolved(next);
    applyResolved(next);
  }, [mode]);

  // While on "system", follow the OS as it changes (e.g. a scheduled night
  // switch mid-session) without requiring a reload.
  useEffect(() => {
    if (mode !== "system" || !window.matchMedia) return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const next: ResolvedTheme = media.matches ? "dark" : "light";
      setResolved(next);
      applyResolved(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode(resolve(mode) === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getLanguage,
  getLevel,
  isLanguageCode,
  isLevelCode,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LEVEL_CODE,
  type LanguageDef,
  type LevelDef,
} from "@workspace/languages";

const STORAGE_KEY = "tutor.activeLanguage";
const LEVEL_STORAGE_KEY = "tutor.activeLevel";

interface LanguageContextValue {
  /** The active language code chosen in the global selector. */
  code: string;
  /** The resolved active language definition. */
  language: LanguageDef;
  /** Change the active language (persisted to localStorage). */
  setCode: (code: string) => void;
  /** The active expertise level code. */
  level: string;
  /** The resolved active level definition. */
  levelDef: LevelDef;
  /** Change the active level (persisted to localStorage). */
  setLevel: (level: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStored(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE_CODE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE_CODE;
}

function readStoredLevel(): string {
  if (typeof window === "undefined") return DEFAULT_LEVEL_CODE;
  const stored = window.localStorage.getItem(LEVEL_STORAGE_KEY);
  return stored && isLevelCode(stored) ? stored : DEFAULT_LEVEL_CODE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<string>(readStored);
  const [level, setLevelState] = useState<string>(readStoredLevel);

  const setCode = useCallback((next: string) => {
    if (!isLanguageCode(next)) return;
    setCodeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const setLevel = useCallback((next: string) => {
    if (!isLevelCode(next)) return;
    setLevelState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LEVEL_STORAGE_KEY, next);
    }
  }, []);

  const value: LanguageContextValue = {
    code,
    language: getLanguage(code),
    setCode,
    level,
    levelDef: getLevel(level),
    setLevel,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Access the global active language and level selection. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

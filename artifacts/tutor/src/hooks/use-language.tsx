import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getLanguage,
  isLanguageCode,
  DEFAULT_LANGUAGE_CODE,
  type LanguageDef,
} from "@workspace/languages";

const STORAGE_KEY = "tutor.activeLanguage";

interface LanguageContextValue {
  /** The active language code chosen in the global selector. */
  code: string;
  /** The resolved active language definition. */
  language: LanguageDef;
  /** Change the active language (persisted to localStorage). */
  setCode: (code: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStored(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE_CODE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE_CODE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState<string>(readStored);

  const setCode = useCallback((next: string) => {
    if (!isLanguageCode(next)) return;
    setCodeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const value: LanguageContextValue = {
    code,
    language: getLanguage(code),
    setCode,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Access the global active language selection. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

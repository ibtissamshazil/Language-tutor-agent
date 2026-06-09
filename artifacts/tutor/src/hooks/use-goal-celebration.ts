import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  useGetProgressToday,
  getGetProgressTodayQueryKey,
} from "@workspace/api-client-react";
import { getLanguage } from "@workspace/languages";
import { toast } from "@/hooks/use-toast";

function fireConfetti() {
  const fire = (opts: confetti.Options) =>
    confetti({ disableForReducedMotion: true, scalar: 0.9, ...opts });
  fire({ particleCount: 60, spread: 60, startVelocity: 35, origin: { x: 0.5, y: 0.7 } });
  setTimeout(
    () => fire({ particleCount: 35, spread: 80, startVelocity: 30, origin: { x: 0.2, y: 0.75 } }),
    140,
  );
  setTimeout(
    () => fire({ particleCount: 35, spread: 80, startVelocity: 30, origin: { x: 0.8, y: 0.75 } }),
    280,
  );
}

function celebrate(language: string) {
  const name = getLanguage(language)?.name ?? "";
  fireConfetti();
  const { dismiss } = toast({
    title: "Daily goal reached",
    description: name
      ? `You hit today's ${name} goal. Great work — rest or keep going.`
      : "You hit today's goal. Great work — rest or keep going.",
  });
  setTimeout(() => dismiss(), 5000);
}

/**
 * Watches today's progress for a language and fires a one-time confetti burst
 * plus an auto-dismissing toast the moment the daily goal is reached. Tracks the
 * previous `achieved` state per language so it only celebrates on the
 * not-reached -> reached transition (never on first load or language switch).
 */
export function useGoalCelebration(language: string) {
  const params = { language };
  const { data } = useGetProgressToday(params, {
    query: {
      queryKey: getGetProgressTodayQueryKey(params),
      refetchOnWindowFocus: true,
    },
  });
  const achieved = data?.achieved ?? false;
  const prevByLang = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    const prev = prevByLang.current[language];
    if (prev === undefined) {
      prevByLang.current[language] = achieved;
      return;
    }
    if (prev === false && achieved === true) {
      celebrate(language);
    }
    prevByLang.current[language] = achieved;
  }, [achieved, data, language]);
}

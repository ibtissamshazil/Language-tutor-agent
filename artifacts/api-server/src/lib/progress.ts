// Daily learning-progress scoring.
//
// Progress is derived from the target-language terms the tutor has actually
// taught today. The tutor wraps every taught term in the universal markup
// ([[native|translit|english]]); both this scorer and the frontend renderer
// parse that SAME markup (via @workspace/languages) so they stay in lockstep
// and so scoring works for every language — Latin-script ones included, which a
// unicode-range scan could never distinguish from the surrounding English.
//
// Each taught term is worth points equal to the number of words in its native
// form (floor of 1), so a multi-word phrase is worth more than a single word
// while a single, space-less CJK term still scores. Once the running total
// reaches DAILY_TARGET the day's goal is met.

import { countLearnings } from "@workspace/languages";

export const DAILY_TARGET = 60;

export interface DailyProgress {
  points: number;
  target: number;
  percent: number;
  achieved: boolean;
  phrasesLearned: number;
}

/** Aggregate today's learnings across many assistant message contents. */
export function summarizeProgress(contents: string[]): DailyProgress {
  let points = 0;
  let phrasesLearned = 0;
  for (const content of contents) {
    const { phrases, points: p } = countLearnings(content);
    points += p;
    phrasesLearned += phrases;
  }
  const percent = Math.min(100, Math.round((points / DAILY_TARGET) * 100));
  return {
    points,
    target: DAILY_TARGET,
    percent,
    achieved: points >= DAILY_TARGET,
    phrasesLearned,
  };
}

/** Start of the current day (server local time) as a Date. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

import { Router, type IRouter } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, messages, conversations } from "@workspace/db";
import {
  countLearnings,
  getLanguage,
  parseTaughtTerms,
} from "@workspace/languages";
import { GetProgressHistoryResponse } from "@workspace/api-zod";
import { startOfToday, summarizeProgress } from "../lib/progress";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

// Today's learning progress for a single language (single-user app). The
// language is taken from the `language` query param (defaulting to the default
// language); progress is scoped to assistant messages in conversations of that
// language so each language has its own daily goal.
router.get("/today", async (req, res) => {
  const language = getLanguage(
    typeof req.query.language === "string" ? req.query.language : undefined,
  );

  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.role, "assistant"),
        gte(messages.createdAt, startOfToday()),
        eq(conversations.language, language.code),
      ),
    );

  res.json({ ...summarizeProgress(rows.map((r) => r.content)), language: language.code });
});

// Cumulative progress and a small set of recent, distinct terms power the
// chat's personalized follow-up prompts. Terms use the same universal markup
// as daily scoring and vocabulary rendering.
router.get("/history", async (req, res) => {
  const language = getLanguage(
    typeof req.query.language === "string" ? req.query.language : undefined,
  );

  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(messages.role, "assistant"),
        eq(conversations.language, language.code),
      ),
    )
    .orderBy(desc(messages.createdAt));

  let totalWords = 0;
  const reviewTerms = new Map<
    string,
    { native: string; transliteration: string; english: string }
  >();

  for (const { content } of rows) {
    totalWords += countLearnings(content).points;
    for (const term of parseTaughtTerms(content)) {
      const key = term.native.trim().toLocaleLowerCase();
      if (!reviewTerms.has(key)) {
        reviewTerms.set(key, {
          native: term.native,
          transliteration: term.transliteration,
          english: term.english,
        });
      }
    }
  }

  res.json(
    GetProgressHistoryResponse.parse({
      language: language.code,
      hasHistory: rows.length > 0,
      totalWords,
      reviewTerms: [...reviewTerms.values()].slice(0, 40),
    }),
  );
});

export default router;

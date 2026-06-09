import { Router, type IRouter } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, messages, conversations } from "@workspace/db";
import { getLanguage } from "@workspace/languages";
import { startOfToday, summarizeProgress } from "../lib/progress";

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

export default router;

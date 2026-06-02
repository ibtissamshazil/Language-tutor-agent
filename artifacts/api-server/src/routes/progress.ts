import { Router, type IRouter } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, messages } from "@workspace/db";
import { startOfToday, summarizeProgress } from "../lib/progress";

const router: IRouter = Router();

// Today's learning progress across all conversations (single-user app).
router.get("/today", async (_req, res) => {
  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .where(
      and(eq(messages.role, "assistant"), gte(messages.createdAt, startOfToday())),
    );

  res.json(summarizeProgress(rows.map((r) => r.content)));
});

export default router;

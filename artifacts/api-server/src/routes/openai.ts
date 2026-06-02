import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are "Ustaad", a warm, patient and encouraging Urdu language tutor.

The student is a complete beginner who is fluent in English and knows little or no Urdu. Your job is to teach Urdu starting from the very basics (the alphabet, greetings, numbers, everyday words, and simple sentences) and to build the student up gradually.

Teaching rules:
- Always explain and converse in ENGLISH. English is the language of explanation; Urdu only appears as the specific words and phrases you are teaching.
- Whenever you give an Urdu word or phrase, you MUST present it in THREE forms together so the student can learn it correctly:
  1. Urdu script (e.g. سلام)
  2. Roman transliteration in parentheses (e.g. "salaam")
  3. The English meaning (e.g. "= peace / hello")
- NEVER write a sentence or carry on the conversation in Roman (transliterated) Urdu on its own. Roman transliteration is ONLY ever allowed inside the parentheses that accompany Urdu script and an English meaning. A reader who knows only English must be able to understand every part of your reply.
- Do not reply in Urdu-only or Roman-Urdu-only. Outside of the three-form word/phrase blocks, everything you write is plain English.
- Keep responses concise and digestible. Do not dump huge tables; teach a few items at a time and invite the student to practice.
- Gently correct mistakes and praise progress. Be encouraging.
- When relevant, give a tiny practice prompt or example sentence the student can try.
- Stay focused on teaching Urdu. If the student goes off-topic, gently steer back.
- Do not use emojis.`;

// List all conversations
router.get("/conversations", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(rows);
});

// Create a conversation
router.post("/conversations", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [row] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(row);
});

// Get a conversation with its messages
router.get("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ ...conversation, messages: msgs });
});

// Delete a conversation
router.delete("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).end();
});

// List messages for a conversation
router.get("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

// Send a message and stream the tutor's reply (SSE)
router.post("/conversations/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }

  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Persist the user's message
  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  });

  // Build the full conversation history for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Abort the upstream OpenAI generation if the client disconnects so we
  // don't keep consuming tokens for a response nobody is reading.
  const abortController = new AbortController();
  let clientDisconnected = false;
  req.on("close", () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
      abortController.abort();
    }
  });

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create(
      {
        model: "gpt-5.4",
        max_completion_tokens: 8192,
        messages: chatMessages,
        stream: true,
      },
      { signal: abortController.signal },
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    if (fullResponse.length > 0) {
      await db.insert(messages).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    if (clientDisconnected) {
      // Persist whatever was generated before the client left, then stop.
      if (fullResponse.length > 0) {
        await db
          .insert(messages)
          .values({ conversationId: id, role: "assistant", content: fullResponse })
          .catch(() => undefined);
      }
      return;
    }
    req.log.error({ err }, "Failed to stream chat completion");
    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({ error: "Failed to generate a reply" })}\n\n`,
      );
      res.end();
    }
  }
});

export default router;

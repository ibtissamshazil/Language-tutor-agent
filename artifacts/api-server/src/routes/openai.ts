import { Router, type IRouter } from "express";
import { eq, asc, desc, and, gte } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  UpdateOpenaiConversationBody,
} from "@workspace/api-zod";
import {
  getLanguage,
  getLevel,
  isLanguageCode,
  isLevelCode,
  type LanguageDef,
  type LevelDef,
} from "@workspace/languages";
import { llm, resolveModel, usingOpenRouter } from "../lib/llm";
import { startOfToday, summarizeProgress } from "../lib/progress";

const router: IRouter = Router();

// Build the tutor system prompt for a specific target language. The taught-term
// markup ([[native|transliteration|english]]) is what the progress scorer and
// the frontend renderer both rely on, so the instruction to use it is strict.
function buildSystemPrompt(language: LanguageDef, level: LevelDef): string {
  const { name, promptScriptNote, usesTransliteration, markupExample } = language;
  const translitRule = usesTransliteration
    ? `transliteration = a roman-letter pronunciation (REQUIRED for ${name})`
    : `transliteration = leave this field EMPTY for ${name} (it uses the Latin alphabet, so no transliteration is needed)`;

  return `You are a warm, patient and encouraging ${name} language tutor.

The student is fluent in English and is learning ${name}. Their expertise level is ${level.name}: ${level.promptNote} Adapt the depth, pace and amount of target-language usage to this level. ${name} is ${promptScriptNote}.

Teaching rules:
- Always explain and converse in ENGLISH. English is the language of explanation; ${name} only appears as the specific words and phrases you are teaching.
- Whenever you teach a ${name} word or phrase, you MUST wrap it in this EXACT machine-readable markup so the app can display and track it:
  [[native|transliteration|english]]
  where:
  - native = the word or phrase written in ${name} (${promptScriptNote})
  - ${translitRule}
  - english = the English meaning
  The three fields are separated by single pipe (|) characters. A field must NOT itself contain a "|" or a "]" character. Example: ${markupExample}
- Use the [[...]] markup EVERY time you present an individual ${name} word or phrase — never write a ${name} word or phrase outside a markup block.
- After you have taught the individual words/phrases (as [[...]] terms), write out ONE complete example SENTENCE that puts them together, using this SEPARATE sentence block:
  {{native|transliteration|english}}
  where native = the full sentence in ${name} (${promptScriptNote}), ${usesTransliteration ? `transliteration = the full roman-letter pronunciation of the whole sentence` : `transliteration = leave EMPTY for ${name}`}, and english = the full English meaning. Use single pipe (|) separators; a field must NOT contain "|" or "}". The app renders this block as three lines — native, transliteration, English — one under the other. Example sentence block: {{${markupExample.replace(/^\[\[/, "").replace(/\]\]$/, "")}}}
  Use {{...}} ONLY for a full example sentence, and [[...]] for the individual words/phrases you teach. Do not put a whole sentence inside [[...]].
  In EVERY reply where you teach at least one ${name} word or phrase, you MUST include at least one {{...}} example sentence after the [[...]] terms.
- Do NOT carry on the conversation in ${name}. Outside of the [[...]] and {{...}} markup blocks, everything you write is plain English so a reader who knows only English can follow every part of your reply.
- Keep responses concise and digestible. Teach a few items at a time and invite the student to practice.
- NEVER use markdown tables, column layouts, or pipe (|) characters to list vocabulary. The "|" character is reserved EXCLUSIVELY for the inside of [[...]] and {{...}} blocks. Present taught terms as a short plain bulleted list or inline prose, with each term in its own [[...]] block — do not arrange them in a table.
- Match your response length to the student's request:
  - SPECIFIC question (e.g. "how do I say 'I need a cup of tea'?", "what's the word for water?"): answer tersely. Give ONLY the requested translation in the [[...]] markup, then 1–2 short natural variations of that SAME phrase. Do NOT pad the reply with unrelated vocabulary, and do NOT repeat words you have already taught earlier in this conversation.
  - OPEN-ENDED / general request (e.g. "teach me something new", "let's practice greetings"): you may give a fuller mini-lesson with several related items as usual.
- Gently correct mistakes and praise progress. Be encouraging.
- When relevant, give a tiny practice prompt or example sentence the student can try.
- Stay focused on teaching ${name}. If the student goes off-topic, gently steer back.
- Do not use emojis.

Engagement and momentum:
- ALWAYS end every reply by TELLING the student what to learn or practice next based on what they have studied so far in this conversation. Do NOT ask "what would you like to learn next?" — decide for them and lead the way (e.g. "Next, let's build on this and learn how to say...", "Now keep practicing by trying...").
- Keep the student in flow toward today's learning goal. Make the next step feel small, concrete and worth doing right now so they want to keep going.
- Build progressively on their history: reinforce earlier words while introducing slightly more each turn.`;
}

// A dynamic system message describing the student's progress toward today's goal,
// injected fresh on every turn so the tutor can react to where they are.
function progressDirective(points: number, target: number, achieved: boolean): string {
  if (achieved) {
    return `STUDENT PROGRESS: The student has REACHED today's learning goal (${points}/${target} words learned). In this reply, warmly congratulate them on hitting today's target, briefly recap what they learned today, and then ASK whether they would like to keep going for more practice now, or rest for the day and come back stronger tomorrow. Make them feel proud of the progress they made today.`;
  }
  return `STUDENT PROGRESS: Today's goal is ${target} words; the student has learned ${points}/${target} so far. Keep teaching to move them toward the goal, and end your reply by telling them the next concrete thing to learn or practice. Do not mention raw numbers to the student.`;
}

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
  // Persist the chosen language and level (falling back to the defaults) so the
  // chat keeps teaching/rendering/scoring in that language and at that depth
  // even if the global picks change.
  const language = getLanguage(parsed.data.language).code;
  const level = getLevel(parsed.data.level).code;
  const [row] = await db
    .insert(conversations)
    .values({ title: parsed.data.title, language, level })
    .returning();
  res.status(201).json(row);
});

// Update a conversation (e.g. change its language or rename it)
router.patch("/conversations/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const parsed = UpdateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const updates: { title?: string; language?: string; level?: string } = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.language !== undefined) {
    if (!isLanguageCode(parsed.data.language)) {
      res.status(400).json({ error: "Unknown language" });
      return;
    }
    updates.language = parsed.data.language;
  }
  if (parsed.data.level !== undefined) {
    if (!isLevelCode(parsed.data.level)) {
      res.status(400).json({ error: "Unknown level" });
      return;
    }
    updates.level = parsed.data.level;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(row);
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

  const language = getLanguage(conversation.language);
  const level = getLevel(conversation.level);

  // Build the full conversation history for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  // Compute today's learning progress IN THIS LANGUAGE so the tutor can react to
  // how close the student is to today's goal. Scope to assistant messages from
  // conversations in the same language.
  const todaysAssistantMessages = await db
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
  const progress = summarizeProgress(todaysAssistantMessages.map((m) => m.content));

  const chatMessages = [
    { role: "system" as const, content: buildSystemPrompt(language, level) },
    {
      role: "system" as const,
      content: progressDirective(progress.points, progress.target, progress.achieved),
    },
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
    const stream = await llm.chat.completions.create(
      {
        model: resolveModel(language),
        // gpt-5.4 (Replit proxy) needs max_completion_tokens; OpenRouter free
        // models use the standard max_tokens.
        ...(usingOpenRouter
          ? { max_tokens: 8192 }
          : { max_completion_tokens: 8192 }),
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
      const status = (err as { status?: number })?.status;
      const errorMessage =
        status === 429
          ? "The free model is busy right now (rate limited). Please wait a few seconds and try again."
          : "Failed to generate a reply";
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
});

export default router;

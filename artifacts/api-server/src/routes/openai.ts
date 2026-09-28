import { Router, type IRouter, type Response } from "express";
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
import { AUTO_MODEL, llm, resolveModels, usingOpenRouter } from "../lib/llm";
import {
  isSelectableModel,
  modelDisplayName,
  restrictToFreeModels,
} from "../lib/model-catalog";
import {
  describeLlmError,
  summarizeFailures,
  type Attempt,
  type LlmErrorInfo,
} from "../lib/llm-errors";
import { startOfToday, summarizeProgress } from "../lib/progress";

const router: IRouter = Router();

/**
 * End an SSE stream with a structured error.
 *
 * `error` stays a plain string so any client reading the old shape still gets
 * a readable sentence; the extra fields let the UI offer the right next step
 * (wait and retry, or go change the model).
 */
/**
 * A model that opened a stream and then said nothing.
 *
 * Thrown inside the candidate loop so an empty answer is treated the same as a
 * failure to start — the next model gets a turn, instead of the student being
 * shown a blank reply from a model that happened to be first in the chain.
 */
class EmptyStreamError extends Error {
  constructor(readonly model: string) {
    super(`${model} produced no content`);
    this.name = "EmptyStreamError";
  }
}

/** One OpenAI-compatible streaming delta, in the only shape this route reads. */
interface StreamChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
}

function sendStreamError(res: Response, info: LlmErrorInfo): void {
  // Writing to a response whose socket is already gone throws on some Node
  // versions and is pointless on all of them.
  if (res.writableEnded || res.destroyed || !res.writable) return;
  res.write(
    `data: ${JSON.stringify({
      error: info.message,
      errorCode: info.code,
      retryAfterSeconds: info.retryAfterSeconds,
      suggestModelChange: info.suggestModelChange,
      retryable: info.retryable,
    })}\n\n`,
  );
  res.end();
}

// Build the tutor system prompt for a specific target language. The taught-term
// markup ([[native|transliteration|english]]) is what the progress scorer and
// the frontend renderer both rely on, so the instruction to use it is strict.
function buildSystemPrompt(language: LanguageDef, level: LevelDef): string {
  const { name, promptScriptNote, usesTransliteration, markupExample } = language;
  const translitRule = usesTransliteration
    ? `transliteration = a roman-letter pronunciation (REQUIRED for ${name})`
    : `transliteration = leave this field EMPTY for ${name} (it uses the Latin alphabet, so no transliteration is needed)`;

  // A dialect brief (only some languages have one) is a hard authenticity
  // constraint, so it sits directly under the intro — before the mechanical
  // markup rules — where the model is most likely to keep it in view.
  const dialectSection = language.promptDialectBrief
    ? `\n\n${language.promptDialectBrief}`
    : "";

  return `You are a warm, patient and encouraging ${name} language tutor.

The student is fluent in English and is learning ${name}. Their expertise level is ${level.name}: ${level.promptNote} Adapt the depth, pace and amount of target-language usage to this level. ${name} is ${promptScriptNote}.${dialectSection}

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
  The example sentence must be something a native speaker would genuinely say in one breath. If the terms you just taught do not belong together in one natural sentence, use only the ones that do — NEVER string unrelated phrases together with "and" to force them into a single sentence.
  Do not teach bare grammatical glue (and, the, of, a) as its own [[...]] term; teach it inside a phrase where it does some work.
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

  // Build the conversation history for context, capped at the most recent turns.
  //
  // The free models in the fallback chain have context windows as small as 32K
  // tokens, and a long-running lesson plus a detailed dialect brief will
  // eventually exhaust that — which fails the whole reply rather than degrading
  // it. Keep the newest slice (ordered oldest-first for the model) so a long
  // study session stays answerable.
  const HISTORY_TURNS = 40;
  const recent = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_TURNS);
  const history = recent.reverse();

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

  // Abort the upstream generation if the client disconnects so we don't keep
  // consuming tokens for a response nobody is reading.
  //
  // Listen on the RESPONSE, not the request: `req`'s "close" fires when the
  // request stream finishes (which for a POST has already happened by the time
  // we get here), so a req-based listener never sees the disconnect. `res`
  // "close" fires when the underlying connection goes away — guarded by
  // `writableEnded` so a normal completed stream is not treated as a drop.
  const abortController = new AbortController();
  let clientDisconnected = false;
  const onClientGone = () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
      abortController.abort();
    }
  };
  res.on("close", onClientGone);

  let fullResponse = "";
  // The model that actually opened the stream, so a later failure can name it.
  let usedModel: string | undefined;
  // Set once the assistant reply is in the database, so the error path can
  // tell the student the truth about whether their partial lesson was kept —
  // and never insert the same reply twice.
  let persisted = false;
  let iterator: AsyncIterator<StreamChunk> | undefined;
  // Chunks consumed while checking that the model actually produces tokens;
  // they still have to reach the student.
  let prelude: StreamChunk[] = [];
  try {
    // Free models are routinely retired, flipped to paid, or rate-limited, so
    // walk the candidate chain until one actually opens a stream. Only the
    // initial create() call is retried — once tokens are flowing we are
    // committed to that model, and a mid-stream failure falls through to the
    // error handler below.
    // The requested slug comes from the browser and is sent upstream under the
    // account's API key, so it is checked against the free catalogue before
    // being used. An unknown or paid slug is dropped (not rejected): the point
    // is to teach a language, and the automatic chain does that fine.
    const asked =
      parsed.data.model && parsed.data.model !== AUTO_MODEL ? parsed.data.model : undefined;
    const requestedModel = asked && (await isSelectableModel(asked)) ? asked : undefined;
    if (asked && !requestedModel) {
      req.log.warn({ model: asked }, "Ignoring model that is not in the free catalogue");
    }
    // Every candidate is price-checked, not just the requested one: the
    // curated chain is static, and a slug on it can be flipped to paid
    // between deploys.
    const candidates = await restrictToFreeModels(resolveModels(language, requestedModel));
    // Every candidate's failure is kept, not just the last one: with a fallback
    // chain the useful explanation is usually the first model's (the one the
    // student picked), while the last is just "the final backup was busy too".
    const failures: Attempt[] = [];
    for (const model of candidates) {
      try {
        const candidateStream = await llm.chat.completions.create(
          {
            model,
            // gpt-5.4 (Replit proxy) needs max_completion_tokens; OpenRouter
            // free models use the standard max_tokens.
            ...(usingOpenRouter
              ? { max_tokens: 8192 }
              : { max_completion_tokens: 8192 }),
            messages: chatMessages,
            stream: true,
          },
          { signal: abortController.signal },
        );

        // Read ahead to the first real token here, inside the retry loop.
        // create() resolving does not mean the model accepted the request:
        // OpenRouter routes to the upstream provider lazily, so a rate limit
        // or a dead provider surfaces while reading the body — and often not
        // on the very first chunk, which is usually an empty role delta. As
        // long as no token has been sent to the student, a failure is still a
        // failure to START, and must fall through to the next candidate.
        const candidateIterator = (candidateStream as AsyncIterable<StreamChunk>)[
          Symbol.asyncIterator
        ]();
        const buffered: StreamChunk[] = [];
        let gotContent = false;
        for (let step = await candidateIterator.next(); !step.done; step = await candidateIterator.next()) {
          buffered.push(step.value);
          if (step.value.choices?.[0]?.delta?.content) {
            gotContent = true;
            break;
          }
        }
        // A stream that ends having said nothing is a failed attempt, not an
        // answer: fall through to the next model rather than showing the
        // student an empty bubble.
        if (!gotContent) throw new EmptyStreamError(model);

        prelude = buffered;
        iterator = candidateIterator;
        usedModel = model;
        req.log.info({ model, language: language.code }, "Generating with model");
        break;
      } catch (err) {
        if (clientDisconnected) throw err;
        const info = describeLlmError(err, model);
        failures.push({ model, info, chosen: model === requestedModel });
        req.log.warn(
          { model, status: info.status, reason: info.code },
          "Model unavailable, trying next candidate",
        );
      }
    }
    if (!iterator) {
      sendStreamError(res, summarizeFailures(failures));
      return;
    }

    // Whether the model said it was finished. A stream that just stops — the
    // provider dropping the connection mid-sentence — looks exactly like a
    // completed one otherwise, and the student would be shown half a lesson
    // as if it were the whole thing.
    let finishReason: string | null | undefined;
    const emit = (chunk: StreamChunk) => {
      const choice = chunk.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const content = choice?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    };
    // The chunks read while deciding the model is alive come first.
    for (const chunk of prelude) emit(chunk);
    for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
      emit(step.value);
    }

    try {
      await db.insert(messages).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });
      persisted = true;
    } catch (dbErr) {
      // The lesson was generated and the student has read it, but it is not in
      // the history. That is a storage problem, not a model problem, and is
      // reported as itself rather than as a truncated reply — and the insert
      // is NOT retried in the catch below, where a commit that failed
      // ambiguously could produce a duplicate.
      req.log.error({ err: dbErr, conversationId: id }, "Failed to save assistant reply");
      sendStreamError(res, {
        code: "save_failed",
        message:
          "The tutor answered, but saving the reply to this conversation couldn't be confirmed — it may not be here after a reload. Send your message again if it's missing.",
        suggestModelChange: false,
        retryable: true,
      });
      return;
    }

    // The reply is saved either way; `truncated` only tells the client to
    // mention that there is more to come. "length" means the model ran into
    // its token budget, a missing reason means the provider simply stopped.
    const truncated = finishReason === "length" || finishReason == null;
    if (truncated) {
      req.log.warn({ model: usedModel, finishReason }, "Reply ended without a clean finish");
    }
    res.write(`data: ${JSON.stringify({ done: true, ...(truncated ? { truncated: true } : {}) })}\n\n`);
    res.end();
  } catch (err) {
    // Save whatever was generated before the failure — a half-finished lesson
    // is still worth keeping — but only if the successful path had not already
    // stored it (a failing insert lands here too, and must not be retried into
    // a duplicate row).
    let savedPartial = persisted;
    if (!persisted && fullResponse.length > 0) {
      savedPartial = await db
        .insert(messages)
        .values({ conversationId: id, role: "assistant", content: fullResponse })
        .then(() => true)
        .catch(() => false);
    }

    if (clientDisconnected) return;

    const info = describeLlmError(err, usedModel);
    req.log.error({ err, reason: info.code, model: usedModel }, "Failed to stream chat completion");

    // A failure after tokens were already flowing is a different event from a
    // failure to start: the student has half an answer on screen. Say it was
    // cut short — and say honestly whether the part they can see survived —
    // instead of reporting the raw provider error for a reply that visibly
    // started fine.
    if (fullResponse.length > 0) {
      const keptNote = savedPartial
        ? "The part you can see is saved — send your message again to get the rest"
        : "That part could not be saved — send your message again";
      sendStreamError(res, {
        ...info,
        code: "interrupted",
        message: `${modelDisplayName(usedModel ?? "the model")} stopped part-way through this reply. ${keptNote}, or pick a different model in Settings.`,
        suggestModelChange: true,
        retryable: true,
      });
      return;
    }

    sendStreamError(res, info);
  }
});

export default router;

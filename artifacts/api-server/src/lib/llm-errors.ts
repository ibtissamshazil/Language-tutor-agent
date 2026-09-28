import { modelDisplayName } from "./model-catalog";

// Turning provider failures into something a language student can act on.
//
// The tutor runs on free models, so failures are frequent and varied: a slug
// gets retired, a provider throttles by the minute, the account's daily free
// quota runs out, a provider falls over mid-sentence. "Failed to generate a
// reply" tells the student none of that. Everything here exists to answer two
// questions: what went wrong, and what should I do about it.
//
// Providers do not report these conditions uniformly — OpenRouter wraps the
// upstream provider's own error in `error.metadata.raw`, so the HTTP status
// alone is often too coarse (a 429 can mean "wait 20 seconds" or "you are done
// for the day"). The raw text is parsed where it carries that distinction.

export type LlmErrorCode =
  | "rate_limited"
  | "daily_limit"
  | "model_unavailable"
  | "model_gated"
  | "refused"
  | "provider_down"
  | "timeout"
  | "context_too_long"
  | "no_credits"
  | "auth"
  | "network"
  | "empty_reply"
  | "interrupted"
  | "save_failed"
  | "unknown";

export interface LlmErrorInfo {
  code: LlmErrorCode;
  /** User-facing sentence: the reason, then what to do about it. */
  message: string;
  /** How long to wait before retrying makes sense, when the provider says. */
  retryAfterSeconds?: number;
  /** True when picking a different model in Settings is the way forward. */
  suggestModelChange: boolean;
  /** True when the same request is likely to work if simply retried later. */
  retryable: boolean;
  status?: number;
  model?: string;
}

interface UpstreamDetail {
  status?: number;
  /** Provider's own message, which is usually more specific than the status. */
  raw: string;
  errorType?: string;
  /** OpenAI-style symbolic code, e.g. "insufficient_quota", "context_length_exceeded". */
  errorCode?: string;
  retryAfterSeconds?: number;
}

function headerValue(err: unknown, name: string): string | undefined {
  const headers = (err as { headers?: unknown })?.headers;
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const record = headers as Record<string, string | undefined>;
  return record[name] ?? record[name.toLowerCase()];
}

function parseRetryAfter(err: unknown): number | undefined {
  // `retry-after` is in seconds; OpenRouter also sends `x-ratelimit-reset` as
  // an epoch timestamp in milliseconds.
  const retryAfter = headerValue(err, "retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds);
  }
  const reset = headerValue(err, "x-ratelimit-reset");
  if (reset) {
    const resetMs = Number(reset);
    if (Number.isFinite(resetMs) && resetMs > Date.now()) {
      return Math.round((resetMs - Date.now()) / 1000);
    }
  }
  return undefined;
}

function upstreamDetail(err: unknown): UpstreamDetail {
  const e = err as {
    status?: number;
    message?: string;
    error?: {
      message?: string;
      code?: number | string;
      metadata?: { raw?: unknown; error_type?: string; provider_name?: string };
    };
  };
  const metadata = e?.error?.metadata;
  const rawParts = [
    typeof metadata?.raw === "string" ? metadata.raw : JSON.stringify(metadata?.raw ?? ""),
    e?.error?.message,
    e?.message,
  ].filter((part): part is string => Boolean(part) && part !== "{}" && part !== '""');

  return {
    status: e?.status ?? (typeof e?.error?.code === "number" ? e.error.code : undefined),
    raw: rawParts.join(" | "),
    errorType: metadata?.error_type,
    // OpenAI-compatible providers put a symbolic code here; when present it is
    // far more reliable than matching on prose ("insufficient_quota" is a
    // billing problem, not the daily free allowance, despite saying "quota").
    errorCode:
      typeof e?.error?.code === "string"
        ? e.error.code
        : typeof (e as { code?: unknown })?.code === "string"
          ? ((e as { code?: string }).code as string)
          : undefined,
    retryAfterSeconds: parseRetryAfter(err),
  };
}

/** "in about 3 minutes" / "in about 2 hours" — vague on purpose, resets drift. */
export function describeWait(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  if (seconds < 90) return `in about ${Math.max(10, Math.round(seconds / 10) * 10)} seconds`;
  if (seconds < 5400) return `in about ${Math.round(seconds / 60)} minutes`;
  const hours = seconds / 3600;
  return `in about ${hours < 2 ? "an hour" : `${Math.round(hours)} hours`}`;
}

function sentence(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Classify one failed attempt against one model.
 *
 * `model` is the slug that failed; it is named in the message because with a
 * fallback chain the student otherwise cannot tell whether their own choice or
 * a backup is the problem.
 */
export function describeLlmError(err: unknown, model?: string): LlmErrorInfo {
  const { status, raw, errorType, errorCode, retryAfterSeconds } = upstreamDetail(err);
  const text = raw.toLowerCase();
  const label = model ? modelDisplayName(model) : "The model";
  const wait = describeWait(retryAfterSeconds);
  const base = { status, model, retryAfterSeconds };

  if ((err as { name?: string })?.name === "EmptyStreamError") {
    return {
      ...base,
      code: "empty_reply",
      message: `${label} answered with nothing at all. Send your message again, or pick a different model in Settings.`,
      suggestModelChange: true,
      retryable: true,
    };
  }

  if ((err as { name?: string })?.name === "AbortError") {
    return {
      ...base,
      code: "interrupted",
      message: "The reply was cut off before it finished.",
      suggestModelChange: false,
      retryable: true,
    };
  }

  // A billing problem dressed up as a quota. OpenAI-compatible providers send
  // `insufficient_quota` with a 429 when the ACCOUNT is out of money, which is
  // a different fix (add credits) from the free daily allowance running out —
  // so the symbolic code is checked before any prose matching.
  if (errorCode === "insufficient_quota" || status === 402) {
    return {
      ...base,
      code: "no_credits",
      message:
        "The AI account is out of credits for this request. Add credits to the provider account, or choose a free model in Settings.",
      suggestModelChange: true,
      retryable: false,
    };
  }

  // Quota exhausted for a period, as opposed to momentary throttling. The
  // provider spells this out in words ("free-models-per-day", "daily limit"),
  // which is the only reliable way to tell the two 429s apart. Bare "quota" is
  // deliberately NOT matched — it appears in billing errors too.
  const isPeriodQuota =
    /per-?day|per-?week|daily limit|weekly limit|free.{0,20}(?:per|a) day|limit reached for the (?:day|week)|daily quota|reset(?:s)? (?:at|in)/.test(
      text,
    );
  if (status === 429 && isPeriodQuota) {
    const period = /week/.test(text) ? "this week's" : "today's";
    return {
      ...base,
      code: "daily_limit",
      message: sentence([
        `You've used up ${period} free requests on OpenRouter${wait ? `, which reset ${wait}` : ""}.`,
        "You can wait for the reset, or add credits to your OpenRouter account to keep going.",
      ]),
      suggestModelChange: false,
      retryable: true,
    };
  }

  if (status === 429) {
    return {
      ...base,
      code: "rate_limited",
      message: sentence([
        `${label} is busy right now — too many people are using this free model.`,
        `Try again ${wait ?? "in a minute"}, or pick a different model in Settings.`,
      ]),
      suggestModelChange: true,
      retryable: true,
    };
  }

  if (/payment required|add credits|insufficient (?:credits|balance|funds)/.test(text)) {
    return {
      ...base,
      code: "no_credits",
      message:
        "The AI account is out of credits for this request. Add credits to the provider account, or choose a free model in Settings.",
      suggestModelChange: true,
      retryable: false,
    };
  }

  if (
    status === 401 ||
    errorCode === "invalid_api_key" ||
    /invalid api key|no auth credentials|unauthorized/.test(text)
  ) {
    return {
      ...base,
      code: "auth",
      message:
        "The AI provider rejected this app's API key. Check that OPENROUTER_API_KEY is set to a valid key.",
      suggestModelChange: false,
      retryable: false,
    };
  }

  // 403 covers two different things: a model nobody but a partner may call,
  // and a request the provider's policy refused. Both are dead ends for this
  // model, but only the second is about the message the student sent, so they
  // are worded differently instead of both blaming the model.
  if (status === 403 || /agentic harness|not available to you|access restricted/.test(text)) {
    const moderated = /moderat|policy|flagged|safety|prohibited/.test(text);
    return {
      ...base,
      code: moderated ? "refused" : "model_gated",
      message: moderated
        ? `${label} refused to answer this message on its provider's content rules. Rephrase it, or pick a different model in Settings.`
        : `${label} isn't open to this app — its provider restricts who can call it. Pick a different model in Settings.`,
      suggestModelChange: true,
      retryable: false,
    };
  }

  if (status === 404 || /no endpoints found|model not found|no allowed providers/.test(text)) {
    return {
      ...base,
      code: "model_unavailable",
      message: `${label} isn't available from the provider right now — free models are often retired or paused. Pick a different model in Settings.`,
      suggestModelChange: true,
      retryable: false,
    };
  }

  if (
    errorCode === "context_length_exceeded" ||
    /context length|maximum context|too many tokens|tokens? exceed/.test(text)
  ) {
    return {
      ...base,
      code: "context_too_long",
      message:
        "This conversation got too long for the model to read. Start a new chat to continue — your progress is saved.",
      suggestModelChange: true,
      retryable: false,
    };
  }

  if (status === 408 || status === 504 || /timed? ?out|deadline/.test(text)) {
    return {
      ...base,
      code: "timeout",
      message: `${label} took too long to respond. Send your message again, or pick a faster model in Settings.`,
      suggestModelChange: true,
      retryable: true,
    };
  }

  if (
    status === 502 ||
    status === 503 ||
    errorType === "provider_overloaded" ||
    /overloaded|temporarily unavailable|service unavailable|capacity/.test(text)
  ) {
    return {
      ...base,
      code: "provider_down",
      message: sentence([
        `${label} is temporarily overloaded on the provider's side.`,
        `Try again ${wait ?? "in a moment"}, or pick a different model in Settings.`,
      ]),
      suggestModelChange: true,
      retryable: true,
    };
  }

  if (
    (err as { name?: string })?.name === "APIConnectionError" ||
    /fetch failed|econnrefused|enotfound|network|socket hang up/.test(text)
  ) {
    return {
      ...base,
      code: "network",
      message:
        "Couldn't reach the AI provider — the connection failed. Check your internet connection and try again.",
      suggestModelChange: false,
      retryable: true,
    };
  }

  return {
    ...base,
    code: "unknown",
    // The provider's own words beat a generic apology, but they can be long or
    // contain JSON, so they are trimmed to a single readable clause.
    message: sentence([
      `${label} couldn't answer.`,
      raw ? `The provider said: ${raw.replace(/\s+/g, " ").slice(0, 160)}.` : undefined,
      "Try again, or pick a different model in Settings.",
    ]),
    suggestModelChange: true,
    retryable: true,
  };
}

/** How informative each failure is when several models failed in one send. */
const PRIORITY: LlmErrorCode[] = [
  "auth",
  "no_credits",
  "daily_limit",
  "context_too_long",
  "network",
  "rate_limited",
  "provider_down",
  "timeout",
  "refused",
  "model_gated",
  "model_unavailable",
  "save_failed",
  "empty_reply",
  "interrupted",
  "unknown",
];

export interface Attempt {
  model: string;
  info: LlmErrorInfo;
  /** True for the model the student picked in Settings. */
  chosen: boolean;
}

/**
 * Reduce every failed candidate in one send to a single explanation.
 *
 * The student's own choice is reported first when it failed for a reason they
 * control (retired, gated), because "the model you picked is gone" is more
 * useful than the last backup's error — but the fallbacks' reason is appended
 * so it is clear the tutor already tried everything else.
 */
export function summarizeFailures(attempts: Attempt[]): LlmErrorInfo {
  if (attempts.length === 0) {
    return {
      code: "unknown",
      message: "No model is configured to answer. Check the server's AI settings.",
      suggestModelChange: false,
      retryable: false,
    };
  }

  const rank = (info: LlmErrorInfo) => {
    const index = PRIORITY.indexOf(info.code);
    return index === -1 ? PRIORITY.length : index;
  };
  const worst = [...attempts].sort((a, b) => rank(a.info) - rank(b.info))[0]!;

  // Some failures are about the ACCOUNT, not the model: a rejected key, no
  // credits, the day's free allowance gone. Those must win outright — telling
  // the student to pick another model when the key is broken sends them to fix
  // the wrong thing, and every other model would fail identically.
  const ACCOUNT_LEVEL: LlmErrorCode[] = ["auth", "no_credits", "daily_limit"];
  if (ACCOUNT_LEVEL.includes(worst.info.code)) return worst.info;

  const chosen = attempts.find((a) => a.chosen);
  const chosenIsTheProblem =
    chosen && (chosen.info.code === "model_unavailable" || chosen.info.code === "model_gated");

  if (chosenIsTheProblem && attempts.length > 1) {
    const backupReason =
      worst.info.code === "rate_limited" || worst.info.code === "daily_limit"
        ? "and the backup models are all busy too"
        : "and the backup models failed as well";
    const reasonOnly = chosen.info.message
      .replace(/\s*Pick a different model in Settings\.\s*$/, "")
      .replace(/[.\s]+$/, "");
    return {
      ...chosen.info,
      message: `${reasonOnly}, ${backupReason}. Pick a different model in Settings.`,
      suggestModelChange: true,
    };
  }

  // Every model hit the same wall: say so, rather than blaming the last one.
  const allSameCode = attempts.every((a) => a.info.code === worst.info.code);
  if (allSameCode && attempts.length > 1) {
    if (worst.info.code === "rate_limited") {
      const wait = describeWait(
        Math.min(
          ...attempts
            .map((a) => a.info.retryAfterSeconds)
            .filter((s): s is number => typeof s === "number"),
        ),
      );
      return {
        ...worst.info,
        message: `Every free model is busy right now. Try again ${wait ?? "in a minute"} — or add credits to your OpenRouter account to skip the queues.`,
        suggestModelChange: false,
      };
    }
    if (worst.info.code === "model_unavailable") {
      return {
        ...worst.info,
        message:
          "None of the configured models are available from the provider anymore. Pick a different model in Settings.",
        suggestModelChange: true,
      };
    }
  }

  return worst.info;
}

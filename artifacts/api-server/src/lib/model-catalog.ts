import {
  MODEL_NOTES,
  autoModelOrder,
  modelChoiceLocked,
  usingOpenRouter,
} from "./llm";

// The list of models the student can pick from in Settings.
//
// It is fetched live rather than hardcoded: free OpenRouter slugs are retired,
// flipped to paid, or added without notice, and a stale hardcoded list would
// offer choices that only fail at send time. The upstream catalogue is cached
// briefly so opening Settings does not hit OpenRouter on every render.

export interface ModelOption {
  id: string;
  name: string;
  contextLength?: number;
  recommended: boolean;
  note?: string;
}

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  // Every field here is a price per unit; OpenRouter adds new ones over time.
  pricing?: Record<string, string | undefined>;
}

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 5 * 60 * 1000;

// Free models that are not usable as a chat tutor even though the catalogue
// lists them: media models, safety classifiers, and slugs gated to "agentic
// harnesses" (they answer any normal API call with a 403).
const EXCLUDED_PATTERNS = [
  /lyria/i,
  /content-safety/i,
  /thinkingmachines\//i,
  /openrouter\/free/i,
];

// A failed catalogue fetch is cached only briefly: the curated fallback list is
// a guess about what is live, so it must not stand in for the real catalogue
// for a full TTL while the provider is already back.
const FAILURE_CACHE_TTL_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let cache: { at: number; models: ModelOption[]; stale: boolean } | null = null;
// Concurrent callers (Settings opening while a send validates a slug) share one
// upstream request rather than each issuing their own.
let inFlight: Promise<ModelOption[]> | null = null;

/**
 * A readable name for a slug, for error messages and logs.
 *
 * Uses the upstream catalogue name when it has been fetched, and otherwise
 * derives one from the slug — this has to stay synchronous because it is used
 * while composing an error that is already on its way to the client.
 */
export function modelDisplayName(id: string): string {
  const known = cache?.models.find((m) => m.id === id);
  if (known) return known.name;

  // Fallback while the catalogue is cold: turn "nvidia/nemotron-3-ultra-550b-
  // a55b:free" into "Nemotron 3 Ultra". Parameter-count tokens (550b, a55b,
  // 27b) are dropped — they are noise in a sentence aimed at a student.
  const slug = (id.split("/").pop() ?? id).replace(/:free$/, "");
  const words = slug
    .split(/[-_]/)
    .filter((word) => !/^a?\d+(?:\.\d+)?[bm]$/i.test(word))
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)));
  return words.join(" ") || slug;
}

// Warm the catalogue in the background at startup so error messages can name
// models the way the provider does ("NVIDIA: Nemotron 3 Ultra") from the very
// first failure, instead of falling back to a slug-derived guess.
void listAvailableModels().catch(() => undefined);

/** The account part of a slug: "nvidia/nemotron-3-ultra:free" -> "nvidia". */
function providerOf(id: string): string {
  const slash = id.indexOf("/");
  return (slash === -1 ? id : id.slice(0, slash)).toLowerCase();
}

/**
 * Order the picker by provider name, A→Z, then by model name.
 *
 * Recommended models still come first as their own group — the UI labels them
 * — but within each group the order is alphabetical by provider so a student
 * scanning a long list can find a maker's models together.
 */
function sortByProvider(options: ModelOption[]): void {
  options.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    const provider = providerOf(a.id).localeCompare(providerOf(b.id));
    if (provider !== 0) return provider;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Free on EVERY axis the catalogue prices, not just tokens.
 *
 * Checking `prompt` and `completion` alone is not enough: a model can be
 * free per token and still bill per request, per image, or per web search.
 * Any unrecognised price field is treated the same way, so a new billable
 * dimension added upstream cannot quietly become spendable here.
 */
function isFree(model: OpenRouterModel): boolean {
  const pricing = model.pricing;
  if (!pricing) return false;
  const prices = Object.values(pricing);
  if (prices.length === 0) return false;
  return prices.every((price) => {
    const value = Number(price ?? "1");
    return Number.isFinite(value) && value === 0;
  });
}

function toOption(model: OpenRouterModel, recommendedIds: Set<string>): ModelOption {
  const note = MODEL_NOTES[model.id];
  return {
    id: model.id,
    // Strip the "(free)" suffix OpenRouter appends — every option here is free.
    name: (model.name ?? model.id).replace(/\s*\(free\)\s*$/i, ""),
    contextLength: model.context_length,
    recommended: recommendedIds.has(model.id),
    ...(note ? { note } : {}),
  };
}

/**
 * Free models currently served upstream, recommended ones first.
 *
 * Never throws: if OpenRouter is unreachable the known-good chain is returned
 * on its own, so Settings still offers a working choice.
 */
export async function listAvailableModels(): Promise<ModelOption[]> {
  const recommendedIds = new Set(autoModelOrder());

  if (!usingOpenRouter || modelChoiceLocked) {
    return autoModelOrder().map((id) =>
      toOption({ id, name: id }, recommendedIds),
    );
  }

  const ttl = cache?.stale ? FAILURE_CACHE_TTL_MS : CACHE_TTL_MS;
  if (cache && Date.now() - cache.at < ttl) return cache.models;
  if (inFlight) return inFlight;

  inFlight = refreshCatalog(recommendedIds).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function refreshCatalog(recommendedIds: Set<string>): Promise<ModelOption[]> {
  let options: ModelOption[];
  let stale = false;
  try {
    const res = await fetch(CATALOG_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Catalogue request failed: ${res.status}`);
    const body = (await res.json()) as { data?: OpenRouterModel[] };

    // Only what upstream currently serves for free is offered. A curated model
    // that has been retired or flipped to paid is deliberately NOT added back:
    // the list doubles as the allow-list for what a client may request, so
    // advertising a paid slug here would be a way to spend the account's money.
    options = (body.data ?? [])
      .filter(isFree)
      .filter((m) => !EXCLUDED_PATTERNS.some((p) => p.test(m.id)))
      .map((m) => toOption(m, recommendedIds));
  } catch {
    // Provider unreachable: fall back to the curated chain, which is the only
    // set of slugs known to have been free, and re-check again shortly.
    options = autoModelOrder().map((id) => toOption({ id, name: id }, recommendedIds));
    stale = true;
  }

  sortByProvider(options);

  cache = { at: Date.now(), models: options, stale };
  return options;
}

/**
 * May a client ask for this model?
 *
 * The requested slug arrives from the browser's localStorage and is forwarded
 * under the account's OpenRouter key, so it is checked against the live free
 * catalogue rather than trusted: otherwise anyone posting to the API could
 * name an expensive paid model and spend the account's credits.
 *
 * When the catalogue cannot be fetched the check falls back to the curated
 * chain — deliberately closed rather than open, since "we don't know what this
 * costs" must not mean "go ahead".
 */
export async function isSelectableModel(id: string): Promise<boolean> {
  if (modelChoiceLocked) return false;
  const models = await listAvailableModels();
  return models.some((m) => m.id === id);
}

/** How many live free models may be appended as extra fallbacks. */
const MAX_EXTRA_FALLBACKS = 3;

/**
 * Keep a candidate chain inside what is currently free, and top it up.
 *
 * The curated chain in llm.ts is a static list: a slug on it can be retired,
 * or flipped to paid, between deploys. Filtering the WHOLE chain — not just
 * the student's pick — against the live catalogue means neither an automatic
 * send nor a fallback after a failed pick can reach a model that now bills.
 *
 * Models the catalogue offers but the chain has never heard of are appended
 * behind the curated ones, so a chain whose every entry has been retired
 * still has something to fall back to instead of failing outright.
 *
 * During a catalogue outage the curated chain is used unchanged: those slugs
 * are the only ones with any evidence of being free, and they are chosen by
 * this server rather than by a caller.
 */
export async function restrictToFreeModels(candidates: string[]): Promise<string[]> {
  if (!usingOpenRouter || modelChoiceLocked) return candidates;

  const models = await listAvailableModels();
  if (cache?.stale) return candidates;

  const live = new Set(models.map((m) => m.id));
  const kept = candidates.filter((id) => live.has(id));
  const extras = models
    .filter((m) => !kept.includes(m.id))
    .slice(0, MAX_EXTRA_FALLBACKS)
    .map((m) => m.id);
  return [...kept, ...extras];
}

// Shared Anthropic client for the checker's subjective-grading engine
// (rubric generation + per-submission batched grading) — the only place in
// this codebase that calls an LLM, and the ONLY place that's allowed to:
// every Claude call in the checker goes through callClaudeJson below, never
// a fresh client or a raw fetch to api.anthropic.com elsewhere.
//
// The client is instantiated lazily (on first actual call), NOT at module
// load — the orchestrator route (/api/checker/grade) imports this module
// unconditionally even for MCQ-only submissions with zero subjective
// questions, and Next.js's build step eagerly evaluates every route module
// for page-data collection. Throwing at import time (the naive mirror of
// supabaseAdmin.ts's convention) would break the production build itself
// whenever ANTHROPIC_API_KEY isn't set yet, and would crash MCQ-only
// grading too. Throwing only when a Claude call is actually attempted
// keeps both of those working regardless.
import Anthropic, { APIConnectionError, APIConnectionTimeoutError, AuthenticationError, BadRequestError } from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { recordGradingCallTelemetry, GradingCallKind } from '@/lib/checker/gradingTelemetry';

// Two model constants, not one — see HAIKU_ESCALATION_CONFIDENCE_THRESHOLD
// below. Subjective grading routes to Haiku FIRST (far cheaper per image
// token, the dominant cost — see gradeSubjective.ts's own doc comment) and
// escalates only the specific questions that come back uncertain to
// Sonnet, rather than grading everything on the more expensive model by
// default.
export const CLAUDE_MODEL_SONNET = 'claude-sonnet-4-6';
/** Current Haiku 4.5 model id. Rubric generation stays on Sonnet
 *  deliberately (see loadRubrics/ensureRubric in rubric.ts) — it's a
 *  one-time, text-only, per-question, class-amortized cost that sets the
 *  grading standard every future submission is measured against, not
 *  where the savings should come from. */
export const CLAUDE_MODEL_HAIKU = 'claude-haiku-4-5-20251001';
/** A Haiku-graded question escalates to one Sonnet follow-up call when its
 *  own reported confidence falls below this, OR (independent of
 *  confidence — see gradeSubjective.ts's escalation check) when it's a
 *  partial-credit result, the single most subjective/error-prone judgment
 *  a grader makes. */
export const HAIKU_ESCALATION_CONFIDENCE_THRESHOLD = 0.75;

// How many Claude calls this process will let run at once, across EVERY
// caller (batch grading, per-question fallback, rubric generation, attempt
// detection) and EVERY concurrently-grading submission — not just within
// one. Each call can carry several full page images, and a teacher
// uploading a whole class in quick succession can otherwise stack up many
// large concurrent requests, a classic ECONNRESET/connection-reset
// trigger. Enforced once in callClaudeJson (see withConcurrencyLimit
// below), so no individual call site needs to think about it.
//
// Caveat: this is an IN-PROCESS cap. Locally (`next dev`/`next start`) and
// for concurrent requests that land on the same warm serverless instance,
// it's a true global limit; this app deploys to Vercel (see vercel.json),
// which can also spin up separate instances for concurrent invocations
// that an in-process semaphore can't see across. Still real, meaningful
// protection for the common case — a true cross-instance cap would need
// external coordination (a distributed lock/queue), a much bigger scope
// increase than reliability-only. Retry-with-backoff (the SDK's own
// maxRetries below) is what absorbs whatever gets through despite it.
export const MAX_CONCURRENT_CLAUDE_CALLS = 3;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set!');
    }
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Bounded per-attempt timeout — without this, a single hung request
      // (a transient network stall) can run past the calling route's own
      // maxDuration (120s — see grade/route.ts), which gets the WHOLE
      // serverless invocation killed by the platform before any of this
      // file's own error handling gets a chance to run, leaving the
      // submission stuck at status: 'processing' forever with no failure
      // ever recorded. Deliberately NOT set to the route's full 120s
      // budget: a submission can involve several calls in sequence
      // (attempt detection, rubric generation, the batch call), so one
      // call allowed to hang for the entire budget would itself risk
      // consuming all of it. 60s leaves headroom for retries underneath
      // that ceiling. A call that times out here throws a normal
      // APIConnectionTimeoutError, which every caller in this file already
      // treats as a per-question/per-batch failure (never fails the whole
      // submission), so grading degrades gracefully within the time
      // budget instead of vanishing.
      timeout: 60_000,
      maxRetries: 3, // SDK retries connection errors/429/5xx automatically with backoff; never retries a 4xx
    });
  }
  return client;
}

export interface ClaudeImageInput {
  mediaType: 'image/jpeg' | 'image/png';
  base64: string;
}

// ── Concurrency gate ────────────────────────────────────────────────────
// A small counting semaphore, not a queue class — this is the only place
// in the codebase that needs bounded concurrency across independent
// callers (mapWithConcurrency, below, bounds concurrency WITHIN one loop;
// this bounds it across ALL of them at once, process-wide).
let activeCalls = 0;
const waitQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeCalls < MAX_CONCURRENT_CLAUDE_CALLS) {
    activeCalls++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    waitQueue.push(() => { activeCalls++; resolve(); });
  });
}

function releaseSlot(): void {
  activeCalls--;
  const next = waitQueue.shift();
  if (next) next();
}

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

// ── Error classification ────────────────────────────────────────────────
// undici's `TypeError: fetch failed` (and the Anthropic SDK's own generic
// "Connection error."/"Request timed out." wrapper messages) hide the
// actual reason a request never got a response — it's on `error.cause`
// (and sometimes nested further: `.cause.cause`), not `error.message`.
// This is the ONE place that unwraps it, so every catch block in the
// grading pipeline can log/persist a real cause instead of an opaque
// string.
export type ErrorKind = 'network' | 'timeout' | 'billing' | 'auth' | 'bad_request' | 'unknown';

export interface ClaudeErrorInfo {
  /** Human-readable, safe to show a teacher or persist to a DB column. */
  summary: string;
  kind: ErrorKind;
  /** A node/undici error code (ECONNRESET, ETIMEDOUT, ENOTFOUND, a TLS
   *  code, ...) when one could be found anywhere in the cause chain,
   *  otherwise null. */
  code: string | null;
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE', 'EAI_AGAIN',
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** Walks `e.cause` (and any further nested `.cause`), a handful of levels
 *  deep (guards against a pathological/cyclic chain), looking for a
 *  node-style `.code` string. */
function findErrorCode(e: unknown, depth = 0): string | null {
  if (!e || typeof e !== 'object' || depth > 5) return null;
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  return findErrorCode((e as { cause?: unknown }).cause, depth + 1);
}

/** The Anthropic SDK stores the parsed API error body on `.error` (see
 *  node_modules/@anthropic-ai/sdk/core/error.js) — `.error.error.message`
 *  is the actual human message ("Your credit balance is too low...");
 *  `.message` on the thrown error is the whole response JSON stringified
 *  with the status code prefixed, which works for matching against but is
 *  not what we want to show a teacher. Falls back to `.message` when the
 *  structured shape isn't there. */
function extractApiMessage(e: any): string {
  const nested = e?.error?.error?.message;
  if (typeof nested === 'string' && nested) return nested;
  return e?.message || String(e);
}

/** Classifies any error caught around a Claude API call — or a Supabase
 *  Storage call (see scanStorage.ts's downloadScan, which doesn't go
 *  through the Anthropic SDK's own wrapping but can hit the exact same
 *  class of raw network failure) — into a small ErrorKind plus a summary
 *  that includes the REAL cause instead of a bare "fetch failed"/
 *  "Connection error.". Never throws itself. */
export function describeClaudeError(e: unknown): ClaudeErrorInfo {
  const code = findErrorCode(e);

  if (e instanceof APIConnectionTimeoutError) {
    return { summary: `Request timed out${code ? ` (${code})` : ''}`, kind: 'timeout', code };
  }
  if (e instanceof APIConnectionError) {
    return { summary: `Connection error${code ? ` (${code})` : ''}: ${extractApiMessage(e)}`, kind: 'network', code };
  }
  if (e instanceof AuthenticationError) {
    return { summary: extractApiMessage(e), kind: 'auth', code };
  }
  if (e instanceof BadRequestError) {
    const message = extractApiMessage(e);
    const isBilling = /credit balance|insufficient.{0,20}credit|purchase credits/i.test(message);
    return { summary: message, kind: isBilling ? 'billing' : 'bad_request', code };
  }
  if (code && NETWORK_ERROR_CODES.has(code)) {
    const message = e instanceof Error ? e.message : String(e);
    return { summary: `Connection error (${code}): ${message}`, kind: 'network', code };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { summary: message || 'Unknown error', kind: 'unknown', code };
}

/** Worth retrying (a fresh attempt might plausibly succeed) vs. guaranteed
 *  to fail identically every time. Used by gradeSubjective.ts to decide
 *  whether a batch-call failure should fall back to per-question grading
 *  (network/timeout/unknown) or short-circuit straight to needs_review
 *  (billing/auth/bad_request) instead of repeating the same doomed call
 *  once per question. */
export function isRetryableErrorKind(kind: ErrorKind): boolean {
  return kind === 'network' || kind === 'timeout' || kind === 'unknown';
}

/** Pulls a JSON value (object OR array) out of a model response even if it
 *  added prose or markdown fences around it despite being asked for strict
 *  JSON — models do this often enough that a plain JSON.parse alone is too
 *  brittle. */
function extractJson(text: string): any {
  const direct = text.trim();
  try { return JSON.parse(direct); } catch { /* fall through */ }

  const fenced = direct.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }

  const firstObj = direct.indexOf('{');
  const firstArr = direct.indexOf('[');
  const starts = [firstObj, firstArr].filter(i => i !== -1);
  if (starts.length > 0) {
    const start = Math.min(...starts);
    const closer = direct[start] === '[' ? ']' : '}';
    const end = direct.lastIndexOf(closer);
    if (end > start) return JSON.parse(direct.slice(start, end + 1));
  }

  throw new Error('No JSON value found in model response');
}

/** First 12 hex chars of a sha256 of the system prompt — a diagnostic
 *  label (not a security use), logged alongside cache usage so the prompt
 *  cache's actual effectiveness is verifiable from our own logs: two
 *  students of the same paper graded back to back should log the IDENTICAL
 *  hash, and the second one should show cache_read_input_tokens > 0. Also
 *  doubles as an early warning if a future prompt change accidentally
 *  reintroduces per-student content into the cached prefix (the hash would
 *  stop matching across students of the same paper). */
export function hashPromptPrefix(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export interface CallTelemetry {
  /** Null for rubric-generation calls (no single submission owns them). */
  submissionId: string | null;
  paperId: string;
  callKind: GradingCallKind;
}

/** Sends one message (optional images + a text prompt that must ask for
 *  strict JSON back) and returns the parsed value. Retries once, with an
 *  explicit "that wasn't valid JSON" follow-up, if parsing fails — callers
 *  treat a second failure as this call having failed (never fails the
 *  whole submission), not as a reason to retry further. Each actual HTTP
 *  request (the first attempt, and the JSON-repair retry if it happens) is
 *  billed and logged separately — they're two real API calls, not one.
 *
 *  `system`, when given, is sent as a `cache_control: ephemeral` system
 *  block instead of being folded into the user prompt — Anthropic caches
 *  an exact-prefix match for ~5 minutes, so grading a whole class on the
 *  SAME paper (same rubric/answer-key text every call, only the images
 *  differ per student) reuses that cache instead of re-processing the
 *  rubric text on every submission. `callLabel` is just for the cache-hit
 *  log line (e.g. "batch" vs "per-question:<id>") — never sent to the API.
 *  `model` defaults to Sonnet (rubric.ts's calls need no changes);
 *  gradeSubjective.ts's grading calls pass CLAUDE_MODEL_HAIKU explicitly.
 *  `telemetry`, when given, persists this call's cost/token profile via
 *  recordGradingCallTelemetry (gradingTelemetry.ts) — best-effort, never
 *  throws, never delays the caller past the DB write itself.
 *
 *  Every actual `messages.create()` call goes through withConcurrencyLimit
 *  — see MAX_CONCURRENT_CLAUDE_CALLS above. */
export async function callClaudeJson<T = any>(params: {
  images?: ClaudeImageInput[];
  prompt: string;
  maxTokens?: number;
  system?: string;
  callLabel?: string;
  model?: string;
  telemetry?: CallTelemetry;
}): Promise<T> {
  const { images = [], prompt, maxTokens = 2048, system, callLabel = 'call', model = CLAUDE_MODEL_SONNET, telemetry } = params;

  const buildContent = (text: string): Anthropic.MessageParam['content'] => [
    ...images.map((img): Anthropic.ImageBlockParam => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    })),
    { type: 'text', text },
  ];

  const send = (text: string) => withConcurrencyLimit(() => getClient().messages.create({
    model,
    max_tokens: maxTokens,
    ...(system
      ? { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } } as Anthropic.TextBlockParam] }
      : {}),
    messages: [{ role: 'user', content: buildContent(text) }],
  }));

  const recordResponse = async (response: Anthropic.Message) => {
    const usage = response.usage as any;
    if (system) {
      // eslint-disable-next-line no-console
      console.log(`[CLAUDE-CACHE] ${callLabel} prefix=${hashPromptPrefix(system)} created=${usage?.cache_creation_input_tokens ?? 0} read=${usage?.cache_read_input_tokens ?? 0} input=${usage?.input_tokens ?? 0}`);
    }
    if (telemetry) {
      await recordGradingCallTelemetry({
        submissionId: telemetry.submissionId,
        paperId: telemetry.paperId,
        callKind: telemetry.callKind,
        model,
        imageCount: images.length,
        usage,
      });
    }
  };

  const firstResponse = await send(prompt);
  await recordResponse(firstResponse);
  const firstText = firstResponse.content.find(b => b.type === 'text')?.text || '';
  try {
    return extractJson(firstText) as T;
  } catch {
    // One retry, same images/system, an explicit correction — not a fresh
    // attempt at the whole prompt, just a nudge toward valid JSON.
    const retryResponse = await send(`${prompt}\n\nYour previous response was not valid JSON. Respond with ONLY a single valid JSON value — no markdown fences, no commentary.`);
    await recordResponse(retryResponse);
    const retryText = retryResponse.content.find(b => b.type === 'text')?.text || '';
    return extractJson(retryText) as T; // throws if still invalid — caller catches
  }
}

/** Runs `fn` over `items` with at most `limit` in flight at once — a tiny
 *  worker-pool, not a queue class. Bounds concurrency WITHIN one loop (e.g.
 *  grading every fallback question for one submission); MAX_CONCURRENT_
 *  CLAUDE_CALLS above additionally bounds it process-wide, across every
 *  loop and every submission at once. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

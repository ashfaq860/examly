// Per-call cost telemetry — writes one row to checker_grading_calls per
// Claude API call, from the single choke point every call already goes
// through (callClaudeJson, claude.ts). Never throws and never blocks
// grading: a telemetry write failing is a visibility gap, not a reason to
// fail a submission that otherwise graded fine.
//
// supabaseAdmin is imported lazily (inside recordGradingCallTelemetry, not
// at module scope) deliberately: claude.ts imports this file, and
// supabaseAdmin.ts throws at IMPORT time if SUPABASE_SERVICE_ROLE_KEY isn't
// set. An eager top-level import here would make merely importing claude.ts
// (e.g. from a unit test with no Supabase env configured) fail before a
// single test even runs — a real regression this caused once already (see
// claude.test.ts, which has no Supabase dependency of its own).

export type GradingCallKind = 'batch' | 'per_question' | 'rubric' | 'escalation';

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ModelPricing {
  /** USD per MILLION tokens, each category — Anthropic's own per-token unit. */
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

// Best-effort pricing, keyed by the exact model id string passed to
// callClaudeJson (see claude.ts's CLAUDE_MODEL_SONNET/CLAUDE_MODEL_HAIKU).
// VERIFY against https://www.anthropic.com/pricing before trusting
// estimated_cost_usd for real budgeting — isolated here, one line each, so
// a rate change is a one-line fix rather than a hunt through the grading
// pipeline.
const PRICING_USD_PER_MILLION_TOKENS: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
};
// Used only if a model id shows up that isn't in the table above (e.g. a
// future model swap where this file wasn't updated) — better than silently
// recording $0 and hiding a real cost.
const FALLBACK_PRICING: ModelPricing = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

export function estimateCostUsd(model: string, usage: UsageLike): number {
  const pricing = PRICING_USD_PER_MILLION_TOKENS[model];
  if (!pricing) {
    console.warn(`[CLAUDE-COST] no pricing entry for model "${model}" — using fallback (Sonnet) rates; add this model to PRICING_USD_PER_MILLION_TOKENS in gradingTelemetry.ts`);
  }
  const rates = pricing ?? FALLBACK_PRICING;
  const million = 1_000_000;
  return (
    ((usage.input_tokens ?? 0) * rates.input) / million +
    ((usage.output_tokens ?? 0) * rates.output) / million +
    ((usage.cache_creation_input_tokens ?? 0) * rates.cacheWrite) / million +
    ((usage.cache_read_input_tokens ?? 0) * rates.cacheRead) / million
  );
}

export interface RecordGradingCallParams {
  /** Null for rubric-generation calls — those happen once per question,
   *  amortized across a whole class, not tied to any one submission. */
  submissionId: string | null;
  paperId: string;
  callKind: GradingCallKind;
  model: string;
  imageCount: number;
  usage: UsageLike;
}

/** Persists one Claude call's cost/token profile. Best-effort: logs and
 *  swallows its own failure rather than ever affecting the grading result
 *  that triggered it — a missed telemetry row is a visibility gap, not a
 *  grading failure. */
export async function recordGradingCallTelemetry(params: RecordGradingCallParams): Promise<void> {
  const { submissionId, paperId, callKind, model, imageCount, usage } = params;
  try {
    const estimatedCostUsd = estimateCostUsd(model, usage);
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { error } = await supabaseAdmin.from('checker_grading_calls').insert({
      submission_id: submissionId,
      paper_id: paperId,
      call_kind: callKind,
      model,
      image_count: imageCount,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      estimated_cost_usd: estimatedCostUsd,
    });
    if (error) console.error('Failed to record grading-call telemetry:', error.message);
  } catch (e: any) {
    console.error('Failed to record grading-call telemetry:', e.message || e);
  }
}

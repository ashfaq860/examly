// Aggregates src/lib/checker/gradingTelemetry.ts's per-call rows
// (checker_grading_calls) into the numbers the cost-reduction pass was
// actually measured against: calls/tokens/USD per paper and per day, cache
// effectiveness, and the Haiku-first escalation rate. Same
// auth/admin-guard shape as /api/admin/analytics — session-scoped role
// check, then supabaseAdmin for the actual aggregation.
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const LOOKBACK_DAYS = 30;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roleData, error: rpcError } = await supabase
      .rpc('get_user_role');

    if (rpcError || (roleData !== 'admin' && roleData !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getCheckerCostStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Checker-cost API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCheckerCostStats() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: calls, error } = await supabaseAdmin
    .from('checker_grading_calls')
    .select('submission_id, paper_id, call_kind, model, image_count, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, estimated_cost_usd, created_at')
    .gte('created_at', since);
  if (error) throw error;

  const rows = calls || [];

  const totalInputTokens = rows.reduce((s, r) => s + (r.input_tokens || 0), 0);
  const totalOutputTokens = rows.reduce((s, r) => s + (r.output_tokens || 0), 0);
  const totalCacheCreationTokens = rows.reduce((s, r) => s + (r.cache_creation_input_tokens || 0), 0);
  const totalCacheReadTokens = rows.reduce((s, r) => s + (r.cache_read_input_tokens || 0), 0);
  const totalCostUsd = rows.reduce((s, r) => s + Number(r.estimated_cost_usd || 0), 0);

  const submissionIds = new Set(rows.filter(r => r.submission_id).map(r => r.submission_id as string));
  const paperIds = new Set(rows.map(r => r.paper_id).filter(Boolean) as string[]);

  const cacheableInputTokens = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate = cacheableInputTokens > 0 ? Math.round((totalCacheReadTokens / cacheableInputTokens) * 1000) / 10 : 0;

  const totals = {
    totalCalls: rows.length,
    totalSubmissions: submissionIds.size,
    totalPapers: paperIds.size,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    avgCostPerSubmissionUsd: submissionIds.size > 0 ? Math.round((totalCostUsd / submissionIds.size) * 1_000_000) / 1_000_000 : 0,
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    cacheHitRate,
  };

  // By model — the headline number for "did Haiku-first routing stick".
  const byModelMap = new Map<string, { calls: number; costUsd: number }>();
  rows.forEach(r => {
    const entry = byModelMap.get(r.model) || { calls: 0, costUsd: 0 };
    entry.calls += 1;
    entry.costUsd += Number(r.estimated_cost_usd || 0);
    byModelMap.set(r.model, entry);
  });
  const byModel = Array.from(byModelMap.entries())
    .map(([model, v]) => ({ model, calls: v.calls, costUsd: Math.round(v.costUsd * 1_000_000) / 1_000_000 }))
    .sort((a, b) => b.calls - a.calls);

  // By call kind — batch vs per_question vs escalation vs rubric.
  const byKindMap = new Map<string, { calls: number; costUsd: number }>();
  rows.forEach(r => {
    const entry = byKindMap.get(r.call_kind) || { calls: 0, costUsd: 0 };
    entry.calls += 1;
    entry.costUsd += Number(r.estimated_cost_usd || 0);
    byKindMap.set(r.call_kind, entry);
  });
  const byCallKind = Array.from(byKindMap.entries())
    .map(([call_kind, v]) => ({ call_kind, calls: v.calls, costUsd: Math.round(v.costUsd * 1_000_000) / 1_000_000 }))
    .sort((a, b) => b.calls - a.calls);

  // Escalation rate — how often the Haiku-first pass needed a Sonnet
  // follow-up call, out of every batch that was attempted at all.
  const batchCalls = byKindMap.get('batch')?.calls ?? 0;
  const escalationCalls = byKindMap.get('escalation')?.calls ?? 0;
  const escalationRatePct = batchCalls > 0 ? Math.round((escalationCalls / batchCalls) * 1000) / 10 : 0;

  // Daily time series, oldest first (matches analytics.ts's visits.daily shape).
  const dailyMap = new Map<string, { calls: number; costUsd: number }>();
  for (let i = LOOKBACK_DAYS - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyMap.set(day, { calls: 0, costUsd: 0 });
  }
  rows.forEach(r => {
    const day = String(r.created_at).slice(0, 10);
    const entry = dailyMap.get(day);
    if (entry) {
      entry.calls += 1;
      entry.costUsd += Number(r.estimated_cost_usd || 0);
    }
  });
  const daily = Array.from(dailyMap.entries()).map(([day, v]) => ({ day, calls: v.calls, costUsd: Math.round(v.costUsd * 1_000_000) / 1_000_000 }));

  // By paper — the actual "$/paper" figure the cost-reduction pass targets.
  const byPaperMap = new Map<string, { submissions: Set<string>; calls: number; costUsd: number }>();
  rows.forEach(r => {
    if (!r.paper_id) return;
    const entry = byPaperMap.get(r.paper_id) || { submissions: new Set<string>(), calls: 0, costUsd: 0 };
    if (r.submission_id) entry.submissions.add(r.submission_id);
    entry.calls += 1;
    entry.costUsd += Number(r.estimated_cost_usd || 0);
    byPaperMap.set(r.paper_id, entry);
  });

  const paperIdList = Array.from(byPaperMap.keys());
  const { data: papers } = paperIdList.length
    ? await supabaseAdmin.from('papers').select('id, title, class_name, subject_name').in('id', paperIdList)
    : { data: [] as { id: string; title: string | null; class_name: string | null; subject_name: string | null }[] };
  const paperMap = new Map((papers || []).map(p => [p.id, p]));

  const byPaper = paperIdList
    .map(paperId => {
      const entry = byPaperMap.get(paperId)!;
      const paper = paperMap.get(paperId);
      const submissionCount = entry.submissions.size;
      return {
        paper_id: paperId,
        title: paper?.title || 'Untitled paper',
        classSubject: [paper?.class_name, paper?.subject_name].filter(Boolean).join(' · '),
        submissions: submissionCount,
        calls: entry.calls,
        costUsd: Math.round(entry.costUsd * 1_000_000) / 1_000_000,
        avgCostPerSubmissionUsd: submissionCount > 0 ? Math.round((entry.costUsd / submissionCount) * 1_000_000) / 1_000_000 : 0,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 20);

  return { totals, byModel, byCallKind, escalationRatePct, daily, byPaper };
}

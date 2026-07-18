// app/api/checker/papers/route.ts
// Server-side (service-role) read for the checker's paper-level UI. All
// reads for /dashboard/checker/* go through routes like this one rather
// than direct browser-client Supabase queries — RLS on paper_layout_maps/
// submissions/students was found to reject even correctly-scoped
// ownership reads in this project for reasons that didn't reproduce
// through any of the standard causes (missing grants, missing policies,
// cross-table subqueries, even a SECURITY DEFINER helper function), so the
// app no longer depends on client-side RLS for these tables — the
// service-role client bypasses it entirely, same as every write already
// does.
//
// GET with no params: list the caller's papers, each with whether it has
// an MCQ layout map and its submission counts by status.
// GET ?paperId=: single paper detail + roster, for the submissions manager page.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { verifyPaperOwnership } from '@/lib/checker/ownership';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');

    if (paperId) {
      const ownership = await verifyPaperOwnership(paperId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

      const [{ data: layoutMap }, { data: roster }] = await Promise.all([
        supabaseAdmin.from('paper_layout_maps').select('id').eq('paper_id', paperId).limit(1).maybeSingle(),
        supabaseAdmin.from('students').select('id, full_name, roll_no').eq('owner_id', user.id).eq('is_active', true).order('full_name'),
      ]);

      return NextResponse.json({
        paper: ownership.paper,
        hasLayoutMap: Boolean(layoutMap),
        roster: roster || [],
      });
    }

    const { data: papers, error: papersErr } = await supabaseAdmin
      .from('papers')
      .select('id, title, class_name, subject_name, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    if (papersErr) return NextResponse.json({ error: papersErr.message }, { status: 500 });

    const paperIds = (papers || []).map(p => p.id);
    if (paperIds.length === 0) return NextResponse.json({ papers: [] });

    const [{ data: layoutMaps }, { data: submissions }] = await Promise.all([
      supabaseAdmin.from('paper_layout_maps').select('paper_id').in('paper_id', paperIds),
      supabaseAdmin.from('submissions').select('paper_id, status').in('paper_id', paperIds),
    ]);

    const mapSet = new Set((layoutMaps || []).map((m: any) => m.paper_id));
    const emptyCounts = () => ({ uploaded: 0, graded: 0, needsReview: 0, failed: 0, total: 0 });
    const countsByPaper: Record<string, ReturnType<typeof emptyCounts>> = {};
    for (const id of paperIds) countsByPaper[id] = emptyCounts();

    for (const s of (submissions || []) as { paper_id: string; status: string }[]) {
      const c = countsByPaper[s.paper_id];
      if (!c) continue;
      c.total += 1;
      if (s.status === 'uploaded' || s.status === 'processing') c.uploaded += 1;
      else if (s.status === 'graded' || s.status === 'finalized') c.graded += 1;
      else if (s.status === 'in_review') c.needsReview += 1;
      else if (s.status === 'failed') c.failed += 1;
    }

    const withMeta = (papers || []).map(p => ({
      ...p,
      hasLayoutMap: mapSet.has(p.id),
      counts: countsByPaper[p.id],
    }));

    return NextResponse.json({ papers: withMeta });
  } catch (error: any) {
    console.error('Error fetching checker papers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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
// an MCQ layout map and its submission counts by status. An academy owner
// additionally sees every paper created by any of their academy's members
// (with a createdByName tag so it's clear whose paper it is) — a plain
// teacher member only ever sees their own, same as before.
// GET ?paperId=: single paper detail + roster, for the submissions manager page.
//
// Requires the 'paper_checker' feature (admin/super_admin bypass) — this
// whole route only serves the checker UI.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifyPaperOwnership } from '@/lib/checker/ownership';

export async function GET(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(supabaseAdmin, user.id, 'paper_checker');
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');

    if (paperId) {
      const ownership = await verifyPaperOwnership(paperId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

      const [{ data: layoutMap }, { data: roster }, { data: creatorProfile }] = await Promise.all([
        supabaseAdmin.from('paper_layout_maps').select('id').eq('paper_id', paperId).limit(1).maybeSingle(),
        // The roster belongs to whoever actually created this paper, not
        // necessarily the caller — an academy owner viewing a member's
        // paper (or an admin viewing anyone's) must see THAT teacher's
        // class roster, not their own.
        supabaseAdmin.from('students').select('id, full_name, roll_no').eq('owner_id', ownership.paper.created_by).eq('is_active', true).order('full_name'),
        ownership.paper.created_by === user.id
          ? Promise.resolve({ data: null })
          : supabaseAdmin.from('profiles').select('full_name').eq('id', ownership.paper.created_by).maybeSingle(),
      ]);

      return NextResponse.json({
        paper: ownership.paper,
        hasLayoutMap: Boolean(layoutMap),
        roster: roster || [],
        createdByName: creatorProfile?.full_name ?? null,
      });
    }

    // Academy owners see every paper created by any member of their
    // academy (matches verifyPaperOwnership's own widening — a member row
    // exists for the owner too, but created_by === user.id already covers
    // that trivially). Plain members get just their own id here.
    let creatorIds = [user.id];
    let creatorNameById = new Map<string, string>();
    const { data: ownedAcademy } = await supabaseAdmin
      .from('academies')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (ownedAcademy) {
      const { data: memberRows } = await supabaseAdmin
        .from('academy_members')
        .select('user_id')
        .eq('academy_id', ownedAcademy.id);
      const memberIds = (memberRows || []).map(m => m.user_id);
      creatorIds = Array.from(new Set([user.id, ...memberIds]));

      if (memberIds.length > 0) {
        const { data: memberProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', memberIds);
        creatorNameById = new Map((memberProfiles || []).map(p => [p.id, p.full_name || 'Teacher']));
      }
    }

    const { data: papers, error: papersErr } = await supabaseAdmin
      .from('papers')
      .select('id, title, class_name, subject_name, created_at, created_by')
      .in('created_by', creatorIds)
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
      createdByName: p.created_by === user.id ? null : (creatorNameById.get(p.created_by) ?? null),
    }));

    return NextResponse.json({ papers: withMeta });
  } catch (error: any) {
    console.error('Error fetching checker papers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { searchParams } = new URL(req.url);
    const paperId = searchParams.get('paperId');

    if (paperId) {
      const ownership = await verifyPaperOwnership(paperId, user.id);
      if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

      const [{ data: layoutMap }, { data: roster }, { data: creatorProfile }, { data: checkedSubs }] = await Promise.all([
        supabaseAdmin.from('paper_layout_maps').select('id, page_count').eq('paper_id', paperId).order('version', { ascending: false }).limit(1).maybeSingle(),
        // The roster belongs to whoever actually created this paper, not
        // necessarily the caller — an academy owner viewing a member's
        // paper (or an admin viewing anyone's) must see THAT teacher's
        // class roster, not their own. class_name is selected too (but
        // stripped before the response below) purely to filter by the
        // paper's own class next.
        supabaseAdmin.from('students').select('id, full_name, roll_no, class_name').eq('owner_id', ownership.paper.created_by).eq('is_active', true).order('full_name'),
        // Always fetched (not just for a different-viewer academy case) —
        // `institution` is the WhatsApp result card's school-name source
        // (see whatsapp.ts's buildResultMessage), needed regardless of who
        // is viewing this page.
        supabaseAdmin.from('profiles').select('full_name, institution').eq('id', ownership.paper.created_by).maybeSingle(),
        // Students who already have a submission for THIS paper are dropped
        // from the roster below — once checked, they shouldn't keep showing
        // up in the "Add submission" picker for the same paper.
        supabaseAdmin.from('submissions').select('student_id').eq('paper_id', paperId).not('student_id', 'is', null),
      ]);

      const alreadyCheckedIds = new Set((checkedSubs || []).map((s: any) => s.student_id));
      // Both papers.class_name and students.class_name store the same bare
      // classes.name value (e.g. "9") with no formatting — see
      // PaperBuilderApp.tsx's save payload and the students class <select>
      // — so a plain trimmed comparison is enough, no normalization needed.
      // A student in Class 10 must never show up as pickable on a Class 9
      // paper's roster. If the paper has no usable class_name (blank, or
      // the "Unknown Class" fallback), class can't be used to filter, so
      // every student is left in rather than hiding the whole roster.
      const paperClass = (ownership.paper.class_name || '').trim();
      const classScoped = (paperClass && paperClass !== 'Unknown Class')
        ? (roster || []).filter(s => (s.class_name || '').trim() === paperClass)
        : (roster || []);
      const availableRoster = classScoped
        .filter(s => !alreadyCheckedIds.has(s.id))
        .map(({ id, full_name, roll_no }) => ({ id, full_name, roll_no }));

      return NextResponse.json({
        paper: ownership.paper,
        hasLayoutMap: Boolean(layoutMap),
        expectedPageCount: layoutMap?.page_count ?? null,
        roster: availableRoster,
        createdByName: ownership.paper.created_by === user.id ? null : (creatorProfile?.full_name ?? null),
        schoolName: creatorProfile?.institution ?? null,
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

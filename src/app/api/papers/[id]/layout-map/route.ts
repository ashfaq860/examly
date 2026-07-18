// app/api/papers/[id]/layout-map/route.ts
// Stores the generation-time MCQ bubble-sheet layout map (per-question
// bubble fractions, relative to the registration-square frame — see
// LAYOUT_MAP_FRAME_V2 in types/checker.ts) captured by PaperLayoutRenderer.
// Versioned — a new row is inserted with version = max(version)+1 rather
// than overwritten in place, so /api/checker/grade-mcq (which always reads
// the latest version) has a stable history to fall back on.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { McqLayoutMapPayload, LAYOUT_MAP_FRAME_V2 } from '@/types/checker';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const { id: paperId } = await params;
    if (!paperId) {
      return NextResponse.json({ error: 'Missing paper id' }, { status: 400 });
    }

    const { data: paper, error: paperErr } = await supabaseAdmin
      .from('papers')
      .select('id, created_by')
      .eq('id', paperId)
      .maybeSingle();

    if (paperErr || !paper) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }

    if (paper.created_by !== user.id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body: McqLayoutMapPayload = await req.json();
    const { frame, page_size, mcq_bubbles, answer_regions } = body || ({} as McqLayoutMapPayload);

    if (frame !== LAYOUT_MAP_FRAME_V2) {
      return NextResponse.json({ error: `frame must be '${LAYOUT_MAP_FRAME_V2}'` }, { status: 400 });
    }
    if (!Array.isArray(mcq_bubbles) || mcq_bubbles.length === 0) {
      return NextResponse.json({ error: 'mcq_bubbles is required and must be a non-empty array' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('paper_layout_maps')
      .select('version')
      .eq('paper_id', paperId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (existing?.version ?? 0) + 1;

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('paper_layout_maps')
      .insert({
        paper_id: paperId,
        version: nextVersion,
        page_size: page_size || 'A4',
        mcq_bubbles,
        answer_regions: answer_regions ?? null,
        frame,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ layoutMap: inserted });
  } catch (error: any) {
    console.error('Error saving MCQ layout map:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// app/api/papers/[id]/layout-map/route.ts
// Stores the generation-time MCQ bubble-sheet layout map — the template's
// own fiducial + bubble positions in absolute PDF points (origin top-left
// of the page), captured by PaperLayoutRenderer.tsx's captureMcqLayoutMap.
// See LAYOUT_MAP_FRAME_V3 in types/checker.ts for why point-space replaced
// the earlier registration-square-relative fractions (v2): it gives
// fiducial detection a real template shape to validate scanned candidates
// against, instead of generic size/shape filters alone.
// Versioned — a new row is inserted with version = max(version)+1 rather
// than overwritten in place, so grading (which always reads the latest
// version) has a stable history to fall back on.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { BubbleLayoutV3, LAYOUT_MAP_FRAME_V3 } from '@/types/checker';

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

    const body: BubbleLayoutV3 = await req.json();
    const { frame, page_size, template, fiducials, mcq_bubbles, page_count } = body || ({} as BubbleLayoutV3);

    if (frame !== LAYOUT_MAP_FRAME_V3) {
      return NextResponse.json({ error: `frame must be '${LAYOUT_MAP_FRAME_V3}'` }, { status: 400 });
    }
    if (!Array.isArray(mcq_bubbles) || mcq_bubbles.length === 0) {
      return NextResponse.json({ error: 'mcq_bubbles is required and must be a non-empty array' }, { status: 400 });
    }
    if (!Array.isArray(fiducials) || fiducials.length !== 4) {
      return NextResponse.json({ error: 'fiducials is required and must contain exactly 4 points (tl, tr, bl, br)' }, { status: 400 });
    }
    if (!template || !(template.width > 0) || !(template.height > 0)) {
      return NextResponse.json({ error: 'template.width/height (PDF points) are required' }, { status: 400 });
    }
    // page_size is display-only (never used for grading math — the
    // homography is fit from the fiducials, not this field), but a silent
    // default would still mislabel a Legal paper if the client ever
    // omitted it, so this rejects loudly instead of guessing.
    if (!page_size) {
      return NextResponse.json({ error: 'page_size is required' }, { status: 400 });
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
        page_size,
        mcq_bubbles,
        fiducials,
        template,
        page_count: page_count ?? null,
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

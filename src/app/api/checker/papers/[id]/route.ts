// app/api/checker/papers/[id]/route.ts
// PATCH-only: updates checker-specific paper settings — currently just
// excess_attempt_policy (src/lib/checker/gradeSubjective.ts's attempt-count
// enforcement). Merges into the paper's existing `settings` jsonb column
// (already used for typography settings — see PaperSettings in
// src/types/paperBuilderTypes.ts) rather than adding a new column.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifyPaperOwnership } from '@/lib/checker/ownership';

const VALID_POLICIES = ['first_n', 'grade_all_best_n'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: paperId } = await params;
    const ownership = await verifyPaperOwnership(paperId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    const body = await req.json();
    const policy = body?.excess_attempt_policy;
    if (!VALID_POLICIES.includes(policy)) {
      return NextResponse.json({ error: `excess_attempt_policy must be one of ${VALID_POLICIES.join(', ')}` }, { status: 400 });
    }

    const mergedSettings = { ...(ownership.paper.settings || {}), excessAttemptPolicy: policy };

    const { data: updated, error } = await supabaseAdmin
      .from('papers')
      .update({ settings: mergedSettings })
      .eq('id', paperId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ paper: updated });
  } catch (error: any) {
    console.error('Error updating paper checker settings:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

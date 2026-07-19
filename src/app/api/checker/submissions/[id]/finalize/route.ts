// app/api/checker/submissions/[id]/finalize/route.ts
// Locks a submission once the teacher is done reviewing it. Re-checks
// server-side that no needs_review answers remain — never trusts the
// client-side button-disabled state alone for a state-changing action.
// Requires the 'paper_checker' feature (admin/super_admin bypass).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(supabaseAdmin, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: submissionId } = await params;
    const ownership = await verifySubmissionOwnership(submissionId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    if (ownership.submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized' }, { status: 409 });
    }

    const { count, error: countErr } = await supabaseAdmin
      .from('submission_answers')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submissionId)
      .eq('needs_review', true);

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((count || 0) > 0) {
      return NextResponse.json({ error: `${count} answer(s) still need review before finalizing` }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ status: 'finalized', finalized_at: new Date().toISOString(), finalized_by: user.id })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ submission: updated });
  } catch (error: any) {
    console.error('Error finalizing submission:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

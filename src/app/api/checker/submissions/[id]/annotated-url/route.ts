// app/api/checker/submissions/[id]/annotated-url/route.ts
// Signs a fresh URL to a submission's annotated (ticks + red deduction
// comments) PDF on demand — used by the bulk WhatsApp sender, which needs
// one per recipient only at the moment it's about to send, rather than
// signing every row's URL upfront on every list page load (the single-
// submission review page instead gets this folded into its one GET, since
// it only ever needs its own submission's URL).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { getSignedScanUrl } from '@/lib/checker/scanStorage';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: submissionId } = await params;
    const ownership = await verifySubmissionOwnership(submissionId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    const path = ownership.submission.annotated_pdf_path;
    if (!path) return NextResponse.json({ url: null });

    const url = await getSignedScanUrl(path, 3600);
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error signing annotated PDF URL:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

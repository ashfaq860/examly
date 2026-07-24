// app/api/checker/submissions/init/route.ts
// First half of the direct-to-storage upload flow: creates the submission
// row and hands back signed upload URLs so the client (AddSubmissionForm)
// uploads scan bytes straight to Supabase Storage instead of proxying them
// through a Next.js API route body — the old multipart POST here doubled
// every upload's transfer (client -> this server -> storage) for no
// reason other than that being the first flow that got built. The client
// finishes by calling [id]/complete with the paths it actually uploaded.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifyPaperOwnership, verifyStudentOwnership } from '@/lib/checker/ownership';
import { DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';

interface SignedUpload { path: string; token: string; signedUrl: string }

async function signUploadUrl(path: string): Promise<SignedUpload> {
  const { data, error } = await supabaseAdmin.storage.from(DEFAULT_SCAN_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message || `Failed to sign upload URL for ${path}`);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const body = await req.json();
    const { paperId, kind, count, student_id, student_name, roll_no } = body || {};
    if (!paperId) return NextResponse.json({ error: 'Missing paperId' }, { status: 400 });
    if (kind !== 'images' && kind !== 'pdf') return NextResponse.json({ error: "kind must be 'images' or 'pdf'" }, { status: 400 });
    if (kind === 'images' && (!Number.isInteger(count) || count < 1)) {
      return NextResponse.json({ error: 'count must be a positive integer for kind=images' }, { status: 400 });
    }

    const ownership = await verifyPaperOwnership(paperId, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    // student_id arrives from the client and becomes a stored FK read back
    // (with the student's WhatsApp number) by every later submissions
    // lookup — without this check a teacher could link a submission to
    // another teacher's student and exfiltrate that student's contact
    // info through the otherwise-correctly-owner-scoped submissions routes.
    if (student_id) {
      const studentOwnership = await verifyStudentOwnership(student_id, user.id);
      if (!studentOwnership.authorized) {
        return NextResponse.json({ error: studentOwnership.message }, { status: studentOwnership.status });
      }
    }

    const { data: created, error: insertErr } = await supabaseAdmin
      .from('submissions')
      .insert({
        paper_id: paperId,
        student_id: student_id || null,
        student_name_raw: (student_name || '').trim() || null,
        roll_no_raw: (roll_no || '').trim() || null,
        uploaded_by: user.id,
        scan_urls: [],
        status: 'uploaded',
      })
      .select()
      .single();
    if (insertErr || !created) {
      return NextResponse.json({ error: insertErr?.message || 'Failed to create submission' }, { status: 500 });
    }

    try {
      if (kind === 'pdf') {
        const upload = await signUploadUrl(`${paperId}/${created.id}/upload.pdf`);
        return NextResponse.json({ submissionId: created.id, bucket: DEFAULT_SCAN_BUCKET, upload });
      }
      const uploads = await Promise.all(
        Array.from({ length: count }, (_, i) => signUploadUrl(`${paperId}/${created.id}/${i}.jpg`))
      );
      return NextResponse.json({ submissionId: created.id, bucket: DEFAULT_SCAN_BUCKET, uploads });
    } catch (e: any) {
      // Couldn't hand back usable upload URLs — don't leave an empty
      // submission row behind for the client to have to clean up.
      await supabaseAdmin.from('submissions').delete().eq('id', created.id);
      return NextResponse.json({ error: e.message || 'Failed to prepare upload' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error initializing submission upload:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

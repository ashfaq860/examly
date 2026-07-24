// app/api/checker/submissions/[id]/complete/route.ts
// Second half of the direct-to-storage upload flow (see init/route.ts):
// the client has already uploaded scan bytes straight to Supabase Storage
// via signed upload URLs — this just finalizes the submission row.
//
// Images: the client already produced final per-page JPEGs (downscaled
// client-side) and uploaded them directly — this only needs to record
// their paths as scan_urls.
//
// PDF: pdfium/pdfjs are native/WASM and can't run in the browser, so the
// one raw PDF the client uploaded still has to be rasterized here. Its
// real page count — read via pdf-lib's PDFDocument.getPageCount(), never
// inferred from physical page dimensions — is cross-checked against the
// rasterizer's own output length as an explicit invariant, not an implicit
// one: a mismatch here would mean the rasterizer silently dropped or
// duplicated a page, which should never happen but is worth failing loudly
// on rather than shipping a wrong page count downstream.
export const runtime = 'nodejs';
export const maxDuration = 60; // PDF rasterization of a several-page paper can take a few seconds

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { downloadScan, DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';
import { rasterizePdfToImages } from '@/lib/checker/pdfRasterize';

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
    const submission = ownership.submission;

    const body = await req.json();
    const paths: string[] | undefined = Array.isArray(body?.paths) ? body.paths : undefined;
    const pdfPath: string | undefined = typeof body?.pdfPath === 'string' ? body.pdfPath : undefined;

    // Every path must actually belong to this submission's own storage
    // prefix — the signed-upload-url step already scoped what the client
    // COULD write to, this just makes sure it's reporting back paths from
    // that same prefix rather than something else in the bucket.
    const prefix = `${submission.paper_id}/${submissionId}/`;
    const belongsToSubmission = (p: string) => p.startsWith(prefix);

    let scanUrls: string[];

    if (pdfPath) {
      if (!belongsToSubmission(pdfPath)) return NextResponse.json({ error: 'Invalid pdfPath' }, { status: 400 });

      const pdfBytes = await downloadScan(pdfPath);
      const [rasterized, pdfLibDoc] = await Promise.all([
        rasterizePdfToImages(pdfBytes),
        PDFDocument.load(pdfBytes).catch(() => null),
      ]);
      if (rasterized.length === 0) {
        return NextResponse.json({ error: 'PDF has no pages' }, { status: 400 });
      }
      const truePageCount = pdfLibDoc?.getPageCount();
      if (truePageCount != null && truePageCount !== rasterized.length) {
        return NextResponse.json({ error: `Rasterized ${rasterized.length} page(s) but the PDF reports ${truePageCount} — please re-upload` }, { status: 500 });
      }

      const uploadedPaths: string[] = [];
      for (let i = 0; i < rasterized.length; i++) {
        const path = `${submission.paper_id}/${submissionId}/${i}.jpg`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(DEFAULT_SCAN_BUCKET)
          .upload(path, rasterized[i], { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) {
          if (uploadedPaths.length > 0) await supabaseAdmin.storage.from(DEFAULT_SCAN_BUCKET).remove(uploadedPaths).catch(() => {});
          return NextResponse.json({ error: `Failed to store rasterized page ${i + 1}: ${uploadErr.message}` }, { status: 500 });
        }
        uploadedPaths.push(path);
      }
      await supabaseAdmin.storage.from(DEFAULT_SCAN_BUCKET).remove([pdfPath]).catch(() => {}); // temp raw upload, no longer needed
      scanUrls = uploadedPaths;
    } else if (paths && paths.length > 0) {
      if (!paths.every(belongsToSubmission)) return NextResponse.json({ error: 'Invalid scan path' }, { status: 400 });
      scanUrls = paths;
    } else {
      return NextResponse.json({ error: 'Provide either paths (images) or pdfPath' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ scan_urls: scanUrls })
      .eq('id', submissionId)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ submission: updated });
  } catch (error: any) {
    console.error('Error completing submission upload:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

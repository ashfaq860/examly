// Resolves a submissions.scan_urls[] entry to a downloadable/viewable
// storage object. Entries may be a bare object path within the
// 'submission-scans' bucket (the default convention for this phase) or a
// full Supabase public/signed URL (in case a future upload flow stores
// those instead) — mirrors the URL-parsing already used by
// papers/delete/route.ts.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { describeClaudeError, isRetryableErrorKind } from '@/lib/checker/claude';

export const DEFAULT_SCAN_BUCKET = 'submission-scans';

export function resolveScanPath(scanUrl: string): { bucket: string; path: string } {
  const publicMarker = '/storage/v1/object/public/';
  const signMarker = '/storage/v1/object/sign/';

  for (const marker of [publicMarker, signMarker]) {
    const idx = scanUrl.indexOf(marker);
    if (idx !== -1) {
      const rest = scanUrl.slice(idx + marker.length).split('?')[0];
      const bucket = rest.split('/')[0];
      const path = rest.slice(bucket.length + 1);
      return { bucket, path };
    }
  }

  // Not a recognizable Supabase Storage URL — treat as a bare path in the
  // default bucket.
  return { bucket: DEFAULT_SCAN_BUCKET, path: scanUrl.replace(/^\/+/, '') };
}

// Delay before attempt 2 and attempt 3 respectively (exponential-ish) — 3
// attempts total. The Supabase Storage JS client has no retry of its own,
// so a transient network blip (the same class of connection failure the
// Anthropic SDK retries automatically — see claude.ts's maxRetries) would
// otherwise kill grading outright on the first try. Every caller of
// downloadScan is already on the hot path of a grading attempt that's
// expensive to redo from scratch, so absorbing a couple of flaky attempts
// here is cheap insurance against exactly that class of failure.
const DOWNLOAD_RETRY_DELAYS_MS = [250, 750];

/** A real HTTP response came back (a `status` is present on the Supabase
 *  error) — e.g. a 400/404 for a bad path or a missing object. Retrying
 *  won't change that; it'll fail identically every time. Only the
 *  connection-level "never got a response at all" case (Supabase's
 *  StorageUnknownError, wrapping a raw fetch failure with no `status`) is
 *  worth a fresh attempt. */
function isRetryableStorageError(error: unknown): boolean {
  return typeof (error as { status?: unknown } | null)?.status !== 'number';
}

export async function downloadScan(scanUrl: string): Promise<Buffer> {
  const { bucket, path } = resolveScanPath(scanUrl);
  let lastSummary = 'no data returned';
  let lastCode: string | null = null;

  for (let attempt = 0; attempt <= DOWNLOAD_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, DOWNLOAD_RETRY_DELAYS_MS[attempt - 1]));

    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    if (!error) continue; // no error object but also no data — retry, same as before

    // Supabase's StorageUnknownError stores the raw caught error (the
    // undici fetch failure) on `.originalError`, not the standard `.cause`
    // — reusing describeClaudeError's own cause-chain walk from there
    // surfaces the real ECONNRESET/ETIMEDOUT/ENOTFOUND/etc. instead of
    // Supabase's own generic wrapper message.
    const info = describeClaudeError((error as { originalError?: unknown }).originalError ?? error);
    lastSummary = info.summary;
    lastCode = info.code;
    if (!isRetryableStorageError(error) || !isRetryableErrorKind(info.kind)) break;
  }

  throw Object.assign(new Error(`Failed to download scan '${scanUrl}': ${lastSummary}`), { code: lastCode });
}

/** Short-lived signed URL for VIEWING a scan from the private bucket — the
 *  only way a scan image is ever exposed to the client (never a public
 *  URL). Defaults to 5 minutes, plenty for a review-screen page load. */
export async function getSignedScanUrl(scanUrl: string, expiresInSeconds = 300): Promise<string> {
  const { bucket, path } = resolveScanPath(scanUrl);
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign scan URL '${scanUrl}': ${error?.message || 'no signed URL returned'}`);
  }
  return data.signedUrl;
}

// Resolves a submissions.scan_urls[] entry to a downloadable/viewable
// storage object. Entries may be a bare object path within the
// 'submission-scans' bucket (the default convention for this phase) or a
// full Supabase public/signed URL (in case a future upload flow stores
// those instead) — mirrors the URL-parsing already used by
// papers/delete/route.ts.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

export async function downloadScan(scanUrl: string): Promise<Buffer> {
  const { bucket, path } = resolveScanPath(scanUrl);
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(`Failed to download scan '${scanUrl}': ${error?.message || 'no data returned'}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

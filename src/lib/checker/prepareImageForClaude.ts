// Server-side, COLOR-preserving downscale+re-encode for any image about to
// be base64'd and sent to Claude's vision input — a defensive backstop,
// not a duplicate of downscaleImage.ts (which does the same 1568px/JPEG
// q0.8 resize but is browser-only: canvas, createImageBitmap, can't run in
// Node). Client-side downscaling happens on every current upload path, but
// relying on that ALONE as the only size guarantee is fragile: a network
// hiccup mid-resize, a future upload path that forgets to call it, or a
// recapture flow could all send a full-resolution photo straight through
// to grading otherwise. Every image downloadScan() fetches for a Claude
// call goes through this regardless of what the client already did, so
// the guarantee holds no matter how the bytes got into storage.
//
// Not reused from imaging.ts's loadGrayscale — that function is grayscale-
// only (built for OMR bubble detection), which would strip the color
// information the vision model can actually use to read handwriting.
import sharp from 'sharp';

/** Anthropic downscales any image beyond ~1568px on its long edge before
 *  the model ever sees it — sending anything larger just spends encode/
 *  upload time and timeout risk on pixels that get thrown away
 *  server-side. Matches downscaleImage.ts's own client-side default, so
 *  server and client agree on the same ceiling. */
export const CLAUDE_IMAGE_MAX_DIMENSION_PX = 1568;
/** JPEG quality (0-100) — matches downscaleImage.ts's own client-side
 *  default (0.8 there, same scale here). */
export const CLAUDE_IMAGE_JPEG_QUALITY = 80;

/** Downscales `buffer` to at most CLAUDE_IMAGE_MAX_DIMENSION_PX on its long
 *  edge and re-encodes as JPEG at CLAUDE_IMAGE_JPEG_QUALITY. Applies EXIF
 *  rotation first (same as imaging.ts's loadGrayscale) so a portrait phone
 *  photo doesn't get graded sideways. Never enlarges an already-smaller
 *  image. */
export async function prepareImageForClaude(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: CLAUDE_IMAGE_MAX_DIMENSION_PX,
      height: CLAUDE_IMAGE_MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: CLAUDE_IMAGE_JPEG_QUALITY })
    .toBuffer();
}

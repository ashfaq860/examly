// Browser-only: downscales a phone-camera photo before upload. Phone
// cameras routinely produce 12MP+ JPEGs — far more resolution than either
// OMR bubble detection (grade-mcq works off a ~1600px working copy) or
// Claude's vision input needs (Anthropic downscales images beyond ~1568px
// on its own long edge before the model ever sees them, so uploading
// anything larger just spends bandwidth encoding pixels that get thrown
// away server-side) — so shrinking client-side to that same ceiling keeps
// uploads fast on slower mobile networks without losing anything the model
// would have used. Import this only from client components.

export interface DownscaleOptions {
  /** Cap on the longer edge, in pixels. Defaults to 1568 — Anthropic's own
   *  long-edge downscale threshold, so nothing larger is wasted upload. */
  maxDimension?: number;
  /** JPEG quality, 0-1. Defaults to 0.8. */
  quality?: number;
}

/** Decodes `file` respecting EXIF orientation where the browser supports
 *  it (createImageBitmap's imageOrientation option), falling back to a
 *  plain <img> element otherwise. */
async function decodeImage(file: File): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> path below (e.g. unsupported image type).
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image'));
      el.src = objectUrl;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Downscales an image File to at most `maxDimension` on its long edge and
 *  re-encodes as JPEG at `quality`. Returns the original file unchanged if
 *  it's already smaller than the cap. */
export async function downscaleImage(file: File, opts: DownscaleOptions = {}): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1568;
  const quality = opts.quality ?? 0.8;

  const decoded = await decodeImage(file);
  try {
    const longest = Math.max(decoded.width, decoded.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const targetW = Math.max(1, Math.round(decoded.width * scale));
    const targetH = Math.max(1, Math.round(decoded.height * scale));

    if (scale === 1 && file.type === 'image/jpeg') return file;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    decoded.draw(ctx, targetW, targetH);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    decoded.close?.();
  }
}

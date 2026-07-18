// Pure-pixel-buffer image processing for OMR grading: no CV library, just
// sharp for decode/grayscale/resize, plus hand-rolled Otsu thresholding,
// connected-component blob detection, and darkness sampling.
//
// First-pass constants below are grouped here for easy tuning once this is
// tested against real scanned/photographed sheets — detector thresholds
// like these reliably need a calibration pass against real samples.
import sharp from 'sharp';

export interface GrayImage {
  /** Single-channel grayscale pixels, 0 (black) - 255 (white), row-major. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface SquareBlob {
  cx: number;
  cy: number;
  size: number;
}

export const MAX_DIMENSION_PX = 1600;

const SHAPE_FILTERS = {
  minAspect: 0.6,
  maxAspect: 1.6,
  minFillRatio: 0.55,
  minCornerDarkFraction: 0.55,
  minSizeFraction: 0.006, // relative to min(width, height)
  maxSizeFraction: 0.12,
};

const DARKNESS = {
  sampleRadiusFraction: 0.75, // stay inside a bubble's own printed ring
};

/** Decodes an image buffer to a resized (max ~1600px side), grayscale raster. */
export async function loadGrayscale(buffer: Buffer): Promise<GrayImage> {
  const { data, info } = await sharp(buffer)
    .rotate() // apply EXIF orientation, if any
    .resize({ width: MAX_DIMENSION_PX, height: MAX_DIMENSION_PX, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // drop alpha to a known white background before grayscale
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 1) {
    throw new Error(`loadGrayscale: expected 1 channel after grayscale(), got ${info.channels}`);
  }

  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

/** Otsu's method: finds the threshold that best separates a bimodal histogram. */
export function otsuThreshold(data: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;

  const total = data.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];

  let sumB = 0;
  let weightB = 0;
  let varMax = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * hist[t];
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const varBetween = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

interface RawBlob {
  minX: number; maxX: number; minY: number; maxY: number;
  area: number; cx: number; cy: number;
}

/** Flood-fills every 4-connected region at or below `threshold` (iterative BFS, no recursion). */
function findDarkBlobs(data: Uint8ClampedArray, width: number, height: number, threshold: number): RawBlob[] {
  const visited = new Uint8Array(width * height);
  const blobs: RawBlob[] = [];
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || data[idx] > threshold) continue;

      let head = 0;
      let tail = 0;
      qx[tail] = x; qy[tail] = y; tail++;
      visited[idx] = 1;

      let minX = x, maxX = x, minY = y, maxY = y, area = 0, sumX = 0, sumY = 0;

      while (head < tail) {
        const cx = qx[head], cy = qy[head];
        head++;
        area++; sumX += cx; sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors: [number, number][] = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nidx = ny * width + nx;
          if (visited[nidx] || data[nidx] > threshold) continue;
          visited[nidx] = 1;
          qx[tail] = nx; qy[tail] = ny; tail++;
        }
      }

      blobs.push({ minX, maxX, minY, maxY, area, cx: sumX / area, cy: sumY / area });
    }
  }
  return blobs;
}

/** Fraction of dark pixels in small patches at all 4 corners of a bbox — distinguishes a
 *  filled SQUARE (dark corners) from a filled CIRCLE (light/empty corners) of similar size. */
function cornerDarkFraction(
  data: Uint8ClampedArray, width: number, height: number,
  minX: number, maxX: number, minY: number, maxY: number, threshold: number,
): number {
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const patch = Math.max(1, Math.round(Math.min(w, h) * 0.25));
  const corners: [number, number][] = [
    [minX, minY], [maxX - patch + 1, minY], [minX, maxY - patch + 1], [maxX - patch + 1, maxY - patch + 1],
  ];

  let dark = 0;
  let total = 0;
  for (const [cx0, cy0] of corners) {
    for (let y = cy0; y < cy0 + patch; y++) {
      for (let x = cx0; x < cx0 + patch; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        total++;
        if (data[y * width + x] <= threshold) dark++;
      }
    }
  }
  return total === 0 ? 0 : dark / total;
}

/**
 * Finds the 4 solid black registration squares in a scanned image. Returns
 * an empty array if fewer than 4 plausible candidates are found (caller
 * should try the next scan page, or fail the submission).
 */
export function detectSquareBlobs(img: GrayImage): SquareBlob[] {
  const { data, width, height } = img;
  const threshold = otsuThreshold(data);
  const blobs = findDarkBlobs(data, width, height, threshold);

  const minSide = Math.min(width, height);
  const minSizePx = minSide * SHAPE_FILTERS.minSizeFraction;
  const maxSizePx = minSide * SHAPE_FILTERS.maxSizeFraction;

  const scored = blobs.map(b => {
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;
    const fillRatio = b.area / (w * h);
    const aspect = w / h;
    const cornerDark = cornerDarkFraction(data, width, height, b.minX, b.maxX, b.minY, b.maxY, threshold);
    return { ...b, w, h, fillRatio, aspect, cornerDark };
  });

  // TEMPORARY DIAGNOSTIC — remove once the false-positive-candidate issue
  // is root-caused. Logs the 30 LARGEST dark blobs (not just ones that pass
  // the shape filters below) with their measurements and which specific
  // criterion each failed, if any — bounded by size-rank rather than a
  // total-blob-count cutoff, so a real (large) registration square being
  // wrongly excluded always shows up, regardless of how many small/noise
  // blobs (text, bubble rings, etc.) the image also contains.
  if (blobs.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[GRADE-DEBUG] detectSquareBlobs: image=${width}x${height} minSide=${minSide} threshold=${threshold} sizeRangePx=[${minSizePx.toFixed(1)},${maxSizePx.toFixed(1)}] totalBlobs=${blobs.length}`);
    scored
      .sort((a, b) => (b.w + b.h) - (a.w + a.h))
      .slice(0, 30)
      .forEach(b => {
        const fails: string[] = [];
        if (!(b.w >= minSizePx && b.w <= maxSizePx)) fails.push(`width(${b.w})`);
        if (!(b.h >= minSizePx && b.h <= maxSizePx)) fails.push(`height(${b.h})`);
        if (!(b.aspect >= SHAPE_FILTERS.minAspect && b.aspect <= SHAPE_FILTERS.maxAspect)) fails.push(`aspect(${b.aspect.toFixed(2)})`);
        if (!(b.fillRatio >= SHAPE_FILTERS.minFillRatio)) fails.push(`fillRatio(${b.fillRatio.toFixed(2)})`);
        if (!(b.cornerDark >= SHAPE_FILTERS.minCornerDarkFraction)) fails.push(`cornerDark(${b.cornerDark.toFixed(2)})`);
        // eslint-disable-next-line no-console
        console.log(`[GRADE-DEBUG]   blob cx=${b.cx.toFixed(1)} cy=${b.cy.toFixed(1)} w=${b.w} h=${b.h} fillRatio=${b.fillRatio.toFixed(2)} aspect=${b.aspect.toFixed(2)} cornerDark=${b.cornerDark.toFixed(2)} ${fails.length ? `FAILS: ${fails.join(', ')}` : 'PASSES ALL FILTERS'}`);
      });
  }

  const candidates = scored.filter(b =>
    b.w >= minSizePx && b.w <= maxSizePx &&
    b.h >= minSizePx && b.h <= maxSizePx &&
    b.aspect >= SHAPE_FILTERS.minAspect && b.aspect <= SHAPE_FILTERS.maxAspect &&
    b.fillRatio >= SHAPE_FILTERS.minFillRatio &&
    b.cornerDark >= SHAPE_FILTERS.minCornerDarkFraction
  );

  if (candidates.length < 4) return [];

  // Registration squares are deliberately the largest solid black squares on
  // the sheet — everything else that can pass the shape filters (bubble
  // rings, option-letter glyphs, anti-aliasing/scan noise specks) is small,
  // and tiny noise specks vastly outnumber the 4 real squares. That made a
  // "pick the 4 candidates closest to the median size" heuristic unreliable:
  // with hundreds of noise-sized candidates and only 4 real squares, the
  // median itself gets dragged down to noise size, so it picked 4 specks
  // instead of the actual squares. Picking the 4 LARGEST candidates is
  // robust instead, since nothing else on the sheet is designed to be this
  // large a solid square.
  const ranked = [...candidates].sort((a, b) => (b.w + b.h) - (a.w + a.h));

  return ranked.slice(0, 4).map(b => ({ cx: b.cx, cy: b.cy, size: (b.w + b.h) / 2 }));
}

/**
 * Labels exactly 4 detected squares as tl/tr/bl/br by which quadrant they
 * fall in RELATIVE TO THE MEAN of all 4 centroids — never by sorting
 * order. A sort-then-split-in-half approach (e.g. "top two by y") can
 * misclassify under real photo skew/rotation, where one corner's y can end
 * up closer to its diagonal opposite's y than to its true row-mate's;
 * classifying each point independently against the centroid mean is stable
 * under that kind of moderate skew since it doesn't depend on relative
 * ranking among only 4 points. Returns null (ambiguous) if any quadrant
 * doesn't have exactly one point in it.
 */
export function labelCorners(squares: SquareBlob[]): Record<'tl' | 'tr' | 'bl' | 'br', SquareBlob> | null {
  if (squares.length !== 4) return null;

  const meanX = squares.reduce((sum, b) => sum + b.cx, 0) / 4;
  const meanY = squares.reduce((sum, b) => sum + b.cy, 0) / 4;

  const tl = squares.filter(b => b.cx < meanX && b.cy < meanY);
  const tr = squares.filter(b => b.cx >= meanX && b.cy < meanY);
  const bl = squares.filter(b => b.cx < meanX && b.cy >= meanY);
  const br = squares.filter(b => b.cx >= meanX && b.cy >= meanY);

  if (tl.length !== 1 || tr.length !== 1 || bl.length !== 1 || br.length !== 1) return null;

  return { tl: tl[0], tr: tr[0], bl: bl[0], br: br[0] };
}

/** Mean normalized darkness (0 = white/unmarked, 1 = solid black) within a disk. */
export function sampleDarkness(img: GrayImage, cx: number, cy: number, r: number): number {
  const { data, width, height } = img;
  const sampleR = r * DARKNESS.sampleRadiusFraction;
  const minX = Math.max(0, Math.floor(cx - sampleR));
  const maxX = Math.min(width - 1, Math.ceil(cx + sampleR));
  const minY = Math.max(0, Math.floor(cy - sampleR));
  const maxY = Math.min(height - 1, Math.ceil(cy + sampleR));

  let sum = 0;
  let count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > sampleR * sampleR) continue;
      sum += data[y * width + x];
      count++;
    }
  }
  if (count === 0) return 0;
  const meanIntensity = sum / count;
  return 1 - meanIntensity / 255;
}

/**
 * Composites an SVG overlay onto a COLOR copy of `buffer`, resized/rotated
 * the exact same way loadGrayscale() prepares its working image (same EXIF
 * rotate, same max-1600px inside-fit resize) — so debug markers built from
 * loadGrayscale's own pixel coordinates land in the right place. Used only
 * for the optional grade-mcq?debug=1 diagnostic composite; real grading
 * never calls this.
 */
export async function renderDebugComposite(buffer: Buffer, svgOverlay: string): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION_PX, height: MAX_DIMENSION_PX, fit: 'inside', withoutEnlargement: true })
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

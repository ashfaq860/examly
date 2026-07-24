// Shared template<->scan alignment — the ONE place both bubble detection
// (read.ts) and PDF annotation (annotatePdf.ts) turn a template-space PDF
// point into a pixel on a specific scanned image, and back. Detector and
// annotator can never independently disagree about where something is,
// because they both call through here with the same inputs (annotation
// re-derives its alignment from a submission's PERSISTED graded_fiducials
// rather than re-running detection — see annotatePdf.ts — so it's not just
// "the same code," it's the literal same fitted transform).
import { GrayImage, SquareBlob, detectSquareBlobs, labelCorners } from '@/lib/checker/imaging';
import { solveHomography, applyHomography, localScale as fitLocalScale, Point, Homography } from '@/lib/checker/geometry';
import { TemplatePoint, BubbleLayoutV3 } from '@/types/checker';

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;
export type Corner = typeof CORNERS[number];

// How much a candidate quadrilateral's aspect ratio may differ (as a
// ratio, not a percentage difference) from the TEMPLATE's own known
// fiducial-rectangle aspect ratio before it's rejected. Real photos
// introduce some perspective/skew, so this can't be too tight — but a
// false positive elsewhere on the page (a logo, a heavy glyph) essentially
// never happens to reproduce the template's specific rectangle shape by
// chance, which is the whole point of validating against it instead of
// generic shape filters alone.
export const ASPECT_TOLERANCE = 1.35;
// The 4 real fiducials are printed at identical physical size — how much
// the 4 CHOSEN candidates' own sizes may vary relative to each other.
export const SIZE_TOLERANCE = 1.6;
// How far the 4th corner (br) may sit from where tl/tr/bl predict it
// should be (parallelogram law: br = tr + bl - tl), as a fraction of the
// frame's own diagonal. tl/tr/bl alone define the aspect ratio checked
// above WITHOUT br (br is redundant for a perfect, unrotated rectangle —
// see PaperLayoutRenderer.tsx's own capture-time comment), which means a
// false positive that merely happens to sit somewhere in the "4th
// quadrant" relative to 3 real fiducials would sail through the aspect
// check alone. This catches that case specifically.
export const BR_TOLERANCE_FRACTION = 0.15;
// Cap on candidates tried in combination — C(15,4) = 1365, cheap. Real
// fiducials are always within detectSquareBlobs's own top-20 cap; this
// trims further so the combination search stays fast even on a noisy scan.
const MAX_CANDIDATES_FOR_SEARCH = 15;

export interface Alignment {
  transformPoint(p: TemplatePoint): Point;
  inverseTransformPoint(p: Point): TemplatePoint;
  /** Local pixel-per-template-point scale at `p` — converts a bubble's
   *  template-space radius into an image-pixel radius for sampleDarkness. */
  localScale(p: TemplatePoint): number;
}

function rectShape(tl: Point, tr: Point, bl: Point): { width: number; height: number; aspect: number } {
  const width = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const height = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  return { width, height, aspect: height === 0 ? Infinity : width / height };
}

function combinations4<T>(items: T[]): T[][] {
  const out: T[][] = [];
  const n = items.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          out.push([items[a], items[b], items[c], items[d]]);
  return out;
}

/** Finds the 4 real fiducial squares among candidate blobs by matching the
 *  SHAPE their arrangement forms against the template's own known fiducial
 *  rectangle — not just "4 similarly-sized blobs," which a false positive
 *  (a logo, a heavy glyph) can still pass. Returns null (never a guess) if
 *  no combination of the detected candidates qualifies; the caller's
 *  "could not detect registration marks" path handles that. */
export function detectFiducials(
  gray: GrayImage,
  layout: Pick<BubbleLayoutV3, 'fiducials'>,
): Record<Corner, SquareBlob> | null {
  const candidates = detectSquareBlobs(gray).slice(0, MAX_CANDIDATES_FOR_SEARCH);
  if (candidates.length < 4) return null;

  const [tl, tr, bl] = layout.fiducials; // stored tl,tr,bl,br — br (index 3) unused here
  const wantShape = rectShape(tl, tr, bl);

  let best: { labeled: Record<Corner, SquareBlob>; sizeScore: number } | null = null;

  for (const combo of combinations4(candidates)) {
    const labeled = labelCorners(combo);
    if (!labeled) continue; // not exactly one candidate per quadrant — not a valid rectangle

    const sizes = combo.map(b => b.size);
    if (Math.max(...sizes) / Math.min(...sizes) > SIZE_TOLERANCE) continue;

    const tlP: Point = { x: labeled.tl.cx, y: labeled.tl.cy };
    const trP: Point = { x: labeled.tr.cx, y: labeled.tr.cy };
    const blP: Point = { x: labeled.bl.cx, y: labeled.bl.cy };
    const brP: Point = { x: labeled.br.cx, y: labeled.br.cy };

    const gotShape = rectShape(tlP, trP, blP);
    const aspectDeviation = gotShape.aspect > wantShape.aspect ? gotShape.aspect / wantShape.aspect : wantShape.aspect / gotShape.aspect;
    if (aspectDeviation > ASPECT_TOLERANCE) continue;

    // br must be consistent with tl/tr/bl forming a (near-)parallelogram
    // — tl/tr/bl alone can't rule out a false positive that merely
    // happens to sit somewhere past the tl/tr/bl centroid (the "4th
    // quadrant"), since the aspect check above never looks at br.
    const expectedBr: Point = { x: trP.x + blP.x - tlP.x, y: trP.y + blP.y - tlP.y };
    const brError = Math.hypot(brP.x - expectedBr.x, brP.y - expectedBr.y);
    const frameDiagonal = Math.hypot(gotShape.width, gotShape.height);
    if (frameDiagonal === 0 || brError / frameDiagonal > BR_TOLERANCE_FRACTION) continue;

    // Among every combination that matches the template's shape, prefer
    // the largest (more sampled pixels = a more reliable centroid fit).
    const sizeScore = sizes.reduce((s, x) => s + x, 0);
    if (!best || sizeScore > best.sizeScore) best = { labeled, sizeScore };
  }

  return best?.labeled ?? null;
}

/** Fits the template -> scan-pixel transform from the template's own
 *  fiducial points to their detected pixel centroids (fixed tl/tr/bl/br
 *  order both sides). `detected` can come fresh from detectFiducials, OR
 *  from a submission's persisted `graded_fiducials` — annotatePdf.ts uses
 *  the latter specifically so it never re-runs detection and can't
 *  possibly land on a different alignment than grading did. */
export function fitAlignment(
  detected: Record<Corner, { cx: number; cy: number }>,
  layout: Pick<BubbleLayoutV3, 'fiducials'>,
): Alignment | null {
  const srcPoints: Point[] = CORNERS.map((_, i) => layout.fiducials[i]);
  const dstPoints: Point[] = CORNERS.map(c => ({ x: detected[c].cx, y: detected[c].cy }));

  let forward: Homography;
  let inverse: Homography;
  try {
    forward = solveHomography(srcPoints, dstPoints);
    inverse = solveHomography(dstPoints, srcPoints);
  } catch {
    return null; // degenerate (collinear/duplicate) point configuration
  }

  return {
    transformPoint: (p) => applyHomography(forward, p),
    inverseTransformPoint: (p) => applyHomography(inverse, p),
    localScale: (p) => fitLocalScale(forward, p),
  };
}

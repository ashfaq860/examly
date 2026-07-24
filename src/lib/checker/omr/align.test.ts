import { describe, it, expect } from 'vitest';
import { fitAlignment, detectFiducials } from './align';
import { GrayImage } from '@/lib/checker/imaging';
import { TemplatePoint } from '@/types/checker';

// Draws solid black squares on a white background — no antialiasing, so
// Otsu thresholding and the shape filters behave exactly as they would on
// a clean synthetic input (no need for a real scanned image to exercise
// the pure decision logic these tests target).
function makeGrayImage(width: number, height: number, squares: { cx: number; cy: number; size: number }[]): GrayImage {
  const data = new Uint8ClampedArray(width * height).fill(255);
  for (const sq of squares) {
    const half = sq.size / 2;
    const minX = Math.max(0, Math.round(sq.cx - half));
    const maxX = Math.min(width - 1, Math.round(sq.cx + half));
    const minY = Math.max(0, Math.round(sq.cy - half));
    const maxY = Math.min(height - 1, Math.round(sq.cy + half));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        data[y * width + x] = 0;
      }
    }
  }
  return { data, width, height };
}

const TEMPLATE_FIDUCIALS: [TemplatePoint, TemplatePoint, TemplatePoint, TemplatePoint] = [
  { x: 50, y: 50 },   // tl
  { x: 500, y: 50 },  // tr
  { x: 50, y: 750 },  // bl
  { x: 500, y: 750 }, // br
];

describe('fitAlignment', () => {
  it('maps template points through a known scale+translate and back', () => {
    const scale = 2;
    const dx = 10, dy = 20;
    const toDetected = (p: TemplatePoint) => ({ cx: p.x * scale + dx, cy: p.y * scale + dy });
    const detected = {
      tl: toDetected(TEMPLATE_FIDUCIALS[0]),
      tr: toDetected(TEMPLATE_FIDUCIALS[1]),
      bl: toDetected(TEMPLATE_FIDUCIALS[2]),
      br: toDetected(TEMPLATE_FIDUCIALS[3]),
    };

    const alignment = fitAlignment(detected, { fiducials: TEMPLATE_FIDUCIALS });
    expect(alignment).not.toBeNull();

    const testPt = { x: 200, y: 300 }; // not one of the 4 fiducials
    const mapped = alignment!.transformPoint(testPt);
    expect(mapped.x).toBeCloseTo(testPt.x * scale + dx, 5);
    expect(mapped.y).toBeCloseTo(testPt.y * scale + dy, 5);

    const back = alignment!.inverseTransformPoint(mapped);
    expect(back.x).toBeCloseTo(testPt.x, 5);
    expect(back.y).toBeCloseTo(testPt.y, 5);
  });

  it('returns null for a degenerate (collinear) point configuration', () => {
    const collinear = {
      tl: { cx: 0, cy: 0 }, tr: { cx: 10, cy: 0 }, bl: { cx: 20, cy: 0 }, br: { cx: 30, cy: 0 },
    };
    expect(fitAlignment(collinear, { fiducials: TEMPLATE_FIDUCIALS })).toBeNull();
  });
});

describe('detectFiducials', () => {
  // Real fiducials: same aspect ratio as TEMPLATE_FIDUCIALS (width 480,
  // height 760 vs. template's 450x700 — close enough to pass ASPECT_TOLERANCE).
  const real = [
    { cx: 60, cy: 60, size: 20 },
    { cx: 540, cy: 60, size: 20 },
    { cx: 60, cy: 820, size: 20 },
    { cx: 540, cy: 820, size: 20 },
  ];

  it('picks the 4 real fiducials, ignoring a similarly-sized false positive', () => {
    // A logo-sized blob positioned so it WOULD sit in the "4th quadrant"
    // relative to 3 real corners (tl/tr/bl) — this specifically exercises
    // the br-parallelogram check, since it can't be caught by aspect
    // ratio alone (aspect only ever looks at tl/tr/bl).
    const logo = { cx: 300, cy: 440, size: 20 };
    const img = makeGrayImage(700, 900, [...real, logo]);

    const result = detectFiducials(img, { fiducials: TEMPLATE_FIDUCIALS });
    expect(result).not.toBeNull();

    const chosen = new Set([result!.tl, result!.tr, result!.bl, result!.br].map(b => `${b.cx.toFixed(0)},${b.cy.toFixed(0)}`));
    expect(chosen.has(`${logo.cx},${logo.cy}`)).toBe(false);
    for (const r of real) expect(chosen.has(`${r.cx},${r.cy}`)).toBe(true);
  });

  it('rejects a candidate set with the wrong aspect ratio entirely', () => {
    // 4 blobs forming a near-square arrangement — nothing like the
    // template's ~0.64 aspect-ratio rectangle.
    const wrongShape = [
      { cx: 100, cy: 100, size: 20 },
      { cx: 400, cy: 100, size: 20 },
      { cx: 100, cy: 400, size: 20 },
      { cx: 400, cy: 400, size: 20 },
    ];
    const img = makeGrayImage(600, 600, wrongShape);
    expect(detectFiducials(img, { fiducials: TEMPLATE_FIDUCIALS })).toBeNull();
  });

  it('returns null when fewer than 4 plausible candidates exist', () => {
    const img = makeGrayImage(300, 300, [{ cx: 50, cy: 50, size: 15 }]);
    expect(detectFiducials(img, { fiducials: TEMPLATE_FIDUCIALS })).toBeNull();
  });

  // Regression test for a real production bug: detectFiducials computed its
  // target aspect ratio from `layout.fiducials[0,1,3]` (tl, tr, br) instead
  // of `[0,1,2]` (tl, tr, bl) — a stray comma in a destructure
  // (`const [tl, tr, , bl] = ...`) skipped the real bl and silently bound
  // `bl` to br instead. For a template shaped like TEMPLATE_FIDUCIALS above
  // (height >> width) that swap is small enough (tl-to-br diagonal is close
  // to tl-to-bl height) to sneak under ASPECT_TOLERANCE, which is exactly
  // why the other tests in this file kept passing on the buggy code — real
  // scans still failed because photo skew pushed the already-biased
  // deviation over the edge. A near-SQUARE template exposes it outright:
  // diagonal vs. height diverge enough that the bug's aspect ratio (using
  // br) misses tolerance even for candidates that exactly match the
  // template's true shape.
  it('validates candidate aspect ratio against the template\'s true bl, not br', () => {
    const squareTemplate: [TemplatePoint, TemplatePoint, TemplatePoint, TemplatePoint] = [
      { x: 50, y: 50 },   // tl
      { x: 750, y: 50 },  // tr
      { x: 50, y: 750 },  // bl
      { x: 750, y: 750 }, // br
    ];
    // Candidates reproduce the template's true (square) shape exactly.
    const exactMatch = [
      { cx: 60, cy: 60, size: 20 },
      { cx: 760, cy: 60, size: 20 },
      { cx: 60, cy: 760, size: 20 },
      { cx: 760, cy: 760, size: 20 },
    ];
    const img = makeGrayImage(900, 900, exactMatch);
    expect(detectFiducials(img, { fiducials: squareTemplate })).not.toBeNull();
  });
});

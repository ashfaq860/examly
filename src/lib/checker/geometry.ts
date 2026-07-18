// Homography (projective transform) fitting from exactly 4 point
// correspondences, via the standard Direct Linear Transform. No CV library
// needed — this is just an 8-unknown linear system solved by Gaussian
// elimination with partial pivoting.
//
// Used to map a bubble's declared position (in the layout map's point-space)
// onto the pixel it actually landed at in a scanned/photographed image,
// given where the 4 registration squares were detected in that image.

export interface Point {
  x: number;
  y: number;
}

/** Row-major 3x3 homography matrix, flattened to 9 numbers (h[8] === 1). */
export type Homography = number[];

/**
 * Solves for H such that H . src[i] ~= dst[i] (in homogeneous coordinates),
 * for exactly 4 correspondences. Throws if the 4 source points are
 * degenerate (collinear / duplicate) and no unique solution exists.
 */
export function solveHomography(src: Point[], dst: Point[]): Homography {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error(`solveHomography requires exactly 4 point pairs, got ${src.length}/${dst.length}`);
  }

  // Each correspondence (x,y) -> (u,v) contributes two rows to A . h = b,
  // solving for h = [h11 h12 h13 h21 h22 h23 h31 h32] (h33 fixed to 1):
  //   h11*x + h12*y + h13 - h31*x*u - h32*y*u = u
  //   h21*x + h22*y + h23 - h31*x*v - h32*y*v = v
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const h = gaussianSolve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Maps a point through a homography (homogeneous divide included). */
export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/**
 * Estimates the local pixel-space scale of a homography at point `p` by
 * mapping a small probe offset and measuring the resulting pixel distance,
 * divided by the probe's own (known) length. Used to convert a bubble
 * radius from layout-map points into an image-pixel radius.
 */
export function localScale(h: Homography, p: Point, probeLength = 1): number {
  const p0 = applyHomography(h, p);
  const p1 = applyHomography(h, { x: p.x + probeLength, y: p.y });
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return Math.sqrt(dx * dx + dy * dy) / probeLength;
}

/** Solves an NxN linear system A.x = b via Gaussian elimination with partial pivoting. */
function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Work on copies augmented with b, so we don't mutate caller inputs.
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: swap in the row with the largest absolute value in this column.
    let pivotRow = col;
    let pivotVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > pivotVal) {
        pivotVal = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (pivotVal < 1e-12) {
      throw new Error('solveHomography: degenerate point configuration (singular matrix)');
    }
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    }

    const pivot = M[col][col];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row, i) => row[n] / row[i]);
}

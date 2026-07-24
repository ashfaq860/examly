// mm <-> pt <-> px conversion — didn't exist anywhere in this codebase
// before the v3 template-space bubble layout (confirmed by search); every
// prior consumer of page-size math (PaperLayoutRenderer.tsx, the old v2
// frac-relative layout capture) deliberately worked in fractions/CSS units
// to avoid needing this. v3 persists bubble positions in PDF points, so
// paper generation needs to convert a DOM getBoundingClientRect() (CSS
// pixels) into physical points given the page's own known mm size.

/** PDF/typography points per millimeter (72pt / 25.4mm per inch). */
export const PT_PER_MM = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/** Converts a CSS-pixel measurement (e.g. from getBoundingClientRect())
 *  into PDF points, given the ACTUAL rendered pixel width of the page
 *  container and that same page's known physical width in points. This
 *  works regardless of browser zoom/DPR: both `px` and `pageWidthPx` are
 *  measured in the same CSS-pixel space, so their ratio is exactly the
 *  page's own physical scale — the same trick the old v2 frac-relative
 *  capture used (see PaperLayoutRenderer.tsx's captureMcqLayoutMap), just
 *  landing in physical points instead of a reg-square-relative fraction. */
export function pxToPt(px: number, pageWidthPx: number, pageWidthPt: number): number {
  return (px / pageWidthPx) * pageWidthPt;
}

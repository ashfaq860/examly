import { describe, it, expect } from 'vitest';
import {
  symbolFor, symbolSize, estimateLineHeight, tickSvgPath, crossSvgPath, circleSvgPath,
  clampSymbolToNeighbor, MIN_SYMBOL_SIZE_PCT, MAX_SYMBOL_SIZE_PCT, REASON_CODES, BOARD_RED_HEX,
  resolveAnswerBox, AnswerBox, FRACTION_FONT_SIZE_PCT, FRACTION_LINE_GAP_PCT, FRACTION_RULE_PADDING_PCT,
  TICK_VIEWBOX_SIZE, TICK_FILL_HEX,
} from './symbols';

describe('symbolFor', () => {
  it('a zero-mark answer is a cross', () => {
    expect(symbolFor(0, 2)).toBe('cross');
  });
  it('a partial-mark answer is a small tick, never a cross', () => {
    expect(symbolFor(1, 2)).toBe('small-tick');
  });
  it('a full-mark answer is a large tick', () => {
    expect(symbolFor(2, 2)).toBe('large-tick');
  });
  it('treats a negative/over-max awarded defensively (clamped semantics, not a crash)', () => {
    expect(symbolFor(-1, 2)).toBe('cross');
    expect(symbolFor(5, 2)).toBe('large-tick');
  });
});

describe('estimateLineHeight', () => {
  it('falls back to the constant for a non-positive band', () => {
    expect(estimateLineHeight(0)).toBeCloseTo(2, 5);
    expect(estimateLineHeight(-5)).toBeCloseTo(2, 5);
  });
  it('recovers a single line height close to the fallback for a 1-line band', () => {
    expect(estimateLineHeight(1.9)).toBeCloseTo(1.9, 5); // rounds to 1 line
  });
  it('divides a multi-line band by its estimated whole line count', () => {
    // ~3 lines at 2%/line = 6% band -> recovers ~2%/line, not 6%.
    expect(estimateLineHeight(6)).toBeCloseTo(2, 5);
  });
});

describe('symbolSize', () => {
  it('large tick spans roughly 3x a 1-line band, small tick roughly 1.5x', () => {
    const bandHeight = 2; // 1 line
    expect(symbolSize('large-tick', bandHeight)).toBeCloseTo(6, 5);
    expect(symbolSize('small-tick', bandHeight)).toBeCloseTo(3, 5);
  });
  it('stays bounded for a very tall band — estimateLineHeight recovers a PER-LINE height, not the band height, so a taller band means more estimated lines, not a bigger symbol', () => {
    expect(symbolSize('large-tick', 10000)).toBeLessThan(MAX_SYMBOL_SIZE_PCT);
  });
  it('clamps an absurdly short/zero band to the minimum instead of a near-zero symbol', () => {
    expect(symbolSize('cross', 0.0001)).toBe(MIN_SYMBOL_SIZE_PCT);
  });
});

/** Every path builder emits only M/L/Q/C/Z commands and numeric coordinates
 *  — this is what both pdf-lib's drawSvgPath and a browser <svg> parse, so
 *  a malformed token here would silently draw nothing (or throw) in both
 *  callers. Doesn't assert exact visual shape (not unit-testable) — that
 *  was verified separately by rendering to PNG and comparing against the
 *  reference tick image. */
function parseCoords(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) || []).map(Number);
}

describe('clampSymbolToNeighbor', () => {
  it('leaves size and center untouched when there is no next question', () => {
    expect(clampSymbolToNeighbor(10, 40, 50, null)).toEqual({ cyPct: 50, sizePct: 10 });
  });
  it('leaves size and center untouched when there is ample room before the next question', () => {
    expect(clampSymbolToNeighbor(6, 15, 20, 80)).toEqual({ cyPct: 20, sizePct: 6 });
  });
  it('shrinks an oversized symbol so it never reaches the next question\'s own top edge', () => {
    // Own center at 50, next question starts at 55 — only 5% away.
    const { cyPct, sizePct } = clampSymbolToNeighbor(12, 40, 50, 55);
    expect(sizePct).toBeLessThan(12);
    expect(cyPct).toBe(50); // ample headroom above cy — only size needed shrinking
    // The symbol's own lower edge (cy + size/2) must stay short of nextTopPct.
    expect(cyPct + sizePct / 2).toBeLessThan(55);
  });
  it('never shrinks below the minimum symbol size even with almost no room', () => {
    const { sizePct } = clampSymbolToNeighbor(12, 40, 50, 50.1);
    expect(sizePct).toBeGreaterThanOrEqual(MIN_SYMBOL_SIZE_PCT);
  });
  it('pulls an overlapping/bad-band center back before the next question, floored at the answer\'s own top', () => {
    // Reported center (70) already sits PAST where the next question
    // starts (60) — e.g. a model-estimated band that overshot into the
    // next answer. The anchor itself must move back, not just the size.
    const { cyPct, sizePct } = clampSymbolToNeighbor(6, 40, 70, 60);
    expect(cyPct).toBeLessThan(60);
    expect(cyPct).toBeGreaterThanOrEqual(40);
    expect(cyPct + sizePct / 2).toBeLessThan(60);
  });
  it('never pulls the center earlier than the answer\'s own top, even with a next question right on top of it', () => {
    const { cyPct } = clampSymbolToNeighbor(6, 40, 70, 41);
    expect(cyPct).toBe(40);
  });
});

describe('resolveAnswerBox', () => {
  const region: AnswerBox = { topPct: 20, bottomPct: 30, leftPct: 5, rightPct: 90 };

  it('falls back to region when there is no ink box at all (e.g. a blank answer)', () => {
    expect(resolveAnswerBox(region, null)).toEqual(region);
  });

  it('uses the ink box when it has positive area and sits inside region', () => {
    const ink: AnswerBox = { topPct: 22, bottomPct: 26, leftPct: 10, rightPct: 40 };
    expect(resolveAnswerBox(region, ink)).toEqual(ink);
  });

  it('falls back to region when the ink box has zero/negative area', () => {
    const degenerate: AnswerBox = { topPct: 22, bottomPct: 22, leftPct: 10, rightPct: 40 };
    expect(resolveAnswerBox(region, degenerate)).toEqual(region);
  });

  it('falls back to region when the ink box grossly exceeds region (implausible)', () => {
    const tooLarge: AnswerBox = { topPct: 0, bottomPct: 100, leftPct: 0, rightPct: 100 };
    expect(resolveAnswerBox(region, tooLarge)).toEqual(region);
  });

  it('tolerates a small overshoot past region without rejecting the ink box', () => {
    // 1% over each edge — within INK_CONTAINMENT_SLACK_PCT (1.5%).
    const slightlyOver: AnswerBox = { topPct: 19, bottomPct: 31, leftPct: 4, rightPct: 91 };
    expect(resolveAnswerBox(region, slightlyOver)).toEqual(slightlyOver);
  });

  it('rejects an ink box that overshoots region past the containment slack', () => {
    const wayOver: AnswerBox = { topPct: 10, bottomPct: 30, leftPct: 5, rightPct: 90 };
    expect(resolveAnswerBox(region, wayOver)).toEqual(region);
  });
});

describe('fraction geometry constants', () => {
  it('leaves comfortable room inside a circle for a stacked fraction', () => {
    // Two font-size lines plus a gap on each side of the rule shouldn't
    // come close to consuming the whole circle diameter.
    const totalHeightPct = 2 * FRACTION_FONT_SIZE_PCT + 2 * FRACTION_LINE_GAP_PCT;
    expect(totalHeightPct).toBeLessThan(100);
    expect(FRACTION_RULE_PADDING_PCT).toBeGreaterThan(0);
  });
});

describe('path builders', () => {
  it('tickSvgPath returns the exact fixed filled path, unaffected by any size argument', () => {
    const path = tickSvgPath();
    expect(path).toBe(
      'M4,26 C7,25 10,28 15,36 C16,38 18,38 19,36 C26,20 34,10 46,2 C47,1.4 47.6,2.6 46.8,3.4 C36,14 27,27 21,41 C20,43.5 16.5,43.5 15,41 C11,34 7,30 3.6,28.4 C2.8,28 3.2,26.2 4,26 Z'
    );
  });

  it('tickSvgPath is a closed, filled path (ends with Z) with curves, within its 0..48 viewbox', () => {
    const path = tickSvgPath();
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect((path.match(/C/g) || []).length).toBeGreaterThan(0);
    for (const n of parseCoords(path)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(TICK_VIEWBOX_SIZE);
    }
  });

  it('TICK_FILL_HEX is a well-formed hex colour distinct from BOARD_RED_HEX', () => {
    expect(TICK_FILL_HEX).toMatch(/^#[0-9a-f]{6}$/i);
    expect(TICK_FILL_HEX).not.toBe(BOARD_RED_HEX);
  });

  it('crossSvgPath draws two distinct diagonal strokes (two M commands) within its box', () => {
    const size = 30;
    const path = crossSvgPath(size);
    expect((path.match(/M/g) || []).length).toBe(2);
    for (const n of parseCoords(path)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(size);
    }
  });

  it('circleSvgPath is an open path (deliberate hand-drawn overshoot, no Z) within its box', () => {
    const size = 50;
    const path = circleSvgPath(size);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(false);
    expect((path.match(/C/g) || []).length).toBeGreaterThan(0);
    // The overshoot deliberately runs a little past the box on one axis
    // (the pen "flicking past" its own start) — bounded loosely, not to
    // [0,size], unlike the other two shapes.
    for (const n of parseCoords(path)) {
      expect(n).toBeGreaterThan(-size * 0.2);
      expect(n).toBeLessThan(size * 1.2);
    }
  });

  it('circle path geometry scales linearly with size', () => {
    // Looser precision than the tick's check: circleSvgPath's coordinates
    // are each independently rounded to 3 decimals (fmt()) at their own
    // scale, so two runs at different sizes can differ by up to ~2x that
    // rounding step — still confirms linear scaling, not exact-to-the-bit
    // reproduction of one run's rounding from the other's.
    const small = parseCoords(circleSvgPath(10));
    const large = parseCoords(circleSvgPath(20));
    for (let i = 0; i < small.length; i++) {
      expect(large[i]).toBeCloseTo(small[i] * 2, 1);
    }
  });
});

describe('REASON_CODES', () => {
  it('defines the full official board comment-code set', () => {
    expect(Object.keys(REASON_CODES).sort()).toEqual(
      ['EX', 'GR', 'IN', 'IR', 'IS', 'OA', 'P', 'RP', 'SP', 'UN', 'WF', 'WO', 'WRF', 'WT'].sort(),
    );
    expect(REASON_CODES.IN).toBe('Incomplete');
    expect(REASON_CODES.IR).toBe('Irrelevant');
    expect(REASON_CODES.UN).toBe('Un-Necessary');
  });
});

describe('BOARD_RED_HEX', () => {
  it('is a single well-formed hex colour reused by every symbol', () => {
    expect(BOARD_RED_HEX).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

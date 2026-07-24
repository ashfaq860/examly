// Scanned answer-sheet viewer: pinch/pan/zoom via the Pointer Events API
// (one active pointer = pan, two = pinch-scale; wheel = desktop zoom) and
// plain CSS transforms — no gesture library. Overlay marks are children of
// the same transformed "stage" element as the image, so they pan/zoom
// together for free; each is positioned with plain percentage left/top —
// MCQ marks from the answer's stored bubble_overlay fractions (see
// grade-mcq's persistence of these — no CV re-run happens here), subjective
// marks from lib/checker/annotate/symbols.ts's SAME tick/cross path
// builders, box-resolution, and size/placement rules annotatePdf.ts uses
// server-side, so what a teacher sees here matches the downloaded PDF
// exactly.
'use client';

import { useEffect, useRef, useState } from 'react';
import { SubmissionAnswerRow, BubbleOption } from '@/types/checker';
import {
  tickSvgPath, crossSvgPath, circleSvgPath, symbolFor, symbolSize, clampSymbolToNeighbor,
  resolveAnswerBox, AnswerBox, REASON_CODES,
  BOARD_RED_HEX, TICK_FILL_HEX, TICK_VIEWBOX_SIZE, CROSS_STROKE_WIDTH_RATIO,
  MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT, SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT, MARGIN_INSET_PCT,
  FRACTION_FONT_SIZE_PCT, FRACTION_LINE_GAP_PCT,
  DEFAULT_OPACITY, FALLBACK_X_PCT,
} from '@/lib/checker/annotate/symbols';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const HIGHLIGHT_SCALE = 2.2;
const OPTIONS: BubbleOption[] = ['A', 'B', 'C', 'D'];
// The <svg viewBox> the CROSS is built at — crossSvgPath's own "size" param,
// kept fixed here so the CSS box around it (sized per-answer via
// symbolSize) is what actually determines the on-screen size, not the
// path's own coordinate scale. The TICK is different: it's a fixed,
// non-parameterized path authored in its own TICK_VIEWBOX_SIZE (48) box —
// see symbols.ts's tickSvgPath for why.
const SYMBOL_VIEWBOX = 100;
// Gap (%-of-page-width) kept between the answer's own left/right edge and
// the marks-number text beside it — matches annotatePdf.ts's
// SUBJECTIVE_MARKS_GAP_PCT so the two stay visually identical.
const MARKS_GAP_PCT = 1.5;

export type MarksSide = 'left' | 'right';

export interface SectionSubtotalInfo {
  heading: string;
  awarded: number;
  max: number;
  /** %-of-page-height from the top, TOP-origin (same convention as
   *  answer_top_pct) — already offset above the section's own heading by
   *  the submissions API route, same anchor rule annotatePdf.ts uses. */
  topPct: number;
}

interface Pt { x: number; y: number }
const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function ScanViewer({
  imageUrl,
  answers,
  highlightedAnswerId,
  mcqScoreAnchor,
  subjectiveMarksSide,
  sectionSubtotals,
}: {
  imageUrl: string;
  answers: SubmissionAnswerRow[];
  /** When set to an id present in `answers`, the viewer pans/zooms to
   *  center that answer's mark — wired from AnswerGrid row clicks so
   *  picking a question in the list scrolls/highlights its mark on the
   *  image (both MCQ and subjective). */
  highlightedAnswerId?: string | null;
  /** Same anchor computeMcqScoreAnchorFraction (annotatePdf.ts) computes
   *  for the PDF's own circle — only present/rendered on the graded MCQ
   *  page. Small red circled badge, same size/shape as the PDF's, not a
   *  re-implementation of the coordinate math client-side. */
  mcqScoreAnchor?: { xFrac: number; yFrac: number; awarded: number; max: number } | null;
  /** ONE marks-side for the whole paper (see gradeSubjective.ts's
   *  decideSubjectiveMarksSide, persisted on the submission and returned by
   *  the submissions API route) — applied to EVERY subjective answer's
   *  marks on this page, never per-row. */
  subjectiveMarksSide?: MarksSide | null;
  /** Section-subtotal badges for the CURRENT page only — the caller
   *  (review page.tsx) filters the full list by page_index before handing
   *  it down here, same pattern `answers` itself already uses. */
  sectionSubtotals?: SectionSubtotalInfo[] | null;
}) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  // The viewport used to be a fixed height (52vh) regardless of the image's
  // own aspect ratio — a short/wide image (e.g. a tight crop of just the
  // OMR box) doesn't fill that height, leaving the viewport's own dark
  // background visible as dead space below it. Sizing the viewport to the
  // image's actual aspect ratio (once known, from onLoad) avoids that. Also
  // needed by SubjectiveOverlay: a symbol must render visually SQUARE
  // regardless of the image's own aspect ratio, but CSS width%/height% are
  // relative to different reference dimensions — converting a height% size
  // into its equivalent width% requires this same ratio (see that
  // component's own comment).
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const lastPinchDist = useRef<number | null>(null);
  const lastPan = useRef<Pt | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastPan.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      lastPinchDist.current = distance(pts[0], pts[1]);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1 && lastPan.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (pointers.current.size === 2 && lastPinchDist.current) {
      const pts = Array.from(pointers.current.values());
      const dist = distance(pts[0], pts[1]);
      const delta = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setTransform(t => ({ ...t, scale: clampScale(t.scale * delta) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastPinchDist.current = null;
    if (pointers.current.size === 1) {
      lastPan.current = Array.from(pointers.current.values())[0];
    } else {
      lastPan.current = null;
    }
  };

  // Attached manually (not via React's onWheel prop) with { passive: false }:
  // browsers/React may register wheel listeners as passive by default for
  // scroll-perf reasons, which silently makes preventDefault() a no-op — the
  // page would scroll underneath the zoom gesture instead of the image
  // zooming, and "Reset zoom" would look broken because it resets the image
  // transform but can't undo a page scroll it never caused.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform(t => ({ ...t, scale: clampScale(t.scale * delta) }));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pans/zooms to center the highlighted answer's mark — the stage is
  // sized to the viewport's own (unscaled) box, so a stage-local point
  // (xFrac*width, yFrac*height) lands at viewport position
  // (x + point*scale) under the current transform; solving for x/y centers
  // that point in the viewport instead.
  useEffect(() => {
    if (!highlightedAnswerId) return;
    const target = answers.find(a => a.id === highlightedAnswerId);
    const viewport = viewportRef.current;
    if (!target || !viewport || !aspectRatio) return;

    let xFrac: number | null = null;
    let yFrac: number | null = null;
    if (target.answer_kind === 'mcq' && target.bubble_overlay) {
      const effective = target.override_option ?? target.detected_option;
      const rect = effective && effective !== 'BLANK' && effective !== 'MULTIPLE' ? target.bubble_overlay[effective] : target.bubble_overlay.A;
      if (rect) { xFrac = rect.xFrac; yFrac = rect.yFrac; }
    } else if (target.answer_top_pct != null) {
      // Center of the RESOLVED answer box — same ink-preferring box the
      // symbol itself is drawn at (see resolveAnswerBox), matching
      // annotatePdf.ts's placement.
      const region: AnswerBox = {
        topPct: target.answer_top_pct,
        bottomPct: target.answer_bottom_pct ?? target.answer_top_pct,
        leftPct: target.answer_left_pct ?? FALLBACK_X_PCT,
        rightPct: target.answer_right_pct ?? FALLBACK_X_PCT,
      };
      const ink: AnswerBox | null = target.answer_ink_top_pct != null && target.answer_ink_bottom_pct != null
        && target.answer_ink_left_pct != null && target.answer_ink_right_pct != null
        ? { topPct: target.answer_ink_top_pct, bottomPct: target.answer_ink_bottom_pct, leftPct: target.answer_ink_left_pct, rightPct: target.answer_ink_right_pct }
        : null;
      const resolved = resolveAnswerBox(region, ink);
      xFrac = (resolved.leftPct + resolved.rightPct) / 2 / 100;
      yFrac = (resolved.topPct + resolved.bottomPct) / 2 / 100;
    }
    if (xFrac == null || yFrac == null) return;

    const rect = viewport.getBoundingClientRect();
    const imgWidth = rect.width;
    const imgHeight = imgWidth * aspectRatio;

    setTransform(t => {
      const scale = Math.max(t.scale, HIGHLIGHT_SCALE);
      return {
        scale,
        x: rect.width / 2 - xFrac! * imgWidth * scale,
        y: rect.height / 2 - yFrac! * imgHeight * scale,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedAnswerId, aspectRatio]);

  const reset = () => setTransform({ scale: 1, x: 0, y: 0 });

  // Every subjective answer passed in here is already on the SAME page
  // (the review page filters by page_index before handing `answers` down)
  // — sorted by their own REGION top position, this is exactly the "what
  // comes next on this page" order annotatePdf.ts's own clamp needs, just
  // without that file's extra page-grouping step (nothing to group,
  // there's only one page here).
  const subjectiveOrder = answers
    .filter(a => a.answer_kind === 'subjective' && a.answer_top_pct != null)
    .sort((a, b) => a.answer_top_pct! - b.answer_top_pct!);

  const marksSide: MarksSide = subjectiveMarksSide ?? 'right';

  return (
    <div
      ref={viewportRef}
      className="chk-scan-viewport"
      style={aspectRatio ? { aspectRatio: `${1 / aspectRatio}`, height: 'auto', maxHeight: '70vh' } : undefined}
    >
      <button type="button" className="chk-scan-reset" onClick={reset}>Reset zoom</button>
      <div
        className="chk-scan-stage"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          draggable={false}
          className="chk-scan-img"
          alt="Scanned answer sheet"
          onLoad={e => {
            const el = e.currentTarget;
            if (el.naturalWidth > 0) setAspectRatio(el.naturalHeight / el.naturalWidth);
          }}
        />
        {mcqScoreAnchor && <McqScoreBadge anchor={mcqScoreAnchor} aspectRatio={aspectRatio ?? 1} />}
        {(sectionSubtotals || []).map((s, i) => (
          <SectionSubtotalBadge key={`${s.heading}-${i}`} subtotal={s} marksSide={marksSide} aspectRatio={aspectRatio ?? 1} />
        ))}
        {answers.map(a => {
          if (a.answer_kind === 'mcq') {
            return a.bubble_overlay ? <McqOverlay key={a.id} answer={a} highlighted={a.id === highlightedAnswerId} aspectRatio={aspectRatio ?? 1} /> : null;
          }
          if (a.answer_top_pct == null) return null;
          const idx = subjectiveOrder.findIndex(s => s.id === a.id);
          const nextTopPct = idx >= 0 ? subjectiveOrder[idx + 1]?.answer_top_pct ?? null : null;
          return (
            <SubjectiveOverlay
              key={a.id}
              answer={a}
              highlighted={a.id === highlightedAnswerId}
              aspectRatio={aspectRatio ?? 1}
              nextTopPct={nextTopPct}
              marksSide={marksSide}
            />
          );
        })}
      </div>

      <style jsx>{`
        .chk-scan-viewport {
          position: relative; overflow: hidden; touch-action: none;
          background: #0b0f1e; border-radius: var(--chk-radius-lg); height: 52vh; min-height: 320px;
        }
        .chk-scan-reset {
          position: absolute; top: 8px; right: 8px; z-index: 2;
          background: rgba(16, 25, 53, 0.75); color: #fff; border: none; border-radius: var(--chk-radius-sm);
          padding: 5px 10px; font-size: 0.75rem; cursor: pointer;
        }
        .chk-scan-stage { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; }
        .chk-scan-img { width: 100%; display: block; user-select: none; }
      `}</style>
    </div>
  );
}

function McqOverlay({ answer, highlighted, aspectRatio }: { answer: SubmissionAnswerRow; highlighted: boolean; aspectRatio: number }) {
  const overlay = answer.bubble_overlay!;
  const effective = answer.override_option ?? answer.detected_option;
  const isMultiple = answer.detected_option === 'MULTIPLE';

  // For an ambiguous MULTIPLE read, the two darkest bubbles are the ones the
  // teacher actually needs to see marked — there's no single "effective"
  // option (of the A-D shape) to compare against opt for that case.
  const darkestOptions = isMultiple
    ? OPTIONS.slice().sort((a, b) => overlay[b].darkness - overlay[a].darkness).slice(0, 2)
    : [];

  const colorFor = (opt: BubbleOption): 'correct' | 'wrong' | 'amber' | 'gray-outline' | 'gray' => {
    if (isMultiple) {
      if (darkestOptions.includes(opt)) return 'amber';
      if (opt === answer.correct_option) return 'gray-outline';
      return 'gray';
    }
    // effective is 'A'|'B'|'C'|'D'|'BLANK'|null here (MULTIPLE handled above);
    // BLANK/null never equal an option, so this only ever matches a real pick.
    if (opt === effective) {
      return effective === answer.correct_option ? 'correct' : 'wrong';
    }
    if (opt === answer.correct_option) return 'gray-outline';
    return 'gray';
  };

  return (
    <>
      {highlighted && (
        <div
          className="chk-ov-ring"
          style={{ left: `${overlay.A.xFrac * 100}%`, top: `${overlay.A.yFrac * 100}%`, width: `${overlay.D.rFrac * 2 * 100 + 8}%` }}
        />
      )}
      {OPTIONS.map(opt => {
        const rect = overlay[opt];
        if (!rect) return null;
        const color = colorFor(opt);

        // The effective pick (right or wrong) gets a small check/cross
        // glyph beside the bubble's upper-right edge — board-red for both
        // (distinguished by shape, not colour, same as every other mark in
        // this scheme — see symbols.ts's header comment). Small (close to
        // the PDF's own fixed 16pt mark, not blown up) with just a
        // drop-shadow for contrast, NOT a solid filled disc: on a
        // fully-correct sheet every option in every row gets one of these,
        // and a solid disc at anything much bigger than this visually
        // merges into its neighbors along a tightly-packed row.
        if (color === 'correct' || color === 'wrong') {
          const badgeSize = rect.rFrac * 2 * 0.65;
          // rFrac is a fraction of the image's WIDTH (see gradeMcq.ts:
          // `s.r / gray.width`) — using it unconverted for BOTH `left`
          // (width-relative %) and `top` (height-relative %) only gives the
          // same PHYSICAL offset on a perfectly square page. Every real
          // exam scan is portrait (aspectRatio = naturalHeight/naturalWidth
          // > 1), so the vertical offset needs dividing by aspectRatio to
          // land the same physical distance from the bubble as the
          // horizontal one.
          const offsetX = rect.rFrac * 1.6;
          const offsetY = offsetX / aspectRatio;
          const badgePos = {
            left: `${(rect.xFrac + offsetX) * 100}%`,
            top: `${(rect.yFrac - offsetY) * 100}%`,
            width: `${badgeSize * 100}%`,
          };
          return (
            <div key={opt} className="chk-ov-badge" style={badgePos}>
              {color === 'correct' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke={BOARD_RED_HEX} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 13 9 18 20 5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke={BOARD_RED_HEX} strokeWidth="4.5" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              )}
            </div>
          );
        }

        const pos = { left: `${rect.xFrac * 100}%`, top: `${rect.yFrac * 100}%`, width: `${rect.rFrac * 2 * 100}%` };
        return <div key={opt} className={`chk-ov-dot chk-ov-${color}`} style={pos} />;
      })}
      <style jsx>{`
        .chk-ov-dot {
          position: absolute; transform: translate(-50%, -50%); aspect-ratio: 1 / 1;
          border-radius: 50%; pointer-events: none; box-sizing: border-box;
        }
        .chk-ov-gray { border: 2px solid rgba(255, 255, 255, 0.35); }
        .chk-ov-gray-outline { border: 2px dashed var(--chk-green); }
        .chk-ov-amber { border: 3px solid var(--chk-amber); background: rgba(183, 121, 31, 0.3); }

        .chk-ov-badge {
          position: absolute; transform: translate(-50%, -50%); aspect-ratio: 1 / 1;
          pointer-events: none; box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
        }
        .chk-ov-badge svg {
          width: 100%; height: 100%;
          filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
        }

        .chk-ov-ring {
          position: absolute; transform: translate(-50%, -50%); aspect-ratio: 1 / 1;
          border-radius: 999px; border: 3px solid #fbbf24; pointer-events: none;
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.35);
        }
      `}</style>
    </>
  );
}

/** Stacked-fraction "N over M" drawn as SVG <text>+<line>, sharing the
 *  circle's own 0-`size` coordinate space (textAnchor/dominantBaseline
 *  center each line natively, unlike pdf-lib's drawFraction which has to
 *  measure real font metrics to center text itself — a browser doesn't
 *  need that same manual centering). Uses the SAME FRACTION_FONT_SIZE_PCT/
 *  FRACTION_LINE_GAP_PCT ratios symbols.ts's drawFraction uses, so the PDF
 *  and this overlay read the same proportions, just rendered through two
 *  different APIs. */
function FractionSvgContent({ size, numerator, denominator }: { size: number; numerator: string; denominator: string }) {
  const fontSize = size * (FRACTION_FONT_SIZE_PCT / 100);
  const gap = size * (FRACTION_LINE_GAP_PCT / 100);
  const cx = size / 2;
  const cy = size / 2;
  return (
    <>
      <text x={cx} y={cy - gap - fontSize * 0.5} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={800} fill={BOARD_RED_HEX}>
        {numerator}
      </text>
      <line x1={cx - size * 0.32} y1={cy} x2={cx + size * 0.32} y2={cy} stroke={BOARD_RED_HEX} strokeWidth={size * 0.035} />
      <text x={cx} y={cy + gap + fontSize * 0.5} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={800} fill={BOARD_RED_HEX}>
        {denominator}
      </text>
    </>
  );
}

/** Small circled MCQ obtained-marks badge — same anchor
 *  (computeMcqScoreAnchorFraction, annotatePdf.ts) and same circle-size
 *  constant (symbols.ts's MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT) the PDF's own
 *  circle uses — small and top-right, matching the PDF, not grid-sized.
 *  The label is a real stacked fraction (FractionSvgContent), matching the
 *  PDF's own hand-drawn-style fraction instead of inline "N/M" text. */
function McqScoreBadge({ anchor, aspectRatio }: { anchor: { xFrac: number; yFrac: number; awarded: number; max: number }; aspectRatio: number }) {
  const size = 100;
  const heightPct = MCQ_SCORE_CIRCLE_PCT_OF_HEIGHT;
  const widthPct = heightPct * aspectRatio; // %-of-height -> %-of-width, same conversion SubjectiveOverlay uses

  return (
    <div
      className="chk-ov-mcq-score"
      style={{ left: `${anchor.xFrac * 100}%`, top: `${anchor.yFrac * 100}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <path d={circleSvgPath(size)} fill="none" stroke={BOARD_RED_HEX} strokeWidth={size * 0.05} strokeLinecap="round" />
        <FractionSvgContent size={size} numerator={String(anchor.awarded)} denominator={String(anchor.max)} />
      </svg>
      <style jsx>{`
        .chk-ov-mcq-score { position: absolute; transform: translate(-50%, -50%); pointer-events: none; }
      `}</style>
    </div>
  );
}

/** Each subjective section's own circled subtotal, matching the PDF's
 *  circle drawn just above that section's own heading — same anchor rule
 *  (topPct comes pre-offset from the submissions API route, same as
 *  annotatePdf.ts's own SECTION_SUBTOTAL_OFFSET_PCT) and the SAME
 *  paper-wide `marksSide` every subjective answer's own marks use, not a
 *  per-badge decision. Positioned by its own LEFT edge (not center) since
 *  the anchor IS that edge (mirroring annotatePdf.ts's own
 *  `cx = margin + circleSize/2` computation) — only vertical centering
 *  needs a transform. */
function SectionSubtotalBadge({ subtotal, marksSide, aspectRatio }: { subtotal: SectionSubtotalInfo; marksSide: MarksSide; aspectRatio: number }) {
  const size = 100;
  const heightPct = SECTION_SUBTOTAL_CIRCLE_PCT_OF_HEIGHT;
  const widthPct = heightPct * aspectRatio;
  const leftPct = marksSide === 'left' ? MARGIN_INSET_PCT : 100 - MARGIN_INSET_PCT - widthPct;

  return (
    <div
      className="chk-ov-section-subtotal"
      style={{ left: `${leftPct}%`, top: `${subtotal.topPct}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <path d={circleSvgPath(size)} fill="none" stroke={BOARD_RED_HEX} strokeWidth={size * 0.05} strokeLinecap="round" />
        <FractionSvgContent size={size} numerator={String(subtotal.awarded)} denominator={String(subtotal.max)} />
      </svg>
      <style jsx>{`
        .chk-ov-section-subtotal { position: absolute; transform: translateY(-50%); pointer-events: none; }
      `}</style>
    </div>
  );
}

/** Subjective marks — the tick/cross CENTERS on resolveAnswerBox's
 *  resolved box: the model's tight ink-only box when it reported a usable
 *  one, otherwise the coarser answer_top/bottom/left/right_pct band (which,
 *  for a blank answer, is already exactly "the blank ruled-line area
 *  belonging to this question") — the SAME resolution rule
 *  lib/checker/annotate/symbols.ts's resolveAnswerBox applies server-side,
 *  so this is never a second implementation that can silently drift from
 *  the PDF, just the same geometry rendered as an <svg> instead of a
 *  pdf-lib drawSvgPath call. Both tick and cross are stroked paths, always
 *  board-red, even at full marks (the whole subjective scheme reads as one
 *  red-pen marking, not conditional green/red). The marks-text (a single
 *  obtained number, not a fraction) and any comment codes sit on ONE side
 *  for the WHOLE paper (`marksSide`, decided once by
 *  gradeSubjective.ts's decideSubjectiveMarksSide and persisted on the
 *  submission) — never per-row anymore, matching the PDF. `nextTopPct`
 *  (the next question's own REGION answer_top_pct on this page, from
 *  ScanViewer's sorted `subjectiveOrder`) feeds the same
 *  clampSymbolToNeighbor annotatePdf.ts uses, so a large tick correctly
 *  centered on a short answer still can't visually reach into whatever
 *  question comes next — same clamp, same module, not a re-implementation. */
function SubjectiveOverlay({ answer, highlighted, aspectRatio, nextTopPct, marksSide }: {
  answer: SubmissionAnswerRow;
  highlighted: boolean;
  aspectRatio: number;
  nextTopPct: number | null;
  marksSide: MarksSide;
}) {
  const topPct = answer.answer_top_pct!;
  const bottomPct = answer.answer_bottom_pct ?? Math.min(100, topPct + 4);
  const leftPct = answer.answer_left_pct ?? FALLBACK_X_PCT;
  const rightPct = answer.answer_right_pct ?? FALLBACK_X_PCT;
  // Symbol SIZE comes from the region band's own height, unchanged — see
  // annotatePdf.ts's matching comment on why size stays region-based while
  // position prefers the ink box.
  const bandHeightPct = Math.abs(bottomPct - topPct);

  // Symbol POSITION prefers the tight ink box; resolveAnswerBox falls back
  // to the region band when there's none (including every unattempted row).
  const region: AnswerBox = { topPct, bottomPct, leftPct, rightPct };
  const ink: AnswerBox | null = answer.answer_ink_top_pct != null && answer.answer_ink_bottom_pct != null
    && answer.answer_ink_left_pct != null && answer.answer_ink_right_pct != null
    ? { topPct: answer.answer_ink_top_pct, bottomPct: answer.answer_ink_bottom_pct, leftPct: answer.answer_ink_left_pct, rightPct: answer.answer_ink_right_pct }
    : null;
  const resolved = resolveAnswerBox(region, ink);
  const rawCxPct = (resolved.leftPct + resolved.rightPct) / 2;
  const rawCyPct = (resolved.topPct + resolved.bottomPct) / 2;

  const awarded = answer.final_marks ?? 0;
  const kind = symbolFor(awarded, answer.max_marks);
  // Floored at the REGION's own top (never the ink box), same as annotatePdf.ts.
  const { cyPct, sizePct: symbolHeightPct } = clampSymbolToNeighbor(symbolSize(kind, bandHeightPct), topPct, rawCyPct, nextTopPct);
  const cxPct = rawCxPct;
  // Height% and width% are relative to DIFFERENT reference dimensions
  // (the stage's height vs. its width respectively) — without this
  // conversion a symbol sized "5% tall, 5% wide" would render visually
  // squashed/stretched on any non-square page. aspectRatio (naturalHeight/
  // naturalWidth) is exactly the ratio needed to express the SAME physical
  // size as a width percentage instead.
  const symbolWidthPct = symbolHeightPct * aspectRatio;
  const isCross = kind === 'cross';
  // The cross is a stroked path in the shared 0-100 box; the tick is a
  // fixed, filled path in its own 0-48 box (see symbols.ts's tickSvgPath) —
  // different viewBox, different SVG fill/stroke treatment, not just a
  // different `d`.
  const path = isCross ? crossSvgPath(SYMBOL_VIEWBOX) : tickSvgPath();
  const viewboxSize = isCross ? SYMBOL_VIEWBOX : TICK_VIEWBOX_SIZE;
  const strokeWidth = SYMBOL_VIEWBOX * CROSS_STROKE_WIDTH_RATIO;

  const onLeftMargin = marksSide === 'left';
  const marksLabel = String(awarded);
  const codes = (answer.reason_codes || []).filter(c => REASON_CODES[c]);
  // Anchored at the LEFT-middle of the answer's own REGION bbox for a
  // paper-wide-Urdu marks side (right-to-left script's natural marking
  // side), RIGHT-middle otherwise — just outside where the writing ends
  // (a stable reference edge, unlike the ink box's own extent which varies
  // line to line), vertically centered on the SAME (already ink-
  // preferring, clamped) symbol center, matching annotatePdf.ts's
  // placement rather than floating at the page's outer margin/top of the
  // band.
  const marksLeftPct = onLeftMargin
    ? Math.max(0, leftPct - MARKS_GAP_PCT)
    : Math.min(100, rightPct + MARKS_GAP_PCT);
  const marksTransform = onLeftMargin ? 'translate(-100%, -50%)' : 'translate(0, -50%)';

  return (
    <>
      {highlighted && (
        <div
          className="chk-ov-subj-ring"
          style={{ left: `${cxPct}%`, top: `${cyPct}%`, width: `${symbolWidthPct * 1.6}%`, height: `${symbolHeightPct * 1.6}%` }}
        />
      )}
      <div
        className="chk-ov-subj-symbol"
        style={{ left: `${cxPct}%`, top: `${cyPct}%`, width: `${symbolWidthPct}%`, height: `${symbolHeightPct}%`, opacity: DEFAULT_OPACITY }}
      >
        <svg viewBox={`0 0 ${viewboxSize} ${viewboxSize}`} width="100%" height="100%">
          {isCross ? (
            <path d={path} fill="none" stroke={BOARD_RED_HEX} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={path} fill={TICK_FILL_HEX} stroke="none" />
          )}
        </svg>
      </div>
      <div
        className="chk-ov-subj-marks"
        style={{
          top: `${cyPct}%`,
          left: `${marksLeftPct}%`,
          transform: marksTransform,
          color: BOARD_RED_HEX,
          textAlign: onLeftMargin ? 'right' : 'left',
        }}
      >
        <div className="chk-ov-subj-marks-label">{marksLabel}</div>
        {codes.length > 0 && <div className="chk-ov-subj-marks-reason">{codes.join(', ')}</div>}
      </div>
      <style jsx>{`
        .chk-ov-subj-symbol {
          position: absolute; transform: translate(-50%, -50%); pointer-events: none;
          filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.9)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
        }
        .chk-ov-subj-ring {
          position: absolute; transform: translate(-50%, -50%); pointer-events: none;
          border-radius: 999px; border: 3px solid #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.35);
        }
        .chk-ov-subj-marks {
          position: absolute; pointer-events: none; font-weight: 800; white-space: nowrap;
        }
        .chk-ov-subj-marks-label { font-size: 1.1rem; }
        .chk-ov-subj-marks-reason { font-size: 0.68rem; opacity: 0.9; font-weight: 700; }
      `}</style>
    </>
  );
}

//dashboard/generate-paper/components/PaperLayoutRenderer.tsx
'use client';
import React, { useMemo, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { PaperSection, PaperSettings, LanguageConfig } from '@/types/paper-builder';
import { PaperHeader } from './PaperHeader';
import { SectionHeader } from './SectionHeader';
import { QuestionRenderer, RichText } from './QuestionRenderer';
import { EditableText } from './EditableText';
import { toast } from 'react-hot-toast';
import { getBucket, FOUR_PAPERS_SHORT_CAP, FOUR_PAPERS_LONG_CAP } from '@/lib/paperQuestionBuckets';
import { getPageSize } from '@/lib/paperPageSize';

interface Props {
  paperSections: PaperSection[];
  settings: PaperSettings;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: LanguageConfig;
  isEditMode: boolean;
  currentLayout: string;
  onTextChange: (sId: string, qId: string, f: string, v: string) => void;
  isPremium: boolean;
  onSectionUpdate: (updatedSections: PaperSection[]) => void;
  renderInlineBilingual?: boolean;
  currentClass?: string;
  profile: any;
  questionLineSpacing?: number;
  subjectUrduName?: string;
  paperPart?: any;
  onEditSection?: (section: PaperSection) => void;
  onDeleteSection?: (sectionId: string) => void;
}

const URDU_FONT = "'JameelNoori', 'Noto Nastaliq Urdu', serif";

const Watermark = ({
  isPremium, logoUrl, settings, scale = 1, top = '50%'
}: {
  isPremium: boolean; logoUrl?: string; settings: PaperSettings; scale?: number; top?: string;
}) => {
  if (!settings.showWatermark) return null;
  const watermarkImg = isPremium && logoUrl ? logoUrl : '/examly.png';
  const width   = (settings.watermarkWidth  || 400) * scale;
  const height  = (settings.watermarkHeight || 400) * scale;
  const opacity = settings.watermarkOpacity || 0.1;
  return (
    <div style={{
      position: 'absolute', top, left: '50%',
      transform: 'translate(-50%, -50%) rotate(-30deg)',
      zIndex: 10, pointerEvents: 'none', opacity,
      width: `${width}px`, height: `${height}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: 0, padding: 0, overflow: 'visible',
    }}>
      <img src={watermarkImg} alt="watermark"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OMRAnswerGrid — standalone MCQ answer-bubble sheet, one row per question
// number with horizontal (A)(B)(C)(D) bubbles to shade. Print-only chrome,
// not tied to individual question content (just needs the count). Flows
// into a 4-column layout so it stays compact regardless of question count.
// ─────────────────────────────────────────────────────────────────────────
const OMR_OPTIONS = ['A', 'B', 'C', 'D'];

const OMRAnswerGrid = ({ questionCount }: { questionCount: number }) => {
  if (questionCount <= 0) return null;
  const questionNumbers = Array.from({ length: questionCount }, (_, i) => i + 1);

  return (
    <div style={{
      marginTop: '2mm', marginBottom: '4mm', breakInside: 'avoid',
      border: '0.4mm solid #000', borderRadius: '1.5mm', padding: '2.5mm 3mm 3mm',
    }}>
      <div style={{
        fontWeight: 800, fontSize: '10.5px', textAlign: 'center', letterSpacing: '0.3px',
        textTransform: 'uppercase', borderBottom: '0.5mm solid #000',
        paddingBottom: '1.2mm', marginBottom: '2.5mm',
      }}>
        MCQ Answer Sheet
      </div>
      <div style={{ columnCount: 4, columnGap: '4mm' }}>
        {questionNumbers.map(qNum => (
          <div
            key={qNum}
            style={{
              display: 'flex', alignItems: 'center', gap: '2mm',
              breakInside: 'avoid', marginBottom: '2mm',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '9.5px', minWidth: '7mm' }}>{qNum}.</span>
            {OMR_OPTIONS.map(opt => (
              <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6mm' }}>
                <span style={{ fontWeight: 700, fontSize: '7.5px' }}>{opt}</span>
                <span style={{
                  display: 'inline-block', width: '3.8mm', height: '3.8mm',
                  borderRadius: '50%', border: '0.35mm solid #000',
                }} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: '0.35mm solid #000', marginTop: '2.5mm' }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// PaginatedPaperGroup
// ─────────────────────────────────────────────────────────────────────────
// Splits a group of sections across as many physical pages as its content
// actually needs, instead of clipping overflow — used only for the
// separate/same_page layouts (two/three/four-papers-per-page keep their
// original fixed-slot behaviour untouched).
//
// This is a genuinely stateful, two-pass component: pass 1 renders the
// group's full, unpaginated content into a hidden measurement container
// (portaled straight into document.body so it's never affected by the
// mobile preview's CSS transform-scale, which would otherwise corrupt every
// height reading) and records each question's/section-header's/atomic
// section's real rendered height. Pass 2 uses those measurements to decide
// page breaks and renders the actual, visible `.paper-sheet` pages.
//
// It MUST stay a stable, module-level component (not redefined inside
// PaperLayoutRenderer's render body) — a component recreated fresh on every
// parent render is a different type to React on every render, so it would
// unmount/remount (losing its measured page plan) constantly instead of
// only when the content actually changes.
//
// A section is "atomic" (never split mid-section, measured as one whole
// block via sectionBlockHeights) when:
//  - it's a paired-long pair, an OR-alternative group, or a mixed sub-part
//    block — splitting any of those partway through would break
//    numbering/labels that only make sense as a whole, OR
//  - at least one of its questions would render narrower than col-12 (see
//    getDynamicColClass below — anything under ~120 chars gets col-3/4/6),
//    i.e. it packs multiple short items per row instead of one-per-row. The
//    per-question packing loop further down sums each question's OWN
//    measured height as if every question stacked vertically one-per-row;
//    for a grid that wraps 3-4 short items (idioms, pair-of-words, one-line
//    translate sentences, activePassive/directInDirect items, etc.) per
//    row, that sum overcounts the section's real height by roughly the
//    column count (~4x for col-3), making the packer break the page far
//    earlier than the content actually needs — leaving large blank gaps
//    (reported as "text pushed to next page while the page still has
//    room"). Measuring the whole grid as one block sidesteps the row-wrap
//    math entirely and gets its true rendered height directly from the DOM.
//    Checked against the actual question text (mirroring
//    getDynamicColClass's own heuristic) rather than section.type alone —
//    a type-only check would also catch genuinely long-form sections (e.g.
//    a translate_urdu section whose paragraphs are long enough to already
//    render col-12) and needlessly force those atomic too, risking a
//    single overlong block that itself doesn't fit one page.
// Every other section (full-width MCQ/short/long/summary/essay lists, or
// any section whose questions all render col-12 anyway) is still split at
// question boundaries when it doesn't fit the remaining space.
const FULL_WIDTH_SECTION_TYPES = new Set(['mcq', 'long', 'summary', 'essay']);
const sectionHasGridFlowQuestion = (section: PaperSection, subject: string): boolean => {
  const t = (section.type || '').toLowerCase();
  if (FULL_WIDTH_SECTION_TYPES.has(t)) return false;
  if (t.includes('darkhwast_khat') || t.includes('kahani_makalma')) return false;
  // short+urdu is handled separately below (getGridColumnsPerRow) — it has a
  // FIXED, known column count, so it can be measured/split per row instead
  // of needing full atomicity.
  if (t === 'short') return false;
  const questions = Array.isArray(section.questions) ? section.questions : [];
  return questions.some((q: any) => {
    const engText = q?.question_text || q?.question || '';
    const urText  = q?.question_text_ur || '';
    const len = engText.length + urText.length * 1.5;
    return len < 120; // matches getDynamicColClass: col-3/col-4/col-6, i.e. not full width
  });
};
// Sections whose questions render in a FIXED N-per-row grid (short+urdu is
// always col-6, i.e. exactly 2 per row — see getDynamicColClass) don't need
// to be treated as one unsplittable block: unlike the variable-column grid
// case above (col-3/4/6 chosen per-question by text length, where rows can
// have a different item count from one another), a fixed column count means
// row boundaries are known in advance, so the packer can measure per
// question (same as any non-atomic section) and slice at row boundaries —
// never splitting a row's questions across two pages, but otherwise
// behaving like a normal splittable section. This is what actually fixes
// sections tall enough to exceed a single page on their own: a genuinely
// atomic block that's taller than one page can only ever overflow it
// (wasting the rest of whatever page its tail lands on, since the next,
// separate section is always forced onto a fresh page after it) — see the
// isAtomicSection usage below.
const getGridColumnsPerRow = (section: PaperSection, subject: string): number | null => {
  const t = (section.type || '').toLowerCase();
  if (t === 'short' && subject.toLowerCase() === 'urdu' &&
      Array.isArray(section.questions) && section.questions.length > 0) return 2;
  return null;
};
const isAtomicSection = (section: PaperSection, subject: string): boolean => {
  // A paired-long pair or OR-alternative group needs to stay atomic — those
  // have their own dedicated (non-sliceable) render paths that exist to
  // keep two/three items reading as a single semantic unit. A merged
  // multi-subgroup section (multiple chapter rules combined under one
  // Q-number, e.g. "subgroups.length > 1") does NOT need to be atomic
  // anymore: its render path (the hasSubgroups branch further down)
  // understands questionSlice and splits at question boundaries across
  // subgroups while keeping numbering/labels correct — each subgroup's own
  // label is only shown on the page where it first appears. That's what
  // actually fixes a merged group whose combined content is taller than one
  // page: forcing it atomic just meant it could only ever overflow (wasting
  // the rest of whatever page its tail spilled onto, since the next,
  // separate section is always forced onto a fresh page after it).
  if (Boolean((section as any).isPairedLong) ||
      Boolean((section as any).isAlternativeGroup)) return true;
  // A merged multi-subgroup MCQ section (multiple chapter rules under one
  // Q-number) is now safe to split too — both MCQ render paths (the boxed/
  // bordered-table layout and the plain-list layout, see isMcqBoxedSection
  // further down) understand questionSlice/onQuestionRef. Forcing it atomic
  // meant an MCQ section taller than one page had no choice but to overflow
  // — with print now clipping instead of letting content spill (see
  // sheetBaseStyle/print <style> block), that overflow silently lost
  // questions instead of just wasting space, which splitting avoids
  // entirely.
  if (getGridColumnsPerRow(section, subject) !== null) return false; // row-splittable instead
  return sectionHasGridFlowQuestion(section, subject);
};

type PageEntry =
  | { section: PaperSection; atomic: true }
  | { section: PaperSection; atomic: false; start: number; end: number; suppressHeader: boolean };

const MM_TO_PX = 96 / 25.4;
const PAGE_FOOTER_RESERVE_MM = 8;
// Safety cushion on every measured height, for residual rounding/font drift
// between the hidden measurement pass and the final render. Every sheet is
// now hard-capped to one physical page with overflow clipped in print (see
// the paper-sheet--flow print rule below) — real, uncontrolled fragmentation
// bugs proved far more damaging than a tight pack, so a page running a hair
// too full is no longer harmlessly absorbed by an extra physical page; it
// silently clips instead. A few percent of headroom here trades a little
// packing density for meaningfully lowering that risk.
const MEASURED_HEIGHT_SAFETY_FACTOR = 1.05;

interface PaginatedPaperGroupProps {
  group: PaperSection[];
  marks: number;
  keyPrefix: string;
  part: 'mcq' | 'subjective' | 'combined';
  subject: string;
  isPremium: boolean;
  profile: any;
  isEditMode: boolean;
  settings: PaperSettings;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: LanguageConfig;
  currentLayout: string;
  currentClass?: string;
  subjectUrduName?: string;
  sheetBaseStyle: React.CSSProperties;
  pageContentHeightMm: number;
  renderSectionBlock: (
    section: PaperSection,
    extra?: {
      questionSlice?: { start: number; end: number; suppressHeader?: boolean };
      onQuestionRef?: (questionId: string, idx: number, el: HTMLDivElement | null) => void;
      onSectionHeaderRef?: (sectionId: string, el: HTMLDivElement | null) => void;
    }
  ) => React.ReactNode;
}

const PaginatedPaperGroup: React.FC<PaginatedPaperGroupProps> = ({
  group, marks, keyPrefix, part, subject, isPremium, profile, isEditMode,
  settings, paperLanguage, config, currentLayout, currentClass, subjectUrduName,
  sheetBaseStyle, pageContentHeightMm, renderSectionBlock,
}) => {
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const headerMeasureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageEntry[][] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => setMounted(true), []);

  // The Urdu heading/body font (JameelNoori) is declared with
  // `font-display: swap`, so the very first paint of any Urdu text —
  // including inside the hidden measurement container below — uses a
  // fallback font (plain serif) until the real webfont finishes downloading,
  // then reflows. Nastaliq-style Urdu fonts render noticeably taller per
  // line than a fallback serif, so measuring before the swap undercounts
  // every Urdu-containing question's real height. That gap is exactly what
  // let a page's last question fit by the (stale) measurement while its
  // answer lines silently ran off the bottom of the (correctly, later,
  // taller) printed page. Waiting for document.fonts.ready before the very
  // first measurement pass — and re-measuring once it resolves, in case that
  // first pass already ran — closes the gap at its source instead of just
  // padding around it.
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      setFontsReady(true);
      return;
    }
    let cancelled = false;
    document.fonts.ready.then(() => { if (!cancelled) setFontsReady(true); });
    return () => { cancelled = true; };
  }, []);

  // TEMPORARY DIAGNOSTIC — remove alongside the other [PAGINATION-DEBUG]
  // logging once root-caused. Measures the ACTUAL rendered .paper-sheet
  // divs' heights at the exact moment print starts (when @media print CSS
  // is active) and compares against the budget the plan assumed — this
  // tells us directly whether print-time rendering comes out taller than
  // what the (screen-context) measurement pass predicted.
  useEffect(() => {
    const onBeforePrint = () => {
      const sheets = document.querySelectorAll(`[data-pagination-debug-sheet^="${keyPrefix}-"]`);
      // eslint-disable-next-line no-console
      console.log(`[PAGINATION-DEBUG] beforeprint: keyPrefix=${keyPrefix} pageSize=A4-or-legal(see earlier log) @page-should-be=${pageContentHeightMm.toFixed(1)}mm content`);
      sheets.forEach(el => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        // eslint-disable-next-line no-console
        console.log(`[PAGINATION-DEBUG] beforeprint:   ${el.getAttribute('data-pagination-debug-sheet')} actualHeightPx=${rect.height.toFixed(1)} actualHeightMm=${(rect.height / (96 / 25.4)).toFixed(1)}`);
      });
    };
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, [keyPrefix, pageContentHeightMm]);

  // TEMPORARY DIAGNOSTIC — compares the ACTUAL computed style (not just
  // height) of the first MCQ row in normal screen state vs. the moment
  // print activates, to find exactly which CSS property (line-height,
  // padding, font-size) differs between the two and is inflating row
  // spacing in print relative to what's shown on screen.
  useEffect(() => {
    const logRowStyle = (label: string) => {
      const row = document.querySelector(`[data-pagination-debug-sheet^="${keyPrefix}-"] tr`);
      if (!row) return;
      const rowCs = window.getComputedStyle(row as Element);
      const td = row.querySelector('td:last-child');
      const tdCs = td ? window.getComputedStyle(td) : null;
      const inner = td?.querySelector('.question-lh-scope, .mcq-item');
      const innerCs = inner ? window.getComputedStyle(inner) : null;
      // eslint-disable-next-line no-console
      console.log(
        `[PAGINATION-DEBUG] rowStyle(${label}) keyPrefix=${keyPrefix} ` +
        `tr: height=${(row as HTMLElement).getBoundingClientRect().height.toFixed(1)}px lineHeight=${rowCs.lineHeight} fontSize=${rowCs.fontSize} ` +
        (tdCs ? `| td: padding=${tdCs.padding} lineHeight=${tdCs.lineHeight} fontSize=${tdCs.fontSize} ` : '') +
        (innerCs ? `| inner(${inner!.className}): lineHeight=${innerCs.lineHeight} fontSize=${innerCs.fontSize} margin=${innerCs.margin} padding=${innerCs.padding}` : '')
      );
    };
    const onBeforePrint = () => logRowStyle('beforeprint');
    window.addEventListener('beforeprint', onBeforePrint);
    const t = setTimeout(() => logRowStyle('normal-screen'), 800);
    return () => { window.removeEventListener('beforeprint', onBeforePrint); clearTimeout(t); };
  }, [keyPrefix]);

  // Re-measure whenever anything that could change rendered heights changes —
  // question content/count, or any font/spacing setting.
  const measureKey = JSON.stringify({
    ids: group.map(s => ({ id: s.id, n: s.questions?.length, t: s.type, ts: s.timestamp })),
    fontSize: settings.fontSize, lineHeight: settings.lineHeight,
    headingFontSize: settings.headingFontSize, mcqFontSize: settings.mcqFontSize,
    mcqLineHeight: settings.mcqLineHeight, fontFamily: settings.fontFamily,
    pageContentHeightMm, paperLanguage, currentLayout, isEditMode,
    // Toggling/adjusting answer lines changes every affected question's
    // rendered height, so it must trigger a fresh measure pass too — this
    // was missing before, which is why enabling/disabling them didn't
    // actually reflow the page count.
    showAnswerLines: settings.showAnswerLines,
    answerLinesShort: settings.answerLinesShort,
    answerLinesLong: settings.answerLinesLong,
    answerLineGapMm: settings.answerLineGapMm,
    showMcqBubbleSheet: settings.showMcqBubbleSheet,
  });

  // Only sheets that actually contain MCQs get the bubble sheet — a
  // subjective-only sheet (the 'separate' layout's second page group) has no
  // MCQ question numbers to list.
  const mcqQuestionCount = group
    .filter(s => s.type === 'mcq')
    .reduce((sum, s) => sum + (s.questions?.length || 0), 0);
  const showBubbles = Boolean(settings.showMcqBubbleSheet) &&
    (part === 'mcq' || part === 'combined') && mcqQuestionCount > 0;

  // Silently recompute the page plan in the background whenever anything
  // relevant changes, WITHOUT ever un-rendering the currently-committed
  // `pages` first. The previous version did `setPages(null)` up front, which
  // blanked this component's own visible output while the hidden measure
  // pass ran — collapsing the scrollable page's height for a moment and
  // yanking the user's scroll position to the bottom every time a setting
  // (e.g. answer lines, MCQ bubble sheet) was toggled. The hidden measurement
  // container is now ALWAYS rendered (in addition to, not instead of, the
  // real visible pages — see the return statement below), so the previous
  // plan stays on screen undisturbed until the new one is ready to swap in.
  useLayoutEffect(() => {
    if (!mounted || !fontsReady) return;
    const container = measureContainerRef.current;
    if (!container) return;

    const measure = (el: Element) => el.getBoundingClientRect().height * MEASURED_HEIGHT_SAFETY_FACTOR;

    const headerHeightPx = headerMeasureRef.current
      ? measure(headerMeasureRef.current)
      : 0;

    const sectionBlockHeights: Record<string, number> = {};
    const sectionHeaderHeights: Record<string, number> = {};
    const questionHeights: Record<string, Record<number, number>> = {};

    container.querySelectorAll('[data-measure-section-block]').forEach(el => {
      const id = el.getAttribute('data-measure-section-block')!;
      sectionBlockHeights[id] = measure(el);
    });
    container.querySelectorAll('[data-measure-section-header]').forEach(el => {
      const id = el.getAttribute('data-measure-section-header')!;
      sectionHeaderHeights[id] = measure(el);
    });
    container.querySelectorAll('[data-measure-question]').forEach(el => {
      const sectionId = el.getAttribute('data-measure-question')!;
      const idx = Number(el.getAttribute('data-measure-idx'));
      if (!questionHeights[sectionId]) questionHeights[sectionId] = {};
      questionHeights[sectionId][idx] = measure(el);
    });

    const contentHeightPx = pageContentHeightMm * MM_TO_PX;
    const footerReservePx = PAGE_FOOTER_RESERVE_MM * MM_TO_PX;
    const firstPageBudget = contentHeightPx - headerHeightPx - footerReservePx;
    const otherPageBudget = contentHeightPx - footerReservePx;

    const plan: PageEntry[][] = [[]];
    let pageIdx = 0;
    let used = 0;
    let budget = firstPageBudget;

    const newPage = () => {
      pageIdx += 1;
      plan.push([]);
      used = 0;
      budget = otherPageBudget;
    };

    // A single block (an atomic section measured whole, or one freakishly
    // tall question) can be taller than an entire page's budget — it can't
    // be split further, so its own CSS overflow (paper-sheet--flow doesn't
    // clip) spills across as many EXTRA physical pages as it needs. If our
    // own pageIdx/used bookkeeping doesn't advance to match, `used` is left
    // far over `budget` for a page we still think is "current" — so the
    // NEXT section's fit-check always forces newPage(), stranding it on a
    // brand new physical page even though the overflow already left room on
    // the LAST physical page it spilled onto. Carrying the remainder
    // forward (instead of resetting to 0, like newPage() does) lets the
    // next section share that leftover space instead of wasting it.
    const advancePastOverflow = () => {
      while (used > budget) {
        used -= budget;
        pageIdx += 1;
        plan.push([]);
        budget = otherPageBudget;
      }
    };

    for (const section of group) {
      // eslint-disable-next-line no-console
      console.log(`[PAGINATION-DEBUG] section=${section.id} type=${section.type} subject=${subject} subgroupsLen=${(section as any).subgroups?.length ?? 'n/a'} isPairedLong=${Boolean((section as any).isPairedLong)} isAlternativeGroup=${Boolean((section as any).isAlternativeGroup)} columnsPerRow=${getGridColumnsPerRow(section, subject)} => atomic=${isAtomicSection(section, subject)}`);
      if (isAtomicSection(section, subject)) {
        const h = sectionBlockHeights[section.id] ?? 0;
        if (used > 0 && used + h > budget) newPage();
        plan[pageIdx].push({ section, atomic: true });
        used += h;
        advancePastOverflow();
        continue;
      }

      const qHeights = questionHeights[section.id];
      const totalQuestions = section.questions?.length || 0;
      if (!qHeights || totalQuestions === 0) continue;
      const headerH = sectionHeaderHeights[section.id] ?? 0;
      const columnsPerRow = getGridColumnsPerRow(section, subject);

      let qStart = 0;
      let firstSlice = true;
      let guard = 0;
      while (qStart < totalQuestions) {
        guard += 1;
        if (guard > totalQuestions * 4 + 20) break; // safety net — should never trigger

        const reserve = firstSlice ? headerH : 0;
        const remaining = budget - used - reserve;
        if (remaining <= 0 && used > 0) { newPage(); continue; }

        let qEnd = qStart;
        let consumed = 0;
        if (columnsPerRow) {
          // Fixed-column grid (e.g. short+urdu, always 2-per-row): pack
          // whole rows at a time — a row's height is its tallest question,
          // and a row is never split across two pages. Each slice starts
          // its own fresh grid-row wrapper when rendered, so rows are
          // counted relative to qStart, not the section's absolute index 0.
          let rowStart = qStart;
          let firstRow = true;
          while (rowStart < totalQuestions) {
            const rowEnd = Math.min(rowStart + columnsPerRow, totalQuestions);
            let rowHeight = 0;
            for (let i = rowStart; i < rowEnd; i++) rowHeight = Math.max(rowHeight, qHeights[i] ?? 0);
            if (!firstRow && consumed + rowHeight > remaining) break;
            consumed += rowHeight;
            qEnd = rowEnd;
            rowStart = rowEnd;
            firstRow = false;
          }
        } else {
          while (qEnd < totalQuestions) {
            const qH = qHeights[qEnd] ?? 0;
            if (qEnd > qStart && consumed + qH > remaining) break;
            consumed += qH;
            qEnd += 1;
          }
        }
        if (qEnd === qStart) {
          if (used > 0) { newPage(); continue; }
          // Not even one question (or row) fits a *fresh* page — place it
          // alone rather than looping forever; it may overflow (an
          // unusually huge question/row).
          qEnd = columnsPerRow ? Math.min(qStart + columnsPerRow, totalQuestions) : qStart + 1;
        }

        plan[pageIdx].push({ section, atomic: false, start: qStart, end: qEnd, suppressHeader: !firstSlice });
        used += consumed + reserve;
        // A single unusually tall question (qEnd === qStart + 1 forced above)
        // can itself overflow past one page — carry the remainder forward
        // the same way the atomic branch does, instead of letting the next
        // iteration's plain newPage() reset used to 0 and lose track of how
        // much of the LAST overflow page is already spoken for.
        advancePastOverflow();
        firstSlice = false;
        qStart = qEnd;
      }
    }

    // Coalesce adjacent same-section slices that ended up on the SAME page
    // back into one continuous range. The packing loop above can split a
    // section into multiple slices for reasons that don't always mean "these
    // belong on different pages" — e.g. the last item of a run not quite
    // fitting `remaining` still gets placed on the same page via
    // advancePastOverflow's leftover-space carry-forward, as two separate
    // slices. Each slice renders through its own call to the section's
    // render function, and for table-based layouts (the MCQ boxed/bordered
    // style) that means a fresh <table> per slice — two slices on the same
    // page rendered as two visually separate tables even though there was no
    // real page break between them. Merging contiguous same-section slices
    // within a page fixes that without changing anything about which page
    // content actually lands on.
    for (const entries of plan) {
      for (let i = entries.length - 1; i > 0; i--) {
        const cur = entries[i];
        const prev = entries[i - 1];
        if (!cur.atomic && !prev.atomic &&
            cur.section.id === prev.section.id &&
            cur.start === prev.end) {
          prev.end = cur.end;
          entries.splice(i, 1);
        }
      }
    }

    // TEMPORARY DIAGNOSTIC — remove once the blank-page pagination bug is
    // root-caused. Open DevTools Console (F12) before generating/printing
    // the paper and copy everything logged under this tag. Logged as flat
    // JSON strings (not raw objects) so it copies fully as text without
    // needing to manually expand anything in the console first.
    // eslint-disable-next-line no-console
    console.log(`[PAGINATION-DEBUG] keyPrefix=${keyPrefix} pageSizeMm=${pageContentHeightMm.toFixed(1)}(content)+${PAGE_FOOTER_RESERVE_MM}(footer) firstPageBudget=${firstPageBudget.toFixed(1)}px otherPageBudget=${otherPageBudget.toFixed(1)}px headerHeightPx=${headerHeightPx.toFixed(1)} devicePixelRatio=${typeof window !== 'undefined' ? window.devicePixelRatio : 'n/a'} innerWidth=${typeof window !== 'undefined' ? window.innerWidth : 'n/a'}`);
    // eslint-disable-next-line no-console
    console.log('[PAGINATION-DEBUG] sectionBlockHeights=' + JSON.stringify(sectionBlockHeights));
    // eslint-disable-next-line no-console
    console.log('[PAGINATION-DEBUG] sectionHeaderHeights=' + JSON.stringify(sectionHeaderHeights));
    Object.entries(questionHeights).forEach(([secId, heights]) => {
      const entries2 = Object.entries(heights as Record<string, number>)
        .sort((a, b) => Number(a[0]) - Number(b[0]));
      let running = 0;
      const rows = entries2.map(([idx, h]) => {
        running += h;
        return `idx${idx}=${h.toFixed(1)}px(sum=${running.toFixed(1)})`;
      });
      // eslint-disable-next-line no-console
      console.log(`[PAGINATION-DEBUG] questionHeights[${secId}]: ${rows.join(' ')}`);
    });
    // eslint-disable-next-line no-console
    console.log(`[PAGINATION-DEBUG] plan has ${plan.length} page(s):`);
    plan.forEach((entries, i) => {
      if (entries.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[PAGINATION-DEBUG]   page ${i + 1}: EMPTY (0 entries) <-- this would render as a blank sheet`);
        return;
      }
      entries.forEach(e => {
        // eslint-disable-next-line no-console
        console.log(`[PAGINATION-DEBUG]   page ${i + 1}: section=${e.section.id} type=${e.section.type} atomic=${e.atomic}${e.atomic ? '' : ` start=${e.start} end=${e.end} suppressHeader=${e.suppressHeader}`}`);
      });
    });

    // advancePastOverflow() pre-emptively opens a new page slot the moment a
    // section's content overflows past the current page's budget, so a
    // section placed right after it can share the leftover space. When the
    // overflowing section is the LAST one in the group, nothing ever fills
    // that slot — it stays a genuinely empty page entry, which would
    // otherwise render as a blank .paper-sheet with nothing on it. An empty
    // page carries no content, so dropping it here is always safe.
    setPages(plan.filter(entries => entries.length > 0));
  // `mounted` must be a dependency: on the very first render the hidden
  // measurement container hasn't been portaled into the DOM yet, so this
  // effect bails out via the `!container` guard — it needs to retry once
  // `mounted` flips true and the container actually exists. `fontsReady`
  // must be one too, for the same reason — the effect bails out via the
  // `!fontsReady` guard until webfonts have finished loading, then needs to
  // retry (and recompute with corrected, post-swap heights) once it flips.
  // `measureKey` covers every other reason to recompute (content/settings
  // changes).
  }, [measureKey, mounted, fontsReady]);

  if (group.length === 0) return null;

  const headerNode = (
    <PaperHeader
      totalMarks={marks} subject={subject} paperSections={group}
      isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage}
      config={config} currentLayout={currentLayout} currentClass={currentClass}
      profile={profile} paperPart={part} subjectUrduName={subjectUrduName}
    />
  );

  const bubbleNode = showBubbles ? <OMRAnswerGrid questionCount={mcqQuestionCount} /> : null;

  // Hidden measurement render (unpaginated, full content) — ALWAYS present
  // (portaled straight into document.body, immune to the mobile preview's
  // CSS transform-scale) so a fresh plan can be computed silently in the
  // background without ever un-rendering the pages below.
  //
  // `d-print-none` forces display:none at print time. This isn't just belt-
  // and-suspenders: `position: fixed` is unreliable for paged/print media —
  // there's no single continuous "screen" for it to be fixed relative to, so
  // browsers can (and do) reinterpret a fixed element per physical page
  // during print instead of leaving it parked off-page the way it renders on
  // screen. That can leak this purely-for-measurement subtree into the
  // printed output as stray blank space or duplicated content, even though
  // it's invisible and correctly off-screen in the normal browser view. It
  // serves no purpose at print time anyway — the `pages` plan is already
  // committed by then — so removing it from the print tree entirely is
  // always correct, independent of whatever else may be going on.
  const measureNode = mounted ? createPortal(
    <div
      ref={measureContainerRef}
      aria-hidden="true"
      className="d-print-none"
      style={{
        // `absolute` (not `fixed`) far off to the left: an out-of-page
        // absolutely-positioned element is reliably clipped by every print
        // engine, unlike `fixed`, whose page-relative behaviour in paged
        // media is genuinely ambiguous (see note above `measureNode`).
        position: 'absolute', top: 0, left: '-9999px', zIndex: -1,
        width: sheetBaseStyle.width, padding: sheetBaseStyle.padding,
        boxSizing: 'border-box', fontFamily: sheetBaseStyle.fontFamily,
        visibility: 'hidden', pointerEvents: 'none',
      }}
    >
      <div ref={headerMeasureRef}>{headerNode}{bubbleNode}</div>
      {group.map(section => (
        isAtomicSection(section, subject) ? (
          <div key={section.id} data-measure-section-block={section.id}>
            {renderSectionBlock(section)}
          </div>
        ) : (
          <React.Fragment key={section.id}>
            {renderSectionBlock(section, {
              onSectionHeaderRef: (id, el) => {
                if (el) el.setAttribute('data-measure-section-header', id);
              },
              onQuestionRef: (_qId, idx, el) => {
                if (el) {
                  el.setAttribute('data-measure-question', section.id);
                  el.setAttribute('data-measure-idx', String(idx));
                }
              },
            })}
          </React.Fragment>
        )
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      {measureNode}
      {pages && pages.map((entries, pageIdx) => (
        <div
          key={`${keyPrefix}-page-${pageIdx}`}
          data-pagination-debug-sheet={`${keyPrefix}-${pageIdx}`}
          className="paper-sheet paper-sheet--flow border shadow-sm print-break"
          style={sheetBaseStyle}
        >
          <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} />
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0 }}>
            {pageIdx === 0 && headerNode}
            {pageIdx === 0 && bubbleNode}
            {entries.map((entry, i) => (
              <React.Fragment key={`${entry.section.id}-${i}`}>
                {entry.atomic
                  ? renderSectionBlock(entry.section)
                  : renderSectionBlock(entry.section, {
                      questionSlice: { start: entry.start, end: entry.end, suppressHeader: entry.suppressHeader },
                    })}
              </React.Fragment>
            ))}
          </div>
          {pages.length > 1 && (
            <div style={{ textAlign: 'center', fontSize: '9px', color: '#555', paddingTop: '2mm', flexShrink: 0 }}>
              Page {pageIdx + 1}
            </div>
          )}
        </div>
      ))}
    </>
  );
};

export const PaperLayoutRenderer: React.FC<Props> = ({
  paperSections = [],
  settings,
  paperLanguage,
  config,
  isEditMode,
  currentLayout,
  onTextChange,
  isPremium,
  onSectionUpdate,
  renderInlineBilingual = true,
  currentClass,
  profile,
  subjectUrduName,
  onEditSection,
  onDeleteSection,
}) => {
  const subject = useMemo(() => paperSections[0]?.subject || '', [paperSections]);

  const globalNumbering = useMemo(() => {
    const sectionStartNumbers: Record<string, number> = {};
    let currentCount = 1;
    paperSections.forEach((section, index) => {
      const sectionType     = section.type.toLowerCase();
      const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';
      const prevSection     = index > 0 ? paperSections[index - 1] : null;
      const prevType        = prevSection?.type.toLowerCase() || '';
      const isSecondPartOfPair =
        (sectionType.includes('gazal')               && prevType.includes('poetry_explanation')) ||
        (sectionType.includes('sentence_completion') && prevType.includes('sentence_correction'));
      if (isSecondPartOfPair) {
        sectionStartNumbers[section.id] = currentCount - 1;
      } else {
        sectionStartNumbers[section.id] = currentCount;
        const isLong = sectionType.includes('long') || sectionType.includes('summary') ||
          sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');
        const isPairedLong = Boolean((section as any).isPairedLong);
        const isAlternativeGroup = Boolean((section as any).isAlternativeGroup);
        if (isPairedLong || isAlternativeGroup) {
          currentCount += 1;
        } else if (isLong) {
          if (isUrduOrEnglish) { currentCount += 1; }
          else { currentCount += Array.isArray(section.questions) ? section.questions.length : 0; }
        } else {
          currentCount += 1;
        }
      }
    });
    return sectionStartNumbers;
  }, [paperSections, subject]);

  const { mcqs, subjectives } = useMemo(() => ({
    mcqs:        paperSections.filter(s => s.type === 'mcq'),
    subjectives: paperSections.filter(s => s.type !== 'mcq'),
  }), [paperSections]);

  const {
    fourPaperShortSections, fourPaperLongSections, shortOverflow, longOverflow,
  } = useMemo(() => {
    if (currentLayout !== 'four_papers') {
      return {
        fourPaperShortSections: [] as PaperSection[],
        fourPaperLongSections:  [] as PaperSection[],
        shortOverflow: false, longOverflow: false,
      };
    }
    const shortSections = paperSections.filter(s => getBucket(s.type) === 'short');
    const longSections  = paperSections.filter(s => getBucket(s.type) === 'long');
    const totalShortQs  = shortSections.reduce((sum, s) => sum + (s.questions?.length || 0), 0);
    const totalLongQs   = longSections.reduce( (sum, s) => sum + (s.questions?.length || 0), 0);
    const trimToCap = (sections: PaperSection[], cap: number): PaperSection[] => {
      const result: PaperSection[] = [];
      let remaining = cap;
      for (const s of sections) {
        if (remaining <= 0) break;
        const qs = s.questions || [];
        if (qs.length <= remaining) { result.push(s); remaining -= qs.length; }
        else {
          const keptCount = remaining;
          result.push({
            ...s,
            questions:     qs.slice(0, keptCount),
            totalQuestions: keptCount,
            attemptCount:  Math.min(s.attemptCount, keptCount),
            totalMarks:    Math.min(s.attemptCount, keptCount) * (s.marksEach || 1),
          });
          remaining = 0;
        }
      }
      return result;
    };
    return {
      fourPaperShortSections: trimToCap(shortSections, FOUR_PAPERS_SHORT_CAP),
      fourPaperLongSections:  trimToCap(longSections,  FOUR_PAPERS_LONG_CAP),
      shortOverflow: totalShortQs > FOUR_PAPERS_SHORT_CAP,
      longOverflow:  totalLongQs  > FOUR_PAPERS_LONG_CAP,
    };
  }, [paperSections, currentLayout]);

  const mcqTotalMarks            = useMemo(() => mcqs.reduce((t, s) => t + s.totalMarks, 0), [mcqs]);
  const subTotalMarks            = useMemo(() => subjectives.reduce((t, s) => t + s.totalMarks, 0), [subjectives]);
  const fourPaperShortTotalMarks = useMemo(() => fourPaperShortSections.reduce((t, s) => t + s.totalMarks, 0), [fourPaperShortSections]);
  const fourPaperLongTotalMarks  = useMemo(() => fourPaperLongSections.reduce((t, s)  => t + s.totalMarks, 0), [fourPaperLongSections]);

  useEffect(() => {
    if (currentLayout !== 'four_papers') return;
    if (shortOverflow) toast.error(`4-papers layout allows max ${FOUR_PAPERS_SHORT_CAP} short-type questions — extra questions were hidden.`);
    if (longOverflow)  toast.error(`4-papers layout allows max ${FOUR_PAPERS_LONG_CAP} long-type questions — extra questions were hidden.`);
  }, [currentLayout, shortOverflow, longOverflow]);

  if (!settings) return <div className="p-5 text-center">Loading settings...</div>;

  const handleHeaderChange = (sectionId: string, field: 'en' | 'ur', value: string) => {
    const updated = paperSections.map(s =>
      s.id === sectionId
        ? { ...s, [field === 'en' ? 'customEnHeader' : 'customUrHeader']: value }
        : s
    );
    onSectionUpdate(updated);
  };

  const pageSize = getPageSize(settings.pageSize);

  // separate/same_page/same/combined each get their own full sheet, paginated
  // to fit via PaginatedPaperGroup's measurement pass — overflow:hidden would
  // only ever mask a bug there, so it's dropped for real (not kept as a
  // "safety net"). two/three/four-papers-per-page still pack fixed-height
  // mini-slots with no reflow, so they keep the clip.
  const isSinglePaperLayout = ['separate', 'same_page', 'same', 'combined'].includes(currentLayout);

  const sheetBaseStyle: React.CSSProperties = {
    width: `${pageSize.widthMm}mm`,
    // Fixed height + clipped overflow for EVERY layout, single-paper flow
    // sheets included. This used to be minHeight + overflow:visible for
    // single-paper layouts specifically, so a sheet whose measured content
    // came out a hair off could grow on screen to absorb the discrepancy —
    // but the print stylesheet caps paper-sheet--flow to a hard one-page
    // height with overflow:hidden (see the print <style> block below), so
    // that mismatch meant screen could show content that print would then
    // silently clip. Matching screen to print exactly here means what you
    // see while editing is what actually prints — including surfacing any
    // packing overflow immediately, on screen, instead of only discovering
    // it later in the PDF.
    height: `${pageSize.heightMm}mm`,
    padding: '4mm',
    backgroundColor: 'white', margin: '0 auto',
    position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    color: 'black', fontFamily: settings.fontFamily,
    boxSizing: 'border-box', border: 'none', outline: 'none', boxShadow: 'none',
  };

  // 4mm padding on each side of sheetBaseStyle -> usable content height.
  const sheetContentHeightMm = pageSize.heightMm - 8;

  // Divides the sheet's content height into `count` equal mini-slots for the
  // two/three/four-papers-per-page layouts, leaving room for the dashed
  // cut-lines between slots (~3mm each) plus a small safety margin — mirrors
  // the original hand-picked A4 constants (142mm/93mm/70mm) but scales with
  // whatever page size is actually selected instead of being hardcoded per size.
  const computeSlotHeight = (count: number) => {
    const gaps = count - 1;
    const usable = sheetContentHeightMm - gaps * 3 - 2;
    return `${Math.floor((usable / count) * 10) / 10}mm`;
  };

  // Single-paper layouts have a full sheet to themselves, so answer-writing
  // lines are only safe to add there — the 2/3/4-papers-per-page layouts use
  // the tight fixed-height slots above with no reflow, and adding lines there
  // would silently overflow/clip other content.
  const answerLinesAllowed = Boolean(settings.showAnswerLines) && isSinglePaperLayout;

  const SectionBlock = ({
    section, questionSlice, onQuestionRef, onSectionHeaderRef,
  }: {
    section: PaperSection;
    // Renders only questions[start, end) of this section (standard/non-composite
    // sections only — used by the separate/same_page paginator to split a
    // section's questions across pages). suppressHeader hides the section's
    // own "Q. No. X: ..." instruction line on continuation slices so it isn't
    // repeated on every page a section spills onto.
    questionSlice?: { start: number; end: number; suppressHeader?: boolean };
    // Measurement hooks used only by the separate/same_page paginator's hidden
    // measure pass — undefined on every other render path (real display,
    // two/three/four-papers layouts, PaperPreviewer, etc.), so they're inert
    // there. Reports back the actual rendered DOM node for each question / the
    // section's own header block, so page-break decisions are based on the
    // exact same markup that ends up on the page — not a separately-estimated
    // approximation. (Whole-section height, for atomic/composite sections, is
    // measured by the paginator wrapping renderSectionBlock's output in its
    // own div — no hook needed here for that case.)
    onQuestionRef?: (questionId: string, idx: number, el: HTMLDivElement | null) => void;
    onSectionHeaderRef?: (sectionId: string, el: HTMLDivElement | null) => void;
  }) => {
    if (!section) return null;

    const questions       = Array.isArray(section.questions) ? section.questions : [];
    const sectionType     = section.type.toLowerCase();
    const startNum        = globalNumbering[section.id] || 1;
    const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';

    const sectionIndexInArray = paperSections.findIndex(s => s.id === section.id);
    const prevSection = sectionIndexInArray > 0 ? paperSections[sectionIndexInArray - 1] : null;
    const nextSection = paperSections[sectionIndexInArray + 1];

    const isPoetry     = sectionType.includes('poetry_explanation');
    const isGazal      = sectionType.includes('gazal');
    const isCorrection = sectionType.includes('sentence_correction');
    const isCompletion = sectionType.includes('sentence_completion');

    const isSecondPartOfPair =
      (isGazal      && prevSection?.type.toLowerCase().includes('poetry')) ||
      (isCompletion && prevSection?.type.toLowerCase().includes('sentence_correction'));

    const isFirstPartOfPair =
      (isPoetry     && nextSection?.type.toLowerCase().includes('gazal')) ||
      (isCorrection && nextSection?.type.toLowerCase().includes('sentence_completion'));

    const nazamAttempt  = section.attemptCount || 0;
    const gazalAttempt  = nextSection?.attemptCount || 0;
    const combinedPoetryInstruction = `درج زیل نظم وغزل کے اشعار کی تشریح کیجئے۔ (حصہ نظم سے ${nazamAttempt} اور حصہ غزل سے ${gazalAttempt} اشعار منتخب کیجئے)`;

    const totalAttempt   = (section.attemptCount || 0) + (nextSection?.attemptCount || 0);
    const marksEach      = section.marksEach || 1;
    const totalMarksPair = totalAttempt * marksEach;
    const combinedCorrectCompleteInstruction = `درج ذیل میں سے کوئی سے ${totalAttempt} اجزاء کی درستگی/تکمیل کیجئے۔ (${marksEach}x${totalAttempt}=${totalMarksPair})`;

    let finalAttemptCount = section.attemptCount;
    let finalTotalMarks   = section.totalMarks;
    if (isFirstPartOfPair && nextSection) {
      finalAttemptCount = section.attemptCount + (nextSection.attemptCount || 0);
      finalTotalMarks   = section.totalMarks   + (nextSection.totalMarks   || 0);
    } else if (isSecondPartOfPair) {
      finalAttemptCount = 0;
      finalTotalMarks   = 0;
    }

    const subHeaderFontSize = settings.headingFontSize - 2;

    const getQuestionDisplayIndex = (localIdx: number) => {
      if (isSecondPartOfPair && prevSection) return (prevSection.questions?.length || 0) + localIdx;
      return localIdx;
    };

    const getDynamicColClass = (q: any) => {
      if (
        section.type === 'mcq' || section.type === 'long' || section.type === 'summary' || section.type === 'essay' ||
        (section.type === 'short' && subject.toLowerCase() !== 'urdu') ||
        sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma') ||
        // Poetry/gazal verses must always be full-width and consistently
        // sized — the length-based heuristic below (meant for MCQ option
        // widths) would otherwise give different verses different column
        // widths depending on their text length, breaking the couplet's
        // two-hemistich alignment from line to line.
        sectionType.includes('poetry_explanation') || sectionType.includes('gazal')
      ) return 'col-12';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6';
      // Sentence correction/completion always print 4-per-row, matching
      // regardless of which of the two sub-types a given item belongs to —
      // completion items run longer ("...جملے کو مکمل کریں: ... ------")
      // than correction ones, so the length heuristic below would otherwise
      // give them a narrower 2-per-row column, breaking the grid alignment
      // across a merged Q.No that mixes both sub-types.
      if (sectionType.includes('sentence_correction') || sectionType.includes('sentence_completion')) return 'col-3';
      const engText = q.question_text || q.question || '';
      const urText  = q.question_text_ur || '';
      const len = engText.length + urText.length * 1.5;
      return len < 50 ? 'col-3' : len < 60 ? 'col-4' : len < 120 ? 'col-6' : 'col-12';
    };
const isStanzaPunctuationPairWords  =  sectionType.includes('stanza_explanation') || sectionType.includes('punctuation')|| sectionType.includes('pair_of_words')
    // 'essay' is treated as long-form: a standalone essay question gets its own
    // "Q.N" number (like long/summary questions) instead of a separate "ESSAY"
    // section header plus a "(i)" sub-label on the question itself.
    const isLongType = sectionType.includes('long') || sectionType.includes('summary') ||

    sectionType.includes('darkhwast') || sectionType.includes('makalma') || sectionType.includes('essay');
    const isSingleAttemptLong = isLongType && section.totalQuestions <= 2 && section.attemptCount === 1;
    const isPairedLong = Boolean((section as any).isPairedLong);
    const isAlternativeGroup = Boolean((section as any).isAlternativeGroup);
    const subgroups: any[] | undefined = (section as any).subgroups;
    // >= 1, not > 1 — PaperBuilderApp now also sends a single-item subgroups
    // array for a standalone stanza/punctuation/pair_of_words rule that
    // carries a q_label, so its label still renders (see subgroups comment
    // there). Every other section type only ever gets subgroups when there
    // are 2+, so this widening is a no-op for them.
    const hasSubgroups = Array.isArray(subgroups) && subgroups.length >= 1;
    const suppressNumberingSection = Boolean((section as any).suppressNumbering);
    const singleItemMarksOnly      = Boolean((section as any).singleItemMarksOnly);
    const isSingleTranslateSection = (sectionType === 'translate_urdu' || sectionType === 'translate_english') && questions.length === 1;
    // Passage sections with only one passage don't need a "(i)" sub-label or
    // the "(1 x N = N)" marks breakdown — same treatment as single-item
    // translate sections above.
    const isSinglePassageSection = sectionType === 'passage' && questions.length === 1;
    // "Choose ANY ONE lesson to summarize" rules (Nasarkhulasa/markziKhyal):
    // each question IS just the lesson's short title, not full question text
    // — so instead of stacking each title in its own block with its own
    // answer-line set (renderQuestionsList's normal per-question layout),
    // they print inline as "(الف) Title1 (ب) Title2" on the SAME line as
    // the section's instruction, with one shared set of answer lines below.
    const isTitleChoiceSection =
      (sectionType.includes('nasarkhulasa') || sectionType.includes('markzikhyal')) &&
      !hasSubgroups && questions.length > 1;
    // These types have no entry in SectionHeader's defaultInstructions map
    // (see SectionHeader.tsx), so a standalone one-question section of any
    // of them falls through to the generic catch-all "مندرجہ ذیل سوال حل
    // کریں" — meaningless filler above a question that already says what
    // it wants (e.g. "بیماری کی درخواست لکھیں"). Deliberately NOT a blanket
    // "any single-question section" rule: types with a real, specific
    // default instruction (translate_urdu, passage, short, long, ...) keep
    // using it even when they only have one question.
    const SINGLE_QUESTION_NO_DEFAULT_TYPES = ['application', 'letter', 'story', 'mokalma', 'nasarkhulasa', 'markzikhyal'];
    // A section with exactly one question and no other special handling
    // (not MCQ, not poetry/gazal, not part of any pairing/alternative/
    // subgroup mechanism) doesn't need its own "(الف)" sub-label either —
    // the question's own text becomes the heading itself:
    // "Q.N [question text] [marks]" on one line.
    const isSingleQuestionSection =
      questions.length === 1 &&
      SINGLE_QUESTION_NO_DEFAULT_TYPES.some(t => sectionType.includes(t)) &&
      !isPoetry && !isGazal &&
      !hasSubgroups && !isPairedLong && !isAlternativeGroup && !isTitleChoiceSection &&
      !isFirstPartOfPair && !isSecondPartOfPair;
    const hideHeader = isPairedLong || isAlternativeGroup || isTitleChoiceSection || isSingleQuestionSection || (hasSubgroups&&isStanzaPunctuationPairWords)  ||
      (isUrduOrEnglish && isSingleAttemptLong && !isPoetry && !isGazal && !isCorrection && isCompletion);

    const sharedAttemptNote: string | null  = (section as any).sharedAttemptNote  || null;
    const sharedAttemptCount: number | null = (section as any).sharedAttemptCount ?? null;
    const sharedTotalPairs: number | null   = (section as any).sharedTotalPairs   ?? null;
    const alternativeMarks: number[] | null = (section as any).alternativeMarks   || null;
    const alternativeLabels: (string | null)[] | null = (section as any).alternativeLabels || null;

    const urduPairLabels: Record<string, string> = { a: 'الف', b: 'ب', c: 'ج', d: 'د', e: 'ه' };

    // ─────────────────────────────────────────────────────────────
    // renderAlternativeGroup
    // ─────────────────────────────────────────────────────────────
    const renderAlternativeGroup = () => {
      const isUrduLang      = paperLanguage === 'urdu';
      const isBilingualLang = paperLanguage === 'bilingual';

      const enLabelText = `Q.${startNum}`;
      const urLabelText = `Q.${startNum}`;
      const qNoFontPx = settings.headingFontSize + 2;
      const estimateLabelWidth = (text: string, fontPx: number) =>
        Math.ceil(text.length * fontPx * 0.62);
      const qNoColWidthEn = `${estimateLabelWidth(enLabelText, qNoFontPx) + 6}px`;
      const qNoColWidthUr = `${estimateLabelWidth(urLabelText, qNoFontPx) + 6}px`;

      const altMarksFs = Math.max(settings.fontSize, 11);
      const altQuestionFontSize   = settings.headingFontSize;
      const altQuestionFontSizeUr = settings.headingFontSize + 2;
      const altQuestionFontFamily = settings.headingFontFamily;
      // Both the "Q.N" label and the alternative's own sentence render bold,
      // so each OR-option reads as its own heading line (e.g. "Q.6 Write a
      // story with the moral...").
      const altQuestionFontWeight = 'bold';

      const OrDivider = () => (
        <div
          style={{
            width: '100%', textAlign: 'center', fontWeight: 600,
            fontSize: `${settings.fontSize}px`,
            fontFamily: isUrduLang ? URDU_FONT : settings.fontFamily,
            margin: '0px 0',
          }}
        >
          {isUrduLang ? 'یا' : 'OR'}
        </div>
      );

      // Urdu-only OR-alternatives print as ONE line — "Q.N [option A] یا
      // [option B] marks" — instead of each option in its own stacked block
      // separated by a centered "یا" divider. The whole row inherits
      // direction:'rtl' from the printable-paper ancestor (see
      // PaperBuilderApp's languageConfigs.urdu.direction), so it must NOT
      // also set flexDirection:'row-reverse' — that combination cancels
      // back out to an LTR-like layout, which was pushing "Q.N" to the left
      // edge instead of the right.
      const sharedAltMarks = section.marksEach ?? Math.max(
        ...questions.map((q, qIdx) => Number(alternativeMarks?.[qIdx] ?? q.marks ?? 0)),
      );

      return (
        <div className="alternative-group-block">
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {isUrduLang ? (
              <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                  <span className="fw-bold" dir="rtl" style={{
                    fontSize: `${qNoFontPx}px`, fontFamily: URDU_FONT, lineHeight: 1.3,
                    display: 'block', textAlign: 'right', direction: 'rtl', unicodeBidi: 'embed' as any,
                  }}>
                    {urLabelText}
                  </span>
                </div>
                <div
                  dir="rtl" lang="ur"
                  className="alt-question-inline"
                  style={{
                    flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right',
                    fontFamily: URDU_FONT,
                    fontSize: `${altQuestionFontSizeUr}px`,
                    fontWeight: altQuestionFontWeight,
                    lineHeight: settings.lineHeight, unicodeBidi: 'embed' as any,
                  }}
                >
                  {questions.map((q, qIdx) => (
                    <React.Fragment key={`${q.id}-${qIdx}`}>
                      {qIdx > 0 && <span style={{ fontWeight: 600, display: 'inline-block', paddingLeft: '10px', paddingRight: '10px' }}>یا</span>}
                      {isEditMode ? (
                        <EditableText
                          value={q.question_text_ur || q.question_text || ''}
                          onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                        />
                      ) : (
                        <RichText html={q.question_text_ur || q.question_text || ''} />
                      )}
                    </React.Fragment>
                  ))}
                  {'  '}
                  <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px`, direction: 'ltr', unicodeBidi: 'embed' as any }}>
                    {sharedAltMarks}
                  </span>
                </div>
              </div>
            ) : questions.map((q, qIdx) => {
              const qMarks = alternativeMarks?.[qIdx] ?? q.marks ?? section.marksEach;
              const qLabel = alternativeLabels?.[qIdx] || null;
              const isFirstRow = qIdx === 0;

              if (isBilingualLang) {
                return (
                  <React.Fragment key={`${q.id}-${qIdx}`}>
                    {qLabel && (
                      <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
                        <div style={{ flex: 1, paddingLeft: qNoColWidthEn, fontWeight: 700, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}>
                          {qLabel}
                        </div>
                        <div style={{ flex: 1, paddingRight: qNoColWidthUr, textAlign: 'right', direction: 'rtl', fontWeight: 700, fontSize: `${settings.fontSize + 2}px`, fontFamily: URDU_FONT }}>
                          {qLabel}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'flex-start' }}>
                      {/* LEFT — English */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
                          {isFirstRow && (
                            <span className="fw-bold" style={{
                              fontSize: `${qNoFontPx}px`, fontFamily: settings.headingFontFamily,
                              lineHeight: 1.3, display: 'block',
                            }}>
                              {enLabelText}
                            </span>
                          )}
                        </div>
                        {/* Marks render inline right after the question text
                            instead of in their own flex column, so they sit
                            close to the text rather than stretched to the
                            row's far edge. */}
                        <div className="alt-question-inline" style={{
                          flex: 1, minWidth: 0,
                          fontSize: `${altQuestionFontSize}px`,
                          fontFamily: altQuestionFontFamily,
                          fontWeight: altQuestionFontWeight,
                          lineHeight: settings.lineHeight,
                        }}>
                          {isEditMode ? (
                            <EditableText
                              value={q.question_text || q.question || ''}
                              onChange={(v: string) => onTextChange(section.id, q.id, 'question_text', v)}
                            />
                          ) : (
                            <RichText html={q.question_text || q.question || ''} />
                          )}
                          {'  '}
                          <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px` }}>
                            {qMarks}
                          </span>
                        </div>
                      </div>
                      {/* RIGHT — Urdu */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                          {isFirstRow && (
                            <span className="fw-bold" dir="rtl" style={{
                              fontSize: `${qNoFontPx}px`, fontFamily: URDU_FONT, lineHeight: 1.3,
                              display: 'block', textAlign: 'right', direction: 'rtl', unicodeBidi: 'embed' as any,
                            }}>
                              {urLabelText}
                            </span>
                          )}
                        </div>
                        <div
                          dir="rtl" lang="ur"
                          className="alt-question-inline"
                          style={{
                            flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right',
                            fontFamily: URDU_FONT,
                            fontSize: `${altQuestionFontSizeUr}px`,
                            fontWeight: altQuestionFontWeight,
                            lineHeight: settings.lineHeight, unicodeBidi: 'embed' as any,
                          }}
                        >
                          {isEditMode ? (
                            <EditableText
                              value={q.question_text_ur || ''}
                              onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                            />
                          ) : (
                            <RichText html={q.question_text_ur || ''} />
                          )}
                          {'  '}
                          <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px`, direction: 'ltr', unicodeBidi: 'embed' as any }}>
                            {qMarks}
                          </span>
                        </div>
                      </div>
                    </div>
                    {qIdx < questions.length - 1 && <OrDivider />}
                  </React.Fragment>
                );
              }

              // English-only branch
              return (
                <React.Fragment key={`${q.id}-${qIdx}`}>
                  {qLabel && (
                    <div style={{ width: '100%', paddingLeft: qNoColWidthEn, fontWeight: 700, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}>
                      {qLabel}
                    </div>
                  )}
                  <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
                      {isFirstRow && (
                        <span className="fw-bold" style={{
                          fontSize: `${qNoFontPx}px`, fontFamily: settings.headingFontFamily,
                          lineHeight: 1.3, display: 'block',
                        }}>
                          {enLabelText}
                        </span>
                      )}
                    </div>
                    {/* Marks render inline right after the question text (not in
                        its own flex column) so they sit close to the text —
                        "question text 5" — instead of stretched to the row's
                        far edge. */}
                    <div className="alt-question-inline" style={{
                      flex: 1, minWidth: 0,
                      fontSize: `${altQuestionFontSize}px`,
                      fontFamily: altQuestionFontFamily,
                      fontWeight: altQuestionFontWeight,
                      lineHeight: settings.lineHeight,
                    }}>
                      {isEditMode ? (
                        <EditableText
                          value={q.question_text || q.question || ''}
                          onChange={(v: string) => onTextChange(section.id, q.id, 'question_text', v)}
                        />
                      ) : (
                        <RichText html={q.question_text || q.question || ''} />
                      )}
                      {'  '}
                      <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px` }}>
                        {qMarks}
                      </span>
                    </div>
                  </div>
                  {qIdx < questions.length - 1 && <OrDivider />}
                </React.Fragment>
              );
            })}
          </div>
          {answerLinesAllowed && sectionType !== 'mcq' && (
            <div aria-hidden="true" style={{ marginTop: '2mm' }}>
              {Array.from({ length: isLongType ? (settings.answerLinesLong ?? 5) : (settings.answerLinesShort ?? 4) }).map((_, i) => (
                <div key={i} style={{ height: `${settings.answerLineGapMm ?? 6}mm`, borderBottom: '0.3mm solid #94a3b8' }} />
              ))}
            </div>
          )}
        </div>
      );
    };

    // ─────────────────────────────────────────────────────────────
    // renderTitleChoiceSection — "choose any ONE lesson to summarize"
    // (Nasarkhulasa/markziKhyal). Each question is just the lesson's short
    // title, not full question text, so instead of stacking each title in
    // its own block (renderQuestionsList's normal per-question layout),
    // they print inline — "(الف) Title1 (ب) Title2" — right after the
    // section's own instruction, on the SAME line, with one shared set of
    // answer lines below (not one set per title).
    // ─────────────────────────────────────────────────────────────
    const renderTitleChoiceSection = () => {
      const isUrduLang = paperLanguage === 'urdu';
      const urLabelText = `Q.${startNum}`;
      const enLabelText = `Q.${startNum}`;
      const qNoFontPx = settings.headingFontSize + 2;
      const estimateLabelWidth = (text: string, fontPx: number) =>
        Math.ceil(text.length * fontPx * 0.62);
      const qNoColWidthUr = `${estimateLabelWidth(urLabelText, qNoFontPx) + 6}px`;
      const qNoColWidthEn = `${estimateLabelWidth(enLabelText, qNoFontPx) + 6}px`;

      const abjadLetters = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ی'];
      const instructionUr = (section as any).customUrHeader || 'مندرجہ ذیل میں سے کسی ایک کا انتخاب کیجیے:';
      const instructionEn = (section as any).customEnHeader || 'Choose any one of the following:';
      const marksValue = section.marksEach;
      const answerLineCount = settings.answerLinesLong ?? 5;

      const AnswerLines = () => (
        answerLinesAllowed ? (
          <div aria-hidden="true" style={{ marginTop: '2mm' }}>
            {Array.from({ length: answerLineCount }).map((_, i) => (
              <div key={i} style={{ height: `${settings.answerLineGapMm ?? 6}mm`, borderBottom: '0.3mm solid #94a3b8' }} />
            ))}
          </div>
        ) : null
      );

      if (isUrduLang) {
        return (
          <div className="title-choice-block">
            <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                <span className="fw-bold" dir="rtl" style={{
                  fontSize: `${qNoFontPx}px`, fontFamily: URDU_FONT, lineHeight: 1.3,
                  display: 'block', textAlign: 'right', direction: 'rtl', unicodeBidi: 'embed' as any,
                }}>
                  {urLabelText}
                </span>
              </div>
              <div
                dir="rtl" lang="ur"
                className="alt-question-inline"
                style={{
                  flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right',
                  fontFamily: URDU_FONT, fontWeight: 600,
                  fontSize: `${settings.fontSize + 2}px`, lineHeight: settings.lineHeight,
                  unicodeBidi: 'embed' as any,
                }}
              >
                {instructionUr}
                <span style={{ display: 'inline-block', width: '10px' }} />
                {questions.map((q, qIdx) => (
                  <span key={q.id} style={{ fontWeight: 700, marginInlineStart: qIdx > 0 ? '18px' : 0 }}>
                    ({abjadLetters[qIdx] || qIdx + 1}){' '}
                    <RichText html={q.question_text_ur || q.question_text || ''} />
                  </span>
                ))}
                <span style={{ display: 'inline-block', width: '10px' }} />
                <span style={{ fontWeight: 700, direction: 'ltr', unicodeBidi: 'embed' as any, fontSize: `${settings.fontSize}px` }}>
                  {marksValue}
                </span>
              </div>
            </div>
            <AnswerLines />
          </div>
        );
      }

      // Bilingual / English-only fallback — same idea, LTR-safe.
      return (
        <div className="title-choice-block">
          <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
              <span className="fw-bold" style={{ fontSize: `${qNoFontPx}px`, fontFamily: settings.headingFontFamily, lineHeight: 1.3, display: 'block' }}>
                {enLabelText}
              </span>
            </div>
            <div className="alt-question-inline" style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily, lineHeight: settings.lineHeight }}>
              {instructionEn}
                <span style={{ display: 'inline-block', width: '10px' }} />
                {questions.map((q, qIdx) => (
                <span key={q.id} style={{ fontWeight: 700, marginInlineStart: qIdx > 0 ? '18px' : 0 }}>
                  ({String.fromCharCode(97 + qIdx)}){' '}
                  <RichText html={q.question_text || q.question_text_ur || ''} />
                </span>
              ))}
                <span style={{ display: 'inline-block', width: '10px' }} />
                <span style={{ fontWeight: 700 }}>{marksValue}</span>
            </div>
          </div>
          <AnswerLines />
        </div>
      );
    };

    // ─────────────────────────────────────────────────────────────
    // renderSingleQuestionSection — one question, no other questions to
    // distinguish it from, so no "(الف)" label and no generic type-based
    // instruction line; the question's own text IS the heading.
    // ─────────────────────────────────────────────────────────────
    const renderSingleQuestionSection = () => {
      const isUrduLang = paperLanguage === 'urdu';
      const q = questions[0];
      const urLabelText = `Q.${startNum}`;
      const enLabelText = `Q.${startNum}`;
      const qNoFontPx = settings.headingFontSize + 2;
      const estimateLabelWidth = (text: string, fontPx: number) =>
        Math.ceil(text.length * fontPx * 0.62);
      const qNoColWidthUr = `${estimateLabelWidth(urLabelText, qNoFontPx) + 6}px`;
      const qNoColWidthEn = `${estimateLabelWidth(enLabelText, qNoFontPx) + 6}px`;
      const marksValue = q.marks || section.marksEach;

      const AnswerLines = () => (
        answerLinesAllowed ? (
          <div aria-hidden="true" style={{ marginTop: '2mm' }}>
            {Array.from({ length: isLongType ? (settings.answerLinesLong ?? 5) : (settings.answerLinesShort ?? 4) }).map((_, i) => (
              <div key={i} style={{ height: `${settings.answerLineGapMm ?? 6}mm`, borderBottom: '0.3mm solid #94a3b8' }} />
            ))}
          </div>
        ) : null
      );

      if (isUrduLang) {
        return (
          <div className="single-question-block">
            <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                <span className="fw-bold" dir="rtl" style={{
                  fontSize: `${qNoFontPx}px`, fontFamily: URDU_FONT, lineHeight: 1.3,
                  display: 'block', textAlign: 'right', direction: 'rtl', unicodeBidi: 'embed' as any,
                }}>
                  {urLabelText}
                </span>
              </div>
              <div
                dir="rtl" lang="ur"
                className="alt-question-inline"
                style={{
                  flex: 1, minWidth: 0, direction: 'rtl', textAlign: 'right',
                  fontFamily: URDU_FONT, fontWeight: 600,
                  fontSize: `${settings.fontSize + 2}px`, lineHeight: settings.lineHeight,
                  unicodeBidi: 'embed' as any,
                }}
              >
                {isEditMode ? (
                  <EditableText
                    value={q.question_text_ur || q.question_text || ''}
                    onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                  />
                ) : (
                  <RichText html={q.question_text_ur || q.question_text || ''} />
                )}
                <span style={{ display: 'inline-block', width: '10px' }} />
                <span style={{ fontWeight: 700, direction: 'ltr', unicodeBidi: 'embed' as any, fontSize: `${settings.fontSize}px` }}>
                  {marksValue}
                </span>
              </div>
            </div>
            <AnswerLines />
          </div>
        );
      }

      // Bilingual / English-only fallback — same idea, LTR-safe.
      return (
        <div className="single-question-block">
          <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
              <span className="fw-bold" style={{ fontSize: `${qNoFontPx}px`, fontFamily: settings.headingFontFamily, lineHeight: 1.3, display: 'block' }}>
                {enLabelText}
              </span>
            </div>
            <div className="alt-question-inline" style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily, lineHeight: settings.lineHeight }}>
              {isEditMode ? (
                <EditableText
                  value={q.question_text || q.question_text_ur || ''}
                  onChange={(v: string) => onTextChange(section.id, q.id, 'question_text', v)}
                />
              ) : (
                <RichText html={q.question_text || q.question_text_ur || ''} />
              )}
              <span style={{ display: 'inline-block', width: '10px' }} />
              <span style={{ fontWeight: 700 }}>{marksValue}</span>
            </div>
          </div>
          <AnswerLines />
        </div>
      );
    };

    // ─────────────────────────────────────────────────────────────
    // renderPairedQuestions
    // ─────────────────────────────────────────────────────────────
const renderPairedQuestions = () => {
  const isUrduLang      = paperLanguage === 'urdu';
  const isBilingualLang = paperLanguage === 'bilingual';

  // ── Both notes — English AND Urdu ──
  const sharedNoteEn: string | null = (section as any).sharedAttemptNote    || null;
  const sharedNoteUr: string | null = (section as any).sharedAttemptNoteUr  || null;

  const enLabelText   = `Q.${startNum}`;
  const urLabelText   = `Q.${startNum}`;
  const qNoFontPx     = settings.headingFontSize + 2;

  const estimateLabelWidth = (text: string, fontPx: number) =>
    Math.ceil(text.length * fontPx * 0.62);

  const qNoColWidthEn = `${estimateLabelWidth(enLabelText, qNoFontPx) + 6}px`;
  const qNoColWidthUr = `${estimateLabelWidth(urLabelText, qNoFontPx) + 6}px`;

  const subLabelFs   = settings.fontSize;
  const subLabelFsUr = settings.fontSize + 2;
  const noteFontSize = Math.max(settings.fontSize + 1, 12);

  return (
    <div className="paired-long-block">

      {/* ══════════════════════════════════════════════════════════
          NOTE ROW  —  "Note: Attempt any 2 questions in detail…"
          Three branches: bilingual | urdu-only | english-only
         ══════════════════════════════════════════════════════════ */}
      {(sharedNoteEn || sharedNoteUr) && (() => {

        /* ── BILINGUAL: two columns, EN left / UR right ── */
        if (isBilingualLang) {
          return (
            <div style={{
              display: 'flex',
              width: '100%',
              gap: '12px',
              alignItems: 'flex-start',
              marginBottom: '2px',
              marginTop: '4px',
            }}>
              {/* LEFT — English note */}
              <div style={{
                flex: 1,
                fontWeight: 700,
                fontSize: `${noteFontSize}px`,
                fontFamily: settings.headingFontFamily,
                direction: 'ltr',
                textAlign: 'left',
                lineHeight: 1.4,
              }}>
                {sharedNoteEn}
              </div>

              {/* RIGHT — Urdu note */}
              <div
                dir="rtl"
                lang="ur"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  fontSize: `${noteFontSize + 2}px`,
                  fontFamily: URDU_FONT,
                  direction: 'rtl',
                  textAlign: 'right',
                  lineHeight: 1.4,
                  unicodeBidi: 'embed' as any,
                }}
              >
                {sharedNoteUr || sharedNoteEn}
              </div>
            </div>
          );
        }

        /* ── URDU-ONLY ── */
        if (isUrduLang) {
          return (
            <div
              dir="rtl"
              lang="ur"
              style={{
                fontWeight: 700,
                fontSize: `${noteFontSize + 2}px`,
                fontFamily: URDU_FONT,
                direction: 'rtl',
                textAlign: 'right',
                padding: '4px 2px',
                marginBottom: '10px',
                marginTop: '4px',
                lineHeight: 1.4,
                unicodeBidi: 'embed' as any,
              }}
            >
              {sharedNoteUr || sharedNoteEn}
            </div>
          );
        }

        /* ── ENGLISH-ONLY ── */
        return (
          <div style={{
            fontWeight: 700,
            fontSize: `${noteFontSize}px`,
            fontFamily: settings.headingFontFamily,
            direction: 'ltr',
            textAlign: 'left',
            padding: '4px 2px',
            marginBottom: '10px',
            marginTop: '4px',
            lineHeight: 1.4,
          }}>
            {sharedNoteEn}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════
          QUESTION ROWS  —  Q.5(a), Q.5(b), Q.6(a), Q.6(b)…
         ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
        {questions.map((q, qIdx) => {
          const rawLabel = (q as any).__pairLabel || (qIdx === 0 ? 'a' : 'b');
          const urLabel  = urduPairLabels[rawLabel] || rawLabel;
          const enLabel  = rawLabel;
          const qMarks   = q.marks || section.marksEach;

          /* ── BILINGUAL QUESTION ROW ── */
          if (isBilingualLang) {
            return (
              <div
                key={`${q.id}-${qIdx}`}
                style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'flex-start' }}
              >
                {/* LEFT — English side */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start' }}>
                  {/* Q.No column — only on first sub-part (a) */}
                  <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
                    {qIdx === 0 && (
                      <span
                        className="fw-bold"
                        style={{
                          fontSize: `${qNoFontPx}px`,
                          fontFamily: settings.headingFontFamily,
                          lineHeight: 1.3,
                          display: 'block',
                        }}
                      >
                        {enLabelText}
                      </span>
                    )}
                  </div>
                  {/* sub-label (a)/(b) + question text + marks */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    display: 'flex', alignItems: 'flex-start', gap: '4px',
                  }}>
                    <span
                      className="fw-bold"
                      style={{
                        fontSize: `${subLabelFs}px`,
                        fontFamily: settings.headingFontFamily,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      ({enLabel})
                    </span>
                    <div style={{
                      flex: 1, minWidth: 0,
                      fontSize: `${settings.fontSize}px`,
                      fontFamily: settings.fontFamily,
                      lineHeight: settings.lineHeight,
                    }}>
                      {isEditMode ? (
                        <EditableText
                          value={q.question_text || q.question || ''}
                          onChange={(v: string) => onTextChange(section.id, q.id, 'question_text', v)}
                        />
                      ) : (
                        <RichText html={q.question_text || q.question || ''} />
                      )}
                    </div>
                    <span
                      className="fw-bold text-nowrap"
                      style={{ fontSize: `${subLabelFs}px`, flexShrink: 0, fontFamily: settings.headingFontFamily }}
                    >
                      {qMarks}
                    </span>
                  </div>
                </div>

                {/* RIGHT — Urdu side */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                }}>
                  {/* Q.No column — only on first sub-part (a) */}
                  <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                    {qIdx === 0 && (
                      <span
                        className="fw-bold"
                        dir="rtl"
                        style={{
                          fontSize: `${qNoFontPx}px`,
                          fontFamily: URDU_FONT,
                          lineHeight: 1.3,
                          display: 'block',
                          textAlign: 'right',
                          direction: 'rtl',
                          unicodeBidi: 'embed' as any,
                        }}
                      >
                        {urLabelText}
                      </span>
                    )}
                  </div>
                  {/* sub-label (الف)/(ب) + Urdu question text + marks */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'flex-start',
                    gap: '4px',
                  }}>
                    <span
                      className="fw-bold"
                      dir="rtl"
                      lang="ur"
                      style={{
                        fontSize: `${subLabelFsUr}px`,
                        fontFamily: URDU_FONT,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        direction: 'rtl',
                        unicodeBidi: 'embed' as any,
                        display: 'inline-block',
                      }}
                    >
                      ({urLabel})
                    </span>
                    <div
                      dir="rtl"
                      lang="ur"
                      style={{
                        flex: 1, minWidth: 0,
                        direction: 'rtl',
                        textAlign: 'right',
                        fontFamily: URDU_FONT,
                        fontSize: `${settings.fontSize + 2}px`,
                        lineHeight: settings.lineHeight,
                        unicodeBidi: 'embed' as any,
                      }}
                    >
                      {isEditMode ? (
                        <EditableText
                          value={q.question_text_ur || ''}
                          onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                        />
                      ) : (
                        <RichText html={q.question_text_ur || ''} />
                      )}
                    </div>
                    <span
                      className="fw-bold text-nowrap"
                      style={{
                        fontSize: `${subLabelFs}px`,
                        flexShrink: 0,
                        direction: 'ltr',
                        unicodeBidi: 'embed' as any,
                        fontFamily: settings.headingFontFamily,
                      }}
                    >
                      {qMarks}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          /* ── URDU-ONLY QUESTION ROW ──
              No flexDirection:'row-reverse' here — this row inherits
              direction:'rtl' from the printable-paper ancestor for Urdu
              papers, and combining that with row-reverse cancels back out
              to an LTR-like layout (the "Q.No pushed to the left" bug). */
          if (isUrduLang) {
            return (
              <div
                key={`${q.id}-${qIdx}`}
                style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}
              >
                <div style={{ flexShrink: 0, width: qNoColWidthUr, textAlign: 'right' }}>
                  {qIdx === 0 && (
                    <span
                      className="fw-bold"
                      dir="rtl"
                      style={{
                        fontSize: `${qNoFontPx}px`,
                        fontFamily: URDU_FONT,
                        lineHeight: 1.3,
                        display: 'block',
                        textAlign: 'right',
                        direction: 'rtl',
                        unicodeBidi: 'embed' as any,
                      }}
                    >
                      {urLabelText}
                    </span>
                  )}
                </div>
                <div style={{
                  flex: 1, minWidth: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}>
                  <span
                    className="fw-bold"
                    dir="rtl"
                    lang="ur"
                    style={{
                      fontSize: `${subLabelFsUr}px`,
                      fontFamily: URDU_FONT,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      direction: 'rtl',
                      unicodeBidi: 'embed' as any,
                      display: 'inline-block',
                    }}
                  >
                    ({urLabel})
                  </span>
                  <div
                    dir="rtl"
                    lang="ur"
                    style={{
                      flex: 1, minWidth: 0,
                      direction: 'rtl',
                      textAlign: 'right',
                      fontFamily: URDU_FONT,
                      fontSize: `${settings.fontSize + 2}px`,
                      lineHeight: settings.lineHeight,
                      unicodeBidi: 'embed' as any,
                    }}
                  >
                    {isEditMode ? (
                      <EditableText
                        value={q.question_text_ur || q.question_text || ''}
                        onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                      />
                    ) : (
                      <RichText html={q.question_text_ur || q.question_text || ''} />
                    )}
                  </div>
                  <span
                    className="fw-bold text-nowrap"
                    style={{
                      fontSize: `${subLabelFs}px`,
                      flexShrink: 0,
                      direction: 'ltr',
                      unicodeBidi: 'embed' as any,
                      fontFamily: settings.headingFontFamily,
                    }}
                  >
                    {qMarks}
                  </span>
                </div>
              </div>
            );
          }

          /* ── ENGLISH-ONLY QUESTION ROW ── */
          return (
            <div
              key={`${q.id}-${qIdx}`}
              style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}
            >
              <div style={{ flexShrink: 0, width: qNoColWidthEn }}>
                {qIdx === 0 && (
                  <span
                    className="fw-bold"
                    style={{
                      fontSize: `${qNoFontPx}px`,
                      fontFamily: settings.headingFontFamily,
                      lineHeight: 1.3,
                      display: 'block',
                    }}
                  >
                    {enLabelText}
                  </span>
                )}
              </div>
              <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', alignItems: 'flex-start', gap: '4px',
              }}>
                <span
                  className="fw-bold"
                  style={{
                    fontSize: `${subLabelFs}px`,
                    fontFamily: settings.headingFontFamily,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  ({enLabel})
                </span>
                <div style={{
                  flex: 1, minWidth: 0,
                  fontSize: `${settings.fontSize}px`,
                  fontFamily: settings.fontFamily,
                  lineHeight: settings.lineHeight,
                }}>
                  {isEditMode ? (
                    <EditableText
                      value={q.question_text || q.question || ''}
                      onChange={(v: string) => onTextChange(section.id, q.id, 'question_text', v)}
                    />
                  ) : (
                    <RichText html={q.question_text || q.question || ''} />
                  )}
                </div>
                <span
                  className="fw-bold text-nowrap"
                  style={{ fontSize: `${subLabelFs}px`, flexShrink: 0, fontFamily: settings.headingFontFamily }}
                >
                  {qMarks}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {answerLinesAllowed && sectionType !== 'mcq' && (
        <div aria-hidden="true" style={{ marginTop: '2mm' }}>
          {Array.from({ length: settings.answerLinesLong ?? 5 }).map((_, i) => (
            <div key={i} style={{ height: `${settings.answerLineGapMm ?? 6}mm`, borderBottom: '0.3mm solid #94a3b8' }} />
          ))}
        </div>
      )}
    </div>
  );
};
   // const subgroups: any[] | undefined = (section as any).subgroups;
    //const hasSubgroups = Array.isArray(subgroups) && subgroups.length > 1;

    // MCQ Table/Bordered layout renders the whole list as a real HTML
    // <table> — one <tr> per question, Q.No in its own <td>, question+options
    // in the other — instead of the normal flex/grid bucketing by option
    // length. A genuine table (not a CSS display:table div) is what
    // reliably keeps its grid lines through print/PDF export.
    const isMcqBoxedSection    = sectionType === 'mcq' && !!settings.mcqLayoutStyle && settings.mcqLayoutStyle !== 'simple';
    const isMcqBorderedSection = sectionType === 'mcq' && settings.mcqLayoutStyle === 'bordered';
    const mcqCellBorder        = isMcqBorderedSection ? '2px solid #000' : 'none';

    // Plain Q.No label for the dedicated number column — mirrors
    // QuestionRenderer's own MCQ number rendering, which is bypassed here
    // via suppressNumbering since the number now lives in its own <td>.
    // For Urdu papers the dot goes BEFORE the digit (".2" not "2.") — the
    // number cell itself stays on the row's right edge (RTL position), only
    // the dot's placement relative to the digit flips.
    const renderMcqNumberCell = (displayIndex: number) => {
      const n = displayIndex + 1;
      const label = paperLanguage === 'urdu' ? `.${n}` : `${n}.`;
      const numFontSize = settings.mcqFontSize ?? 12;
      return paperLanguage === 'urdu' ? (
        <span style={{ fontSize: `${numFontSize}px`, fontFamily: URDU_FONT, direction: 'ltr', unicodeBidi: 'embed' as any }}>
          {label}
        </span>
      ) : (
        <span style={{ fontSize: `${numFontSize}px`, fontFamily: settings.fontFamily }}>
          {label}
        </span>
      );
    };

    const renderQuestionsList = (qs: any[], baseOffset: number, suppressNum = false) => {
      if (isMcqBoxedSection) {
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: '2px' }}>
            <colgroup>
              <col style={{ width: '32px' }} />
              <col />
            </colgroup>
            <tbody>
              {qs.map((q, qIdx) => {
                const finalIndex = getQuestionDisplayIndex(baseOffset + qIdx);
                return (
                  <tr
                    key={`${q.id}-${baseOffset}-${qIdx}`}
                    ref={el => onQuestionRef?.(q.id, baseOffset + qIdx, el as unknown as HTMLDivElement)}
                  >
                    <td style={{ border: mcqCellBorder, width: '32px', verticalAlign: 'top', padding: '3px 6px' }}>
                      {renderMcqNumberCell(finalIndex)}
                    </td>
                    <td style={{ border: mcqCellBorder, verticalAlign: 'top', padding: '3px 6px' }}>
                      <QuestionRenderer
                        question={q}
                        index={finalIndex}
                        qIdx={baseOffset + qIdx}
                        sectionType={section.type}
                        sectionId={section.id}
                        paperLanguage={paperLanguage}
                        isEditMode={isEditMode}
                        config={config}
                        fontSize={settings.fontSize}
                        metaFontSize={settings.metaFontSize}
                        questionFontFamily={settings.fontFamily}
                        questionLineSpacing={settings.lineHeight}
                        mcqFontSize={settings.mcqFontSize ?? 12}
                        mcqLineHeight={settings.mcqLineHeight ?? 1.2}
                        onTextChange={onTextChange}
                        marks={q.marks || section.marksEach}
                        isUrduSubject={isUrduOrEnglish}
                        isLast={baseOffset + qIdx === questions.length - 1}
                        headingFontSize={settings.headingFontSize}
                        suppressNumbering={true}
                        renderInlineBilingual={renderInlineBilingual}
                        showAnswerLines={false}
                        answerLinesShort={settings.answerLinesShort}
                        answerLinesLong={settings.answerLinesLong}
                        answerLineGapMm={settings.answerLineGapMm}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      }

      return (
        <div
          className="questions-list row g-2 mx-0"
          style={{ direction: sectionType === 'translate_english' ? 'rtl' : '' as any }}
        >
          {qs.map((q, qIdx) => {
            const finalIndex = isLongType
              ? (paperLanguage === 'urdu' ? startNum : startNum + baseOffset + qIdx)
              : getQuestionDisplayIndex(baseOffset + qIdx);
            return (
              <div
                key={`${q.id}-${baseOffset}-${qIdx}`}
                ref={el => onQuestionRef?.(q.id, baseOffset + qIdx, el)}
                // isLongType rows print their own "Q.N" label inline (via
                // QuestionRenderer) instead of through SectionHeader, which
                // uses zero horizontal padding — ps-0 here keeps that "Q.N"
                // flush with SectionHeader's, instead of sitting 8px further
                // right than every other section's own Q.N.
                className={`${getDynamicColClass(q)} ${isLongType ? 'ps-0 pe-2' : 'px-2'} mt-1`}
              >
                <QuestionRenderer
                  question={q}
                  index={finalIndex}
                  qIdx={baseOffset + qIdx}
                  sectionType={section.type}
                  sectionId={section.id}
                  paperLanguage={paperLanguage}
                  isEditMode={isEditMode}
                  config={config}
                  fontSize={settings.fontSize}
                  metaFontSize={settings.metaFontSize}
                  questionFontFamily={settings.fontFamily}
                  questionLineSpacing={settings.lineHeight}
                  mcqFontSize={settings.mcqFontSize ?? 12}
                  mcqLineHeight={settings.mcqLineHeight ?? 1.2}
                  onTextChange={onTextChange}
                  marks={q.marks || section.marksEach}
                  isUrduSubject={isUrduOrEnglish}
                  isLast={baseOffset + qIdx === questions.length - 1}
                  headingFontSize={settings.headingFontSize}
                  suppressNumbering={suppressNum}
                  // Urdu sub-item numbering: roman (i)/(ii) for an actual
                  // enumerated list, but abjad (الف)/(ب) for the narrower
                  // "pick ONE of exactly two alternatives" shape — matching
                  // how (الف)/(ب) already reads as a binary either/or in
                  // Urdu exam convention. isFirstPartOfPair/isSecondPartOfPair
                  // (adjacent poetry+gazal or correction+completion sections,
                  // manually added back-to-back) are always a merged list,
                  // never a binary choice, so they always get roman too.
                  hasSubGroups={isFirstPartOfPair || isSecondPartOfPair || questions.length !== 2}
                  shouldShowOr={
                    isLongType && isUrduOrEnglish &&
                    section.totalQuestions === 2 && section.attemptCount === 1
                  }
                  renderInlineBilingual={renderInlineBilingual}
                  showAnswerLines={answerLinesAllowed && sectionType !== 'mcq'}
                  answerLinesShort={settings.answerLinesShort}
                  answerLinesLong={settings.answerLinesLong}
                  answerLineGapMm={settings.answerLineGapMm}
                />
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div
        className="section-block"
        style={{
          border:        isEditMode ? '2px dashed #fcd34d' : 'none',
          marginTop:     isSecondPartOfPair ? '5px' : '5px',
          marginBottom:  '0px',
          width:         '100%',
          position:      'relative',
        }}
      >
        {isEditMode && (onEditSection || onDeleteSection) && (
          <div
            className="section-edit-controls d-print-none"
            style={{
              position: 'absolute', top: '2px', left: '2px', zIndex: 5,
              display: 'flex', gap: '4px',
            }}
          >
            {onEditSection && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditSection(section); }}
                title="Edit questions in this section"
                style={{
                  width: '26px', height: '26px', borderRadius: '6px',
                  border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Pencil size={13} />
              </button>
            )}
            {onDeleteSection && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSection(section.id); }}
                title="Delete this section"
                style={{
                  width: '26px', height: '26px', borderRadius: '6px',
                  border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        {isFirstPartOfPair && !questionSlice?.suppressHeader && (
          <div ref={el => onSectionHeaderRef?.(section.id, el)}>
            <SectionHeader
              sectionId={section.id}
              sectionIndex={startNum - 1}
              sectionType="custom"
              totalQuestions={section.totalQuestions}
              attemptCount={finalAttemptCount}
              totalMarks={finalTotalMarks}
              headingFontSize={settings.headingFontSize}
              headingFontFamily={settings.headingFontFamily}
              paperLanguage={paperLanguage}
              customUrHeader={isPoetry ? combinedPoetryInstruction : combinedCorrectCompleteInstruction}
              customEnHeader={(section as any).customEnHeader}
              onHeaderChange={handleHeaderChange}
              singleItemMarksOnly={singleItemMarksOnly}
              isEditMode={isEditMode}
            />
          </div>
        )}

        {!hideHeader && !isPairedLong && !questionSlice?.suppressHeader && (
          <div
            ref={el => onSectionHeaderRef?.(section.id, el)}
            className="sub-section-title px-0"
            style={{
              textAlign: 'right', direction: 'rtl', fontWeight: 'bold',
              fontSize: `${subHeaderFontSize}px`, fontFamily: "'JameelNoori', serif",
              marginTop: '0px', marginBottom: '4px',
            }}
          >
            {/* hasSubgroups means this section merges more than one rule
                (e.g. poetry_explanation + gazal under one Q.No) — isPoetry/
                isGazal only reflect the section's single lead type, so this
                auto-label would show "حصہ نظم" even when Gazal questions
                are ALSO in this section. Each subgroup below prints its own
                correct label per its own type instead. */}
            {!hasSubgroups && (isPoetry ? 'حصہ نظم:' : isGazal ? 'حصہ غزل:' : '')}

            {!isPoetry && !isGazal && !isFirstPartOfPair && !isSecondPartOfPair &&
             (!isLongType || !isUrduOrEnglish) && (
              <SectionHeader
                sectionId={section.id}
                sectionIndex={isSecondPartOfPair ? -1 : startNum - 1}
                sectionType={section.type}
                totalQuestions={section.totalQuestions}
                attemptCount={finalAttemptCount}
                totalMarks={finalTotalMarks}
                headingFontSize={settings.headingFontSize}
                headingFontFamily={settings.headingFontFamily}
                paperLanguage={paperLanguage}
                customEnHeader={(section as any).customEnHeader}
                customUrHeader={(section as any).customUrHeader}
                onHeaderChange={handleHeaderChange}
                isEditMode={isEditMode}
                singleItemMarksOnly={singleItemMarksOnly || isSingleTranslateSection || isSinglePassageSection}
              />
            )}
          </div>
        )}

        {isPairedLong ? (
          renderPairedQuestions()
        ) : isAlternativeGroup ? (
          renderAlternativeGroup()
        ) : isTitleChoiceSection ? (
          renderTitleChoiceSection()
        ) : isSingleQuestionSection ? (
          renderSingleQuestionSection()
        ) : hasSubgroups ? (
  (() => {
    let offset = 0;
    const totalSubgroupMarks = subgroups!.reduce((sum, sg) => sum + (sg.attemptCount || 0) * (sg.marksEach || 0), 0);

    // MCQ Table/Bordered layout merges ALL subgroups into ONE continuous
    // table — a subgroup only gets its own heading row (not a separate
    // table) when it actually carries a label from the backend (e.g. "Choose
    // the correct form of Verb."). Label-less rule-based subgroups (the
    // common case for board-pattern MCQs with no category grouping, e.g.
    // Physics) just flow straight into the same table with no visual break.
    if (isMcqBoxedSection) {
      const isBilingualMcq = paperLanguage === 'bilingual';
      const isUrduLangMcq  = paperLanguage === 'urdu';
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: '2px' }}>
          <colgroup>
            <col style={{ width: '32px' }} />
            <col />
          </colgroup>
          <tbody>
            {subgroups!.map((sg, sgIdx) => {
              const sgQuestions = Array.isArray(sg.questions) ? sg.questions : [];
              const thisOffset  = offset;
              offset += sgQuestions.length;
              if (sgQuestions.length === 0) return null;

              // Slice awareness — mirrors the non-MCQ-boxed subgroups branch
              // above: a page's slice can land partway through the merged
              // list now that MCQ sections with multiple subgroups are no
              // longer forced fully atomic. Skip a subgroup entirely outside
              // this slice, and don't repeat its label row if it already
              // appeared on an earlier page.
              const sgEndGlobal = thisOffset + sgQuestions.length;
              if (questionSlice && (sgEndGlobal <= questionSlice.start || thisOffset >= questionSlice.end)) {
                return null;
              }
              const sgLabelAlreadyShown = Boolean(questionSlice) && thisOffset < questionSlice!.start;

              const labelText = sg.qLabel || sg.categoryLabel || '';
              const urLabel   = sg.qLabelUr || sg.categoryLabelUr || '';

              return (
                <React.Fragment key={`subgroup-${section.id}-${sgIdx}`}>
                  {labelText && !sgLabelAlreadyShown && (
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          padding: '4px 6px',
                          fontWeight: 700,
                          fontSize: `${settings.fontSize}px`,
                          fontFamily: isUrduLangMcq ? URDU_FONT : settings.fontFamily,
                          textAlign: isUrduLangMcq ? 'right' : 'left',
                          direction: isUrduLangMcq ? 'rtl' : 'ltr',
                          borderBottom: mcqCellBorder,
                        }}
                      >
                        {isBilingualMcq ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                            <span>{labelText}</span>
                            <span dir="rtl" lang="ur" style={{ fontFamily: URDU_FONT, fontSize: `${settings.fontSize + 2}px` }}>
                              {urLabel || labelText}
                            </span>
                          </div>
                        ) : isUrduLangMcq ? (urLabel || labelText) : labelText}
                      </td>
                    </tr>
                  )}
                  {sgQuestions.map((q: any, qIdx: number) => {
                    const globalIdx = thisOffset + qIdx;
                    if (questionSlice && (globalIdx < questionSlice.start || globalIdx >= questionSlice.end)) {
                      return null;
                    }
                    const finalIndex = getQuestionDisplayIndex(globalIdx);
                    return (
                      <tr key={`${q.id}-${thisOffset}-${qIdx}`} ref={el => onQuestionRef?.(q.id, globalIdx, el as unknown as HTMLDivElement)}>
                        <td style={{ border: mcqCellBorder, width: '32px', verticalAlign: 'top', padding: '3px 6px' }}>
                          {renderMcqNumberCell(finalIndex)}
                        </td>
                        <td style={{ border: mcqCellBorder, verticalAlign: 'top', padding: '3px 6px' }}>
                          <QuestionRenderer
                            question={q}
                            index={finalIndex}
                            qIdx={thisOffset + qIdx}
                            sectionType={section.type}
                            sectionId={section.id}
                            paperLanguage={paperLanguage}
                            isEditMode={isEditMode}
                            config={config}
                            fontSize={settings.fontSize}
                            metaFontSize={settings.metaFontSize}
                            questionFontFamily={settings.fontFamily}
                            questionLineSpacing={settings.lineHeight}
                            mcqFontSize={settings.mcqFontSize ?? 12}
                            mcqLineHeight={settings.mcqLineHeight ?? 1.2}
                            onTextChange={onTextChange}
                            marks={q.marks || section.marksEach}
                            isUrduSubject={isUrduOrEnglish}
                            isLast={thisOffset + qIdx === questions.length - 1}
                            headingFontSize={settings.headingFontSize}
                            suppressNumbering={true}
                            renderInlineBilingual={renderInlineBilingual}
                            showAnswerLines={false}
                            answerLinesShort={settings.answerLinesShort}
                            answerLinesLong={settings.answerLinesLong}
                            answerLineGapMm={settings.answerLineGapMm}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      );
    }

    // A merged poetry_explanation + gazal Q.No gets ONE combined instruction
    // line (with the total marks for both parts together) instead of each
    // subgroup showing its own partial marks (e.g. 6 + 4 instead of one 10) —
    // matches how this exact scenario already renders correctly elsewhere
    // in this file for the separate-adjacent-sections case (see
    // combinedPoetryInstruction above), just adapted to pull attempt counts
    // from `subgroups` instead of `nextSection`.
    const nazamSg = subgroups!.find(sg => (sg.questionType || '').toLowerCase().includes('poetry_explanation'));
    const gazalSg = subgroups!.find(sg => (sg.questionType || '').toLowerCase().includes('gazal'));
    const hasNazamGazalPair = Boolean(nazamSg && gazalSg);
    const combinedNazamGazalInstruction = hasNazamGazalPair
      ? `درج ذیل نظم و غزل کے اشعار کی تشریح کیجیے۔ (حصہ نظم سے ${nazamSg!.attemptCount || 0} اور حصہ غزل سے ${gazalSg!.attemptCount || 0} اشعار منتخب کیجیے)`
      : '';
    const isUrduPaper = paperLanguage === 'urdu';

    return (
      <>
      {hasNazamGazalPair && section.type !== 'mcq' && (
        <div style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: '6px', marginBottom: '4px', direction: isUrduPaper ? 'rtl' : 'ltr' }}>
          <span style={{
            fontWeight: 700, flexShrink: 0, direction: 'ltr',
            fontFamily: isUrduPaper ? URDU_FONT : settings.headingFontFamily,
            fontSize: `${settings.headingFontSize + (isUrduPaper ? 2 : 0)}px`,
          }}>
            Q.{startNum}
          </span>
          {/* Marks render inline right after the instruction text (not in
              their own flex:1-pushed column) so they sit close to the text
              instead of stretched to the row's far edge. */}
          <span dir={isUrduPaper ? 'rtl' : 'ltr'} lang={isUrduPaper ? 'ur' : undefined} style={{
            fontWeight: 600,
            fontFamily: isUrduPaper ? URDU_FONT : settings.fontFamily,
            fontSize: `${settings.fontSize + (isUrduPaper ? 2 : 0)}px`,
          }}>
            {combinedNazamGazalInstruction}
            {'  '}
            <span style={{ fontWeight: 700, direction: 'ltr', unicodeBidi: 'embed' as any, fontSize: `${settings.fontSize}px` }}>
              {totalSubgroupMarks}
            </span>
          </span>
        </div>
      )}
      {subgroups!.map((sg, sgIdx) => {
      const sgQuestions = Array.isArray(sg.questions) ? sg.questions : [];
      const thisOffset  = offset;
      offset += sgQuestions.length;
      if (sgQuestions.length === 0) return null;

      // Slice awareness — this section is no longer forced atomic when it
      // has multiple subgroups (see isAtomicSection), so a page's slice can
      // land partway through the merged list. Skip a subgroup entirely if
      // none of its questions fall in this slice, and if a slice picks up
      // partway through an ALREADY-STARTED subgroup (its first question was
      // on an earlier page), that subgroup's label must not repeat here —
      // it was already shown once, on the page where this subgroup began.
      const sgEndGlobal = thisOffset + sgQuestions.length;
      if (questionSlice && (sgEndGlobal <= questionSlice.start || thisOffset >= questionSlice.end)) {
        return null;
      }
      const sgLabelAlreadyShown = Boolean(questionSlice) && thisOffset < questionSlice!.start;

      /*const labelText = sg.qLabel || sg.categoryLabel || '';
      const sgMarks   = sg.marksEach != null ? sg.marksEach : 0;
      const sgAttempt = sg.attemptCount != null ? sg.attemptCount : sgQuestions.length;
      */
     // Each subgroup falls back to its OWN type's built-in convention
     // (e.g. poetry_explanation/gazal's "حصہ نظم"/"حصہ غزل") rather than
     // the section's single isPoetry/isGazal, which only reflects the lead
     // block's type and can't represent a merged poetry+gazal Q.No.
     const sgTypeLower = (sg.questionType || '').toLowerCase();
     const sgIsPoetry  = sgTypeLower.includes('poetry_explanation');
     const sgIsGazal   = sgTypeLower.includes('gazal');
     const sgAutoEn    = sgIsPoetry ? 'Poetry' : sgIsGazal ? 'Gazal' : '';
     const sgAutoUr    = sgIsPoetry ? 'حصہ نظم:' : sgIsGazal ? 'حصہ غزل:' : '';
     // For poetry_explanation/gazal, the auto-convention ALWAYS wins over
     // qLabel/categoryLabel — those rules' q_label(_ur) fields hold the
     // combined "Q.2 ..." instruction sentence (shown once above, outside
     // this loop), not a per-subgroup label. Using them here duplicated
     // that whole sentence under each subgroup instead of the short
     // "حصہ نظم"/"حصہ غزل" heading.
     const isPoetryOrGazalSg = sgIsPoetry || sgIsGazal;
     const labelText = isPoetryOrGazalSg ? sgAutoEn : (sg.qLabel || sg.categoryLabel || sgAutoEn);
const sgMarksEach = sg.marksEach != null ? sg.marksEach : 0;
const sgAttempt   = sg.attemptCount != null ? sg.attemptCount : sgQuestions.length;
// For pair_of_words (and any type where attempt < total questions),
// show total marks = attemptCount × marksEach, not per-question marks.
const sgMarks = sgAttempt > 1 ? sgAttempt * sgMarksEach : sgMarksEach;
      // Check if the current section is NOT an MCQ
      const isNotMCQ = section.type !== 'mcq';

      // Below, "Q.{startNum}" and the per-subgroup marks number are only
      // shown when hideHeader is true — i.e. when nothing OUTSIDE this loop
      // is already showing them. hideHeader is true for stanza_explanation/
      // punctuation/pair_of_words groups (their subgroups ARE the only
      // place Q.No+marks appear), but false whenever an outer header also
      // renders one (the standard SectionHeader for e.g. a merged "short"
      // group like نثر/نظم/غزل sub-parts, or the custom combined
      // Nazam+Gazal header above) — showing it again per subgroup there
      // just duplicated "Q.N" and repeated marks that were already totalled
      // once outside the loop.
            // Inside the subgroup mapping, after the label div
const isRtl = paperLanguage === 'urdu';
const paddingSide = isRtl ? 'paddingRight' : 'paddingLeft';
const indent = labelText && (isStanzaPunctuationPairWords || isPoetryOrGazalSg) ? '35px' : '0';   // only indent if there is a labe
          
      return (
        <div key={`subgroup-${section.id}-${sgIdx}`} className="subgroup-block" style={{ marginTop: sgIdx > 0 ? '6px' : '0px' }}>
          {/* ── Subgroup label row ── */}
         {labelText && !sgLabelAlreadyShown && (
  (() => {
    const isBilingual = paperLanguage === 'bilingual';
    const isUrduLang  = paperLanguage === 'urdu';
    // Urdu label: for poetry/gazal the auto-convention always wins (see
    // labelText above for why) — otherwise prefer qLabelUr, then
    // categoryLabelUr, then the auto-convention as a last-resort fallback.
    const urLabel = isPoetryOrGazalSg ? sgAutoUr : (sg.qLabelUr || sg.categoryLabelUr || sgAutoUr);
    const enLabel = isPoetryOrGazalSg ? sgAutoEn : (sg.qLabel || sg.categoryLabel || sgAutoEn);

    if (isBilingual) {
      return (
        <div style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'flex-start', marginBottom: '3px' }}>
          {/* LEFT — English */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {sgIdx === 0 && isNotMCQ && hideHeader && (
              <span style={{ fontWeight: 700, fontFamily: settings.headingFontFamily, fontSize: `${settings.headingFontSize}px`, flexShrink: 0 }}>
                Q.{startNum}
              </span>
            )}
            {sgIdx > 0 && isNotMCQ && hideHeader && (
              <span style={{ display: 'inline-block', width: `${(String(startNum).length + 2) * (settings.headingFontSize * 0.6)}px` }} />
            )}
            <span style={{ fontWeight: 600, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}>
              {enLabel}
            </span>
            {sgMarks > 0 && isNotMCQ && hideHeader && (
              <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: 'auto', fontSize: `${settings.fontSize}px` }}>
                {sgMarks}
              </span>
            )}
          </div>
          {/* RIGHT — Urdu. flexDirection:'row-reverse' combined with
              direction:'rtl' cancels out (double reversal) — that's what
              was pushing "Q.2" to the left edge instead of the right.
              direction:'rtl' alone already puts the DOM-first child (Q.2)
              on the right, which is what we want. */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px', direction: 'rtl' }}>
            {sgIdx === 0 && isNotMCQ && hideHeader && (
              <span style={{ fontWeight: 700, fontFamily: URDU_FONT, fontSize: `${settings.headingFontSize + 2}px`, flexShrink: 0, direction: 'ltr' }}>
                Q.{startNum}
              </span>
            )}
            {urLabel ? (
              <span dir="rtl" lang="ur" style={{ fontWeight: 600, fontSize: `${settings.fontSize + 2}px`, fontFamily: URDU_FONT }}>
                {urLabel}
              </span>
            ) : (
              <span dir="rtl" lang="ur" style={{ fontWeight: 600, fontSize: `${settings.fontSize + 2}px`, fontFamily: URDU_FONT }}>
                {enLabel /* fallback: show EN label on Urdu side if no Urdu translation */ }
              </span>
            )}
            {sgMarks > 0 && isNotMCQ && hideHeader && (
              <span style={{ fontWeight: 700, flexShrink: 0, marginRight: 'auto', fontSize: `${settings.fontSize}px`, direction: 'ltr' }}>
                {sgMarks}
              </span>
            )}
          </div>
        </div>
      );
    }

    // Urdu-only. Same double-reversal fix as the bilingual Urdu column
    // above: direction:'rtl' alone already puts the DOM-first child (Q.2)
    // on the right; flexDirection:'row-reverse' on top of that cancelled
    // it back out, which is what put "Q.2" on the left.
    if (isUrduLang) {
      return (
        <div style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: '6px', marginBottom: '3px', direction: 'rtl' }}>
          {sgIdx === 0 && isNotMCQ && hideHeader && (
            <span style={{ fontWeight: 700, fontFamily: URDU_FONT, fontSize: `${settings.headingFontSize + 2}px`, flexShrink: 0, direction: 'ltr' }}>
              Q.{startNum}
            </span>
          )}
          <span dir="rtl" lang="ur" style={{ fontWeight: 600, fontSize: `${settings.fontSize + 2}px`, fontFamily: URDU_FONT, flex: 1 }}>
            {urLabel || enLabel}
          </span>
          {sgMarks > 0 && isNotMCQ && hideHeader && (
            <span style={{ fontWeight: 700, flexShrink: 0, marginRight: 'auto', fontSize: `${settings.fontSize}px`, direction: 'ltr' }}>
              {sgMarks}
            </span>
          )}
        </div>
      );
    }

    // English-only (existing behaviour, just cleaned up)
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontWeight: 600, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily, marginBottom: '3px' }}>
        <span>
          {sgIdx === 0 && isNotMCQ && hideHeader && (
            <span style={{ fontWeight: 700, fontFamily: settings.headingFontFamily, fontSize: `${settings.headingFontSize}px`, marginRight: '6px' }}>
              Q.{startNum}
            </span>
          )}
          {sgIdx > 0 && isNotMCQ && hideHeader && (
            <span style={{ display: 'inline-block', width: `${(String(startNum).length + 2) * (settings.headingFontSize * 0.6)}px` }} />
          )}
          {enLabel}
        </span>
        {sgMarks > 0 && isNotMCQ && hideHeader && (
          <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: '8px', fontSize: `${settings.fontSize}px` }}>
            {sgMarks}
          </span>
        )}
      </div>
    );
  })()
)}

          {/* ── Questions List ──
              (MCQ Table/Bordered sections never reach this per-subgroup
              body — they're rendered as one merged <table> above, before
              this .map() even starts. This div-grid path is only for
              non-MCQ subgroups and MCQ sections using the Simple style.) */}

          <div className="questions-list row g-2 mx-0"
        style={{ [paddingSide]: indent }}
          >
            {sgQuestions.map((q: any, qIdx: number) => {
              const globalIdx = thisOffset + qIdx;
              if (questionSlice && (globalIdx < questionSlice.start || globalIdx >= questionSlice.end)) {
                return null;
              }

              // Suppress the "(i)" index for a lone question ONLY when this
              // subgroup already prints its own label heading above it
              // (labelText) — the label alone identifies it, so a redundant
              // "(i)" was noise there. When the subgroup has NO label (e.g.
              // a merged "short" group where each rule just contributes
              // more items to one continuous numbered list), a 1-question
              // subgroup still needs its number — it's the (ix) that
              // continues the sequence after the other subgroups' items,
              // not a standalone single question. Suppressing it left the
              // last item in the list with no number at all.
              const suppressIndex = isNotMCQ && sgQuestions.length === 1 && Boolean(labelText);

              const finalIndex = isLongType
                ? (paperLanguage === 'urdu' ? startNum : startNum + thisOffset + qIdx)
                : getQuestionDisplayIndex(thisOffset + qIdx);

              return (
                <div
                  key={`${q.id}-${thisOffset}-${qIdx}`}
                  ref={el => onQuestionRef?.(q.id, globalIdx, el)}
                  className={`${getDynamicColClass(q)} ${isLongType ? 'ps-0 pe-2' : 'px-2'} mt-1`}
                >
                  <QuestionRenderer
                    question={q}
                    index={suppressIndex ? -1 : finalIndex}  // Falls back to normal index tracking if it's an MCQ
                    qIdx={thisOffset + qIdx}
                    sectionType={section.type}
                    sectionId={section.id}
                    paperLanguage={paperLanguage}
                    isEditMode={isEditMode}
                    config={config}
                    fontSize={settings.fontSize}
                    metaFontSize={settings.metaFontSize}
                    questionFontFamily={settings.fontFamily}
                    questionLineSpacing={settings.lineHeight}
                    mcqFontSize={settings.mcqFontSize ?? 12}
                    mcqLineHeight={settings.mcqLineHeight ?? 1.2}
                    onTextChange={onTextChange}
                    marks={q.marks || section.marksEach}
                    isUrduSubject={isUrduOrEnglish}
                    isLast={thisOffset + qIdx === questions.length - 1}
                    headingFontSize={settings.headingFontSize}
                    shouldShowOr={
                      isLongType && isUrduOrEnglish &&
                      section.totalQuestions === 2 && section.attemptCount === 1
                    }
                    renderInlineBilingual={renderInlineBilingual}
                    suppressNumbering={suppressIndex}
                    hasSubGroups={true}
                    showAnswerLines={answerLinesAllowed && isNotMCQ}
                    answerLinesShort={settings.answerLinesShort}
                    answerLinesLong={settings.answerLinesLong}
                    answerLineGapMm={settings.answerLineGapMm}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
      </>
    );
  })()
)  : (
          renderQuestionsList(
            questionSlice ? questions.slice(questionSlice.start, questionSlice.end) : questions,
            questionSlice ? questionSlice.start : 0,
            suppressNumberingSection || isSingleTranslateSection || isSinglePassageSection
          )
        )}
      </div>
    );
  };

  // ... rest of the component (MCQAnswerKeyPage, DashedLine, PaperSlot, renderContent, etc.) remains the same ...

  const MCQAnswerKeyPage = () => {
    const allMCQs = mcqs.flatMap(s => s.questions || []);
    if (allMCQs.length === 0) return null;
    return (
      <div className="paper-sheet border shadow-sm print-break mcq-key-sheet" style={sheetBaseStyle}>
        <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <h2 className="text-center mb-4" style={{
            fontFamily: settings.headingFontFamily,
            fontSize: settings.headingFontSize,
            borderBottom: '2px solid #000',
            paddingBottom: '2px',
            fontWeight: 'bold',
          }}>
            MCQ Answer Keys — For Class: {(currentClass as any)?.name || currentClass} ({subject})
          </h2>
          <div className="d-flex justify-content-center">
            <div style={{ width: '320px' }}>
              <table className="table table-bordered border-dark table-sm">
                <thead>
                  <tr style={{ backgroundColor: 'transparent' }}>
                    <th className="text-center" style={{ width: '40%' }}>Question #</th>
                    <th className="text-center" style={{ width: '60%' }}>Correct Key</th>
                  </tr>
                </thead>
                <tbody>
                  {allMCQs.map((q, idx) => (
                    <tr key={idx}>
                      <td className="text-center fw-bold">{idx + 1}</td>
                      <td className="text-center text-uppercase">{q.correct_option || q.answer || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DashedLine = () => (
    <div
      className="w-100 my-1 border-top border-dark position-relative"
      style={{ borderStyle: 'dashed', borderWidth: '2px', height: '1px' }}
    >
      <span
        className="position-absolute bg-white px-0 fw-bold"
        style={{ fontSize: '12px', top: '-10px', left: '0mm', zIndex: 1 }}
      >
        ✂
      </span>
    </div>
  );

  const PaperSlot = ({ height, children }: { height: string; children: React.ReactNode }) => (
    <div style={{ height, overflow: 'clip', position: 'relative' }}>{children}</div>
  );

  const renderContent = () => {
    const pages: React.ReactNode[] = [];

    // Shared by every PaginatedPaperGroup instance below.
    const paginatedGroupCommonProps = {
      subject, isPremium, profile, isEditMode, settings, paperLanguage, config,
      currentLayout, currentClass, subjectUrduName, sheetBaseStyle,
      pageContentHeightMm: sheetContentHeightMm,
      renderSectionBlock: (
        section: PaperSection,
        extra?: Parameters<PaginatedPaperGroupProps['renderSectionBlock']>[1]
      ) => <SectionBlock section={section} {...extra} />,
    };

    if (['same', 'same_page', 'combined'].includes(currentLayout)) {
      pages.push(
        <PaginatedPaperGroup
          key="same-paper" keyPrefix="same-paper"
          group={[...mcqs, ...subjectives]} marks={mcqTotalMarks + subTotalMarks} part="combined"
          {...paginatedGroupCommonProps}
        />
      );
    }
    else if (currentLayout === 'separate') {
      if (mcqs.length > 0) pages.push(
        <PaginatedPaperGroup
          key="mcq-separate" keyPrefix="mcq-separate"
          group={mcqs} marks={mcqTotalMarks} part="mcq"
          {...paginatedGroupCommonProps}
        />
      );
      if (subjectives.length > 0) pages.push(
        <PaginatedPaperGroup
          key="sub-separate" keyPrefix="sub-separate"
          group={subjectives} marks={subTotalMarks} part="subjective"
          {...paginatedGroupCommonProps}
        />
      );
    }
    else if (['two_papers', 'two_paper', 'three_papers', 'three_paper'].includes(currentLayout)) {
      const count      = currentLayout.startsWith('two') ? 2 : 3;
      const slotHeight = computeSlotHeight(count);
      const fsOffset   = currentLayout.startsWith('three') ? -3 : -1;
      const wmScale    = currentLayout.startsWith('two')   ? 0.7 : 0.5;

      const miniSheet = (
        key: string,
        group: PaperSection[],
        totalM: number,
        part: 'mcq' | 'subjective'
      ) => group.length === 0 ? null : (
        <div key={key} className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
          {[...Array(count)].map((_, i) => (
            <React.Fragment key={i}>
              <PaperSlot height={slotHeight}>
                <div style={{ position: 'relative', zIndex: 1, padding: '0mm', height: '100%' }}>
                  <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} scale={wmScale} top="60%" />
                  <PaperHeader
                    totalMarks={totalM} subject={subject} paperSections={group}
                    isEditMode={isEditMode}
                    settings={{ ...settings, fontSize: settings.fontSize + fsOffset }}
                    paperLanguage={paperLanguage} config={config} currentLayout={currentLayout}
                    currentClass={currentClass} profile={profile} paperPart={part}
                  />
                  {group.map(s => <SectionBlock key={`${i}-${s.id}`} section={s} />)}
                </div>
              </PaperSlot>
              {i < count - 1 && <DashedLine />}
            </React.Fragment>
          ))}
        </div>
      );
      pages.push(miniSheet('mcq-mini-page', mcqs,       mcqTotalMarks, 'mcq'));
      pages.push(miniSheet('sub-mini-page', subjectives, subTotalMarks, 'subjective'));
    }
    else if (currentLayout === 'four_papers') {
      const count      = 4;
      const slotHeight = computeSlotHeight(count);
      const fontShrink = 4;
      const wmScale    = 0.4;

      const fourSheet = (key: string, sections: PaperSection[], totalM: number) =>
        sections.length === 0 ? null : (
          <div key={key} className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <div style={{ position: 'relative', zIndex: 1, padding: '0mm', height: '100%' }}>
                    <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} scale={wmScale} top="60%" />
                    <PaperHeader
                      totalMarks={totalM} subject={subject} paperSections={sections}
                      isEditMode={isEditMode}
                      settings={{ ...settings, fontSize: settings.fontSize - fontShrink }}
                      paperLanguage={paperLanguage} config={config} currentLayout={currentLayout}
                      currentClass={currentClass} profile={profile} paperPart="subjective"
                      subjectUrduName={subjectUrduName}
                    />
                    {sections.map(s => <SectionBlock key={`${i}-${s.id}`} section={s} />)}
                  </div>
                </PaperSlot>
                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );

      pages.push(fourSheet('four-papers-short-page', fourPaperShortSections, fourPaperShortTotalMarks));
      pages.push(fourSheet('four-papers-long-page',  fourPaperLongSections,  fourPaperLongTotalMarks));
    }

    pages.push(<MCQAnswerKeyPage key="mcq-keys" />);
    return <div className="print-container">{pages}</div>;
  };

  return (
    // Establishes the RTL/LTR context for everything below, notably the
    // MCQ options grid (a plain Bootstrap row with no direction of its own —
    // it just inherits from an ancestor). PaperBuilderApp happens to also set
    // this on its own outer wrapper, but PaperPreviewer (the saved-paper
    // viewer) never did, so a saved Urdu paper's MCQ options silently fell
    // back to the browser's LTR default while the live builder looked
    // correct. Setting it here, at the actual source of the content, means
    // every caller gets correct direction for free instead of each one
    // having to remember to wrap this component in a direction-aware div.
    <div className="paper-builder-renderer bg-secondary-subtle" style={{ direction: config.direction as any }}>
      <style>{`
        /* TinyMCE wraps question text in <p> by default, which is
           block-level — that forces a line break before whatever follows
           it, which is why the marks number ended up on its own line under
           the text. A multi-line stanza/poem is stored as one <p> PER LINE
           (TinyMCE's default Enter behaviour), so making every <p> inline
           collapsed the whole stanza onto a single line — only the LAST
           paragraph needs to go inline, so the trailing marks number
           attaches to the final line while earlier lines still break
           normally, exactly as typed in the editor. */
        .alt-question-inline p { margin: 0; }
        .alt-question-inline p:last-child { display: inline; }

        /* ── Screen: visual frame around each paper sheet ── */
        @media screen {
          .paper-sheet {
            box-shadow: 0 2px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);
            margin: 20px auto;
            background: white;
          }
        }

        /* ── Print: make paper fill the page exactly ─────────────────
           All layout (width, height, padding, flex, font) is in
           inline styles on .paper-sheet — we only strip chrome here.
           ─────────────────────────────────────────────────────────── */
        @media print {
          @page { size: ${pageSize.cssName} portrait; margin: 0mm; }

          html, body {
            margin: 0 !important; padding: 0 !important;
            width: 100% !important; height: auto !important;
            overflow: visible !important; background: white !important;
          }

          /* ── Kill AcademyLayout chrome (classnames added to AcademyLayout.tsx) ── */
          .al-sidebar-desktop, .al-sidebar-mobile,
          .al-mobile-topbar, .al-footer-wrap,
          aside, nav, footer,
          header:not(.paper-header),
          .no-print, .page-border { display: none !important; }

          /* Outer layout wrappers: block + no space */
          .al-body-row  { display: block !important; }
          .al-main, main, [role="main"] {
            display: block !important;
            overflow: visible !important;
            width: 100% !important; max-width: 100% !important;
            height: auto !important;
            margin: 0 !important; padding: 0 !important;
          }
          .al-content-pad, .al-content-inner {
            padding: 0 !important; margin: 0 !important;
            max-width: 100% !important; width: 100% !important;
          }

          .paper-builder-renderer { padding: 0 !important; background: white !important; }

          /* ── Paper sheet: shared chrome-stripping for every sheet, plus
             separate sizing rules for the two families of layout below.
             display is deliberately left alone here — sheetBaseStyle already
             sets display:flex/flexDirection:column inline, and that must
             carry through into print unchanged. Forcing display:block used
             to live here, but it silently broke every child that relies on
             the sheet being a flex container (e.g. the flex:1/minHeight:0
             content wrapper each PaginatedPaperGroup page uses to fill the
             page, and the flex-shrink sizing of the fixed-height PaperSlot
             mini-slots in the two/three/four-papers-per-page layouts) —
             those children would size/shrink correctly on screen but not in
             print, producing exactly the kind of spacing mismatch this file
             exists to prevent. overflow:hidden clips a flex column just as
             reliably as a block one, so there's no upside to overriding it. ── */
          .paper-sheet {
            margin: 0 !important; border: 0 !important;
            box-shadow: none !important; outline: 0 !important;
            page-break-after: always !important; break-after: page !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Every sheet — including paper-sheet--flow (separate/same_page/
             same/combined) — is hard-capped to exactly one physical page in
             print, full stop. This used to exempt paper-sheet--flow sheets,
             deliberately leaving them uncapped so a page whose real content
             came out a hair taller than the hidden measurement pass
             estimated could spill onto an extra physical page instead of
             clipping. That assumption doesn't hold in practice: letting a
             flow sheet's content flow/fragment naturally across pages has
             turned out to be wildly unpredictable across real browser/OS
             print configurations — the same JS plan that renders as one
             clean page on one machine has fragmented into a dozen
             near-empty ones on another, with individual questions stranded
             pages apart from their own section. The JS-measured plan is by
             far the more trustworthy source of truth than the print
             engine's own fragmentation of an unbounded flex column, so it's
             now authoritative: each sheet gets exactly the one physical page
             its plan slot represents, with overflow clipped rather than left
             to the browser to fragment. The compound selector below
             (.paper-sheet.paper-sheet--flow) is used so this reliably
             outweighs PaperBuilderApp's own plain .paper-sheet print rule
             (height:auto !important) regardless of which stylesheet happens
             to be later in the cascade. A residual measurement/print drift
             now shows as a rare, minor clipped line at the very bottom of a
             page rather than dozens of blank ones — an acceptable trade
             given how severe and unpredictable the alternative has proven
             to be. */
          .paper-sheet.paper-sheet--flow {
            height: ${pageSize.heightMm}mm !important;
            max-height: ${pageSize.heightMm}mm !important;
            overflow: hidden !important;
          }
          .paper-sheet:not(.paper-sheet--flow) {
            height: ${pageSize.heightMm}mm !important;
            max-height: ${pageSize.heightMm}mm !important;
            overflow: hidden !important;
          }

          .print-container > .paper-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>
      {renderContent()}
    </div>
  );
};
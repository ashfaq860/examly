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
    <div style={{ marginTop: '2mm', marginBottom: '3mm', breakInside: 'avoid' }}>
      <div style={{
        fontWeight: 700, fontSize: '10px', textAlign: 'center',
        borderBottom: '0.3mm solid #000', paddingBottom: '1mm', marginBottom: '2mm',
      }}>
        MCQ Answer Sheet
      </div>
      <div style={{ columnCount: 4, columnGap: '4mm' }}>
        {questionNumbers.map(qNum => (
          <div
            key={qNum}
            style={{
              display: 'flex', alignItems: 'center', gap: '2mm',
              breakInside: 'avoid', marginBottom: '1.5mm',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '9px', minWidth: '7mm' }}>{qNum}.</span>
            {OMR_OPTIONS.map(opt => (
              <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5mm' }}>
                <span style={{ fontSize: '7px' }}>{opt}</span>
                <span style={{
                  display: 'inline-block', width: '3.5mm', height: '3.5mm',
                  borderRadius: '50%', border: '0.25mm solid #333',
                }} />
              </span>
            ))}
          </div>
        ))}
      </div>
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
// A section is "atomic" (never split mid-section) when it's a paired-long
// pair, an OR-alternative group, or a mixed sub-part block — splitting any
// of those partway through would break numbering/labels that only make
// sense as a whole. Every other section (plain MCQ/short/long lists) is
// split at question boundaries when it doesn't fit the remaining space.
const isAtomicSection = (section: PaperSection): boolean => {
  const subgroups = (section as any).subgroups;
  return Boolean((section as any).isPairedLong) ||
    Boolean((section as any).isAlternativeGroup) ||
    (Array.isArray(subgroups) && subgroups.length > 1);
};

type PageEntry =
  | { section: PaperSection; atomic: true }
  | { section: PaperSection; atomic: false; start: number; end: number; suppressHeader: boolean };

const MM_TO_PX = 96 / 25.4;
const PAGE_FOOTER_RESERVE_MM = 8;
// Tiny safety cushion on every measured height, for residual sub-pixel
// rounding between the hidden measurement pass and the final render — kept
// small deliberately. A page that's ever a hair too full now just spills its
// last sliver onto an extra physical page instead of clipping (see the
// paper-sheet--flow print rule below), so this no longer needs to be a large
// margin bought at the cost of packing accuracy. A big cushion here was
// actively counterproductive: it made the packer believe a page was full
// well before it visually was, which is why a section ending mid-page (e.g.
// Q.2's last sub-question) wasn't letting the next section (Q.3) start in
// the real leftover space and instead pushed it to a fresh page.
const MEASURED_HEIGHT_SAFETY_FACTOR = 1.01;

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

    for (const section of group) {
      if (isAtomicSection(section)) {
        const h = sectionBlockHeights[section.id] ?? 0;
        if (used > 0 && used + h > budget) newPage();
        plan[pageIdx].push({ section, atomic: true });
        used += h;
        continue;
      }

      const qHeights = questionHeights[section.id];
      const totalQuestions = section.questions?.length || 0;
      if (!qHeights || totalQuestions === 0) continue;
      const headerH = sectionHeaderHeights[section.id] ?? 0;

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
        while (qEnd < totalQuestions) {
          const qH = qHeights[qEnd] ?? 0;
          if (qEnd > qStart && consumed + qH > remaining) break;
          consumed += qH;
          qEnd += 1;
        }
        if (qEnd === qStart) {
          if (used > 0) { newPage(); continue; }
          // Not even one question fits a *fresh* page — place it alone rather
          // than looping forever; it may overflow (an unusually huge question).
          qEnd = qStart + 1;
        }

        plan[pageIdx].push({ section, atomic: false, start: qStart, end: qEnd, suppressHeader: !firstSlice });
        used += consumed + reserve;
        firstSlice = false;
        qStart = qEnd;
      }
    }

    setPages(plan);
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
        isAtomicSection(section) ? (
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
    // minHeight (not a fixed height) for single-paper layouts: the paginator
    // fits content to the page via measurement, but if that's ever even
    // slightly off (or one unsplittable atomic block genuinely doesn't fit),
    // a FIXED height + visible overflow would let the excess spill exactly
    // onto the next sheet, which sits at a fixed +pageHeight offset regardless
    // of the overflow — i.e. visible overlap. minHeight lets the sheet itself
    // grow to absorb the discrepancy instead of overlapping its neighbour.
    ...(isSinglePaperLayout
      ? { minHeight: `${pageSize.heightMm}mm` }
      : { height: `${pageSize.heightMm}mm` }),
    padding: '4mm',
    backgroundColor: 'white', margin: '0 auto',
    position: 'relative', overflow: isSinglePaperLayout ? 'visible' : 'hidden',
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
        section.type === 'mcq' || section.type === 'long' || section.type === 'summary' ||
        (section.type === 'short' && subject.toLowerCase() !== 'urdu') ||
        sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma')
      ) return 'col-12';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6';
      const engText = q.question_text || q.question || '';
      const urText  = q.question_text_ur || '';
      const len = engText.length + urText.length * 1.5;
      return len < 50 ? 'col-3' : len < 60 ? 'col-4' : len < 120 ? 'col-6' : 'col-12';
    };
const isStanzaPunctuationPairWords  =  sectionType.includes('stanza_explanation') || sectionType.includes('punctuation')|| sectionType.includes('pair_of_words')
    const isLongType = sectionType.includes('long') || sectionType.includes('summary') ||
  
    sectionType.includes('darkhwast') || sectionType.includes('makalma');
    const isSingleAttemptLong = isLongType && section.totalQuestions <= 2 && section.attemptCount === 1;
    const isPairedLong = Boolean((section as any).isPairedLong);
    const isAlternativeGroup = Boolean((section as any).isAlternativeGroup);
    const subgroups: any[] | undefined = (section as any).subgroups;
    const hasSubgroups = Array.isArray(subgroups) && subgroups.length > 1;
    const suppressNumberingSection = Boolean((section as any).suppressNumbering);
    const singleItemMarksOnly      = Boolean((section as any).singleItemMarksOnly);
    const isSingleTranslateSection = (sectionType === 'translate_urdu' || sectionType === 'translate_english') && questions.length === 1;
    const hideHeader = isPairedLong || isAlternativeGroup || (hasSubgroups&&isStanzaPunctuationPairWords)  ||
      (isUrduOrEnglish && isSingleAttemptLong && !isPoetry && !isGazal && !isCorrection && isCompletion);

    const sharedAttemptNote: string | null  = (section as any).sharedAttemptNote  || null;
    const sharedAttemptCount: number | null = (section as any).sharedAttemptCount ?? null;
    const sharedTotalPairs: number | null   = (section as any).sharedTotalPairs   ?? null;
    const alternativeMarks: number[] | null = (section as any).alternativeMarks   || null;

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
      // Only the "Q.N" number label (its own separate fw-bold span) should
      // be bold — the question sentence itself should render at normal
      // weight, matching every other layout in this app (QuestionRenderer
      // defaults question content to fontWeight: 'normal'). This was
      // wrongly set to 'bold' and applied to the question text too, making
      // the whole alternative-question sentence render bold in board papers.
      const altQuestionFontWeight = 'normal';

      const OrDivider = () => (
        <div
          style={{
            width: '100%', textAlign: 'center', fontWeight: 700,
            fontSize: `${settings.fontSize + 2}px`,
            fontFamily: isUrduLang ? URDU_FONT : settings.fontFamily,
            margin: '0px 0',
          }}
        >
          {isUrduLang ? 'یا' : 'OR'}
        </div>
      );

      return (
        <div className="alternative-group-block">
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            {questions.map((q, qIdx) => {
              const qMarks = alternativeMarks?.[qIdx] ?? q.marks ?? section.marksEach;
              const isFirstRow = qIdx === 0;

              if (isBilingualLang) {
                return (
                  <React.Fragment key={`${q.id}-${qIdx}`}>
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
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <div style={{
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
                          </div>
                          <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px`, flexShrink: 0 }}>
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
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: '4px' }}>
                          <span className="fw-bold text-nowrap" style={{
                            fontSize: `${altMarksFs}px`, flexShrink: 0, direction: 'ltr', unicodeBidi: 'embed' as any,
                          }}>
                            {qMarks}
                          </span>
                          <div
                            dir="rtl" lang="ur"
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
                          </div>
                        </div>
                      </div>
                    </div>
                    {qIdx < questions.length - 1 && <OrDivider />}
                  </React.Fragment>
                );
              }

              if (isUrduLang) {
                return (
                  <React.Fragment key={`${q.id}-${qIdx}`}>
                    <div style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%', alignItems: 'flex-start' }}>
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
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: '4px' }}>
                        <span className="fw-bold text-nowrap" style={{
                          fontSize: `${altMarksFs}px`, flexShrink: 0, direction: 'ltr', unicodeBidi: 'embed' as any,
                        }}>
                          {qMarks}
                        </span>
                        <div
                          dir="rtl" lang="ur"
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
                              value={q.question_text_ur || q.question_text || ''}
                              onChange={(v: string) => onTextChange(section.id, q.id, 'question_text_ur', v)}
                            />
                          ) : (
                            <RichText html={q.question_text_ur || q.question_text || ''} />
                          )}
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
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <div style={{
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
                      </div>
                      <span className="fw-bold text-nowrap" style={{ fontSize: `${altMarksFs}px`, flexShrink: 0 }}>
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

          /* ── URDU-ONLY QUESTION ROW ── */
          if (isUrduLang) {
            return (
              <div
                key={`${q.id}-${qIdx}`}
                style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%', alignItems: 'flex-start' }}
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

    const renderQuestionsList = (qs: any[], baseOffset: number, suppressNum = false) => (
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
              className={`${getDynamicColClass(q)} px-2 mt-1`}
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
            {isPoetry ? 'حصہ نظم:' : isGazal ? 'حصہ غزل:' : ''}

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
                singleItemMarksOnly={singleItemMarksOnly || isSingleTranslateSection}
              />
            )}
          </div>
        )}

        {isPairedLong ? (
          renderPairedQuestions()
        ) : isAlternativeGroup ? (
          renderAlternativeGroup()
        ) : hasSubgroups ? (
  (() => {
    let offset = 0;
    const totalSubgroupMarks = subgroups!.reduce((sum, sg) => sum + (sg.attemptCount || 0) * (sg.marksEach || 0), 0);

    return subgroups!.map((sg, sgIdx) => {
      const sgQuestions = Array.isArray(sg.questions) ? sg.questions : [];
      const thisOffset  = offset;
      offset += sgQuestions.length;
      if (sgQuestions.length === 0) return null;

      /*const labelText = sg.qLabel || sg.categoryLabel || '';
      const sgMarks   = sg.marksEach != null ? sg.marksEach : 0;
      const sgAttempt = sg.attemptCount != null ? sg.attemptCount : sgQuestions.length;
      */
     const labelText = sg.qLabel || sg.categoryLabel || '';
const sgMarksEach = sg.marksEach != null ? sg.marksEach : 0;
const sgAttempt   = sg.attemptCount != null ? sg.attemptCount : sgQuestions.length;
// For pair_of_words (and any type where attempt < total questions),
// show total marks = attemptCount × marksEach, not per-question marks.
const sgMarks = sgAttempt > 1 ? sgAttempt * sgMarksEach : sgMarksEach;
      // Check if the current section is NOT an MCQ
      const isNotMCQ = section.type !== 'mcq';
        
            // Inside the subgroup mapping, after the label div
const isRtl = paperLanguage === 'urdu';
const paddingSide = isRtl ? 'paddingRight' : 'paddingLeft';
const indent = labelText&&isStanzaPunctuationPairWords ? '35px' : '0';   // only indent if there is a labe
          
      return (
        <div key={`subgroup-${section.id}-${sgIdx}`} className="subgroup-block" style={{ marginTop: sgIdx > 0 ? '6px' : '0px' }}>
          {/* ── Subgroup label row ── */}
         {labelText && (
  (() => {
    const isBilingual = paperLanguage === 'bilingual';
    const isUrduLang  = paperLanguage === 'urdu';
    // Urdu label: prefer qLabelUr, then categoryLabelUr, then labelText if RTL
    const urLabel = sg.qLabelUr || sg.categoryLabelUr || '';
    const enLabel = sg.qLabel || sg.categoryLabel || '';

    if (isBilingual) {
      return (
        <div style={{ display: 'flex', width: '100%', gap: '12px', alignItems: 'flex-start', marginBottom: '3px' }}>
          {/* LEFT — English */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {sgIdx === 0 && isNotMCQ && (
              <span style={{ fontWeight: 700, fontFamily: settings.headingFontFamily, fontSize: `${settings.headingFontSize}px`, flexShrink: 0 }}>
                Q.{startNum}
              </span>
            )}
            {sgIdx > 0 && isNotMCQ && (
              <span style={{ display: 'inline-block', width: `${(String(startNum).length + 2) * (settings.headingFontSize * 0.6)}px` }} />
            )}
            <span style={{ fontWeight: 600, fontSize: `${settings.fontSize}px`, fontFamily: settings.fontFamily }}>
              {enLabel}
            </span>
            {sgMarks > 0 && isNotMCQ && (
              <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: 'auto', fontSize: `${settings.fontSize}px` }}>
                {sgMarks}
              </span>
            )}
          </div>
          {/* RIGHT — Urdu */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row-reverse', alignItems: 'baseline', gap: '6px', direction: 'rtl' }}>
            {sgIdx === 0 && isNotMCQ && (
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
            {sgMarks > 0 && isNotMCQ && (
              <span style={{ fontWeight: 700, flexShrink: 0, marginRight: 'auto', fontSize: `${settings.fontSize}px`, direction: 'ltr' }}>
                {sgMarks}
              </span>
            )}
          </div>
        </div>
      );
    }

    // Urdu-only
    if (isUrduLang) {
      return (
        <div style={{ display: 'flex', flexDirection: 'row-reverse', width: '100%', alignItems: 'baseline', gap: '6px', marginBottom: '3px', direction: 'rtl' }}>
          {sgIdx === 0 && isNotMCQ && (
            <span style={{ fontWeight: 700, fontFamily: URDU_FONT, fontSize: `${settings.headingFontSize + 2}px`, flexShrink: 0, direction: 'ltr' }}>
              Q.{startNum}
            </span>
          )}
          <span dir="rtl" lang="ur" style={{ fontWeight: 600, fontSize: `${settings.fontSize + 2}px`, fontFamily: URDU_FONT, flex: 1 }}>
            {urLabel || enLabel}
          </span>
          {sgMarks > 0 && isNotMCQ && (
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
          {sgIdx === 0 && isNotMCQ && (
            <span style={{ fontWeight: 700, fontFamily: settings.headingFontFamily, fontSize: `${settings.headingFontSize}px`, marginRight: '6px' }}>
              Q.{startNum}
            </span>
          )}
          {sgIdx > 0 && isNotMCQ && (
            <span style={{ display: 'inline-block', width: `${(String(startNum).length + 2) * (settings.headingFontSize * 0.6)}px` }} />
          )}
          {enLabel}
        </span>
        {sgMarks > 0 && isNotMCQ && (
          <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: '8px', fontSize: `${settings.fontSize}px` }}>
            {sgMarks}
          </span>
        )}
      </div>
    );
  })()
)}

          {/* ── Questions List ── */}
  
          <div className="questions-list row g-2 mx-0"
        style={{ [paddingSide]: indent }}
          >
            {sgQuestions.map((q: any, qIdx: number) => {
              // Suppress index ONLY if it's a single question AND NOT an MCQ
              const suppressIndex = isNotMCQ && sgQuestions.length === 1;
              
              const finalIndex = isLongType
                ? (paperLanguage === 'urdu' ? startNum : startNum + thisOffset + qIdx)
                : getQuestionDisplayIndex(thisOffset + qIdx);

              return (
                <div key={`${q.id}-${thisOffset}-${qIdx}`} className={`${getDynamicColClass(q)} px-2 mt-1`}>
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
    });
  })()
)  : (
          renderQuestionsList(
            questionSlice ? questions.slice(questionSlice.start, questionSlice.end) : questions,
            questionSlice ? questionSlice.start : 0,
            suppressNumberingSection || isSingleTranslateSection
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
             separate sizing rules for the two families of layout below. ── */
          .paper-sheet {
            display: block !important;
            margin: 0 !important; border: 0 !important;
            box-shadow: none !important; outline: 0 !important;
            page-break-after: always !important; break-after: page !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Fixed multi-slot layouts (two/three/four-papers-per-page) and the
             MCQ answer-key page: these already use a hard inline height +
             clipped mini-slots on screen too (no JS-measured pagination
             involved), so capping them again here is just belt-and-suspenders
             — never a source of drift between screen and print. */
          .paper-sheet:not(.paper-sheet--flow) {
            height: ${pageSize.heightMm}mm !important;
            max-height: ${pageSize.heightMm}mm !important;
            overflow: hidden !important;
          }

          /* Paginated single-sheet layouts (separate/same_page/same/combined):
             deliberately NOT capped here. On screen these rely on inline
             minHeight + overflow:visible (see sheetBaseStyle) so a page whose
             real content comes out a hair taller than the hidden measurement
             pass estimated (font metrics / sub-pixel rounding between the two
             render passes are never bit-identical) just grows instead of
             clipping. Forcing a hard height + overflow:hidden here in print
             only guaranteed screen and print would draw DIFFERENT things
             whenever that drift occurred: print would silently clip the
             overflow — a real question's answer lines quietly vanishing off
             the bottom of the page — while screen showed the same content
             intact, just slightly overflowing. Leaving print unclipped means
             any such drift instead spills onto an extra physical page: the
             content is still complete, and print now matches the screen
             preview exactly instead of silently losing questions in the gap
             between "what the JS plan assumed" and "what actually rendered".

             When that spillover happens, box-decoration-break:clone tells
             the print engine to re-apply this sheet's own padding at BOTH
             sides of the fragment boundary — a bottom margin on the physical
             page the overflow starts on, and (crucially) a top margin on the
             physical page it continues onto — instead of the default
             "slice" behaviour, which only pads the very first and very last
             fragment and leaves every page in between flush against the
             paper edge with no breathing room. */
          .paper-sheet--flow {
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
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
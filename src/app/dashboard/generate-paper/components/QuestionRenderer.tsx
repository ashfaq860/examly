// dashboard/generate-paper/components/QuestionRenderer.tsx
'use client';
import React, { useEffect } from 'react';
import { LanguageConfig } from '@/types/paperBuilderTypes';
import { EditableText } from './EditableText';
// @ts-ignore — CSS handled by Next.js bundler
import 'katex/dist/katex.min.css';
import { renderHtmlWithMath } from '@/lib/renderHtmlWithMath';
import { DiagramView } from '@/components/DiagramView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QuestionRendererProps {
  question: any;
  index: number;
  qIdx?: number;
  sectionType: string;
  sectionId: string;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  isEditMode: boolean;
  config: LanguageConfig;
  fontSize: number;
  mcqFontSize: number;
  lineHeight?: number;
  mcqLineHeight: number;
  metaFontSize: number;
  questionFontFamily: string;
  onTextChange: (sectionId: string, questionId: string, field: string, value: string) => void;
  renderInlineBilingual?: boolean;
  questionLineSpacing?: number;
  marks?: number;
  isUrduSubject?: boolean;
  isLast?: boolean;
  headingFontSize?: number;
  suppressNumbering?: boolean;
  shouldShowOr?: boolean;
  hasSubGroups?: boolean;
  // ── Paired long-question sub-part label (NEW, optional, additive) ──
  // When provided, renders as a small element directly between the
  // "Q.{index}" number and the question text, on the SAME line/row that
  // QuestionRenderer already owns — e.g. "Q.5 (a) question text...".
  // Only used by the paired long-question (is_paired) rendering path;
  // every other call site (MCQ, short, plain long, etc.) never passes
  // this and renders exactly as before. When present, the row's w-100
  // is relaxed so the extra label doesn't force a wrap onto its own line.
  inlineLabel?: React.ReactNode;
  // Blank answer-writing lines under short/long questions (ignored for MCQ).
  // `showAnswerLines` is the on/off flag; `answerLinesShort`/`answerLinesLong`
  // (both user-configurable in Settings) supply the actual count, and this
  // component picks the right one based on its own already-computed `isLong`.
  showAnswerLines?: boolean;
  answerLinesShort?: number;
  answerLinesLong?: number;
  answerLineGapMm?: number;
}

interface BilingualProps {
  engValue: string;
  urValue?: string;
  engField: string;
  urField: string;
  sectionId: string;
  questionId: string;
  isEnglish: boolean;
  isUrdu: boolean;
  isEditMode: boolean;
  isOption?: boolean;
  fontSize: number;
  urduFontSizeOffset?: number;
  lineSpacing: number;
  questionFontFamily: string;
  urduNumberLabel?: string;
  question?: any;
  // Extended props used by SubjectiveRenderer / long-question paths
  headingFontSize?: number;
  isUrduSubject?: boolean;
  hasSubGroups?: boolean;
  sectionType?: string;
  fontWeight?: string;
  onTextChange: (sid: string, qid: string, field: string, val: string) => void;
  /** Marks value, rendered inline right after the question text (not in its
   *  own column) so it sits close to the text instead of far off at the
   *  row's edge. Only long-type questions pass this. */
  marks?: number | string;
  marksFontSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const URDU_FONT      = "'JameelNoori', 'Noto Nastaliq Urdu', serif";
const PRINT_STYLE_ID = 'qr-print-styles';

// ---------------------------------------------------------------------------
// Inline HTML+Math renderer — replaces old MathRenderer + stripHtml pattern.
// Uses static KaTeX renderToString so math works reliably in print.
// ---------------------------------------------------------------------------
interface RichTextProps {
  html: string | null | undefined;
  /** Extra inline styles applied to the wrapper span */
  style?: React.CSSProperties;
}

export const RichText: React.FC<RichTextProps> = ({ html, style }) => {
  if (!html) return null;
  return (
    <span
      style={style}
      dangerouslySetInnerHTML={{ __html: renderHtmlWithMath(html) }}
    />
  );
};

// ---------------------------------------------------------------------------
// Print styles
// ---------------------------------------------------------------------------
const PRINT_CSS = `
  .urdu-text, [lang="ur"] {
    font-family: 'JameelNoori', 'Noto Nastaliq Urdu', serif !important;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  .question-wrapper { margin-bottom: 0.1rem !important; }

  .editable-content:hover { background-color: rgba(0,0,0,0.02); }
  .editable-content:focus { background-color: #fff !important; border: 1px solid #007bff !important; }
  .urdu-text .editable-content { direction: rtl; text-align: right; }

  /* Editable fields (edit mode) don't declare their own touch-action, so
     mobile browsers default to treating a finger-drag starting on them as
     a text-selection/cursor gesture instead of the page's pinch-zoom-pan —
     that's what blocked panning around a zoomed paper specifically while
     edit mode was on. Explicitly allowing the same gestures as the paper's
     scroll container here restores panning over editable text too. */
  [contenteditable] { touch-action: pan-x pan-y pinch-zoom; }

  /* Diagram SVGs carry their own fixed width/height attributes — scale
     them to the wrapper instead of overflowing it, with no extra
     whitespace around the element itself. (Wrapper margin is left to the
     inline style, not forced here with !important, since bilingual papers
     need margin:'0 auto' to center the diagram instead of margin:0.) */
  .question-diagram { padding: 0 !important; }
  .question-diagram svg { max-width: 100%; height: auto; display: block; margin: 0; padding: 0; }
  .question-diagram img { max-width: 100%; height: auto; display: block; margin: 0; padding: 0; }

  @media print {
    .question-wrapper, .question-wrapper *,
    .mcq-item, .mcq-item *,
    .urdu-text, .english-text,
    .d-flex, span, div {
      background-color: transparent !important;
      background: transparent !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .question-lh-scope {
      line-height: var(--q-lh, 1.4) !important;
    }
    .question-lh-scope * {
      line-height: inherit !important;
    }

    .question-wrapper {
      page-break-inside: avoid !important;
      margin: 0 0 0.1rem 0 !important;
      padding: 0 !important;
    }

    .question-wrapper > *,
    .mcq-item > *,
    .mcq-item .mb-1,
    .mcq-item .row,
    .mcq-item [class*="col-"] {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }

    .mcq-item .row   { --bs-gutter-x: 0 !important; --bs-gutter-y: 0 !important; }
    .mcq-item .d-flex { display: flex !important; align-items: baseline !important; margin: 0 !important; padding: 0 !important; }
    .mcq-item span.fw-bold { align-self: baseline !important; }

    /* Re-enable flex inside question containers (print.css kills it globally) */
    .question-wrapper .d-flex,
    .question-lh-scope .d-flex,
    .english-text .d-flex,
    .urdu-text .d-flex {
      display: flex !important;
    }

    /* Math display blocks — center on their own line, avoid page splits */
    .paper-math-display {
      display: block !important;
      text-align: center !important;
      margin: 0.25em 0 !important;
      page-break-inside: avoid !important;
    }
    .katex-display { margin: 0.2em 0 !important; display: inline-block !important; width: auto !important; }
    .katex { font-size: 1.05em !important; text-rendering: auto !important; }
  }
`;

function injectPrintStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = PRINT_STYLE_ID;
  el.textContent = PRINT_CSS;
  document.head.appendChild(el);
}

if (typeof window !== 'undefined') injectPrintStyles();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toRoman = (n: number): string => {
  const map: [string, number][] = [['x',10],['ix',9],['v',5],['iv',4],['i',1]];
  let r = '';
  for (const [s, v] of map) { while (n >= v) { r += s; n -= v; } }
  return r;
};

// Urdu abjad letters used to enumerate choices within a Urdu-language
// question (e.g. "(الف)"/"(ب)") instead of roman numerals.
const URDU_ABJAD = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ی'];
const toUrduAbjad = (n: number): string => URDU_ABJAD[n - 1] || String(n);


const resolveLH = (val: number | undefined, fallback: number): number =>
  typeof val === 'number' && val > 0 ? val : fallback;

// Scales a diagram's on-page size with the question's own font size, so
// shrinking/growing text in the Settings panel shrinks/grows its diagrams
// too instead of leaving them fixed at one pixel size regardless of how
// dense the rest of the paper is set to be. Clamped to a 0.6x–1.8x range
// so an extreme font size setting can't make a diagram vanish or blow past
// the page — those are still real bounds, just no longer a single fixed one.
const scaleDiagramSize = (
  fontSize: number,
  baseWidth: number,
  baseHeight: number,
  baseFontSize = 12,
): React.CSSProperties => {
  const scale = Math.min(Math.max(fontSize / baseFontSize, 0.6), 1.8);
  return {
    maxWidth: `${Math.round(baseWidth * scale)}px`,
    maxHeight: `${Math.round(baseHeight * scale)}px`,
  };
};

const lhScope = (lh: number): React.CSSProperties =>
  ({ lineHeight: lh, '--q-lh': lh } as React.CSSProperties);

// ---------------------------------------------------------------------------
// BilingualTextDisplay
// ---------------------------------------------------------------------------
const BilingualTextDisplay: React.FC<BilingualProps> = ({
  engValue,
  urValue,
  engField,
  urField,
  sectionId,
  questionId,
  isEnglish,
  isUrdu,
  isEditMode,
  isOption = false,
  fontSize,
  urduFontSizeOffset = 2,
  lineSpacing,
  questionFontFamily,
  urduNumberLabel,
  question,
  headingFontSize,
  isUrduSubject,
  hasSubGroups,
  sectionType,
  fontWeight = 'normal',
  onTextChange,
  marks,
  marksFontSize,
}) => {
  const isTranslate = question?.question_type === 'translate_english';
  const urduLH = isOption ? lineSpacing : Math.max(1.0, lineSpacing - 0.3);

  // Fix: If it's a bilingual MCQ option, display them inline right next to each other
  if (isOption && isEnglish && isUrdu) {
    return (
      <div className="d-flex flex-wrap align-items-baseline w-100" style={{ gap: '0.5rem' }}>
        {/* English option piece */}
        <div
          className="english-text question-lh-scope"
          dir="ltr"
          lang="en"
          style={{
            ...lhScope(lineSpacing),
            marginTop: '-1px',
            fontFamily: questionFontFamily,
            fontSize: `${fontSize}px`,
            textAlign: 'left',
          }}
        >
          {isEditMode ? (
            <EditableText
              value={engValue || ''}
              onChange={(v: string) => onTextChange(sectionId, questionId, engField, v)}
            />
          ) : (
            <RichText html={engValue} />
          )}
        </div>

        {/* Separator / Slash between English and Urdu options }
        <span style={{ fontSize: `${fontSize}px`, color: '#6c757d', alignSelf: 'center' }}>/</span>

        { Urdu option piece */}
        <div
          className="urdu-text question-lh-scope"
          dir="rtl"
          lang="ur"
          style={{
            ...lhScope(urduLH),
            fontFamily: URDU_FONT,
            fontSize: `${fontSize + urduFontSizeOffset}px`,
            textAlign: 'right',
            marginTop: '-3px',
            marginBottom: '0px',
            wordSpacing: '2px',
          }}
        >
          {isEditMode ? (
            <EditableText
              value={urValue || ''}
              onChange={(v: string) => onTextChange(sectionId, questionId, urField, v)}
            />
          ) : (
            <RichText html={urValue || ''} />
          )}
        </div>
      </div>
    );
  }

  // Fallback layout for Standard Single-Language Options and Main Question Stems
  return (
    <div className={`d-flex w-100 ${isUrdu || isTranslate ? 'flex-row-reverse' : 'flex-row'} align-items-start`}>

      {/* ── Urdu block ── */}
      {isUrdu && (
        <div
          className="urdu-text question-lh-scope flex-grow-1"
          dir="rtl"
          lang="ur"
          style={{
            ...lhScope(urduLH),
            fontFamily: URDU_FONT,
            fontSize: `${fontSize + urduFontSizeOffset}px`,
            textAlign: 'right',
            marginTop: '-3px',
            marginBottom: '0px',
            wordSpacing: '2px',
            fontWeight: fontWeight,
          }}
        >
          {isEditMode ? (
            <EditableText
              value={urValue || ''}
              onChange={(v: string) => onTextChange(sectionId, questionId, urField, v)}
            />
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.35rem', flexWrap: 'nowrap', width: '100%' }}>
              {urduNumberLabel && !isOption && (
                <span
                  className="fw-bold text-nowrap"
                  style={{ fontSize: `${fontSize}px`, fontFamily: URDU_FONT, flex: '0 0 auto', whiteSpace: 'nowrap' }}
                >
                  {urduNumberLabel}
                </span>
              )}
            {/* alt-question-inline: TinyMCE wraps question text in a block-level
                <p>, which would otherwise force the marks number onto its own
                line — this class (see PaperLayoutRenderer's global style) makes
                that <p> render inline so marks stays on the same line. */}
            <span className="alt-question-inline" style={{
              display: 'block',
              flex: '1 1 0',
              minWidth: 0,
              textAlign: 'right',
              direction: 'rtl',
              unicodeBidi: 'embed',
              fontFamily: URDU_FONT,
            }}>
              <RichText html={urValue || ''} />
              {marks !== undefined && (
                <>
                  {'  '}
                  <span className="fw-bold text-nowrap" style={{ fontSize: `${marksFontSize ?? fontSize}px`, direction: 'ltr', unicodeBidi: 'embed' as any }}>
                    {marks}
                  </span>
                </>
              )}
            </span>
            </span>
          )}
        </div>
      )}

      {/* ── English / translation block ── */}
      {isEnglish && (
        <div
          className={`${isTranslate ? 'urdu-text' : 'english-text'} question-lh-scope flex-grow-1 alt-question-inline`}
          dir={isTranslate ? 'rtl' : 'ltr'}
          lang={isTranslate ? 'ur' : 'en'}
          style={{
            ...lhScope(isTranslate ? urduLH : lineSpacing),
            marginTop: '-1px',
            fontFamily: isTranslate ? URDU_FONT : questionFontFamily,
            fontSize: isTranslate ? `${fontSize + urduFontSizeOffset}px` : `${fontSize}px`,
            textAlign: isTranslate ? 'right' : 'left',
            fontWeight: fontWeight,
          }}
        >
          {isEditMode ? (
            <EditableText
              value={engValue || ''}
              onChange={(v: string) => onTextChange(sectionId, questionId, engField, v)}
            />
          ) : (
            <RichText html={engValue} />
          )}
          {marks !== undefined && (
            <>
              {'  '}
              <span className="fw-bold text-nowrap" style={{ fontSize: `${marksFontSize ?? fontSize}px` }}>
                {marks}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// QuestionRenderer
// ---------------------------------------------------------------------------
export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  index,
  qIdx,
  sectionType,
  sectionId,
  paperLanguage,
  isEditMode,
  fontSize,
  mcqFontSize,
  mcqLineHeight,
  questionFontFamily,
  questionLineSpacing,
  marks,
  isUrduSubject,
  isLast,
  headingFontSize,
  suppressNumbering,
  shouldShowOr,
  hasSubGroups,
  onTextChange,
  inlineLabel,
  showAnswerLines,
  answerLinesShort,
  answerLinesLong,
  answerLineGapMm,
}) => {

  useEffect(() => { injectPrintStyles(); }, []);

  const isTranslate       = question?.question_type === 'translate_english';
  const isUrdu            = paperLanguage === 'urdu' || paperLanguage === 'bilingual' || isTranslate;
  const isEnglish         = (paperLanguage === 'english' || paperLanguage === 'bilingual');
  const showUrduNumber    = paperLanguage === 'urdu' || isTranslate;
  const showEnglishNumber = (paperLanguage === 'english' || paperLanguage === 'bilingual') && !isTranslate;
  const showUrduSideNumber = paperLanguage === 'bilingual' && !isTranslate;
  const isPaperUrduOrEng   = paperLanguage === 'urdu' || paperLanguage === 'english';

  const isMCQ = sectionType === 'mcq';

  const resolvedMcqLH  = resolveLH(mcqLineHeight,      1.2);
  const resolvedSubjLH = resolveLH(questionLineSpacing, 1.5);
  const currentLH      = isMCQ ? resolvedMcqLH : resolvedSubjLH;

  const numberFontSize = isMCQ ? resolveLH(mcqFontSize, 12) : fontSize;

  const typeKey = sectionType.toLowerCase();
  const isLong  =
    typeKey.includes('long') || typeKey.includes('summary') ||
    typeKey.includes('darkhwast_khat') || typeKey.includes('kahani_makalma') ||
    typeKey.includes('essay');

  const isSecondPartOfOr = shouldShowOr
    ? isLong ? (qIdx || 0) % 2 !== 0 : index % 2 !== 0
    : false;
 
const showNumber = !isSecondPartOfOr && !suppressNumbering && index !== -1;

  let indexDisplay = '';
  if (showNumber) {
    if (isLong)     indexDisplay = `Q.${index}`;
    else if (isMCQ) indexDisplay = `${index + 1}.`;
    else if (paperLanguage === 'urdu' && !hasSubGroups) indexDisplay = `(${toUrduAbjad(index + 1)})`;
    else             indexDisplay = `(${toRoman(index + 1)})`;
  }

  const urduNumberLabel = showUrduSideNumber ? indexDisplay : undefined;

  // inlineLabel presence is what the paired long-question rendering path
  // (PaperLayoutRenderer's renderPairedQuestions) uses to inject "(a)" /
  // "(ب)" etc. directly beside "Q.5" on the same row. Every other call
  // site never passes this prop, so `hasInlineLabel` is false there and
  // the row keeps its original w-100 behavior unchanged.
  const hasInlineLabel = inlineLabel != null;

  return (
    <div className={`question-wrapper mb-1 ${isUrdu || isTranslate ? 'rtl' : 'ltr'}`}>
      <div className={`d-flex align-items-start gap-1 flex-row${hasInlineLabel ? '' : ' w-100'}`}>

        {/* ── 1. Number ── */}
        {showNumber && (
          <div className="d-flex align-items-start">
            {showEnglishNumber && (
              <span
                className={`text-nowrap${isLong ? ' fw-bold' : ''}`}
                style={{ fontWeight: isLong ? 'bold' : 'normal', minWidth: isLong ? '22px' : '18px', fontSize: isLong && isUrduSubject ? `${headingFontSize}px` : `${numberFontSize}px`, lineHeight: currentLH, fontFamily: questionFontFamily, textAlign: 'left' }}
              >
                {indexDisplay}
              </span>
            )}
            {showUrduNumber && (
              <span
                className={`text-nowrap${isLong ? ' fw-bold' : ''}`}
                style={{ fontWeight:`${isLong ? 'bold' : 'normal'}`,marginRight: `${isLong && isUrduSubject ? `-5px` : ``}`,marginTop: `${isLong && isUrduSubject ? `-4px` : ``}`, minWidth: isLong ? '25px' : '18px', fontSize: `${isLong && isUrduSubject ? `${(headingFontSize ?? 18)+2}px` : `${numberFontSize}px`}`, lineHeight: currentLH, fontFamily: URDU_FONT, textAlign: 'right', direction: 'ltr', unicodeBidi: 'embed' }}
              >
                {indexDisplay}
              </span>
            )}
          </div>
        )}

        {/* ── 1.5. Inline sub-part label (e.g. "(a)" / "(ب)") ──
            Sits directly between the Q.No and the question text, on the
            SAME line. Deliberately rendered smaller than the Q.No label
            above (font-size controlled entirely by the caller via the
            inlineLabel node itself, e.g. PaperLayoutRenderer passes its
            own <span style={{fontSize: subLabelFontSize}}>). Only present
            when the caller explicitly passes inlineLabel. */}
        {inlineLabel && (
          <div className="d-flex align-items-start" style={{ flexShrink: 0 }}>
            {inlineLabel}
          </div>
        )}

        {/* ── 2. Question text (+ inline marks for isLong, appended within
               SubjectiveRenderer so it sits right after the text instead of
               in its own column) ── */}
        <div className="flex-grow-1">
          {isMCQ ? (
            <MCQRenderer
              question={question}
              sectionId={sectionId}
              paperLanguage={paperLanguage}
              isUrdu={isUrdu}
              isEnglish={isEnglish}
              isEditMode={isEditMode}
              fontSize={resolveLH(mcqFontSize, 12)}
              lineHeight={resolvedMcqLH}
              questionFontFamily={questionFontFamily}
              urduNumberLabel={urduNumberLabel}
              onTextChange={onTextChange}
            />
          ) : (
            <SubjectiveRenderer
              question={question}
              sectionId={sectionId}
              isUrdu={isUrdu}
              isEnglish={isEnglish}
              isEditMode={isEditMode}
              isLong={isLong}
              fontSize={fontSize}
              lineHeight={resolvedSubjLH}
              questionFontFamily={questionFontFamily}
              urduNumberLabel={urduNumberLabel}
              onTextChange={onTextChange}
              isUrduSubject={isUrduSubject}
              hasSubGroups={hasSubGroups}
              sectionType={sectionType}
              headingFontSize={headingFontSize ?? 18}
              answerLines={showAnswerLines ? (isLong ? (answerLinesLong ?? 5) : (answerLinesShort ?? 4)) : 0}
              answerLineGapMm={answerLineGapMm}
              marks={isLong && isUrduSubject ? marks : undefined}
              marksFontSize={numberFontSize - 2}
            />
          )}
        </div>

      </div>

      {/* ── 4. OR / یا separator ── */}
      {shouldShowOr && isPaperUrduOrEng && !isLast &&
        ((isLong && qIdx === 0) || (!isLong && index % 2 === 0)) && (
        <div className="text-center w-100" style={{ fontWeight: 600, fontSize: `${fontSize}px`, fontFamily: isUrdu ? URDU_FONT : questionFontFamily }}>
          {paperLanguage === 'urdu' ? 'یا' : 'OR'}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MCQRenderer
// ---------------------------------------------------------------------------
interface MCQRendererProps {
  question: any;
  sectionId: string;
  paperLanguage: string;
  isUrdu: boolean;
  isEnglish: boolean;
  isEditMode: boolean;
  fontSize: number;
  lineHeight: number;
  questionFontFamily: string;
  urduNumberLabel?: string;
  onTextChange: (sid: string, qid: string, field: string, val: string) => void;
}

const MCQRenderer: React.FC<MCQRendererProps> = ({
  question,
  sectionId,
  paperLanguage,
  isUrdu,
  isEnglish,
  isEditMode,
  fontSize,
  lineHeight,
  questionFontFamily,
  urduNumberLabel,
  onTextChange,
}) => {
  const options = ['a', 'b', 'c', 'd'] as const;

  const getColClass = () => {
    let maxLen = 0;
    options.forEach(k => {
      const len = (question[`option_${k}`] || '').length + (question[`option_${k}_ur`] || '').length;
      if (len > maxLen) maxLen = len;
    });
    const t = paperLanguage === 'bilingual' ? 50 : 80;
    if (maxLen > t * 2) return 'col-12';
    if (maxLen > t)     return 'col-6';
    return 'col-3';
  };

  const commonBilingual = {
    sectionId,
    isEnglish,
    isUrdu,
    isEditMode,
    fontSize,
    lineSpacing: lineHeight,
    questionFontFamily,
    onTextChange,
    question,
  };

  return (
    <div className="mcq-item">
      {/* Stem */}
      <div className="mb-1">
        <BilingualTextDisplay
          {...commonBilingual}
          engValue={question.question_text || question.question}
          urValue={question.question_text_ur || (paperLanguage === 'urdu' ? question.question_text || question.question : '')}
          engField="question_text"
          urField="question_text_ur"
          questionId={question.id}
          urduNumberLabel={urduNumberLabel}
        />
      </div>

      {question.diagram && (
        <DiagramView
          diagram={question.diagram}
          className="question-diagram"
          style={{
            ...scaleDiagramSize(fontSize, 260, 200),
            display: 'block',
            // Bilingual papers lay English/Urdu out as LTR-anchored side-by-side
            // columns — a plain block-level diagram defaults flush-left, which
            // visually reads as "belonging" only to the English column. Centering
            // it makes clear it's shared by both language columns.
            margin: isUrdu && isEnglish ? '0 auto' : 0,
            padding: 0,
          }}
        />
      )}

      {/* Options */}
      {/* Adjusted padding wrapper to allow flexible alignment structure inside options */}
      <div className={`row g-1 mx-0 ${isUrdu ? 'pe-2' : 'ps-2'}`}>
        {options.map(k => {
          const eng = question[`option_${k}`];
          const ur  = question[`option_${k}_ur`];
          return (
            <div key={k} className={`${getColClass()} d-flex gap-1 align-items-baseline`}>
              <span className="fw-bold" style={{ minWidth: '12px', fontSize: `${fontSize * 0.9}px`, fontFamily: questionFontFamily, lineHeight }}>
                ({k})
              </span>
              <BilingualTextDisplay
                {...commonBilingual}
                isOption
                engValue={eng}
                urValue={paperLanguage === 'urdu' && !ur ? eng : ur}
                engField={`option_${k}`}
                urField={`option_${k}_ur`}
                questionId={question.id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SubjectiveRenderer
// ---------------------------------------------------------------------------
interface SubjectiveRendererProps {
  question: any;
  sectionId: string;
  isUrdu: boolean;
  isEnglish: boolean;
  isEditMode: boolean;
  isLong: boolean;
  fontSize: number;
  lineHeight: number;
  questionFontFamily: string;
  urduNumberLabel?: string;
  headingFontSize: number;
  isUrduSubject?: boolean;
  sectionType: string;
  hasSubGroups?: boolean;
  onTextChange: (sid: string, qid: string, field: string, val: string) => void;
  /** Number of blank ruled lines to print under the question for students
   *  to write their answer. 0/undefined renders nothing. */
  answerLines?: number;
  /** Height (mm) of each ruled line's writing space. Defaults to 6mm. */
  answerLineGapMm?: number;
  /** Marks, rendered inline right after the question text. */
  marks?: number | string;
  marksFontSize?: number;
}

const SubjectiveRenderer: React.FC<SubjectiveRendererProps> = ({
  question,
  sectionId,
  isUrdu,
  isEnglish,
  isEditMode,
  isLong,
  fontSize,
  lineHeight,
  questionFontFamily,
  urduNumberLabel,
  headingFontSize,
  isUrduSubject,
  hasSubGroups,
  sectionType,
  onTextChange,
  answerLines,
  answerLineGapMm,
  marks,
  marksFontSize,
}) => (
  <>

  <BilingualTextDisplay
    sectionId={sectionId}
    questionId={question.id}
    isEnglish={isEnglish}
    isUrdu={isUrdu}
    isEditMode={isEditMode}
    engValue={question.question_text || question.question}
    urValue={question.question_text_ur}
    engField="question_text"
    urField="question_text_ur"
    fontWeight={isLong && isUrduSubject? 'bold' : 'normal'}
    fontSize={isLong && isUrduSubject ?headingFontSize+2 : fontSize}
    lineSpacing={lineHeight}
    questionFontFamily={isLong && isUrduSubject ?"'JameelNoori', 'Noto Nastaliq Urdu', serif" : questionFontFamily}
    urduNumberLabel={urduNumberLabel}
    question={question}
    hasSubGroups={hasSubGroups}
    sectionType={sectionType}
    onTextChange={onTextChange}
    marks={marks}
    marksFontSize={marksFontSize}
  />
  {question.diagram && (
    <DiagramView
      diagram={question.diagram}
      className="question-diagram"
      style={{
        ...scaleDiagramSize(fontSize, 280, 220),
        display: 'block',
        // Same fix as MCQRenderer: a bilingual row is LTR-anchored with
        // English/Urdu side by side, so a plain block-level diagram defaults
        // flush-left under the English column only. Centering makes it read
        // as shared by both.
        margin: isUrdu && isEnglish ? '0 auto' : 0,
        padding: 0,
      }}
    />
  )}
  {!!answerLines && answerLines > 0 && (
    <div className="answer-lines" aria-hidden="true" style={{ marginTop: '2mm' }}>
      {Array.from({ length: answerLines }).map((_, i) => (
        <div key={i} style={{ height: `${answerLineGapMm ?? 6}mm`, borderBottom: '0.3mm solid #94a3b8' }} />
      ))}
    </div>
  )}
  </>
);
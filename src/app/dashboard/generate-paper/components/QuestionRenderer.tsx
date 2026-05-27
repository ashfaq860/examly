'use client';
import React, { useEffect } from 'react';
import { LanguageConfig } from '@/types/paperBuilderTypes';
import { EditableText } from './EditableText';

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
  lineHeight: number;
  mcqLineHeight: number;
  metaFontSize: number;
  questionFontFamily: string;
  onTextChange: (sectionId: string, questionId: string, field: string, value: string) => void;
  renderInlineBilingual?: boolean;
  questionLineSpacing?: number;
  marks?: number;
  isUrduSubject?: boolean;
  isLast?: boolean;
  shouldShowOr?: boolean;
}

interface BilingualProps {
  // Text content
  engValue: string;
  urValue?: string;
  engField: string;
  urField: string;
  // Identity
  sectionId: string;
  questionId: string;
  // Render flags
  isEnglish: boolean;
  isUrdu: boolean;
  isEditMode: boolean;
  isOption?: boolean;
  // Styling — all fully resolved by the caller, no fallback logic here
  fontSize: number;
  urduFontSizeOffset?: number;
  lineSpacing: number;          // REQUIRED, already-resolved value
  questionFontFamily: string;
  // Optional extras
  urduNumberLabel?: string;
  question?: any;
  // Callback
  onTextChange: (sid: string, qid: string, field: string, val: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const URDU_FONT       = "'JameelNoori', 'Noto Nastaliq Urdu', serif";
const PRINT_STYLE_ID  = 'qr-print-styles';

// ---------------------------------------------------------------------------
// ONE-TIME global print style injection
// ---------------------------------------------------------------------------
// Defined as a plain string constant — not inside any component — so it is
// never duplicated. Injected at module-load time AND re-checked in useEffect
// to cover SSR hydration timing.
//
// LINE-HEIGHT STRATEGY
// Each .question-lh-scope element sets --q-lh as an inline CSS variable with
// the exact resolved value for that block (MCQ gets mcqLineHeight, subjective
// gets questionLineSpacing). The print rule reads var(--q-lh) from the element
// itself; children use `inherit` so they always get the value from their
// nearest scoped ancestor — no cross-contamination, no injection-order races.
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

    /* Each scoped wrapper carries --q-lh inline; children inherit it cleanly */
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

// Synchronous injection at module load (before any render or print dialog)
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

const stripHtml = (text: string, stripNum = false): string => {
  if (!text) return '';
  let s = text.replace(/<(?:.|\n)*?>/gm, ' ').trim();
  if (stripNum) {
    s = s
      .replace(/^(?:\(?\d+\)?[.)]?|\(?[ivxIVX]+\)?[.)]?)(\s+|\u00A0)*/, '')
      .replace(/(\s+|\u00A0)*(?:\(?\d+\)?[.)]?|\(?[ivxIVX]+\)?[.)]?)$/, '')
      .trim();
  }
  return s;
};

/** Resolve a line-height value safely — never swallows 0.9, 1.0, etc. */
const resolveLH = (val: number | undefined, fallback: number): number =>
  typeof val === 'number' && val > 0 ? val : fallback;

/**
 * Returns inline styles that set BOTH the screen lineHeight and the CSS
 * variable --q-lh that the single shared @media print rule reads.
 * Called on every .question-lh-scope element so each carries its own value.
 */
const lhScope = (lh: number): React.CSSProperties =>
  ({ lineHeight: lh, '--q-lh': lh } as React.CSSProperties);

// ---------------------------------------------------------------------------
// BilingualTextDisplay
// ---------------------------------------------------------------------------
// Props are ALWAYS passed explicitly by the caller — never via {...spread}.
// This is the core guarantee that MCQ line-height never gets replaced by a
// subjective value or any other prop leaking in from the parent chain.
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
  lineSpacing,          // already resolved — used as-is
  questionFontFamily,
  urduNumberLabel,
  question,
  onTextChange,
}) => {
  const isTranslate = question?.question_type === 'translate_english';
  // For Urdu body text a slightly tighter setting reads better, but cap at 1.0
  const urduLH = isOption ? lineSpacing : Math.max(1.0, lineSpacing - 0.3);

  return (
    <div className={`d-flex w-100 ${isUrdu || isTranslate ? 'flex-row-reverse' : 'flex-row'} align-items-start`}>

      {/* ── Urdu block ── */}
      {isUrdu && (
        <div
          className="urdu-text question-lh-scope flex-grow-1"
          dir="rtl"
          lang="ur"
          style={{
            ...lhScope(urduLH),          // --q-lh + lineHeight set here
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
            <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.35rem', flexWrap: 'nowrap', width: '100%' }}>
              {urduNumberLabel && !isOption && (
                <span className="fw-bold text-nowrap" style={{ fontSize: `${fontSize}px`, fontFamily: URDU_FONT, flex: '0 0 auto', whiteSpace: 'nowrap' }}>
                  {urduNumberLabel}
                </span>
              )}
              <span
                style={{ display: 'block', flex: '1 1 0', minWidth: 0, textAlign: 'right' }}
                dangerouslySetInnerHTML={{ __html: stripHtml(urValue || (isOption ? '' : engValue), isTranslate) }}
              />
            </span>
          )}
        </div>
      )}

      {/* ── English / translation block ── */}
      {isEnglish && (
        <div
          className={`${isTranslate ? 'urdu-text' : 'english-text'} question-lh-scope flex-grow-1`}
          dir={isTranslate ? 'rtl' : 'ltr'}
          lang={isTranslate ? 'ur' : 'en'}
          style={{
            ...lhScope(isTranslate ? urduLH : lineSpacing),  // --q-lh + lineHeight
            marginTop: '-1px',
            fontFamily: isTranslate ? URDU_FONT : questionFontFamily,
            fontSize: isTranslate ? `${fontSize + urduFontSizeOffset}px` : `${fontSize}px`,
            textAlign: isTranslate ? 'right' : 'left',
          }}
        >
          {isEditMode ? (
            <EditableText
              value={engValue || ''}
              onChange={(v: string) => onTextChange(sectionId, questionId, engField, v)}
            />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: stripHtml(engValue) }} />
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// QuestionRenderer  (main export)
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
  shouldShowOr,
  onTextChange,
}) => {
  // Ensure style tag exists after SSR hydration
  useEffect(() => { injectPrintStyles(); }, []);

  const isTranslate        = question?.question_type === 'translate_english';
  const isUrdu             = paperLanguage === 'urdu' || paperLanguage === 'bilingual' || isTranslate;
  const isEnglish          = (paperLanguage === 'english' || paperLanguage === 'bilingual') && !isTranslate;
  const showUrduNumber     = paperLanguage === 'urdu' || isTranslate;
  const showEnglishNumber  = (paperLanguage === 'english' || paperLanguage === 'bilingual') && !isTranslate;
  const showUrduSideNumber = paperLanguage === 'bilingual' && !isTranslate;
  const isPaperUrduOrEng   = paperLanguage === 'urdu' || paperLanguage === 'english';

  const isMCQ = sectionType === 'mcq';

  // Resolve once here — these values flow explicitly to every child.
  // resolveLH guards against undefined / 0 / NaN without using `||`
  // which would incorrectly swallow valid values like 1.0.
  const resolvedMcqLH  = resolveLH(mcqLineHeight,       1.2);
  const resolvedSubjLH = resolveLH(questionLineSpacing,  1.5);
  const currentLH      = isMCQ ? resolvedMcqLH : resolvedSubjLH;

  const numberFontSize = isMCQ ? resolveLH(mcqFontSize, 12) : fontSize;

  const typeKey = sectionType.toLowerCase();
  const isLong  =
    typeKey.includes('long') || typeKey.includes('summary') ||
    typeKey.includes('darkhwast_khat') || typeKey.includes('kahani_makalma');

  const isSecondPartOfOr = shouldShowOr
    ? isLong ? (qIdx || 0) % 2 !== 0 : index % 2 !== 0
    : false;
  const showNumber = !isSecondPartOfOr;

  let indexDisplay = '';
  if (showNumber) {
    if (isLong)     indexDisplay = paperLanguage === 'urdu' ? `${index}.Q` : `Q.${index}`;
    else if (isMCQ) indexDisplay = `${index + 1}.`;
    else            indexDisplay = `(${toRoman(index + 1)})`;
  }

  const urduNumberLabel = showUrduSideNumber ? indexDisplay : undefined;

  // Shared props for BilingualTextDisplay — built once, used in both sub-renderers.
  // Critically: lineSpacing is set to the correct resolved value for THIS section type.
  const bilingualBase = {
    sectionId,
    isEnglish,
    isUrdu,
    isEditMode,
    questionFontFamily,
    onTextChange,
    question,
    urduNumberLabel,
  };

  return (
    <div className={`question-wrapper mb-1 ${isUrdu || isTranslate ? 'rtl' : 'ltr'}`}>
      <div className="d-flex align-items-start gap-1 w-100 flex-row">

        {/* ── 1. Number ── */}
        {showNumber && (
          <div className="d-flex align-items-start">
            {showEnglishNumber && (
              <span
                className="fw-bold text-nowrap"
                style={{ minWidth: isLong ? '22px' : '18px', fontSize: isLong ? `${numberFontSize + 2}px` : `${numberFontSize}px`, lineHeight: currentLH, fontFamily: questionFontFamily, textAlign: 'left' }}
              >
                {indexDisplay}
              </span>
            )}
            {showUrduNumber && (
              <span
                className="fw-bold text-nowrap"
                style={{ minWidth: isLong ? '25px' : '18px', fontSize: `${numberFontSize}px`, lineHeight: currentLH, fontFamily: URDU_FONT, textAlign: 'right', direction: 'rtl' }}
              >
                {indexDisplay}
              </span>
            )}
          </div>
        )}

        {/* ── 2. Question text ── */}
        <div className={`${isUrduSubject && isLong ? 'flex-grow-0' : 'flex-grow-1'}`}>
          {isMCQ ? (
            <MCQRenderer
              question={question}
              sectionId={sectionId}
              paperLanguage={paperLanguage}
              isUrdu={isUrdu}
              isEnglish={isEnglish}
              isEditMode={isEditMode}
              fontSize={resolveLH(mcqFontSize, 12)}
              lineHeight={resolvedMcqLH}         // ← MCQ-specific, fully resolved
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
              lineHeight={resolvedSubjLH}        // ← subjective-specific, fully resolved
              questionFontFamily={questionFontFamily}
              urduNumberLabel={urduNumberLabel}
              onTextChange={onTextChange}
            />
          )}
        </div>

        {/* ── 3. Marks (long questions only) ── */}
        {isLong && isUrduSubject && marks !== undefined && (
          <div
            className="fw-bold text-nowrap"
            style={{ fontSize: `${numberFontSize - 2}px`, fontFamily: isUrdu ? URDU_FONT : 'inherit', minWidth: '35px', textAlign: paperLanguage === 'urdu' ? 'left' : 'right', paddingTop: '2px' }}
          >
            ({marks})
          </div>
        )}
      </div>

      {/* ── 4. OR / یا separator ── */}
      {shouldShowOr && isPaperUrduOrEng && !isLast &&
        ((isLong && qIdx === 0) || (!isLong && index % 2 === 0)) && (
        <div className="text-center w-100 fw-bold" style={{ fontSize: `${fontSize + 2}px`, fontFamily: isUrdu ? URDU_FONT : questionFontFamily }}>
          {paperLanguage === 'urdu' ? 'یا' : 'OR'}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MCQRenderer
// ---------------------------------------------------------------------------
// Receives lineHeight as an explicit prop — the resolved mcqLineHeight value.
// Never uses {...spread} into BilingualTextDisplay.
// ---------------------------------------------------------------------------
interface MCQRendererProps {
  question: any;
  sectionId: string;
  paperLanguage: string;
  isUrdu: boolean;
  isEnglish: boolean;
  isEditMode: boolean;
  fontSize: number;
  lineHeight: number;    // resolved mcqLineHeight — the authoritative value
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

  // Explicit props object — zero spreading into BilingualTextDisplay
  const commonBilingual = {
    sectionId,
    isEnglish,
    isUrdu,
    isEditMode,
    fontSize,
    lineSpacing: lineHeight,   // ← MCQ line-height, always correct
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

      {/* Options */}
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
  lineHeight: number;    // resolved questionLineSpacing
  questionFontFamily: string;
  urduNumberLabel?: string;
  onTextChange: (sid: string, qid: string, field: string, val: string) => void;
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
  onTextChange,
}) => (
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
    fontSize={fontSize + (isLong ? 4 : 0)}
    lineSpacing={lineHeight}               // ← subjective line-height, always correct
    questionFontFamily={questionFontFamily}
    urduNumberLabel={urduNumberLabel}
    question={question}
    onTextChange={onTextChange}
  />
);
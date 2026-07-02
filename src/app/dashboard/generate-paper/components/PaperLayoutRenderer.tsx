//dashboard/generate-paper/components/PaperLayoutRenderer.tsx
'use client';
import React, { useMemo, useEffect } from 'react';
import { PaperSection, PaperSettings, LanguageConfig } from '@/types/paper-builder';
import { PaperHeader } from './PaperHeader';
import { SectionHeader } from './SectionHeader';
import { QuestionRenderer } from './QuestionRenderer';
import { toast } from 'react-hot-toast';
import { getBucket, FOUR_PAPERS_SHORT_CAP, FOUR_PAPERS_LONG_CAP } from '@/lib/paperQuestionBuckets';

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
}

const URDU_FONT = "'JameelNoori', 'Noto Nastaliq Urdu', serif";

const stripHtml = (text: string): string => {
  if (!text) return '';
  let s = text.replace(/<\/?[^>]+(>|$)/g, ' ').trim();
  s = s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  s = s.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
  s = s.replace(/\\\\\s*\(/g, '\\(').replace(/\\\\\s*\)/g, '\\)');
  return s;
};

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

  const sheetBaseStyle: React.CSSProperties = {
    width: '210mm', height: '297mm', padding: '4mm',
    backgroundColor: 'white', margin: '0 auto',
    position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    color: 'black', fontFamily: settings.fontFamily,
    boxSizing: 'border-box', border: 'none', outline: 'none', boxShadow: 'none',
  };

  const SectionBlock = ({ section }: { section: PaperSection }) => {
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
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => onTextChange(section.id, q.id, 'question_text', e.currentTarget.textContent || '')}
                              >
                                {stripHtml(q.question_text || q.question || '')}
                              </span>
                            ) : (
                              stripHtml(q.question_text || q.question || '')
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
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => onTextChange(section.id, q.id, 'question_text_ur', e.currentTarget.textContent || '')}
                              >
                                {stripHtml(q.question_text_ur || '')}
                              </span>
                            ) : (
                              stripHtml(q.question_text_ur || '')
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
                            <span
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={e => onTextChange(section.id, q.id, 'question_text_ur', e.currentTarget.textContent || '')}
                            >
                              {stripHtml(q.question_text_ur || q.question_text || '')}
                            </span>
                          ) : (
                            stripHtml(q.question_text_ur || q.question_text || '')
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
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => onTextChange(section.id, q.id, 'question_text', e.currentTarget.textContent || '')}
                          >
                            {stripHtml(q.question_text || q.question || '')}
                          </span>
                        ) : (
                          stripHtml(q.question_text || q.question || '')
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
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e =>
                            onTextChange(section.id, q.id, 'question_text', e.currentTarget.textContent || '')
                          }
                        >
                          {stripHtml(q.question_text || q.question || '')}
                        </span>
                      ) : (
                        stripHtml(q.question_text || q.question || '')
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
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e =>
                            onTextChange(section.id, q.id, 'question_text_ur', e.currentTarget.textContent || '')
                          }
                        >
                          {stripHtml(q.question_text_ur || '')}
                        </span>
                      ) : (
                        stripHtml(q.question_text_ur || '')
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
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e =>
                          onTextChange(section.id, q.id, 'question_text_ur', e.currentTarget.textContent || '')
                        }
                      >
                        {stripHtml(q.question_text_ur || q.question_text || '')}
                      </span>
                    ) : (
                      stripHtml(q.question_text_ur || q.question_text || '')
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
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={e =>
                        onTextChange(section.id, q.id, 'question_text', e.currentTarget.textContent || '')
                      }
                    >
                      {stripHtml(q.question_text || q.question || '')}
                    </span>
                  ) : (
                    stripHtml(q.question_text || q.question || '')
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
            <div key={`${q.id}-${baseOffset}-${qIdx}`} className={`${getDynamicColClass(q)} px-2 mt-1`}>
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
          border:        isEditMode ? '2px dashed #ccc' : 'none',
          marginTop:     isSecondPartOfPair ? '5px' : '5px',
          marginBottom:  '0px',
          width:         '100%',
        }}
      >
        {isFirstPartOfPair && (
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
        )}

        {!hideHeader && !isPairedLong &&  (
          <div
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
          //renderQuestionsList(questions, 0)
           renderQuestionsList(questions, 0, suppressNumberingSection || isSingleTranslateSection)
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

    const renderPaperGroup = (
      group: PaperSection[],
      marks: number,
      keyPrefix: string,
      _mini = false,
      part: 'mcq' | 'subjective' | 'combined' = 'combined'
    ) => {
      if (group.length === 0) return null;
      return (
        <div key={keyPrefix} className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
          <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <PaperHeader
              totalMarks={marks} subject={subject} paperSections={group}
              isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage}
              config={config} currentLayout={currentLayout} currentClass={currentClass}
              profile={profile} paperPart={part} subjectUrduName={subjectUrduName}
            />
            {group.map(s => <SectionBlock key={s.id} section={s} />)}
          </div>
        </div>
      );
    };

    if (['same', 'same_page', 'combined'].includes(currentLayout)) {
      pages.push(renderPaperGroup(
        [...mcqs, ...subjectives], mcqTotalMarks + subTotalMarks, 'same-paper'
      ));
    }
    else if (currentLayout === 'separate') {
      if (mcqs.length       > 0) pages.push(renderPaperGroup(mcqs,       mcqTotalMarks, 'mcq-separate', false, 'mcq'));
      if (subjectives.length > 0) pages.push(renderPaperGroup(subjectives, subTotalMarks, 'sub-separate', false, 'subjective'));
    }
    else if (['two_papers', 'two_paper', 'three_papers', 'three_paper'].includes(currentLayout)) {
      const count      = currentLayout.startsWith('two') ? 2 : 3;
      const slotHeight = count === 2 ? '142mm' : '93mm'; // 3×93+2×3=285mm < 289mm content area
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
      const slotHeight = '70mm'; // 4×70 + 3×~3mm dashes = ~289mm = fits within 289mm content area
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
    <div className="paper-builder-renderer bg-secondary-subtle">
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
          @page { size: A4 portrait; margin: 0mm; }

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

          /* ── Paper sheet: block so overflow:hidden clips correctly in print ── */
          .paper-sheet {
            display: block !important;
            margin: 0 !important; border: 0 !important;
            box-shadow: none !important; outline: 0 !important;
            page-break-after: always !important; break-after: page !important;
            page-break-inside: avoid !important; break-inside: avoid !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container > .paper-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .section-block { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>
      {renderContent()}
    </div>
  );
};
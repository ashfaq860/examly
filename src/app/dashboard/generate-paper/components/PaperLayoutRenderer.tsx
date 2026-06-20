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
  paperPart: any;
}

const Watermark = ({
  isPremium,
  logoUrl,
  settings,
  scale = 1,
  top = '50%'
}: { isPremium: boolean; logoUrl?: string; settings: PaperSettings; scale?: number; top?: string }) => {
  if (!settings.showWatermark) return null;
  const watermarkImg = isPremium && logoUrl ? logoUrl : '/examly.png';
  const width = (settings.watermarkWidth || 400) * scale;
  const height = (settings.watermarkHeight || 400) * scale;
  const opacity = settings.watermarkOpacity || 0.1;

  return (
    <div
      style={{
        position: 'absolute',
        top: top,
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-30deg)',
        zIndex: 10,
        pointerEvents: 'none',
        opacity,
        width: `${width}px`,
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
        overflow: 'visible',
      }}
    >
      <img src={watermarkImg} alt="watermark" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
};

// ── PAIR ORDERING ──────────────────────────────────────────────────
// poetry_explanation ("حصہ نظم") and gazal ("حصہ غزل") are always meant
// to be explained together as one combined question (see SectionBlock's
// isFirstPartOfPair/isSecondPartOfPair + combinedPoetryInstruction).
// That pairing logic only works if gazal is the very next section after
// its poetry_explanation partner in the array every renderer reads from.
//
// Authors can add these two sections in any order in the builder UI, so
// we cannot assume the incoming `paperSections` already satisfies that
// adjacency. reorderPoetryGazalPairs() normalizes the array ONCE, before
// any layout branch (same/separate/two/three/four papers) consumes it:
//   - poetry_explanation always comes first
//   - its matching gazal section is moved to sit immediately after it
//   - all other sections keep their relative order untouched
//
// The same normalization is reused for sentence_correction /
// sentence_completion since they follow the identical pairing pattern
// (see isSecondPartOfPair / isFirstPartOfPair below).
const reorderPoetryGazalPairs = (sections: PaperSection[]): PaperSection[] => {
  if (!Array.isArray(sections) || sections.length < 2) return sections;

  const isType = (s: PaperSection, needle: string) => s.type.toLowerCase().includes(needle);

  const poetryIdx = sections.findIndex(s => isType(s, 'poetry_explanation'));
  const gazalIdx = sections.findIndex(s => isType(s, 'gazal'));
  const correctionIdx = sections.findIndex(s => isType(s, 'sentence_correction'));
  const completionIdx = sections.findIndex(s => isType(s, 'sentence_completion'));

  // Nothing to pair — return as-is (avoids unnecessary array churn / re-renders).
  const needsPoetryFix = poetryIdx !== -1 && gazalIdx !== -1 && gazalIdx !== poetryIdx + 1;
  const needsCorrectionFix = correctionIdx !== -1 && completionIdx !== -1 && completionIdx !== correctionIdx + 1;
  if (!needsPoetryFix && !needsCorrectionFix) return sections;

  let result = [...sections];

  const movePairAdjacent = (firstIdx: number, secondIdx: number) => {
    if (firstIdx === -1 || secondIdx === -1) return;
    const current = result;
    const fIdx = current.findIndex(s => s.id === sections[firstIdx].id);
    const sIdx = current.findIndex(s => s.id === sections[secondIdx].id);
    if (fIdx === -1 || sIdx === -1 || sIdx === fIdx + 1) return;

    const without = current.filter((_, i) => i !== sIdx);
    const newFIdx = without.findIndex(s => s.id === sections[firstIdx].id);
    const second = current[sIdx];
    result = [
      ...without.slice(0, newFIdx + 1),
      second,
      ...without.slice(newFIdx + 1),
    ];
  };

  movePairAdjacent(poetryIdx, gazalIdx);
  movePairAdjacent(correctionIdx, completionIdx);

  return result;
};

export const PaperLayoutRenderer: React.FC<Props> = ({
  paperSections: rawPaperSections = [],
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
  subjectUrduName
}) => {
  // ── ALL HOOKS MUST RUN UNCONDITIONALLY, EVERY RENDER ──
  // The early "if (!settings) return ..." guard lives AFTER every hook
  // call below. Putting it above any hook would change the number of
  // hooks React sees between the "settings not loaded yet" render and
  // the "settings loaded" render, which breaks React's hook-order rule
  // and produces "cannot access before initialization" style errors.

  // Normalize ordering ONCE so poetry_explanation→gazal (and
  // sentence_correction→sentence_completion) are always adjacent,
  // regardless of how they were added in the builder UI. Every layout
  // branch below (same / separate / two / three / four papers) reads
  // from this corrected array instead of the raw prop.
  const paperSections = useMemo(
    () => reorderPoetryGazalPairs(rawPaperSections),
    [rawPaperSections]
  );

  const subject = useMemo(() => paperSections[0]?.subject || '', [paperSections]);

  const isOverflowLocked = ['same', 'same_page', 'combined', 'separate'].includes(currentLayout);

  const globalNumbering = useMemo(() => {
    const sectionStartNumbers: Record<string, number> = {};
    let currentCount = 1;

    paperSections.forEach((section, index) => {
      const sectionType = section.type.toLowerCase();
      const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';

      const prevSection = index > 0 ? paperSections[index - 1] : null;
      const prevType = prevSection?.type.toLowerCase() || '';

      const isSecondPartOfPair =
        (sectionType.includes('gazal') && prevType.includes('poetry_explanation')) ||
        (sectionType.includes('sentence_completion') && prevType.includes('sentence_correction'));

      if (isSecondPartOfPair) {
        sectionStartNumbers[section.id] = currentCount - 1;
      } else {
        sectionStartNumbers[section.id] = currentCount;

        const isLong = sectionType.includes('long') || sectionType.includes('summary') || sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');

        if (isLong) {
          if (isUrduOrEnglish) {
            currentCount += 1;
          } else {
            const qCount = Array.isArray(section.questions) ? section.questions.length : 0;
            currentCount += qCount;
          }
        } else {
          currentCount += 1;
        }
      }
    });

    return sectionStartNumbers;
  }, [paperSections, subject]);

  const { mcqs, subjectives } = useMemo(() => ({
    mcqs: paperSections.filter(s => s.type === 'mcq'),
    subjectives: paperSections.filter(s => s.type !== 'mcq')
  }), [paperSections]);

  // ── FOUR PAPERS LAYOUT ──
  // Bucket REAL sections (not flattened questions) into short-side /
  // long-side groups using getBucket(), then trim by question COUNT
  // down to the layout caps — but keep each section's own `type`,
  // `instructions`, and `marksEach` intact. This is what lets
  // SectionHeader render the correct type-specific instruction text
  // (e.g. "Explain the following verses..." for poetry_explanation)
  // instead of a generic "Write Short Answers..." placeholder that
  // would show up if we relabeled everything as type:'short'/'long'.
  //
  // poetry_explanation and gazal are both SHORT_BUCKET_TYPES (see
  // paperQuestionBuckets.ts), so they always land in the same bucket
  // together and — because `paperSections` is already pair-ordered
  // above — stay adjacent through this filter. trimToCap() walks
  // sections in array order, so as long as the combined short-bucket
  // cap (FOUR_PAPERS_SHORT_CAP) isn't exhausted mid-pair, both halves
  // survive together. If the cap genuinely lands between them, the
  // existing shortOverflow toast already warns the user that
  // something was trimmed.
  const { fourPaperShortSections, fourPaperLongSections, shortOverflow, longOverflow } = useMemo(() => {
    if (currentLayout !== 'four_papers') {
      return { fourPaperShortSections: [] as PaperSection[], fourPaperLongSections: [] as PaperSection[], shortOverflow: false, longOverflow: false };
    }

    const shortSections = paperSections.filter(s => getBucket(s.type) === 'short');
    const longSections = paperSections.filter(s => getBucket(s.type) === 'long');

    const totalShortQs = shortSections.reduce((sum, s) => sum + (s.questions?.length || 0), 0);
    const totalLongQs = longSections.reduce((sum, s) => sum + (s.questions?.length || 0), 0);

    // Trim a list of sections down to `cap` total questions, preserving
    // each section's identity. Only the LAST section that crosses the
    // cap boundary gets its question list truncated; earlier sections
    // are untouched.
    const trimToCap = (sections: PaperSection[], cap: number): PaperSection[] => {
      const result: PaperSection[] = [];
      let remaining = cap;
      for (const s of sections) {
        if (remaining <= 0) break;
        const qs = s.questions || [];
        if (qs.length <= remaining) {
          result.push(s);
          remaining -= qs.length;
        } else {
          const keptCount = remaining;
          result.push({
            ...s,
            questions: qs.slice(0, keptCount),
            totalQuestions: keptCount,
            attemptCount: Math.min(s.attemptCount, keptCount),
            totalMarks: Math.min(s.attemptCount, keptCount) * (s.marksEach || 1),
          });
          remaining = 0;
        }
      }
      return result;
    };

    return {
      fourPaperShortSections: trimToCap(shortSections, FOUR_PAPERS_SHORT_CAP),
      fourPaperLongSections: trimToCap(longSections, FOUR_PAPERS_LONG_CAP),
      shortOverflow: totalShortQs > FOUR_PAPERS_SHORT_CAP,
      longOverflow: totalLongQs > FOUR_PAPERS_LONG_CAP,
    };
  }, [paperSections, currentLayout]);

  const mcqTotalMarks = useMemo(() => mcqs.reduce((t, s) => t + s.totalMarks, 0), [mcqs]);
  const subTotalMarks = useMemo(() => subjectives.reduce((t, s) => t + s.totalMarks, 0), [subjectives]);

  const fourPaperShortTotalMarks = useMemo(
    () => fourPaperShortSections.reduce((t, s) => t + s.totalMarks, 0),
    [fourPaperShortSections]
  );
  const fourPaperLongTotalMarks = useMemo(
    () => fourPaperLongSections.reduce((t, s) => t + s.totalMarks, 0),
    [fourPaperLongSections]
  );

  const isSubjectUrduEnglish = useMemo(() =>
    subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english',
    [subject]
  );

  useEffect(() => {
    if (currentLayout !== 'four_papers') return;
    if (shortOverflow) {
      toast.error(`4-papers layout allows max ${FOUR_PAPERS_SHORT_CAP} short-type questions — extra questions were hidden.`);
    }
    if (longOverflow) {
      toast.error(`4-papers layout allows max ${FOUR_PAPERS_LONG_CAP} long-type questions — extra questions were hidden.`);
    }
  }, [currentLayout, shortOverflow, longOverflow]);

  // ── EARLY RETURN — safely placed AFTER every hook above ──
  if (!settings) return <div className="p-5 text-center">Loading settings...</div>;

  const handleHeaderChange = (sectionId: string, field: 'en' | 'ur', value: string) => {
    const updated = paperSections.map(s => {
      if (s.id === sectionId) return { ...s, [field === 'en' ? 'customEnHeader' : 'customUrHeader']: value };
      return s;
    });
    onSectionUpdate(updated);
  };

  const sheetBaseStyle: React.CSSProperties = {
    width: '210mm',
    height: '297mm',
    padding: '4mm',
    backgroundColor: 'white',
    margin: '0 auto',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    color: 'black',
    fontFamily: settings.fontFamily,
    boxSizing: 'border-box',
    border: 'none',
    outline: 'none',
    boxShadow: 'none'
  };

  /**
   * Helper to calculate global question index.
   * If section is 'long', it starts the index from the section number (globalIndex).
   */
  const getQuestionStartIndex = (section: PaperSection, globalSectionIndex: number) => {
    if (section.type === 'long') {
      return globalSectionIndex;
    }
    let count = 0;
    for (let i = 0; i < globalSectionIndex; i++) {
      const s = paperSections[i];
      count += s.questions?.length || 0;
    }
    return 0;
  };

  const SectionBlock = ({ section }: { section: PaperSection }) => {
    if (!section) return null;
    const questions = Array.isArray(section.questions) ? section.questions : [];
    const sectionType = section.type.toLowerCase();
    const startNum = globalNumbering[section.id] || 1;
    const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';

    const sectionIndexInArray = paperSections.findIndex(s => s.id === section.id);
    const prevSection = sectionIndexInArray > 0 ? paperSections[sectionIndexInArray - 1] : null;
    const nextSection = paperSections[sectionIndexInArray + 1];

    const isPoetry = sectionType.includes('poetry_explanation');
    const isGazal = sectionType.includes('gazal');
    const isCorrection = sectionType.includes('sentence_correction');
    const isCompletion = sectionType.includes('sentence_completion');

    const isSecondPartOfPair =
      (isGazal && prevSection?.type.toLowerCase().includes('poetry')) ||
      (isCompletion && prevSection?.type.toLowerCase().includes('sentence_correction'));

    const isFirstPartOfPair =
      (isPoetry && nextSection?.type.toLowerCase().includes('gazal')) ||
      (isCorrection && nextSection?.type.toLowerCase().includes('sentence_completion'));

    const nazamAttempt = section.attemptCount || 0;
    const gazalAttempt = nextSection?.attemptCount || 0;

    const combinedPoetryInstruction = `درج زیل نظم وغزل کے اشعار کی تشریح کیجئے۔ (حصہ نظم سے ${nazamAttempt} اور حصہ غزل سے ${gazalAttempt} اشعار منتخب کیجئے)`;

    const totalAttempt = (section.attemptCount || 0) + (nextSection?.attemptCount || 0);
    const marksEach = section.marksEach || 1;
    const totalMarksPair = totalAttempt * marksEach;
    const combinedCorrectCompleteInstruction = `درج ذیل میں سے کوئی سے ${totalAttempt} اجزاء کی درستگی/تکمیل کیجئے۔ (${marksEach}x${totalAttempt}=${totalMarksPair})`;
    let finalAttemptCount = section.attemptCount;
    let finalTotalMarks = section.totalMarks;

    if (isFirstPartOfPair && nextSection) {
      finalAttemptCount = section.attemptCount + (nextSection.attemptCount || 0);
      finalTotalMarks = section.totalMarks + (nextSection.totalMarks || 0);
    } else if (isSecondPartOfPair) {
      finalAttemptCount = 0;
      finalTotalMarks = 0;
    }

    const subHeaderFontSize = settings.headingFontSize - 2;

    const getQuestionDisplayIndex = (localIdx: number) => {
      if (isSecondPartOfPair && prevSection) {
        return (prevSection.questions?.length || 0) + localIdx;
      }
      return localIdx;
    };

    const getDynamicColClass = (q: any) => {
      if (section.type === 'mcq' || section.type === 'long' || section.type === 'summary' || (section.type === 'short' && subject.toLowerCase() !== 'urdu') || sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma')) return 'col-12';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6';
      // Poetry/gazal verses always render one-per-row, full width,
      // numbered straight down (i, ii, iii, ...) — matching board-exam
      // typography. They must NOT fall through to the variable-width
      // text-length branch below, which previously caused random
      // col-3/col-4/col-6/col-12 sizing per verse and visible
      // overlap/spacing inconsistencies between English and Urdu runs.
      if (isPoetry || isGazal) return 'col-6';
      const engText = q.question_text || q.question || '';
      const urText = q.question_text_ur || '';
      const totalVisualLength = engText.length + (urText.length * 1.5);
      return totalVisualLength < 50 ? 'col-3' : totalVisualLength < 60 ? 'col-4' : totalVisualLength < 110 ? 'col-6 ' : 'col-12';
    };

    const isLongType = sectionType.includes('long') || sectionType.includes('summary') || sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');
    const isSingleAttemptLong = isLongType && (section.totalQuestions <= 2 && section.attemptCount === 1);
    const hideHeader = isUrduOrEnglish && isSingleAttemptLong && !isPoetry && !isGazal && !isCorrection && isCompletion;

    return (
      <div
        className="section-block"
        style={{
          border: isEditMode ? "2px dashed #ccc" : "none",
          marginBottom: isFirstPartOfPair ? '0px' : '0px',
          marginTop: isSecondPartOfPair ? '5px' : '5px',
          width: '100%'
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
            customEnHeader={section.customEnHeader}
            onHeaderChange={handleHeaderChange}
            isEditMode={isEditMode}
          />
        )}

        {!hideHeader && (
          <div
            className="sub-section-title px-0"
            style={{
              textAlign: 'right',
              direction: 'rtl',
              fontWeight: 'bold',
              fontSize: `${subHeaderFontSize}px`,
              fontFamily: "'JameelNoori', serif",
              marginTop: isFirstPartOfPair ? '0px' : '0px',
              marginBottom: isFirstPartOfPair ? '4px' : '4px'
            }}
          >
            {isPoetry ? 'حصہ نظم:' : isGazal ? 'حصہ غزل:' : ''}

            {!isPoetry && !isGazal && !isFirstPartOfPair && !isSecondPartOfPair && (!isLongType || !isUrduOrEnglish) && (
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
                customEnHeader={section.customEnHeader}
                customUrHeader={section.customUrHeader}
                onHeaderChange={handleHeaderChange}
                isEditMode={isEditMode}
              />
            )}
          </div>
        )}

        <div className="questions-list row g-2 mx-0" style={{ direction: sectionType === 'translate_english' ? 'rtl' : '' }}>
          {questions.map((q, qIdx) => {
            const finalIndex = isLongType ? (paperLanguage === 'urdu' ? startNum : startNum + qIdx) : getQuestionDisplayIndex(qIdx);
            return (
              <div key={`${q.id}-${qIdx}`} className={`${getDynamicColClass(q)} px-2  mt-1`}>
                <QuestionRenderer
                  question={q}
                  index={finalIndex}
                  qIdx={qIdx}
                  sectionType={section.type}
                  sectionId={section.id}
                  paperLanguage={paperLanguage}
                  isEditMode={isEditMode}
                  config={config}
                  fontSize={settings.fontSize}
                  metaFontSize={settings.metaFontSize}
                  questionFontFamily={settings.fontFamily}
                  questionLineSpacing={settings.lineHeight}
                  mcqFontSize={settings.mcqFontSize}
                  mcqLineHeight={settings.mcqLineHeight}
                  onTextChange={onTextChange}
                  marks={q.marks || section.marksEach}
                  isUrduSubject={isUrduOrEnglish}
                  isLast={qIdx === questions.length - 1}
                  headingFontSize={settings.headingFontSize}
                  shouldShowOr={isLongType && isUrduOrEnglish && section.totalQuestions === 2 && section.attemptCount === 1}
                  renderInlineBilingual={renderInlineBilingual}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
            paddingBottom: '10px',
            fontWeight: 'bold'
          }}>
            MCQ Answer Keys -For Class: {currentClass?.name || currentClass} ({subject})
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
      style={{
        borderStyle: 'dashed',
        borderWidth: '2px',
        height: '1px'
      }}
    >
      <span
        className="position-absolute bg-white px-0 fw-bold"
        style={{
          fontSize: '12px',
          top: '-10px',
          left: '0mm',
          zIndex: 1
        }}
      >
        ✂
      </span>
    </div>
  );

  const PaperSlot = ({
    height,
    children
  }: {
    height: string;
    children: React.ReactNode;
  }) => (
    <div
      style={{
        height,
        overflow: 'clip',
        position: 'relative'
      }}
    >
      {children}
    </div>
  );

  const renderContent = () => {
    let pages: React.ReactNode[] = [];

    const renderPaperGroup = (
      group: PaperSection[],
      marks: number,
      keyPrefix: string,
      mini = false,
      part: 'mcq' | 'subjective' | 'combined' = 'combined'
    ) => {
      if (group.length === 0) return null;

      return (
        <div
          key={keyPrefix}
          className="paper-sheet border shadow-sm print-break"
          style={sheetBaseStyle}
        >
          <Watermark
            isPremium={isPremium}
            logoUrl={profile?.logo}
            settings={settings}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1
            }}
          >
            <PaperHeader
              totalMarks={marks}
              subject={subject}
              paperSections={group}
              isEditMode={isEditMode}
              settings={settings}
              paperLanguage={paperLanguage}
              config={config}
              currentLayout={currentLayout}
              currentClass={currentClass}
              profile={profile}
              paperPart={part}
              subjectUrduName={subjectUrduName}
            />

            {group.map((s) => (
              <SectionBlock
                key={s.id}
                section={s}
              />
            ))}
          </div>
        </div>
      );
    };

    // =========================
    // SAME LAYOUT
    // =========================
    if (['same', 'same_page', 'combined'].includes(currentLayout)) {
      pages.push(
        renderPaperGroup(
          [...mcqs, ...subjectives],
          mcqTotalMarks + subTotalMarks,
          'same-paper'
        )
      );
    }

    // =========================
    // SEPARATE LAYOUT
    // =========================
    else if (currentLayout === 'separate') {
      if (mcqs.length > 0) {
        pages.push(
          renderPaperGroup(
            mcqs,
            mcqTotalMarks,
            'mcq-separate',
            false,
            'mcq'
          )
        );
      }

      if (subjectives.length > 0) {
        pages.push(
          renderPaperGroup(
            subjectives,
            subTotalMarks,
            'sub-separate',
            false,
            'subjective'
          )
        );
      }
    }

    // =========================
    // TWO / THREE PAPERS
    // =========================
    else if (
      ['two_papers', 'two_paper', 'three_papers', 'three_paper'].includes(
        currentLayout
      )
    ) {
      const count = currentLayout.startsWith('two') ? 2 : 3;
      const slotHeight =
        count === 2 ? '142mm' : '95mm';

      // MCQ PAGE
      if (mcqs.length > 0) {
        pages.push(
          <div
            key="mcq-mini-page"
            className="paper-sheet border shadow-sm print-break"
            style={sheetBaseStyle}
          >
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      padding: '0mm',
                      height: '100%'
                    }}
                  >
                    <Watermark
                      isPremium={isPremium}
                      logoUrl={profile?.logo}
                      settings={settings}
                      scale={currentLayout.startsWith('two') ? 0.7 : 0.5}
                      top="60%"
                    />
                    <PaperHeader
                      totalMarks={mcqTotalMarks}
                      subject={subject}
                      paperSections={mcqs}
                      isEditMode={isEditMode}
                      settings={{
                        ...settings,
                        fontSize: currentLayout.startsWith('three') ? settings.fontSize - 3 : settings.fontSize - 1
                      }}
                      paperLanguage={paperLanguage}
                      config={config}
                      currentLayout={currentLayout}
                      currentClass={currentClass}
                      profile={profile}
                      paperPart="mcq"
                    />

                    {mcqs.map((s) => (
                      <SectionBlock
                        key={`${i}-${s.id}`}
                        section={s}
                      />
                    ))}
                  </div>
                </PaperSlot>

                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );
      }

      // SUBJECTIVE PAGE
      if (subjectives.length > 0) {
        pages.push(
          <div
            key="subjective-mini-page"
            className="paper-sheet border shadow-sm print-break"
            style={sheetBaseStyle}
          >
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      padding: '0mm',
                      height: '100%'
                    }}
                  >
                    <Watermark
                      isPremium={isPremium}
                      logoUrl={profile?.logo}
                      settings={settings}
                      scale={currentLayout.startsWith('two') ? 0.7 : 0.5}
                      top="60%"
                    />
                    <PaperHeader
                      totalMarks={subTotalMarks}
                      subject={subject}
                      paperSections={subjectives}
                      isEditMode={isEditMode}
                      settings={{
                        ...settings,
                        fontSize: currentLayout.startsWith('three') ? settings.fontSize - 3 : settings.fontSize - 1
                      }}
                      paperLanguage={paperLanguage}
                      config={config}
                      currentLayout={currentLayout}
                      currentClass={currentClass}
                      profile={profile}
                      paperPart="subjective"
                    />

                    {subjectives.map((s) => (
                      <SectionBlock
                        key={`${i}-${s.id}`}
                        section={s}
                      />
                    ))}
                  </div>
                </PaperSlot>

                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );
      }
    }

    // =========================
    // FOUR PAPERS (Short front / Long back, 7 short max / 5 long max)
    // Renders the REAL sections (each keeping its own type, e.g.
    // poetry_explanation / gazal / idiom_phrases / translate_urdu),
    // not a single relabeled fake 'short'/'long' section. This is what
    // makes SectionHeader show the correct type-specific instruction
    // text for every question type instead of generic short/long text.
    // =========================
    else if (currentLayout === 'four_papers') {
      const count = 4;
      const slotHeight = '71mm';
      const fontShrink = 4;
      const watermarkScale = 0.4;

      // FRONT SIDE — Short-bucket sections
      if (fourPaperShortSections.length > 0) {
        pages.push(
          <div key="four-papers-short-page" className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <div style={{ position: 'relative', zIndex: 1, padding: '0mm', height: '100%' }}>
                    <Watermark
                      isPremium={isPremium}
                      logoUrl={profile?.logo}
                      settings={settings}
                      scale={watermarkScale}
                      top="60%"
                    />
                    <PaperHeader
                      totalMarks={fourPaperShortTotalMarks}
                      subject={subject}
                      paperSections={fourPaperShortSections}
                      isEditMode={isEditMode}
                      settings={{ ...settings, fontSize: settings.fontSize - fontShrink }}
                      paperLanguage={paperLanguage}
                      config={config}
                      currentLayout={currentLayout}
                      currentClass={currentClass}
                      profile={profile}
                      paperPart="subjective"
                      subjectUrduName={subjectUrduName}
                    />
                    {fourPaperShortSections.map((s) => (
                      <SectionBlock key={`${i}-${s.id}`} section={s} />
                    ))}
                  </div>
                </PaperSlot>
                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );
      }

      // BACK SIDE — Long-bucket sections
      if (fourPaperLongSections.length > 0) {
        pages.push(
          <div key="four-papers-long-page" className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <div style={{ position: 'relative', zIndex: 1, padding: '0mm', height: '100%' }}>
                    <Watermark
                      isPremium={isPremium}
                      logoUrl={profile?.logo}
                      settings={settings}
                      scale={watermarkScale}
                      top="60%"
                    />
                    <PaperHeader
                      totalMarks={fourPaperLongTotalMarks}
                      subject={subject}
                      paperSections={fourPaperLongSections}
                      isEditMode={isEditMode}
                      settings={{ ...settings, fontSize: settings.fontSize - fontShrink }}
                      paperLanguage={paperLanguage}
                      config={config}
                      currentLayout={currentLayout}
                      currentClass={currentClass}
                      profile={profile}
                      paperPart="subjective"
                      subjectUrduName={subjectUrduName}
                    />
                    {fourPaperLongSections.map((s) => (
                      <SectionBlock key={`${i}-${s.id}`} section={s} />
                    ))}
                  </div>
                </PaperSlot>
                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );
      }
    }

    // =========================
    // MCQ ANSWER KEYS
    // =========================
    pages.push(
      <MCQAnswerKeyPage key="mcq-keys" />
    );

    return (
      <div className="print-container">
        {pages}
      </div>
    );
  };

  return (
    <div className="paper-builder-renderer bg-secondary-subtle">
      <style>{`
        @media screen {
          .paper-sheet {
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            border: 1px solid #dee2e6;
            margin: 20px auto;
            background: white;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 0mm !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          main { margin: 0 !important; padding: 0 !important; }

          .paper-builder-renderer {
            padding: 0 !important;
            background: white !important;
          }

          .paper-sheet {
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            outline: 0 !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            height: 297mm !important;
            overflow: hidden !important;
          }

          .print-container > .paper-sheet:last-child {
            page-break-after: avoid !important;
          }

          .section-block {
            page-break-inside: avoid !important;
          }

          .no-print,
          nav,
          .sidebar,
          .page-border,
          .app-header,
          .appHeaderContent,
          header:not(.paper-header),
          .btn {
            display: none !important;
          }
        }
      `}</style>

      {renderContent()}
    </div>
  );
};
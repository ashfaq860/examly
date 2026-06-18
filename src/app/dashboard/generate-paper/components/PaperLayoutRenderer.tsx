//dashboard/generate-paper/components/PaperLayoutRenderer.tsx
'use client';
import React, { useMemo,useEffect } from 'react';
import { PaperSection, PaperSettings, LanguageConfig } from '@/types/paper-builder';
import { PaperHeader } from './PaperHeader';
import { SectionHeader } from './SectionHeader';
import { QuestionRenderer } from './QuestionRenderer';
import { toast } from 'react-hot-toast';

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
  paperPart:any;
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
  subjectUrduName
}) => {
    const subject = useMemo(() => paperSections[0]?.subject || '', [paperSections]);
  if (!settings) return <div className="p-5 text-center">Loading settings...</div>;
const isOverflowLocked = ['same', 'same_page', 'combined', 'separate'].includes(currentLayout);
 // Inside PaperLayoutRenderer
const globalNumbering = useMemo(() => {
  const sectionStartNumbers: Record<string, number> = {};
  let currentCount = 1;

  paperSections.forEach((section, index) => {
    const sectionType = section.type.toLowerCase();
    const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';
    
    // --- JOINING LOGIC ---
    const prevSection = index > 0 ? paperSections[index - 1] : null;
    const prevType = prevSection?.type.toLowerCase() || '';

    // Detection for joined pairs
  const isSecondPartOfPair = 
    (sectionType.includes('gazal') && prevType.includes('poetry_explanation')) ||
    (sectionType.includes('sentence_completion') && prevType.includes('sentence_correction'));

    //const shouldShareNumber = isPoetryPair || isSentencePair;

    if (isSecondPartOfPair) {
    // Assign the same number but do NOT increment currentCount
    sectionStartNumbers[section.id] = currentCount - 1;
  } else {
      // Normal logic: Assign new number
      sectionStartNumbers[section.id] = currentCount;

      // Determine if we increment for the NEXT section
      const isLong = sectionType.includes('long') || sectionType.includes('summary') || sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');
      
      if (isLong) {
        if (isUrduOrEnglish) {
          currentCount += 1; // One number for the whole block
        } else {
          const qCount = Array.isArray(section.questions) ? section.questions.length : 0;
          currentCount += qCount;
        }
      } else {
        currentCount += 1; // Standard increment
      }
    }
  });

  return sectionStartNumbers;
}, [paperSections, subject]);

  const { mcqs, subjectives } = useMemo(() => ({
    mcqs: paperSections.filter(s => s.type === 'mcq'),
    subjectives: paperSections.filter(s => s.type !== 'mcq')
  }), [paperSections]);

// four papers per page layout
const { shortQuestions, longQuestions, shortOverflow, longOverflow } = useMemo(() => {
  if (currentLayout !== 'four_papers') {
    return { shortQuestions: [], longQuestions: [], shortOverflow: false, longOverflow: false };
  }
  const shortSections = paperSections.filter(s => s.type === 'short');
  const longSections = paperSections.filter(s => s.type === 'long');

  const allShort = shortSections.flatMap(s => s.questions || []);
  const allLong = longSections.flatMap(s => s.questions || []);

  return {
    shortQuestions: allShort.slice(0, 6),
    longQuestions: allLong.slice(0, 5),
    shortOverflow: allShort.length > 6,
    longOverflow: allLong.length > 5,
  };
}, [paperSections, currentLayout]);


const fourPaperShortSection: PaperSection | null = useMemo(() => {
  if (currentLayout !== 'four_papers' || shortQuestions.length === 0) return null;
  const sourceSections = paperSections.filter(s => s.type === 'short');
  const marksEach = sourceSections[0]?.marksEach || 1;
  return {
    id: 'four-papers-short',
    type: 'short',
    instructions: sourceSections[0]?.instructions || 'Attempt the following short questions.',
    questions: shortQuestions,
    totalQuestions: shortQuestions.length,
    attemptCount: shortQuestions.length,
    marksEach,
    totalMarks: shortQuestions.length * marksEach,
    subject,
    language: paperLanguage,
    layout: currentLayout,
    timestamp: new Date().toISOString(),
  } as PaperSection;
}, [currentLayout, shortQuestions, paperSections, subject, paperLanguage]);

const fourPaperLongSection: PaperSection | null = useMemo(() => {
  if (currentLayout !== 'four_papers' || longQuestions.length === 0) return null;
  const sourceSections = paperSections.filter(s => s.type === 'long');
  const marksEach = sourceSections[0]?.marksEach || 1;
  return {
    id: 'four-papers-long',
    type: 'long',
    instructions: sourceSections[0]?.instructions || 'Attempt the following long questions.',
    questions: longQuestions,
    totalQuestions: longQuestions.length,
    attemptCount: longQuestions.length,
    marksEach,
    totalMarks: longQuestions.length * marksEach,
    subject,
    language: paperLanguage,
    layout: currentLayout,
    timestamp: new Date().toISOString(),
  } as PaperSection;
}, [currentLayout, longQuestions, paperSections, subject, paperLanguage]);
  const mcqTotalMarks = useMemo(() => mcqs.reduce((t, s) => t + s.totalMarks, 0), [mcqs]);
  const subTotalMarks = useMemo(() => subjectives.reduce((t, s) => t + s.totalMarks, 0), [subjectives]);

  const isSubjectUrduEnglish = useMemo(() => 
  subject.toLowerCase() === 'urdu' ||subject.toLowerCase() === 'english', 
  [subject]
);

  const handleHeaderChange = (sectionId: string, field: 'en' | 'ur', value: string) => {
    const updated = paperSections.map(s => {
      if (s.id === sectionId) return { ...s, [field === 'en' ? 'customEnHeader' : 'customUrHeader']: value };
      return s;
    });
    onSectionUpdate(updated);
  };
  useEffect(() => {
  if (currentLayout !== 'four_papers') return;
  if (shortOverflow) {
    toast.error('4-papers layout allows max 6 short questions — extra questions were hidden.');
  }
  if (longOverflow) {
    toast.error('4-papers layout allows max 5 long questions — extra questions were hidden.');
  }
}, [currentLayout, shortOverflow, longOverflow]);

  
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
      return globalSectionIndex; // This makes the first long question "Q.5" if it's the 5th section
    }
    // For other sections, you might want to sum previous questions or just use 0
    // To keep numbering continuous for the whole paper, use a reducer:
    let count = 0;
    for (let i = 0; i < globalSectionIndex; i++) {
        const s = paperSections[i];
        // If previous was long, it only counts as one "block", but usually 
        // standard question counting resets or follows specific board rules.
        count += s.questions?.length || 0;
    }
    return 0; // Defaulting to local index unless 'long'
  };


const SectionBlock = ({ section }: { section: PaperSection }) => {
  if (!section) return null;
  const questions = Array.isArray(section.questions) ? section.questions : [];
  const sectionType = section.type.toLowerCase();
  const startNum = globalNumbering[section.id] || 1;
  const isUrduOrEnglish = subject.toLowerCase() === 'urdu' || subject.toLowerCase() === 'english';

  const sectionIndexInArray = paperSections.findIndex(s => s.id === section.id);
  console.log('section index',sectionIndexInArray);
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

  // 1. COMBINED INSTRUCTION (Only for Nazam/Part A)
  // Extract attempts: Current (Nazam) and Next (Gazal)
  const nazamAttempt = section.attemptCount || 0;
  const gazalAttempt = nextSection?.attemptCount || 0;
  
  const combinedPoetryInstruction = `درج زیل نظم وغزل کے اشعار کی تشریح کیجئے۔ (حصہ نظم سے ${nazamAttempt} اور حصہ غزل سے ${gazalAttempt} اشعار منتخب کیجئے)`;


  // Logic for Correction/Completion
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

  // Formatting for sub-headers
  const subHeaderFontSize = settings.headingFontSize - 2;

  const getQuestionDisplayIndex = (localIdx: number) => {
    if (isSecondPartOfPair && prevSection) {
      return (prevSection.questions?.length || 0) + localIdx;
    }
    return localIdx;
  };

  const getDynamicColClass = (q: any) => {
      if (section.type === 'mcq' || section.type === 'long' ||section.type === 'summary' || (section.type === 'short' && subject.toLowerCase() !== 'urdu')|| sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma')) return 'col-12';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6';
      const engText = q.question_text || q.question || '';
      const urText = q.question_text_ur || '';
      const totalVisualLength = engText.length + (urText.length * 1.5);
      return totalVisualLength < 50 ? 'col-3' : totalVisualLength < 60 ? 'col-4' : totalVisualLength < 110 ? 'col-6 ' : 'col-12';
    };

  const isLongType = sectionType.includes('long') || sectionType.includes('summary')|| sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');
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
      {/* 2. RENDER THE COMBINED INSTRUCTION HEADER FOR NAZAM */}
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

      {/* 3. RENDER THE SUB-HEADER (Hissa Nazam / Hissa Gazal) */}
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
          
          {/* Default header for non-poetry sections */}
          {!isPoetry && !isGazal && !isFirstPartOfPair && !isSecondPartOfPair && (!isLongType || !isUrduOrEnglish) &&(
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
     part: 'mcq' | 'subjective' | 'combined' = 'combined'  // ← add this
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
  }// =========================
// FOUR PAPERS (Short front / Long back, 6 short max / 5 long max)
// =========================
else if (currentLayout === 'four_papers') {
  const count = 4;
  const slotHeight = '71mm'; // 297mm / 4 minus margins/cut-lines, matches the two/three-paper pattern
  const fontShrink = 4;
  const watermarkScale = 0.4;

  // FRONT SIDE — Short questions
  if (fourPaperShortSection) {
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
                  totalMarks={fourPaperShortSection.totalMarks}
                  subject={subject}
                  paperSections={[fourPaperShortSection]}
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
                <SectionBlock key={`${i}-short`} section={fourPaperShortSection} />
              </div>
            </PaperSlot>
            {i < count - 1 && <DashedLine />}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // BACK SIDE — Long questions
  if (fourPaperLongSection) {
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
                  totalMarks={fourPaperLongSection.totalMarks}
                  subject={subject}
                  paperSections={[fourPaperLongSection]}
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
                <SectionBlock key={`${i}-long`} section={fourPaperLongSection} />
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

        /* Aggressively remove borders and shadows from common containers and utility classes 
        .paper-sheet .page-border,
      
        .paper-sheet .border,
        .paper-sheet .border-info,
        .paper-sheet .shadow-sm,
        .paper-sheet .shadow-lg,
        .paper-sheet .container-fluid {
          border: none !important;
          box-shadow: none !important;
        }
*/
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



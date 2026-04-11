'use client';
import React, { useMemo } from 'react';
import { PaperSection, PaperSettings, LanguageConfig } from '@/types/paper-builder';
import { PaperHeader } from './PaperHeader';
import { SectionHeader } from './SectionHeader';
import { QuestionRenderer } from './QuestionRenderer';

interface Props {
  paperSections: PaperSection[];
  settings: PaperSettings;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: LanguageConfig;
  isEditMode: boolean;
  currentLayout: 'same' | 'separate' | 'two_papers' | 'three_papers';
  onTextChange: (sId: string, qId: string, f: string, v: string) => void;
  isPremium: boolean;
  onSectionUpdate: (updatedSections: PaperSection[]) => void;
  renderInlineBilingual?: boolean;
  currentClass?: string;
  profile: any;
  questionLineSpacing?: number;
}

const Watermark = ({ isPremium, logoUrl, settings }: { isPremium: boolean; logoUrl?: string; settings: PaperSettings }) => {
  if (!settings.showWatermark) return null;
  const watermarkImg = isPremium && logoUrl ? logoUrl : '/examly.png';
  const width = settings.watermarkWidth || 400;
  const height = settings.watermarkHeight || 400;
  const opacity = settings.watermarkOpacity || 0.1;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
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
  profile
}) => {
    const subject = useMemo(() => paperSections[0]?.subject || '', [paperSections]);
  if (!settings) return <div className="p-5 text-center">Loading settings...</div>;
const isOverflowLocked = currentLayout === 'same' || currentLayout === 'separate';
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


  
  const sheetBaseStyle: React.CSSProperties = {
    width: '210mm',
    height: '296mm',
    padding: '4mm',
    backgroundColor: 'white',
    margin: '0 auto',
    position: 'relative',
    overflow: isOverflowLocked ? 'hidden' : 'hidden',
    display: 'flex',
    flexDirection: 'column',
    color: 'black',
    fontFamily: settings.fontFamily,
    boxSizing: 'border-box'
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
      if (section.type === 'mcq' || section.type === 'long' ||section.type === 'summary' || (section.type === 'short' && subject.toLowerCase() !== 'urdu')|| sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma')) return 'col-12 mt-1';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6 mt-1';
      const engText = q.question_text || q.question || '';
      const urText = q.question_text_ur || '';
      const totalVisualLength = engText.length + (urText.length * 1.5);
      return totalVisualLength < 50 ? 'col-3 mt-1' : totalVisualLength < 60 ? 'col-4 mt-1' : totalVisualLength < 110 ? 'col-6 mt-1' : 'col-12 mt-1';
    };

  const isLongType = sectionType.includes('long') || sectionType.includes('summary')|| sectionType.includes('darkhwast_khat') || sectionType.includes('kahani_makalma');
  const isSingleAttemptLong = isLongType && (section.totalQuestions <= 2 && section.attemptCount === 1);
  const hideHeader = isUrduOrEnglish && isSingleAttemptLong && !isPoetry && !isGazal && !isCorrection && isCompletion;

  return (
    <div 
      className="section-block" 
      style={{ 
        border: isEditMode ? "1px dashed #ccc" : "none", 
        marginBottom: isFirstPartOfPair ? '5px' : '15px',
        marginTop: isSecondPartOfPair ? '5px' : '0px',
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
          className="sub-section-title px-1" 
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
          {!isPoetry && !isGazal && !isFirstPartOfPair && !isSecondPartOfPair && !isLongType &&(
             <SectionHeader
                sectionId={section.id}
                sectionIndex={isSecondPartOfPair || isLongType ? -1 : startNum - 1} 
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
          const finalIndex = isLongType ? startNum : getQuestionDisplayIndex(qIdx);
          return (
            <div key={`${q.id}-${qIdx}`} className={`${getDynamicColClass(q)} px-1`}>
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
      <div className="paper-sheet mcq-key-sheet" style={sheetBaseStyle}>
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

  const renderContent = () => {
    let pages: React.ReactNode[] = [];
//console.log('profile in renderer in rendered content', profile?.logo);
const renderPaperGroup = (group: PaperSection[], marks: number, keyPrefix: string) => {
  if (group.length === 0) return null;
  return (
    <div key={keyPrefix} className="paper-sheet" style={sheetBaseStyle}>
      <Watermark isPremium={isPremium} logoUrl={profile?.logo} settings={settings} />
      <div style={{ position: 'relative', zIndex: 1 }}>
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
        />
        {group.map((s) => (
          // We no longer need to find the index here; SectionBlock uses the globalNumbering map
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>
    </div>
  );
};

    if (currentLayout === 'same' || currentLayout === 'two_papers' || currentLayout === 'three_papers') {
      pages.push(renderPaperGroup(mcqs, mcqTotalMarks, 'mcq-group'));
      pages.push(renderPaperGroup(subjectives, subTotalMarks, 'sub-group'));
    } else if (currentLayout === 'separate') {
      pages.push(renderPaperGroup(mcqs, mcqTotalMarks, 'mcq-separate'));
      pages.push(renderPaperGroup(subjectives, subTotalMarks, 'sub-separate'));
    }

    pages.push(<MCQAnswerKeyPage key="mcq-keys" />);

    return <div className="print-container">{pages}</div>;
  };

  return (
    <div className="paper-builder-renderer bg-secondary-subtle">
      <style>{`
        @media screen {
          .paper-sheet { box-shadow: 0 0 10px rgba(0,0,0,0.1); border: 1px solid #dee2e6; margin: 20px auto; }
        }
        @media print {
          @page { size: A4; margin: 0 !important; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          .paper-builder-renderer { background: none !important; padding: 0 !important; }
          .paper-sheet { display: flex !important; box-shadow: none !important; border: none !important; margin: 0 !important; page-break-after: always !important; page-break-inside: avoid !important; }
          .print-container > .paper-sheet:last-child { page-break-after: avoid !important; }
          .no-print, nav, .sidebar, .btn { display: none !important; }
        }
      `}</style>
      {renderContent()}
    </div>
  );
};
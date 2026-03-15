// generate-paper/components/PaperLayoutRenderer.tsx
'use client';
import React, { useMemo } from 'react';
import { PaperSection, PaperSettings, LanguageConfig } from '@/types/paper-builder';
import { PaperHeader } from './PaperHeader';
import { SectionHeader } from './SectionHeader';
import { QuestionRenderer } from './QuestionRenderer';
import { set } from 'zod';

interface Props {
  paperSections: PaperSection[];
  settings: PaperSettings;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: LanguageConfig;
  isEditMode: boolean;
  currentLayout: 'same' | 'separate' | 'two_papers' | 'three_papers';
  onTextChange: (sId: string, qId: string, f: string, v: string) => void;
  onSectionUpdate: (updatedSections: PaperSection[]) => void;
  renderInlineBilingual?: boolean;
  currentClass?: string;
  profile: any;
  questionLineSpacing?: number;
}

export const PaperLayoutRenderer: React.FC<Props> = ({
  paperSections,
  settings,
  paperLanguage,
  config,
  isEditMode,
  currentLayout,
  onTextChange,
  onSectionUpdate,
  renderInlineBilingual = true,
  currentClass,
  profile
}) => {
  const { mcqs, subjectives } = useMemo(() => ({
    mcqs: paperSections.filter(s => s.type === 'mcq'),
    subjectives: paperSections.filter(s => s.type !== 'mcq')
  }), [paperSections]);
//console.log('PaperLayoutRenderer - settings:', settings);
  const subject = useMemo(() => paperSections[0]?.subject || '', [paperSections]);
  const totalMarks = useMemo(() => paperSections.reduce((t, s) => t + s.totalMarks, 0), [paperSections]);
  const mcqTotalMarks = useMemo(() => mcqs.reduce((t, s) => t + s.totalMarks, 0), [mcqs]);
  const subTotalMarks = useMemo(() => subjectives.reduce((t, s) => t + s.totalMarks, 0), [subjectives]);

  const handleHeaderChange = (sectionId: string, field: 'en' | 'ur', value: string) => {
    const updated = paperSections.map(s => {
      if (s.id === sectionId) {
        return { ...s, [field === 'en' ? 'customEnHeader' : 'customUrHeader']: value };
      }
      return s;
    });
    onSectionUpdate(updated);
  };

  // 1:1 PHYSICAL PAGE CONSTANTS
  const sheetBaseStyle: React.CSSProperties = {
  width: '210mm',
  height: '297mm',
  padding: '4mm', // Physical margin (adjust as needed, but keep fixed)
  backgroundColor: 'white',
  margin: 'auto', 
 
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  color: 'black',
  // Ensure line height is consistent


};
  const SectionBlock = ({ section, index }: { section: PaperSection; index: number }) => (
    <div key={section.id} className="section-block" style={{ border: isEditMode ? "1px dashed #ccc" : "none", marginBottom: '5px' }}>
      <SectionHeader
        sectionId={section.id}
        sectionIndex={index}
        sectionType={section.type}
        totalQuestions={section.totalQuestions}
        attemptCount={section.attemptCount}
        totalMarks={section.totalMarks}
        headingFontSize={settings.headingFontSize}
        headingFontFamily={settings.headingFontFamily}
        paperLanguage={paperLanguage}
        customEnHeader={section.customEnHeader}
        customUrHeader={section.customUrHeader}
        onHeaderChange={handleHeaderChange}
        isEditMode={isEditMode}
      />
      <div className="questions-list">
        {section?.questions?.map((q, qIdx) => (
          <QuestionRenderer
            key={q.id || qIdx}
            question={q}
            index={qIdx}
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
            renderInlineBilingual={renderInlineBilingual}
          />
        ))}
      </div>
    </div>
  );

 const DashedLine = () => (
  <div 
    className="w-100 my-2 border-top border-dark position-relative" 
    style={{ 
      borderStyle: 'dashed', 
      borderWidth: '1.5px',
      height: '1px'
    }}
  >
    <span 
      className="position-absolute bg-white px-2 fw-bold" 
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

  const PaperSlot = ({ height, children }: { height: string; children: React.ReactNode }) => (
    <div style={{ height, overflow: 'hidden', position: 'relative' }}>{children}</div>
  );

  const renderContent = () => {
    if (currentLayout === 'two_papers' || currentLayout === 'three_papers') {
      const count = currentLayout === 'two_papers' ? 2 : 3;
      const slotHeight = count === 2 ? '138mm' : '92mm';
      
      return [mcqs, subjectives].map((group, gIdx) => {
        if (group.length === 0) return null;
        return (
          <div key={gIdx} className="paper-sheet print-break" style={{
      ...sheetBaseStyle,
      pageBreakAfter: 'always',
      breakAfter: 'page',
      // Force font family here to match precisely
      fontFamily: settings.fontFamily 
    }}>
            {[...Array(count)].map((_, i) => (
              <React.Fragment key={i}>
                <PaperSlot height={slotHeight}>
                  <PaperHeader totalMarks={gIdx === 0 ? mcqTotalMarks : subTotalMarks} subject={subject} paperSections={group} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
                  {group.map((s, idx) => <SectionBlock key={s.id} section={s} index={idx} />)}
                </PaperSlot>
                {i < count - 1 && <DashedLine />}
              </React.Fragment>
            ))}
          </div>
        );
      });
    }

    if (currentLayout === 'separate') {
      return (
        <>
          {mcqs.length > 0 && (
            <div className="paper-sheet print-break" style={sheetBaseStyle}>
              <PaperHeader totalMarks={mcqTotalMarks} subject={subject} paperSections={mcqs} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
              {mcqs.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
            </div>
          )}
          {subjectives.length > 0 && (
            <div className="paper-sheet print-break" style={sheetBaseStyle}>
              <PaperHeader totalMarks={subTotalMarks} subject={subject} paperSections={subjectives} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
              {subjectives.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
            </div>
          )}
        </>
      );
    }

    return (
      <div className="paper-sheet print-break" style={sheetBaseStyle}>
        <PaperHeader totalMarks={totalMarks} subject={subject} paperSections={paperSections} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
        {paperSections.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
      </div>
    );
  };

  return (
    <div className="paper-builder-renderer  bg-secondary-subtle">
      <style>{`
        @media screen {
            .paper-sheet {
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                border: 1px solid #dee2e6;
            }
        }

        @media print {
          @page {
            size: A4;
            margin: 0mm !important; /* Margin handled by padding in sheetBaseStyle */
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .paper-builder-renderer {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          .paper-sheet {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            display: flex !important;
          }

          /* Hide UI elements */
          .no-print, nav, .sidebar, .btn, .fixed, .sticky {
            display: none !important;
          }
        }
      `}</style>
      
      {renderContent()}
    </div>
  );
};
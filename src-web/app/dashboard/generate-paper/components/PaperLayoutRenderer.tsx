//dashboard/generate-paper/components/PaperLayoutRenderer.tsx
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

  // PHYSICAL PAGE CONSTANTS
  const sheetBaseStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm', // Fixed height for exact 1:1 preview
    padding: '4mm',
    backgroundColor: 'white',
    margin: '0px auto', 
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
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
            questionFontFamily={config.questionFontFamily}
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
      borderWidth: '2px',
      height: '1px' // Ensures the line doesn't take extra vertical space
    }}
  >
    <span 
      className="position-absolute bg-white px-2 fw-bold" 
      style={{ 
        fontSize: '12px',
        top: '-10px',   // Centers the icon vertically on the line
        left: ' 0mm',   // Standardized offset from the left edge
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
      const slotHeight = count === 2 ? '140mm' : '93mm';
      
      return [mcqs, subjectives].map((group, gIdx) => {
        if (group.length === 0) return null;
        return (
          <div key={gIdx} className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
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
            <div className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
              <PaperHeader totalMarks={mcqTotalMarks} subject={subject} paperSections={mcqs} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
              {mcqs.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
            </div>
          )}
          {subjectives.length > 0 && (
            <div className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
              <PaperHeader totalMarks={subTotalMarks} subject={subject} paperSections={subjectives} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
              {subjectives.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
            </div>
          )}
        </>
      );
    }

    return (
      <div className="paper-sheet border shadow-sm print-break" style={sheetBaseStyle}>
        <PaperHeader totalMarks={totalMarks} subject={subject} paperSections={paperSections} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
        {paperSections.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
      </div>
    );
  };

  return (
    <div className="paper-builder-renderer py-4 bg-secondary-subtle">
      {/* INJECTED PRINT CSS */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0mm !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .paper-builder-renderer {
            padding: 0 !important;
            background: white !important;
          }
          .paper-sheet {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide Sidebar/Nav if they have these classes */
          .no-print, nav, .sidebar, header:not(.paper-header) {
            display: none !important;
          }
        }
      `}</style>
      
      {renderContent()}
    </div>
  );
};
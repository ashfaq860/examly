'use client';
import React, { useRef } from 'react';
import { BookOpen } from 'lucide-react';
import { PaperHeaderSection } from './PaperHeaderSection';
import { QuestionRenderer } from './QuestionRenderer';
import { LanguageConfig } from '@/types/types';

interface PaperRendererProps {
  paperSections: any[];
  settings: any;
  isEditMode: boolean;
  currentLayout: string;
  currentLanguage: string;
}

export const PaperRenderer: React.FC<PaperRendererProps> = ({
  paperSections,
  settings,
  isEditMode,
  currentLayout,
  currentLanguage
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  
  const languageConfigs: Record<string, LanguageConfig> = {
    english: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', sans-serif"
    },
    urdu: {
      direction: 'rtl',
      fontFamily: "'Jameel Noori Nastaleeq', 'Nafees', 'Alvi Lahori Nastaleeq', serif",
      fontSize: '18px',
      questionFontFamily: "'Jameel Noori Nastaleeq', 'Nafees', serif"
    },
    bilingual: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', 'Jameel Noori Nastaleeq', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', 'Jameel Noori Nastaleeq', sans-serif"
    }
  };
  
  const config = languageConfigs[currentLanguage];
  const totalMarks = paperSections.reduce((total, section) => total + section.totalMarks, 0);

  const renderPaperContent = () => {
    if (paperSections.length === 0) {
      return (
        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-50">
          <BookOpen size={64} strokeWidth={1} />
          <p className="mt-3">Your paper is empty. Start by configuring questions.</p>
        </div>
      );
    }

    return (
      <div className="paper-content">
        <PaperHeaderSection
          subject={paperSections[0]?.subject || ''}
          totalMarks={totalMarks}
          settings={settings}
        />

        <div className="instructions mb-5 p-3 border border-secondary rounded">
          <h5 className="fw-bold text-uppercase mb-3 text-decoration-underline" 
              style={{ fontSize: `${settings.headingFontSize}px`, fontFamily: settings.headingFontFamily }}>
            General Instructions
          </h5>
          <ol className="mb-0" style={{ fontSize: `${settings.metaFontSize}px` }}>
            <li>Attempt all questions from Section-A and any FOUR questions from Section-B.</li>
            <li>Write to the point and be neat and clean.</li>
            <li>Marks of each question are indicated against it.</li>
            <li>Use of calculator is not allowed.</li>
            {currentLayout === 'separate' && <li>Answer the MCQ on the separate answer sheet provided.</li>}
          </ol>
        </div>

        {paperSections.map((section, sIdx) => (
          <SectionRenderer
            key={section.id}
            section={section}
            sectionIndex={sIdx}
            settings={settings}
            isEditMode={isEditMode}
            currentLanguage={currentLanguage}
            config={config}
          />
        ))}

        <div className="mt-6 pt-5 border-top border-2 border-dark text-center">
          <div className="fw-bold mb-3">--- THE END ---</div>
          <div className="row">
            <div className="col-6 text-start">
              <div>Examiner's Signature: _________________</div>
            </div>
            <div className="col-6 text-end">
              <div>Controller's Signature: _________________</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-grow-1 p-3 p-md-5 d-flex justify-content-center overflow-auto">
      <div 
        ref={paperRef}
        className="bg-white shadow-lg paper-canvas" 
        style={{ 
          maxWidth: '800px',
          width: '210mm',
          minHeight: '297mm',
          padding: '60px 70px',
          position: 'relative',
          fontFamily: settings.fontFamily,
          fontSize: `${settings.fontSize}px`,
          direction: config.direction as any,
          lineHeight: '1.5'
        }}
      >
        <div className="page-border" style={{
          position: 'absolute',
          top: '30px',
          left: '30px',
          right: '30px',
          bottom: '30px',
          border: '2px solid #000',
          pointerEvents: 'none'
        }} />
        
        {renderPaperContent()}
      </div>
    </main>
  );
};
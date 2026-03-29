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
        zIndex: 0,
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
  onSectionUpdate,
  renderInlineBilingual = true,
  currentClass,
  profile
}) => {
  if (!settings) return <div className="p-5 text-center">Loading settings...</div>;

  const isPremium = profile?.plan === 'premium';

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
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    color: 'black',
    fontFamily: settings.fontFamily,
    boxSizing: 'border-box'
  };

  const SectionBlock = ({ section, index }: { section: PaperSection; index: number }) => {
    if (!section) return null;
    const questions = Array.isArray(section.questions) ? section.questions : [];
    const getDynamicColClass = (q: any) => {
      if (section.type === 'mcq' || section.type === 'long' || (section.type === 'short' && subject.toLowerCase() !== 'urdu')) return 'col-12 mt-0';
      if (section.type === 'short' && subject.toLowerCase() === 'urdu') return 'col-6';
      const engText = q.question_text || q.question || '';
      const urText = q.question_text_ur || '';
      const totalVisualLength = engText.length + (urText.length * 1.5);
      return totalVisualLength < 30 ? 'col-3' : totalVisualLength < 60 ? 'col-4 mt-0' : totalVisualLength < 110 ? 'col-6 mt-0' : 'col-12 mt-0';
    };

    return (
      <div className="section-block" style={{ border: isEditMode ? "1px dashed #ccc" : "none", marginBottom: '8px', width: '100%' }}>
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
          instructions={section.instructions}
          customEnHeader={section.customEnHeader}
          customUrHeader={section.customUrHeader}
          onHeaderChange={handleHeaderChange}
          isEditMode={isEditMode}
        />
        <div className="questions-list row g-2 mx-0">
          {questions.map((q, qIdx) => (
            <div key={`${q.id}-${qIdx}`} className={`${getDynamicColClass(q)} px-1`}>
              <QuestionRenderer
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
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PaperSlot = ({ height, children }: { height: string; children: React.ReactNode }) => (
    <div style={{ height, overflow: 'hidden', position: 'relative' }}>
      <Watermark isPremium={isPremium} logoUrl={profile?.logo_url} settings={settings} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );

  const MCQAnswerKeyPage = () => {
    const allMCQs = mcqs.flatMap(s => s.questions || []);
    if (allMCQs.length === 0) return null;
    return (
      <div className="paper-sheet mcq-key-sheet" style={sheetBaseStyle}>
        <Watermark isPremium={isPremium} logoUrl={profile?.logo_url} settings={settings} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <h2 className="text-center mb-4" style={{
            fontFamily: settings.headingFontFamily,
            fontSize: settings.headingFontSize,
            borderBottom: '2px solid #000',
            paddingBottom: '10px'
          }}>
            MCQ Answer Keys - {subject}
          </h2>
          <div className="d-flex justify-content-center">
            <div style={{ width: '320px' }}>
              <table className="table table-bordered border-dark table-sm">
                <thead>
                  <tr className="bg-light">
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

    // Render MCQs & Subjectives separately depending on layout
    const renderPaperGroup = (group: PaperSection[], marks: number, keyPrefix: string) => {
      if (group.length === 0) return null;
      return (
        <div key={keyPrefix} className="paper-sheet" style={sheetBaseStyle}>
          <Watermark isPremium={isPremium} logoUrl={profile?.logo_url} settings={settings} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <PaperHeader totalMarks={marks} subject={subject} paperSections={group} isEditMode={isEditMode} settings={settings} paperLanguage={paperLanguage} config={config} currentLayout={currentLayout} currentClass={currentClass} profile={profile} />
            {group.map((s, i) => <SectionBlock key={s.id} section={s} index={i} />)}
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

    // MCQ Answer key at the end
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
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Subject, Class, Chapter, Question } from '@/types/types';
import { 
  BookOpen, Filter, Edit3, Save, Printer, Trash2, GripVertical,
  Clock, BookText, FileText, Hash, Settings, X, Scissors
} from 'lucide-react';
import { QuestionSelectorModal } from './modals/QuestionSelectorModal';
import { EditableText } from './EditableText';

interface PaperBuilderAppProps {
  watch: any;
  setValue: (field: string, value: any) => void;
  register: any;
  getValues: any;
  getQuestionTypes: () => any[];
  subjects: Subject[];
  classes: Class[];
  chapters: Chapter[];
  watchedClassId: string;
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  setStep: (step: number) => void;
  setSelectedQuestions: (questions: Record<string, string[]>) => void;
  setPreviewQuestions: (questions: any) => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  isLoadingPreview: boolean;
  previewQuestions: Record<string, Question[]>;
  loadPreviewQuestions: () => Promise<void>;
  calculateTotalMarks: () => any;
}

interface PaperSection {
  id: string;
  type: string;
  questions: any[];
  totalQuestions: number;
  attemptCount: number;
  marksEach: number;
  totalMarks: number;
  subject: string;
  language: string;
  layout: string;
  timestamp: string;
}

interface PaperSettings {
  fontFamily: string;
  fontSize: number; // 6-18px
  titleFontSize: number;
  headingFontFamily: string;
  headingFontSize: number;
  metaFontSize: number;
}

interface LanguageConfig {
  direction: 'ltr' | 'rtl';
  fontFamily: string;
  fontSize: string;
  questionFontFamily: string;
}

export const PaperBuilderApp: React.FC<PaperBuilderAppProps> = ({
  watch,
  setValue,
  getValues,
  getQuestionTypes,
  subjects,
  classes,
  chapters,
  watchedClassId,
  watchedSubjectId,
  watchedChapterOption,
  selectedChapters,
  setStep,
  setSelectedQuestions,
  setPreviewQuestions,
  onSubmit,
  isLoading,
  isLoadingPreview,
  loadPreviewQuestions,
}) => {
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paperSections, setPaperSections] = useState<PaperSection[]>([]);
  const [paperLanguage, setPaperLanguage] = useState<'english' | 'urdu' | 'bilingual'>('english');
  const [isRTL, setIsRTL] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PaperSettings>({
    fontFamily: "'Times New Roman', serif",
    fontSize: 14,
    titleFontSize: 28,
    headingFontFamily: "'Times New Roman', serif",
    headingFontSize: 18,
    metaFontSize: 13
  });
  
  const paperContentRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Get paper configuration from watch
  const currentLayout = watch('mcqPlacement') || 'separate';
  const currentLanguage = watch('language') || 'english';

  // Language configuration
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

  // Sync state with localStorage
  const refreshPaperData = useCallback(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionPapers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setPaperSections(parsed);
          
          // Determine paper language from sections
          if (parsed.length > 0) {
            setPaperLanguage(parsed[0].language || currentLanguage);
            setIsRTL(parsed[0].language === 'urdu');
          }
        } catch (e) {
          console.error('Error parsing paper data:', e);
          setPaperSections([]);
        }
      } else {
        setPaperSections([]);
      }
    }
  }, [currentLanguage]);

  // Load data on mount and listen for storage events
  useEffect(() => {
    refreshPaperData();
    const handleStorageChange = () => refreshPaperData();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshPaperData]);

  const handleBoardPattern = async () => {
    setValue('selectionMethod', 'auto');
    await loadPreviewQuestions();
  };

  const handleCancelPaper = () => {
    if (confirm("Are you sure you want to clear all questions from the current paper?")) {
      localStorage.removeItem('questionPapers');
      refreshPaperData();
      setStep(1);
    }
  };

  const removeSection = (id: string) => {
    const updated = paperSections.filter(s => s.id !== id);
    localStorage.setItem('questionPapers', JSON.stringify(updated));
    refreshPaperData();
  };

  const handlePrint = () => {
    if (!paperContentRef.current) return;
    
    const printContent = paperContentRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const layoutStyle = getLayoutStyle();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Paper</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: ${settings.fontFamily};
            font-size: ${settings.fontSize}px;
          }
          
          .print-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 20mm;
            box-sizing: border-box;
            background: white;
            position: relative;
          }
          
          ${layoutStyle}
          
          /* Scissor cut styles */
          .scissor-cut {
            position: relative;
            border-top: 1px dashed #ccc;
            margin: 20px 0;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          
          .scissor-cut::before {
            content: "✄";
            position: absolute;
            left: 50%;
            top: -10px;
            transform: translateX(-50%);
            background: white;
            padding: 0 10px;
          }
          
          /* Page break control */
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          
          /* A4 page size */
          @media print {
            body * {
              visibility: hidden;
            }
            
            .print-container, .print-container * {
              visibility: visible;
            }
            
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${printContent}
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getLayoutStyle = () => {
    switch (currentLayout) {
      case 'two-per-page':
        return `
          .paper-content {
            column-count: 2;
            column-gap: 40px;
            column-fill: auto;
          }
          
          .paper-content > div {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .page-break {
            column-break-after: always;
          }
        `;
      case 'three-per-page':
        return `
          .paper-content {
            column-count: 3;
            column-gap: 30px;
            column-fill: auto;
          }
          
          .paper-content > div {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .page-break {
            column-break-after: always;
          }
        `;
      default:
        return `
          .paper-content {
            column-count: 1;
          }
        `;
    }
  };

  // Update settings
  const updateSetting = (key: keyof PaperSettings, value: number | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle text editing
  const handleTextChange = (sectionId: string, questionId: string, field: string, value: string) => {
    const updatedSections = paperSections.map(section => {
      if (section.id === sectionId) {
        const updatedQuestions = section.questions.map(question => {
          if (question.id === questionId) {
            return { ...question, [field]: value };
          }
          return question;
        });
        return { ...section, questions: updatedQuestions };
      }
      return section;
    });
    
    setPaperSections(updatedSections);
    localStorage.setItem('questionPapers', JSON.stringify(updatedSections));
  };

  // Calculate total marks for the paper
  const calculateTotalPaperMarks = () => {
    return paperSections.reduce((total, section) => total + section.totalMarks, 0);
  };

  // Get type label with proper formatting
  const getTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      'mcq': 'Multiple Choice Questions',
      'short': 'Short Questions',
      'long': 'Long Questions',
      'conceptual': 'Conceptual Questions',
      'numerical': 'Numerical Questions'
    };
    return typeMap[type] || type.replace(/_/g, ' ').toUpperCase();
  };

  // Format question text with proper HTML handling
  const formatQuestionText = (text: string): string => {
    if (!text) return '';
    
    // Decode HTML entities
    const txt = document.createElement('textarea');
    txt.innerHTML = text;
    
    // Add proper formatting for paper
    const formatted = txt.value
      .replace(/<p>/gi, '<div>')
      .replace(/<\/p>/gi, '</div>')
      .replace(/<div><br><\/div>/gi, '<br>')
      .replace(/<div>/gi, '<div style="display: inline;">');
    
    return formatted;
  };

  // Render question based on type and language
  const renderQuestion = (question: any, index: number, sectionType: string, sectionId: string) => {
    const isUrdu = paperLanguage === 'urdu';
    const isBilingual = paperLanguage === 'bilingual';
    const config = languageConfigs[paperLanguage];
    
    const questionText = formatQuestionText(question.question_text || question.question || '');
    const questionTextUr = formatQuestionText(question.question_text_ur || '');
    
    // For MCQ questions
    if (sectionType === 'mcq') {
      return (
        <div key={question.id || index} className="mb-4">
          <div className="d-flex gap-3 align-items-start">
            <div className="fw-bold text-nowrap" style={{ minWidth: '30px' }}>
              {String.fromCharCode(65 + index)}.
            </div>
            <div className="flex-grow-1">
              {/* English Question */}
              {(paperLanguage === 'english' || isBilingual) && questionText && (
                isEditMode ? (
                  <EditableText
                    value={question.question_text || question.question || ''}
                    onChange={(value) => handleTextChange(sectionId, question.id, 'question_text', value)}
                    style={{ 
                      fontFamily: config.questionFontFamily,
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: '1.6'
                    }}
                  />
                ) : (
                  <div 
                    className="question-text mb-3" 
                    style={{ 
                      fontFamily: config.questionFontFamily,
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: '1.6'
                    }}
                    dangerouslySetInnerHTML={{ __html: questionText }}
                  />
                )
              )}
              
              {/* Urdu Question */}
              {(isUrdu || isBilingual) && questionTextUr && (
                isEditMode ? (
                  <EditableText
                    value={question.question_text_ur || ''}
                    onChange={(value) => handleTextChange(sectionId, question.id, 'question_text_ur', value)}
                    style={{ 
                      fontFamily: "'Jameel Noori Nastaleeq', serif",
                      fontSize: `${settings.fontSize + 4}px`,
                      lineHeight: '1.8',
                      textAlign: 'right',
                      direction: 'rtl'
                    }}
                  />
                ) : (
                  <div 
                    className="question-text mb-3" 
                    style={{ 
                      fontFamily: "'Jameel Noori Nastaleeq', serif",
                      fontSize: `${settings.fontSize + 4}px`,
                      lineHeight: '1.8',
                      textAlign: 'right',
                      direction: 'rtl'
                    }}
                    dangerouslySetInnerHTML={{ __html: questionTextUr }}
                  />
                )
              )}
              
              {/* MCQ Options */}
              <div className="options-container ps-4">
                <div className="row g-3">
                  {['a', 'b', 'c', 'd'].map((option, optIndex) => {
                    const optionText = question[`option_${option}`];
                    const optionTextUr = question[`option_${option}_ur`];
                    
                    return (
                      <div key={option} className="col-md-6 d-flex align-items-start gap-2">
                        <div className="fw-bold text-nowrap">({option})</div>
                        <div className="flex-grow-1">
                          {/* English Option */}
                          {(paperLanguage === 'english' || isBilingual) && (
                            isEditMode ? (
                              <EditableText
                                value={question[`option_${option}`] || ''}
                                onChange={(value) => handleTextChange(sectionId, question.id, `option_${option}`, value)}
                                style={{ fontFamily: config.questionFontFamily, fontSize: `${settings.fontSize - 1}px` }}
                              />
                            ) : optionText && (
                              <div 
                                className="option-text"
                                style={{ fontFamily: config.questionFontFamily, fontSize: `${settings.fontSize - 1}px` }}
                                dangerouslySetInnerHTML={{ __html: optionText }}
                              />
                            )
                          )}
                          
                          {/* Urdu Option */}
                          {(isUrdu || isBilingual) && (
                            isEditMode ? (
                              <EditableText
                                value={question[`option_${option}_ur`] || ''}
                                onChange={(value) => handleTextChange(sectionId, question.id, `option_${option}_ur`, value)}
                                style={{ 
                                  fontFamily: "'Jameel Noori Nastaleeq', serif",
                                  fontSize: `${settings.fontSize + 2}px`,
                                  textAlign: 'right',
                                  direction: 'rtl'
                                }}
                              />
                            ) : optionTextUr && (
                              <div 
                                className="option-text mt-1"
                                style={{ 
                                  fontFamily: "'Jameel Noori Nastaleeq', serif",
                                  fontSize: `${settings.fontSize + 2}px`,
                                  textAlign: 'right',
                                  direction: 'rtl'
                                }}
                                dangerouslySetInnerHTML={{ __html: optionTextUr }}
                              />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Chapter and source info */}
          <div className="text-muted small mt-2 ms-5 ps-1" style={{ fontSize: `${settings.metaFontSize}px` }}>
            {question.chapters?.name && (
              <span className="me-3">Chapter: {question.chapters.name}</span>
            )}
            {question.source_type && (
              <span>Source: {question.source_type.replace(/_/g, ' ')}</span>
            )}
          </div>
        </div>
      );
    }
    
    // For Short/Long questions
    return (
      <div key={question.id || index} className="mb-4">
        <div className="d-flex gap-3 align-items-start">
          <div className="fw-bold text-nowrap" style={{ minWidth: '30px' }}>
            {index + 1}.
          </div>
          <div className="flex-grow-1">
            {/* English Question */}
            {(paperLanguage === 'english' || isBilingual) && questionText && (
              isEditMode ? (
                <EditableText
                  value={question.question_text || question.question || ''}
                  onChange={(value) => handleTextChange(sectionId, question.id, 'question_text', value)}
                  style={{ 
                    fontFamily: config.questionFontFamily,
                    fontSize: `${settings.fontSize + (sectionType === 'long' ? 2 : 1)}px`,
                    lineHeight: '1.6'
                  }}
                />
              ) : (
                <div 
                  className="question-text mb-2" 
                  style={{ 
                    fontFamily: config.questionFontFamily,
                    fontSize: `${settings.fontSize + (sectionType === 'long' ? 2 : 1)}px`,
                    lineHeight: '1.6'
                  }}
                  dangerouslySetInnerHTML={{ __html: questionText }}
                />
              )
            )}
            
            {/* Urdu Question */}
            {(isUrdu || isBilingual) && questionTextUr && (
              isEditMode ? (
                <EditableText
                  value={question.question_text_ur || ''}
                  onChange={(value) => handleTextChange(sectionId, question.id, 'question_text_ur', value)}
                  style={{ 
                    fontFamily: "'Jameel Noori Nastaleeq', serif",
                    fontSize: `${settings.fontSize + (sectionType === 'long' ? 6 : 5)}px`,
                    lineHeight: '1.8',
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                />
              ) : (
                <div 
                  className="question-text mb-2" 
                  style={{ 
                    fontFamily: "'Jameel Noori Nastaleeq', serif",
                    fontSize: `${settings.fontSize + (sectionType === 'long' ? 6 : 5)}px`,
                    lineHeight: '1.8',
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                  dangerouslySetInnerHTML={{ __html: questionTextUr }}
                />
              )
            )}
            
            {/* Space for answer */}
            {(sectionType === 'short' || sectionType === 'long') && (
              <div className="answer-space mt-3 mb-2">
                <div style={{ 
                  borderBottom: '2px dotted #666',
                  height: sectionType === 'long' ? '120px' : '40px',
                  marginLeft: '20px',
                  marginRight: '20px'
                }} />
                <div style={{ 
                  borderBottom: '2px dotted #666',
                  height: sectionType === 'long' ? '120px' : '40px',
                  marginLeft: '20px',
                  marginRight: '20px',
                  marginTop: '10px'
                }} />
              </div>
            )}
          </div>
        </div>
        
        {/* Chapter and source info */}
        <div className="text-muted small mt-2 ms-5 ps-1" style={{ fontSize: `${settings.metaFontSize}px` }}>
          {question.chapters?.name && (
            <span className="me-3">Chapter: {question.chapters.name}</span>
          )}
          {question.source_type && (
            <span>Source: {question.source_type.replace(/_/g, ' ')}</span>
          )}
        </div>
      </div>
    );
  };

  // Render paper based on layout
  const renderPaperContent = () => {
    const mcqSections = paperSections.filter(s => s.type === 'mcq');
    const otherSections = paperSections.filter(s => s.type !== 'mcq');
    const config = languageConfigs[paperLanguage];
    const totalMarks = calculateTotalPaperMarks();

    const renderSinglePaper = () => (
      <div className="paper-content" ref={paperContentRef}>
        {/* PAPER HEADER */}
        <div className="text-center mb-5 pb-4 border-bottom border-3 border-dark">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div style={{ width: '120px', textAlign: 'left' }}>
              <div className="fw-bold small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                Roll No. __________
              </div>
              <div className="fw-bold small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                Sheet No. __________
              </div>
            </div>
            <div>
              {isEditMode ? (
                <EditableText
                  value="BOARD OF SECONDARY EDUCATION"
                  onChange={() => {}}
                  tag="h2"
                  className="text-uppercase fw-bold mb-1"
                  style={{ fontSize: `${settings.titleFontSize}px`, letterSpacing: '1px' }}
                />
              ) : (
                <h2 className="text-uppercase fw-bold mb-1" style={{ fontSize: `${settings.titleFontSize}px`, letterSpacing: '1px' }}>
                  BOARD OF SECONDARY EDUCATION
                </h2>
              )}
              
              <h3 className="text-uppercase fw-bold mb-0" style={{ 
                fontSize: `${settings.titleFontSize - 6}px`, 
                color: '#333',
                fontFamily: settings.headingFontFamily
              }}>
                {paperSections[0]?.subject.toUpperCase()}
              </h3>
              <div className="mt-2 fw-bold" style={{ fontSize: `${settings.titleFontSize - 10}px` }}>
                ANNUAL EXAMINATION 2026
              </div>
            </div>
            <div style={{ width: '120px', textAlign: 'right' }}>
              <div className="fw-bold small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                Max. Marks: {totalMarks}
              </div>
              <div className="fw-bold small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                Time: 3 Hours
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-top border-1 border-secondary">
            <div className="row g-4">
              <div className="col-4 text-start">
                <div className="small fw-bold" style={{ fontSize: `${settings.metaFontSize}px` }}>
                  GROUP: __________
                </div>
              </div>
              <div className="col-4">
                <div className="small fw-bold" style={{ fontSize: `${settings.metaFontSize}px` }}>
                  DATE: __________
                </div>
              </div>
              <div className="col-4 text-end">
                <div className="small fw-bold" style={{ fontSize: `${settings.metaFontSize}px` }}>
                  CLASS: __________
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INSTRUCTIONS SECTION */}
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

        {/* PAPER SECTIONS */}
        {paperSections.map((section, sIdx) => (
          <div key={section.id} className="section-block mb-5 position-relative">
            {/* Section Header */}
            <div className="section-header d-flex justify-content-between align-items-end border-bottom border-2 border-dark mb-4 pb-2">
              <h4 className="mb-0 fw-bold text-uppercase" 
                  style={{ fontSize: `${settings.headingFontSize}px`, fontFamily: settings.headingFontFamily }}>
                {`Section-${String.fromCharCode(65 + sIdx)}: ${getTypeLabel(section.type)}`}
                {section.attemptCount > 0 && (
                  <span className="ms-3 fw-normal" style={{ fontSize: `${settings.headingFontSize - 2}px` }}>
                    (Attempt {section.attemptCount} out of {section.totalQuestions})
                  </span>
                )}
              </h4>
              <div className="fw-bold" style={{ fontSize: `${settings.headingFontSize - 2}px` }}>
                Marks: {section.totalMarks}
              </div>
            </div>

            {/* Questions List */}
            <div className={`questions-list ${section.type === 'mcq' && currentLayout === 'separate' ? 'mcq-grid' : ''}`}>
              {section.questions.map((question, qIdx) => 
                renderQuestion(question, qIdx, section.type, section.id)
              )}
            </div>
            
            {/* Section Footer */}
            {section.type === 'mcq' && currentLayout === 'separate' && (
              <div className="mt-4 pt-3 border-top border-1 border-secondary text-center">
                <div className="fw-bold">--- End of Section {String.fromCharCode(65 + sIdx)} ---</div>
              </div>
            )}
          </div>
        ))}

        {/* PAPER FOOTER */}
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

    const renderTwoPerPage = () => (
      <div className="paper-content" ref={paperContentRef}>
        {/* First Page - Two MCQ Papers */}
        <div className="page-break">
          <div style={{ columnCount: 2, columnGap: '40px', height: '100%' }}>
            {[1, 2].map((paperNum) => (
              <div key={`mcq-${paperNum}`} className="mb-5" style={{ breakInside: 'avoid' }}>
                {/* Paper Header for each */}
                <div className="text-center mb-4">
                  <div className="fw-bold" style={{ fontSize: `${settings.titleFontSize - 8}px` }}>
                    {paperSections[0]?.subject.toUpperCase()}
                  </div>
                  <div className="small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                    MCQ Section - Paper {paperNum}
                  </div>
                </div>
                
                {mcqSections.map((section, sIdx) => (
                  <div key={section.id} className="mb-4">
                    <div className="section-header border-bottom border-1 border-dark mb-3 pb-1">
                      <div className="fw-bold" style={{ fontSize: `${settings.headingFontSize - 2}px` }}>
                        {getTypeLabel(section.type)}
                      </div>
                    </div>
                    {section.questions.slice(0, Math.ceil(section.questions.length / 2)).map((question, qIdx) => 
                      renderQuestion(question, qIdx, section.type, section.id)
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          
          {/* Scissor Cut */}
          <div className="scissor-cut">
            Cut along this line
          </div>
        </div>

        {/* Second Page - Two Subjective Papers */}
        <div className="page-break">
          <div style={{ columnCount: 2, columnGap: '40px', height: '100%' }}>
            {[1, 2].map((paperNum) => (
              <div key={`subjective-${paperNum}`} className="mb-5" style={{ breakInside: 'avoid' }}>
                {/* Paper Header for each */}
                <div className="text-center mb-4">
                  <div className="fw-bold" style={{ fontSize: `${settings.titleFontSize - 8}px` }}>
                    {paperSections[0]?.subject.toUpperCase()}
                  </div>
                  <div className="small" style={{ fontSize: `${settings.metaFontSize}px` }}>
                    Subjective Section - Paper {paperNum}
                  </div>
                </div>
                
                {otherSections.map((section, sIdx) => (
                  <div key={section.id} className="mb-4">
                    <div className="section-header border-bottom border-1 border-dark mb-3 pb-1">
                      <div className="fw-bold" style={{ fontSize: `${settings.headingFontSize - 2}px` }}>
                        {getTypeLabel(section.type)}
                      </div>
                    </div>
                    {section.questions.slice(0, Math.ceil(section.questions.length / 2)).map((question, qIdx) => 
                      renderQuestion(question, qIdx, section.type, section.id)
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          
          {/* Scissor Cut */}
          <div className="scissor-cut">
            Cut along this line
          </div>
        </div>
      </div>
    );

    switch (currentLayout) {
      case 'same':
        return renderSinglePaper();
      case 'separate':
        return (
          <div className="paper-content" ref={paperContentRef}>
            {/* MCQ Page */}
            <div className="page-break">
              {mcqSections.length > 0 && mcqSections.map((section, sIdx) => (
                <div key={section.id} className="mb-5">
                  <div className="section-header border-bottom border-2 border-dark mb-4 pb-2">
                    <h4 className="mb-0 fw-bold text-uppercase" 
                        style={{ fontSize: `${settings.headingFontSize}px`, fontFamily: settings.headingFontFamily }}>
                      {`Section-${String.fromCharCode(65 + sIdx)}: ${getTypeLabel(section.type)}`}
                    </h4>
                  </div>
                  {section.questions.map((question, qIdx) => 
                    renderQuestion(question, qIdx, section.type, section.id)
                  )}
                </div>
              ))}
            </div>
            
            {/* Subjective Page */}
            <div className="page-break">
              {otherSections.map((section, sIdx) => (
                <div key={section.id} className="mb-5">
                  <div className="section-header border-bottom border-2 border-dark mb-4 pb-2">
                    <h4 className="mb-0 fw-bold text-uppercase" 
                        style={{ fontSize: `${settings.headingFontSize}px`, fontFamily: settings.headingFontFamily }}>
                      {`Section-${String.fromCharCode(65 + sIdx + mcqSections.length)}: ${getTypeLabel(section.type)}`}
                    </h4>
                  </div>
                  {section.questions.map((question, qIdx) => 
                    renderQuestion(question, qIdx, section.type, section.id)
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      case 'two-per-page':
        return renderTwoPerPage();
      case 'three-per-page':
        // Similar to two-per-page but with 3 columns
        return renderSinglePaper(); // Simplified for brevity
      default:
        return renderSinglePaper();
    }
  };

  const btnStyle = { width: '90px', height: '52px' };
  const totalMarks = calculateTotalPaperMarks();
  const config = languageConfigs[paperLanguage];

  return (
    <div className="min-vh-100 bg-light d-flex flex-column">
      {/* APP HEADER */}
      <header className="bg-white border-bottom sticky-top shadow-sm py-2" style={{ zIndex: 1100 }}>
        <div className="header-scroll-wrapper px-2 d-flex gap-2 gap-sm-1">
          <button onClick={handleBoardPattern} className="btn btn-light border d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu" style={btnStyle}>
            <BookOpen size={18} className="text-primary" />
            <span className="btn-label">Board Pattern</span>
          </button>

          <button onClick={() => setShowQuestionSelector(true)} className="btn btn-light border d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu" style={btnStyle}>
            <Filter size={18} className="text-success" />
            <span className="btn-label">Configure Paper</span>
          </button>

          <button 
            onClick={() => setIsEditMode(!isEditMode)} 
            className={`btn ${isEditMode ? 'btn-warning' : 'btn-light border'} d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu`} 
            style={btnStyle}
          >
            <Edit3 size={18} />
            <span className="btn-label">{isEditMode ? 'Done' : 'Edit Mode'}</span>
          </button>

          <button onClick={() => onSubmit(getValues())} className="btn btn-light border d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu" style={btnStyle}>
            <Save size={18} className="text-secondary" />
            <span className="btn-label">Save Paper</span>
          </button>

          <button onClick={handlePrint} className="btn btn-light border d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu" style={btnStyle}>
            <Printer size={18} className="text-dark" />
            <span className="btn-label">Print</span>
          </button>

          <button onClick={handleCancelPaper} className="btn btn-light border d-flex flex-column align-items-center justify-content-center flex-shrink-0 topmenu" style={btnStyle}>
            <Trash2 size={18} className="text-danger" />
            <span className="btn-label">Cancel</span>
          </button>
        </div>
        
        {/* Paper Stats */}
        {paperSections.length > 0 && (
          <div className="d-flex justify-content-center mt-2 small text-muted">
            <div className="d-flex gap-4">
              <span><BookText size={14} className="me-1" /> Sections: {paperSections.length}</span>
              <span><FileText size={14} className="me-1" /> Total Questions: {paperSections.reduce((acc, s) => acc + s.totalQuestions, 0)}</span>
              <span><Hash size={14} className="me-1" /> Total Marks: {totalMarks}</span>
              <span><Clock size={14} className="me-1" /> Time: 3 Hours</span>
            </div>
          </div>
        )}
      </header>

      {/* PAPER AREA */}
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
          {/* Page Border */}
          <div className="page-border" style={{
            position: 'absolute',
            top: '30px',
            left: '30px',
            right: '30px',
            bottom: '30px',
            border: '2px solid #000',
            pointerEvents: 'none'
          }} />
          
          {paperSections.length === 0 ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-50">
              <BookOpen size={64} strokeWidth={1} />
              <p className="mt-3">Your paper is empty. Start by configuring questions.</p>
            </div>
          ) : (
            renderPaperContent()
          )}
        </div>
      </main>

      {/* SETTINGS FLYING MENU */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="btn btn-primary rounded-circle p-3"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        <Settings size={24} />
      </button>

      {showSettings && (
        <div className="card shadow-lg border-0"
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '300px',
            zIndex: 1000
          }}>
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Paper Settings</h6>
            <button className="btn btn-sm btn-light" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label small mb-1">Question Font Size</label>
              <input
                type="range"
                className="form-range"
                min="6"
                max="18"
                step="1"
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
              />
              <div className="small text-muted">{settings.fontSize}px</div>
            </div>
            
            <div className="mb-3">
              <label className="form-label small mb-1">Title Font Size</label>
              <input
                type="range"
                className="form-range"
                min="20"
                max="40"
                step="1"
                value={settings.titleFontSize}
                onChange={(e) => updateSetting('titleFontSize', parseInt(e.target.value))}
              />
              <div className="small text-muted">{settings.titleFontSize}px</div>
            </div>
            
            <div className="mb-3">
              <label className="form-label small mb-1">Heading Font Size</label>
              <input
                type="range"
                className="form-range"
                min="14"
                max="24"
                step="1"
                value={settings.headingFontSize}
                onChange={(e) => updateSetting('headingFontSize', parseInt(e.target.value))}
              />
              <div className="small text-muted">{settings.headingFontSize}px</div>
            </div>
            
            <div className="mb-3">
              <label className="form-label small mb-1">Meta Font Size</label>
              <input
                type="range"
                className="form-range"
                min="10"
                max="16"
                step="1"
                value={settings.metaFontSize}
                onChange={(e) => updateSetting('metaFontSize', parseInt(e.target.value))}
              />
              <div className="small text-muted">{settings.metaFontSize}px</div>
            </div>
            
            <div className="mb-3">
              <label className="form-label small mb-1">Font Family</label>
              <select
                className="form-select form-select-sm"
                value={settings.fontFamily}
                onChange={(e) => updateSetting('fontFamily', e.target.value)}
              >
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Georgia', serif">Georgia</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showQuestionSelector && (
        <QuestionSelectorModal
          isOpen={showQuestionSelector}
          onClose={() => {
            setShowQuestionSelector(false);
            refreshPaperData();
          }}
          subjectId={watchedSubjectId}
          classId={watchedClassId}
          chapterOption={watchedChapterOption}
          selectedChapters={selectedChapters}
          chapters={chapters}
          subjects={subjects}
          language={currentLanguage}
          getQuestionTypes={getQuestionTypes}
          watch={watch}
          setValue={setValue}
          currentSubject={subjects.find(s => s.id === watchedSubjectId)}
        />
      )}

      <style jsx>{`
        .header-scroll-wrapper {
          overflow-x: auto;
          scrollbar-width: none;
          display: flex;
        }
        .header-scroll-wrapper::-webkit-scrollbar { display: none; }
        
        .btn-label {
          font-size: 10px;
          margin-top: 3px;
          font-weight: 700;
          line-height: 1.1;
        }

        .paper-canvas {
          color: #000;
          background: #fff !important;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .question-text :global(div) {
          display: inline !important;
          margin: 0 !important;
        }

        .question-text :global(p) {
          margin: 0 !important;
          display: inline !important;
        }

        .question-text :global(br) {
          display: block;
          margin: 5px 0;
          content: "";
        }

        .options-container :global(div) {
          display: inline !important;
          margin: 0 !important;
        }

        .section-block {
          page-break-inside: avoid;
        }

        /* Urdu Font Support */
        @font-face {
          font-family: 'Jameel Noori Nastaleeq';
          src: local('Jameel Noori Nastaleeq'), local('Nafees'), local('Alvi Lahori Nastaleeq');
          font-weight: normal;
          font-style: normal;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          
          .paper-canvas, .paper-canvas * {
            visibility: visible;
          }
          
          .paper-canvas {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          
          .page-border { 
            border: 2px solid #000 !important; 
            top: 10mm !important;
            left: 10mm !important;
            right: 10mm !important;
            bottom: 10mm !important;
          }
          
          header, .btn-danger, .instructions, .settings-btn { 
            display: none !important; 
          }
          
          main { 
            padding: 0 !important; 
            background: white !important; 
            overflow: visible !important; 
          }
          
          .bg-light { 
            background: white !important; 
          }
          
          .shadow-lg { 
            box-shadow: none !important; 
          }
          
          .section-block { 
            break-inside: avoid; 
          }
        }

        @media (max-width: 768px) {
          .paper-canvas { 
            padding: 30px !important; 
            width: 100% !important;
          }
          
          .topmenu { 
            width: auto !important; 
            padding: 4px !important; 
          }
          
          .btn-label { 
            font-size: 9px; 
          }
        }

        @media (max-width: 480px) {
          .paper-canvas { 
            padding: 20px !important; 
          }
          
          .section-header h4 { 
            font-size: 16px !important; 
          }
          
          .question-text { 
            font-size: 14px !important; 
          }
        }
      `}</style>
    </div>
  );
};
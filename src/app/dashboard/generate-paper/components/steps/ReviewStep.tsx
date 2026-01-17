// ReviewStep.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Question, Chapter } from '@/types/types';
import { useUser } from '@/app/context/userContext';
import { PlusCircle, ArrowLeft } from 'lucide-react';

interface ReviewStepProps {
  watch: any;
  getValues: any;
  setStep: (step: number) => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  isLoadingPreview: boolean;
  isDownloadingKey: boolean;
  isAuthenticated: boolean;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  previewQuestions: Record<string, Question[]>;
  chapters: Chapter[];
  subjects: any[];
  classes: any[];
  loadPreviewQuestions: () => Promise<void>;
  calculateTotalMarks: () => any;
  getQuestionTypes: () => any[];
  setPreviewQuestions: (questions: any) => void;
  onDownloadKey: () => Promise<void>;
  resetForm?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// Helper function to decode HTML entities
const decodeHtmlEntities = (html: string): string => {
  if (!html) return '';
  
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

// Helper component for rendering HTML content safely
const HtmlContent: React.FC<{ 
  content: string | undefined; 
  className?: string;
  style?: React.CSSProperties;
  dir?: 'ltr' | 'rtl';
  isUrdu?: boolean;
  marginBottom?: string;
}> = ({ content, className, style, dir, isUrdu = false, marginBottom = '2px' }) => {
  if (!content || content === 'undefined') return null;
  
  const decoded = decodeHtmlEntities(content);
  const hasHtmlTags = /<[^>]*>/g.test(decoded);
  
  const baseStyle: React.CSSProperties = {
    marginBottom,
    ...style
  };
  
  if (hasHtmlTags) {
    return (
      <div 
        className={`${className} ${isUrdu ? 'urdu-text' : ''}`}
        style={baseStyle}
        dangerouslySetInnerHTML={{ __html: decoded }}
        dir={dir}
      />
    );
  }
  
  return (
    <div className={`${className} ${isUrdu ? 'urdu-text' : ''}`} style={baseStyle} dir={dir}>
      {decoded}
    </div>
  );
};

// Helper component for bilingual MCQ option rendering
const BilingualMcqOption: React.FC<{
  optionLetter: string;
  urduContent: string | undefined;
  englishContent: string | undefined;
  className?: string;
  isUrduLanguage?: boolean;
  isBilingual?: boolean;
}> = ({ optionLetter, urduContent, englishContent, className, isUrduLanguage = false, isBilingual = false }) => {
  // Clean up content - remove undefined strings
  const cleanUrduContent = urduContent && urduContent !== 'undefined' ? urduContent : '';
  const cleanEnglishContent = englishContent && englishContent !== 'undefined' ? englishContent : '';
  
  // Determine which content to show based on language
  const showUrdu = (isUrduLanguage || isBilingual) && cleanUrduContent;
  const showEnglish = (!isUrduLanguage || isBilingual) && cleanEnglishContent;
  
  const hasBoth = showUrdu && showEnglish;
  
  if (hasBoth) {
    return (
      <div className={`bilingual-option ${className || ''}`} style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: '8px',
        padding: '4px 0'
      }}>
        <span className="option-letter" style={{
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: '13px',
          minWidth: '25px'
        }}>({optionLetter})</span>
        
        <div className="option-content" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flex: 1,
          gap: '15px'
        }}>
          {showEnglish && (
            <div className="english-option" style={{
              flex: 1,
              textAlign: 'left',
              minWidth: 0
            }}>
              <HtmlContent 
                content={cleanEnglishContent}
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  fontSize: '13px',
                  lineHeight: '1.5',
                  textAlign: 'left',
                  marginBottom: '0'
                }}
                dir="ltr"
              />
            </div>
          )}
          
          {showUrdu && (
            <div className="urdu-option" style={{
              flex: 1,
              minWidth: 0
            }}>
              <HtmlContent 
                content={cleanUrduContent}
                className="urdu-text"
                isUrdu={true}
                style={{
                  fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                  fontSize: '15px',
                  lineHeight: '2',
                  textAlign: 'right',
                  marginBottom: '0'
                }}
                dir="rtl"
              />
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Single language option - prioritize Urdu if Urdu language selected
  if (isUrduLanguage && showUrdu) {
    return (
      <div className={`single-option ${className || ''}`} style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: '4px',
        padding: '2px 0',
        direction: 'rtl'
      }}>
        <div className="option-content" style={{ 
          flex: 1,
          textAlign: 'right',
          direction: 'rtl',
          marginRight: '8px'
        }}>
          <HtmlContent 
            content={cleanUrduContent}
            className="urdu-text"
            isUrdu={true}
            style={{
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
              fontSize: '15px',
              lineHeight: '2',
              textAlign: 'right',
              marginBottom: '0'
            }}
            dir="rtl"
          />
        </div>
        <span className="option-letter" style={{
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: '13px',
          minWidth: '25px'
        }}>({optionLetter})</span>
      </div>
    );
  }
  
  // English or single language option
  return (
    <div className={`single-option ${className || ''}`} style={{
      display: 'flex',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: '4px',
      padding: '2px 0'
    }}>
      <span className="option-letter" style={{
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '13px',
        minWidth: '25px'
      }}>({optionLetter})</span>
      <div className="option-content" style={{ 
        marginLeft: '8px', 
        flex: 1,
        textAlign: 'left',
        direction: 'ltr'
      }}>
        <HtmlContent 
          content={cleanEnglishContent}
          style={{
            fontFamily: `${isUrduLanguage?"'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif":"'Times New Roman', Times, serif"}`,
            fontSize: '13px',
            lineHeight: '1.5',
            marginBottom: '0'
          }}
           dir={isUrduLanguage ? 'rtl' : 'ltr'} 
        />
      </div>
    </div>
  );
};

export const ReviewStep: React.FC<ReviewStepProps> = ({
  watch,
  getValues,
  setStep,
  onSubmit,
  isLoading,
  isLoadingPreview,
  isDownloadingKey,
  isAuthenticated,
  isEditMode,
  setIsEditMode,
  previewQuestions,
  chapters,
  subjects,
  classes,
  loadPreviewQuestions,
  calculateTotalMarks,
  getQuestionTypes,
  setPreviewQuestions,
  onDownloadKey,
  resetForm,
  showToast
}) => {
  const { trialStatus, isLoading: isLoadingUser } = useUser();
  const [draggedQuestion, setDraggedQuestion] = useState<{ id: string; type: string } | null>(null);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(false);
  
  // Get current language
  const currentLanguage = watch('language') || 'english';
 
  const isUrduLanguage = currentLanguage === 'urdu';
  const isBilingual = currentLanguage === 'bilingual';
   //alert(isUrduLanguage)
  // Check if there are MCQ questions
  const hasMCQ = previewQuestions['mcq'] && previewQuestions['mcq'].length > 0;
  const hasSubjective = (previewQuestions['short'] && previewQuestions['short'].length > 0) || 
                       (previewQuestions['long'] && previewQuestions['long'].length > 0);
  
  // Determine header text based on question types
  let paperTypeText = '';
  if (hasMCQ && hasSubjective) {
    paperTypeText = isUrduLanguage ? 'حصہ انشائیہ/معرضی' : 'Subjective/MCQ Paper';
  } else if (hasMCQ && !hasSubjective) {
    paperTypeText = isUrduLanguage ? 'حصہ معرضی' : 'MCQ Paper';
  } else if (!hasMCQ && hasSubjective) {
    paperTypeText = isUrduLanguage ? 'حصہ انشائیہ' : 'Subjective Paper';
  } else {
    paperTypeText = isUrduLanguage ? 'پیپر' : 'Paper';
  }

  // Handle watermark checkbox change
  const handleWatermarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isPaidUser = trialStatus?.hasActiveSubscription;
    
    if (isPaidUser) {
      setRemoveWatermark(e.target.checked);
    } else {
      // Show toast message for trial users
      if (showToast) {
        showToast('This feature is only available for paid users. Upgrade your plan to remove watermarks.', 'info');
      } else {
        // Fallback to alert if toast function is not provided
        alert('This feature is only available for paid users. Upgrade your plan to remove watermarks.');
      }
      // Ensure checkbox remains unchecked
      setRemoveWatermark(false);
    }
  };

  // Handle form submission with watermark option
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = getValues();
    
    // Add watermark removal option to form data
    const submitData = {
      ...formData,
      removeWatermark: trialStatus?.hasActiveSubscription ? removeWatermark : false
    };
    
    await onSubmit(submitData);
  };

  useEffect(() => {
    if (isEditMode) {
      requestAnimationFrame(() => {
        setIsAlertVisible(true);
      });
    } else {
      setIsAlertVisible(false);
    }
  }, [isEditMode]);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper function to get marks for a specific question type
  const getMarksForQuestionType = (type: string) => {
    const questionTypes = getQuestionTypes();
    const typeInfo = questionTypes.find(t => t.value === type);
    if (!typeInfo) return 1;
    
    const marksField = `${typeInfo.fieldPrefix}Marks`;
    return watch(marksField) || 1;
  };

  // Helper function to get toAttempt count for a specific question type
  const getToAttemptForQuestionType = (type: string) => {
    const questionTypes = getQuestionTypes();
    const typeInfo = questionTypes.find(t => t.value === type);
    if (!typeInfo) return 0;
    
    const attemptField = `${typeInfo.fieldPrefix}ToAttempt`;
    return watch(attemptField) || 0;
  };

  // Helper function to get total count for a specific question type
  const getTotalCountForQuestionType = (type: string) => {
    const questionTypes = getQuestionTypes();
    const typeInfo = questionTypes.find(t => t.value === type);
    if (!typeInfo) return 0;
    
    const totalField = `${typeInfo.fieldPrefix}Count`;
    return watch(totalField) || 0;
  };

  // Calculate section marks for a specific question type
  const calculateSectionMarks = (type: string) => {
    const questions = previewQuestions[type] || [];
    const toAttempt = getToAttemptForQuestionType(type);
    const marksPerQuestion = getMarksForQuestionType(type);
    
    if (questions.length === 0) return 0;
    
    // Calculate actual marks from questions with custom marks
    const actualMarks = questions.slice(0, toAttempt).reduce((sum, q) => {
      return sum + (q.customMarks || marksPerQuestion);
    }, 0);
    
    return actualMarks;
  };

  // Calculate total marks from all question types
  const calculateTotalMarksFromQuestions = () => {
    const questionTypes = getQuestionTypes();
    let total = 0;
    
    questionTypes.forEach(type => {
      total += calculateSectionMarks(type.value);
    });
    
    return total;
  };

  const handleDragStart = (e: React.DragEvent, questionId: string, questionType: string) => {
    setDraggedQuestion({ id: questionId, type: questionType });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetType: string) => {
    e.preventDefault();
    
    if (!draggedQuestion) return;

    if (draggedQuestion.type === targetType) {
      const questions = [...previewQuestions[targetType]];
      const draggedIndex = questions.findIndex(q => q.id === draggedQuestion.id);
      
      if (draggedIndex !== -1) {
        const dropIndex = getDropIndex(e.currentTarget as HTMLElement, e.clientY, questions);
        
        if (dropIndex !== -1) {
          const [draggedItem] = questions.splice(draggedIndex, 1);
          
          let newIndex = dropIndex;
          if (draggedIndex < dropIndex) {
            newIndex = dropIndex - 1;
          }
          
          questions.splice(newIndex, 0, draggedItem);
          
          setPreviewQuestions(prev => ({
            ...prev,
            [targetType]: questions
          }));
        }
      }
    }
    
    setDraggedQuestion(null);
  };

  const getDropIndex = (container: HTMLElement, y: number, questions: Question[]): number => {
    const questionElements = container.querySelectorAll('.question-item');
    if (questionElements.length === 0) return questions.length;

    for (let i = 0; i < questionElements.length; i++) {
      const element = questionElements[i];
      const rect = element.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      
      if (y < middle) {
        return i;
      }
    }
    
    return questions.length;
  };

  const handleDragEnd = () => {
    setDraggedQuestion(null);
  };

  const updateQuestionMarks = (type: string, questionId: string, marks: number) => {
    setPreviewQuestions(prev => ({
      ...prev,
      [type]: prev[type].map(q => 
        q.id === questionId 
          ? { ...q, customMarks: marks }
          : q
      )
    }));
  };

  const renderQuestion = (question: Question, type: string, index: number) => {
    const marksPerQuestion = getMarksForQuestionType(type);
    const chapterInfo = chapters.find(c => c.id === question.chapter_id);
    const chapterNo = chapterInfo?.chapterNo || '1';

    if (type === 'mcq') {
      return (
        <tr 
          key={question.id}
          className={`question-item ${isEditMode ? 'cursor-grab' : ''} ${
            draggedQuestion?.id === question.id ? 'dragging' : ''
          }`}
          draggable={isEditMode}
          onDragStart={(e) => handleDragStart(e, question.id, 'mcq')}
          onDragEnd={handleDragEnd}
          style={{ 
            transition: 'all 0.3s ease',
            position: 'relative',
            cursor: isEditMode ? 'grab' : 'default',
            marginBottom: '2px'
          }}
        >
          <td className="qnum" style={{ 
            width: '40px', 
            textAlign: 'center', 
            fontWeight: 'bold',
            border: '1px solid #000',
            padding: '8px 4px',
            verticalAlign: 'top',
            position: 'relative',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '14px'
          }}>
            {isEditMode && (
              <div className="position-absolute top-0 start-0 m-1 text-muted" style={{ cursor: 'grab' }}>
                <i className="bi bi-grip-vertical fs-6"></i>
              </div>
            )}
            {index + 1}
          </td>
          <td style={{ 
            border: '1px solid #000',
            padding: '8px',
            verticalAlign: 'top',
            direction: isUrduLanguage ? 'rtl' : 'ltr'
          }}>
            <div className="question" style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              margin: '0 0 8px 0',
              direction: isUrduLanguage ? 'rtl' : 'ltr'
            }}>
              <div className="flex-grow-1" style={{ width: '100%' }}>
                {isUrduLanguage && (
                  <HtmlContent 
                    content={question.question_text_urdu || question.question_text}
                    className="fw-bold urdu-text"
                    isUrdu={true}
                    style={{
                      fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                      fontSize: '16px',
                      lineHeight: '2',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      marginBottom: '2px'
                    }}
                    dir="rtl"
                  />
                )}
                
                {currentLanguage === 'english' && (
                  <HtmlContent 
                    content={question.question_text}
                    className="fw-bold english-text"
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      fontSize: '14px',
                      lineHeight: '1.6',
                      textAlign: 'left',
                      marginBottom: '2px'
                    }}
                    dir="ltr"
                  />
                )}
                
                {isBilingual && (
                  <BilingualQuestionText
                    urduText={question.question_text_urdu}
                    englishText={question.question_text_english || question.question_text}
                  />
                )}
              </div>
              <div className="d-flex align-items-center gap-2 ms-3">
                {isEditMode && (
                  <div className="individual-marks-input">
                    <small className="text-muted me-2">Marks:</small>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      style={{ width: '70px' }}
                      value={question.customMarks || marksPerQuestion}
                      onChange={(e) => updateQuestionMarks(type, question.id, parseInt(e.target.value) || marksPerQuestion)}
                      min="1"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="options" style={{ 
              marginTop: '10px'
            }}>
              <div className="row g-2">
                {question.option_a && (
                  <div className="col-12 col-md-6">
                    <BilingualMcqOption
                      optionLetter="A"
                      urduContent={question.option_a_urdu}
                      englishContent={question.option_a}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                )}
                {question.option_b && (
                  <div className="col-12 col-md-6">
                    <BilingualMcqOption
                      optionLetter="B"
                      urduContent={question.option_b_urdu}
                      englishContent={question.option_b}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                )}
                {question.option_c && (
                  <div className="col-12 col-md-6">
                    <BilingualMcqOption
                      optionLetter="C"
                      urduContent={question.option_c_urdu}
                      englishContent={question.option_c}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                )}
                {question.option_d && (
                  <div className="col-12 col-md-6">
                    <BilingualMcqOption
                      optionLetter="D"
                      urduContent={question.option_d_urdu}
                      englishContent={question.option_d}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-top" style={{ 
              marginBottom: '2px',
              direction: 'ltr'
            }}>
              <small className="text-muted" style={{
                fontFamily: "'Times New Roman', Times, serif",
                direction: 'ltr',
                textAlign: 'left',
                display: 'block',
                fontSize: '12px'
              }}>
                <i className="bi bi-tag me-1"></i>
                Chapter {chapterNo}
                {question.topic && ` • ${question.topic}`}
              </small>
            </div>
          </td>
        </tr>
      );
    } else {
      // For subjective questions (short and long)
      return (
        <div
          key={question.id}
          className={`question-item mb-1 p-3 border rounded ${isEditMode ? 'cursor-grab bg-light' : ''} ${
            draggedQuestion?.id === question.id ? 'dragging border-primary' : ''
          }`}
          draggable={isEditMode}
          onDragStart={(e) => handleDragStart(e, question.id, type)}
          onDragEnd={handleDragEnd}
          style={{ 
            transition: 'all 0.3s ease',
            position: 'relative',
            cursor: isEditMode ? 'grab' : 'default',
            marginBottom: '2px',
            direction: isUrduLanguage ? 'rtl' : 'ltr'
          }}
        >
          {isEditMode && (
            <div className="position-absolute top-0 start-0 m-2 text-muted" style={{ cursor: 'grab' }}>
              <i className="bi bi-grip-vertical fs-5"></i>
            </div>
          )}
          
          {/* First Row: Question Number, Chapter, and Marks */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center gap-3">
              <div className="question-number">
                <strong style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  direction: isUrduLanguage ? 'rtl' : 'ltr',
                  fontSize: '14px'
                }}>
                  {type === 'short' ? `(${index + 1})` : `Q.${index + 1}.`}
                </strong>
              </div>
              
              <div className="chapter-info">
                <small className="text-muted" style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  direction: isUrduLanguage ? 'rtl' : 'ltr',
                  fontSize: '12px'
                }}>
                  <i className="bi bi-tag me-1"></i>
                  Chapter {chapterNo}
                  {question.topic && ` • ${question.topic}`}
                </small>
              </div>
            </div>
            
            <div className="d-flex align-items-center gap-2">
              {isEditMode && (
                <div className="individual-marks-input">
                  <small className="text-muted me-1">Marks:</small>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: '70px' }}
                    value={question.customMarks || marksPerQuestion}
                    onChange={(e) => updateQuestionMarks(type, question.id, parseInt(e.target.value) || marksPerQuestion)}
                    min="1"
                  />
                </div>
              )}
              <span className="badge bg-secondary" style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '12px'
              }}>
                {question.customMarks || marksPerQuestion} marks
              </span>
            </div>
          </div>
          
          {/* Second Row: Question Statement Only */}
          <div className="question-statement mt-2">
            {isUrduLanguage && (
              <HtmlContent 
                content={question.question_text_urdu || question.question_text}
                className="urdu-text"
                isUrdu={true}
                style={{
                  fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                  direction: 'rtl',
                  fontSize: '16px',
                  lineHeight: '2',
                  textAlign: 'right',
                  marginBottom: '2px'
                }}
                dir="rtl"
              />
            )}
            
            {currentLanguage === 'english' && (
              <HtmlContent 
                content={question.question_text}
                style={{
                  fontFamily: "'Times New Roman', Times, serif",
                  direction: 'ltr',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  marginBottom: '2px'
                }}
                dir="ltr"
              />
            )}
            
            {isBilingual && (
              <div className="bilingual-stacked" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '20px',
                marginBottom: '2px'
              }}>
                <div className="english-version" style={{
                  flex: 1,
                  minWidth: 0
                }}>
                  <HtmlContent 
                    content={question.question_text}
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      fontSize: '14px',
                      lineHeight: '1.6',
                      textAlign: 'left',
                      marginBottom: '0'
                    }}
                    dir="ltr"
                  />
                </div>
                <div className="urdu-version" style={{
                  flex: 1,
                  minWidth: 0
                }}>
                  <HtmlContent 
                    content={question.question_text_urdu}
                    className="urdu-text"
                    isUrdu={true}
                    style={{
                      fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                      fontSize: '16px',
                      lineHeight: '2',
                      textAlign: 'right',
                      marginBottom: '0'
                    }}
                    dir="rtl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  const renderSection = (type: string, questions: Question[]) => {
    if (questions.length === 0) return null;
    
    const questionTypes = getQuestionTypes();
    const typeInfo = questionTypes.find(t => t.value === type);
    const typeLabel = typeInfo?.label || type;
    
    const toAttempt = getToAttemptForQuestionType(type);
    const marksPerQuestion = getMarksForQuestionType(type);
    const sectionMarks = calculateSectionMarks(type);
    
    let sectionTitle = '';
    let sectionNote = '';
    
    if (type === 'mcq') {
      sectionTitle = isUrduLanguage ? 'حصہ اول - معروضی سوالات' : 'SECTION A - MULTIPLE CHOICE QUESTIONS';
      sectionNote = !isUrduLanguage 
        ? 'Note: Four possible answers A, B, C and D to each question are given. Fill the correct option\'s circle. More than one filled circle will be treated wrong.'
        : 'نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔';
    } else if (type === 'short') {
      sectionTitle = isUrduLanguage ? 'حصہ دوم' : 'Part - I';
      sectionNote = isUrduLanguage
        ? 'حصہ دوم: مختصر جوابات لکھیں۔'
        : 'Part I. Write short answers.';
    } else if (type === 'long') {
      sectionTitle = isUrduLanguage ? 'حصہ سوم' : 'Part - II';
      sectionNote = isUrduLanguage
        ? 'حصہ سوم: تفصیلی جوابات لکھیں۔'
        : 'Part II. Write detailed answers.';
    } else {
      sectionTitle = typeLabel;
    }
    
    const direction = isUrduLanguage ? 'rtl' : 'ltr';
    const textAlign = isUrduLanguage ? 'right' : 'left';
    const fontFamily = isUrduLanguage 
      ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif" 
      : "'Times New Roman', Times, serif";
    
    return (
      <div key={type} className="section mb-4" style={{ marginBottom: '15px' }}>
        <div className="section-header mb-3">
          <h5 className="fw-bold mb-2" style={{ 
            fontSize: '14px', 
            color: '#2c3e50',
            fontFamily: fontFamily,
            direction: direction,
            textAlign: textAlign,
            marginBottom: '10px'
          }}>
            {sectionTitle}
            {type === 'mcq' && watch('mcqPlacement') === 'separate' && ' (ON SEPARATE PAGE)'}
          </h5>
          
          {sectionNote && (
            <div className="note p-3 bg-light rounded border mb-3" style={{ 
              fontSize: '12px', 
              lineHeight: isUrduLanguage ? '2' : '1.5',
              direction: direction,
              textAlign: textAlign,
              fontFamily: fontFamily
            }}>
              {sectionNote}
            </div>
          )}
          
          <div className="mt-2" style={{ 
            direction: 'ltr',
            textAlign: 'left',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '13px'
          }}>
            <h6 className="text-muted">
              {questions.length>toAttempt?`Attempt Any ${toAttempt} Questions`:'Attempt All Qestions'} . Each question carries {marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}.
          
            <span className="badge bg-primary ms-2" style={{ fontSize: '12px' }}>
              {toAttempt} × {marksPerQuestion} = {sectionMarks} marks
            </span>
              </h6>
          </div>
        </div>
        
        <div 
          className="questions-list"
          onDragOver={(e) => handleDragOver(e)}
          onDrop={(e) => handleDrop(e, type)}
          style={{ marginBottom: '2px' }}
        >
          {type === 'mcq' ? (
            <div className="table-responsive">
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                margin: '5px 0', 
                fontSize: '14px',
                direction: isUrduLanguage ? 'rtl' : 'ltr'
              }}>
                <tbody>
                  {questions.map((question, index) => renderQuestion(question, type, index))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {questions.map((question, index) => renderQuestion(question, type, index))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Show loading state while checking user subscription
  if (isLoadingUser) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <h5>Loading User Information...</h5>
        <p className="text-muted">Checking your subscription status</p>
      </div>
    );
  }

  const isPaidUser = trialStatus?.hasActiveSubscription || false;

  return (
    <form onSubmit={handleSubmit} className="step-transition">
      <div className="d-lg-none mobile-action-buttons">
        <div className="container">
          <div className="row g-2">
            <div className="col-6">
              <button 
                className="btn btn-success w-100" 
                type="submit" 
                disabled={isLoading || isLoadingPreview}
              >
                {isLoading ? (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                ) : (
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                )}
                <span className="d-sm-inline"> Paper</span>
              </button>
            </div>
            <div className="col-6">
              <button
                className="btn btn-info w-100 text-white"
                type="button"
                onClick={onDownloadKey}
                disabled={isLoading || isDownloadingKey || watch('mcqCount') === 0 || isLoadingPreview}
              >
                {isDownloadingKey ? (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                ) : (
                  <i className="bi bi-key me-1"></i>
                )}
                <span className="d-sm-inline"> Key</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className='row'>
        <div className="col-12 mb-3">
          {isEditMode && (
            <div className={`alert alert-warning mt-4 mx-3 edit-mode-alert ${
              isAlertVisible ? 'alert-enter' : 'alert-exit'
            }`}>
              <h6 className="fw-bold mb-2">
                <i className="bi bi-magic me-2"></i>
                Paper Editing Mode - Active
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <ul className="mb-2 small">
                    <li>📝 Drag questions within sections to reorder them</li>
                    <li>🎯 Adjust individual question marks using the input fields</li>
                    <li>🔢 Question numbers update automatically</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="mb-0 small">
                    <li>💾 Changes are saved for PDF generation</li>
                    <li>🔄 Use "Reset Order" to revert to original arrangement</li>
                    <li>👁️ Toggle off Edit Mode to see final paper layout</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="row">
        <div className="col-lg-8">
          <div className="card mb-4 border-0 shadow-sm">
            <div className="card-header bg-primary text-white sticky-top" style={{ top: '58px', zIndex: '10' }}>
              <div className="d-lg-none">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h2 className="h5 card-title mb-0">📋 Review</h2>
                  <div className="d-flex align-items-center gap-2">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="editModeToggleMobile"
                        checked={isEditMode}
                        onChange={(e) => setIsEditMode(e.target.checked)}
                      />
                      <label className="form-check-label text-white small" htmlFor="editModeToggleMobile">
                        {isEditMode ? '✏️' : '👁️'}
                      </label>
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        className="btn btn-warning btn-sm p-1"
                        onClick={loadPreviewQuestions}
                        title="Reset Order"
                      >
                        <i className="bi bi-arrow-clockwise"></i>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="d-flex justify-content-between mb-2">
                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-success btn-sm flex-fill" 
                      type="submit" 
                      disabled={isLoading || isLoadingPreview}
                    >
                      {isLoading ? (
                        <span className="spinner-border spinner-border-sm"></span>
                      ) : (
                        <>
                          <i className="bi bi-file-earmark-pdf me-1"></i>
                          Generate PDF
                        </>
                      )}
                    </button>
                    <button
                      className="btn btn-info btn-sm text-white flex-fill"
                      type="button"
                      onClick={onDownloadKey}
                      disabled={isLoading || isDownloadingKey || watch('mcqCount') === 0 || isLoadingPreview}
                    >
                      {isDownloadingKey ? (
                        <span className="spinner-border spinner-border-sm"></span>
                      ) : (
                        <>
                          <i className="bi bi-key me-1"></i>
                          Answer Key
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="d-none d-lg-flex justify-content-between align-items-center">
                <h2 className="h4 card-title mb-0">📋 Paper Final Review</h2>
                <div className="d-flex align-items-center gap-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      style={{ cursor: 'pointer' }}
                      type="checkbox"
                      id="editModeToggleDesktop"
                      checked={isEditMode}
                      onChange={(e) => setIsEditMode(e.target.checked)}
                    />
                    <label className="form-check-label text-white" htmlFor="editModeToggleDesktop" style={{ cursor: 'pointer' }}>
                      {isEditMode ? '✏️ Edit Mode' : '👁️ Preview'}
                    </label>
                  </div>
                  {isEditMode && (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm"
                      onClick={loadPreviewQuestions}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Reset Order
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="card-body p-0">
              {isLoadingPreview ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h5>Loading Questions...</h5>
                  <p className="text-muted">Preparing your paper Review</p>
                </div>
              ) : (
                <div 
                  className="paper-preview" 
                  style={{ 
                    fontFamily: isUrduLanguage ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif" : "'Times New Roman', Times, serif",
                    padding: '20px',
                    background: 'white',
                    minHeight: '800px',
                    maxWidth: '900px',
                    margin: '0 auto',
                    direction: isUrduLanguage ? 'rtl' : 'ltr',
                    textAlign: isUrduLanguage ? 'right' : 'left'
                  }}
                >
                  <div className="header text-center mb-1" style={{ fontSize: '13px' }}>
                    <div className="mb-3">
                      <h1 className="text-center mb-0" style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        direction: 'ltr'
                      }}>
                        <img src="/examly.jpg" className="header-img" height="40" width="100" alt="Examly"/>
                        <span style={{
                          fontFamily: "'algerian', 'Times New Roman', Times, serif",
                          fontSize: '14px',
                          display:'block',
                        }}>
                          {watch('title') || 'BOARD OF INTERMEDIATE AND SECONDARY EDUCATION'}
                        </span>
                      </h1>
                     
                      {watch('dateOfPaper') && (
                        <p className="mb-0 text-muted" style={{ 
                          fontSize: '12px',
                          fontFamily: "'Times New Roman', Times, serif",
                          direction: 'ltr'
                        }}>
                          Date: {formatDateForDisplay(watch('dateOfPaper'))}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className='table-responsive'>
                    <table style={{
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      border: 'none !important', 
                      marginBottom: '0px',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}>
                      <tbody>
                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>رول نمبر:۔۔۔۔۔۔</span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>سیکشن:۔۔۔۔۔۔</span>
                          </td>
                        </tr>

                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}><strong>کلاس: {classes.find(c => c.id === watch('classId'))?.name}</strong></span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>مضمون: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>تاریخ: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                          </td>
                        </tr>

                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>وقت: {watch('subjectiveTimeMinutes')} منٹ</span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>کل نمبر: {calculateTotalMarksFromQuestions()}</span>
                          </td>
                          <td style={{ border: 'none !important', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '14px',
                              display: 'block',
                              textAlign: 'right'
                            }}>{paperTypeText}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <hr style={{ borderColor: '#000', margin: '20px 0' }} />

                  <div className="questions-preview">
                    {Object.keys(previewQuestions).map((type) => 
                      renderSection(type, previewQuestions[type])
                    )}

                    {Object.keys(previewQuestions).length === 0 || Object.values(previewQuestions).every(q => q.length === 0) ? (
                      <div className="text-center py-5">
                        <i className="bi bi-inbox display-1 text-muted mb-3"></i>
                        <h5 style={{
                          fontFamily: "'Times New Roman', Times, serif",
                          direction: 'ltr'
                        }}>No Questions Found</h5>
                        <p className="text-muted" style={{
                          fontFamily: "'Times New Roman', Times, serif",
                          direction: 'ltr'
                        }}>
                          No questions match your current criteria. Try adjusting your chapter selection or difficulty settings.
                        </p>
                        <button 
                          className="btn btn-primary"
                          onClick={() => setStep(3)}
                        >
                          <i className="bi bi-arrow-left me-2"></i>
                          Adjust Chapter Selection
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Conditionally show watermark footer */}
                  {(!removeWatermark || !isPaidUser) && (
                    <div className="footer no-break" style={{ 
                      marginTop: '30px', 
                      textAlign: 'center', 
                      fontSize: '12px', 
                      color: '#666', 
                      borderTop: '1px solid #ccc', 
                      paddingTop: '10px',
                      opacity: removeWatermark && isPaidUser ? 0.5 : 1,
                      fontFamily: "'Times New Roman', Times, serif",
                      direction: 'ltr'
                    }}>
                      <p>
                        Generated on {new Date().toLocaleDateString()} | www.examly.pk | Generate papers Save Time
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card mb-4 border-0 shadow-sm sticky-top" style={{ top: '58px', zIndex: '1' }}>
            <div className="card-header bg-primary text-white">
              <h3 className="h5 card-title mb-0">🎯 Paper Controls</h3>
            </div>
            <div className="card-body">
              {/* Watermark Removal Checkbox - ALWAYS VISIBLE */}
              <div className="watermark-control mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="removeWatermark"
                    checked={removeWatermark}
                    onChange={handleWatermarkChange}
                    style={{ cursor: isPaidUser ? 'pointer' : 'not-allowed' }}
                  />
                  <label 
                    className="form-check-label d-flex align-items-center" 
                    htmlFor="removeWatermark"
                    style={{ cursor: isPaidUser ? 'pointer' : 'not-allowed' }}
                  >
                    <div>
                      <span className="fw-bold">Remove Watermark</span>
                      {!isPaidUser && (
                        <span className="badge bg-warning text-dark ms-2">Premium</span>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="action-buttons">
                <button 
                  className="btn btn-success w-100 btn-lg mb-3" 
                  type="submit" 
                  disabled={isLoading || isLoadingPreview}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      Generate Paper PDF
                    </>
                  )}
                </button>

                <button
                  className="btn btn-info w-100 text-white btn-lg mb-3"
                  type="button"
                  onClick={onDownloadKey}
                  disabled={isLoading || isDownloadingKey || watch('mcqCount') === 0 || isLoadingPreview}
                >
                  {isDownloadingKey ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Generating Key...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-key me-2"></i> Download Answer Key
                    </>
                  )}
                </button>
                
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <a href="/dashboard/generate-paper" className="btn btn-outline-primary w-100">
                      <PlusCircle className="me-2" size={20} />
                      New Paper
                    </a>
                  </div>
                  <div className="col-6">
                    <button 
                      className="btn btn-outline-secondary w-100" 
                      type="button" 
                      onClick={() => setStep(5)}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="me-2" size={20} /> 
                      Back
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="quick-stats mt-4 p-3 border rounded">
                <h6 className="fw-bold text-primary mb-3">📈 Question Statistics</h6>
                <div className="row text-center g-3">
                  {getQuestionTypes().map((type) => {
                    const questions = previewQuestions[type.value] || [];
                    if (questions.length === 0) return null;
                    
                    const attemptField = `${type.fieldPrefix}ToAttempt`;
                    const marksField = `${type.fieldPrefix}Marks`;
                    
                    const attemptValue = watch(attemptField) || 0;
                    const marksValue = watch(marksField) || 1;
                    
                    const sectionMarks = questions.slice(0, attemptValue).reduce((sum, q) => {
                      return sum + (q.customMarks || marksValue);
                    }, 0);
                    
                    return (
                      <div key={type.value} className="col-4">
                        <div className="fw-bold text-primary" style={{ fontSize: '13px' }}>{type.label}</div>
                        <div className="fw-bold" style={{ fontSize: '14px' }}>{attemptValue}/{questions.length}</div>
                        <small className="text-muted" style={{ fontSize: '11px' }}>(Attempt/Total)</small>
                        <div className="small text-success" style={{ fontSize: '12px' }}>
                          = {sectionMarks} marks
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Paper Type and MCQ Placement */}
                  <div className="col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '13px' }}>Paper Type</div>
                    <div className="fw-bold text-capitalize" style={{ fontSize: '12px' }}>
                      {watch('paperType') || 'Standard'}
                    </div>
                  </div>
                  
                  <div className="col-6">
                    <div className="fw-bold text-primary" style={{ fontSize: '13px' }}>Paper Layout</div>
                    <div className="fw-bold text-capitalize" style={{ fontSize: '12px' }}>
                      {(() => {
                        const mcqPlacement = watch('mcqPlacement') || 'mixed';
                        switch (mcqPlacement) {
                          case 'separate':
                            return 'Two Pages';
                          case 'mixed':
                            return 'Single Paper';
                          case 'two_papers':
                            return 'Two Papers';
                          case 'three_papers':
                            return 'Three Papers';
                          case 'mcq_only':
                            return 'MCQ Only';
                          case 'subjective_only':
                            return 'Subjective Only';
                          default:
                            return 'Mixed Layout';
                        }
                      })()}
                    </div>
                  </div>
                  
                  <div className="col-12 mt-2 pt-2 border-top">
                    <div className="fw-bold text-danger" style={{ fontSize: '16px' }}>
                      Total: {calculateTotalMarksFromQuestions()} Marks
                    </div>
                    <small className="text-muted" style={{ fontSize: '11px' }}>Based on "To Attempt" values</small>
                  </div>
                </div>
              </div>

              {isEditMode && (
                <div className="edit-tips mt-3 p-3 bg-warning bg-opacity-10 rounded border">
                  <h6 className="fw-bold mb-2">
                    <i className="bi bi-lightbulb me-2"></i>
                    Editing Tips
                  </h6>
                  <ul className="small mb-0">
                    <li>Drag questions to reorder within sections</li>
                    <li>Adjust marks for each question type</li>
                    <li>Changes reflect in real-time PDF</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global styles for HTML content */}
      <style jsx global>{`
        /* Urdu font classes */
        .urdu-text {
          font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif !important;
          font-size: 16px !important;
          line-height: 2 !important;
          text-align: right !important;
          direction: rtl !important;
          font-weight: normal !important;
          margin-bottom: 2px !important;
        }
        
        .english-text {
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 14px !important;
          line-height: 1.6 !important;
          text-align: left !important;
          direction: ltr !important;
          margin-bottom: 2px !important;
        }
        
        /* Fix for bilingual layout */
        .bilingual-question-wrapper {
          width: 100% !important;
          margin-bottom: 2px !important;
        }
        
        .bilingual-content {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          gap: 20px !important;
          width: 100% !important;
          margin-bottom: 2px !important;
        }
        
        .english-part, .urdu-part {
          flex: 1 !important;
          min-width: 0 !important;
          margin-bottom: 2px !important;
        }
        
        .english-part {
          text-align: left !important;
          direction: ltr !important;
        }
        
        .urdu-part {
          text-align: right !important;
          direction: rtl !important;
        }
        
        /* Fix for Urdu MCQ options alignment */
        .single-option[style*="direction: rtl"] .option-letter {
          order: 2 !important;
        }
        
        .single-option[style*="direction: rtl"] .option-content {
          order: 1 !important;
          margin-right: 8px !important;
          margin-left: 0 !important;
          text-align: right !important;
        }
        
        /* Fix for MCQ options on mobile */
        @media (max-width: 768px) {
          .options .row {
            margin: 0 !important;
          }
          
          .options .col-12 {
            padding: 0 !important;
          }
          
          .bilingual-option, .single-option {
            width: 100% !important;
            margin-bottom: 4px !important;
          }
          
          .option-content {
            margin-left: 10px !important;
          }
          
          .english-option, .urdu-option {
            padding: 0 5px !important;
          }
          
          .urdu-text {
            font-size: 14px !important;
            line-height: 1.8 !important;
          }
          
          .english-text {
            font-size: 12px !important;
            line-height: 1.4 !important;
          }
        }
        
        /* Remove margin from p tags */
        .english-option p,
        .urdu-option p,
        .english-part p,
        .urdu-part p,
        .question-text p,
        .english-text p,
        .urdu-text p {
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          padding: 0 !important;
        }
        
        /* Style for superscript and subscript */
        sub, sup {
          font-size: 0.75em !important;
          line-height: 0 !important;
          position: relative !important;
          vertical-align: baseline !important;
        }
        
        sup {
          top: -0.5em !important;
        }
        
        sub {
          bottom: -0.25em !important;
        }
        
        /* Ensure proper RTL support */
        [dir="rtl"] {
          text-align: right !important;
        }
        
        [dir="ltr"] {
          text-align: left !important;
        }
        
        /* Table cell alignment fix */
        td[dir="rtl"] {
          text-align: right !important;
        }
        
        td[dir="ltr"] {
          text-align: left !important;
        }
        
        /* Question item spacing */
        .question-item {
          margin-bottom: 2px !important;
        }
        
        /* Professional paper styling */
        .paper-preview {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid #e0e0e0 !important;
        }
        
        .section-header {
          border-bottom: 2px solid #4a6fa5 !important;
          padding-bottom: 8px !important;
        }
        
        .note {
          background-color: #f8f9fa !important;
          border-left: 4px solid #4a6fa5 !important;
        }
      `}</style>
    </form>
  );
};

// Helper component for bilingual question rendering (needed for renderQuestion)
const BilingualQuestionText: React.FC<{
  urduText: string | undefined;
  englishText: string | undefined;
  className?: string;
}> = ({ urduText, englishText, className }) => {
  return (
    <div className={`bilingual-question-wrapper ${className || ''}`}>
      <div className="bilingual-content" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
        width: '100%',
        marginBottom: '2px'
      }}>
        {englishText && (
          <div className="english-part" style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'left'
          }}>
            <HtmlContent 
              content={englishText}
              className="fw-bold english-text"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                fontSize: '14px',
                lineHeight: '1.6',
                textAlign: 'left',
                marginBottom: '0'
              }}
              dir="ltr"
            />
          </div>
        )}
        {urduText && (
          <div className="urdu-part" style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'right'
          }}>
            <HtmlContent 
              content={urduText}
              className="fw-bold urdu-text"
              isUrdu={true}
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                fontSize: '16px',
                lineHeight: '2',
                textAlign: 'right',
                fontWeight: 'bold',
                marginBottom: '0'
              }}
              dir="rtl"
            />
          </div>
        )}
      </div>
    </div>
  );
};
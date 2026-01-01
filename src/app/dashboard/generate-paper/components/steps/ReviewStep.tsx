// ReviewStep.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Question, Chapter } from '@/types/types';
import { useUser } from '@/app/context/userContext';

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
  resetForm?: () => void; // Added resetForm prop
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void; // Add toast function prop
}

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

  // Calculate total marks for a specific type (for summary)
  const calculateTotalForType = (type: string) => {
    const toAttempt = getToAttemptForQuestionType(type);
    const marksPerQuestion = getMarksForQuestionType(type);
    return toAttempt * marksPerQuestion;
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

  const handleNewPaper = () => {
    // Reset all states
    setPreviewQuestions({});
    setIsEditMode(false);
    setRemoveWatermark(false);
    
    // Call resetForm if provided
    if (resetForm) {
      resetForm();
    }
    
    // Navigate to initial step (step 1)
    setStep(1);
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
            cursor: isEditMode ? 'grab' : 'default'
          }}
        >
          <td className="qnum" style={{ 
            width: '40px', 
            textAlign: 'center', 
            fontWeight: 'bold',
            border: '1px solid #000',
            padding: '8px',
            verticalAlign: 'top',
            position: 'relative'
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
            verticalAlign: 'top'
          }}>
            <div className="question" style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '0 0 10px 0'
            }}>
              <div className="flex-grow-1">
                {watch('language') === 'english' && (
                  <span className="fw-bold" style={{
                    fontFamily: "'Times New Roman', serif",
                    direction: 'ltr',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>{question.question_text}</span>
                )}
                
                {watch('language') === 'urdu' && (
                  <span className="fw-bold" style={{
                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                    direction: 'rtl',
                    fontSize: '14px',
                    lineHeight: '1.8'
                  }}>{question.question_text_urdu || question.question_text}</span>
                )}
                
                {watch('language') === 'bilingual' && (
                  <div className="d-flex justify-content-between">
                    <div className="fw-bold" style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      direction: 'rtl',
                      fontSize: '14px',
                      lineHeight: '1.8'
                    }}>{question.question_text_urdu}</div>
                    <div className="fw-bold" style={{
                      fontFamily: "'Times New Roman', serif",
                      direction: 'ltr',
                      fontSize: '14px',
                      lineHeight: '1.4',
                      marginBottom: '8px'
                    }}>{question.question_text_english || question.question_text}</div>
                  </div>
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
              marginTop: '8px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '12px',
              flexWrap: 'wrap',
              gap: '15px'
            }}>
              {question.option_a && (
                <span className="option-item d-flex justify-content-between">
                  <span> (A).  </span> 
                  {watch('language') === 'english' && (
                    <span style={{
                      fontFamily: "'Times New Roman', serif",
                      direction: 'ltr'
                    }}> {question.option_a}</span>
                  )}
                  {watch('language') === 'urdu' && (
                    <span style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      direction: 'rtl'
                    }}> {question.option_a_urdu || question.option_a}</span>
                  )}
                  {watch('language') === 'bilingual' && (
                    <span className="d-flex justify-content-between">
                      <span className="d-block" style={{
                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        direction: 'rtl'
                      }}> {question.option_a_urdu}</span> &nbsp; 
                      <span className="d-block" style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr',
                        marginBottom: '2px'
                      }}> {question.option_a_english || question.option_a}</span>
                    </span>
                  )}
                </span>
              )}
              {question.option_b && (
                <span className="option-item d-flex justify-content-between">
                  <span>(B). </span> 
                  {watch('language') === 'english' && (
                    <span style={{
                      fontFamily: "'Times New Roman', serif",
                      direction: 'ltr'
                    }}> {question.option_b}</span>
                  )}
                  {watch('language') === 'urdu' && (
                    <span style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      direction: 'rtl'
                    }}> {question.option_b_urdu || question.option_b}</span>
                  )}
                  {watch('language') === 'bilingual' && (
                    <span className="d-flex justify-content-between">
                      <span className="d-block" style={{
                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        direction: 'rtl'
                      }}> {question.option_b_urdu}</span> &nbsp;
                      <span className="d-block" style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr',
                        marginBottom: '2px'
                      }}> {question.option_b_english || question.option_b}</span>
                    </span>
                  )}
                </span>
              )}
              {question.option_c && (
                <span className="option-item d-flex justify-content-between">
                  <span> (C). </span>  
                  {watch('language') === 'english' && (
                    <span style={{
                      fontFamily: "'Times New Roman', serif",
                      direction: 'ltr'
                    }}> {question.option_c}</span>
                  )}
                  {watch('language') === 'urdu' && (
                    <span style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      direction: 'rtl'
                    }}> {question.option_c_urdu || question.option_c}</span>
                  )}
                  {watch('language') === 'bilingual' && (
                    <span className="d-flex justify-content-between">
                      <span className="d-block" style={{
                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        direction: 'rtl'
                      }}> {question.option_c_urdu}.</span> &nbsp;
                      <span className="d-block" style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr',
                        marginBottom: '2px'
                      }}> {question.option_c_english || question.option_c}</span>
                    </span>
                  )}
                </span>
              )}
              {question.option_d && (
                <span className="option-item d-flex justify-content-between">
                  <span>(D). </span>  
                  {watch('language') === 'english' && (
                    <span style={{
                      fontFamily: "'Times New Roman', serif",
                      direction: 'ltr'
                    }}> {question.option_d}</span>
                  )}
                  {watch('language') === 'urdu' && (
                    <span style={{
                      fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                      direction: 'rtl'
                    }}> {question.option_d_urdu || question.option_d}</span>
                  )}
                  {watch('language') === 'bilingual' && (
                    <span className="d-flex justify-content-between">
                      <span className="d-block" style={{
                        fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                        direction: 'rtl'
                      }}> {question.option_d_urdu}.</span> &nbsp;
                      <span className="d-block" style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr',
                        marginBottom: '2px'
                      }}> {question.option_d_english || question.option_d}.</span>
                    </span>
                  )}
                </span>
              )}
            </div>
            
            <div className="mt-2 pt-2 border-top text-start">
              <small className="text-muted" style={{
                fontFamily: "'Times New Roman', serif",
                direction: 'ltr', textAlign: 'left'
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
          className={`question-item mb-4 p-3 border rounded ${isEditMode ? 'cursor-grab bg-light' : ''} ${
            draggedQuestion?.id === question.id ? 'dragging border-primary' : ''
          }`}
          draggable={isEditMode}
          onDragStart={(e) => handleDragStart(e, question.id, type)}
          onDragEnd={handleDragEnd}
          style={{ 
            transition: 'all 0.3s ease',
            position: 'relative',
            cursor: isEditMode ? 'grab' : 'default'
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
                  fontFamily: "'Times New Roman', serif",
                  direction: 'ltr',
                  fontSize: '14px'
                }}>
                  {type === 'short' ? `(${index + 1})` : `Q.${index + 1}.`}
                </strong>
              </div>
              
              <div className="chapter-info">
                <small className="text-muted" style={{
                  fontFamily: "'Times New Roman', serif",
                  direction: 'ltr'
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
              <span className="badge bg-secondary">{question.customMarks || marksPerQuestion} marks</span>
            </div>
          </div>
          
          {/* Second Row: Question Statement Only */}
          <div className="question-statement mt-3">
            {watch('language') === 'english' && (
              <div style={{
                fontFamily: "'Times New Roman', serif",
                direction: 'ltr',
                fontSize: '14px',
                lineHeight: '1.4'
              }}>
                {question.question_text}
              </div>
            )}
            
            {watch('language') === 'urdu' && (
              <div style={{
                fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                direction: 'rtl',
                fontSize: '14px',
                lineHeight: '1.8',
                textAlign: 'right'
              }}>
                {question.question_text_urdu || question.question_text}
              </div>
            )}
            
            {watch('language') === 'bilingual' && (
              <div className="bilingual-stacked d-flex justify-content-between">
                <div className="d-md-none w-100">
                  <div className="urdu-version mb-2" style={{
                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                    direction: 'rtl',
                    fontSize: '14px',
                    lineHeight: '1.8',
                    textAlign: 'right'
                  }}>
                    {question.question_text_urdu}
                  </div>
                  <div className="english-version" style={{
                    fontFamily: "'Times New Roman', serif",
                    direction: 'ltr',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}>
                    {question.question_text_english || question.question_text}
                  </div>
                </div>
                
                <div className="d-none d-md-flex w-100">
                  <div className="english-version" style={{
                    fontFamily: "'Times New Roman', serif",
                    direction: 'ltr',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    flex: 1,
                    paddingRight: '15px'
                  }}>
                    {question.question_text_english || question.question_text}
                  </div>
                  <div className="urdu-version" style={{
                    fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                    direction: 'rtl',
                    fontSize: '14px',
                    lineHeight: '1.8',
                    textAlign: 'right',
                    flex: 1,
                    paddingLeft: '15px'
                  }}>
                    {question.question_text_urdu}
                  </div>
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
      sectionTitle = 'SECTION A - MULTIPLE CHOICE QUESTIONS';
      sectionNote = watch('language') !== 'english' 
        ? 'نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔'
        : 'Note: Four possible answers A, B, C and D to each question are given. Fill the correct option\'s circle. More than one filled circle will be treated wrong.';
    } else if (type === 'short') {
      sectionTitle = 'Part - I / حصہ اول';
      sectionNote = watch('language') !== 'english'
        ? 'حصہ اول: مختصر جوابات لکھیں۔'
        : 'Part I. Write short answers.';
    } else if (type === 'long') {
      sectionTitle = 'Part - II / حصہ دوم';
      sectionNote = watch('language') !== 'english'
        ? 'حصہ دوم: تفصیلی جوابات لکھیں۔'
        : 'Part II. Write detailed answers.';
    } else {
      sectionTitle = typeLabel;
    }
    
    return (
      <div key={type} className="section mb-5">
        <div className="section-header mb-3">
          <h5 className="fw-bold mb-2" style={{ 
            fontSize: '14px', 
            color: '#2c3e50',
            fontFamily: "'Times New Roman', serif",
            direction: 'ltr'
          }}>
            {sectionTitle}
            {type === 'mcq' && watch('mcqPlacement') === 'separate' && ' (ON SEPARATE PAGE)'}
          </h5>
          
          {sectionNote && (
            <div className="note p-3 bg-light rounded border mb-3" style={{ fontSize: '12px', lineHeight: '1.2' }}>
              {watch('language') !== 'english' && type === 'mcq' && (
                <p className="mb-1" style={{
                  fontFamily: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif",
                  direction: 'rtl',
                  fontSize: '14px',
                  lineHeight: '1.8'
                }}>
                  {sectionNote}
                </p>
              )}
              {watch('language') !== 'urdu' && type === 'mcq' && (
                <p className="mb-0" style={{
                  fontFamily: "'Times New Roman', serif",
                  direction: 'ltr',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  {sectionNote}
                </p>
              )}
              {type !== 'mcq' && (
                <p className="mb-0" style={{
                  fontFamily: watch('language') === 'urdu' ? "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif" : "'Times New Roman', serif",
                  direction: watch('language') === 'urdu' ? 'rtl' : 'ltr',
                  fontSize: '14px',
                  lineHeight: watch('language') === 'urdu' ? '1.8' : '1.4'
                }}>
                  {sectionNote}
                </p>
              )}
            </div>
          )}
          
          <div className="mt-2">
            <small className="text-muted" style={{
              fontFamily: "'Times New Roman', serif",
              direction: 'ltr'
            }}>
              {toAttempt} of {questions.length} questions to attempt. Each question carries {marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}.
            </small>
            <span className="badge bg-primary ms-2">
              {toAttempt} × {marksPerQuestion} = {sectionMarks} marks
            </span>
          </div>
        </div>
        
        <div 
          className="questions-list"
          onDragOver={(e) => handleDragOver(e)}
          onDrop={(e) => handleDrop(e, type)}
        >
          {type === 'mcq' ? (
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              margin: '10px 0', 
              fontSize: '14px',
              direction: watch('language') === 'english' ? 'ltr' : 'rtl'
            }}>
              <tbody>
                {questions.map((question, index) => renderQuestion(question, type, index))}
              </tbody>
            </table>
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
                <div className="d-flex align-items-center gap-3"  >
                  <div className="form-check form-switch" >
                    <input
                      className="form-check-input "
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
                    fontFamily: 'Arial, sans-serif',
                    padding: '20px',
                    background: 'white',
                    minHeight: '800px',
                    maxWidth: '900px',
                    margin: '0 auto'
                  }}
                >
                  <div className="header text-center mb-1" style={{ fontSize: '13px' }}>
                    <div className="mb-3">
                      <h1 className="text-center mb-2" style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr'
                      }}>
                        <img src="/examly.jpg" className="header-img" height="40" width="100" alt="Examly"/>
                        <span style={{
                          fontFamily: "'algerian', 'Times New Roman', serif",
                          fontSize: '14px',
                          display:'block',
                        }}>
                          {watch('title') || 'BOARD OF INTERMEDIATE AND SECONDARY EDUCATION'}
                        </span>
                      </h1>
                     
                      {watch('dateOfPaper') && (
                        <p className="mb-0 text-muted" style={{ 
                          fontSize: '12px',
                          fontFamily: "'Times New Roman', serif",
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
                      fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Sans',Arial,sans-serif",
                      marginBottom: '20px',
                      direction: watch('language') === 'bilingual' || watch('language') === 'urdu' ? 'rtl' : 'ltr'
                    }}>
                      <tbody>
                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Student Name:_________</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>رول نمبر:۔۔۔۔۔۔</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Roll No:_________</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>سیکشن:۔۔۔۔۔۔</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Section:_______</span>
                            )}
                          </td>
                        </tr>

                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}><strong>کلاس: {classes.find(c => c.id === watch('classId'))?.name}</strong></span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Class: {classes.find(c => c.id === watch('classId'))?.name}</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>مضمون: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Subject: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>تاریخ: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Date: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                            )}
                          </td>
                        </tr>

                        <tr style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1.5 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>وقت: {watch('subjectiveTimeMinutes')} منٹ</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Time Allowed: {watch('subjectiveTimeMinutes')} Minutes</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>کل نمبر: {calculateTotalMarksFromQuestions()}</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Maximum Marks: {calculateTotalMarksFromQuestions()}</span>
                            )}
                          </td>
                          <td style={{ border: 'none !important', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                            {watch('language') !== 'english' && (
                              <span style={{
                                fontFamily: "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif",
                                direction: 'rtl',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>حصہ انشائیہ</span>
                            )}
                            {watch('language') !== 'urdu' && (
                              <span style={{
                                fontFamily: "'Noto Sans',Arial,sans-serif",
                                direction: 'ltr',
                                fontSize: '12px',
                                verticalAlign: 'middle'
                              }}>Subjective Part</span>
                            )}
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
                          fontFamily: "'Times New Roman', serif",
                          direction: 'ltr'
                        }}>No Questions Found</h5>
                        <p className="text-muted" style={{
                          fontFamily: "'Times New Roman', serif",
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
                      opacity: removeWatermark && isPaidUser ? 0.5 : 1
                    }}>
                      <p style={{
                        fontFamily: "'Times New Roman', serif",
                        direction: 'ltr'
                      }}>
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
              <div className="watermark-control mb-2">
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
                      <span className="fw-bold">Remove Watermark  {!isPaidUser && (
                      <span className="badge bg-warning text-dark ms-2">Premium</span>
                    )}</span>
                     
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
                    <button 
                      className="btn btn-outline-primary w-100" 
                      type="button" 
                      onClick={handleNewPaper}
                      disabled={isLoading}
                    >
                      <i className="bi bi-plus-circle me-2"></i>
                      New Paper
                    </button>
                  </div>
                  <div className="col-6">
                    <button 
                      className="btn btn-outline-secondary w-100" 
                      type="button" 
                      onClick={() => setStep(5)}
                      disabled={isLoading}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
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
                        <div className="fw-bold text-primary">{type.label}</div>
                        <div className="fw-bold">{attemptValue}/{questions.length}</div>
                        <small className="text-muted">(Attempt/Total)</small>
                        <div className="small text-success">
                          = {sectionMarks} marks
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="col-12">
                    <div className="fw-bold text-danger fs-5">
                      Total: {calculateTotalMarksFromQuestions()} Marks
                    </div>
                    <small className="text-muted">Based on "To Attempt" values</small>
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
    </form>
  );
};
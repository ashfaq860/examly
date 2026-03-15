// ReviewStep.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Question, Chapter } from '@/types/types';
import { useUser } from '@/app/context/userContext';
import { PlusCircle, ArrowLeft, Printer } from 'lucide-react';

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
}> = ({ content, className, style, dir, isUrdu = false, marginBottom = '0px' }) => {
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

// Helper component for bilingual MCQ option rendering - FIXED FOR RIGHT SIDE LETTERS
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
  
  // For bilingual and Urdu, show option letter on right side
  if (isUrduLanguage || isBilingual) {
    return (
      <div className={`single-option ${className || ''}`} style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        direction: 'rtl',
        gap: '8px'
      }}>
        {/* Option letter on right side for Urdu/bilingual */}
        <span style={{
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: '11px',
          fontWeight: 'bold',
          minWidth: '20px',
          textAlign: 'center',
          flexShrink: 0
        }}>
          ({optionLetter})
        </span>
        <div className="option-content" style={{ 
          flex: 1,
          textAlign: 'right',
          direction: 'rtl',
          minWidth: 0
        }}>
          {isBilingual && showUrdu && showEnglish ? (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              gap: '10px',
              direction: 'rtl'
            }}>
              <div className="urdu-option" style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'right',
                direction: 'rtl'
              }}>
                <HtmlContent 
                  content={cleanUrduContent}
                  className="urdu-text"
                  isUrdu={true}
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                    fontSize: '12px',
                    lineHeight: '1.8',
                    textAlign: 'right',
                    marginBottom: '0'
                  }}
                  dir="rtl"
                />
              </div>
              <div className="english-option" style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                direction: 'ltr'
              }}>
                <HtmlContent 
                  content={cleanEnglishContent}
                  style={{
                    fontFamily: "'Times New Roman', Times, serif",
                    fontSize: '11px',
                    lineHeight: '1.3',
                    textAlign: 'left',
                    marginBottom: '0'
                  }}
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <HtmlContent 
              content={isUrduLanguage ? cleanUrduContent : cleanEnglishContent}
              className={isUrduLanguage ? "urdu-text" : ""}
              isUrdu={isUrduLanguage}
              style={{
                fontFamily: isUrduLanguage 
                  ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif"
                  : "'Times New Roman', Times, serif",
                fontSize: isUrduLanguage ? '12px' : '11px',
                lineHeight: isUrduLanguage ? '1.8' : '1.3',
                textAlign: 'right',
                marginBottom: '0'
              }}
              dir={isUrduLanguage ? "rtl" : "ltr"}
            />
          )}
        </div>
      </div>
    );
  }
  
  // English only - Option letter on left side
  return (
    <div className={`single-option ${className || ''}`} style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      direction: 'ltr',
      gap: '8px'
    }}>
      {/* Option letter on left side for English */}
      <span style={{
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: '11px',
        fontWeight: 'bold',
        minWidth: '20px',
        textAlign: 'center',
        flexShrink: 0
      }}>
        ({optionLetter})
      </span>
      <div className="option-content" style={{ 
        flex: 1,
        textAlign: 'left',
        direction: 'ltr',
        minWidth: 0
      }}>
        <HtmlContent 
          content={cleanEnglishContent}
          style={{
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '11px',
            lineHeight: '1.3',
            marginBottom: '0'
          }}
          dir="ltr"
        />
      </div>
    </div>
  );
};

// Helper component for bilingual question rendering
const BilingualQuestionText: React.FC<{
  urduText: string | undefined;
  englishText: string | undefined;
  className?: string;
}> = ({ urduText, englishText, className }) => {
  return (
    <div className={`bilingual-question-wrapper ${className || ''}`} style={{
      width: '100%',
      marginBottom: '4px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '20px'
    }}>
      {/* English version - left */}
      {englishText && (
        <div className="english-part" style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          direction: 'ltr'
        }}>
          <HtmlContent 
            content={englishText}
            className="english-text"
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '12px',
              lineHeight: '1.4',
              textAlign: 'left',
              marginBottom: '0'
            }}
            dir="ltr"
          />
        </div>
      )}
      
      {/* Urdu version - right */}
      {urduText && (
        <div className="urdu-part" style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'right',
          direction: 'rtl'
        }}>
          <HtmlContent 
            content={urduText}
            className="urdu-text"
            isUrdu={true}
            style={{
              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
              fontSize: '13px',
              lineHeight: '2',
              textAlign: 'right',
              marginBottom: '0'
            }}
            dir="rtl"
          />
        </div>
      )}
    </div>
  );
};

// Helper function to generate unique keys
const generateUniqueKey = (question: Question, type: string, index: number) => {
  return `${type}-${question.id}-${index}`;
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
  
  // Sort question types to always show MCQ first
  const sortedQuestionTypes = React.useMemo(() => {
    const types = getQuestionTypes();
    // Move MCQ to the beginning if it exists
    const mcqIndex = types.findIndex(t => t.value === 'mcq');
    if (mcqIndex > -1) {
      const mcq = types[mcqIndex];
      const otherTypes = types.filter(t => t.value !== 'mcq');
      return [mcq, ...otherTypes];
    }
    return types;
  }, [getQuestionTypes]);

  // Get current language
  const currentLanguage = watch('language') || 'english';
  const isUrduLanguage = currentLanguage === 'urdu';
  const isBilingual = currentLanguage === 'bilingual';
  const mcqPlacement = watch('mcqPlacement') || 'separate';
  
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

  // Handle print paper functionality
  const handlePrintPaper = () => {
    const paperPreview = document.querySelector('.paper-preview') as HTMLElement;
    if (!paperPreview) {
      if (showToast) {
        showToast('Paper preview not found', 'error');
      }
      return;
    }

    // Clone the paper content for printing
    const printContent = paperPreview.cloneNode(true) as HTMLElement;
    
    // Remove edit mode elements
    const dragHandles = printContent.querySelectorAll('.position-absolute');
    dragHandles.forEach(handle => handle.remove());
    
    // Remove edit mode inputs
    const marksInputs = printContent.querySelectorAll('.individual-marks-input');
    marksInputs.forEach(input => input.remove());
    
    // Remove any alert messages
    const alerts = printContent.querySelectorAll('.alert');
    alerts.forEach(alert => alert.remove());
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (showToast) {
        showToast('Please allow pop-ups to print the paper', 'warning');
      } else {
        alert('Please allow pop-ups to print the paper');
      }
      return;
    }
    
    // Get paper details
    const paperTitle = watch('title') || 'Paper';
    const subject = subjects.find(s => s.id === watch('subjectId'))?.name || '';
    const className = classes.find(c => c.id === watch('classId'))?.name || '';
    const dateOfPaper = watch('dateOfPaper') ? formatDateForDisplay(watch('dateOfPaper')) : '';
    
    // Determine CSS based on mcqPlacement
    let placementCSS = '';
    let bodyClass = '';
    
    switch(mcqPlacement) {
      case 'two_page':
        placementCSS = `
          @page { 
            size: A4; 
            margin: 10mm; 
          }
          body { 
            column-count: 2; 
            column-gap: 15mm; 
            font-size: 9px !important;
          }
          .paper-container { 
            break-inside: avoid; 
            page-break-inside: avoid;
            margin-bottom: 15mm;
          }
        `;
        bodyClass = 'two-page-print';
        break;
        
      case 'three_page':
        placementCSS = `
          @page { 
            size: A4; 
            margin: 8mm; 
          }
          body { 
            column-count: 3; 
            column-gap: 10mm; 
            font-size: 8px !important;
          }
          .paper-container { 
            break-inside: avoid; 
            page-break-inside: avoid;
            margin-bottom: 10mm;
          }
        `;
        bodyClass = 'three-page-print';
        break;
        
      case 'separate':
        placementCSS = `
          @page { 
            size: A4; 
            margin: 20mm; 
          }
          .mcq-section { 
            page-break-after: always; 
          }
          .subjective-section { 
            page-break-before: always; 
          }
        `;
        break;
        
      default: // 'same'
        placementCSS = `
          @page { 
            size: A4; 
            margin: 20mm; 
          }
          .section { 
            page-break-inside: avoid; 
          }
        `;
    }
    
    // Add section classes for page breaks
    const sections = printContent.querySelectorAll('.section');
    sections.forEach((section, index) => {
      const sectionType = section.querySelector('h5')?.textContent?.toLowerCase() || '';
      if (sectionType.includes('mcq') || sectionType.includes('معروضی')) {
        section.classList.add('mcq-section');
      } else {
        section.classList.add('subjective-section');
      }
    });
    
    // Write print content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${currentLanguage}">
      <head>
        <title>Print - ${paperTitle}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Reset and base styles */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.4;
            color: #000;
            background: #fff;
            ${mcqPlacement === 'two_page' || mcqPlacement === 'three_page' ? 'padding: 5mm;' : ''}
          }
          
          ${placementCSS}
          
          /* Paper container styling */
          .paper-container {
            background: white;
            ${mcqPlacement === 'two_page' || mcqPlacement === 'three_page' ? '' : 'padding: 20px;'}
            box-shadow: none;
            border: none;
          }
          
          /* Header styling */
          .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          
          .header-img {
            max-width: 150px;
            height: auto;
          }
          
          /* Urdu font styling */
          .urdu-text {
            font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif !important;
            font-size: ${mcqPlacement === 'two_page' ? '10px' : mcqPlacement === 'three_page' ? '9px' : '13px'} !important;
            line-height: 2 !important;
            text-align: right !important;
            direction: rtl !important;
          }
          
          /* English font styling */
          .english-text {
            font-family: 'Times New Roman', Times, serif !important;
            font-size: ${mcqPlacement === 'two_page' ? '10px' : mcqPlacement === 'three_page' ? '9px' : '12px'} !important;
            line-height: 1.4 !important;
            text-align: left !important;
            direction: ltr !important;
          }
          
          /* Table styling for MCQ */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: ${mcqPlacement === 'two_page' ? '9px' : mcqPlacement === 'three_page' ? '8px' : '12px'};
            ${isUrduLanguage || isBilingual ? 'direction: rtl; text-align: right;' : 'direction: ltr; text-align: left;'}
          }
          
          table th,
          table td {
            border: 1px solid #000;
            padding: ${mcqPlacement === 'two_page' ? '2px 4px' : mcqPlacement === 'three_page' ? '1px 2px' : '6px 8px'};
            vertical-align: top;
          }
          
          .qnum {
            width: 25px;
            text-align: center;
            font-weight: bold;
          }
          
          /* MCQ options */
          .options .row {
            margin: 0 -2px;
          }
          
          .options .col-3 {
            padding: 0 2px;
          }
          
          /* Section headers */
          .section-header {
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 2px solid #4a6fa5;
          }
          
          /* Question items */
          .question-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Footer */
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ccc;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
          
          /* Print-specific styles */
          @media print {
            .no-print {
              display: none !important;
            }
            
            .paper-container {
              width: 100%;
              margin: 0;
              padding: 0;
            }
            
            .cut-line {
              display: ${mcqPlacement === 'two_page' || mcqPlacement === 'three_page' ? 'flex' : 'none'};
              align-items: center;
              margin: 10px 0;
              color: #999;
              font-size: 12px;
            }
            
            .cut-line hr {
              flex: 1;
              border-top: 2px dashed #ccc;
              margin: 0 10px;
            }
          }
          
          /* Responsive adjustments */
          @media (max-width: 768px) {
            body {
              ${mcqPlacement === 'two_page' || mcqPlacement === 'three_page' ? 'column-count: 1 !important;' : ''}
            }
          }
        </style>
      </head>
      <body class="${bodyClass}">
        <div class="paper-container">
          ${printContent.innerHTML}
        </div>
        
        ${mcqPlacement === 'two_page' || mcqPlacement === 'three_page' ? `
          <div class="cut-line">
            <span>✂</span>
            <hr>
          </div>
          <div class="paper-container">
            ${printContent.innerHTML}
          </div>
          ${mcqPlacement === 'three_page' ? `
            <div class="cut-line">
              <span>✂</span>
              <hr>
            </div>
            <div class="paper-container">
              ${printContent.innerHTML}
            </div>
          ` : ''}
        ` : ''}
        
        <script>
          // Auto-print and close
          window.onload = function() {
            window.focus();
            window.print();
            
            // Close window after printing
            setTimeout(function() {
              window.close();
            }, 500);
          };
          
          // Handle before print event
          window.onbeforeprint = function() {
            // Add any pre-print adjustments here
          };
          
          // Handle after print event
          window.onafterprint = function() {
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
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

  const renderMCQQuestion = (question: Question, index: number) => {
    const marksPerQuestion = getMarksForQuestionType('mcq');
    const chapterInfo = chapters.find(c => c.id === question.chapter_id);
    const chapterNo = chapterInfo?.chapterNo || '1';

    // Determine table direction - always RTL for Urdu and bilingual
    const tableDirection = (isUrduLanguage || isBilingual) ? 'rtl' : 'ltr';
    const textAlign = (isUrduLanguage || isBilingual) ? 'right' : 'left';

    return (
      <tr 
        key={generateUniqueKey(question, 'mcq', index)}
        className={`question-item ${isEditMode ? 'cursor-grab' : ''} ${
          draggedQuestion?.id === question.id ? 'dragging' : ''
        }`}
        draggable={isEditMode}
        onDragStart={(e) => handleDragStart(e, question.id, 'mcq')}
        onDragEnd={handleDragEnd}
        style={{ 
          transition: 'all 0.3s ease',
          cursor: isEditMode ? 'grab' : 'default',
          marginBottom: '0',
          borderBottom: '1px solid #eee'
        }}
      >
        <td className="qnum" style={{ 
          width: '30px', 
          textAlign: 'center', 
          fontWeight: 'bold',
          border: '1px solid #000',
          padding: '6px 2px',
          verticalAlign: 'top',
          position: 'relative',
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: '12px'
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
          padding: '10px 12px',
          verticalAlign: 'top',
          direction: tableDirection,
          textAlign: textAlign
        }}>
          {/* Question Text */}
          <div className="question" style={{ 
            margin: '0 0 12px 0',
            direction: tableDirection,
            textAlign: textAlign
          }}>
            <div className="flex-grow-1" style={{ width: '100%' }}>
              {isUrduLanguage && (
                <HtmlContent 
                  content={question.question_text_urdu || question.question_text}
                  className="fw-bold urdu-text"
                  isUrdu={true}
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                    fontSize: '13px',
                    lineHeight: '2',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    marginBottom: '0'
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
                    fontSize: '12px',
                    lineHeight: '1.4',
                    textAlign: 'left',
                    marginBottom: '0'
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
          </div>
          
          {/* Options in 4 columns */}
          <div className="options" style={{ 
            marginTop: '10px',
            direction: tableDirection
          }}>
            <div className="row g-1" style={{ 
              margin: '0 -4px',
              direction: tableDirection
            }}>
              {question.option_a && (
                <div className="col-3" style={{ 
                  padding: '0 4px',
                  direction: tableDirection,
                  textAlign: textAlign
                }}>
                  <div style={{ 
                    height: '100%',
                    direction: tableDirection,
                    textAlign: textAlign
                  }}>
                    <BilingualMcqOption
                      optionLetter="A"
                      urduContent={question.option_a_urdu}
                      englishContent={question.option_a}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                </div>
              )}
              {question.option_b && (
                <div className="col-3" style={{ 
                  padding: '0 4px',
                  direction: tableDirection,
                  textAlign: textAlign
                }}>
                  <div style={{ 
                    height: '100%',
                    direction: tableDirection,
                    textAlign: textAlign
                  }}>
                    <BilingualMcqOption
                      optionLetter="B"
                      urduContent={question.option_b_urdu}
                      englishContent={question.option_b}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                </div>
              )}
              {question.option_c && (
                <div className="col-3" style={{ 
                  padding: '0 4px',
                  direction: tableDirection,
                  textAlign: textAlign
                }}>
                  <div style={{ 
                    height: '100%',
                    direction: tableDirection,
                    textAlign: textAlign
                  }}>
                    <BilingualMcqOption
                      optionLetter="C"
                      urduContent={question.option_c_urdu}
                      englishContent={question.option_c}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                </div>
              )}
              {question.option_d && (
                <div className="col-3" style={{ 
                  padding: '0 4px',
                  direction: tableDirection,
                  textAlign: textAlign
                }}>
                  <div style={{ 
                    height: '100%',
                    direction: tableDirection,
                    textAlign: textAlign
                  }}>
                    <BilingualMcqOption
                      optionLetter="D"
                      urduContent={question.option_d_urdu}
                      englishContent={question.option_d}
                      isUrduLanguage={isUrduLanguage}
                      isBilingual={isBilingual}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Chapter info and marks */}
          <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center" style={{ 
            marginBottom: '0',
            direction: 'ltr',
            fontSize: '11px'
          }}>
            <small className="text-muted" style={{
              fontFamily: "'Times New Roman', Times, serif",
              direction: 'ltr',
              textAlign: 'left',
              display: 'block'
            }}>
              <i className="bi bi-tag me-1"></i>
              Chapter {chapterNo}
              {question.topic && ` • ${question.topic}`}
            </small>
            
            <div className="d-flex align-items-center gap-2">
              {isEditMode && (
                <div className="individual-marks-input d-flex align-items-center">
                  <small className="text-muted me-1">Marks:</small>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: '60px', height: '24px', fontSize: '11px' }}
                    value={question.customMarks || marksPerQuestion}
                    onChange={(e) => updateQuestionMarks('mcq', question.id, parseInt(e.target.value) || marksPerQuestion)}
                    min="1"
                  />
                </div>
              )}
              <span className="badge bg-secondary" style={{ fontSize: '11px', padding: '2px 6px' }}>
                {question.customMarks || marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  const renderSubjectiveQuestion = (question: Question, type: string, index: number) => {
    const marksPerQuestion = getMarksForQuestionType(type);
    const chapterInfo = chapters.find(c => c.id === question.chapter_id);
    const chapterNo = chapterInfo?.chapterNo || '1';

    return (
      <div
        key={generateUniqueKey(question, type, index)}
        className={`question-item mb-3 p-3 border rounded ${isEditMode ? 'cursor-grab bg-light' : ''} ${
          draggedQuestion?.id === question.id ? 'dragging border-primary' : ''
        }`}
        draggable={isEditMode}
        onDragStart={(e) => handleDragStart(e, question.id, type)}
        onDragEnd={handleDragEnd}
        style={{ 
          transition: 'all 0.3s ease',
          position: 'relative',
          cursor: isEditMode ? 'grab' : 'default',
          marginBottom: '15px',
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
                fontSize: '13px'
              }}>
                {type === 'short' ? `(${index + 1})` : `Q.${index + 1}.`}
              </strong>
            </div>
            
            <div className="chapter-info">
              <small className="text-muted" style={{
                fontFamily: "'Times New Roman', Times, serif",
                direction: isUrduLanguage ? 'rtl' : 'ltr',
                fontSize: '11px'
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
              fontSize: '11px'
            }}>
              {question.customMarks || marksPerQuestion} marks
            </span>
          </div>
        </div>
        
        {/* Second Row: Question Statement - For bilingual, show in same line */}
        <div className="question-statement mt-2">
          {isUrduLanguage && (
            <HtmlContent 
              content={question.question_text_urdu || question.question_text}
              className="urdu-text"
              isUrdu={true}
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                direction: 'rtl',
                fontSize: '13px',
                lineHeight: '2',
                textAlign: 'right',
                marginBottom: '0'
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
                fontSize: '12px',
                lineHeight: '1.4',
                marginBottom: '0'
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
              width: '100%'
            }}>
              <div className="english-version" style={{
                flex: 1,
                minWidth: 0
              }}>
                <HtmlContent 
                  content={question.question_text}
                  style={{
                    fontFamily: "'Times New Roman', Times, serif",
                    fontSize: '12px',
                    lineHeight: '1.4',
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
                    fontSize: '13px',
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
  };

  const renderSection = (type: string, questions: Question[]) => {
    if (questions.length === 0) return null;
    const questionTypes = getQuestionTypes();
    const typeInfo = questionTypes.find(t => t.value === type);
    const typeLabel = typeInfo?.label || type;
    
    const toAttempt = getToAttemptForQuestionType(type);
    const marksPerQuestion = getMarksForQuestionType(type);
    const sectionMarks = questions.slice(0, toAttempt).reduce((sum, q) => {
      return sum + (q.customMarks || marksPerQuestion);
    }, 0);
    
    let sectionTitle = '';
    let sectionNote = '';
    
    if (type === 'mcq') {
      sectionTitle = isUrduLanguage ? 'حصہ اول - معروضی سوالات' : 'SECTION A - MULTIPLE CHOICE QUESTIONS';
      sectionNote = !isUrduLanguage 
        ? 'Note: Four possible answers A, B, C and D to each question are given. Fill the correct option\'s circle. More than one filled circle will be treated wrong.'
        : 'نوٹ: ہر سوال کے چار ممکنہ جوابات A,B,C اور D دیئے گئے ہیں۔ درست جواب کے مطابق دائرہ پُر کریں۔ ایک سے زیادہ دائروں کو پُر کرنے کی صورت میں جواب غلط تصور ہوگا۔';
    } else if (type === 'short') {
      sectionTitle = isUrduLanguage ? 'حصہ دوم - مختصر جوابات' : 'SECTION B - SHORT ANSWERS';
      sectionNote = isUrduLanguage
        ? 'حصہ دوم: مختصر جوابات لکھیں۔'
        : 'Section B. Write short answers.';
    } else if (type === 'long') {
      sectionTitle = isUrduLanguage ? 'حصہ سوم - تفصیلی جوابات' : 'SECTION C - DETAILED ANSWERS';
      sectionNote = isUrduLanguage
        ? 'حصہ سوم: تفصیلی جوابات لکھیں۔'
        : 'Section C. Write detailed answers.';
    } else {
      sectionTitle = typeLabel;
    }
    
    const direction = isUrduLanguage ? 'rtl' : 'ltr';
    const textAlign = isUrduLanguage ? 'right' : 'left';
    const fontFamily = isUrduLanguage 
      ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif" 
      : "'Times New Roman', Times, serif";
    
    return (
      <div 
        key={`section-${type}`} 
        className={`section mb-4 ${type === 'mcq' ? 'mcq-section' : 'subjective-section'}`}
        style={{ marginBottom: '25px' }}
      >
        <div className="section-header mb-3">
          <h5 className="fw-bold mb-2" style={{ 
            fontSize: '14px', 
            color: '#2c3e50',
            fontFamily: fontFamily,
            direction: direction,
            textAlign: textAlign,
            marginBottom: '8px',
            borderBottom: '2px solid #000',
            paddingBottom: '4px'
          }}>
            {sectionTitle}
          </h5>
          
          {sectionNote && (
            <div className="note p-2 bg-light rounded mb-3" style={{ 
              fontSize: '11px', 
              lineHeight: isUrduLanguage ? '2' : '1.4',
              direction: direction,
              textAlign: textAlign,
              fontFamily: fontFamily,
              borderLeft: '3px solid #4a6fa5'
            }}>
              {sectionNote}
            </div>
          )}
          
          <div className="mt-2" style={{ 
            direction: 'ltr',
            textAlign: 'left',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '12px'
          }}>
            <h6 className="text-muted mb-1">
              {questions.length > toAttempt ? `Attempt Any ${toAttempt} Questions` : 'Attempt All Questions'} . Each question carries {marksPerQuestion} mark{marksPerQuestion > 1 ? 's' : ''}.
            </h6>
            <span className="badge bg-primary ms-2" style={{ fontSize: '11px', padding: '3px 8px' }}>
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
            <div className="table-responsive">
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                margin: '5px 0', 
                fontSize: '12px',
                direction: (isUrduLanguage || isBilingual) ? 'rtl' : 'ltr'
              }}>
                <tbody>
                  {questions.map((question, index) => renderMCQQuestion(question, index))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {questions.map((question, index) => renderSubjectiveQuestion(question, type, index))}
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
        <div className="col-lg-9">
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

                {/* Watermark Removal Checkbox - ALWAYS VISIBLE */}
                <div className="watermark-control mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="removeWatermarkMobile"
                      checked={removeWatermark}
                      onChange={handleWatermarkChange}
                      style={{ cursor: isPaidUser ? 'pointer' : 'not-allowed' }}
                    />
                    <label 
                      className="form-check-label d-flex align-items-center" 
                      htmlFor="removeWatermarkMobile"
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

                {/* Print Button - Mobile */}
                <div className="print-control mb-2">
                  <button
                    type="button"
                    className="btn btn-outline-light w-100 btn-sm"
                    onClick={handlePrintPaper}
                    disabled={isLoadingPreview}
                  >
                    <Printer size={16} className="me-2" />
                    Print Paper
                  </button>
                </div>

                {/* Mobile Generate paper buttons Buttons */}
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
                          Generate Paper PDF
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
                    fontFamily: "'Times New Roman', Times, serif",
                    padding: '25px',
                    background: 'white',
                    minHeight: '800px',
                    maxWidth: '100%',
                    margin: '0 auto',
                    direction: isUrduLanguage ? 'rtl' : 'ltr',
                    textAlign: isUrduLanguage ? 'right' : 'left'
                  }}
                >
                  {/* Header Section */}
                  <div className="header text-center mb-4" style={{ fontSize: '12px' }}>
                    <div className="mb-3">
                      <div style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        direction: 'ltr',
                        marginBottom: '5px'
                      }}>
                        <img src="/examly.jpg" className="header-img" height="35" width="90" alt="Examly"/>
                        <div style={{
                          fontFamily: "'algerian', 'Times New Roman', Times, serif",
                          fontSize: '12px',
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          {watch('title') || 'BOARD OF INTERMEDIATE AND SECONDARY EDUCATION'}
                        </div>
                      </div>
                     
                      {watch('dateOfPaper') && (
                        <p className="mb-0 text-muted" style={{ 
                          fontSize: '11px',
                          fontFamily: "'Times New Roman', Times, serif",
                          direction: 'ltr'
                        }}>
                          Date: {formatDateForDisplay(watch('dateOfPaper'))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Student Info Table */}
                  <div className='table-responsive'>
                    <table style={{
                      width: '100%', 
                      borderCollapse: 'collapse', 
                      border: 'none', 
                      marginBottom: '10px',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}>
                      <tbody>
                        <tr style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>نام طالبعلم:۔۔۔۔۔۔۔۔۔۔</span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>رول نمبر:۔۔۔۔۔۔</span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>سیکشن:۔۔۔۔۔۔</span>
                          </td>
                        </tr>

                        <tr style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}><strong>کلاس: {classes.find(c => c.id === watch('classId'))?.name}</strong></span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>مضمون: {subjects.find(s => s.id === watch('subjectId'))?.name}</span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>تاریخ: {formatDateForDisplay(watch('dateOfPaper') || '')}</span>
                          </td>
                        </tr>

                        <tr style={{ border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <td style={{ border: 'none', flex: 1.5 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>وقت: {watch('subjectiveTimeMinutes')} منٹ</span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>کل نمبر: {Object.values(previewQuestions).reduce((total, questions) => {
                              return total + (questions?.length || 0);
                            }, 0)}</span>
                          </td>
                          <td style={{ border: 'none', flex: 1 }}>
                            <span className="urdu-text" style={{
                              fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif",
                              direction: 'rtl',
                              fontSize: '12px',
                              display: 'block',
                              textAlign: 'right'
                            }}>{paperTypeText}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <hr style={{ borderColor: '#000', margin: '15px 0', borderWidth: '1px' }} />

                  {/* Questions Preview - MCQ Always First */}
                  <div className="questions-preview">
                    {sortedQuestionTypes.map((type) => {
                      const questions = previewQuestions[type.value] || [];
                      if (questions.length === 0) return null;
                      return renderSection(type.value, questions);
                    })}

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
                      fontSize: '11px', 
                      color: '#666', 
                      borderTop: '1px solid #ccc', 
                      paddingTop: '8px',
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

        <div className="col-lg-3">
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
                    id="removeWatermarkDesktop"
                    checked={removeWatermark}
                    onChange={handleWatermarkChange}
                    style={{ cursor: isPaidUser ? 'pointer' : 'not-allowed' }}
                  />
                  <label 
                    className="form-check-label d-flex align-items-center" 
                    htmlFor="removeWatermarkDesktop"
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

              {/* Print Button - Desktop */}
              <div className="print-control mb-3">
                <button
                  type="button"
                  className="btn btn-outline-primary w-100 btn-lg"
                  onClick={handlePrintPaper}
                  disabled={isLoadingPreview}
                >
                  <Printer className="me-2" size={20} />
                  Print Paper
                </button>
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
                  {sortedQuestionTypes.map((type) => {
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
                      <div key={`stats-${type.value}`} className="col-4">
                        <div className="fw-bold text-primary" style={{ fontSize: '12px' }}>{type.label}</div>
                        <div className="fw-bold" style={{ fontSize: '13px' }}>{attemptValue}/{questions.length}</div>
                        <small className="text-muted" style={{ fontSize: '10px' }}>(Attempt/Total)</small>
                        <div className="small text-success" style={{ fontSize: '11px' }}>
                          = {sectionMarks} marks
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="col-12 mt-2 pt-2 border-top">
                    <div className="fw-bold text-danger" style={{ fontSize: '14px' }}>
                      Total: {sortedQuestionTypes.reduce((total, type) => {
                        const questions = previewQuestions[type.value] || [];
                        if (questions.length === 0) return total;
                        
                        const attemptField = `${type.fieldPrefix}ToAttempt`;
                        const marksField = `${type.fieldPrefix}Marks`;
                        
                        const attemptValue = watch(attemptField) || 0;
                        const marksValue = watch(marksField) || 1;
                        
                        const sectionMarks = questions.slice(0, attemptValue).reduce((sum, q) => {
                          return sum + (q.customMarks || marksValue);
                        }, 0);
                        
                        return total + sectionMarks;
                      }, 0)} Marks
                    </div>
                    <small className="text-muted" style={{ fontSize: '10px' }}>Based on "To Attempt" values</small>
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
        
        /* MCQ options styling */
        .options .row {
          margin: 0 !important;
        }
        
        .options .col-3 {
          padding: 0 4px !important;
        }
        
        /* Ensure consistent spacing */
        .question-item {
          margin-bottom: 5px !important;
        }
        
        .question-item td {
          padding: 4px !important;
        }
        
        /* Urdu font styling */
        .urdu-text {
          font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif !important;
          font-size: 13px !important;
          line-height: 2 !important;
          text-align: right !important;
          direction: rtl !important;
          margin-bottom: 0 !important;
        }
        
        .english-text {
          font-family: 'Times New Roman', Times, serif !important;
          font-size: 12px !important;
          line-height: 1.4 !important;
          text-align: left !important;
          direction: ltr !important;
          margin-bottom: 0 !important;
        }
        
        /* Bilingual layout styling */
        .bilingual-option {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
        }
        
        .bilingual-question-wrapper {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          width: 100% !important;
        }
        
        /* RTL support for Urdu and bilingual modes */
        .single-option[dir="rtl"] {
          justify-content: flex-end !important;
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
        
        /* Print-specific styles */
        @media print {
          .no-print,
          .card-header,
          .action-buttons,
          .quick-stats,
          .edit-tips,
          .form-check,
          .watermark-control,
          .print-control {
            display: none !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            font-size: 12px !important;
          }
          
          .paper-preview {
            box-shadow: none !important;
            border: none !important;
            padding: 20px !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: auto !important;
          }
          
          /* Page breaks for separate placement */
          .mcq-section {
            page-break-after: ${mcqPlacement === 'separate' ? 'always' : 'avoid'} !important;
          }
          
          .subjective-section {
            page-break-before: ${mcqPlacement === 'separate' ? 'always' : 'avoid'} !important;
          }
          
          /* Column layout for multi-page printing */
          body.two-page-print {
            column-count: 2 !important;
            column-gap: 15mm !important;
          }
          
          body.three-page-print {
            column-count: 3 !important;
            column-gap: 10mm !important;
          }
          
          .cut-line {
            display: flex !important;
            align-items: center !important;
            margin: 10px 0 !important;
            color: #999 !important;
          }
          
          .cut-line hr {
            flex: 1 !important;
            border-top: 2px dashed #ccc !important;
            margin: 0 10px !important;
          }
        }
        
        /* Mobile responsiveness for MCQ options */
        @media (max-width: 768px) {
          .options .col-3 {
            width: 50% !important;
            margin-bottom: 4px !important;
          }
          
          .urdu-text {
            font-size: 12px !important;
            line-height: 1.8 !important;
          }
          
          .english-text {
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
          
          .bilingual-option {
            flex-direction: column !important;
            align-items: flex-end !important;
            gap: 5px !important;
          }
          
          .bilingual-question-wrapper {
            flex-direction: column !important;
            gap: 5px !important;
          }
          
          .single-option[dir="rtl"] {
            justify-content: flex-start !important;
            flex-direction: row-reverse !important;
          }
        }
      `}</style>
    </form>
  );
};
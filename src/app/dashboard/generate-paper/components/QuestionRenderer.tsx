// generate-paper/components/QuestionRenderer.tsx
'use client';
import React from 'react';
import { LanguageConfig } from '@/types/paperBuilderTypes';
import { EditableText } from './EditableText';

interface QuestionRendererProps {
  question: any;
  index: number;
  sectionType: string;
  sectionId: string;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  isEditMode: boolean;
  config: LanguageConfig;
  fontSize: number;           // Subjective Font Size
  mcqFontSize: number;        // MCQ Font Size
  lineHeight: number;         // Subjective Spacing
  mcqLineHeight: number;      // MCQ Spacing
  metaFontSize: number;
  questionFontFamily: string; // Global Font Family for English
  onTextChange: (sectionId: string, questionId: string, field: string, value: string) => void;
  renderInlineBilingual?: boolean;
}
const URDU_FONT = "'Jameel Noori Nastaleeq', serif";
const formatQuestionText = (text: string): string => {
  if (!text) return '';
  return text.replace(/<(?:.|\n)*?>/gm, ' ').trim();
};
const BilingualTextDisplay: React.FC<any> = ({
  engValue,
  urValue,
  engField,
  urField,
  sectionId,
  questionId,
  isEnglish,
  isUrdu,
  isEditMode,
  onTextChange,
  fontSize,
  questionFontFamily,
  urduFontSizeOffset = 2,
  isOption = false,
  lineSpacing, 
}) => {
  const effectiveLineHeight = lineSpacing || 1.4;
  
  // Tighten Urdu line height specifically because Nastaleeq ligatures are tall
  const optimizedUrduLineHeight = isOption ? 1.0 : Math.max(0.9, effectiveLineHeight - 0.4);

  return (
    <div className={`d-flex w-100 ${isUrdu ? 'flex-row-reverse' : 'flex-row'} align-items-start`}>
      {isUrdu && (
        <div 
          className="urdu-text flex-grow-1" 
          dir="rtl" 
          style={{ 
            fontFamily: URDU_FONT, 
            fontSize: `${fontSize + urduFontSizeOffset}px`, 
            textAlign: 'right',
            lineHeight: optimizedUrduLineHeight,
            marginTop: isOption ? '-4px' : '-4px', // Adjust for Nastaleeq baseline
            marginBottom: '0px'
          }}
        >
          {isEditMode ? (
            <EditableText 
              value={urValue || ''} 
              placeholder="Urdu text..." 
              onChange={(v) => onTextChange(sectionId, questionId, urField, v)} 
            />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: formatQuestionText(urValue || (isOption ? '' : engValue)) }} />
          )}
        </div>
      )}
      
      {isEnglish && (
        <div 
          className="english-text flex-grow-1" 
          dir="ltr" 
          style={{ 
            fontFamily: questionFontFamily, 
            fontSize: `${fontSize}px`, 
            textAlign: 'left',
            lineHeight: `${effectiveLineHeight}`,
          }}
        >
          {isEditMode ? (
            <EditableText 
              value={engValue || ''} 
              placeholder="English text..." 
              onChange={(v) => onTextChange(sectionId, questionId, engField, v)} 
            />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: formatQuestionText(engValue) }} />
          )}
        </div>
      )}
    </div>
  );
};

export const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { paperLanguage, sectionType, index, fontSize, mcqFontSize,  mcqLineHeight, questionFontFamily, questionLineSpacing } = props;
  const isUrdu = paperLanguage === 'urdu' || paperLanguage === 'bilingual';
  const isEnglish = paperLanguage === 'english' || paperLanguage === 'bilingual';

  const numberFontSize = sectionType === 'mcq' ? (mcqFontSize || 12) : fontSize;
  const currentLineHeight = sectionType === 'mcq' ? (mcqLineHeight || 1.2) : (questionLineSpacing || 1.5);

  return (
    <div className={`question-wrapper mb-1 ${isUrdu ? 'rtl' : 'ltr'}`}>
      <style jsx global>{`
        @media print {
          /* Force tight line heights for Urdu in print */
          .urdu-text { 
            line-height: 1.1 !important; 
            display: block !important;
            padding-bottom: 0px !important;
          }
          /* Ensure English keeps proper spacing but matches Urdu scale */
          .english-text {
            line-height: 1.2 !important;
          }
          .question-wrapper { 
            page-break-inside: avoid; 
            margin-bottom: 4px !important;
          }
        }
      `}</style>

      <div className="d-flex align-items-start gap-1">
        <span className="fw-bold" style={{ 
            minWidth: '13px', 
            fontSize: `${numberFontSize}px`,
            lineHeight: `${currentLineHeight}`,
            fontFamily: questionFontFamily // Applied custom font to numbers
        }}>
          {index + 1}.
        </span>
        <div className="flex-grow-1">
          {sectionType === 'mcq' ? (
            <MCQQuestionRenderer {...props} isUrdu={isUrdu} isEnglish={isEnglish} />
          ) : (
            <SubjectiveQuestionRenderer {...props} isUrdu={isUrdu} isEnglish={isEnglish} />
          )}
        </div>
      </div>
    </div>
  );
};

const MCQQuestionRenderer: React.FC<any> = (props) => {
  const { question, mcqFontSize, mcqLineHeight, questionFontFamily, paperLanguage } = props;

  const activeFontSize = mcqFontSize || 12;
  const activeLineHeight = mcqLineHeight || 1.2;
  const options = ['a', 'b', 'c', 'd'];
  
  const getColumnClass = () => {
    let maxLen = 0;
    options.forEach(key => {
      const len = (question[`option_${key}`] || '').length + (question[`option_${key}_ur`] || '').length;
      if (len > maxLen) maxLen = len;
    });
    const threshold = paperLanguage === 'bilingual' ? 50 : 80;
    if (maxLen > threshold * 2) return 'col-12';
    if (maxLen > threshold) return 'col-6';
    return 'col-3';
  };

  return (
    <div className="mcq-item">
      <div className="mb-1">
        <BilingualTextDisplay 
          {...props}
          engValue={question.question_text || question.question}
          urValue={question.question_text_ur}
          engField="question_text"
          urField="question_text_ur"
          fontSize={activeFontSize}
          lineSpacing={activeLineHeight}
          questionFontFamily={questionFontFamily}
          questionId={question.id}
        />
      </div>

      <div className={`row g-1 mt- ${props.isUrdu ? 'pe-2' : 'ps-2'}`}>
        {options.map((key) => (
          <div 
            key={key} 
            className={`${getColumnClass()} d-flex gap-1 align-items-start`} 
          >
            <span className="fw-bold" style={{ 
              minWidth: '12px', 
              fontSize: `${activeFontSize * 0.9}px`,
              fontFamily: questionFontFamily,
              lineHeight: activeLineHeight 
            }}>({key})</span>
            <BilingualTextDisplay 
              {...props}
              isOption
              engValue={question[`option_${key}`]}
              urValue={question[`option_${key}_ur`]}
              engField={`option_${key}`}
              urField={`option_${key}_ur`}
              fontSize={activeFontSize} 
              lineSpacing={activeLineHeight}
              questionFontFamily={questionFontFamily}
              questionId={question.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const SubjectiveQuestionRenderer: React.FC<any> = (props) => {
  const { question, fontSize, lineHeight, questionFontFamily,questionLineSpacing } = props;
  //console.log('subjective console props', props);
  
  return (
    <BilingualTextDisplay 
      {...props}
      engValue={question.question_text || question.question}
      urValue={question.question_text_ur}
      engField="question_text"
      urField="question_text_ur"
      fontSize={fontSize}
      lineSpacing={questionLineSpacing  || 1.5}
      questionFontFamily={questionFontFamily} // Fixed prop name mismatch
      questionId={question.id}
    />
  );
};
<style jsx global>{`
  .editable-content:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
  .editable-content:focus {
    background-color: #fff !important;
    border: 1px solid #007bff !important;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
  /* Ensure Urdu text maintains direction while editing */
  .urdu-text .editable-content {
    direction: rtl;
    text-align: right;
  }
  @media print {
    .editable-content { border: none !important; background: none !important; }
  }
`}</style>
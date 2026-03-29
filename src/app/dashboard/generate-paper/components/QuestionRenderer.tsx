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
  fontSize: number;
  mcqFontSize: number;
  lineHeight: number;
  mcqLineHeight: number;
  metaFontSize: number;
  questionFontFamily: string;
  onTextChange: (sectionId: string, questionId: string, field: string, value: string) => void;
  renderInlineBilingual?: boolean;
  questionLineSpacing?: number;
}

const URDU_FONT = "'JameelNoori', 'Noto Nastaliq Urdu', serif";

/** Convert number to Roman numeral */
const toRoman = (num: number): string => {
  const lookup: { [key: string]: number } = {
    x: 10, ix: 9, v: 5, iv: 4, i: 1
  };
  let roman = '';
  for (let key in lookup) {
    while (num >= lookup[key]) {
      roman += key;
      num -= lookup[key];
    }
  }
  return roman;
};

/** Strip HTML tags and trim */
const formatQuestionText = (text: string): string => {
  if (!text) return '';
  return text.replace(/<(?:.|\n)*?>/gm, ' ').trim();
};

/** Component to render bilingual text */
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
  const optimizedUrduLineHeight = isOption ? 1.1 : Math.max(1.0, effectiveLineHeight - 0.3);

  return (
    <div className={`d-flex w-100 ${isUrdu ? 'flex-row-reverse' : 'flex-row'} align-items-start`}>
      {isUrdu && (
        <div
          className="urdu-text flex-grow-1"
          dir="rtl"
          lang="ur"
          style={{
            fontFamily: URDU_FONT,
            fontSize: `${fontSize + urduFontSizeOffset}px`,
            textAlign: 'right',
            lineHeight: optimizedUrduLineHeight,
            marginTop: isOption ? '-4px' : '-4px',
            marginBottom: '0px',
            wordSpacing: '2px',
            verticalAlign: 'baseline'
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

/** Main question renderer */
export const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => {
  const {
    paperLanguage,
    sectionType,
    index,
    fontSize,
    mcqFontSize,
    mcqLineHeight,
    questionFontFamily,
    questionLineSpacing
  } = props;

  const isUrdu = paperLanguage === 'urdu' || paperLanguage === 'bilingual';
  const isEnglish = paperLanguage === 'english' || paperLanguage === 'bilingual';

  const numberFontSize = sectionType === 'mcq' ? (mcqFontSize || 12) : fontSize;
  const currentLineHeight = sectionType === 'mcq' ? (mcqLineHeight || 1.2) : (questionLineSpacing || 1.5);

  // Counting logic: standard for MCQ/Long, Roman for others
  const typeKey = sectionType.toLowerCase();
  const isLong = typeKey.includes('long') || typeKey.includes('essay') || typeKey.includes('subjective_long');
  const isMCQ = typeKey === 'mcq';
  const useStandardCounting = isMCQ || isLong;
  const indexDisplay = useStandardCounting ? `${index + 1}.` : `(${toRoman(index + 1)})`;

  return (
    <div className={`question-wrapper mb-1 ${isUrdu ? 'rtl' : 'ltr'}`}>
      <style jsx global>{`
        .urdu-text, [lang="ur"] {
          font-family: ${URDU_FONT} !important;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }

        @media print {
       .question-wrapper, 
          .question-wrapper *,
          .mcq-item, 
          .mcq-item *,
          .row, 
          .urdu-text, 
          .english-text,
          .d-flex,
          span, div {
            background-color: transparent !important;
            background: transparent !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .urdu-text { line-height: 1.1 !important; display: block !important; }
          .english-text { line-height: 1.2 !important; }
          .question-wrapper { page-break-inside: avoid; margin-bottom: 4px !important; }

          .mcq-item .d-flex {
    display: flex !important;
    align-items: baseline !important;
  }
  
  /* Prevent the English label from floating high */
  .mcq-item span.fw-bold {
    align-self: baseline !important;
    line-height: 1 !important;
  }

  /* Adjust Urdu Nastaliq specifically for print rendering */
  .urdu-text {
    display: inline-block !important;
    vertical-align: baseline !important;
  }
        }

        .editable-content:hover { background-color: rgba(0, 0, 0, 0.02); }
        .editable-content:focus { background-color: #fff !important; border: 1px solid #007bff !important; }
        .urdu-text .editable-content { direction: rtl; text-align: right; }
      `}</style>

      {/* Question container with numbering on both sides if bilingual */}
      <div className="d-flex align-items-start gap-1 w-100">
        {/* English/left number */}
        {isEnglish && (
          <span
            className="fw-bold"
            style={{
              minWidth: '18px',
              fontSize: `${numberFontSize}px`,
              lineHeight: `${currentLineHeight}`,
              fontFamily: questionFontFamily,
              textAlign: 'left'
            }}
          >
            {indexDisplay}
          </span>
        )}
        {isUrdu && paperLanguage === 'urdu' &&(
          <span
            className="fw-bold"
            style={{
              minWidth: '18px',
              fontSize: `${numberFontSize}px`,
              lineHeight: `${currentLineHeight}`,
              fontFamily: URDU_FONT,
              textAlign: 'right'
            }}
          >
            {indexDisplay}
          </span>
        )}

        {/* Question text */}
        <div className="flex-grow-1">
          {sectionType === 'mcq' ? (
            <MCQQuestionRenderer {...props} isUrdu={isUrdu} isEnglish={isEnglish} />
          ) : (
            <SubjectiveQuestionRenderer {...props} isUrdu={isUrdu} isEnglish={isEnglish} />
          )}
        </div>

        {/* Urdu/right number (only for bilingual mode) */}
        {isUrdu && paperLanguage === 'bilingual' && (
          <span
            className="fw-bold"
            style={{
              minWidth: '18px',
              fontSize: `${numberFontSize}px`,
              lineHeight: `${currentLineHeight}`,
              fontFamily: URDU_FONT,
              textAlign: 'right'
            }}
          >
            {indexDisplay}
          </span>
        )}
      </div>
    </div>
  );
};

/** MCQ Renderer */
const MCQQuestionRenderer: React.FC<any> = (props) => {
  const { question, mcqFontSize, mcqLineHeight, questionFontFamily, paperLanguage } = props;
  const activeFontSize = mcqFontSize || 12;
  const activeLineHeight = mcqLineHeight || 1.2;
  const options = ['a', 'b', 'c', 'd'];

  const getColumnClass = () => {
    let maxLen = 0;
    options.forEach(key => {
      // Logic for column width should also account for the fallback
      const eng = question[`option_${key}`] || '';
      const ur = question[`option_${key}_ur`] || '';
      const len = eng.length + ur.length;
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
          // Fallback for question text if Urdu is selected but empty
          urValue={question.question_text_ur || (paperLanguage === 'urdu' ? (question.question_text || question.question) : '')}
          engField="question_text"
          urField="question_text_ur"
          fontSize={activeFontSize}
          lineSpacing={activeLineHeight}
          questionFontFamily={questionFontFamily}
          questionId={question.id}
        />
      </div>

      <div className={`row g-1 mx-0 ${props.isUrdu ? 'pe-2' : 'ps-2'}`}>
        {options.map((key) => {
          const engOpt = question[`option_${key}`];
          const urOpt = question[`option_${key}_ur`];
          
          // Logic: If language is Urdu and Urdu option is missing, use English option
          const finalUrduValue = (paperLanguage === 'urdu' && !urOpt) ? engOpt : urOpt;

          return (
            <div key={key} className={`${getColumnClass()} d-flex gap-1 align-items-start`}>
              <span
                className="fw-bold"
                style={{
                  minWidth: '12px',
                  fontSize: `${activeFontSize * 0.9}px`,
                  fontFamily: questionFontFamily,
                  lineHeight: activeLineHeight
                }}
              >
                ({key})
              </span>
              <BilingualTextDisplay
                {...props}
                isOption
                engValue={engOpt}
                urValue={finalUrduValue}
                engField={`option_${key}`}
                urField={`option_${key}_ur`}
                fontSize={activeFontSize}
                lineSpacing={activeLineHeight}
                questionFontFamily={questionFontFamily}
                questionId={question.id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Subjective Renderer */
const SubjectiveQuestionRenderer: React.FC<any> = (props) => {
  const { question, fontSize, questionFontFamily, questionLineSpacing } = props;
  return (
    <BilingualTextDisplay
      {...props}
      engValue={question.question_text || question.question}
      urValue={question.question_text_ur}
      engField="question_text"
      urField="question_text_ur"
      fontSize={fontSize}
      lineSpacing={questionLineSpacing || 1.5}
      questionFontFamily={questionFontFamily}
      questionId={question.id}
    />
  );
};
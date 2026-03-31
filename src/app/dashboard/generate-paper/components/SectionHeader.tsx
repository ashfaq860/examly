'use client';

import React from 'react';
import { EditableText } from './EditableText';

interface SectionHeaderProps {
  sectionId: string;
  sectionIndex: number;
  sectionType: string;
  totalQuestions: number;
  attemptCount: number;
  totalMarks: number;
  headingFontSize: number;
  headingFontFamily: string;
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  customEnHeader?: string;
  customUrHeader?: string;
  onHeaderChange: (sectionId: string, field: 'en' | 'ur', value: string) => void;
  isEditMode: boolean;
}

const URDU_FONT = "'JameelNoori', 'Noto Nastaliq Urdu', serif";

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  sectionId,
  sectionIndex,
  sectionType,
  totalQuestions,
  attemptCount,
  totalMarks,
  headingFontSize,
  headingFontFamily,
  paperLanguage,
  customEnHeader,
  customUrHeader,
  onHeaderChange,
  isEditMode,
}) => {
  const isPartial = attemptCount < totalQuestions;
  const qNo = sectionIndex + 1;
  const marksPerQuestion = totalMarks / (attemptCount || 1);

  // Determine if the question number prefix (e.g., "5.") should be hidden
  // This satisfies the requirement: long question section shouldn't have question number
  const showQuestionNumber = sectionType !== 'long';

  // Helper to convert numbers to Urdu/Arabic digits if needed (placeholder for logic)
  const toUrduDigits = (num: number | string) => num;

  /**
   * Default Instructions mapped to DB schema question_type constraints
   */
  const defaultInstructions: Record<string, { en: string; ur: string }> = {
    mcq: {
      en: `Choose the correct option ${isPartial ? attemptCount : ''}.`,
      ur: `${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} درست جوابات کا انتخاب کریں۔`,
    },
    short: {
      en: `Write Short Answers to ${isPartial ? 'any ' + attemptCount : 'all'} questions.`,
      ur: `${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} سوالات کے مختصر جوابات لکھئیے`,
    },
    long: {
      en: `Answer ${isPartial ? 'any ' + attemptCount : 'all'} questions in detail.`,
      ur: `${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} سوالات کے تفصیلی جوابات تحریر کریں۔`,
    },
    directInDirect: {
      en: `Change the narration of ${isPartial ? 'any ' + attemptCount : 'the following'}.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} کی ڈائریکٹ ان ڈائریکٹ میں تبدیلی کریں۔`,
    },
    activePassive: {
      en: `Change the voice of ${isPartial ? attemptCount : 'the following'} sentences.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} جملوں کی ایکٹو اور پیسو وائس میں تبدیلی کریں۔`,
    },
    idiom_phrases: {
      en: `Use ${isPartial ? 'any ' + attemptCount : 'the following'} idioms/phrases in your own sentences.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} محاورات یا ضرب الامثال کو اپنے جملوں میں استعمال کریں۔`,
    },
    translate_urdu: {
      en: `Translate ${isPartial ? 'any ' + attemptCount : 'the following'} passage into Urdu.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'دیے گئے'} پیراگراف کا اردو میں ترجمہ کریں۔`,
    },
    translate_english: {
      en: `Translate ${isPartial ? attemptCount : 'the following'} sentences into English.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} جملوں کا انگریزی میں ترجمہ کریں۔`,
    },
    poetry_explanation: {
      en: `Explain ${isPartial ? attemptCount + ' verses' : 'the following verses'} with reference to context.`,
      ur: `درج ذیل میں سے ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} اشعار کی مختصر تشریح کریں۔`,
    },
    prose_explanation: {
      en: `Explain ${isPartial ? 'any ' + attemptCount : 'the following'} passage with reference to context.`,
      ur: ` ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} نثری پاروں کی تشریح کیجئے۔سبق کا عنوان،مصنف کا نام اور خط کشیدہ الفاظ کے معانی بھی لکھیئے۔`,
    },
    passage: {
      en: `Read the passage carefully and answer ${isPartial ? attemptCount + ' questions' : 'the questions'}.`,
      ur: `عبارت کو غور سے پڑھیں اور ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'آخر میں دیے گئے درج ذیل'} سوالات کے جوابات تحریر کریں۔`,
    },
    sentence_correction: {
      en: `Correct ${isPartial ? attemptCount : 'the following'} sentences.`,
      ur: ` ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} جملوں کی درستگی کریں۔`,
    },
    sentence_completion: {
      en: `Complete ${isPartial ? attemptCount : 'the following'} sentences.`,
      ur: ` ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} جملوں کی تکمیل کریں۔`,
    },
    darkhwast_khat: {
      en: `Write ${isPartial ? 'either ' + attemptCount : 'the following'} Application or Letter.`,
      ur: `  ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} درخواست یا خط تحریر کریں۔`,
    },
    kahani_makalma: {
      en: `Write ${isPartial ? 'any ' + attemptCount : 'the following'} Story or Dialogue.`,
      ur: ` ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} کہانی یا مکالمہ تحریر کریں۔`,
    },
    Nasarkhulasa_markziKhyal: {
      en: `Write the Summary or Central Idea of ${isPartial ? attemptCount : 'the'} lesson.`,
      ur: ` ${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'درج ذیل'} سبق کا خلاصہ یا مرکزی خیال تحریر کریں۔`,
    },
  };

  const defaults = defaultInstructions[sectionType] || {
    en: sectionType.replace(/_/g, ' ').toUpperCase(),
    ur: 'مندرجہ ذیل سوال حل کریں',
  };

  const currentEn = customEnHeader !== undefined ? customEnHeader : defaults.en;
  const currentUr = customUrHeader !== undefined ? customUrHeader : defaults.ur;

  const isUrduOnly = paperLanguage === 'urdu';
  const isEnglishOnly = paperLanguage === 'english';
  const isBilingual = paperLanguage === 'bilingual';

  return (
    <div
      className="section-header mb-3 pb-0 d-flex align-items-center"
      style={{ direction: 'ltr' }}
    >
      <style jsx global>{`
        .section-header-ur,
        .section-header-ur * {
          font-family: ${URDU_FONT} !important;
          text-rendering: optimizeLegibility;
        }
      `}</style>

      {/* 1. English Section */}
      {(isEnglishOnly || isBilingual) && (
        <div className="flex-grow-1 text-start" style={{ flexBasis: 0 }}>
          <div className="d-flex align-items-baseline gap-1">
            {showQuestionNumber && (
              <span
                className="fw-bold text-nowrap"
                style={{ fontSize: `${headingFontSize}px`, fontFamily: headingFontFamily }}
              >
               Q.{qNo}.
              </span>
            )}
            <div className="d-flex align-items-baseline gap-2" style={{ flex: 1 }}>
              {isEditMode ? (
                <EditableText
                  value={currentEn}
                  onChange={(val) => onHeaderChange(sectionId, 'en', val)}
                  className="fw-bold"
                  style={{ fontSize: `${headingFontSize}px`, fontFamily: headingFontFamily }}
                />
              ) : (
                <span
                  className="fw-bold"
                  style={{ fontSize: `${headingFontSize}px`, fontFamily: headingFontFamily }}
                >
                  {currentEn}
                </span>
              )}

              {/* Marks for English Only */}
              {isEnglishOnly && (
                <span
                  className="fw-bold text-nowrap ms-2"
                  style={{ fontSize: `${Math.max(headingFontSize - 2, 10)}px` }}
                >
                  ({attemptCount} x {marksPerQuestion} = {totalMarks})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Marks Column (Bilingual Only) */}
      {isBilingual && (
        <div
          className="px-2 fw-bold text-nowrap text-center"
          style={{
            fontSize: `${Math.max(headingFontSize - 2, 10)}px`,
            minWidth: '120px',
          }}
        >
          ({attemptCount} x {marksPerQuestion} = {totalMarks})
        </div>
      )}

      {/* 3. Urdu Section */}
      {(isUrduOnly || isBilingual) && (
        <div
          className="flex-grow-1 section-header-ur"
          lang="ur"
          style={{
            flexBasis: 0,
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          <div className="d-flex align-items-baseline gap-2 justify-content-start">
            {showQuestionNumber && (
              <span
                className="fw-bold text-nowrap"
                style={{ fontSize: `${headingFontSize + 2}px`, fontFamily: URDU_FONT }}
              >
                {qNo}.
              </span>
            )}
            <div className="d-flex align-items-baseline gap-2" style={{ flex: 1 }}>
              {isEditMode ? (
                <EditableText
                  value={currentUr}
                  onChange={(val) => onHeaderChange(sectionId, 'ur', val)}
                  className="fw-bold"
                  style={{
                    fontSize: `${headingFontSize + 4}px`,
                    fontFamily: URDU_FONT,
                    lineHeight: '1.2',
                  }}
                />
              ) : (
                <span
                  className="fw-bold"
                  style={{
                    fontSize: `${headingFontSize + 4}px`,
                    fontFamily: URDU_FONT,
                    lineHeight: '1.2',
                  }}
                >
                  {currentUr}
                </span>
              )}

              {/* Marks for Urdu Only */}
              {isUrduOnly && (
                <span
                  className="fw-bold text-nowrap me-2"
                  style={{
                    fontSize: `${Math.max(headingFontSize - 2, 10)}px`,
                    fontFamily: 'sans-serif',
                    direction: 'ltr',
                  }}
                >
                  ({attemptCount} x {marksPerQuestion} = {totalMarks})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
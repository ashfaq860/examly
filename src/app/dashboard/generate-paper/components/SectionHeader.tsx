// generate_paper/components/SectionHeader.tsx
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
  isEditMode: boolean; // Prop added to control editability
}

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

  // Helper for Urdu numbers
  const toUrduDigits = (num: number) =>
    num.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);

  const defaultInstructions: Record<string, { en: string; ur: string }> = {
    mcq: { en: 'Choose the correct option.', ur: 'درست جواب کا انتخاب کریں۔' },
 short: {
  en: `Write Short Answers to ${isPartial ? 'any ' + attemptCount : 'all'} questions.`,
  ur: `${isPartial ? 'کوئی سے ' + toUrduDigits(attemptCount) : 'تمام'} سوالات کے مختصر جوابات لکھئیے`,
},
    long: {
      en: `Answer ${isPartial ? attemptCount : 'all'} questions in detail.`,
      ur: `سوالات کے تفصیلی جوابات تحریر کریں۔`,
    },
    translate_urdu: { en: 'Translate into Urdu.', ur: 'اردو میں ترجمہ کریں۔' },
    translate_english: { en: 'Translate into English.', ur: 'انگریزی میں ترجمہ کریں۔' },
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
      className="section-header border-bottom border-1 border-dark mb-3 pb-0 d-flex align-items-center"
      style={{ direction: 'ltr' }}
    >
      {/* 1. English Section */}
      {(isEnglishOnly || isBilingual) && (
        <div className="flex-grow-1 text-start" style={{ flexBasis: 0 }}>
          <div className="d-flex align-items-baseline gap-1">
            <span
              className="fw-bold"
              style={{ fontSize: `${headingFontSize}px`, fontFamily: headingFontFamily }}
            >
              Q. No. {qNo}:
            </span>
            <div style={{ flex: 1 }}>
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
            </div>
          </div>
        </div>
      )}

      {/* 2. Marks Column */}
      <div
        className={`px-2 fw-bold text-nowrap ${isUrduOnly ? 'text-start' : 'text-center'}`}
        style={{
          fontSize: `${Math.max(headingFontSize - 2, 10)}px`,
          minWidth: isBilingual ? '120px' : '80px',
          order: isUrduOnly ? -1 : 0,
        }}
      >
        ({attemptCount} x {marksPerQuestion} = {totalMarks})
      </div>

      {/* 3. Urdu Section */}
      {(isUrduOnly || isBilingual) && (
        <div
          className="flex-grow-1"
          style={{
            flexBasis: 0,
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          <div className="d-flex align-items-baseline gap-2 justify-content-start">
            <span
              className="fw-bold text-nowrap"
              style={{
                fontSize: `${headingFontSize + 2}px`,
                fontFamily: 'Jameel Noori Nastaleeq, serif',
              }}
            >
              سوال نمبر {toUrduDigits(qNo)}:
            </span>
            <div style={{ flex: 1 }}>
              {isEditMode ? (
                <EditableText
                  value={currentUr}
                  onChange={(val) => onHeaderChange(sectionId, 'ur', val)}
                  className="fw-bold"
                  style={{
                    fontSize: `${headingFontSize + 4}px`,
                    fontFamily: 'Jameel Noori Nastaleeq, serif',
                    lineHeight: '1.5',
                  }}
                />
              ) : (
                <span
                  className="fw-bold"
                  style={{
                    fontSize: `${headingFontSize + 4}px`,
                    fontFamily: 'Jameel Noori Nastaleeq, serif',
                    lineHeight: '1.5',
                  }}
                >
                  {currentUr}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
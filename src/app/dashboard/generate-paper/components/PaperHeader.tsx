// dashboard/generate-paper/components/PaperHeader.tsx
'use client';
import React from 'react';
import StandardHeader from './layouts/StandardHeader';
import CompactHeader from './layouts/CompactHeader';
import ClassicHeader from './layouts/ClassicHeader';
import ModernHeader from './layouts/ModernHeader';

import InstructionalHeader from './layouts/InstructionalHeader';
import ScorecardHeader from './layouts/ScorecardHeader';
import BilingualHeader from './layouts/BilingualHeader';
import UniversityHeader from './layouts/UniversityHeader';
import DataBarHeader from './layouts/DataBarHeader';
import { PaperSettings } from '@/types/paperBuilderTypes';

import SmartHeader from './layouts/SmartHeader';
/**
 * Note: Since EditableText might be an external dependency that's occasionally undefined 
 * in certain environments, we use a simple fallback to ensure the app doesn't crash.
 */
const EditableTextFallback = ({ value, onSave, className }: any) => (
  <span 
    className={className} 
    onClick={() => {
      const newValue = prompt("Edit text:", value);
      if (newValue !== null) onSave(newValue);
    }}
    style={{ cursor: 'pointer' }}
  >
    {value || 'Click to edit'}
  </span>
);

export interface PaperHeaderProps {
  totalMarks: number;
  subject: string;
  paperSections: any[];
  isEditMode: boolean;
  settings: PaperSettings & {
    headerLayout?: string;
  };
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: any;
  currentLayout: string;
  onTextChange?: (field: string, value: string) => void;
  currentClass?: string | { id: string; name: string; [key: string]: any };
  profile: any[];
  paperPart?: 'mcq' | 'subjective' | 'combined';
  subjectUrduName?: string;
}

// Main Component - Ensuring it is exported as a default export
export const PaperHeader: React.FC<PaperHeaderProps> = (props) => {
  const { settings, paperLanguage, currentLayout, currentClass, profile } = props;
  // Header layout direction is always RTL, independent of paper language.
  const isRTL = true;
  const isCompact = currentLayout && (currentLayout.startsWith('two') || currentLayout.startsWith('three'));
  const textAlign = isRTL ? 'text-end' : 'text-start';

  const printStyles = {} as React.CSSProperties;

  return (
    <div style={printStyles} className="print-header-container">
      {(() => {
        // 1. Four-papers layout always uses SmartHeader
        if (currentLayout === 'four_papers')
          return <SmartHeader {...props} isRTL={isRTL} directionClass={textAlign} currentClass={currentClass} profile={profile} />;

        // 2. Force Compact for two/three paper layouts
        if (isCompact)
          return <CompactHeader {...props} isRTL={isRTL} directionClass={textAlign} profile={profile} />;

        // 3. Live switch based on SettingsPanel
        switch (settings.headerLayout) {
          case 'classic':       return <ClassicHeader       {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'modern':        return <ModernHeader        {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'instructional': return <InstructionalHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'scorecard':     return <ScorecardHeader     {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'bilingual':     return <BilingualHeader     {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'university':    return <UniversityHeader    {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          case 'databar':       return <DataBarHeader       {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
          default:              return <StandardHeader      {...props} isRTL={isRTL} currentClass={currentClass} profile={profile} />;
        }
      })()}
    </div>
  );
};
















// Default export to satisfy React expectations
export default PaperHeader;
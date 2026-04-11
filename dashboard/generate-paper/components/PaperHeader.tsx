'use client';
import React from 'react';
import StandardHeader from './layouts/StandardHeader';
import CompactHeader from './layouts/CompactHeader';
import ClassicHeader from './layouts/ClassicHeader';
import ModernHeader from './layouts/ModernHeader';

import SidebarHeader from './layouts/SidebarHeader';
import InstructionalHeader from './layouts/InstructionalHeader';
import ScorecardHeader from './layouts/ScorecardHeader';
import BilingualHeader from './layouts/BilingualHeader';
import UniversityHeader from './layouts/UniversityHeader';
import DataBarHeader from './layouts/DataBarHeader';
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
  settings: {
    titleFontSize: number;
    headingFontFamily: string;
    metaFontSize: number;
    headerLayout?: string;

  };
  paperLanguage: 'english' | 'urdu' | 'bilingual';
  config: any;
  currentLayout: 'same' | 'separate' | 'two_papers' | 'three_papers';
  onTextChange?: (field: string, value: string) => void;
  currentClass?: string;
    profile:any[];
}

// Main Component - Ensuring it is exported as a default export
export const PaperHeader: React.FC<PaperHeaderProps> = (props) => {
  const { settings, paperLanguage, currentLayout,currentClass,profile } = props;
  const isRTL = paperLanguage === 'urdu';
  const isCompact = currentLayout === 'two_papers' || currentLayout === 'three_papers';
//console.log('Rendering PaperHeader with props:', currentClass); // Debug log to trace rendering and props
  const textAlign = isRTL ? 'text-end' : 'text-start';

  // Base styles to ensure print fidelity
  const printStyles = {
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  } as React.CSSProperties;

  return (
    <div style={printStyles} className="print-header-container">
      {(() => {
        // 1. Force Compact Mode if layout is multi-paper
        if (isCompact) return <CompactHeader {...props} isRTL={isRTL} directionClass={textAlign} />;

        // 2. Live Switch based on SettingsPanel
        switch (settings.headerLayout) {
          case 'classic': return <ClassicHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'modern': return <ModernHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'sidebar': return <SidebarHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'instructional': return <InstructionalHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'scorecard': return <ScorecardHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'bilingual': return <BilingualHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'university': return <UniversityHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          case 'databar': return <DataBarHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
          default: return <StandardHeader {...props} isRTL={isRTL} currentClass={currentClass} profile={profile}/>;
        }
      })()}
    </div>
  );
};
















// Default export to satisfy React expectations
export default PaperHeader;
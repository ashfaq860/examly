import React from 'react';

/**
 * DataBarHeader Component
 * A compact, single-line data bar variant that maximizes space 
 * for the exam content while maintaining a professional look.
 */

interface DataBarHeaderProps {
  settings: {
    headingFontFamily?: string;
    titleFontFamily?: string;
    titleFontSize?: number;
    metaFontSize?: number;
    logoWidth?: number;  // Added logoWidth
    logoHeight?: number; // Added logoHeight
  };
  subject: string;
  totalMarks: number | string;
  isRTL: boolean;
  currentClass?: any;
  profile?: {
    logo?: string; // Added logo
    institution?: string;
    session?: string;
  };
}

const DataBarHeader: React.FC<DataBarHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
}) => {
  const alignmentClass = isRTL ? 'text-start' : 'text-start';
  const borderClass = isRTL ? 'border-start ps-3' : 'border-start ps-3';
  const marginClass = isRTL ? 'me-3' : 'me-3';

  // Normalize class name display
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className={`container-fluid mb-2 border border-dark p-2 bg-white ${alignmentClass}`}
      style={{ 
        fontFamily: settings.headingFontFamily, 
        fontSize: `${settings.metaFontSize || 14}px`,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      dir={isRTL ? 'ltr' : 'ltr'}
    >
      {/* Top Row: Logo, Title and Session */}
      <div className="d-flex justify-content-between align-items-center border-bottom border-dark pb-1 mb-1">
        <div className="d-flex align-items-center">
          {/* Logo Integration */}
          {profile?.logo && (
            <img 
              src={profile.logo} 
              alt="Logo" 
              className={isRTL ? 'ms-2' : 'me-2'}
              style={{ 
                width: `${settings.logoWidth || 130}px`, 
                height: `${settings.logoHeight || 50}px`,
                objectFit: 'contain'
              }} 
            />
          )}
          <h1 
            className="fw-bold m-0" 
            style={{ 
              fontSize: `${(settings.titleFontSize || 22) - 4}px`,
              fontFamily: settings.titleFontFamily 
            }}
          >
            {profile?.institution || 'ACADEMIC ASSESSMENT'}
          </h1>
        </div>
        
        <span className="fst-italic text-muted" style={{ fontSize: '10px' }}>
        Date:______________
        </span>
      </div>

      {/* Bottom Row: Data Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center text-nowrap">
        {/* Name Field (Flexible) */}
        <div className={`d-flex align-items-end flex-grow-1 ${marginClass}`}>
          <strong className={isRTL ? 'ms-1' : 'me-1'}>Name:</strong>
          <div 
            className="border-bottom border-dark flex-grow-1" 
            style={{ minWidth: '80px', height: '1.2em' }}
          ></div>
        </div>

        {/* Metadata items with conditional borders */}
        <div className={`${marginClass} ${borderClass} border-dark`}>
          <strong>Subj:</strong> {subject}
        </div>
        
        <div className={`${marginClass} ${borderClass} border-dark`}>
          <strong>Grade:</strong> {classNameDisplay || '9th'}<sup>{classNameDisplay===2?'nd':classNameDisplay===3?'rd':'th'}</sup>
        </div>
        
        <div className={`${borderClass} border-dark`}>
          <strong>Marks:</strong> {totalMarks}
        </div>
      </div>
    </div>
  );
};

export default DataBarHeader;
import React from 'react';

/**
 * UniversityHeader Component
 * A prestigious, formal header variant featuring a double border
 * and traditional academic layout suitable for boards or universities.
 */

interface UniversityHeaderProps {
  settings: {
    headingFontFamily?: string;
    titleFontFamily?: string;
    titleFontSize?: number;
    metaFontSize?: number;
  };
  subject: string;
  totalMarks: number | string;
  isRTL: boolean;
  currentClass?: any;
  profile?: {
    department?: string;
    boardName?: string;
    examDate?: string;
  };
}

const UniversityHeader: React.FC<UniversityHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
}) => {
  const alignmentClass = isRTL ? 'text-end' : 'text-start';
  
  // Normalize class name display
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className={`container-fluid mb-4 p-4 text-dark bg-white ${alignmentClass}`}
      style={{ 
        fontFamily: settings.headingFontFamily, 
        border: '4px double #000', // The distinctive university double border
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Central University Branding */}
      <div className="text-center border-bottom border-dark pb-3 mb-3">
        <h1 
          className="fw-bold text-uppercase m-0" 
          style={{ 
            fontSize: `${settings.titleFontSize || 22}px`, 
            letterSpacing: '2px',
            fontFamily: settings.titleFontFamily 
          }}
        >
          {profile?.department || 'DEPARTMENT OF SECONDARY EDUCATION'}
        </h1>
        <p className="fst-italic m-0 text-muted" style={{ fontSize: '12px' }}>
          {profile?.boardName || 'Board of Intermediate & Secondary Assessment'}
        </p>
      </div>

      {/* Subject and Grade Bar */}
      <div 
        className="d-flex justify-content-between fw-bold mb-3 px-2" 
        style={{ fontSize: `${(settings.metaFontSize || 14) + 2}px` }}
      >
        <span className="text-uppercase">{subject} PAPER</span>
        <span>{classNameDisplay || '9th Grade'}</span>
      </div>

      {/* Meta Row: Date, Time, Marks */}
      <div 
        className="row text-center px-2 mb-4" 
        style={{ fontSize: `${settings.metaFontSize || 14}px` }}
      >
        <div className={isRTL ? 'col-4 text-end' : 'col-4 text-start'}>
          <strong>Date:</strong> {profile?.examDate || '_________'}
        </div>
        <div className="col-4">
          <strong>Time:</strong> 60 Minutes
        </div>
        <div className={isRTL ? 'col-4 text-start' : 'col-4 text-end'}>
          <strong>Marks:</strong> {totalMarks}
        </div>
      </div>

      {/* Formal Name Input */}
      <div 
        className="d-flex align-items-end px-2" 
        style={{ fontSize: `${settings.metaFontSize || 14}px` }}
      >
        <strong className={isRTL ? 'ms-2' : 'me-2'}>Full Name:</strong>
        <div 
          className="flex-grow-1 border-bottom border-dark" 
          style={{ height: '1.2em' }}
        ></div>
      </div>
    </div>
  );
};

export default UniversityHeader;
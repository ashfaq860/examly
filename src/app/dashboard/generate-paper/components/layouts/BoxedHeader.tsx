import React from 'react';

/**
 * Interface defining the settings for styling the header.
 */
interface HeaderSettings {
  headingFontFamily?: string;
  titleFontFamily?: string;
  titleFontSize?: number;
  metaFontSize: number;
}

interface BoxedHeaderProps {
  settings: HeaderSettings;
  subject: string;
  totalMarks: number | string;
  isRTL?: boolean;
  currentClass?: string;
  session?: string;
  instituteName?: string;
  profile?: {
    logoUrl?: string;
    institution?: string;
    address?: string;
    cellno?: string;
  };
}

/**
 * BoxedHeader Component
 * A professional, boxed-style header variant for academic assessments.
 * Features a red-accented sidebar and print-friendly CSS.
 */
const BoxedHeader: React.FC<BoxedHeaderProps> = ({
   settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile
}) => {
  // Common style for ensuring colors show up in PDF/Print exports
  const printColorStyle: React.CSSProperties = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  return (
    <div 
      className={`container-fluid mb-2 bg-white shadow-sm border ${isRTL ? 'text-end' : 'text-start'}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ 
        fontFamily: settings.headingFontFamily, 
        borderLeft: isRTL ? 'none' : '8px solid #dc3545',
        borderRight: isRTL ? '8px solid #dc3545' : 'none',
        ...printColorStyle 
      }}
    >
      {/* Header Top Bar */}
      <div 
        className="bg-light p-3 border-bottom d-flex justify-content-between align-items-center" 
        style={printColorStyle}
      >
        <div>
          <h2 
            className="fw-bold text-danger m-0" 
            style={{ 
              fontSize: `${settings.titleFontSize}px`, 
              fontFamily: settings.titleFontFamily 
            }}
          >
            {profile?.institution || 'Your Institution Name'}, ph#{profile?.cellno || 'N/A'}
          </h2>
          <p className="text-muted m-0" style={{ fontSize: '11px' }}>
            Monthly Progress Assessment
          </p>
        </div>
        
        <div 
          className="text-danger fw-bold border border-danger px-3 py-1 rounded" 
          style={{ 
            fontSize: `${settings.metaFontSize + 2}px`, 
            ...printColorStyle 
          }}
        >
          {subject}
        </div>
      </div>

      {/* Assessment Metadata */}
      <div className="p-3 row g-3" style={{ fontSize: `${settings.metaFontSize}px` }}>
        {/* Full Name Field */}
        <div className="col-12 d-flex align-items-end mb-1">
          <strong 
            className={`text-uppercase text-muted ${isRTL ? 'ms-2' : 'me-2'}`} 
            style={{ fontSize: `${settings.metaFontSize}px` }}
          >
            Full Name:
          </strong>
          <div className="flex-grow-1 border-bottom border-secondary"></div>
        </div>

        {/* Details Grid */}
        <div className="col-4">
          <div className="text-uppercase text-muted" style={{ fontSize: `${settings.metaFontSize}px` }}>
            Class
          </div>
          <div className="fw-bold">{currentClass.name}</div>
        </div>

        <div className="col-4 text-center">
          <div className="text-uppercase text-muted" style={{ fontSize: `${settings.metaFontSize}px` }}>
            Session
          </div>
          <div className="fw-bold">{}</div>
        </div>

        <div className={`col-4 ${isRTL ? 'text-start' : 'text-end'}`}>
          <div className="text-uppercase text-muted" style={{ fontSize: `${settings.metaFontSize}px` }}>
            Total Marks
          </div>
          <div className="fw-bold text-danger fs-5">{totalMarks}</div>
        </div>
      </div>
    </div>
  );
};

export default BoxedHeader;
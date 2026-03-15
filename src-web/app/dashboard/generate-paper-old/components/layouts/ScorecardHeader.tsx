import React from 'react';

/**
 * ScorecardHeader Component
 * Optimized with a triple-input single row for Name, Roll Number, and Section.
 */

interface ScorecardHeaderProps {
  settings: {
    headingFontFamily?: string;
    titleFontFamily?: string;
    titleFontSize?: number;
    metaFontSize?: number;
    logoWidth?: number;
    logoHeight?: number;
  };
  subject: string;
  totalMarks: number | string;
  isRTL: boolean;
  currentClass?: any;
  profile?: {
    logo?: string;
    institution?: string;
    address?: string;
    cellNo?: string;
  };
}

const ScorecardHeader: React.FC<ScorecardHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
}) => {
  const alignmentClass = isRTL ? 'text-start' : 'text-start';
  const borderEndClass = isRTL ? 'border-end' : 'border-end';
  const marginClass = isRTL ? 'me-3' : 'me-3';
  
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className={`container-fluid mb-2 p-2 rounded shadow-sm border border-info border-top-0 position-relative ${alignmentClass}`}
      style={{ 
        fontFamily: settings.headingFontFamily || 'sans-serif', 
        backgroundColor: '#fff',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      dir={isRTL ? 'ltr' : 'ltr'}
    >
      {/* Cyan Accent Top Bar */}
      <div 
        className="position-absolute top-0 start-0 w-100 bg-info" 
        style={{ height: '4px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      ></div>

      {/* Header Branding Row */}
      <div className="d-flex justify-content-between align-items-center mt-1 mb-2">
        <div className="d-flex align-items-center">
          {profile?.logo && (
            <div className={marginClass}>
              <img 
                src={profile.logo} 
                alt="Logo" 
                style={{ 
                  width: `${settings.logoWidth || 140}px`, 
                  height: `${settings.logoHeight || 50}px`,
                  objectFit: 'contain'
                }} 
              />
            </div>
          )}
          
          <div>
            <h4 
              className="fw-bold text-dark m-0" 
              style={{ 
                fontSize: `${settings.titleFontSize || 20}px`,
                fontFamily: settings.titleFontFamily,
                lineHeight: '1.2'
              }}
            >
              {profile?.institution || 'STUDENT ASSESSMENT'}
            </h4>
            <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>
              {profile?.address || 'Academic Address Here'}.{profile?.cellNo}
            </span>
          </div>
        </div>
        
        <span 
          className="badge bg-info text-dark rounded-pill px-3 py-2 fw-bold" 
          style={{ 
            fontSize: `${settings.metaFontSize || 12}px`, 
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
          }}
        >
          {subject}
        </span>
      </div>

      {/* Key Meta Stats Row */}
      <div 
        className="bg-light rounded p-2 mb-2 row text-center g-0 border" 
        style={{ 
          fontSize: `${settings.metaFontSize || 14}px`, 
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      >
        <div className={`col-4 ${borderEndClass} border-secondary-subtle`}>
          <div className="text-muted fw-bold" style={{ fontSize: '9px', letterSpacing: '1px' }}>CLASS</div>
          <div className="fw-bold text-dark">{classNameDisplay || '9th Grade'}<sup>{classNameDisplay===2?'nd':classNameDisplay===3?'rd':'th'}</sup></div>
        </div>
        
        <div className={`col-4 ${borderEndClass} border-secondary-subtle`}>
          <div className="text-muted fw-bold" style={{ fontSize: '9px', letterSpacing: '1px' }}>DURATION</div>
          <div className="fw-bold text-dark">1 Hour</div>
        </div>
        
        <div className="col-4">
          <div className="text-muted fw-bold" style={{ fontSize: '9px', letterSpacing: '1px' }}>MAX SCORE</div>
          <div className="fw-bold text-primary">{totalMarks}</div>
        </div>
      </div>

      {/* Triple Input Row: Name, Roll Number & Section */}
      <div className="d-flex gap-3 align-items-center px-1 mb-1">
        {/* Candidate Name - 50% */}
        <div 
          className="d-flex align-items-end" 
          style={{ fontSize: `${settings.metaFontSize || 14}px`, flex: '0 0 50%' }}
        >
          <strong className={`text-muted text-uppercase ${isRTL ? 'ms-2' : 'me-2'}`} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
            Candidate Name:
          </strong>
          <div 
            className="flex-grow-1 border-bottom border-secondary" 
            style={{ height: '1px', borderStyle: 'solid', marginBottom: '2px' }}
          ></div>
        </div>

        {/* Roll Number - 25% */}
        <div 
          className="d-flex align-items-end" 
          style={{ fontSize: `${settings.metaFontSize || 14}px`, flex: '0 0 25%' }}
        >
          <strong className={`text-muted text-uppercase ${isRTL ? 'ms-2' : 'me-2'}`} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
            Roll No:
          </strong>
          <div 
            className="flex-grow-1 border-bottom border-secondary" 
            style={{ height: '1px', borderStyle: 'solid', marginBottom: '2px' }}
          ></div>
        </div>

        {/* Section - 25% */}
        <div 
          className="d-flex align-items-end flex-grow-1" 
          style={{ fontSize: `${settings.metaFontSize || 14}px` }}
        >
          <strong className={`text-muted text-uppercase ${isRTL ? 'ms-2' : 'me-2'}`} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
            Section:
          </strong>
          <div 
            className="flex-grow-1 border-bottom border-secondary" 
            style={{ height: '1px', borderStyle: 'solid', marginBottom: '2px' }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ScorecardHeader;
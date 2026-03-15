import React from 'react';

/**
 * DataBarHeader Component
 * A professional, high-density exam header with institutional branding.
 */

interface DataBarHeaderProps {
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
    cellNo?: string;
    address?: string;
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
  const borderClass = isRTL ? 'border-start ps-2' : 'border-start ps-2';
  const marginClass = isRTL ? 'me-3' : 'me-3';

  // Normalize class name display
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className={`container-fluid mb-2 border border-dark p-2 bg-white ${alignmentClass}`}
      style={{ 
        fontFamily: settings.headingFontFamily || 'serif', 
        fontSize: `${settings.metaFontSize || 13}px`,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
      dir={isRTL ? 'ltr' : 'ltr'}
    >
      {/* Top Row: Institutional Branding */}
      <div className="d-flex justify-content-between align-items-center border-bottom border-dark pb-2 mb-2">
        <div className="d-flex align-items-center">
          {profile?.logo ? (
            <img
              src={profile.logo}
              alt="Institution Logo"
              className={isRTL ? 'ms-3' : 'me-3'}
              style={{
                width: `${settings.logoWidth || 120}px`,
                height: `${settings.logoHeight || 50}px`,
                objectFit: 'contain'
              }}
            />
          ) : (
             <div 
              className={`border border-secondary d-flex align-items-center justify-content-center ${isRTL ? 'ms-3' : 'me-3'}`}
              style={{ width: '45px', height: '45px', fontSize: '8px', color: '#ccc' }}
             >
               LOGO
             </div>
          )}
          <div>
            <h1 
              className="fw-bold m-0 p-0" 
              style={{ 
                fontSize: `${settings.titleFontSize || 20}px`,
                fontFamily: settings.titleFontFamily || 'inherit',
                lineHeight: '1.1'
              }}
            >
              {profile?.institution || 'ACADEMIC ASSESSMENT CENTRE'}
            </h1>
            <small className="text-uppercase tracking-wider" style={{ fontSize: '10px', opacity: 0.8 }}>
             {profile?.address ? `${profile.address}.${profile?.cellNo || ''} ` : 'Official Examination Transcript'}
            </small>
          </div>
        </div>
        
        <div className="text-end">
          <span className="p-2 badge  text-dark fw-normal">
            Date:___________
          </span>
        </div>
      </div>

      {/* Bottom Row: Exam Metadata Bar */}
      <div className="d-flex flex-wrap align-items-center justify-content-between">
        
        {/* Name Field - Primary focus for the student */}
        <div className="d-flex align-items-center flex-grow-1 min-width-0" style={{ maxWidth: '40%' }}>
          <span className="fw-bold me-2">Name:</span>
          <div className="border-bottom border-dark flex-grow-1 mb-1" style={{ height: '1.2rem' }}></div>
        </div>

        {/* Dynamic Data Points */}
        <div className="d-flex align-items-center">
          <div className={`${marginClass} ${borderClass} border-dark`}>
            <span className="fw-bold">Subject:</span> {subject}
          </div>
          
          <div className={`${marginClass} ${borderClass} border-dark`}>
            <span className="fw-bold">Class:</span> {classNameDisplay || '---'}<sup>{classNameDisplay===2?'nd':classNameDisplay===3?'rd':'th'}</sup>
          </div>
          
          <div className={`${borderClass} border-dark`}>
            <span className="fw-bold">Max Marks:</span> {totalMarks}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DataBarHeader;
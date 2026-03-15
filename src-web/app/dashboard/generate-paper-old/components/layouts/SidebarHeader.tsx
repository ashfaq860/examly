import { Superscript } from 'lucide-react';
import React from 'react';

/**
 * SidebarHeader Component
 * A modern, two-tone header variant with a dark sidebar and meta information grid.
 */

interface SidebarHeaderProps {
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
    cellno?: string;
  };
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
}) => {
  const alignmentClass = isRTL ? 'text-start flex-row-reverse-disable' : 'text-start';
  
  // Extracting class name safely
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className={`container-fluid mb-2 border border-2 border-dark p-0 d-flex overflow-hidden ${alignmentClass}`}
      style={{ 
        fontFamily: settings.headingFontFamily,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        borderTopRightRadius: '2.5rem',
        borderTopLeftRadius: '2.5rem',
      }}
      dir={isRTL ? 'ltr' : 'ltr'}
    >
      {/* Dark Sidebar Section (30%) */}
      <div
        className="p-2 text-center d-flex flex-column justify-content-center"
        style={{ 
            width: '30%',
            borderRight:  '2px solid #343a40', 
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact'
        }}
      >
        <div
          className="mx-auto p-2 mb-2 d-flex align-items-center justify-content-center"
          style={{ 
            width: `${settings.logoWidth || 120}px`, 
            height: `${settings.logoHeight || 45}px`, 
            fontSize: '10px',
            overflow: 'hidden'
          }}
        >
          {profile?.logo ? (
            <img 
                src={profile.logo} 
                alt="Logo" 
                style={{ width: '100%', height: '100%' }} 
            />
          ) : (
            'LOGO'
          )}
        </div>
        
        <h2
          className="fw-bold m-0 text-uppercase"
          style={{
            fontSize: `${(settings.titleFontSize || 24) - 4}px`,
            fontFamily: settings.titleFontFamily,
          }}
        >
          {profile?.institution || 'ACADEMY'}
        </h2>
        
        <p className="small  mt-1 m-0" style={{ fontSize: '10px' }}>
          {profile?.address || 'Address Line 1, City, Country'}, Phone: {profile?.cellno || '123-456-7890'}
        </p>
      </div>

      {/* Main Info Section (70%) */}
      <div 
        className="p-3 bg-white text-dark" 
        style={{ width: '70%', fontSize: `${settings.metaFontSize || 14}px` }}
      >
        <div className="row g-3">
          {/* Student Name Line */}
          <div className="col-12 d-flex align-items-end mb-1">
            <strong className={isRTL ? 'ms-2' : 'me-2'}>Name:</strong>
            <div 
                className="flex-grow-1 border-bottom border-secondary" 
                style={{ height: '20px' }}
            ></div>
          </div>

          {/* Metadata Grid */}
          <div className="col-6">
            <div className="text-muted small text-uppercase" style={{ fontSize: '10px' }}>Subject</div>
            <div className="fw-bold">{subject}</div>
          </div>

          <div className="col-6">
            <div className="text-muted small text-uppercase" style={{ fontSize: '10px' }}>Class</div>
            <div className="fw-bold">{classNameDisplay || 'N/A'}<sup>{classNameDisplay===2?'nd':classNameDisplay===3?'rd':'th'}</sup></div>
          </div>

          <div className="col-6">
            <div className="text-muted small text-uppercase" style={{ fontSize: '10px' }}>Time Allowed</div>
            <div className="fw-bold">60 min</div>
          </div>

          <div className="col-6">
            <div className="text-muted small text-uppercase" style={{ fontSize: '10px' }}>Total Marks</div>
            <div className="fw-bold">{totalMarks}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;
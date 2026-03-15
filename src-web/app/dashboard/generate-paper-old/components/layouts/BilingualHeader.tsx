import React from 'react';

/**
 * BilingualHeader Component
 * A dual-language header (English/Urdu) designed for multi-lingual academic environments.
 */

interface BilingualHeaderProps {
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
  currentClass?: any;
  profile?: {
    logo?: string;
    institution?: string; // English Name
    institutionUrdu?: string; // Urdu/RTL Name
   paperType?: string;
  };
}

const BilingualHeader: React.FC<BilingualHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  currentClass,
  profile,
}) => {
  // Safe extraction of class name
  const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;

  return (
    <div
      className="border border-dark bg-white text-dark p-1 mb-4"
      style={{ 
        fontFamily: settings.headingFontFamily,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Top Branding Section */}
      <div className="d-flex justify-content-between align-items-center p-2 mb-1">
        {/* Left: Paper Info */}
        <div className="text-start" style={{ width: '25%' }}>
          <div className="fw-bold" style={{ fontSize: '10px' }}>
            {profile?.paperType || 'Official Paper'}
          </div>
        
        </div>

        {/* Center: Dual Language Title */}
        <div className="text-center" style={{ width: '50%' }}>
          <h1 
            className="fw-bold text-uppercase m-0" 
            style={{ 
                fontSize: `${settings.titleFontSize || 22}px`, 
                fontFamily: settings.titleFontFamily 
            }}
          >
            {profile?.institution || 'DEMO INSTITUTE'}
          </h1>
          <h2 
            className="fw-bold m-0 mt-1" 
            style={{ fontSize: `${(settings.titleFontSize || 22) - 4}px` }} 
            dir="rtl"
          >
           
          </h2>
        </div>

        {/* Right: Logo */}
        <div className="text-end d-flex justify-content-end" style={{ width: '25%' }}>
          <div 
            className="border border-secondary rounded d-flex align-items-center justify-content-center text-muted fw-bold" 
            style={{
                width: `${settings.logoWidth || 50}px`, 
                height: `${settings.logoHeight || 50}px`, 
                fontSize: '9px',
                overflow: 'hidden'
            }}
          >
            {profile?.logo ? (
                <img 
                    src={profile.logo} 
                    alt="Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
            ) : (
                'LOGO'
            )}
          </div>
        </div>
      </div>

      {/* Meta Data & Name Fields */}
      <div className="border-top border-dark">
        {/* Bilingual Info Row */}
        <div 
            className="row g-0 border-bottom border-dark text-center fw-bold align-items-center" 
            style={{ fontSize: `${settings.metaFontSize || 14}px` }}
        >
          <div className="col border-end border-dark p-1 d-flex flex-column">
            <span>Subj: {subject}</span>
            <span style={{fontSize: '10px'}} dir="rtl">مضمون</span>
          </div>
          <div className="col border-end border-dark p-1 d-flex flex-column">
            <span>Time: 1 hr</span>
            <span style={{fontSize: '10px'}} dir="rtl">وقت</span>
          </div>
          <div className="col border-end border-dark p-1 d-flex flex-column">
            <span>Grade: {classNameDisplay || '9th'}</span>
            <span style={{fontSize: '10px'}} dir="rtl">کلاس</span>
          </div>
          <div className="col p-1 d-flex flex-column">
            <span>Marks: {totalMarks}</span>
            <span style={{fontSize: '10px'}} dir="rtl">کل نمبر</span>
          </div>
        </div>

        {/* Name Row */}
        <div className="row g-0 border-bottom border-dark fw-bold align-items-center">
          <div className="col-12 p-1 d-flex align-items-center px-2">
            <span className="me-2 text-nowrap" style={{ fontSize: `${settings.metaFontSize}px` }}>
                Name / نام:
            </span> 
            <span className="flex-grow-1 border-bottom border-dark h-50 mb-1"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BilingualHeader;
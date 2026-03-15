import React from 'react';

interface ModernHeaderProps {
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
    logo?: string;
    institution?: string;
    address?: string;
    cellno?: string;
  };
  paperLanguage?: string;
}
  

const ModernHeader: React.FC<ModernHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile
}) => {
 // console.log('Current Class:', profile);
  const direction = isRTL ? 'ltr' : 'ltr';
  const textAlign = isRTL ? 'text-start' : 'text-start';
  const accentBorder = isRTL ? 'border-start' : 'border-start';
//console.log(profile?.logoUrl, 'Profile Logo URL');
 const classNameDisplay = typeof currentClass === 'object' ? currentClass?.name : currentClass;
  return (
    <div
      className={`container-fluid mb-2 p-0 overflow-hidden rounded-4 shadow-sm border bg-white ${textAlign}`}
      style={{
        fontFamily: settings.headingFontFamily || "'Inter', sans-serif",
        dir: direction,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
      dir={direction}
    >
      {/* Top Brand Bar */}
      <div className="bg-secondary py-1" style={{ width: '100%' }}></div>

      <div className="p-2 px-2">
        <div className="row align-items-center mb-0">
          {/* Logo Section */}
          <div className="col-auto">
            {profile?.logo ? (
              <img
                src={profile.logo}
                alt="Institution Logo"
                style={{ height: '60px', width: '140px', filter: 'grayscale(10%)' }}
              />
            ) : (
              <div className="bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '70px', height: '70px' }}>
                 <span className="text-muted fw-bold">LOGO</span>
              </div>
            )}
          </div>

          {/* Institution Details */}
          <div className={`col ${accentBorder} border-4 ms-2 ps-2`}>
            <h1
              className="fw-black text-dark m-0 ls-tight"
              style={{
                fontSize: `${settings.titleFontSize || 32}px`,
                fontFamily: settings.titleFontFamily,
                letterSpacing: '-0.02em'
              }}
            >
              {profile?.institution || 'ACADEMIC INSTITUTION'}
            </h1>
            <div className="d-flex align-items-center gap-3 mt-1">
              {profile?.address && (
                <span className="small text-muted">{profile.address} {profile.cellno} </span>
              )}
            </div>
          </div>

          {/* Subject Badge */}
          <div className="col text-end">
             <div className="small text-uppercase text-muted  mb-1">Subject</div>
             <h5 className="text-secondary  m-0">{subject}</h5>
          </div>
        </div>

        <hr className="my-2 opacity-10" />

        {/* Info Grid */}
        <div className="row gy-4 align-items-end">
          {/* Student Name Input */}
          <div className="col-md-5">
            <label className="small text-uppercase text-secondary d-flex mb-2 " style={{ fontSize: '11px', letterSpacing: '1px' }}>
            Name________________________ 
            </label>
          <label className="small text-uppercase text-secondary mb-2 " style={{ fontSize: '11px', letterSpacing: '1px' }}>
            Section_____________________ 
            </label>
           
          </div>

          {/* Metadata Cards */}
          <div className="col-md-7">
            <div className="d-flex justify-content-between gap-4">
              <div>
                <div className="small text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '10px' }}>Grade</div>
                <div className="fw-bold text-dark fs-5">{classNameDisplay || 'Standard'}<sup>{classNameDisplay===2?'nd':classNameDisplay===3?'rd':'th'}</sup></div>
              </div>
              
              <div className="vr opacity-10"></div>

              <div>
                <div className="small text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '10px' }}>Duration</div>
                <div className="fw-bold text-dark fs-5">120 <span className="small fw-normal">Min</span></div>
              </div>

              <div className="vr opacity-10"></div>

              <div className={isRTL ? 'text-start' : 'text-end'}>
                <div className="small text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '10px' }}>Total Marks</div>
                <div className="display-6 fw-black text-primary" style={{ lineHeight: 1 }}>{totalMarks}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernHeader;
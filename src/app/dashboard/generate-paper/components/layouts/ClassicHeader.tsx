import React from 'react';

/**
 * ClassicHeader Component
 * A formal, dashed-border header designed for academic examination papers.
 */

interface ClassicHeaderProps {
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
    logoUrl?: string;
    institution?: string;
    address?: string;
    cellno?: string;
  };
}

const ClassicHeader: React.FC<ClassicHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile
}) => {
  //const alignmentClass = isRTL ? 'text-end' : 'text-start';
const alignmentClass = isRTL ? 'text-start' : 'text-start';

  /* FULL dashed border (important for Firefox print) */
  const dashedBorder: React.CSSProperties = {
    border: '2px dashed black'
  };

  const dashedBottom: React.CSSProperties = {
    borderBottom: '2.5px dashed black'
  };

  const dashedRight: React.CSSProperties = {
    borderRight: '2.5px dashed black'
  };

  const dashedGrid: React.CSSProperties = {
    border: '2.5px dashed black',
    borderCollapse: 'separate'
  };

  return (
    <div
      className={`bg-white text-dark border border-2 border-dark p-2 mb-3 ${alignmentClass}`}
      style={{
      
        fontFamily: settings.headingFontFamily,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
     // dir={isRTL ? 'rtl' : 'ltr'}
    dir={'ltr'}
    >
      {/* Header Title Section */}
      <div className="text-center mb-2 mt-1">
        <h1
          className="fw-bold text-uppercase m-0"
          style={{
            fontSize: `${settings.titleFontSize || 24}px`,
            fontFamily: settings.titleFontFamily
          }}
        >
          {profile?.institution || 'Your Institution Name'}
        </h1>
        <p className="m-0 fw-bold text-muted" style={{ fontSize: '11px' }}>
        {profile?.address || 'Institution Address Line 1, City, Country'}, Phone: {profile?.cellno || '123-456-7890'}
        </p>
      </div>

      {/* Meta Data Grid */}
      <div
        className="row g-0"
        style={{
          ...dashedGrid,
          fontSize: `${settings.metaFontSize || 14}px`
        }}
      >
        {/* Left Column */}
        <div
          className="col-4 d-flex flex-column"
          style={dashedRight}
        >
          <div style={{ ...dashedBottom, padding: '4px' }}>
            <strong>Name:</strong> ________________
          </div>

          <div style={{ ...dashedBottom, padding: '4px' }}>
            <strong>Roll No:</strong> ________________
          </div>

          <div style={{ padding: '4px' }}>
            <strong>Date:</strong>{' '}
            <span className="fw-normal ms-1">30-09-2026</span>
          </div>
        </div>

        {/* Middle Column */}
        <div
          className="col-4 d-flex align-items-center justify-content-center p-2"
          style={dashedRight}
        >
          <div
            style={{
              width: `${settings.logoWidth || 120}px`,
              height: `${settings.logoHeight || 60}px`,
              fontSize: '12px'
            }}
          >
            <img
              src={profile?.logoUrl || '/examly.png'}
              alt="Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="col-4 d-flex flex-column">
          <div style={{ ...dashedBottom, padding: '4px' }}>
            <strong>Class:</strong>{' '}
            <span className="fw-normal ms-1">
              {currentClass?.name || currentClass}
            </span>
          </div>

          <div style={{ ...dashedBottom, padding: '4px' }}>
            <strong>Subject:</strong>{' '}
            <span className="fw-normal ms-1">{subject}</span>
          </div>

          {/* IMPORTANT: no border collapse issue now */}
          <div style={{ padding: '4px' }}>
            <strong>Max Marks:</strong>{' '}
            <span className="fw-normal ms-1">{totalMarks}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassicHeader;

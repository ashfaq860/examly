import React from 'react';

/**
 * ULTRA-COMPACT PREMIUM HEADER
 * Optimized for identical high-density rendering on Screen and Professional Print Output.
 */

interface CompactHeaderProps {
  settings: {
    headingFontFamily?: string;
    titleFontFamily?: string;
    metaFontSize: number;
    titleFontSize: number;
  };
  totalMarks: string | number;
  subject: string;
  isRTL: boolean;
  directionClass: string;
  currentClass: {
    name?: string;
  };
  profile?: {
    logoUrl?: string;
    institution?: string;
  };
}

const CompactHeader: React.FC<CompactHeaderProps> = ({
  settings,
  totalMarks,
  subject,
  isRTL,
  directionClass,
  currentClass,
  profile,
}) => {
  // Safe directional spacing based on layout direction
  const marginSpacingClass = isRTL ? 'me-1' : 'ms-1';

  // Shared styles for the fillable lines - cross-browser safe
  const lineStyle: React.CSSProperties = {
    borderBottom: "1.25pt solid #000000",
    display: "inline-block",
    height: "1.1rem",
    width: "100%",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.headingFontFamily || 'serif',
    fontSize: `${settings.metaFontSize}px`,
    borderBottom: "2.5pt double #000000",
    position: "relative",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    width: '100%',
  };

  return (
    <div 
      className={`container-fluid mb-0 p-0 exam-print-header-container ${directionClass}`} 
      style={containerStyle}
    >
      {/* Header Row: Title, Logo and Marks */}
      <div 
        className="d-flex justify-content-between align-items-center mb-0"
        style={{ width: '100%' }}
      >
        {/* Placeholder for School Logo */}
        <div style={{ width: "120px", padding: "5px", height: "35px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={profile?.logoUrl || '/examly.png'}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div className="text-center flex-grow-1 px-2">
          <h2 style={{ 
            margin: 0, 
            fontSize: `${settings.titleFontSize - 8}px`, 
            fontFamily: settings.titleFontFamily,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontWeight: "800",
            lineHeight: "1.1",
            color: '#000000'
          }}>
            {profile?.institution || 'BOARD EXAMINATION CENTER'}
          </h2>
        </div>

        <div className="fw-bold text-nowrap" style={{ fontSize: "11px", minWidth: "85px", textAlign: isRTL ? "left" : "right" }}>
          MARKS: {totalMarks}
        </div>
      </div>

      {/* Student Info Row - Powered by Grid for pixel-perfect identical screen/print sizing */}
      <div 
        className="fw-bold align-items-end" 
        style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 25% 12% 10% 15%',
          gap: '12px',
          fontSize: `${settings.metaFontSize}px`, 
          marginTop: "0px",
          paddingBottom: "4px",
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div className="d-flex align-items-end">
          <span className="text-nowrap">NAME:</span>
          <div className={`flex-grow-1 ${marginSpacingClass}`} style={lineStyle}></div>
        </div>

        <div className="d-flex align-items-end">
          <span className="text-nowrap">SUB:</span>
          <div className={`flex-grow-1 ${marginSpacingClass} text-center`} style={lineStyle}>{subject}</div>
        </div>

        <div className="d-flex align-items-end">
          <span className="text-nowrap">CLASS:</span>
          <div className={`flex-grow-1 ${marginSpacingClass} text-center`} style={lineStyle}>{currentClass?.name || '___'}</div>
        </div>

        <div className="d-flex align-items-end">
          <span className="text-nowrap">SEC:</span>
          <div className={`flex-grow-1 ${marginSpacingClass}`} style={lineStyle}></div>
        </div>

        <div className="d-flex align-items-end">
          <span className="text-nowrap">DATE:</span>
          <div className={`flex-grow-1 ${marginSpacingClass}`} style={lineStyle}></div>
        </div>
      </div>

      {/* Scoped CSS for Guarding Print Dimensions */}
      <style>{`
        @media print {
          .exam-print-header-container { 
            border-bottom: 2.5pt double #000000 !important; 
            display: block !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .exam-print-header-container div, 
          .exam-print-header-container span, 
          .exam-print-header-container h2 { 
            border-color: #000000 !important; 
            color: #000000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CompactHeader;
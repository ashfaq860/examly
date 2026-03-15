import React from 'react';

/**
 * ULTRA-COMPACT PREMIUM HEADER
 * Optimized for high-density assessment papers and professional print output.
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
  // Shared styles for the fillable lines
  const lineStyle: React.CSSProperties = {
    borderBottom: "1pt solid #000",
    display: "inline-block",
    height: "1rem",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
  };

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.headingFontFamily || 'serif',
    fontSize: `${settings.metaFontSize}px`,
    border: "2.5pt double #000",
    borderRadius: "8px",
    position: "relative",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
    backgroundColor: '#fff',
  };

  return (
    <div className={`container-fluid mb-0 p-2 ${isRTL ? 'text-start' : 'text-start'}`} style={containerStyle}>
      {/* Decorative Corner Accents */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "20px", height: "20px", borderTop: "3px solid #000", borderLeft: "3px solid #000", borderTopLeftRadius: "5px" }} />
      <div style={{ position: "absolute", top: 0, right: 0, width: "20px", height: "20px", borderTop: "3px solid #000", borderRight: "3px solid #000", borderTopRightRadius: "5px" }} />

      {/* Header Row: Title and Marks */}
      <div 
        className={`d-flex justify-content-between align-items-center mb-1 pb-1 ${directionClass}`}
        style={{ borderBottom: "1.5pt solid #000" }}
      >
        {/* Placeholder for School Logo */}
        <div style={{ width: "120px",padding:"5px", height: "35px", border: "1pt solid #000", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: "bold", textAlign: 'center' }}>
          <img
            src={profile?.logoUrl || '/examly.png'}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div className="text-center flex-grow-1">
          <h2 style={{ 
            margin: 0, 
            fontSize: `${settings.titleFontSize - 8}px`, 
            fontFamily: settings.titleFontFamily,
            textTransform: "uppercase",
            letterSpacing: "1px",
            fontWeight: "800",
            lineHeight: "1.1"
          }}>
          {profile?.institution || 'BOARD EXAMINATION CENTER'}
          </h2>
          <div style={{ fontSize: "9px", fontWeight: "600", opacity: 0.9, lineHeight: "1" }}>
            SESSION 2025-26
          </div>
        </div>

        <div className="fw-bold" style={{ fontSize: "11px", minWidth: "85px", textAlign: isRTL ? "right" : "right" }}>
          MARKS: {totalMarks}
        </div>
      </div>

      {/* Student Info Row */}
      <div className={`d-flex align-items-end gap-2 fw-bold ${directionClass}`} style={{ fontSize: `${settings.metaFontSize}px`, marginTop: "4px" }}>
        <div className="d-flex flex-grow-1">
          <span className="text-nowrap">NAME:</span>
          <div className="flex-grow-1 ms-1" style={lineStyle}></div>
        </div>

        <div className="d-flex" style={{ flex: "0 0 25%" }}>
          <span className="text-nowrap">SUB:</span>
          <div className="flex-grow-1 ms-1 text-center" style={lineStyle}>{subject}</div>
        </div>

        <div className="d-flex" style={{ flex: "0 0 12%" }}>
          <span className="text-nowrap">CLASS:</span>
          <div className="flex-grow-1 ms-1 text-center" style={lineStyle}>{currentClass?.name || '___'}</div>
        </div>

        <div className="d-flex" style={{ flex: "0 0 10%" }}>
          <span className="text-nowrap">SEC:</span>
          <div className="flex-grow-1 ms-1" style={lineStyle}></div>
        </div>

        <div className="d-flex" style={{ flex: "0 0 15%" }}>
          <span className="text-nowrap">DATE:</span>
          <div className="flex-grow-1 ms-1" style={lineStyle}></div>
        </div>
      </div>

      {/* Scoped CSS for Print Perfect Rendering */}
      <style>{`
        @media print {
          .container-fluid { 
            border: 2.5pt double black !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Ensure lines don't vanish on low-ink or draft print settings */
          div, span { 
            border-color: black !important; 
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CompactHeader;
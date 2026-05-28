'use client';
import React from 'react';

interface StandardHeaderProps {
  settings: any;
  subject: string;
  totalMarks: number;
  currentClass: any;
  // Accept standard BISE structural parameters or fallback gracefully
  paperType?: string;      // e.g., "I (Essay Type)" or "Objective"
  timeAllowed?: string;    // e.g., "1.45 hours"
  sessionRange?: string;   // e.g., "2020-2022 to 2023-2025"
  examType?: string;       // e.g., "First Annual - 2024"
  groupName?: string;      // e.g., "दूसरा ग्रुप" / "Group-II"
  partInfo?: string;       // e.g., "PART - I"
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  settings = {},
  subject = "CHEMISTRY",
  totalMarks = 48,
  currentClass,
  paperType = "I (Essay Type)",
  timeAllowed = "1.45 hours",
  sessionRange = "2020-2022 to 2023-2025",
  examType = "First Annual - 2024",
  groupName = "(دوسرا گروپ)",
  partInfo = "PART - I",
}) => {
  // Extract clean class text (e.g., "9th Class" or "نہم کلاس")
  const classLabelEn = typeof currentClass === 'object' ? currentClass.name : (currentClass || "9th");
  const is9th = classLabelEn.toString().toLowerCase().includes('9');
  const classLabelUrdu = is9th ? "نہم کلاس" : "دہم کلاس";

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.headingFontFamily || '"Times New Roman", Times, "Urdu Typesetting", "Noori Nastaliq", Arial, sans-serif',
    width: '100%',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box',
    padding: '4px 0px 12px 0px',
    borderBottom: '1px solid #000000', // Bottom border separating header from questions
    lineHeight: '1.4',
  };

  return (
    <div style={containerStyle} className="bise-lahore-header">
      <style>
        {`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .bise-lahore-header {
              display: block !important;
              border-bottom: 1px solid #000000 !important;
              padding: 4px 0px 12px 0px !important;
            }
          }
          .bise-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100%;
          }
          .bise-col-left {
            width: 35%;
            text-align: left;
            direction: ltr;
          }
          .bise-col-center {
            width: 30%;
            text-align: center;
            font-size: 14px;
          }
          .bise-col-right {
            width: 35%;
            text-align: right;
            direction: rtl;
            font-family: "Urdu Typesetting", "Noori Nastaliq", "Times New Roman", serif;
          }
          .bise-subject-title-en {
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .bise-subject-title-ur {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .bise-meta-text {
            font-size: 14px;
            margin: 2px 0;
          }
          .bise-roll-line {
            display: inline-block;
            border-bottom: 1px dotted #000000;
            min-width: 160px;
            text-align: center;
            font-family: "Times New Roman", sans-serif;
            font-weight: bold;
            letter-spacing: 1px;
            margin: 0 4px;
          }
          .bise-session-text {
            font-size: 15px;
            font-weight: bold;
            word-spacing: 1px;
          }
        `}
      </style>

      {/* Top Section: Roll Number and Academic Sessions */}
      <div className="bise-row" style={{ marginBottom: '6px' }}>
        {/* Left Side is empty or structural placeholder contextually */}
        <div className="bise-col-left"></div>
        
        {/* Mirroring image_67e9e1.png top right side text layout */}
        <div className="bise-col-right" style={{ width: '100%', textDirection: 'rtl' }}>
          <span style={{ fontSize: '15px' }}>رول نمبر۔</span>
          <span className="bise-roll-line">&nbsp;</span>
          <span style={{ fontSize: '13px', marginRight: '4px' }}>(امیدوار خود پُر کرے)</span>
          <span className="bise-session-text" style={{ marginRight: '15px' }}>
            (تعلیمی سیشن {sessionRange})
          </span>
        </div>
      </div>

      {/* Main Metadata Grid (English Left | Central Sub-meta | Urdu Right) */}
      <div className="bise-row">
        
        {/* Left Column: English Details */}
        <div className="bise-col-left">
          <div className="bise-subject-title-en">{subject}</div>
          <div className="bise-meta-text">Paper : {paperType}</div>
          <div className="bise-meta-text">Time Allowed : {timeAllowed}</div>
          <div className="bise-meta-text">Maximum Marks : {totalMarks}</div>
        </div>

        {/* Center Column: Centralized Metadata Stack */}
        <div className="bise-col-center" style={{ paddingTop: '18px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {examType} - ({classLabelUrdu})
          </div>
          <div style={{ marginTop: '4px', fontSize: '13px' }}>
            {groupName}
          </div>
          <div style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' }}>
            ( {partInfo} - حصہ اول )
          </div>
        </div>

        {/* Right Column: Urdu Details */}
        <div className="bise-col-right">
          <div className="bise-subject-title-ur">کیمسٹری</div>
          <div className="bise-meta-text">
            پرچہ : {paperType.includes('I') ? 'I' : 'II'} (انشائیہ طرز)
          </div>
          <div className="bise-meta-text">
            وقت : {timeAllowed.replace('hours', 'گھنٹے')}
          </div>
          <div className="bise-meta-text">
            کل نمبر : {totalMarks}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StandardHeader;
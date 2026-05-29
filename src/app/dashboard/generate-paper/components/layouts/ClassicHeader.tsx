// dashboard/generate-paper/components/layouts/StandardHeader.tsx
'use client';
import React from 'react';

interface StandardHeaderProps {
    settings: {
    headingFontFamily?: string;
    titleFontFamily?: string;
    titleFontSize?: number;
    metaFontSize?: number;
    logoWidth?: number;
    logoHeight?: number;
  };
  subject: string;
  totalMarks: number;
  isRTL: boolean;
  currentClass: any;
  profile?: {
    logo?: string;
    institution?: string;
    address?: string;
    cellno?: string;
  };
  paperPart:any;
  subjectUrduName?: string;
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
  subjectUrduName,
  paperPart
}) => {
  const headerLabel = typeof currentClass === 'object' ? currentClass.name : currentClass;

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.headingFontFamily || 'Times New Roman, Arial',
    backgroundColor: 'white',
    color: 'black',
    padding: '5px 5px',
    marginBottom: '5px',
    boxSizing: 'border-box',
    width: '100%',
  };
const getClassNameUrdu = (className: string | number) => {
  const classMap: Record<string, string> = {
    '1': 'پہلی',
    '2': 'دوم',
    '3': 'سوم',
    '4': 'چہارم',
    '5': 'پنجم',
    '6': 'ششم',
    '7': 'ہفتم',
    '8': 'ہشتم',
    '9': 'نہم',
    '10': 'دہم',
    '11': 'گیارویں',
    '12': 'بارہویں',
  };

  return classMap[String(className)] || String(className);
};
  return (
    <div style={containerStyle} className="standard-header">
      <style>
        {`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .standard-header {
              display: block !important;
              margin-bottom: 5px !important;
            }
          }
          .bise-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100%;
            margin-bottom: 0px;
          }
          .bise-col {
            flex: 1;
          }
          .bise-urdu {
            font-family: "JameelNoori", "Jameel Noori Nastaleeq", "Arial", sans-serif;
            text-align: right;
            direction: rtl;
          }
          .bise-english {
            text-align: left;
            direction: ltr;
          }
          .bise-center {
            text-align: center;
          }
        `}
      </style>

      {/* Institution Branding Header (Logo and Name Inline) */}
 {/* Placeholder for School Logo */}
    <div style={{ 
      width: `${settings.logoWidth || 120}px`, 
      height: `${settings.logoHeight || 45}px`, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      margin:'auto',
      flexShrink: 0 
    }}>
      <img src={profile?.logoUrl || profile?.logo || '/examly.png'}
        alt="Logo"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>

{profile?.institution && (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '5px', 
    marginBottom: '1px',  
    paddingBottom: '0px',
    width: '100%'
  }}>
   
    {/* Institution Name and Address Details */}
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ 
        margin: 0, 
        fontSize: `${settings.titleFontSize || 18}px`,
        fontWeight: 'bold', 
        textTransform: 'uppercase',
        lineHeight: '1.2' ,
        fontFamily: settings.titleFontFamily
      }}>
        {profile.institution}
      </h3>
      {profile.address && (
        <div style={{ fontSize: `${settings.metaFontSize || 11}px`, color: '#555', marginTop: '2px' }}>
          {profile.address} {profile.cellno && `• Ph: ${profile.cellno}`}
        </div>
      )}
    </div>
  </div>
)}

      {/* Top Row: Session & Roll Number Line */}
      <div className="bise-row" style={{ fontSize: `${Number(settings.metaFontSize)+6 || 22}px`, fontWeight: '700' }}>
        <div className="bise-urdu" style={{ flexGrow: 2, paddingRight: '0px' }}>
         سیکشن_______________________ <span style={{ fontSize: '12px' }}></span>
        </div>
        <div className="bise-urdu" style={{ flexGrow: 2, paddingRight: '0px' }}>
          رول نمبر _______________________ <span style={{ fontSize: '12px' }}></span>
        </div>
        <div className="bise-urdu" style={{ flexGrow: 2, paddingRight: '0px' }}>
          نام_______________________ 
        </div>
      </div>

      {/* Subject Title Row */}
      <div className="bise-row bise-urdu" style={{ fontSize: `${Number(settings.metaFontSize)+6 || 22}px`, lineHeight: '1.8',fontWeight: 'bold' }}>
        <div className="bise-urdu">
          {subjectUrduName ? `${subjectUrduName} ` : 'ریاضی (لازمی)'}
        </div>
         <div className="bise-urdu" >کلاس {getClassNameUrdu(currentClass?.name || currentClass || 'Class')}</div>
          <div style={{ fontWeight: 'bold' }}>کل نمبر : {totalMarks || 60}</div>
            <div className="bise-urdu">پرچہ :{paperPart === 'mcq' ? 'معروضی طرز' : '(انشائیہ طرز)'} </div>
       
        
      </div>

      
      {/* Double divider underneath the header parameters */}
      <div style={{ borderBottom: '2px solid black', marginTop: '0px' }}></div>
     
    </div>
  );
};

export default StandardHeader;
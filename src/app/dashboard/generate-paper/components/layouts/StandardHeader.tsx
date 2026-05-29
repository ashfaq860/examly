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
    {/* Placeholder for School Logo */}
    <div style={{ 
      width: `${settings.logoWidth || 120}px`, 
      height: `${settings.logoHeight || 45}px`, 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      flexShrink: 0 
    }}>
      <img src={profile?.logoUrl || profile?.logo || '/examly.png'}
        alt="Logo"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>

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
      <div className="bise-row" style={{ fontSize: `${Number(settings.metaFontSize)+4 || 14}px`, fontWeight: '700' }}>
       
        <div className="bise-urdu" style={{ flexGrow: 2, paddingRight: '0px' }}>
          رول نمبر ___________________________ <span style={{ fontSize: '12px' }}>(امیدوار خود پُر کرے)</span>
        </div>
        <div className="bise-urdu" style={{ flexGrow: 2, paddingRight: '0px' }}>
          نام___________________________ 
        </div>
      </div>

      {/* Subject Title Row */}
      <div className="bise-row" style={{  paddingBottom: '0px' }}>
        <div className="bise-english" style={{ fontSize: `${settings.metaFontSize || 14}px`, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {subject || 'MATHEMATICS'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}></span>
        </div>
         <div>{currentClass?.name || currentClass || 'Class'}<sup>th</sup> Class</div>
          <div className="bise-urdu" >کلاس {getClassNameUrdu(currentClass?.name || currentClass || 'Class')}</div>
         
        <div className="bise-urdu" style={{ fontSize: `${Number(settings.metaFontSize)+4 || 18}px`, fontWeight: 'bold' }}>
          {subjectUrduName ? `${subjectUrduName} ` : 'ریاضی (لازمی)'}
        </div>
      </div>

      <div className="bise-row" >
          <div className="bise-english" style={{ fontSize: `${Number(settings.metaFontSize) || 14}px`, lineHeight: '1.6', fontWeight: 'bold' }}>Paper : {paperPart === 'mcq' ? 'MCQ Type' : 'Essay Type'}</div>
          <div className="bise-urdu" style={{ fontSize: `${Number(settings.metaFontSize)+2 || 14}px`, lineHeight: '1.6', fontWeight: 'bold' }}>پرچہ :{paperPart === 'mcq' ? 'معروضی طرز' : '(انشائیہ طرز)'} </div>
      
      </div>

<div className="bise-row">
          <div className="bise-col" style={{ fontSize: `${settings.metaFontSize || 14}px`, lineHeight: '1.6',fontWeight:'bold' }}>
              <div>Time Allowed : 2:10 hours</div>
          </div>
          <div className="bise-col" style={{ fontSize: `${Number(settings.metaFontSize) || 14}px`, lineHeight: '1.6',fontWeight:'bold'   }}>
              <div>وقت : 2:10 گھنٹے</div>
          </div>
          
        <div className="bise-english bise-col" style={{ fontSize: `${settings.metaFontSize || 14}px`, lineHeight: '1.6' }}>
          <div style={{ fontWeight: 'bold' }}>Maximum Marks : {totalMarks || 60}</div>
        </div>
        <div className="bise-col bise-urdu" style={{ fontSize: `${Number(settings.metaFontSize)|| 14}px`, lineHeight: '1.6' }}>
          <div style={{ fontWeight: 'bold' }}>کل نمبر : {totalMarks || 60}</div>
        </div>
      
      </div>

      {/* Double divider underneath the header parameters */}
      <div style={{ borderBottom: '2px solid black', marginTop: '0px' }}></div>
     
    </div>
  );
};

export default StandardHeader;
'use client';
import React from 'react';

interface StandardHeaderProps {
  settings: any;
  subject: string;
  totalMarks: number;
  isRTL: boolean;
  currentClass: any;
  profile?: {
    logoUrl?: string;
    institution?: string;
    address?: string;
  };
}

const StandardHeader: React.FC<StandardHeaderProps> = ({
  settings,
  subject,
  totalMarks,
  isRTL,
  currentClass,
  profile,
}) => {
  const headerLabel = typeof currentClass === 'object' ? currentClass.name : currentClass;

  const containerStyle: React.CSSProperties = {
    fontFamily: settings.headingFontFamily || 'Arial',
    border: '2px solid black',
    padding: '5px',
    marginBottom: '5px',
    backgroundColor: 'white',
    color: 'black',
    direction: isRTL ? 'rtl' : 'ltr',
    boxSizing: 'border-box',
    position: 'relative', // helps Firefox render border
  };

  const logoStyle: React.CSSProperties = {
   
    width: `${settings.logoWidth || 140}px`,
    height: `${settings.logoHeight || 60}px`,
    padding:'10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : '15px',
    marginLeft: isRTL ? '15px' : 0,
    boxSizing: 'border-box',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    marginTop: '10px',
    border: '1px solid black',
    boxSizing: 'border-box',
  };

  const tdStyle: React.CSSProperties = {
    border: '1px solid black',
    padding: '4px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: settings.metaFontSize || 12,
    boxSizing: 'border-box',
  };

  const leftTdStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: isRTL ? 'right' : 'left',
    paddingLeft: '10px',
  };

  return (
    <div style={containerStyle} className="standard-header">
     <style>
  {`
    @media print {
      /* 1. Force Firefox to render backgrounds and borders */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* 2. Fix the outer container */
      .standard-header {
        display: block !important;
        border: 2px solid black !important; 
        outline: 1px solid black !important;
        margin: 0 !important;
        padding: 5px !important;
      }

      /* 3. Table specific fixes for Firefox */
      table {
        border-collapse: collapse !important;
        width: 100% !important;
        border: 1px solid black !important;
      }

      table td, table th {
        border: 1px solid black !important;
        /* Use pt for physical printing consistency */
        border-width: 1pt !important; 
        background-color: transparent !important;
      }
    }
  `}
</style>

      {/* Branding */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '0px' }}>
        <div style={logoStyle}>
          <img
            src={profile?.logoUrl || '/examly.png'}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: settings.titleFontSize || 18, fontFamily: settings.titleFontFamily || 'Arial', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>
            {profile?.institution || 'BOARD EXAMINATION CENTER'}
          </h1>
          <div style={{ fontSize: '11px', marginTop: '0px' }}>
            {profile?.address || 'Institution Address Line 1, City, Country'} • Ph: {profile?.cellno || '123-456-7890'}
          </div>
        </div>
      </div>

      {/* Meta Table */}
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={tdStyle}>Time: 1 hr</td>
            <td style={tdStyle}>Class: {headerLabel}th</td>
            <td style={{ ...tdStyle, width: '35%' }}>Subject: {subject}</td>
            <td style={tdStyle}>Marks: {totalMarks}</td>
            <td style={tdStyle}>Date: 2025-26</td>
          </tr>
          <tr>
            <td colSpan={3} style={leftTdStyle}>
              {isRTL ? 'طالبِ علم کانام: ' : 'Student Name: '}________________________________________________
            </td>
            <td style={tdStyle}>{isRTL ? 'رول نمبر: ' : 'Roll #: '}_______</td>
            <td style={tdStyle}>{isRTL ? 'سیکشن: ' : 'Section: '}______</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default StandardHeader;

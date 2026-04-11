//generate-paper/components/SettingsPanel.tsx
'use client';
import React from 'react';
import { X, Settings, Type, Layout, List, FileText, Image as ImageIcon, FileQuestion,Lock ,ShieldCheck  } from 'lucide-react';
import { PaperSettings } from '@/types/paper-builder';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PaperSettings;
  onSettingChange: (key: keyof PaperSettings, value: number | string) => void;
  isPremium: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingChange,
  isPremium
}) => {
  // Professional Academic Font Pairs

   
const titleFontFamilies = [
    // --- Professional & Academic ---
       // --- Decorative & Stylized ---
   
   
    { name: 'Classic Serif (Times)', value: "'Times New Roman', serif" },
    { name: 'Modern Sans (Arial)', value: "Arial, sans-serif" },
    { name: 'University Serif (Georgia)', value: "'Georgia', serif" },
    { name: 'Clean Professional (Helvetica)', value: "'Helvetica', sans-serif" },
    { name: 'Elegant (Garamond)', value: "'Garamond', serif" },
    { name: 'Algerian', value: "'Algerian', serif" },
    { name: 'Harlow Solid Italic', value: "'Harlow Solid Italic', cursive" },
    { name: 'Vladimir Script', value: "'Vladimir Script', cursive" },
    { name: 'Bodoni MT Poster', value: "'Bodoni MT Poster Compressed', serif" },
    { name: 'Chiller', value: "'Chiller', cursive" },
  ];

  const questionFontFamilies = [
    { name: 'Standard Exam (Arial)', value: "Arial, sans-serif" },
    { name: 'Cambridge Style (Calibri)', value: "'Calibri', sans-serif" },
    { name: 'Formal Reading (Times)', value: "'Times New Roman', serif" },
    { name: 'Modern (Inter/Roboto)', value: "'Inter', sans-serif" },
    { name: 'High Legibility (Verdana)', value: "Verdana, sans-serif" },
  ];

  const headerLayouts = [
    { id: 'standard', name: 'Standard (Board Style)' },
    { id: 'classic', name: 'Classic (Split Grid)' },
    { id: 'modern', name: 'Modern (Minimalist)' },
    { id: 'sidebar', name: 'Academy (Sidebar Logo)' },
    { id: 'instructional', name: 'Technical (instructional)' },
    { id: 'scorecard', name: 'Grading Focused (ScorCard)' },
    
    { id: 'databar', name: 'Ultra Compact Bar' },
  ];

  return (
    <>
      <div 
        className={`settings-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : '-350px',
          width: '320px',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '-5px 0 25px rgba(0,0,0,0.1)',
          zIndex: 9999,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
          borderLeft: '1px solid #e0e0e0'
        }}
      >
        {/* Header */}
        <div className="p-1 border-bottom d-flex justify-content-between align-items-center bg-light">
          <div className="d-flex align-items-center gap-2">
            <Settings size={20} className="text-primary" />
            <h5 className="mb-0 fw-bold" style={{ fontSize: '1.1rem' }}>Change Paper Style</h5>
          </div>
          <button className="btn btn-link text-muted p-0" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="p-2">
{/* SECTION: PREMIUM WATERMARK & DIMENSIONS */}
          <section className="mb-3">
            <div 
              className={`p-2 rounded-3 border ${!isPremium ? 'bg-light opacity-75' : 'bg-white shadow-sm'}`}
              style={{ transition: 'all 0.3s ease' }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  {isPremium ? (
                    <ShieldCheck size={18} className="text-success" />
                  ) : (
                    <Lock size={16} className="text-muted" />
                  )}
                  <div>
                    <label className="form-label small fw-bold mb-0 d-block">
                      Paper Watermark
                    </label>
                    {!isPremium && <span style={{ fontSize: '0.65rem' }} className="text-danger fw-bold">PREMIUM ONLY</span>}
                  </div>
                </div>

                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={!!settings.showWatermark}
                    disabled={!isPremium}
                    onChange={(e) => onSettingChange('showWatermark', e.target.checked)}
                    style={{ cursor: isPremium ? 'pointer' : 'not-allowed' }}
                  />
                </div>
              </div>

              {/* Collapsible Dimension Controls (Only for Premium + Active) */}
              {isPremium && settings.showWatermark && (
                <div className="pt-2 border-top mt-2 animate-fade-in">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="x-small text-muted d-block mb-1">WM Width (px)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm border-0 bg-light"
                        value={settings.watermarkWidth || 400}
                        min="100"
                        max="1000"
                        onChange={(e) => onSettingChange('watermarkWidth', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="x-small text-muted d-block mb-1">WM Height (px)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm border-0 bg-light"
                        value={settings.watermarkHeight || 400}
                        min="100"
                        max="1000"
                        onChange={(e) => onSettingChange('watermarkHeight', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="d-flex justify-content-between x-small text-muted">
                      <span>Opacity</span>
                      <span>{(settings.watermarkOpacity || 0.1) * 100}%</span>
                    </div>
                    <input
                      type="range"
                      className="form-range"
                      min="0.05"
                      max="0.5"
                      step="0.01"
                      value={settings.watermarkOpacity || 0.1}
                      onChange={(e) => onSettingChange('watermarkOpacity', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
          {/* SECTION: HEADER MASTER GROUP */}
          <section className="mb-0">
            <label className="text-uppercase text-primary fw-bold mb-0 d-block" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>
              <Layout size={14} className="me-1" /> Header Configuration
            </label>
            
            <div className="p-0 rounded-3 bg-light shadow-sm mb-0">
              {/* Header Style */}
              <div className="mb-0">
                <label className="form-label small fw-bold">Header Layouts</label>
                <select
                  className="form-select form-select-sm border-0 shadow-sm"
                  value={settings.headerLayout || 'standard'}
                  onChange={(e) => onSettingChange('headerLayout', e.target.value)}
                >
                  {headerLayouts.map(layout => (
                    <option key={layout.id} value={layout.id}>{layout.name}</option>
                  ))}
                </select>
              </div>

             {/* NEW: Academy Title Font Family */}
            <div className="mb-0 pt-0 border-top">
              <label className="form-label small fw-bold text-muted">Academy Title Font</label>
              <select
                className="form-select form-select-sm mb-0 border-0 shadow-sm"
                /* This styles the selected value shown in the collapsed box */
                style={{ 
                  fontFamily: settings.titleFontFamily,
                  fontSize: '14px' // Keep select box text legible
                }}
                value={settings.titleFontFamily}
                onChange={(e) => onSettingChange('titleFontFamily', e.target.value)}
              >
                {titleFontFamilies.map((f) => (
                  <option 
                    key={f.value} 
                    value={f.value}
                    /* This styles the items inside the dropdown list */
                    style={{ fontFamily: f.value, fontSize: '16px' }}
                  >
                    {f.name}
                  </option>
                ))}
              </select>
              
              <div className="d-flex justify-content-between x-small text-muted mb-1 mt-2">
                <span>Font Size</span>
                <span>{settings.titleFontSize}px</span>
              </div>
              <input
                type="range"
                className="form-range"
                min="18" max="48"
                value={settings.titleFontSize}
                onChange={(e) => onSettingChange('titleFontSize', parseInt(e.target.value))}
              />
            </div>

              {/* Header Line Height 
              <div className="mb-0">
                <div className="d-flex justify-content-between x-small text-muted mb-0">
                  <span>Header Line Spacing</span>
                  <span>{settings.headerLineHeight || 1.2}</span>
                </div>
                <input
                  type="range"
                  className="form-range"
                  min="0.8" max="2.5" step="0.1"
                  value={settings.headerLineHeight || 1.2}
                  onChange={(e) => onSettingChange('headerLineHeight', parseFloat(e.target.value))}
                />
              </div>
*/}
              {/* Meta Font (Date/Marks) */}
              <div className="mb-0 pt-0 border-top">
                <div className="d-flex justify-content-between x-small text-muted mb-0">
                  <span>Meta Font (Date, Marks)</span>
                  <span>{settings.metaFontSize}px</span>
                </div>
                <input
                  type="range"
                  className="form-range"
                  min="10" max="16"
                  value={settings.metaFontSize}
                  onChange={(e) => onSettingChange('metaFontSize', parseInt(e.target.value))}
                />
              </div>

              {/* Logo Dimensions */}
              <div className="pt-1">
                <label className="form-label small fw-bold text-muted mb-0">
                  <ImageIcon size={12} className="me-1" /> Logo Dimensions
                </label>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="x-small text-muted d-block">Width</label>
                    <input
                      type="number"
                      className="form-control form-control-sm border-0 shadow-sm"
                      value={settings.logoWidth || 120}
                      onChange={(e) => onSettingChange('logoWidth', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="col-6">
                    <label className="x-small text-muted d-block">Height</label>
                    <input
                      type="number"
                      className="form-control form-control-sm border-0 shadow-sm"
                      value={settings.logoHeight || 60}
                      onChange={(e) => onSettingChange('logoHeight', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <hr />

          {/* Section: Questions & Content */}
          <section className="mb-0">
            <label className="text-uppercase text-primary fw-bold mb-0 d-block" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
            <FileQuestion size={12} className="me-1" /> Question Paper Style
            </label>

            <div className="mb-0 p-2 rounded-3 shadow-sm bg-white border">
              <div className="mb-2">
            <label className="form-label x-small text-muted mb-0 fw-bold">Question Body Font</label>
            <select
              className="form-select form-select-sm border-0 bg-light shadow-sm"
              /* This styles the selected value shown in the collapsed box */
              style={{ 
                fontFamily: settings.fontFamily,
                fontSize: '14px' 
              }}
              value={settings.fontFamily}
              onChange={(e) => onSettingChange('fontFamily', e.target.value)}
            >
              {questionFontFamilies.map((f) => (
                <option 
                  key={f.value} 
                  value={f.value}
                  /* This styles each font option in the dropdown list */
                  style={{ 
                    fontFamily: f.value, 
                    fontSize: '15px',
                    padding: '8px' 
                  }}
                >
                  {f.name}
                </option>
              ))}
            </select>
          </div>

            <div className="mb-0 px-2">
              <label className="form-label small text-muted"> Section Headings Size</label>
              <div className="d-flex align-items-center gap-3">
                <input
                  type="range"
                  className="form-range"
                  min="10" max="24"
                  value={settings.headingFontSize}
                  onChange={(e) => onSettingChange('headingFontSize', parseInt(e.target.value))}
                />
                <span className="badge bg-secondary">{settings.headingFontSize}px</span>
              </div>
            </div>
              {/* MCQ Settings */}
              <div className="pt-2 border-top mb-0">
                <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                  <List size={14} className="text-muted" /> MCQ Part style
                </label>
                <div className="mb-2">
                  <div className="d-flex justify-content-between x-small mb-0 text-muted">
                    <span>Font Size</span>
                    <span>{settings.mcqFontSize || 12}px</span>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min="6" max="24"
                    value={settings.mcqFontSize || 12}
                    onChange={(e) => onSettingChange('mcqFontSize', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <div className="d-flex justify-content-between x-small mb-0 text-muted">
                    <span>Line Spacing</span>
                    <span>{settings.mcqLineHeight || 1.2}x</span>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min="0.8" max="3.5" step="0.1"
                    value={settings.mcqLineHeight || 1.2}
                    onChange={(e) => onSettingChange('mcqLineHeight', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Subjective Settings */}
              <div className="pt-2 border-top">
                <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                  <FileText size={14} className="text-muted" /> Subjective Part Style
                </label>
                <div className="mb-0">
                  <div className="d-flex justify-content-between x-small mb-0 text-muted">
                    <span>Font Size</span>
                    <span>{settings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min="8" max="20"
                    value={settings.fontSize}
                    onChange={(e) => onSettingChange('fontSize', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <div className="d-flex justify-content-between x-small mb-0 text-muted">
                    <span>Line Spacing</span>
                    <span>{settings.lineHeight || 1.5}x</span>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min="0.8" max="2.5" step="0.1"
                    value={settings.lineHeight || 1.5}
                    onChange={(e) => onSettingChange('lineHeight', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.1)',
            zIndex: 9998
          }}
        />
      )}
    </>
  );
};
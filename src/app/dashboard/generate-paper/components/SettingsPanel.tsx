//generate-paper/components/SettingsPanel.tsx
'use client';
import React from 'react';
import { X, Settings, Layout, List, FileText, Image as ImageIcon, FileQuestion, Lock, ShieldCheck, Circle } from 'lucide-react';
import { PaperSettings } from '@/types/paper-builder';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PaperSettings;
  onSettingChange: (key: keyof PaperSettings, value: number | string | boolean) => void;
  isPremium: boolean;
  currentLayout: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingChange,
  isPremium,
  currentLayout,
}) => {
  // Answer lines / MCQ bubble sheet only make sense on a full, single sheet
  // per paper — the 2/3/4-papers-per-page layouts pack fixed, clipped
  // mini-slots with no room to spare, so these controls are hidden there
  // entirely rather than shown disabled. Kept in sync with the identical
  // list in PaperLayoutRenderer's isSinglePaperLayout.
  const isSinglePaperLayout = ['separate', 'same_page', 'same', 'combined'].includes(currentLayout);

  const titleFontFamilies = [
    { name: 'Classic Serif (Times)',        value: "'Times New Roman', serif" },
    { name: 'Modern Sans (Arial)',           value: "Arial, sans-serif" },
    { name: 'University Serif (Georgia)',    value: "'Georgia', serif" },
    { name: 'Clean Professional (Helvetica)',value: "'Helvetica', sans-serif" },
    { name: 'Elegant (Garamond)',            value: "'Garamond', serif" },
    { name: 'Algerian',                      value: "'Algerian', serif" },
    { name: 'Harlow Solid Italic',           value: "'Harlow Solid Italic', cursive" },
    { name: 'Vladimir Script',               value: "'Vladimir Script', cursive" },
    { name: 'Bodoni MT Poster',              value: "'Bodoni MT Poster Compressed', serif" },
    { name: 'Chiller',                       value: "'Chiller', cursive" },
  ];

  const questionFontFamilies = [
    { name: 'Standard Exam (Arial)',    value: "Arial, sans-serif" },
    { name: 'Cambridge Style (Calibri)',value: "'Calibri', sans-serif" },
    { name: 'Formal Reading (Times)',   value: "'Times New Roman', serif" },
    { name: 'Modern (Inter/Roboto)',    value: "'Inter', sans-serif" },
    { name: 'High Legibility (Verdana)',value: "Verdana, sans-serif" },
  ];

  const headerLayouts = [
    { id: 'standard',     name: 'Standard (Board Style)' },
    { id: 'classic',      name: 'Classic (Split Grid)' },
    { id: 'modern',       name: 'Modern (Minimalist)' },
    { id: 'instructional',name: 'Technical (Instructional)' },
    { id: 'scorecard',    name: 'Grading Focused (ScoreCard)' },
    { id: 'databar',      name: 'Ultra Compact Bar' },
  ];

  const pageSizes = [
    { id: 'a4',    name: 'A4 (210 × 297 mm)' },
    { id: 'legal', name: 'Legal (215.9 × 355.6 mm)' },
  ];

  return (
    <>
      {/* ─── Sidebar ─── */}
      <div
        className="settings-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : '-350px',
          width: '320px',
          /* KEY FIX: use 100dvh so mobile browser chrome is excluded,
             fall back to 100vh. overflow-y:scroll reserves the scrollbar
             track so it never gets clipped by parent overflow rules.     */
          height: '100dvh',
          maxHeight: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.97)',
          backdropFilter: 'blur(10px)',
          boxShadow: '-5px 0 25px rgba(0,0,0,0.12)',
          zIndex: 9999,
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          /* scroll lives here, NOT on a child */
          overflowY: 'scroll',
          overscrollBehavior: 'contain',
          borderLeft: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Sticky Header ── */}
        <div
          style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(248,249,250,0.97)' }}
          className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center"
        >
          <div className="d-flex align-items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h6 className="mb-0 fw-bold" style={{ fontSize: '1rem' }}>Paper Style</h6>
          </div>
          <button className="btn btn-sm btn-light border-0 rounded-circle p-1" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="px-2 py-2" style={{ paddingBottom: '60px' }}>

          {/* ══ SECTION: PAGE SETUP ══ */}
          <section className="mb-3">
            <p className="text-uppercase text-primary fw-bold mb-2 d-flex align-items-center gap-1"
              style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
              <FileText size={13} /> Page Setup
            </p>

            <div className="rounded-3 bg-white border shadow-sm overflow-hidden">
              {/* Page Size */}
              <div className={`p-2${isSinglePaperLayout ? ' border-bottom' : ''}`}>
                <label className="form-label x-small fw-bold text-muted mb-1">Page Size</label>
                <select
                  className="form-select form-select-sm border-0 bg-light shadow-sm"
                  value={settings.pageSize || 'a4'}
                  onChange={(e) => onSettingChange('pageSize', e.target.value)}
                >
                  {pageSizes.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Answer Writing Lines — single-sheet layouts only */}
              {isSinglePaperLayout && (
                <div className="p-2">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <span className="small fw-bold d-block">Answer Lines</span>
                      <span className="text-muted" style={{ fontSize: '0.68rem' }}>Ruled lines under written answers</span>
                    </div>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!settings.showAnswerLines}
                        onChange={(e) => onSettingChange('showAnswerLines', e.target.checked)}
                      />
                    </div>
                  </div>

                  {settings.showAnswerLines && (
                    <div className="pt-2 border-top mt-2">
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <label className="form-label x-small text-muted mb-1">Short Qs</label>
                          <input
                            type="number"
                            className="form-control form-control-sm border-0 bg-light"
                            value={settings.answerLinesShort ?? 4}
                            min="0" max="10"
                            onChange={(e) => onSettingChange('answerLinesShort', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label x-small text-muted mb-1">Long Qs</label>
                          <input
                            type="number"
                            className="form-control form-control-sm border-0 bg-light"
                            value={settings.answerLinesLong ?? 5}
                            min="0" max="12"
                            onChange={(e) => onSettingChange('answerLinesLong', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="d-flex justify-content-between x-small text-muted mb-1">
                        <span>Line Spacing</span>
                        <span>{settings.answerLineGapMm ?? 6}mm</span>
                      </div>
                      <input
                        type="range" className="form-range"
                        min="4" max="14" step="0.5"
                        value={settings.answerLineGapMm ?? 6}
                        onChange={(e) => onSettingChange('answerLineGapMm', parseFloat(e.target.value))}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ══ SECTION: MCQ BUBBLE ANSWER SHEET — single-sheet layouts only ══ */}
          {isSinglePaperLayout && (
            <section className="mb-3">
              <p className="text-uppercase text-primary fw-bold mb-2 d-flex align-items-center gap-1"
                style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                <Circle size={13} /> MCQ Sheet
              </p>

              <div className="rounded-3 bg-white border shadow-sm overflow-hidden">
                <div className="p-2">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <span className="small fw-bold d-block">Answer Bubble Grid</span>
                      <span className="text-muted" style={{ fontSize: '0.68rem' }}>OMR grid before MCQs start</span>
                    </div>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!settings.showMcqBubbleSheet}
                        onChange={(e) => onSettingChange('showMcqBubbleSheet', e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ══ SECTION: WATERMARK (Premium) ══ */}
          <section className="mb-3">
            <div
              className={`p-2 rounded-3 border ${!isPremium ? 'bg-light opacity-75' : 'bg-white shadow-sm'}`}
              style={{ transition: 'all 0.3s ease' }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  {isPremium
                    ? <ShieldCheck size={16} className="text-success" />
                    : <Lock size={15} className="text-muted" />}
                  <div>
                    <span className="small fw-bold d-block">Paper Watermark</span>
                    {!isPremium && (
                      <span style={{ fontSize: '0.62rem' }} className="text-danger fw-bold">PREMIUM ONLY</span>
                    )}
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

              {/* Collapsible watermark controls */}
              {isPremium && settings.showWatermark && (
                <div className="pt-2 border-top mt-2">
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <label className="form-label x-small text-muted mb-1">WM Width (px)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm border-0 bg-light"
                        value={settings.watermarkWidth || 400}
                        min="100" max="1000"
                        onChange={(e) => onSettingChange('watermarkWidth', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label x-small text-muted mb-1">WM Height (px)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm border-0 bg-light"
                        value={settings.watermarkHeight || 400}
                        min="100" max="1000"
                        onChange={(e) => onSettingChange('watermarkHeight', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-between x-small text-muted mb-1">
                    <span>Opacity</span>
                    <span>{Math.round((settings.watermarkOpacity || 0.1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min="0.05" max="0.5" step="0.01"
                    value={settings.watermarkOpacity || 0.1}
                    onChange={(e) => onSettingChange('watermarkOpacity', parseFloat(e.target.value))}
                  />
                </div>
              )}
            </div>
          </section>

          {/* ══ SECTION: HEADER CONFIGURATION ══ */}
          <section className="mb-3">
            <p className="text-uppercase text-primary fw-bold mb-2 d-flex align-items-center gap-1"
              style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
              <Layout size={13} /> Header Configuration
            </p>

            <div className="rounded-3 bg-light shadow-sm overflow-hidden">

              {/* Header Layout Select */}
              <div className="p-2 border-bottom">
                <label className="form-label x-small fw-bold text-muted mb-1">Header Layout</label>
                <select
                  className="form-select form-select-sm border-0 shadow-sm"
                  value={settings.headerLayout || 'standard'}
                  onChange={(e) => onSettingChange('headerLayout', e.target.value)}
                >
                  {headerLayouts.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Academy Title Font */}
              <div className="p-2 border-bottom">
                <label className="form-label x-small fw-bold text-muted mb-1">Academy Title Font</label>
                <select
                  className="form-select form-select-sm border-0 shadow-sm mb-2"
                  style={{ fontFamily: settings.titleFontFamily, fontSize: '14px' }}
                  value={settings.titleFontFamily}
                  onChange={(e) => onSettingChange('titleFontFamily', e.target.value)}
                >
                  {titleFontFamilies.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value, fontSize: '15px' }}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Font Size</span>
                  <span>{settings.titleFontSize}px</span>
                </div>
                <input
                  type="range" className="form-range"
                  min="18" max="48"
                  value={settings.titleFontSize}
                  onChange={(e) => onSettingChange('titleFontSize', parseInt(e.target.value))}
                />
              </div>

              {/* Meta Font Size */}
              <div className="p-2 border-bottom">
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Meta Font (Date, Marks)</span>
                  <span>{settings.metaFontSize}px</span>
                </div>
                <input
                  type="range" className="form-range"
                  min="10" max="16"
                  value={settings.metaFontSize}
                  onChange={(e) => onSettingChange('metaFontSize', parseInt(e.target.value))}
                />
              </div>

              {/* Logo Dimensions */}
              <div className="p-2">
                <label className="form-label x-small fw-bold text-muted mb-1 d-flex align-items-center gap-1">
                  <ImageIcon size={12} /> Logo Dimensions
                </label>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="x-small text-muted d-block mb-1">Width (px)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm border-0 shadow-sm"
                      value={settings.logoWidth || 120}
                      onChange={(e) => onSettingChange('logoWidth', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="col-6">
                    <label className="x-small text-muted d-block mb-1">Height (px)</label>
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

          <hr className="my-2" />

          {/* ══ SECTION: QUESTION PAPER STYLE ══ */}
          <section className="mb-3">
            <p className="text-uppercase text-primary fw-bold mb-2 d-flex align-items-center gap-1"
              style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
              <FileQuestion size={13} /> Question Paper Style
            </p>

            <div className="rounded-3 bg-white border shadow-sm overflow-hidden">

              {/* Question Body Font */}
              <div className="p-2 border-bottom">
                <label className="form-label x-small fw-bold text-muted mb-1">Question Body Font</label>
                <select
                  className="form-select form-select-sm border-0 bg-light shadow-sm"
                  style={{ fontFamily: settings.fontFamily, fontSize: '14px' }}
                  value={settings.fontFamily}
                  onChange={(e) => onSettingChange('fontFamily', e.target.value)}
                >
                  {questionFontFamilies.map(f => (
                    <option key={f.value} value={f.value}
                      style={{ fontFamily: f.value, fontSize: '15px', padding: '8px' }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Heading Size */}
              <div className="p-2 border-bottom">
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Section Heading Size</span>
                  <span className="badge bg-secondary">{settings.headingFontSize}px</span>
                </div>
                <input
                  type="range" className="form-range"
                  min="10" max="24"
                  value={settings.headingFontSize}
                  onChange={(e) => onSettingChange('headingFontSize', parseInt(e.target.value))}
                />
              </div>

              {/* MCQ Settings */}
              <div className="p-2 border-bottom">
                <label className="form-label x-small fw-bold text-dark d-flex align-items-center gap-1 mb-2">
                  <List size={13} className="text-muted" /> MCQ Part Style
                </label>
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Font Size</span>
                  <span>{settings.mcqFontSize || 12}px</span>
                </div>
                <input
                  type="range" className="form-range mb-2"
                  min="6" max="24"
                  value={settings.mcqFontSize || 12}
                  onChange={(e) => onSettingChange('mcqFontSize', parseInt(e.target.value))}
                />
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Line Spacing</span>
                  <span>{settings.mcqLineHeight || 1.2}x</span>
                </div>
                <input
                  type="range" className="form-range"
                  min="0.8" max="3.5" step="0.1"
                  value={settings.mcqLineHeight || 1.2}
                  onChange={(e) => onSettingChange('mcqLineHeight', parseFloat(e.target.value))}
                />
              </div>

              {/* Subjective Settings */}
              <div className="p-2">
                <label className="form-label x-small fw-bold text-dark d-flex align-items-center gap-1 mb-2">
                  <FileText size={13} className="text-muted" /> Subjective Part Style
                </label>
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Font Size</span>
                  <span>{settings.fontSize}px</span>
                </div>
                <input
                  type="range" className="form-range mb-2"
                  min="8" max="20"
                  value={settings.fontSize}
                  onChange={(e) => onSettingChange('fontSize', parseInt(e.target.value))}
                />
                <div className="d-flex justify-content-between x-small text-muted mb-1">
                  <span>Line Spacing</span>
                  <span>{settings.lineHeight || 1.5}x</span>
                </div>
                <input
                  type="range" className="form-range"
                  min="0.8" max="2.5" step="0.1"
                  value={settings.lineHeight || 1.5}
                  onChange={(e) => onSettingChange('lineHeight', parseFloat(e.target.value))}
                />
              </div>

            </div>
          </section>

        </div>{/* end scrollable body */}
      </div>

      {/* ─── Scrollbar Styles ─── */}
      <style>{`
        .settings-sidebar::-webkit-scrollbar {
          width: 5px;
        }
        .settings-sidebar::-webkit-scrollbar-track {
          background: #f1f3f5;
        }
        .settings-sidebar::-webkit-scrollbar-thumb {
          background: #ced4da;
          border-radius: 4px;
        }
        .settings-sidebar::-webkit-scrollbar-thumb:hover {
          background: #adb5bd;
        }
        /* Firefox */
        .settings-sidebar {
          scrollbar-width: thin;
          scrollbar-color: #ced4da #f1f3f5;
        }
      `}</style>

      {/* ─── Overlay ─── */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.15)',
            zIndex: 9998,
          }}
        />
      )}
    </>
  );
};
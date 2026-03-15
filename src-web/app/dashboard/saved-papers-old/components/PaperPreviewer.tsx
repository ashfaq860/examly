// src/app/dashboard/saved-papers/components/PaperPreviewer.tsx
"use client";
import { useState } from 'react';
import { ArrowLeft, Printer, Settings as SettingsIcon, Save } from 'lucide-react';
import { PaperLayoutRenderer } from '@/app/dashboard/generate-paper/components/PaperLayoutRenderer';
import { SettingsPanel } from '@/app/dashboard/generate-paper/components/SettingsPanel';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast';

export const PaperPreviewer = ({ paper, profile, onBack }: any) => {
  const supabase = createClientComponentClient();
  const [showSettings, setShowSettings] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(paper.settings || {});
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateDatabase = async () => {
    setIsSaving(true);
    const { error } = await supabase.from('papers').update({ settings: currentSettings }).eq('id', paper.id);
    if (error) toast.error("Failed to update");
    else { toast.success("Saved!"); setShowSettings(false); }
    setIsSaving(false);
  };

  return (
    <div className="previewer-root bg-light min-vh-100">
      
      {/* Premium Action Bar - Fixed positioning logic */}
      <div className="action-bar-wrapper d-print-none" style={{'marginTop':'-12px'}}>
        <div className="action-bar-premium">
          <div className="container-fluid px-4 py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center flex-nowrap">
                <button className="btn-action-secondary shadow-sm" onClick={onBack}>
                  <ArrowLeft size={18} /><span className="ms-2 d-none d-sm-inline">Back</span>
                </button>
                <div className="ms-3 ps-3 border-start">
                  <h6 className="mb-0 fw-bold text-nowrap text-dark">Paper Preview</h6>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button className={`btn-action-main ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)}>
                  <SettingsIcon size={18} className={showSettings ? 'spin-slow' : ''} /> 
                  <span className="d-none d-md-inline">Style Settings</span>
                </button>
                <button className="btn-action-dark" onClick={() => window.print()}>
                  <Printer size={18} /><span className="d-none d-md-inline">Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Viewport */}
      <div className="paper-viewport py-0 py-md-0">
        <div className="paper-canvas shadow-lg">
          <PaperLayoutRenderer
            paperSections={paper.content}
            settings={currentSettings}
            paperLanguage={paper.language}
            config={{
              direction: paper.language === 'urdu' ? 'rtl' : 'ltr',
              fontFamily: paper.language === 'urdu' ? 'Jameel Noori Nastaleeq' : (currentSettings.fontFamily || 'Arial')
            }}
            isEditMode={false}
            currentLayout={paper.layout}
            onTextChange={() => {}}
            renderInlineBilingual={true}
            currentClass={{ name: paper.class_name }}
            profile={profile}
            onSectionUpdate={() => {}}
          />
        </div>
      </div>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} settings={currentSettings} onSettingChange={(k:any, v:any) => setCurrentSettings((p:any) => ({...p, [k]:v}))} />

      {showSettings && (
        <button className="btn btn-success rounded-pill shadow-lg position-fixed bottom-0 end-0 m-4 d-print-none px-4 py-3" onClick={handleUpdateDatabase} disabled={isSaving} style={{ zIndex: 10000 }}>
          <Save size={20} className="me-2" /> {isSaving ? 'Saving...' : 'Save Style'}
        </button>
      )}

      <style jsx global>{`
        /* 1. SCREEN STYLES */
   
        
        .action-bar-wrapper {
          
        position: sticky;
          top: 54px; /* Offset for Academy Header */
          z-index: 1010;
          border-radius: 12px 12px;
        }

        .action-bar-premium {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px); 
          border-bottom: 1px solid rgba(0,0,0,0.1);
          width: 100%;
        }

        .btn-action-secondary, .btn-action-main, .btn-action-dark {
          border-radius: 10px; padding: 8px 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;
        }
        .btn-action-secondary { background: white; border: 1px solid #ddd; }
        .btn-action-main { background: #eef4ff; color: #0d6efd; border: 1px solid #0d6efd22; }
        .btn-action-main.active { background: #0d6efd; color: white; }
        .btn-action-dark { background: #1a1a1a; color: white; border: none; }

    
        
      `}</style>
    </div>
  );
};
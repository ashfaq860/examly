"use client";
import { useState,useEffect } from 'react';
import { Printer, Settings as SettingsIcon, Save, ChevronLeft } from 'lucide-react';
import { PaperLayoutRenderer } from '@/app/dashboard/generate-paper/components/PaperLayoutRenderer';
import { SettingsPanel } from '@/app/dashboard/generate-paper/components/SettingsPanel';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion'; // Ensure you have framer-motion installed

export const PaperPreviewer = ({ paper, profile, onBack }: any) => {
  const supabase = createClientComponentClient();
  const [showSettings, setShowSettings] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(paper.settings || {});
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const handleUpdateDatabase = async () => {
    setIsSaving(true);
    const { error } = await supabase.from('papers').update({ settings: currentSettings }).eq('id', paper.id);
    if (error) {
      toast.error("Failed to update");
    } else { 
      toast.success("Settings saved successfully"); 
      setShowSettings(false); 
    }
    setIsSaving(false);
  };

  const handlePrint = async () => {
    // 1. Trigger the actual browser print
    window.print();

    try {
      // 2. Call the API route we created that uses supabaseAdmin
      const response = await fetch('/api/profile/increment-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      // 3. Update local state so the UI reflects the new count immediately
      setUserProfile((prev: any) => ({
        ...prev,
        profile: result.profile
      }));

      console.log("Paper count incremented successfully");
    } catch (err: any) {
      console.error("Failed to sync paper count:", err.message);
      // We don't use toast here to avoid interrupting the print experience
    }
  };
 useEffect(() => {
      const fetchProfile = async () => {
        try {
          const res = await fetch('/api/profile');
           if (!res.ok) {
            console.error('Failed to fetch profile');
            return;
          }

          const data = await res.json();

          setUserProfile(data);
        
        } catch (err) {
          console.error('Error fetching profile:', err);
        } finally {
          console.log('Profile fetch attempt completed');
        }
      };

      fetchProfile();
    }, []);

    
// 1. Extract the status safely
const subStatus = userProfile?.profile?.subscription_status;

// 2. Determine if the user is currently premium
const isPremium = subStatus === 'active';

// 3. (Optional) If you want to handle the specific "Ashfaq" case from your 
// data object where you check the packages array as well:
const hasActivePackage = userProfile?.userPackages?.some((pkg: any) => pkg.is_active === true);
const isUserPremium = isPremium || hasActivePackage;

  return (
    <div className={`previewer-root bg-light min-vh-100 ${showSettings ? 'settings-panel-open' : ''}`}>
      
      {/* Action Bar */}
      <div className="action-bar-fixed d-print-none">
        <div className="container-fluid px-2 px-md-4">
          <div className="d-flex justify-content-between align-items-center bar-content">
            
            <div className="d-flex align-items-center flex-grow-1 overflow-hidden">
              <button className="btn-back me-2 me-md-3" onClick={onBack}>
                <ChevronLeft size={20} />
                <span className="d-none d-sm-inline ms-1">Back</span>
              </button>
              <div className="ps-2 ps-md-3 border-start overflow-hidden">
                <h6 className="mb-0 fw-bold text-dark text-truncate paper-title-text">
                  {paper.title || 'Paper Preview'}
                </h6>
              </div>
            </div>

            {/* Header buttons shift left when settings are open */}
            <div className="action-buttons-group d-flex gap-1 gap-md-2">
              <button 
                className={`btn-preview-action ${showSettings ? 'active' : ''}`} 
                onClick={() => setShowSettings(!showSettings)}
              >
                <SettingsIcon size={18} className={showSettings ? 'spin-slow' : ''} /> 
                <span className="d-none d-md-inline">Settings</span>
              </button>
              
              <button className="btn-preview-dark" onClick={ handlePrint}>
                <Printer size={18} />
                <span className="d-none d-md-inline">Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="paper-viewport-container">
        <div className="paper-canvas-wrapper">
          <div className="paper-canvas shadow-lg">
            <PaperLayoutRenderer
              paperSections={paper.content}
              settings={currentSettings}
              paperLanguage={paper.language}
              config={{
                direction: paper.language === 'urdu' ? 'rtl' : 'ltr',
                fontFamily: paper.language === 'urdu' ? 'Jameel Noori Nastaleeq' : (currentSettings.questionFontFamily || 'Arial')
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
      </div>

      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        settings={currentSettings} 
        onSettingChange={(k:any, v:any) => setCurrentSettings((p:any) => ({...p, [k]:v}))} 
        isPremium={isUserPremium}
      />

      {/* FLYING DRAGGABLE SAVE BUTTON */}
      {showSettings && (
        <motion.div 
          drag
          dragConstraints={{ left: -300, right: 20, top: -500, bottom: 20 }}
          className="flying-save-wrapper d-print-none"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <button 
            className="btn-flying-save" 
            onClick={handleUpdateDatabase} 
            disabled={isSaving}
          >
            <div className="flying-icon-box">
              {isSaving ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <Save size={24} />
              )}
            </div>
            <span className="flying-text">Save Changes</span>
          </button>
        </motion.div>
      )}

      <style jsx global>{`
        .previewer-root {
          background-color: #f1f5f9;
        }

        /* 1. Action Buttons Shift Logic */
        .action-buttons-group {
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @media (min-width: 992px) {
          .action-bar-fixed { top: 0; }
          .paper-viewport-container { padding-top: 100px; }
          .settings-panel-open .action-buttons-group {
            transform: translateX(-410px);
          }
            .action-bar-fixed{
            left: 280px !important;
            padding:7px;
            }
        }

        @media (max-width: 991.98px) {
          .action-bar-fixed { top: 57px; }
          .paper-viewport-container { padding-top: 140px; }
          .settings-panel-open .action-buttons-group {
            transform: translateX(-80px);
          }
        }

        /* 2. Flying Save Button Styles */
        .flying-save-wrapper {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 10000;
          cursor: grab;
          touch-action: none; /* Required for mobile drag */
        }
        .flying-save-wrapper:active { cursor: grabbing; }

        .btn-flying-save {
          background: transparent;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #10b981;
          padding: 10px;
        }

        .flying-icon-box {
          width: 56px;
          height: 56px;
          border: 2px dashed #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(5px);
          transition: all 0.3s ease;
        }

        .btn-flying-save:hover .flying-icon-box {
          border-style: solid;
          background: rgba(16, 185, 129, 0.05);
          transform: scale(1.1);
        }

        .flying-text {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }

        /* 3. Standard Layout Styles */
        .paper-viewport-container {
          display: flex; justify-content: center;
          min-height: 100vh; overflow-x: auto;
          -webkit-overflow-scrolling: touch; padding-bottom: 60px;
        }
        .paper-canvas {
          background: white; width: 210mm; min-height: 297mm;
          border-radius: 4px; margin: 0 auto;
        }
        .action-bar-fixed {
          position: fixed; left: 0; right: 0; z-index: 1040;
          background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
          border-bottom: 1px solid #e2e8f0;
        }
        .btn-back {
          background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px;
          display: flex; align-items: center; color: #64748b;
        }
        .btn-preview-action {
          background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px;
          font-weight: 600; color: #475569; display: flex; align-items: center; gap: 8px;
        }
        .btn-preview-action.active { background: #0d6efd; color: white; border-color: #0d6efd; }
        .btn-preview-dark {
          background: #1e293b; color: white; border: none; border-radius: 8px; padding: 8px 14px;
          font-weight: 600; display: flex; align-items: center; gap: 8px;
        }
        .spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media print {
          .action-bar-fixed, .flying-save-wrapper { display: none !important; }
          .paper-viewport-container { padding: 0 !important; }
          .paper-canvas { box-shadow: none !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
};
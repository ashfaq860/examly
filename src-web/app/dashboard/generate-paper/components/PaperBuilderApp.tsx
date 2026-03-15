// generate-paper/components/PaperBuilderApp.tsx
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { UseFormSetValue } from 'react-hook-form';
import { BookOpen, Settings } from 'lucide-react';
import { Subject, Class, Chapter, Question } from '@/types/types';
import { PaperSettings, PaperSection, LanguageConfig } from '@/types/paperBuilderTypes';
import { QuestionSelectorModal } from './modals/QuestionSelectorModal';
import { AppHeader } from './AppHeader';
import { SettingsPanel } from './SettingsPanel';
import { BoardPatternService } from '@/services/boardPatternService';
import { PaperLayoutRenderer } from '@/app/dashboard/generate-paper/components/PaperLayoutRenderer';
//import { supabase } from '@/lib/supabaseClient'; // Adjust this import to your supabase client path
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast'; // Highly recommended for feedback
interface PaperBuilderAppProps {
  watch: any;
  setValue: UseFormSetValue<any>;
  register: any;
  getValues: any;
  trigger: any;
  getQuestionTypes: () => any[];
  subjects: Subject[];
  classes: Class[];
  chapters: Chapter[];
  watchedClassId: string;
  errors: any;
  watchedSubjectId: string;
  watchedChapterOption: string;
  selectedChapters: string[];
  setStep: (step: number) => void;
  setSelectedQuestions: (questions: Record<string, string[]>) => void;
  setPreviewQuestions: (questions: any) => void;
  isLoading: boolean;
  isLoadingPreview: boolean;
  isDownloadingKey?: boolean;
  previewQuestions: Record<string, Question[]>;
  loadPreviewQuestions: () => Promise<void>;
  trialStatus?: any;
  subjectRules?: any[];
  validateFormAgainstRules?: any;
  getChapterIdsToUse?: any;
}
const PAPER_SETTINGS_KEY = 'paper_settings';
export const PaperBuilderApp: React.FC<PaperBuilderAppProps> = ({
  watch,
  setValue,
  getValues,
  getQuestionTypes,
  subjects,
  classes,
  chapters,
  watchedClassId,
  watchedSubjectId,
  watchedChapterOption,
  selectedChapters,
  onSubmit,
  isLoading,
}) => {
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paperSections, setPaperSections] = useState<PaperSection[]>([]);
  const [paperLanguage, setPaperLanguage] = useState<'english' | 'urdu' | 'bilingual'>('english');
  const [showSettings, setShowSettings] = useState(false);
  const [isGeneratingBoardPattern, setIsGeneratingBoardPattern] = useState(false);
  const [profile, setProfile] = useState<any>(null);
 const [settings, setSettings] = useState<PaperSettings>({
  fontFamily: "Arial, sans-serif",      // Standard Exam (Arial)
  fontSize: 12,
  lineHeight: 1.5,
  titleFontFamily: "'Times New Roman', serif", // Classic Serif
  titleFontSize: 28,
  headingFontFamily: "'Times New Roman', serif",
  headingFontSize: 18,
  metaFontSize: 12,
  headerLayout: 'standard',
  mcqFontSize: 12,
  mcqLineHeight: 1.2,
  logoWidth: 120,
  logoHeight: 60
});
const supabase = createClientComponentClient();
// start save paper logic here
const [currentPaperId, setCurrentPaperId] = useState<string | null>(null);
const [isSaving, setIsSaving] = useState(false);

const handleSaveToSupabase = async () => {
  setIsSaving(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("Please login");

    // Map your frontend state to your Supabase Table Columns
    const payload = {
      id: currentPaperId || undefined, // Send ID if updating, undefined if new
      title: getValues('title') || "New Paper",
      created_by: session.user.id,
      class_name: currentClass?.name || "Unknown Class",
      subject_name: currentSubject?.name || "Unknown Subject",
      content: paperSections, // Matches jsonb null default '[]'
      settings: settings,     // Matches jsonb null default '{}'
      layout: currentLayout,  // 'separate' or 'combined'
      language: paperLanguage // 'english', 'urdu', or 'bilingual'
    };

    console.log("Saving to Supabase with payload:", payload);

    const response = await fetch('/api/papers/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}` 
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Failed to save");

    // --- SUCCESS ACTIONS ---
    // If it's a new paper, the backend should return the new UUID
    if (result.id) {
        setCurrentPaperId(result.id);
    }
    
    // Optional: Only clear local storage if you want the user to start a fresh paper
    // localStorage.removeItem('questionPapers');
    // localStorage.removeItem(PAPER_SETTINGS_KEY);
    
    toast.success("Saved to Cloud successfully!");

  } catch (error: any) {
    console.error("Save Error:", error);
    toast.error(error.message);
  } finally {
    setIsSaving(false);
  }
};
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  // 2. Load settings from localStorage on Mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(PAPER_SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Error loading settings from local storage", e);
      }
    }
    setIsSettingsLoaded(true);
  }, []);

  // 3. Save settings to localStorage whenever they change
  useEffect(() => {
    if (isSettingsLoaded) {
      localStorage.setItem(PAPER_SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, isSettingsLoaded]);

 
  const paperRef = useRef<HTMLDivElement>(null);

  const currentLayout =  watch('mcqPlacement') || 'separate';
  const currentLanguage = watch('language') || 'english';
  const currentSubject = subjects.find(s => s.id === watchedSubjectId);
  const currentClass = classes.find(c => c.id === watchedClassId);

  const languageConfigs: Record<string, LanguageConfig> = {
    english: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', sans-serif"
    },
    urdu: {
      direction: 'rtl',
      fontFamily: "'Jameel Noori Nastaleeq', serif",
      fontSize: '18px',
      questionFontFamily: "'Jameel Noori Nastaleeq', serif"
    },
    bilingual: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', 'Jameel Noori Nastaleeq', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', 'Jameel Noori Nastaleeq', sans-serif"
    }
  };

  const config = languageConfigs[paperLanguage] || languageConfigs.english;

const refreshPaperData = useCallback(() => {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem('questionPapers');
  if (!saved) {
    setPaperSections([]);
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    const sections = Array.isArray(parsed) ? parsed : (parsed.sections || []);
    setPaperSections(sections);
    
    // FIX: Update the form layout and language state from localStorage
    if (!Array.isArray(parsed)) {
      if (parsed.layout) {
        setValue('mcqPlacement', parsed.layout); // Syncs currentLayout
      }
      if (parsed.language) {
        setPaperLanguage(parsed.language);
        setValue('language', parsed.language);
      }
    } else if (sections.length > 0) {
      setPaperLanguage(sections[0].language || currentLanguage);
    }
  } catch (e) {
    console.error('Error parsing paper data:', e);
    setPaperSections([]);
  }
}, [currentLanguage, setValue]); // Add setValue to dependencies

const handleCancelPaper = useCallback(() => {
  if (!confirm('Clear paper?')) return;

  // 1. Clear storage
  localStorage.removeItem('questionPapers');

  // 2. Clear React state immediately
  setPaperSections([]);

  // 3. Optional resets (recommended)
  setPaperLanguage(currentLanguage);
  setIsEditMode(false);
}, [currentLanguage]);

  useEffect(() => {
    refreshPaperData();
    window.addEventListener('storage', refreshPaperData);
    return () => window.removeEventListener('storage', refreshPaperData);
  }, [refreshPaperData]);

  const handleBoardPattern = async () => {
    if (!currentSubject || !currentClass) {
      alert('Please select a subject and class first');
      return;
    }
    setIsGeneratingBoardPattern(true);
    try {
      const subjectName = currentSubject.name.toLowerCase();
      const className = String(currentClass.name);
      
      const boardRules = await BoardPatternService.fetchBoardRules(watchedSubjectId, watchedClassId);
      const adjustedPattern = BoardPatternService.getQuestionDetails(
        subjectName, className, { ...currentSubject, board_rules: boardRules }
      );

      ['mcq', 'short', 'long'].forEach(type => {
        setValue(`${type}Count`, adjustedPattern[type].count);
        setValue(`${type}AttemptCount`, adjustedPattern[type].attempt);
        setValue(`${type}Marks`, adjustedPattern[type].marks);
      });

      const loadedQuestions = await loadBoardPatternQuestions(adjustedPattern);
      await generateBoardPatternSections(adjustedPattern, loadedQuestions);
    } catch (error) {
      console.error(error);
      alert('Failed to generate pattern');
    } finally {
      setIsGeneratingBoardPattern(false);
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
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      console.log('Profile fetch attempt completed');
    }
  };

  fetchProfile();
}, []);
//console.log(profile?.profile)
  const loadBoardPatternQuestions = async (pattern: any) => {
    const chapterIds = selectedChapters.length > 0 ? selectedChapters : chapters.map(ch => ch.id);
    const questions: Record<string, Question[]> = {};
    const types = ['mcq', 'short', 'long', ...pattern.additionalTypes.map((t: any) => t.name)];

    for (const type of types) {
      const count = pattern[type]?.count || pattern.additionalTypes.find((t: any) => t.name === type)?.count;
      if (count > 0) {
        const res = await axios.get('/api/questions', {
          params: { subjectId: watchedSubjectId, classId: watchedClassId, questionType: type, chapterIds: chapterIds.join(','), limit: count, random: true }
        });
        questions[type] = res.data || [];
      }
    }
    return questions;
  };

  const generateBoardPatternSections = async (pattern: any, loadedQuestions: Record<string, Question[]>) => {
    const sections: PaperSection[] = [];
    const types = ['mcq', 'short', 'long'];
    
    types.forEach((type, idx) => {
      const p = pattern[type];
      if (p.count > 0) {
        sections.push({
          id: `section-${idx}`,
          type: type as any,
          questions: (loadedQuestions[type] || []).slice(0, p.count),
          totalQuestions: p.count,
          attemptCount: p.attempt,
          marksEach: p.marks,
          totalMarks: p.total,
          subject: currentSubject?.name || '',
          language: currentLanguage,
          layout: currentLayout,
          timestamp: new Date().toISOString()
        });
      }
    });
const paperData = {
    layout: currentLayout,
    language: currentLanguage,
    sections: sections
  };
   localStorage.setItem('questionPapers', JSON.stringify(paperData));
  refreshPaperData();
  };

  const handlePrint = () => {
    window.print();
  };
// --- NEW: Section Update Handler ---
  // This function handles the updates for custom headers (Urdu/English instructions)
const handleSectionUpdate = useCallback((updatedSections: PaperSection[]) => {
  setPaperSections(updatedSections);
  // FIX: Save as object to preserve layout
  const paperData = {
    layout: currentLayout,
    language: paperLanguage,
    sections: updatedSections
  };
  localStorage.setItem('questionPapers', JSON.stringify(paperData));
}, [currentLayout, paperLanguage]);

  const handleTextChange = (sectionId: string, questionId: string, field: string, value: string) => {
  const updated = paperSections.map(s => {
    if (s.id === sectionId) {
      return { ...s, questions: s.questions.map(q => q.id === questionId ? { ...q, [field]: value } : q) };
    }
    return s;
  });
  setPaperSections(updated);
  
  // FIX: Save as object to preserve layout
  const paperData = {
    layout: currentLayout,
    language: paperLanguage,
    sections: updated
  };
  localStorage.setItem('questionPapers', JSON.stringify(paperData));
};
 // FIX: Add a fallback of 0 for totalMarks and totalQuestions
const totalMarks = paperSections.reduce((acc, s) => acc + (s.totalMarks || 0), 0);
const totalQuestions = paperSections.reduce((acc, s) => acc + (s.totalQuestions || 0), 0);

 return (
    <div className="min-vh-100 d-flex flex-column bg-light">
      {/* 1. STICKY HEADER: Stays at the top while scrolling */}
      <div className="d-print-none bg-white border-bottom shadow-sm z-3" style={{ position: 'sticky', top: 0 }}>
        <AppHeader
          onBoardPattern={handleBoardPattern}
          onConfigurePaper={() => setShowQuestionSelector(true)}
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode(!isEditMode)}
          onSavePaper={paperSections.length > 0 ? handleSaveToSupabase : undefined}
          isSaveDisabled={paperSections.length === 0 || isSaving}
          onPrint={handlePrint}
          onCancelPaper={handleCancelPaper}
          paperSections={paperSections}
          totalQuestions={totalQuestions}
          totalMarks={totalMarks}
          isLoading={isLoading || isGeneratingBoardPattern}
        />
      </div>

      {/* 2. SCROLLABLE AREA: Allows both Vertical and Horizontal scrolling */}
      <main className="flex-grow-1 overflow-auto bg-secondary bg-opacity-10 custom-scrollbar d-print-block p-print-0">
        {/* Wrapper to center paper on large screens, but allow left-align on small screens */}
        <div className="d-flex justify-content-start justify-content-lg-center min-w-fit">
          <div 
            id="printable-paper"
            ref={paperRef}
            className="bg-white shadow-lg paper-canvas mx-auto mx-lg-0" 
            style={{ 
              width: '210mm', // Fixed width ensures A4 dimensions
              minWidth: '210mm', // Prevents shrinking on small screens
              minHeight: '297mm',
              position: 'relative',
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
              direction: config.direction as any,
            }}
          >
            {paperSections.length === 0 ? (
              <div className="empty-state d-flex flex-column align-items-center justify-content-center text-muted text-center p-4" style={{ minHeight: '250mm' }}>
                <BookOpen size={80} className="mb-4 opacity-20" />
                <h3 className="fw-light">Paper Preview</h3>
                <p>Select a subject and generate a pattern to begin.</p>
              </div>
            ) : (
              <PaperLayoutRenderer
                paperSections={paperSections}
                settings={settings}
                paperLanguage={paperLanguage}
                config={config}
                isEditMode={isEditMode}
                currentLayout={currentLayout}
                onTextChange={handleTextChange}
                renderInlineBilingual={true}
                currentClass={currentClass}
                profile={profile?.profile}
                onSectionUpdate={handleSectionUpdate}
              />
            )}
          </div>
        </div>
      </main>

      {/* 3. FLOATING ACTION BUTTON */}
      <button 
        className="btn btn-dark rounded-circle shadow-lg position-fixed bottom-0 end-0 m-4 d-print-none d-flex align-items-center justify-content-center"
        style={{ width: '56px', height: '56px', zIndex: 1050 }}
        onClick={() => setShowSettings(true)}
      >
        <Settings size={24} />
      </button>

      {/* Settings & Modals */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} onSettingChange={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))} />
      {showQuestionSelector && (
        <QuestionSelectorModal
          isOpen={showQuestionSelector}
          onClose={() => { setShowQuestionSelector(false); refreshPaperData(); }}
          subjectId={watchedSubjectId}
          classId={watchedClassId}
          chapterOption={watchedChapterOption}
          selectedChapters={selectedChapters}
          chapters={chapters}
          subjects={subjects}
          language={currentLanguage}
          getQuestionTypes={getQuestionTypes}
          watch={watch}
          setValue={setValue}
          currentSubject={currentSubject}
        />
      )}
  

   <style jsx global>{`
  /* --- UI / Screen Styles --- */
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #bbb;
    
    
  }

  .min-w-fit { min-width: fit-content; }

  @media (max-width: 768px) {
    main { padding: 0px 0px 0px 0px !important; }
    .paper-canvas { margin-right: 0px 0px 0px 0px !important; }
  }

@media print {
  /* Hide all non-printable elements */
  body * {
    visibility: hidden;
  }
  
  /* Show only printable paper */
  #printable-paper,
  #printable-paper * {
    visibility: visible;
  }
  
  /* Position paper for print */
  #printable-paper {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 210mm !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  
  /* Reset all parent containers */
  .min-vh-100,
  .d-flex,
  .flex-grow-1,
  .bg-secondary,
  .bg-opacity-10,
  main,
  .d-flex.justify-content-start,
  .min-w-fit {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
  }
  
  /* Paper sheets */
  .paper-sheet {
    page-break-after: always !important;
    break-after: page !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    min-height: 297mm !important;
    height: auto !important;
    background: white !important;
  }
  
  /* Remove all gaps and spacing */
  .gap-4, .mb-4, .p-4, .m-4 {
    margin: 0 !important;
    padding: 0 !important;
    gap: 0 !important;
  }
  
  @page {
    size: A4 portrait;
    margin: 0mm !important;
  }
}
`}</style>
  </div>
  );
};
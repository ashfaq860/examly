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

import Loading from '@/app/dashboard/generate-paper/loading';
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
  const currentSubject = subjects.find(s => s.id === watchedSubjectId);
  const currentClass = classes.find(c => c.id === watchedClassId);
  const currentLayout =  watch('mcqPlacement') || 'separate';
  const currentLanguage = currentSubject?.name === 'English' ?'english' :currentSubject?.name === 'Urdu' ? 'urdu' :watch('language')||'bilingual';
 
 const getChapterIdsInRange = (from: number, to: number) => {
  // We use chapterNo from your schema to match the rule's start/end
  const filteredChapters = chapters.filter(ch => {
    const num = Number(ch.chapterNo); 
    return num >= from && num <= to;
  });

  if (filteredChapters.length === 0) return '';
  return filteredChapters.map(ch => ch.id).join(',');
};
 
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
    toast.error('Please select a class and subject first');
    return;
  }

  setIsGeneratingBoardPattern(true);
  
  try {
    const subName = currentSubject.name.toLowerCase();
    
    // 1. Get Authoritative Pattern from Service
    const expectedPattern = BoardPatternService.getQuestionDetails(
      currentSubject.name, 
      currentClass.name, 
      currentSubject
    );

    // 2. Language Auto-Detection (Using .includes)
    let autoLanguage: 'english' | 'urdu' | 'bilingual' = 'bilingual';
    if (subName.includes('english')) {
      autoLanguage = 'english';
    } else if (['urdu', 'islamyat', 'islamiat', 'pak study', 'quran'].some(s => subName.includes(s))) {
      autoLanguage = 'urdu';
    }
    
    setPaperLanguage(autoLanguage);
    setValue('language', autoLanguage);

    // 3. Fetch Chapter Rules from DB
    let boardRules = await BoardPatternService.fetchBoardRules(watchedSubjectId, watchedClassId);
    
    // Fallback if no rules exist
    if (!boardRules || boardRules.length === 0) {
      boardRules = [
        { question_type: 'mcq', min_questions: expectedPattern.mcq.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' },
        { question_type: 'short', min_questions: expectedPattern.short.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' },
        { question_type: 'long', min_questions: expectedPattern.long.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' }
      ];
    }

    // 4. Load questions based on Chapter Rules
    let questionsByRule = await loadBoardPatternQuestions(boardRules);

    // 5. DEFICIT FILLER: Loop through ALL types (Standard + Additional)
    const allRequiredTypes = [
      { name: 'mcq', count: expectedPattern.mcq.count },
      { name: 'short', count: expectedPattern.short.count },
      { name: 'long', count: expectedPattern.long.count },
      ...(expectedPattern.additionalTypes || [])
    ];

    for (const typeInfo of allRequiredTypes) {
      const typeName = typeInfo.name.toLowerCase();
      const currentQuestions = Object.values(questionsByRule).flat().filter(q => {
        const qType = (q.type || q.question_type || '').toLowerCase();
        return qType === typeName;
      });

      if (currentQuestions.length < typeInfo.count && typeInfo.count > 0) {
        const deficit = typeInfo.count - currentQuestions.length;
        try {
          const fallbackRes = await axios.get('/api/questions', {
            params: { 
              subjectId: watchedSubjectId, 
              classId: watchedClassId, 
              questionType: typeName, 
              limit: deficit, 
              random: true 
            }
          });
          // Use a high index key to avoid clashing with chapter rules
          const fallbackKey = 5000 + allRequiredTypes.indexOf(typeInfo);
          questionsByRule[fallbackKey] = fallbackRes.data || [];
        } catch (e) {
          console.error(`Fallback failed for ${typeName}`, e);
        }
      }
    }

    // 6. Generate UI Sections
    await generateBoardPatternSections(boardRules, questionsByRule, autoLanguage, expectedPattern);
    toast.success("Paper Generated Successfully!");

  } catch (error: any) {
    console.error("Generation Error:", error);
    toast.error("Generation failed. Check console.");
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
const loadBoardPatternQuestions = async (rules: any[]) => {
  const questionsByRule: Record<number, Question[]> = {};

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    
    // Physics rules use chapter_start and chapter_end from your schema
    const start = rule.chapter_start;
    const end = rule.chapter_end;
    const numChapters = (end - start) + 1;

    // Calculate limit based on rule_mode ('per_chapter' or 'total')
    const limit = rule.rule_mode === 'per_chapter' 
      ? rule.min_questions * numChapters 
      : rule.min_questions;

    const chapterIds = getChapterIdsInRange(start, end);

    if (!chapterIds) {
      console.warn(`No chapters found for range ${start}-${end}`);
      questionsByRule[i] = [];
      continue;
    }

    const res = await axios.get('/api/questions', {
      params: { 
        subjectId: watchedSubjectId, 
        classId: watchedClassId, 
        questionType: rule.question_type.toLowerCase(), 
        chapterIds: chapterIds,
        limit: limit, 
        random: true 
      }
    });
    
    questionsByRule[i] = res.data || [];
  }
  return questionsByRule;
};

const generateBoardPatternSections = async (
  rules: any[], 
  questionsByRule: Record<number, Question[]>, 
  selectedLanguage: 'english' | 'urdu' | 'bilingual',
  patternDetails: any 
) => {
  const sections: PaperSection[] = [];
  const subName = currentSubject?.name?.toLowerCase() || '';

  // Helper to get questions of a specific type
  const getQuestionsByType = (type: string) => {
    return Object.values(questionsByRule)
      .flat()
      .filter(q => {
        const qType = (q.type || q.question_type || '').toLowerCase();
        return qType === type.toLowerCase();
      });
  };

  // --- 1. MCQs ---
  const mcqs = getQuestionsByType('mcq').slice(0, patternDetails.mcq.count);
  if (mcqs.length > 0) {
    sections.push(createSectionObject('mcq', 'Q. No. 1: Choose the correct answer.', mcqs, patternDetails.mcq.marks));
  }

  // --- 2. Short Questions (Logic for splitting into groups) ---
  const shorts = getQuestionsByType('short').slice(0, patternDetails.short.count);
  if (shorts.length > 0) {
    // Determine chunk size: Urdu/English = 8, Computer = 6, Others = 6
    const chunkSize = (subName.includes('urdu') || subName.includes('english')) ? 8 : 6;
    const attemptPerSection = chunkSize === 8 ? 5 : 4;

    for (let i = 0; i < shorts.length; i += chunkSize) {
      const chunk = shorts.slice(i, i + chunkSize);
      const qNumber = Math.floor(i / chunkSize) + 2;

      sections.push({
        id: `section-short-${i}-${Date.now()}`,
        type: 'short',
        instructions: `Q. No. ${qNumber}: Write short answers to any ${attemptPerSection} questions.`,
        questions: chunk,
        totalQuestions: chunk.length,
        attemptCount: attemptPerSection,
        marksEach: patternDetails.short.marks,
        totalMarks: attemptPerSection * patternDetails.short.marks,
        subject: currentSubject?.name || '',
        language: selectedLanguage,
        layout: currentLayout,
        timestamp: new Date().toISOString()
      });
    }
  }

  // --- 3. Long Questions ---
  const longs = getQuestionsByType('long').slice(0, patternDetails.long.count);
  if (longs.length > 0) {
    const qNum = sections.length + 1;
    sections.push({
      id: `section-long-${Date.now()}`,
      type: 'long',
      instructions: `Q. No. ${qNum}: Attempt any ${patternDetails.long.attempt} Long Questions.`,
      questions: longs,
      totalQuestions: longs.length,
      attemptCount: patternDetails.long.attempt,
      marksEach: patternDetails.long.marks,
      totalMarks: patternDetails.long.attempt * patternDetails.long.marks,
      subject: currentSubject?.name || '',
      language: selectedLanguage,
      layout: currentLayout,
      timestamp: new Date().toISOString()
    });
  }

  // --- 4. Additional Types (English/Urdu Specific) ---
  if (patternDetails.additionalTypes && patternDetails.additionalTypes.length > 0) {
    let nextQNum = sections.length + 1;

    patternDetails.additionalTypes.forEach((extra: any) => {
      const extraQuestions = getQuestionsByType(extra.name).slice(0, extra.count);

      if (extraQuestions.length > 0) {
        sections.push({
          id: `section-extra-${extra.name}-${Date.now()}`,
          type: extra.name,
          instructions: `Q. No. ${nextQNum}: ${extra.label} (${extra.attempt}/${extra.count})`,
          questions: extraQuestions,
          totalQuestions: extraQuestions.length,
          attemptCount: extra.attempt,
          marksEach: extra.marks,
          totalMarks: extra.total,
          subject: currentSubject?.name || '',
          language: selectedLanguage,
          layout: currentLayout,
          timestamp: new Date().toISOString()
        });
        nextQNum++;
      }
    });
  }

  // --- Final Save & Sync ---
  if (sections.length === 0) {
    throw new Error("No questions found even with fallback. Check DB connections.");
  }

  const paperData = { layout: currentLayout, language: selectedLanguage, sections };
  localStorage.setItem('questionPapers', JSON.stringify(paperData));
  refreshPaperData();
};

// Helper to keep the code clean
const createSectionObject = (type: any, title: string, questions: Question[], marks: number) => ({
  id: `section-${type}-combined-${Date.now()}`,
  type,
  instructions: title,
  questions,
  totalQuestions: questions.length,
  attemptCount: questions.length,
  marksEach: marks,
  totalMarks: questions.length * marks,
  subject: currentSubject?.name || '', 
  language: paperLanguage, 
  layout: currentLayout,
  timestamp: new Date().toISOString()
});

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
   <div  className="d-print-none bg-white border-bottom shadow-sm app-header " 
 
>
      <div className="w-100 appHeaderContent">
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
    </div>
{/* 1. GLOBAL LOADING OVERLAY */}

      {/* 2. SCROLLABLE AREA: Allows both Vertical and Horizontal scrolling */}
      <main className="flex-grow-1 overflow-auto bg-secondary bg-opacity-10 custom-scrollbar d-print-block p-print-0 mt-4">
        {/* Wrapper to center paper on large screens, but allow left-align on small screens */}
        <div className="d-flex justify-content-start justify-content-lg-center min-w-fit">
          <div 
            id="printable-paper"
            ref={paperRef}
            className="bg-white shadow-lg paper-canvas mx-auto mx-lg-0" 
            style={{ 
              width: '210mm', // Fixed width ensures A4 dimensions
              minWidth: '210mm', // Prevents shrinking on small screens
              height: 'auto',
            
              fontFamily: settings.fontFamily,
             
              direction: config.direction as any,
              
            }}
          >


            {paperSections.length === 0 ? (
  <div 
    className="empty-state d-flex flex-column align-items-center justify-content-start text-muted text-center p-4 pt-5 mt-5" 
    style={{ minHeight: '297mm' }}
  >
    <BookOpen size={80} className="mb-4 opacity-20" />
    <h3 className="fw-light">Paper Preview</h3>
    <p className="mb-4">Select a subject and generate a pattern to begin.</p>
    
    {/* --- NEW BUTTONS GROUP --- */}
    <div className="d-flex flex-column flex-md-row gap-3">
      <button 
        className="btn btn-primary btn-lg px-4 shadow-sm d-flex align-items-center gap-2"
        onClick={handleBoardPattern}
        disabled={isLoading || isGeneratingBoardPattern}
        style={{ borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600 }}
      >
        {isGeneratingBoardPattern ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        ) : (
          <i className="bi bi-magic"></i>
        )}
        Generate Board Pattern Paper
      </button>

      <button 
        className="btn btn-outline-dark btn-lg px-4 d-flex align-items-center gap-2"
        onClick={() => setShowQuestionSelector(true)}
        style={{ borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600 }}
      >
        <Settings size={18} />
        Configure Paper Manually
      </button>
    </div>
    {/* ------------------------- */}
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
{(isGeneratingBoardPattern || isSaving) && (
  <div 
    className="position-fixed top-0 start-0 w-100 vh-100 d-flex flex-column align-items-center justify-content-center"
    style={{ 
        zIndex: 9999, 
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(2px)' 
    }}
  >
    
        <Loading message={isSaving ? 'Saving to Cloud...' : 'Generating Board Pattern...'} /> {/* Your existing Loading component */}

    
  </div>
)}
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
  /* Screen only - makes the preview look like a floating sheet */
  @media screen {
    .paper-canvas {
      margin-top: 20px;
      margin-bottom: 20px;
     
    }
  }

  @media print {
    /* 1. Force the page to be exactly A4 with NO browser margins */
    @page {
      size: A4 portrait;
      margin: 0 !important; 
    }

    /* 2. Hide the entire UI (Sidebar, Header, Buttons) */
    html, body, #__next, .min-vh-100, main {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      background: white !important;
    }

    /* Hide everything except our specific printable ID */
    body * {
      visibility: hidden;
    }

    /* 3. The Paper Container: Reset its position to the very top-left */
    .paper-sheet,
    .paper-sheet * {
      visibility: visible;
    }

   

    /* 4. Ensure each sheet starts on a new physical page */
    .paper-sheet {
      visibility: visible !important;
      display: block !important;
      page-break-after: always !important;
      break-after: page !important;
      margin: 0 !important;
      /* We use padding for internal margins so it matches the screen */
      padding: 3mm 4mm 3mm 3mm !important; 
      box-shadow: none !important;
      border: none !important;
      width: 210mm !important;
      height: 297mm !important;
    }
  }
/* Layout & Scrollbars */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.header-wrapper {
  position: relative;
  height: 100%;
}

/* Premium Button Styling */
.btn-premium {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 10px;
  white-space: nowrap;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.btn-premium:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #1e293b;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.btn-premium:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-premium:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

/* Active State for Edit Mode */
.edit-mode-active {
  background: #fffbeb !important;
  border-color: #fcd34d !important;
  color: #92400e !important;
  box-shadow: inset 0 2px 4px rgba(251, 191, 36, 0.1) !important;
}

/* Modern Scroll Arrows */
.scroll-nav-btn {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  z-index: 20;
  flex-shrink: 0;
  position: absolute;
}

.left-fade { left: 4px; }
.right-fade { right: 4px; }

/* Parent Header Overrides */
.app-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 280px; /* Adjust based on your sidebar width */
  height: 72px;
  z-index: 1020;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}

@media (max-width: 990px) {
  .app-header {
    left: 0;
    height: 64px;
    top:55px;
  }
  .btn-premium {
    height: 38px;
    padding: 0 12px;
    font-size: 0.8rem;
  }
}

/* Premium Primary Button for Empty State */
.empty-state .btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border: none;
  transition: all 0.3s ease;
}

.empty-state .btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3) !important;
}

.empty-state .btn-outline-dark {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #1e293b;
  transition: all 0.3s ease;
}

.empty-state .btn-outline-dark:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-2px);
}

`}</style>
  </div>
  );
};
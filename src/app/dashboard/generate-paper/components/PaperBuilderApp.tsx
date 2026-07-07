// generate-paper/components/PaperBuilderApp.tsx
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { UseFormSetValue } from 'react-hook-form';
import { BookOpen, Settings } from 'lucide-react';
import { Subject, Class, Chapter, Question } from '@/types/types';
import { PaperSettings, PaperSection, LanguageConfig } from '@/types/paperBuilderTypes';
import { QuestionSelectorModal } from './modals/QuestionSelectorModal';
import { AppHeader } from './AppHeader';
import { SettingsPanel } from './SettingsPanel';
import { BoardPatternService, LongQuestionGroup } from '@/services/boardPatternService';
import { PaperLayoutRenderer } from '@/app/dashboard/generate-paper/components/PaperLayoutRenderer';
import Loading from '@/app/dashboard/generate-paper/loading';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getPageSize } from '@/lib/paperPageSize';
import { toast } from 'react-hot-toast';

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

// ── Rule shape (chapter_question_rules row, after the migration) ──
// sort_order      number  — exact paper position; ties broken by id
// group_key       string|null — rules sharing this render as ONE Q.No
// q_label         string|null — display sub-label e.g. 'A' / 'B' / 'C'.
//                  For is_paired groups this also doubles as a verbatim
//                  note override when filled in (see sharedNote below) —
//                  admins type the full note sentence directly into this
//                  field for paired-long rules, same as before.
// attempt_count   number|null — defaults to safePairCount/pooledGroups.length
//                  ONLY when null or undefined (standard `??` fallback).
//                  A literal 0 is a real, intentional value: it means this
//                  Q.No's question pair still gets fetched and printed
//                  (e.g. as an optional/extra item — see physics_long_q7-
//                  style groups), but it contributes NOTHING to the
//                  attempt note or the paper's running total marks, and
//                  prints with no note line above it at all. This is
//                  different from "not configured" (null/undefined),
//                  which falls back to the full pair count found.
// is_paired       boolean — pair this rule's own fetched questions into a/b sub-parts
// is_alternative  boolean — alongside group_key: only the first (by sort_order)
//                  rule in the group is actually used; siblings are OR-choices
//                  that aren't printed (e.g. "Summary OR Stanza Explanation")
interface BoardRule {
  id?: string;
  subject_id?: string;
  class_id?: string | null;
  chapter_start: number;
  chapter_end: number;
  question_type: string;
  question_category_id?: string | null;
  question_category?: { id: string; label_en?: string; label_ur?: string; category_value?: string; default_marks?: number | null } | null;
  rule_mode: 'total' | 'per_chapter';
  min_questions: number;
  max_questions?: number | null;
  sort_order?: number;
  q_label?: string | null;
  q_label_ur?: string | null;
  attempt_count?: number | null;
  group_key?: string | null;
  is_paired?: boolean;
  is_alternative?: boolean;
}

// One resolved, orderable "block" the paper is built from. A block can be:
//  - a single rule's worth of questions (most cases), OR
//  - a paired-long block (is_paired=true) carrying longGroups instead of a flat list, OR
//  - the FIRST member of an is_alternative group (siblings dropped)
// Multiple blocks sharing a group_key get merged into ONE PaperSection with
// sub-labeled groups, in their original sort_order.
interface ResolvedRuleBlock {
  rule: BoardRule;
  questions: Question[];
  longGroups?: LongQuestionGroup[]; // only set when rule.is_paired
  categoryLabel: string | null;
}

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
  isLoading,
}: any) => {
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [editingSection, setEditingSection] = useState<PaperSection | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paperSections, setPaperSections] = useState<PaperSection[]>([]);
  const [paperLanguage, setPaperLanguage] = useState<'english' | 'urdu' | 'bilingual'>('english');
  const [showSettings, setShowSettings] = useState(false);
  const [isGeneratingBoardPattern, setIsGeneratingBoardPattern] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [settings, setSettings] = useState<PaperSettings>({
    fontFamily: "Arial, sans-serif",
    fontSize: 12,
    lineHeight: 1.5,
    titleFontFamily: "'Times New Roman', serif",
    titleFontSize: 28,
    headingFontFamily: "'Times New Roman', serif",
    headingFontSize: 18,
    metaFontSize: 12,
    headerLayout: 'standard',
    mcqFontSize: 12,
    mcqLineHeight: 1.2,
    logoWidth: 120,
    logoHeight: 60,
    mcqLayoutStyle: 'simple',
  });

  const supabase = createSupabaseBrowserClient();
  const [currentPaperId, setCurrentPaperId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track mount for portal
  useEffect(() => { setIsMounted(true); }, []);

  const handleSaveToSupabase = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Please login");

      const payload = {
        id: currentPaperId || undefined,
        title: getValues('title') || "New Paper",
        created_by: session.user.id,
        class_name: currentClass?.name || "Unknown Class",
        subject_name: currentSubject?.name || "Unknown Subject",
        content: paperSections,
        settings: settings,
        layout: currentLayout,
        language: paperLanguage,
      };

      const response = await fetch('/api/papers/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save");
      // The paper is now safely persisted in Supabase, so the local
      // autosave draft is no longer needed to recover it — clear it so a
      // stale/already-saved draft doesn't get reloaded next time the builder
      // opens. Keep lastSavedPaperDataRef in sync so refreshPaperData's
      // change-detection doesn't mistake this for an external edit and wipe
      // the paper a second time on its own.
      localStorage.removeItem('questionPapers');
      lastSavedPaperDataRef.current = '';
      // Wipe the builder back to a blank slate — the paper is safely saved,
      // so leaving it on screen (or leaving currentPaperId pointing at it)
      // would make the next paper the user builds silently overwrite this
      // one instead of being saved as new.
      setPaperSections([]);
      setCurrentPaperId(null);
      setIsEditMode(false);
      setPaperLanguage(currentLanguage);
      toast.success("Saved to Cloud successfully!");
    } catch (error: any) {
      console.error("Save Error:", error);
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const syncLayout = () => {
      if (typeof window === 'undefined') return;
      const { widthPx: PAPER_PX, heightPx: PAPER_H_PX } = getPageSize(settings.pageSize);
      const vw = window.innerWidth;
      const scale = Math.min(1, (vw - 16) / PAPER_PX);
      const scaledW = PAPER_PX * scale;
      const marginLeft = Math.max(0, (vw - scaledW) / 2);
      const marginBottom = (PAPER_H_PX * scale) - PAPER_H_PX;
      document.documentElement.style.setProperty('--paper-scale', scale.toFixed(4));
      document.documentElement.style.setProperty('--paper-margin-bottom', `${marginBottom.toFixed(1)}px`);
      document.documentElement.style.setProperty('--paper-margin-left', `${marginLeft.toFixed(1)}px`);

      // Measure the real dashboard mobile top bar (AcademyLayout's sticky
      // .al-mobile-topbar) so our own fixed header/canvas stack on mobile
      // sits exactly below it, instead of relying on a guessed pixel offset
      // that drifts whenever that bar's content/height changes.
      const topbarEl = document.querySelector('.al-mobile-topbar');
      const topbarHeight = topbarEl ? topbarEl.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty('--mobile-topbar-h', `${topbarHeight}px`);
    };
    syncLayout();
    window.addEventListener('resize', syncLayout);

    const topbarEl = document.querySelector('.al-mobile-topbar');
    const resizeObserver = topbarEl ? new ResizeObserver(syncLayout) : null;
    resizeObserver?.observe(topbarEl as Element);

    return () => {
      window.removeEventListener('resize', syncLayout);
      resizeObserver?.disconnect();
    };
  }, [settings.pageSize]);

  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

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

  useEffect(() => {
    if (isSettingsLoaded) {
      localStorage.setItem(PAPER_SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, isSettingsLoaded]);

  const paperRef = useRef<HTMLDivElement>(null);
  const currentSubject = subjects.find((s: Subject) => s.id === watchedSubjectId);
  const currentClass = classes.find((c: Class) => c.id === watchedClassId);
  const currentLayout = watch('mcqPlacement') || 'separate';
  const currentLanguage =
    currentSubject?.name === 'English' ? 'english' :
    currentSubject?.name === 'Urdu' ? 'urdu' :
    watch('language') || 'bilingual';

  const getChapterIdsInRange = (from: number, to: number) => {
    const filteredChapters = chapters.filter((ch: Chapter) => {
      const num = Number(ch.chapterNo);
      return num >= from && num <= to;
    });
    if (filteredChapters.length === 0) return '';
    return filteredChapters.map((ch: Chapter) => ch.id).join(',');
  };

  const languageConfigs: Record<string, LanguageConfig> = {
    english: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', sans-serif",
    },
    urdu: {
      direction: 'rtl',
      fontFamily: "'JameelNoori', 'Jameel Noori Nastaleeq', serif",
      fontSize: '18px',
      questionFontFamily: "'JameelNoori', 'Jameel Noori Nastaleeq', serif",
    },
    bilingual: {
      direction: 'ltr',
      fontFamily: "'Times New Roman', 'JameelNoori', 'Jameel Noori Nastaleeq', serif",
      fontSize: '14px',
      questionFontFamily: "'Arial', 'JameelNoori', 'Jameel Noori Nastaleeq', sans-serif",
    },
  };

  const config = languageConfigs[paperLanguage] || languageConfigs.english;
  const lastSavedPaperDataRef = useRef<string>('');

  const refreshPaperData = useCallback(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('questionPapers') ?? '';
    if (saved === lastSavedPaperDataRef.current) return;
    lastSavedPaperDataRef.current = saved;

    if (!saved) { setPaperSections([]); return; }

    try {
      const parsed = JSON.parse(saved);
      const sections = Array.isArray(parsed) ? parsed : (parsed.sections || []);
      setPaperSections(sections);

      if (!Array.isArray(parsed)) {
        if (parsed.layout) setValue('mcqPlacement', parsed.layout);
        if (parsed.language) { setPaperLanguage(parsed.language); setValue('language', parsed.language); }
      } else if (sections.length > 0) {
        setPaperLanguage(sections[0].language || currentLanguage);
      }
    } catch (e) {
      console.error('Error parsing paper data:', e);
      setPaperSections([]);
    }
  }, [currentLanguage, setValue]);

  const handleCancelPaper = useCallback(() => {
    if (!confirm('Clear paper?')) return;
    localStorage.removeItem('questionPapers');
    setPaperSections([]);
    setPaperLanguage(currentLanguage);
    setIsEditMode(false);
  }, [currentLanguage]);

  useEffect(() => {
    refreshPaperData();
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'questionPapers') refreshPaperData();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshPaperData]);

  // ── Fetch questions for ONE rule, scoped to its chapter range + category ──
  const fetchQuestionsForRule = async (rule: BoardRule): Promise<Question[]> => {
    const start = rule.chapter_start;
    const end = rule.chapter_end;
    const numChapters = (end - start) + 1;
    // is_paired rules need 2 real questions per attempted sub-part-pair, so
    // min_questions for those rules should already represent the TOTAL raw
    // question count to fetch (e.g. 6, to make 3 pairs) — that's the admin's
    // responsibility when configuring the rule, same as any other count.
    const limit = rule.rule_mode === 'per_chapter' ? rule.min_questions * numChapters : rule.min_questions;
    const chapterIds = getChapterIdsInRange(start, end);
    if (!chapterIds) return [];

    const categoryId = rule.question_category_id || null;

    const res = await axios.get('/api/questions', {
      params: {
        subjectId: watchedSubjectId,
        classId: watchedClassId,
        questionType: rule.question_type.toLowerCase(),
        chapterIds,
        limit,
        random: true,
        ...(categoryId ? { categoryId } : {}),
      },
    });

    const fetched: Question[] = res.data || [];
    return fetched.slice(0, limit);
  };

  // ── Marks resolution ──
  // Two sources, in priority order:
  //   1. question_categories.default_marks — when a rule has a
  //      question_category_id set, this is now the single source of truth
  //      for that rule's marks (e.g. application=10, letter=10). This is
  //      the primary path for any type the admin has configured a real
  //      category+marks for.
  //   2. BoardPatternService.getQuestionDetails() — used only when a rule
  //      has NO category (mcq.marks / short.marks / long.marks / each
  //      additionalTypes[i].marks). This remains the fallback for types
  //      the admin hasn't (or can't) attach a category to.
  // resolveMarksForRule is the one to use whenever an actual BoardRule is
  // available. resolveMarksForType is a thin wrapper for the few call
  // sites that only have a bare type string and no single rule to check
  // (the is_paired pooled-marks cases, where multiple rules with possibly
  // different categories are already merged — falling back to
  // BoardPatternService there is correct, not a workaround).
  const resolveMarksForType = (
    questionType: string,
    expectedPattern: ReturnType<typeof BoardPatternService.getQuestionDetails>
  ): number => {
    const type = questionType.toLowerCase();
    if (type === 'mcq') return expectedPattern.mcq.marks;
    if (type === 'short') return expectedPattern.short.marks;
    if (type === 'long') return expectedPattern.long.marks;
    const additional = expectedPattern.additionalTypes?.find((t: any) => t.name.toLowerCase() === type);
    return additional?.marks ?? 1; // 1 is a last-resort floor, not a guess about subject content
  };

  const resolveMarksForRule = (
    rule: BoardRule,
    expectedPattern: ReturnType<typeof BoardPatternService.getQuestionDetails>
  ): number => {
    const categoryMarks = rule.question_category?.default_marks;
    if (categoryMarks != null && categoryMarks > 0) return categoryMarks;
    return resolveMarksForType(rule.question_type, expectedPattern);
  };

  // ── Resolve ALL rules into ResolvedRuleBlocks ──
  // is_alternative groups now keep EVERY member (rendered together with OR
  // dividers between them at the renderer level — see isAlternativeGroup
  // handling in generateFromRules below). is_paired pairs each rule's own
  // fetched questions into a/b groups.
  const resolveRuleBlocks = async (
    rules: BoardRule[],
    expectedPattern: ReturnType<typeof BoardPatternService.getQuestionDetails>
  ): Promise<ResolvedRuleBlock[]> => {
    // Step 1: just split into grouped vs standalone — no member-dropping.
    // (Previously this collapsed is_alternative groups down to a single
    // winning rule, silently discarding every sibling. That's the bug:
    // an admin configuring "Application OR Letter" expects BOTH printed
    // with an OR divider, not one silently vanishing.)
    const byGroup = new Map<string, BoardRule[]>();
    const standalone: BoardRule[] = [];

    for (const rule of rules) {
      if (rule.group_key) {
        const arr = byGroup.get(rule.group_key) || [];
        arr.push(rule);
        byGroup.set(rule.group_key, arr);
      } else {
        standalone.push(rule);
      }
    }

    const effectiveRules: BoardRule[] = [
      ...standalone,
      ...Array.from(byGroup.values()).flat(),
    ];

    // Step 2: fetch questions for every effective rule, in parallel.
    const blocks: ResolvedRuleBlock[] = await Promise.all(
      effectiveRules.map(async (rule) => {
        const questions = await fetchQuestionsForRule(rule);
        const categoryLabel = rule.question_category?.label_en || rule.question_category?.label_ur || null;

        if (rule.is_paired) {
          // wholeUnitMarks represents the WHOLE attempted unit's marks
          // (both sub-parts together, per the board pattern's own
          // convention) — resolved per-rule via resolveMarksForRule so a
          // category's default_marks (if the admin set one on this rule)
          // takes priority over the BoardPatternService fallback. Each
          // individual sub-part (a or b) is worth half of that — e.g.
          // long.marks=8 -> 4 per part.
          const wholeUnitMarks = resolveMarksForRule(rule, expectedPattern);
          const marksPerPart = wholeUnitMarks / 2;
          const longGroups = BoardPatternService.pairLongQuestions(questions, 2, marksPerPart);
          return { rule, questions, longGroups, categoryLabel };
        }

        return { rule, questions, categoryLabel };
      })
    );

    return blocks;
  };

  const handleBoardPattern = async () => {
    if (!currentSubject || !currentClass) {
      toast.error('Please select a class and subject first');
      return;
    }
    setIsGeneratingBoardPattern(true);
    try {
      const subName = currentSubject.name.toLowerCase();

      let autoLanguage: 'english' | 'urdu' | 'bilingual' = 'bilingual';
      if (subName.includes('english')) autoLanguage = 'english';
      else if (['urdu', 'islamyat', 'islamiat', 'pak study', 'quran'].some(s => subName.includes(s))) autoLanguage = 'urdu';

      setPaperLanguage(autoLanguage);
      setValue('language', autoLanguage);
      setValue('mcqPlacement', 'separate');
      // Board Pattern papers always start out with the bordered MCQ table —
      // the user can still switch to Table/Simple afterwards in Paper Style.
      setSettings(prev => ({ ...prev, mcqLayoutStyle: 'bordered' }));

      const boardRules: BoardRule[] = await BoardPatternService.fetchBoardRules(watchedSubjectId, watchedClassId);

      if (boardRules && boardRules.length > 0) {
        // ── RULE-DRIVEN PATH ──
        // Every Q.No, sub-part, order, and attempt count comes from the DB.
        // Nothing about subject name or class is hardcoded here.
        await generateFromRules(boardRules, autoLanguage);
      } else {
        // ── FALLBACK PATH ──
        // No rules configured for this subject+class yet: fall back to the
        // old hardcoded BoardPatternService pattern so generation still
        // works while the admin sets up real rules.
        await generateFromFallbackPattern(autoLanguage);
      }

      toast.success("Paper Generated Successfully!");
    } catch (error: any) {
      console.error("Generation Error:", error);
      toast.error("Generation failed. Check console.");
    } finally {
      setTimeout(() => setIsGeneratingBoardPattern(false), 300);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) { console.error('Failed to fetch profile'); return; }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };
    fetchProfile();
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  // RULE-DRIVEN GENERATOR
  // Builds the entire paper purely from chapter_question_rules rows:
  //   1. Resolve rules -> blocks (handles is_alternative + is_paired)
  //   2. Group blocks by group_key into ONE PaperSection each; standalone
  //      blocks become their own PaperSection.
  //   3. Sort sections by the MINIMUM sort_order among their member rules.
  //   4. Assign sequential Q.No numbers in that final order.
  //   5. POST-PROCESS: collapse the note text on independent paired-long
  //      groups down to just the first one in the paper (see step 5 below
  //      for why this is needed and how it works).
  // ─────────────────────────────────────────────────────────────────────
  const generateFromRules = async (
    rules: BoardRule[],
    selectedLanguage: 'english' | 'urdu' | 'bilingual',
  ) => {
    // Single source of truth for marks-per-type for this subject+class.
    // Rule rows themselves don't carry a marks column — marks live here,
    // in BoardPatternService, keyed by question_type / additionalType name.
    const expectedPattern = BoardPatternService.getQuestionDetails(
      currentSubject.name, currentClass.name, currentSubject
    );

    const blocks = await resolveRuleBlocks(rules, expectedPattern);

    // Group blocks by group_key (compulsory multi-sub-part Q.Nos).
    // Blocks with no group_key are standalone, single-block sections.
    const groupedByKey = new Map<string, ResolvedRuleBlock[]>();
    const standaloneBlocks: ResolvedRuleBlock[] = [];

    for (const block of blocks) {
      const key = block.rule.group_key;
      if (key) {
        const arr = groupedByKey.get(key) || [];
        arr.push(block);
        groupedByKey.set(key, arr);
      } else {
        standaloneBlocks.push(block);
      }
    }

    // Build one "pending section" per group_key and one per standalone block,
    // each carrying a minSortOrder used for final paper ordering.
    interface PendingSection {
      minSortOrder: number;
      type: string;
      groupKey: string | null;
      blocks: ResolvedRuleBlock[]; // ordered by sort_order within the group
    }

    const pendingSections: PendingSection[] = [];

    for (const [groupKey, groupBlocks] of groupedByKey.entries()) {
      const sortedBlocks = [...groupBlocks].sort(
        (a, b) => (a.rule.sort_order ?? 0) - (b.rule.sort_order ?? 0)
      );
      pendingSections.push({
        minSortOrder: Math.min(...sortedBlocks.map(b => b.rule.sort_order ?? 0)),
        type: sortedBlocks[0].rule.question_type.toLowerCase(),
        groupKey,
        blocks: sortedBlocks,
      });
    }

    for (const block of standaloneBlocks) {
      pendingSections.push({
        minSortOrder: block.rule.sort_order ?? 0,
        type: block.rule.question_type.toLowerCase(),
        groupKey: null,
        blocks: [block],
      });
    }

    // Final paper order — purely driven by admin-configured sort_order.
    pendingSections.sort((a, b) => a.minSortOrder - b.minSortOrder);

    // Drop sections that ended up with zero questions across all their blocks
    // (e.g. DB had no matching questions for that chapter range/category —
    // better to silently omit than print an empty Q.No).
    const nonEmptySections = pendingSections.filter(ps =>
      ps.blocks.some(b => (b.questions?.length || 0) > 0 || (b.longGroups?.length || 0) > 0)
    );

    const sections: PaperSection[] = [];
    let qNum = 1;

    for (const ps of nonEmptySections) {
      const isMcq = ps.type === 'mcq';
      const sectionId = `section-${ps.groupKey || ps.type}-${qNum}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // ── PAIRED-LONG (is_paired=true) ──
      // Two shapes are supported:
      //   1. SINGLE rule, is_paired=true, no group_key (or alone in its
      //      group): that rule's own fetched questions are paired and
      //      become a sequential run of Q.Nos with ONE note above the
      //      first pair — this was the original single-rule case.
      //   2. MULTIPLE rules, each is_paired=true, SHARING one group_key:
      //      each rule still fetches its own questions independently
      //      (so distinct chapter ranges/categories per rule are
      //      preserved), but their resulting pair-GROUPS are concatenated
      //      into ONE combined pool before building Q.Nos — producing one
      //      shared note + one shared attempt_count covering the whole
      //      pool (e.g. "attempt any 4 of the following 6"), exactly
      //      mirroring how MCQ sub-part rules merge under one Q.No.
      //
      // IMPORTANT — note de-duplication across INDEPENDENT groups:
      // When an admin configures several SEPARATE is_paired group_keys
      // back-to-back (e.g. physics_long_q5, physics_long_q6,
      // physics_long_q7 — one group_key per Q.No, rather than one shared
      // key), each group legitimately computes and attaches its OWN note
      // here, because from this loop's perspective they are unrelated
      // attempt-units. That produced a real, reported problem: three
      // separate "Note: Attempt any N..." lines printed back-to-back on
      // the paper, one above each Q.No, when the desired output is ONE
      // note total, above the first paired-long Q.No only. Rather than
      // try to guess at group relationships here (fragile, and wrong the
      // moment an admin genuinely wants two independent paired-long
      // clusters with their own notes later on the same paper), every
      // paired-long block below still computes its note exactly as
      // before — collapsing duplicates across independent groups down to
      // the first one in final paper order is handled by a single
      // dedicated post-processing pass AFTER the full `sections` array is
      // built (see "COLLAPSE PAIRED-LONG NOTES" below, right before
      // sections is saved). That keeps this loop's per-group logic
      // simple and correct, and isolates the "only the first one keeps
      // its note" policy in one obvious, easy-to-revisit place.
const pairedBlocksInGroup = ps.blocks.filter(b => b.rule.is_paired);
if (pairedBlocksInGroup.length > 0 && pairedBlocksInGroup.length === ps.blocks.length) {
  const sortedPairedBlocks = [...pairedBlocksInGroup].sort(
    (a, b) => (a.rule.sort_order ?? 0) - (b.rule.sort_order ?? 0)
  );
  const leadRule    = sortedPairedBlocks[0].rule;
  const isTwoRuleMode = sortedPairedBlocks.length >= 2;

  if (isTwoRuleMode) {
    // ── TWO-RULE MODE ──
    // Rule A (lower sort_order) = sub-part (a) with its own marks
    // Rule B (higher sort_order) = sub-part (b) with its own marks
    // Each rule fetches its own questions; they are zipped into pairs.
    const blockA     = sortedPairedBlocks[0];
    const blockB     = sortedPairedBlocks[1];
    const marksA     = resolveMarksForRule(blockA.rule, expectedPattern);
    const marksB     = resolveMarksForRule(blockB.rule, expectedPattern);
    const questionsA = blockA.questions || [];
    const questionsB = blockB.questions || [];
    const safePairCount = Math.min(questionsA.length, questionsB.length);

    console.log('[two-rule-mode] qA:', questionsA.length, 'qB:', questionsB.length,
                'groupKey:', ps.groupKey, 'marksA:', marksA, 'marksB:', marksB);

    if (safePairCount === 0) {
      // One or both rules returned no questions — skip this Q.No silently
      console.warn('[two-rule-mode] SKIPPED — 0 questions for group:', ps.groupKey,
                   '| Check DB has long questions for chapter ranges:', 
                   blockA.rule.chapter_start + '-' + blockA.rule.chapter_end,
                   'and', blockB.rule.chapter_start + '-' + blockB.rule.chapter_end);
      continue;
    }

    // attempt_count falls back to safePairCount ONLY for null/undefined.
    // A literal 0 is a real, intentional value — it means this Q.No's
    // questions still print (as an optional/extra item), but NOTHING
    // from it counts toward the attempt note or the paper's total marks.
    // (countsTowardTotal below naturally comes out false for every pair
    // when attemptCount is 0, since gIdx starts at 0 and 0 < 0 is false —
    // so totalMarks for this Q.No correctly resolves to 0.)
    const attemptCount          = leadRule.attempt_count ?? safePairCount;
    const marksPerWholeQuestion = marksA + marksB;
    const totalAttemptMarks     = attemptCount * marksPerWholeQuestion;

    // No note at all when attemptCount is 0 — an attempt_count=0 group
    // (e.g. physics_long_q7) is an optional extra item with nothing
    // required to attempt from it specifically, so there's nothing
    // meaningful to instruct the student to do here.
    const sharedNote   = attemptCount > 0
      ? (leadRule.q_label ||
         `Note: Attempt any ${attemptCount} questions in detail (${attemptCount}x${marksPerWholeQuestion}=${totalAttemptMarks})`)
      : undefined;
    const sharedNoteUr = attemptCount > 0
      ? (leadRule.q_label_ur ||
         `نوٹ: کوئی سے ${attemptCount} سوالات تفصیل سے حل کریں (${attemptCount}x${marksPerWholeQuestion}=${totalAttemptMarks})`)
      : undefined;

    for (let gIdx = 0; gIdx < safePairCount; gIdx++) {
      const pairQuestions = [
        { ...questionsA[gIdx], __pairLabel: 'a', marks: marksA },
        { ...questionsB[gIdx], __pairLabel: 'b', marks: marksB },
      ];
      const countsTowardTotal = gIdx < attemptCount;

      sections.push({
        id: `section-paired-long-${qNum}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'long',
        instructions: `Q. No. ${qNum}`,
        sharedAttemptNote:   gIdx === 0 ? sharedNote   : null,
        sharedAttemptNoteUr: gIdx === 0 ? sharedNoteUr : null,
        sharedAttemptCount:  gIdx === 0 ? attemptCount : null,
        sharedTotalPairs:    gIdx === 0 ? safePairCount : null,
        questions:           pairQuestions,
        totalQuestions:      pairQuestions.length,
        attemptCount:        pairQuestions.length,
        marksEach:           marksA,
        totalMarks:          countsTowardTotal ? (marksA + marksB) : 0,
        subject:             currentSubject?.name || '',
        language:            selectedLanguage,
        layout:              currentLayout,
        timestamp:           new Date().toISOString(),
        isPairedLong:        true,
         customEnHeader: '',   // explicitly empty → SectionHeader shows nothing, not its default
  customUrHeader: '', 
      } as any);
      qNum++;
    }
    continue;

  } else {
    // ── SINGLE-RULE MODE (original behaviour) ──
    // One is_paired rule fetches N questions; pairLongQuestions splits them into a/b pairs.
    const pooledGroups    = sortedPairedBlocks.flatMap(b => b.longGroups || []);
    // Same null/undefined-only fallback as two-rule-mode above — a
    // literal attempt_count=0 is intentional (optional/extra item) and
    // must stay 0, never bump up to pooledGroups.length.
    const attemptCount    = leadRule.attempt_count ?? pooledGroups.length;
    const marksPerPart    = pooledGroups[0]?.marksEach ??
      resolveMarksForType('long', expectedPattern) / 2;
    const marksPerWholeQuestion = marksPerPart * 2;
    const totalAttemptMarks     = attemptCount * marksPerWholeQuestion;

    // No note when attemptCount is 0 — same reasoning as two-rule-mode.
    const sharedNote   = attemptCount > 0
      ? (leadRule.q_label   ||
         `Note: Attempt any ${attemptCount} questions in detail (${attemptCount}x${marksPerWholeQuestion}=${totalAttemptMarks})`)
      : undefined;
    const sharedNoteUr = attemptCount > 0
      ? (leadRule.q_label_ur ||
         `نوٹ: کوئی سے ${attemptCount} سوالات تفصیل سے حل کریں (${attemptCount}x${marksPerWholeQuestion}=${totalAttemptMarks})`)
      : undefined;

    pooledGroups.forEach((group, gIdx) => {
      const pairQuestions = group.parts.map(p => ({
        ...p.question,
        __pairLabel: p.label,
        marks: marksPerPart,
      }));
      const countsTowardTotal = gIdx < attemptCount;

      sections.push({
        id: `section-paired-long-${qNum}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'long',
        instructions: `Q. No. ${qNum}`,
        sharedAttemptNote:   gIdx === 0 ? sharedNote          : null,
        sharedAttemptNoteUr: gIdx === 0 ? sharedNoteUr        : null,
        sharedAttemptCount:  gIdx === 0 ? attemptCount        : null,
        sharedTotalPairs:    gIdx === 0 ? pooledGroups.length  : null,
        questions:           pairQuestions,
        totalQuestions:      pairQuestions.length,
        attemptCount:        pairQuestions.length,
        marksEach:           marksPerPart,
        totalMarks:          countsTowardTotal ? pairQuestions.length * marksPerPart : 0,
        subject:             currentSubject?.name || '',
        language:            selectedLanguage,
        layout:              currentLayout,
        timestamp:           new Date().toISOString(),
        isPairedLong:        true,
      } as any);
      qNum++;
    });
    continue;
  }
}
      // ── ALTERNATIVE GROUP (is_alternative=true on every member) ──
      // e.g. "Application OR Letter": every rule in the group_key is kept
      // (resolveRuleBlocks no longer drops siblings), each fetches its own
      // question(s) independently, and ALL of them render together under
      // ONE Q.No separated by "OR" dividers — the student picks one at
      // exam time. Each alternative keeps its OWN full marks (e.g. 10),
      // not a split/shared value like the is_paired a/b case.
      const alternativeBlocksInGroup = ps.blocks.filter(b => b.rule.is_alternative);
      if (alternativeBlocksInGroup.length > 0 && alternativeBlocksInGroup.length === ps.blocks.length && ps.blocks.length > 1) {
        const sortedAltBlocks = [...alternativeBlocksInGroup].sort(
          (a, b) => (a.rule.sort_order ?? 0) - (b.rule.sort_order ?? 0)
        );

        // Each alternative contributes its first fetched question (an
        // alternative is "one whole option", not a list to attempt
        // several from — matching the real board pattern's "Q.5 Letter
        // OR Application" shape, one question per side of the OR).
        const alternatives = sortedAltBlocks
          .map(b => ({
            question: b.questions[0],
            marks: resolveMarksForRule(b.rule, expectedPattern),
            questionType: b.rule.question_type,
          }))
          .filter(alt => alt.question); // drop any side with no question found

        if (alternatives.length === 0) continue;

        // Total marks for the paper header: a student can only ever earn
        // ONE alternative's marks (they pick one side of the OR), so the
        // section contributes the marks of whichever alternative is worth
        // the most — not the sum of every alternative shown.
        const totalMarks = Math.max(...alternatives.map(a => a.marks));

        sections.push({
          id: `section-alt-${qNum}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: alternatives[0].questionType,
          instructions: `Q. No. ${qNum}`,
          questions: alternatives.map(a => a.question),
          totalQuestions: alternatives.length,
          attemptCount: 1, // exactly one alternative is attempted
          marksEach: totalMarks,
          totalMarks,
          subject: currentSubject?.name || '',
          language: selectedLanguage,
          layout: currentLayout,
          timestamp: new Date().toISOString(),
          isAlternativeGroup: true,
          // Per-alternative marks travel alongside the flat questions[]
          // array (index-aligned) so the renderer can show each
          // alternative's own marks value next to it, since they can
          // legitimately differ (e.g. Letter=10, Application=8).
          alternativeMarks: alternatives.map(a => a.marks),
        } as any);
        qNum++;
        continue;
      }

      // ── Grouped (multi-sub-part, all compulsory) OR standalone section ──
      const allQuestions = ps.blocks.flatMap(b => b.questions);
      if (allQuestions.length === 0) continue;

      // marksEach for the section: resolved per-rule via resolveMarksForRule
      // (category default_marks first, BoardPatternService fallback). When
      // a group mixes multiple question_types under one Q.No (e.g. a
      // stanza-explanation + punctuation + pair-of-words trio), each
      // sub-group keeps ITS OWN marks via the same resolveMarksForRule call
      // below (they can legitimately differ) — inferredMarksEach below is
      // only a single display value for the section as a whole, taken from
      // the first block's rule; it's accurate when every block shares one
      // type/category and a reasonable representative value otherwise.
      const inferredMarksEach = resolveMarksForRule(ps.blocks[0].rule, expectedPattern);

      const subgroups = ps.blocks.map(b => ({
        qLabel: b.rule.q_label || null,
        categoryLabel: b.categoryLabel,
        attemptCount: b.rule.attempt_count ?? b.questions.length,
        marksEach: resolveMarksForRule(b.rule, expectedPattern),
        questions: b.questions,
      }));

      const totalAttempt = subgroups.reduce((sum, g) => sum + (g.attemptCount || 0), 0);
      // Total marks sums each sub-group's OWN attempt x marks, so mixed-type
      // groups (different marks per sub-part) compute correctly — this does
      // NOT just multiply totalAttempt x one shared inferredMarksEach.
      const totalMarks = subgroups.reduce((sum, g) => sum + (g.attemptCount || 0) * (g.marksEach || 0), 0);

      const instructionLabel = isMcq
        ? `Q. No. ${qNum}: Choose the correct answer.`
        : ps.groupKey
          ? `Q. No. ${qNum}: Attempt the following.`
          : `Q. No. ${qNum}: Attempt any ${totalAttempt} out of ${allQuestions.length} questions.`;

      sections.push({
        id: sectionId,
        type: ps.type,
        instructions: instructionLabel,
        questions: allQuestions,
        totalQuestions: allQuestions.length,
        attemptCount: totalAttempt,
        marksEach: inferredMarksEach,
        totalMarks,
        subject: currentSubject?.name || '',
        language: selectedLanguage,
        layout: currentLayout,
        timestamp: new Date().toISOString(),
        // subgroups carries per-rule category labels + sub-part letters so
        // the renderer can print "(A) Synonyms ... (B) MCQs from the Book ..."
        // in the exact configured order. Renderer falls back to flat
        // rendering if it doesn't (yet) know about `subgroups`.
        subgroups: subgroups.length > 1 ? subgroups : undefined,
      } as any);
      qNum++;
    }

    if (sections.length === 0) {
      throw new Error("No questions found for the configured rules. Check rule chapter ranges/categories and the question bank.");
    }

    // ─────────────────────────────────────────────────────────────────
    // 5. COLLAPSE PAIRED-LONG NOTES ACROSS INDEPENDENT GROUPS
    // ─────────────────────────────────────────────────────────────────
    // sections is now in final paper order (Q.1, Q.2, Q.3...). Multiple
    // INDEPENDENT is_paired groups (e.g. three separate group_keys, one
    // per Q.No) each attached their own sharedAttemptNote/sharedAttemptNoteUr
    // to their own first pair, with no knowledge of each other — by
    // design, since the loop above processes one ps (pending section) at
    // a time. The desired final paper, however, should show only ONE
    // such note in total: on the very first isPairedLong section that
    // carries one, in paper order. Every later isPairedLong section's
    // note is cleared here, regardless of which group_key it came from.
    //
    // This does NOT touch is_alternative or grouped/subgroup sections —
    // only isPairedLong, since that's the specific case that was
    // reported as printing one note per Q.No when only one was wanted.
    let firstPairedLongNoteSeen = false;
    for (const section of sections) {
      if (!(section as any).isPairedLong) continue;
      const hasNote = Boolean((section as any).sharedAttemptNote || (section as any).sharedAttemptNoteUr);
      if (!hasNote) continue; // non-first pairs within a group already carry no note
      if (!firstPairedLongNoteSeen) {
        firstPairedLongNoteSeen = true; // this is the one note we keep
      } else {
        (section as any).sharedAttemptNote = null;
        (section as any).sharedAttemptNoteUr = null;
        (section as any).sharedAttemptCount = null;
        (section as any).sharedTotalPairs = null;
      }
    }

    const paperData = { layout: getValues('mcqPlacement') || currentLayout, language: selectedLanguage, sections };
    localStorage.setItem('questionPapers', JSON.stringify(paperData));
    refreshPaperData();
  };

  // ─────────────────────────────────────────────────────────────────────
  // FALLBACK GENERATOR (legacy hardcoded BoardPatternService pattern)
  // Used only when chapter_question_rules has zero rows for this subject
  // + class, so generation doesn't hard-fail while rules are being set up.
  // ─────────────────────────────────────────────────────────────────────
  const generateFromFallbackPattern = async (
    selectedLanguage: 'english' | 'urdu' | 'bilingual',
  ) => {
    const expectedPattern = BoardPatternService.getQuestionDetails(currentSubject.name, currentClass.name, currentSubject);
    const subName = currentSubject?.name?.toLowerCase() || '';

    const fallbackRules: BoardRule[] = [
      { question_type: 'mcq', min_questions: expectedPattern.mcq.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' },
      { question_type: 'short', min_questions: expectedPattern.short.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' },
      { question_type: 'long', min_questions: expectedPattern.long.count, chapter_start: 1, chapter_end: 20, rule_mode: 'total' },
    ];

    const questionsByType: Record<string, Question[]> = {};
    for (const rule of fallbackRules) {
      questionsByType[rule.question_type] = await fetchQuestionsForRule(rule);
    }

    const allRequiredTypes = [
      { name: 'mcq', count: expectedPattern.mcq.count },
      { name: 'short', count: expectedPattern.short.count },
      { name: 'long', count: expectedPattern.long.count },
      ...(expectedPattern.additionalTypes || []),
    ];

    for (const typeInfo of allRequiredTypes) {
      const existing = questionsByType[typeInfo.name] || [];
      if (existing.length < typeInfo.count && typeInfo.count > 0) {
        const deficit = typeInfo.count - existing.length;
        try {
          const fallbackRes = await axios.get('/api/questions', {
            params: { subjectId: watchedSubjectId, classId: watchedClassId, questionType: typeInfo.name, limit: deficit, random: true },
          });
          questionsByType[typeInfo.name] = [...existing, ...(fallbackRes.data || [])];
        } catch (e) {
          console.error(`Fallback failed for ${typeInfo.name}`, e);
        }
      }
    }

    const sections: PaperSection[] = [];

    const mcqs = (questionsByType['mcq'] || []).slice(0, expectedPattern.mcq.count);
    if (mcqs.length > 0) sections.push(createSectionObject('mcq', 'Q. No. 1: Choose the correct answer.', mcqs, expectedPattern.mcq.marks));

    const shorts = (questionsByType['short'] || []).slice(0, expectedPattern.short.count);
    if (shorts.length > 0) {
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
          marksEach: expectedPattern.short.marks,
          totalMarks: attemptPerSection * expectedPattern.short.marks,
          subject: currentSubject?.name || '',
          language: selectedLanguage,
          layout: currentLayout,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const longs = (questionsByType['long'] || []).slice(0, expectedPattern.long.count);
    if (longs.length > 0) {
      sections.push({
        id: `section-long-${Date.now()}`,
        type: 'long',
        instructions: `Q. No. ${sections.length + 1}: Attempt any ${expectedPattern.long.attempt} Long Questions.`,
        questions: longs,
        totalQuestions: longs.length,
        attemptCount: expectedPattern.long.attempt,
        marksEach: expectedPattern.long.marks,
        totalMarks: expectedPattern.long.attempt * expectedPattern.long.marks,
        subject: currentSubject?.name || '',
        language: selectedLanguage,
        layout: currentLayout,
        timestamp: new Date().toISOString(),
      });
    }

    if (expectedPattern.additionalTypes?.length > 0) {
      let nextQNum = sections.length + 1;
      for (const extra of expectedPattern.additionalTypes) {
        let extraQuestions = questionsByType[extra.name] || [];
        if (extraQuestions.length === 0) {
          try {
            const res = await axios.get('/api/questions', {
              params: { subjectId: watchedSubjectId, classId: watchedClassId, questionType: extra.name, limit: extra.count, random: true },
            });
            extraQuestions = res.data || [];
          } catch (e) {
            console.error(`Fallback fetch failed for additional type ${extra.name}`, e);
          }
        }
        extraQuestions = extraQuestions.slice(0, extra.count);
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
            timestamp: new Date().toISOString(),
          });
          nextQNum++;
        }
      }
    }

    if (sections.length === 0) throw new Error("No questions found even with fallback. Check DB connections.");

    const paperData = { layout: getValues('mcqPlacement') || currentLayout, language: selectedLanguage, sections };
    localStorage.setItem('questionPapers', JSON.stringify(paperData));
    refreshPaperData();
  };

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
    timestamp: new Date().toISOString(),
  });

  const handlePrint = async () => {
    window.print();
    try {
      const response = await fetch('/api/profile/increment-count', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update count');
      setProfile((prev: any) => ({ ...prev, profile: result.profile }));
    } catch (error: any) {
      console.error("API Update Error:", error.message);
    }
  };

  const handleSectionUpdate = useCallback((updatedSections: PaperSection[]) => {
    setPaperSections(updatedSections);
    localStorage.setItem('questionPapers', JSON.stringify({ layout: currentLayout, language: paperLanguage, sections: updatedSections }));
  }, [currentLayout, paperLanguage]);

  const handleEditSection = useCallback((section: PaperSection) => {
    setEditingSection(section);
    setShowQuestionSelector(true);
  }, []);

  const handleDeleteSection = useCallback((sectionId: string) => {
    if (!confirm('Delete this section from the paper?')) return;
    handleSectionUpdate(paperSections.filter(s => s.id !== sectionId));
  }, [paperSections, handleSectionUpdate]);

  const handleTextChange = (sectionId: string, questionId: string, field: string, value: string) => {
    const updated = paperSections.map(s =>
      s.id === sectionId
        ? { ...s, questions: s.questions.map(q => q.id === questionId ? { ...q, [field]: value } : q) }
        : s
    );
    setPaperSections(updated);
    localStorage.setItem('questionPapers', JSON.stringify({ layout: currentLayout, language: paperLanguage, sections: updated }));
  };

  const totalMarks = paperSections.reduce((acc, s) => acc + (s.totalMarks || 0), 0);
  const totalQuestions = paperSections.reduce((acc, s) => acc + (s.totalQuestions || 0), 0);

  const subStatus = profile?.profile?.subscription_status;
  const isPremium = subStatus === 'active';
  const hasActivePackage = profile?.userPackages?.some((pkg: any) => pkg.is_active === true);
  const isUserPremium = isPremium || hasActivePackage;
  const pageSize = getPageSize(settings.pageSize);

  // ─── The settings panel rendered via portal directly into document.body ───
  // This completely escapes ALL parent overflow/clip/stacking contexts
  const settingsPanelPortal = isMounted
    ? createPortal(
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          isPremium={isUserPremium}
          currentLayout={currentLayout}
          onSettingChange={(key, value) => setSettings(prev => ({ ...prev, [key]: value }))}
        />,
        document.body
      )
    : null;

  return (
    // ⚠️ CRITICAL: Remove overflowX: 'hidden' from root — it was clipping the fixed sidebar.
    // Horizontal overflow is handled per-element below instead.
    <div className="min-vh-100 d-flex flex-column bg-light">

      {/* 1. FIXED HEADER */}
      <div className="d-print-none bg-white border-bottom shadow-sm app-header">
        <div className="w-100 appHeaderContent">
          <AppHeader
            onBoardPattern={handleBoardPattern}
            onConfigurePaper={() => { setEditingSection(null); setShowQuestionSelector(true); }}
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

      {/* 2. MAIN SCROLLABLE AREA */}
      <main
        className="flex-grow-1 overflow-auto  bg-opacity-10 custom-scrollbar d-print-block paper-preview-main"
        style={{ touchAction: 'pan-x pan-y pinch-zoom', overflowX: 'hidden' }}
      >
        <div className="paper-canvas-wrapper">
          <div
            id="printable-paper"
            ref={paperRef}
            className={`bg-white shadow-lg paper-canvas ${paperSections.length === 0 ? 'paper-canvas--empty' : ''}`}
            style={{
              height: 'auto', fontFamily: settings.fontFamily, direction: config.direction as any,
              outline: isEditMode ? '3px solid #fcd34d' : 'none',
              outlineOffset: isEditMode ? '3px' : '0',
            }}
          >
            {paperSections.length === 0 ? (
              <div
                className="empty-state d-flex flex-column align-items-center justify-content-start text-muted text-center p-3 pt-4 mt-3"
                style={{ minHeight: `${pageSize.heightMm}mm` }}
              >
                <BookOpen size={56} className="mb-3 opacity-20" />
                <h3 className="fw-light fs-5 fs-md-3">Paper Preview</h3>
                <p className="mb-4 px-2" style={{ fontSize: '0.9rem' }}>
                  Select a subject and generate a pattern to begin.
                </p>
                <div className="d-flex flex-column gap-3 w-100 px-3" style={{ maxWidth: '360px' }}>
                  <button
                    className="btn btn-primary btn-lg px-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                    onClick={handleBoardPattern}
                    disabled={isLoading || isGeneratingBoardPattern}
                    style={{ borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    {isGeneratingBoardPattern
                      ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      : <i className="bi bi-magic" />}
                    Generate Board Pattern Paper-Full Book
                  </button>
                  <button
                    className="btn btn-outline-dark btn-lg px-3 d-flex align-items-center justify-content-center gap-2"
                    onClick={() => setShowQuestionSelector(true)}
                    style={{ borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    <Settings size={18} />
                    Configure Paper Manually
                  </button>
                </div>
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
                subjectUrduName={currentSubject?.name_ur}
                profile={profile?.profile}
                isPremium={isUserPremium}
                onSectionUpdate={handleSectionUpdate}
                onEditSection={handleEditSection}
                onDeleteSection={handleDeleteSection}
              />
            )}
          </div>
        </div>
      </main>

      {/* 3. LOADING OVERLAY */}
      {(isLoading || isGeneratingBoardPattern || isSaving) && (
        <div
          className="position-fixed top-0 start-0 w-100 vh-100 d-flex flex-column align-items-center justify-content-center"
          style={{ zIndex: 9999, backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(2px)' }}
        >
          <Loading message={isSaving ? 'Saving to Cloud...' : 'Generating Board Pattern...'} />
        </div>
      )}

      {/* 4. FLOATING SETTINGS BUTTON */}
      <button
        className="btn btn-dark rounded-circle shadow-lg position-fixed bottom-0 end-0 m-4 d-print-none d-flex align-items-center justify-content-center"
        style={{ width: '56px', height: '56px', zIndex: 1050 }}
        onClick={() => setShowSettings(true)}
      >
        <Settings size={24} />
      </button>

      {/* 5. QUESTION SELECTOR MODAL */}
      {showQuestionSelector && (
        <QuestionSelectorModal
          isOpen={showQuestionSelector}
          onClose={() => { setShowQuestionSelector(false); setEditingSection(null); refreshPaperData(); }}
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
          currentClass={currentClass}
          editingSection={editingSection}
        />
      )}

      <style jsx global>{`
        @font-face {
          font-family: 'JameelNoori';
          src: local('Jameel Noori Nastaleeq'), local('Nafees'), local('Alvi Lahori Nastaleeq'), local('JameelNoori');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

        /* This step is its own full-bleed paper editor — the dashboard's
           breadcrumb trail has no room here and, on mobile, shows through
           behind the fixed header/canvas since paper-preview-main isn't
           opaque outside the centered sheet. Hide it only while this step
           is mounted (unmounts automatically when leaving the step). */
        .examly-breadcrumb { display: none !important; }

        /* ── Screen baseline ── */
        @media screen {
          html, body { overflow-x: hidden; }
          .paper-canvas {
            width: ${pageSize.widthMm}mm;
            min-height: ${pageSize.heightMm}mm;
            margin: 20px auto;
            background: white;
            transform-origin: top center;
            transition: transform 0.2s ease;
          }
        }

        /* ── Desktop: pin paper-preview-main to viewport, no body scroll ── */
        @media screen and (min-width: 992px) {
          html, body { overflow: hidden; }
          .paper-preview-main {
            position: fixed !important;
            top: 72px !important;
            left: 256px !important;
            right: 0 !important;
            bottom: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
        }

        /* ── Print ── */
        @media print {
          @page { size: ${pageSize.cssName} portrait; margin: 0 !important; }

          html, body, #__next, .min-vh-100, main {
            margin: 0 !important;
            padding: 0 !important;
            position: static !important;
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .d-flex { background: transparent !important; }
          .app-header, .d-print-none, .sidebar, .btn-dark { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; }
          /* Portal renders into body — hide settings panel on print too */
          .settings-sidebar, .settings-sidebar + div { display: none !important; }

          .paper-canvas {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            margin: 0 !important; padding: 0 !important;
            width: ${pageSize.widthMm}mm !important;
            box-shadow: none !important;
            transform: none !important;
            zoom: unset !important;
            min-height: auto !important;
            height: auto !important;
          }
          .paper-canvas-wrapper { display: block !important; width: ${pageSize.widthMm}mm !important; overflow: visible !important; }

          body * { visibility: hidden; }
          .paper-sheet, .paper-sheet * { visibility: visible; }
          .paper-sheet {
            visibility: visible !important;
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 auto !important;
            padding: 3mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            width: ${pageSize.widthMm}mm !important;
            height: auto !important;
          }
        }

        /* ── Sidebar scrollbar ── */
        .settings-sidebar::-webkit-scrollbar { width: 5px; }
        .settings-sidebar::-webkit-scrollbar-track { background: #f1f3f5; }
        .settings-sidebar::-webkit-scrollbar-thumb { background: #ced4da; border-radius: 4px; }
        .settings-sidebar::-webkit-scrollbar-thumb:hover { background: #adb5bd; }
        .settings-sidebar { scrollbar-width: thin; scrollbar-color: #ced4da #f1f3f5; }

        /* ── Utilities ── */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .header-wrapper { position: relative; height: 100%; }

        .btn-premium {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 10px; white-space: nowrap; font-weight: 600;
          font-size: 0.85rem; padding: 0 16px; display: flex; align-items: center;
          gap: 8px; height: 42px; border: 1px solid #e2e8f0;
          background: #ffffff; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .btn-premium:hover:not(:disabled) { transform: translateY(-1px); background: #f8fafc; border-color: #cbd5e1; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .btn-premium:active:not(:disabled) { transform: scale(0.97); }
        .btn-premium:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
        .edit-mode-active { background: #fffbeb !important; border-color: #fcd34d !important; color: #92400e !important; box-shadow: inset 0 2px 4px rgba(251,191,36,0.1) !important; }

        .scroll-nav-btn {
          background: white; border: 1px solid #e2e8f0; border-radius: 50%;
          width: 32px; height: 32px; display: flex; align-items: center;
          justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          z-index: 20; flex-shrink: 0; position: absolute;
        }
        .left-fade { left: 4px; }
        .right-fade { right: 4px; }

        .app-header {
          position: fixed; top: 0; right: 0; left: 256px;
          height: 72px; z-index: 1020;
          background: rgba(255,255,255,0.97); backdrop-filter: blur(8px);
          border-bottom: 1px solid #e9ecef;
          box-shadow: 0 1px 8px rgba(0,0,0,0.06);
          transition: all 0.3s ease;
        }

        .empty-state .btn-primary { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: none; transition: all 0.3s ease; }
        .empty-state .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(37,99,235,0.3) !important; }
        .empty-state .btn-outline-dark { border: 1px solid #e2e8f0; background: #ffffff; color: #1e293b; transition: all 0.3s ease; }
        .empty-state .btn-outline-dark:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-2px); }

        @media (max-width: 990px) {
          .app-header { left: 0; height: 64px; top: var(--mobile-topbar-h, 55px); }
          .btn-premium { height: 38px; padding: 0 12px; font-size: 0.8rem; }
        }

        /* ── Mobile: pin paper-preview-main below the dashboard's own sticky
           top bar + our app-header, exactly mirroring the desktop fixed-panel
           approach above. This avoids depending on (and duplicating) the
           dashboard layout's own padding/breadcrumb flow height, which was
           the source of the large blank gap between the tabs and the paper. */
        @media screen and (max-width: 991px) {
          html, body { overflow: hidden; }
          .paper-preview-main {
            position: fixed !important;
            top: calc(var(--mobile-topbar-h, 55px) + 64px) !important;
            left: 0 !important; right: 0 !important; bottom: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 0 80px 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }
          .paper-canvas-wrapper {
            display: flex !important; justify-content: center !important;
            width: 100% !important; max-width: 100% !important;
            overflow: hidden !important; padding: 0 !important; margin: 0 !important;
            position: relative !important; left: 0 !important;
          }
          .paper-canvas {
            width: ${pageSize.widthPx}px !important;
            /* Flex items shrink below their specified width by default
               (flexbox's automatic minimum size falls back to the item's
               min-content size, which text content makes far smaller than
               the sheet width). That silently squeezed the whole page layout — tables,
               bilingual columns, headers — into a narrower box than it was
               designed for, reading as "cut off" content. flex-shrink: 0
               keeps the canvas at its true width so the transform below
               scales the WHOLE thing down uniformly instead. */
            flex-shrink: 0 !important;
            transform: scale(var(--paper-scale, 0.45)) !important;
            transform-origin: top center !important;
            margin: 12px 0 var(--paper-margin-bottom, -400px) 0 !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
            zoom: unset !important;
          }
          .empty-state { padding: 1.5rem 1rem !important; }
          .empty-state h3 { font-size: 1.1rem !important; }
          .empty-state .btn-lg { font-size: 0.85rem !important; padding: 0.5rem 1rem !important; height: auto !important; min-height: 48px; white-space: normal !important; text-align: center; }
          .paper-canvas--empty { width: 100% !important; transform: none !important; margin: 0 !important; box-shadow: none !important; min-height: calc(100vh - 140px) !important; }
          .paper-canvas--empty .empty-state { min-height: calc(100vh - 140px) !important; width: 100% !important; padding: 2rem 1.5rem !important; }
          .paper-canvas-wrapper:has(.paper-canvas--empty) { overflow: visible !important; justify-content: stretch !important; }
        }
      `}</style>

      {/* 6. SETTINGS PANEL — rendered via React Portal into document.body
           This completely escapes the component tree and ALL parent
           overflow / clip / stacking contexts, guaranteeing the sidebar
           is never clipped regardless of what the parent layout does.    */}
      {settingsPanelPortal}
    </div>
  );
};
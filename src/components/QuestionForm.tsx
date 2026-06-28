// components/QuestionForm.tsx
'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { createQuestion, updateQuestion, fetchLookups, fetchTopicsByChapter } from '@/lib/questionsApi';
import toast from 'react-hot-toast';
import { Editor } from '@tinymce/tinymce-react';

/*
 * ── KaTeX Integration Notes ────────────────────────────────────────────────
 *
 * HOW MATH GETS INTO QUESTIONS
 * ─────────────────────────────
 * Authors type LaTeX delimiters directly into the TinyMCE editor:
 *   inline  →  \( x^2 + y^2 = r^2 \)
 *   display →  \[ \frac{-b \pm \sqrt{b^2-4ac}}{2a} \]
 *
 * A custom toolbar button "f(x)" opens a prompt so authors can insert a
 * formula without remembering the syntax.  The raw LaTeX string is stored
 * in the database as-is (inside the existing HTML).
 *
 * HOW MATH GETS RENDERED IN PREVIEWS
 * ────────────────────────────────────
 * After each editor change the PreviewBox component calls
 * window.renderMathInElement() (KaTeX auto-render, loaded by the parent
 * page via CDN <script> tags) on its own DOM node.  This means the preview
 * shows exactly what students will see in the question bank.
 *
 * URDU + MATH
 * ───────────
 * KaTeX output nodes are `direction: ltr; display: inline-block` so they
 * always render left-to-right even inside an RTL Urdu container.
 *
 * TINYMCE SETUP
 * ─────────────
 * We use the GPL CDN build (no API key).  The MathJax plugin that caused
 * infinite recursion has been removed entirely.  Instead the `setup`
 * callback adds a lightweight "f(x)" button that wraps selected text (or a
 * prompted string) in \(...\) or \[...\] delimiters.
 *
 * ── EDIT-MODE HYDRATION NOTES (read this before touching the init effect) ──
 *
 * Editing a question requires reverse-deriving class_id / subject_id /
 * chapter_id from question.topic_id by walking UP the hierarchy:
 *   topic → chapter → class_subject → {class_id, subject_id}
 *
 * This walk depends on lookup tables (topics/chapters/classSubjects) being
 * loaded. Those lookups are fetched async on mount, so there is a real race:
 * if hydration runs before lookups resolve, the walk fails silently and the
 * form opens with empty dropdowns even though the question has a topic_id.
 *
 * Two structural rules fix this avoid re-breaking it:
 *   1. Hydration only runs once `lookupsReady` is true, and is keyed off
 *      `question?.id` (not the lookup arrays) so it doesn't re-fire on every
 *      lookup refresh.
 *   2. While hydration is in-flight (`hydratingRef`), the cascading dropdown
 *      effects (class→subject→chapter→topic) must NOT clear child fields,
 *      since those effects exist to reset stale children when a user
 *      manually changes a parent field — not to fight against a programmatic
 *      hydration that sets parent+child together.
 *
 * ── CATEGORY FIELD NOTE ──────────────────────────────────────────────────
 * question_category_id (uuid, FK -> question_categories.id) is the ONLY
 * category field this form reads or writes. The legacy question_category
 * (text) column still exists in the DB for backward compatibility with old
 * rows, but this form never touches it — every read and every write below
 * goes through question_category_id exclusively.
 */
declare global {
  interface Window {
    katex: any;
    renderMathInElement: (el: HTMLElement, opts?: any) => void;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   KaTeX helpers + Urdu pre-processor
═══════════════════════════════════════════════════════════════════════════*/
const _URDU_RUN = /([\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F ]+)/g;

function _wrapUrduInMath(content: string): string {
  const parts: string[] = []; let cur = 0;
  const re = /\\text\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g; let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > cur) parts.push(content.slice(cur, m.index).replace(_URDU_RUN, r => /^\s+$/.test(r) ? r : `\\text{${r.trim()}}`));
    parts.push(m[0]); cur = m.index + m[0].length;
  }
  if (cur < content.length) parts.push(content.slice(cur).replace(_URDU_RUN, r => /^\s+$/.test(r) ? r : `\\text{${r.trim()}}`));
  return parts.join('');
}

function _rewrite(src: string, open: string, close: string): string {
  const out: string[] = []; let pos = 0;
  while (pos < src.length) {
    const oi = src.indexOf(open, pos);
    if (oi === -1) { out.push(src.slice(pos)); break; }
    out.push(src.slice(pos, oi));
    const ci = src.indexOf(close, oi + open.length);
    if (ci === -1) { out.push(src.slice(oi)); pos = src.length; break; }
    out.push(open + _wrapUrduInMath(src.slice(oi + open.length, ci)) + close);
    pos = ci + close.length;
  }
  return out.join('');
}

function _wrapUndelimited(src: string): string {
  const CMD  = '\\\\[a-zA-Z]+';
  const BARG = '\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}';
  const OARG = '\\[[^\\]]*\\]';
  const UNIT = `(?:${CMD}(?:\\s*(?:${BARG}|${OARG}))*)`;
  const OP   = '(?:\\s*[+\\-=]\\s*)';
  const SEQ  = new RegExp(`(${UNIT}(?:${OP}${UNIT})*)`, 'g');
  return src.replace(SEQ, (match, _p1, offset) => {
    const before = src.slice(0, offset);
    const inD = (before.match(/\\\[/g) || []).length > (before.match(/\\\]/g) || []).length;
    const inI = (before.match(/\\\(/g) || []).length > (before.match(/\\\)/g) || []).length;
    const in$ = ((before.match(/\$\$/g) || []).length) % 2 !== 0;
    if (inD || inI || in$) return match;
    if (/^\\[ntr ]$/.test(match.trim())) return match;
    return `\\(${match}\\)`;
  });
}

function preprocessMathHtml(html: string | null | undefined): string {
  if (!html) return html ?? '';
  let r = html;
  r = _rewrite(r, '\\[', '\\]');
  r = _rewrite(r, '\\(', '\\)');
  r = _rewrite(r, '$$', '$$');
  r = _wrapUndelimited(r);
  return r;
}

const KATEX_OPTS = {
  delimiters: [
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true },
    { left: '$$', right: '$$', display: true },
  ],
  throwOnError: false,
  strict: false,
  trust: true,
};

const renderMath = (node: HTMLElement | null) => {
  if (!node || typeof window === 'undefined') return;
  if (!window.renderMathInElement) { setTimeout(() => renderMath(node), 150); return; }
  try { window.renderMathInElement(node, KATEX_OPTS); }
  catch (err) { console.warn('KaTeX render error:', err); }
};

/* ═══════════════════════════════════════════════════════════════════════════
   PreviewBox — renders WYSIWYG HTML + KaTeX math inline
═══════════════════════════════════════════════════════════════════════════*/
interface PreviewBoxProps {
  html: string | null | undefined;
  dir?: 'ltr' | 'rtl';
  label?: string;
}

function PreviewBox({ html, dir = 'ltr', label }: PreviewBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const safeHtml = preprocessMathHtml(html);

  useEffect(() => {
    if (!ref.current || !safeHtml) return;
    const id = requestAnimationFrame(() => renderMath(ref.current));
    return () => cancelAnimationFrame(id);
  }, [safeHtml]);

  if (!safeHtml || safeHtml.replace(/<[^>]*>/g, '').trim() === '') return null;

  return (
    <div className="qfm-preview-wrap">
      {label && <span className="qfm-preview-label">{label}</span>}
      <div
        ref={ref}
        dir={dir}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        className={`qfm-preview-box ${dir === 'rtl' ? 'qfm-preview-ur' : 'qfm-preview-en'}`}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   buildMathButton — TinyMCE `setup` helper
═══════════════════════════════════════════════════════════════════════════*/
function buildMathButton(editor: any) {
  editor.ui.registry.addButton('mathformula', {
    text: 'f(x)',
    tooltip: 'Insert math formula (LaTeX)',
    onAction: () => {
      const selected = editor.selection.getContent({ format: 'text' }).trim();
      const formula = window.prompt(
        'Enter LaTeX formula (e.g.  x^2 + y^2 = r^2  or  \\frac{a}{b}):',
        selected || ''
      );
      if (!formula) return;

      const isDisplay = window.confirm(
        'Display formula on its own line?\n\n' +
        'OK = display block   \\[ ... \\]\n' +
        'Cancel = inline      \\( ... \\)'
      );

      const wrapped = isDisplay ? `\\[ ${formula} \\]` : `\\( ${formula} \\)`;
      editor.execCommand('mceInsertContent', false, wrapped);
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Types & constants
═══════════════════════════════════════════════════════════════════════════*/
interface QuestionCategory {
  id: string; question_type: string; category_value: string;
  label_en: string; label_ur?: string | null;
  subject_hint?: string | null; class_hint?: string | null;
  default_marks?: number | null; sort_order: number; is_active: boolean;
}

interface QuestionFormProps {
  question?: any;
  classes: any[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  classSubjects: any[];
  questionCategories?: QuestionCategory[];
  onClose: () => void;
}

type QuestionType =
  | 'mcq' | 'short' | 'long'
  | 'translate_urdu' | 'translate_english' | 'idiom_phrases' | 'passage'
  | 'poetry_explanation' | 'stanza_explanation' | 'prose_explanation'
  | 'sentence_correction' | 'sentence_completion' | 'punctuation'
  | 'directInDirect' | 'activePassive' | 'application' | 'letter'
  | 'mokalma' | 'Nasarkhulasa' | 'markziKhyal'
  | 'gazal' | 'summary' | 'pair_of_words' | 'essay' | 'story';

const EMPTY_TEXT_FIELDS = {
  question_text: '', question_text_ur: '',
  option_a: '', option_b: '', option_c: '', option_d: '',
  option_a_ur: '', option_b_ur: '', option_c_ur: '', option_d_ur: '',
  answer_text: '', answer_text_ur: '', source_year: '',
  passage_text: '', passage_text_ur: '',
  idiom_phrase: '', idiom_phrase_explanation: '',
  poetry_text: '', prose_text: '', sentence_text: '',
  direct_sentence: '', indirect_sentence: '',
  active_sentence: '', passive_sentence: '',
  darkhwast_text: '', kahani_text: '', nasar_text: '', summary_text: '',
  diagram: '', question_category_id: '',
  story_text: '',      // English story prompt
  story_text_ur: '',   // Urdu story prompt
};

/* ═══════════════════════════════════════════════════════════════════════════
   QuestionForm
═══════════════════════════════════════════════════════════════════════════*/
export default function QuestionForm({
  question, classes, subjects, chapters, topics, classSubjects,
  questionCategories = [], onClose,
}: QuestionFormProps) {
  const toId = useCallback((v: any) => (v === null || v === undefined ? '' : String(v)), []);

  const TINYMCE_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tinymce@6.8.3/tinymce.min.js';

  const [formData, setFormData] = useState({
    ...EMPTY_TEXT_FIELDS,
    correct_option: '',
    class_id: '', subject_id: '', chapter_id: '', topic_id: '',
    difficulty: 'medium',
    question_type: 'mcq' as QuestionType,
    source_type: 'book' as 'book' | 'past_paper' | 'model_paper' | 'custom' | 'conceptual',
    passage_questions_count: 1,
  });

  const compareLabels = useCallback((a: any, b: any) => {
    return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }, []);

  const [lookupClasses, setLookupClasses] = useState<any[]>(classes);
  const [lookupSubjects, setLookupSubjects] = useState<any[]>(subjects);
  const [lookupChapters, setLookupChapters] = useState<any[]>(chapters);
  const [lookupTopics, setLookupTopics] = useState<any[]>(topics);
  const [lookupClassSubjects, setLookupClassSubjects] = useState<any[]>(classSubjects);
  const [lookupQuestionCategories, setLookupQuestionCategories] = useState<QuestionCategory[]>(questionCategories);
  const [lookupsReady, setLookupsReady] = useState(false);

  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);
  const [filteredQuestionCategories, setFilteredQuestionCategories] = useState<QuestionCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const hydratingRef = useRef(false);
  const hydratedForId = useRef<string | null>(null);

  const activeClasses = useMemo(
    () => [...(lookupClasses.length ? lookupClasses : classes)].sort(compareLabels),
    [classes, compareLabels, lookupClasses]
  );
  const activeSubjects = useMemo(
    () => [...(lookupSubjects.length ? lookupSubjects : subjects)].sort(compareLabels),
    [compareLabels, lookupSubjects, subjects]
  );
  const activeChapters = useMemo(
    () => [...(lookupChapters.length ? lookupChapters : chapters)].sort(compareLabels),
    [chapters, compareLabels, lookupChapters]
  );
  const activeTopics = useMemo(
    () => [...(lookupTopics.length ? lookupTopics : topics)].sort(compareLabels),
    [compareLabels, lookupTopics, topics]
  );
  const activeClassSubjects = lookupClassSubjects.length ? lookupClassSubjects : classSubjects;
  const activeQuestionCategories = lookupQuestionCategories.length ? lookupQuestionCategories : questionCategories;

  const isEnglishSubject = useCallback(() => {
    const s = activeSubjects.find(s => toId(s.id) === formData.subject_id);
    return s?.name?.toLowerCase().includes('english') || false;
  }, [activeSubjects, formData.subject_id, toId]);

  const isUrduSubject = useCallback(() => {
    const s = activeSubjects.find(s => toId(s.id) === formData.subject_id);
    return s?.name?.toLowerCase().includes('urdu') || false;
  }, [activeSubjects, formData.subject_id, toId]);

  const isMathScienceSubject = useCallback(() => {
    const s = activeSubjects.find(s => toId(s.id) === formData.subject_id);
    const n = s?.name?.toLowerCase() || '';
    return n.includes('math') || n.includes('physics') || n.includes('chemistry') || n.includes('science');
  }, [activeSubjects, formData.subject_id, toId]);

  /* ══════════════════════════════════════════════════════════════════════
     TinyMCE configs
  ══════════════════════════════════════════════════════════════════════*/
  const sharedSetup = useCallback((editor: any) => { buildMathButton(editor); }, []);

  const englishEditorConfig = useMemo<any>(() => ({
    height: 300,
    menubar: true,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount',
    ],
    toolbar:
      'undo redo | blocks | bold italic underline strikethrough | ' +
      'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | mathformula | removeformat help',
    content_style: `
      body { font-family: Helvetica, Arial, sans-serif; font-size: 16px; }
      .katex-source { background: #fff8e1; border-radius: 3px; padding: 0 2px; }
    `,
    directionality: 'ltr',
    license_key: 'gpl',
    setup: sharedSetup,
    images_upload_url: '/api/upload',
    images_upload_handler: async (blobInfo: any) => {
      try {
        const fd = new FormData();
        fd.append('file', blobInfo.blob(), blobInfo.filename());
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        return data.location;
      } catch { return ''; }
    },
  }), [sharedSetup]);

  const urduEditorConfig = useMemo<any>(() => ({
    ...englishEditorConfig,
    content_style: `
      body {
        font-family: "Jameel Noori Nastaleeq","Noto Nastaliq Urdu",serif;
        font-size: 16pt; direction: rtl;
      }
    `,
    directionality: 'rtl',
    toolbar:
      'undo redo | blocks | bold italic underline strikethrough | ' +
      'forecolor backcolor | alignright aligncenter alignleft alignjustify | ' +
      'bullist numlist outdent indent | mathformula | removeformat help',
  }), [englishEditorConfig]);

  const englishOptionEditorConfig = useMemo<any>(() => ({
    ...englishEditorConfig,
    height: 130,
    menubar: false,
    toolbar: 'bold italic | mathformula | removeformat',
  }), [englishEditorConfig]);

  const urduOptionEditorConfig = useMemo<any>(() => ({
    ...urduEditorConfig,
    height: 130,
    menubar: false,
    toolbar: 'bold italic | mathformula | removeformat',
  }), [urduEditorConfig]);

  /* ── load lookups once on mount ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchLookups();
        if (!mounted) return;
        setLookupClasses(data.classes || []);
        setLookupSubjects(data.subjects || []);
        setLookupChapters(data.chapters || []);
        setLookupTopics(data.topics || []);
        setLookupClassSubjects(data.classSubjects || []);
        setLookupQuestionCategories(data.questionCategories || []);
      } catch (err) {
        console.error('Failed to load lookup data:', err);
      } finally {
        if (mounted) setLookupsReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const resetTextFields = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      ...EMPTY_TEXT_FIELDS,
      correct_option: prev.question_type === 'mcq' ? '' : prev.correct_option,
      passage_questions_count: 1,
    }));
  }, []);

  const translateToUrdu = useCallback(async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ur`);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText;
      return text;
    } catch { return text; }
  }, []);

  const handleTranslateAll = useCallback(async () => {
    if (isEnglishSubject() || isUrduSubject()) return;
    setIsTranslating(true);
    try {
      const updates: any = {};
      if (formData.question_text && !formData.question_text_ur) updates.question_text_ur = await translateToUrdu(formData.question_text);
      if (formData.question_type === 'mcq') {
        if (formData.option_a && !formData.option_a_ur) updates.option_a_ur = await translateToUrdu(formData.option_a);
        if (formData.option_b && !formData.option_b_ur) updates.option_b_ur = await translateToUrdu(formData.option_b);
        if (formData.option_c && !formData.option_c_ur) updates.option_c_ur = await translateToUrdu(formData.option_c);
        if (formData.option_d && !formData.option_d_ur) updates.option_d_ur = await translateToUrdu(formData.option_d);
      }
      if (formData.question_type !== 'mcq' && formData.answer_text && !formData.answer_text_ur) {
        updates.answer_text_ur = await translateToUrdu(formData.answer_text);
      }
      if (Object.keys(updates).length > 0) { setFormData(prev => ({ ...prev, ...updates })); toast.success('Translation completed'); }
      else toast('No fields need translation');
    } catch { toast.error('Failed to translate'); }
    finally { setIsTranslating(false); }
  }, [isEnglishSubject, isUrduSubject, formData, translateToUrdu]);

  /* ════════════════════════════════════════════════════════════════════
     EDIT-MODE HYDRATION
  ════════════════════════════════════════════════════════════════════*/
  useEffect(() => {
    if (!question) {
      hydratedForId.current = null;
      return;
    }
    if (!lookupsReady) return;
    const qid = toId(question.id);
    if (hydratedForId.current === qid) return;

    let poetryText = '', proseText = '', sentenceText = '', passageText = '', passageTextUr = '';
    let idiomPhrase = '', directSentence = '', indirectSentence = '', activeSentence = '';
    let darkhwastText = '', kahaniText = '', nasarText = '', summaryText = '';
    let passageQuestionText = '', passageQuestionTextUr = '';
    let storyText = '', storyTextUr = '';

    // Story specific extraction
    if (question.question_type === 'story') {
      storyText = question.question_text || '';
      storyTextUr = question.question_text_ur || '';
    }

    // For Urdu poetry/stanza/prose/gazal: we store the text in question_text_ur
    // For English stanza_explanation: we store text in question_text
    if (question.question_type === 'poetry_explanation' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس شعر کی تشریح کریں: (.*)/);
      poetryText = m ? m[1] : question.question_text_ur;
    } else if (question.question_type === 'stanza_explanation' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس بند کی تشریح کریں: (.*)/);
      poetryText = m ? m[1] : question.question_text_ur;
    } else if (question.question_type === 'gazal' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس غزل کی تشریح کریں: (.*)/);
      poetryText = m ? m[1] : question.question_text_ur;
    } else if (question.question_type === 'prose_explanation' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس نثر پارے کی تشریح کریں: (.*)/);
      proseText = m ? m[1] : question.question_text_ur;
    } else if (['sentence_correction', 'sentence_completion', 'punctuation'].includes(question.question_type) && question.question_text_ur) {
      const m = question.question_text_ur.match(/(درج ذیل جملے کو درست کریں|درج ذیل جملے کو مکمل کریں): (.*)/);
      sentenceText = m ? m[2] : question.question_text_ur;
    } else if (question.question_type === 'idiom_phrases' && question.question_text) {
      const m = question.question_text.match(/Idiom\/Phrase: (.*)/);
      idiomPhrase = m ? m[1] : question.question_text;
    } else if (question.question_type === 'directInDirect' && question.question_text) {
      directSentence = question.question_text.replace('Convert the following direct speech into indirect speech: ', '');
    } else if (question.question_type === 'activePassive' && question.question_text) {
      activeSentence = question.question_text.replace('Convert the following active voice into passive voice: ', '');
    } else if (question.question_type === 'application') {
      // Application questions - keep as-is
    } else if (question.question_type === 'letter') {
      // Letter questions
    } else if (question.question_type === 'mokalma') {
      // Mokalma questions
    } else if (question.question_type === 'Nasarkhulasa' && question.question_text_ur) {
      nasarText = question.question_text_ur || '';
    } else if (question.question_type === 'markziKhyal' && question.question_text_ur) {
      nasarText = question.question_text_ur || '';
    } else if (question.question_type === 'pair_of_words') {
      // Pair of words
    } else if (question.question_type === 'essay') {
      // Essay
    } else if (question.question_type === 'passage') {
      if (question.question_text) {
        const parts = question.question_text.split('\n\nQUESTION: ');
        passageText = parts[0] || ''; passageQuestionText = parts[1] || '';
      } else if (question.question_text_ur) {
        const parts = question.question_text_ur.split('\n\nQUESTION: ');
        passageTextUr = parts[0] || ''; passageQuestionTextUr = parts[1] || '';
      }
    } else if (question.question_type === 'summary' && question.question_text) summaryText = question.question_text;

    // Walk topic_id UP to chapter → class_subject → class/subject
    const embeddedChapter = question.topic?.chapter;
    const currentTopic = activeTopics.find(t => toId(t.id) === toId(question.topic_id));
    const chapterIdToFind = toId(embeddedChapter?.id) || toId(currentTopic?.chapter_id);
    const currentChapter =
      embeddedChapter ||
      activeChapters.find(c => toId(c.id) === chapterIdToFind) ||
      null;
    const classSubjectIdToFind = toId(embeddedChapter?.class_subject?.id) || toId(currentChapter?.class_subject_id);
    const classSubject =
      embeddedChapter?.class_subject ||
      activeClassSubjects.find(cs => toId(cs.id) === classSubjectIdToFind) ||
      null;

    const resolvedClassId = toId(classSubject?.class_id) || toId(embeddedChapter?.class_subject?.class?.id);
    const resolvedSubjectId = toId(classSubject?.subject_id) || toId(embeddedChapter?.class_subject?.subject?.id);
    const resolvedChapterId = toId(currentChapter?.id) || chapterIdToFind;
    const resolvedTopicId = toId(question.topic_id);

    hydratingRef.current = true;

    if (resolvedClassId) {
      setFilteredSubjects(
        activeSubjects.filter(s =>
          activeClassSubjects.some(cs => toId(cs.class_id) === resolvedClassId && toId(cs.subject_id) === toId(s.id))
        )
      );
    }
    if (resolvedClassId && resolvedSubjectId) {
      const cs = activeClassSubjects.find(c => toId(c.class_id) === resolvedClassId && toId(c.subject_id) === resolvedSubjectId);
      if (cs) {
        setFilteredChapters(
          activeChapters
            .filter(c => toId(c.class_subject_id) === toId(cs.id))
            .sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
        );
      }
    }
    if (resolvedChapterId) {
      const ts = activeTopics.filter(t => toId(t.chapter_id) === resolvedChapterId).sort(compareLabels);
      setFilteredTopics(ts.length ? ts : (currentTopic ? [currentTopic] : []));
    }

    // Filter question categories by type
    setFilteredQuestionCategories(
      activeQuestionCategories.filter(qc => qc.question_type === question.question_type && qc.is_active)
    );

    // For English stanza_explanation, we use question_text and answer_text directly.
    // For Urdu, we use the extracted poetryText etc. into question_text_ur and answer_text_ur.
    // In the generic case, we set question_text from question.question_text.
    const finalQuestionText = passageQuestionText || question.question_text || '';
    const finalQuestionTextUr = passageQuestionTextUr || question.question_text_ur || '';

    setFormData({
      question_text: finalQuestionText,
      question_text_ur: finalQuestionTextUr,
      option_a: question.option_a || '', option_b: question.option_b || '',
      option_c: question.option_c || '', option_d: question.option_d || '',
      option_a_ur: question.option_a_ur || '', option_b_ur: question.option_b_ur || '',
      option_c_ur: question.option_c_ur || '', option_d_ur: question.option_d_ur || '',
      correct_option: question.correct_option || '',
      class_id: resolvedClassId || '',
      subject_id: resolvedSubjectId || '',
      chapter_id: resolvedChapterId || '',
      topic_id: resolvedTopicId || '',
      difficulty: question.difficulty || 'medium',
      question_type: (question.question_type || 'mcq') as QuestionType,
      answer_text: question.answer_text || '',
      answer_text_ur: question.answer_text_ur || '',
      source_type: (question.source_type || 'book') as any,
      source_year: question.source_year ? String(question.source_year) : '',
      passage_text: passageText, passage_text_ur: passageTextUr,
      idiom_phrase: idiomPhrase, idiom_phrase_explanation: question.answer_text || '',
      poetry_text: poetryText, prose_text: proseText, sentence_text: sentenceText,
      direct_sentence: directSentence, indirect_sentence: indirectSentence,
      active_sentence: activeSentence, passive_sentence: '',
      darkhwast_text: darkhwastText, kahani_text: kahaniText,
      nasar_text: nasarText, summary_text: summaryText,
      passage_questions_count: 1,
      diagram: question.diagram || '',
      question_category_id: question.question_category_id || '',
      story_text: storyText,
      story_text_ur: storyTextUr,
    });

    hydratedForId.current = qid;

    const t = setTimeout(() => { hydratingRef.current = false; }, 0);
    return () => clearTimeout(t);
  }, [question, lookupsReady, activeChapters, activeClassSubjects, activeTopics, activeSubjects, activeQuestionCategories, compareLabels, toId]);

  /* ── Filter question categories when question_type changes ── */
  useEffect(() => {
    setFilteredQuestionCategories(
      activeQuestionCategories.filter(qc => qc.question_type === formData.question_type && qc.is_active)
    );
  }, [formData.question_type, activeQuestionCategories]);

  /* ── cascading dropdowns ── */
  useEffect(() => {
    if (hydratingRef.current) return;
    const classId = formData.class_id;
    if (classId) {
      const subs = activeSubjects.filter(s => activeClassSubjects.some(cs => toId(cs.class_id) === classId && toId(cs.subject_id) === toId(s.id)));
      setFilteredSubjects(subs);
      if (formData.subject_id && !subs.some(s => toId(s.id) === formData.subject_id))
        setFormData(p => ({ ...p, subject_id: '', chapter_id: '', topic_id: '' }));
    } else {
      setFilteredSubjects([]);
      if (formData.subject_id) setFormData(p => ({ ...p, subject_id: '', chapter_id: '', topic_id: '' }));
    }
  }, [activeClassSubjects, activeSubjects, formData.class_id, formData.subject_id, toId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    const { class_id, subject_id } = formData;
    if (class_id && subject_id) {
      const cs = activeClassSubjects.find(c => toId(c.class_id) === class_id && toId(c.subject_id) === subject_id);
      if (cs) {
        const chs = activeChapters.filter(c => toId(c.class_subject_id) === toId(cs.id)).sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0));
        setFilteredChapters(chs);
        if (formData.chapter_id && !chs.some(c => toId(c.id) === formData.chapter_id))
          setFormData(p => ({ ...p, chapter_id: '', topic_id: '' }));
      } else {
        setFilteredChapters([]);
        if (formData.chapter_id) setFormData(p => ({ ...p, chapter_id: '', topic_id: '' }));
      }
    } else {
      setFilteredChapters([]);
      if (formData.chapter_id) setFormData(p => ({ ...p, chapter_id: '', topic_id: '' }));
    }
  }, [activeChapters, activeClassSubjects, formData.class_id, formData.subject_id, formData.chapter_id, toId]);

  useEffect(() => {
    if (hydratingRef.current) return;
    let mounted = true;
    if (!formData.chapter_id) {
      setFilteredTopics([]);
      if (formData.topic_id) setFormData(p => ({ ...p, topic_id: '' }));
      return () => { mounted = false; };
    }

    const syncTopics = async () => {
      try {
        const data = await fetchTopicsByChapter(formData.chapter_id);
        if (!mounted || hydratingRef.current) return;
        setFilteredTopics((data || []).slice().sort(compareLabels));
        if (formData.topic_id && !(data || []).some((t: any) => toId(t.id) === formData.topic_id)) {
          setFormData(p => ({ ...p, topic_id: '' }));
        }
      } catch (err) {
        console.error('Failed to load topics for chapter:', err);
        if (!mounted || hydratingRef.current) return;
        const ts = activeTopics.filter(t => toId(t.chapter_id) === formData.chapter_id).sort(compareLabels);
        setFilteredTopics(ts);
        if (formData.topic_id && !ts.some(t => toId(t.id) === formData.topic_id)) {
          setFormData(p => ({ ...p, topic_id: '' }));
        }
      }
    };

    syncTopics();
    return () => { mounted = false; };
  }, [activeTopics, compareLabels, formData.chapter_id, formData.topic_id, toId]);

  /* ── category clean-up ── */
  useEffect(() => {
    if (hydratingRef.current) return;
    if (!formData.question_category_id) return;
    if (filteredQuestionCategories.some(qc => qc.id === formData.question_category_id)) return;
    setFormData(p => ({ ...p, question_category_id: '' }));
  }, [filteredQuestionCategories, formData.question_category_id]);

  /* ── submit ── */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const base = {
        topic_id: formData.topic_id || null,
        difficulty: formData.difficulty,
        question_type: formData.question_type,
        source_type: formData.source_type,
        source_year: formData.source_year ? parseInt(formData.source_year) : null,
        created_by: user?.id ?? null,
        diagram: formData.diagram || null,
        question_category_id: formData.question_category_id || null,
      };

      let specific: any = {};

      if (isEnglishSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            specific = {
              question_text: formData.question_text, question_text_ur: null,
              option_a: formData.option_a, option_b: formData.option_b,
              option_c: formData.option_c || null, option_d: formData.option_d || null,
              option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null,
              correct_option: formData.correct_option, answer_text: null, answer_text_ur: null,
            }; break;
          case 'short': case 'long':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'translate_urdu':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'translate_english':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'idiom_phrases':
            specific = { question_text: formData.idiom_phrase, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'passage':
            specific = { question_text: `${formData.passage_text}\n\nQUESTION: ${formData.question_text}`, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'directInDirect':
            specific = { question_text: formData.direct_sentence, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'activePassive':
            specific = { question_text: formData.active_sentence, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'summary':
            specific = { question_text: formData.summary_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'essay':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'application': case 'letter': case 'punctuation': case 'pair_of_words':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'story':
            specific = {
              question_text: formData.story_text,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null, option_b: null, option_c: null, option_d: null,
              option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null,
              correct_option: null,
            };
            break;
          case 'stanza_explanation':
            // ✅ store stanza in question_text, explanation in answer_text
            specific = {
              question_text: formData.question_text,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null, option_b: null, option_c: null, option_d: null,
              option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null,
              correct_option: null,
            };
            break;
          // You can add poetry_explanation, prose_explanation, etc. for English if needed
        }
      } else if (isUrduSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: formData.option_a_ur, option_b_ur: formData.option_b_ur, option_c_ur: formData.option_c_ur || null, option_d_ur: formData.option_d_ur || null, correct_option: formData.correct_option, answer_text: null, answer_text_ur: null }; break;
          case 'poetry_explanation': case 'stanza_explanation': case 'gazal':
            specific = { question_text: null, question_text_ur: formData.poetry_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'prose_explanation':
            specific = { question_text: null, question_text_ur: formData.prose_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'short': case 'long':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'sentence_correction': case 'sentence_completion': case 'punctuation':
            specific = { question_text: null, question_text_ur: formData.sentence_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'passage':
            specific = { question_text: null, question_text_ur: `${formData.passage_text_ur}\n\nQUESTION: ${formData.question_text_ur}`, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'mokalma':
            specific = { question_text: null, question_text_ur: formData.kahani_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'Nasarkhulasa': case 'markziKhyal':
            specific = { question_text: null, question_text_ur: formData.nasar_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'application': case 'letter': case 'essay':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'story':
            specific = {
              question_text: null,
              question_text_ur: formData.story_text_ur,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null, option_b: null, option_c: null, option_d: null,
              option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null,
              correct_option: null,
            };
            break;
        }
      } else {
        switch (formData.question_type) {
          case 'mcq':
            specific = { question_text: formData.question_text, question_text_ur: formData.question_text_ur, option_a: formData.option_a, option_b: formData.option_b, option_c: formData.option_c || null, option_d: formData.option_d || null, option_a_ur: formData.option_a_ur || null, option_b_ur: formData.option_b_ur || null, option_c_ur: formData.option_c_ur || null, option_d_ur: formData.option_d_ur || null, correct_option: formData.correct_option, answer_text: null, answer_text_ur: null }; break;
          case 'short': case 'long':
            specific = { question_text: formData.question_text, question_text_ur: formData.question_text_ur, answer_text: formData.answer_text, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
        }
      }

      const payload = { ...base, ...specific };

      if (question) {
        await updateQuestion(String(question.id), payload);
        toast.success('Question updated successfully');
        // ✅ Keep form open – do NOT call onClose()
      } else {
        await createQuestion(payload);
        toast.success('Question added successfully');
        resetTextFields(); // clear for next new question
        // ✅ Keep form open – do NOT call onClose()
      }
      // ❌ Removed: onClose();
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast.error(error.message || 'Failed to save question');
    } finally { setLoading(false); }
  }, [formData, isEnglishSubject, isUrduSubject, question, resetTextFields, onClose]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleEditorChange = useCallback((content: string, fieldName: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: content }));
  }, []);

  const getAvailableQuestionTypes = useCallback(() => {
    if (isEnglishSubject()) return [
      { value: 'mcq', label: 'Multiple Choice' },
      { value: 'short', label: 'Short Answer' },
      { value: 'long', label: 'Long Answer' },
      { value: 'translate_urdu', label: 'Translate into Urdu' },
      { value: 'translate_english', label: 'Translate into English' },
      { value: 'idiom_phrases', label: 'Idiom/Phrases' },
      { value: 'passage', label: 'Passage and Questions' },
      { value: 'directInDirect', label: 'Direct In Direct' },
      { value: 'activePassive', label: 'Active Voice / Passive Voice' },
      { value: 'summary', label: 'Summary' },
      { value: 'essay', label: 'Essay' },
      { value: 'application', label: 'Application' },
      { value: 'letter', label: 'Letter' },
      { value: 'punctuation', label: 'Punctuation' },
      { value: 'pair_of_words', label: 'Pair of Words' },
      { value: 'story', label: 'Story Writing' },
      { value: 'stanza_explanation', label: 'Stanza Explanation' },
    ];
    if (isUrduSubject()) return [
      // ✅ All labels in English
      { value: 'mcq', label: 'MCQ' },
      { value: 'poetry_explanation', label: 'Poetry Explanation' },
      { value: 'stanza_explanation', label: 'Stanza Explanation' },
      { value: 'prose_explanation', label: 'Prose Explanation' },
      { value: 'gazal', label: 'Ghazal' },
      { value: 'short', label: 'Short Answer' },
      { value: 'long', label: 'Long Answer' },
      { value: 'sentence_correction', label: 'Sentence Correction' },
      { value: 'sentence_completion', label: 'Sentence Completion' },
      { value: 'passage', label: 'Passage & Questions' },
      { value: 'mokalma', label: 'Mokalma' },
      { value: 'Nasarkhulasa', label: 'Nasar Khulasa' },
      { value: 'markziKhyal', label: 'Markzi Khyal' },
      { value: 'application', label: 'Application' },
      { value: 'letter', label: 'Letter' },
      { value: 'essay', label: 'Essay' },
      { value: 'story', label: 'Story Writing' },
    ];
    return [
      { value: 'mcq', label: 'Multiple Choice' },
      { value: 'short', label: 'Short Answer' },
      { value: 'long', label: 'Long Answer' },
    ];
  }, [isEnglishSubject, isUrduSubject]);

  const shouldShowQuestionTextField = useCallback(() => {
    if (isEnglishSubject()) return !['translate_urdu', 'translate_english', 'idiom_phrases', 'directInDirect', 'activePassive', 'passage', 'summary', 'story'].includes(formData.question_type);
    if (isUrduSubject()) return ['mcq', 'short', 'long', 'essay', 'application', 'letter'].includes(formData.question_type);
    return true;
  }, [isEnglishSubject, isUrduSubject, formData.question_type]);

  /* ══════════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════════*/
  return (
    <form onSubmit={handleSubmit} className="qfm-form">
      <style>{`
        :root {
          --qfm-navy: #101935;
          --qfm-accent: #2f4fe0;
          --qfm-accent-soft: #eef1ff;
          --qfm-border: #e6e8f1;
          --qfm-text: #15192b;
          --qfm-muted: #686f8c;
          --qfm-bg: #f8f9fc;
          --qfm-font: 'Lexend','Inter',system-ui,sans-serif;
        }
        .qfm-form { font-size: .92rem; font-family: var(--qfm-font); color: var(--qfm-text); }

        .qfm-section-title {
          font-size: .76rem; font-weight: 750; text-transform: uppercase;
          letter-spacing: .07em; color: var(--qfm-muted); margin: 0 0 14px;
          display: flex; align-items: center; gap: 9px;
        }
        .qfm-section-title::before {
          content: ''; width: 5px; height: 5px; border-radius: 50%;
          background: var(--qfm-accent); flex-shrink: 0;
        }
        .qfm-section-title::after { content: ''; flex: 1; height: 1px; background: var(--qfm-border); }
        .qfm-section {
          margin-bottom: 22px; padding: 18px; background: var(--qfm-bg);
          border: 1px solid var(--qfm-border); border-radius: 14px;
        }

        .qfm-label { font-size: .81rem; font-weight: 600; color: var(--qfm-text); margin-bottom: 6px; display: block; }
        .qfm-label.urdu-label { text-align: right; direction: rtl; font-family: "Jameel Noori Nastaleeq","Noto Nastaliq Urdu",serif; font-size: .96rem; }

        .qfm-hint {
          font-size: .8rem; color: var(--qfm-accent); background: var(--qfm-accent-soft); border: 1px solid #d7deff;
          border-radius: 11px; padding: 10px 14px; margin-bottom: 20px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
        }
        .qfm-hint code { background: #fff; border: 1px solid #d7deff; padding: 1px 6px; border-radius: 6px; font-size: .76rem; }

        .qfm-field-group { margin-bottom: 18px; }
        .qfm-math-hint { font-size: .74rem; color: var(--qfm-muted); margin-top: 6px; }
        .qfm-math-hint code { background: #eef0f6; padding: 1px 5px; border-radius: 4px; font-size: .72rem; }

        .qfm-preview-wrap { margin-top: 9px; }
        .qfm-preview-label {
          font-size: .68rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: #9197ad; margin-bottom: 5px; display: block;
        }
        .qfm-preview-box {
          padding: 11px 14px; background: #fff; border: 1px solid var(--qfm-border);
          border-radius: 10px; word-break: break-word;
        }
        .qfm-preview-en { font-size: .9rem; line-height: 1.6; }
        .qfm-preview-ur {
          font-size: 1rem; line-height: 1.9;
          font-family: "Jameel Noori Nastaleeq","Noto Nastaliq Urdu",serif;
        }
        .qfm-preview-box [dir="rtl"] .katex,
        .qfm-preview-box[dir="rtl"] .katex,
        .qfm-preview-box .katex-display { direction: ltr !important; display: inline-block; unicode-bidi: embed; vertical-align: middle; }
        .qfm-preview-box .katex-display { display: block; text-align: center; }
        .qfm-preview-box .katex .mord.text,
        .qfm-preview-box .katex .mord.text .mord {
          font-family: "Jameel Noori Nastaleeq","Noto Nastaliq Urdu","Urdu Typesetting",serif !important;
          font-size: 1.15em; line-height: 1.6;
        }

        .qfm-option-card {
          border: 1px solid var(--qfm-border); border-radius: 12px; padding: 13px 15px;
          background: #fff; height: 100%;
        }
        .qfm-correct-card {
          border: 1.5px solid #d7deff; border-radius: 12px; padding: 15px 17px;
          background: var(--qfm-accent-soft); margin-top: 6px;
        }

        .qfm-footer-bar {
          display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
          padding-top: 18px; margin-top: 4px; border-top: 1px solid var(--qfm-border);
          position: sticky; bottom: -22px; background: #fff;
        }

        .qfm-diagram-preview {
          max-width: 200px; max-height: 150px; border-radius: 10px;
          border: 1px solid var(--qfm-border); margin-top: 9px;
        }

        /* form control overrides */
        .qfm-form .form-select, .qfm-form .form-control {
          border: 1.5px solid var(--qfm-border); border-radius: 9px;
          font-size: .85rem; padding: 9px 12px; font-family: var(--qfm-font);
          color: var(--qfm-text); background-color: #fff;
          transition: border-color .15s, box-shadow .15s;
        }
        .qfm-form .form-select:focus, .qfm-form .form-control:focus {
          border-color: var(--qfm-accent); box-shadow: 0 0 0 3px rgba(47,79,224,.12); outline: none;
        }
        .qfm-form .form-select:disabled, .qfm-form .form-control:disabled { background-color: #f1f2f7; opacity: .7; }
        .qfm-form .btn {
          font-family: var(--qfm-font); font-weight: 650; font-size: .84rem;
          border-radius: 10px; padding: 9px 18px; border: none; transition: all .15s;
        }
        .qfm-form .btn-primary { background: var(--qfm-accent); color: #fff; }
        .qfm-form .btn-primary:hover:not(:disabled) { background: #2540bf; }
        .qfm-form .btn-primary:disabled { opacity: .55; }
        .qfm-form .btn-secondary { background: #eef0f6; color: var(--qfm-text); }
        .qfm-form .btn-secondary:hover:not(:disabled) { background: #e3e6ee; }
        .qfm-form .btn-outline-primary { background: transparent; color: var(--qfm-accent); border: 1.5px solid #c7d2ff; }
        .qfm-form .btn-outline-primary:hover:not(:disabled) { background: var(--qfm-accent-soft); }

        .qfm-form .text-success { color: #1d8a52 !important; font-size: .76rem; }

        @media (max-width: 576px) {
          .qfm-section { padding: 14px; border-radius: 12px; }
          .qfm-footer-bar { justify-content: stretch; position: static; }
          .qfm-footer-bar > button { flex: 1; }
          .qfm-hint { font-size: .77rem; }
        }
      `}</style>

      <div className="qfm-hint">
        <strong>Math formulas:</strong>
        <span>Use <code>\( x^2 \)</code> for inline and <code>\[ \frac{'{a}'}{'{b}'} \]</code> for display math, or click the <strong>f(x)</strong> toolbar button.</span>
      </div>

      <div className="qfm-section">
        <p className="qfm-section-title">Question Configuration</p>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="qfm-label">Class *</label>
            <select className="form-select" name="class_id" value={formData.class_id} onChange={handleChange} required>
              <option value="">Select Class</option>
              {activeClasses.map(c => <option key={toId(c.id)} value={toId(c.id)}>{c.name}{c.description ? ` — ${c.description}` : ''}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="qfm-label">Subject *</label>
            <select className="form-select" name="subject_id" value={formData.subject_id} onChange={handleChange} required disabled={!formData.class_id}>
              <option value="">Select Subject</option>
              {filteredSubjects.map(s => <option key={toId(s.id)} value={toId(s.id)}>{s.name}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className={`qfm-label ${isUrduSubject() ? 'urdu-label' : ''}`}>{isUrduSubject() ? 'چیپٹر' : 'Chapter'}</label>
            <select className="form-select" name="chapter_id" value={formData.chapter_id} onChange={handleChange} disabled={!formData.class_id || !formData.subject_id}>
              <option value="">{isUrduSubject() ? 'چیپٹر کا انتخاب کریں' : 'Select Chapter'}</option>
              {filteredChapters.map(c => (
                <option key={toId(c.id)} value={toId(c.id)}>{c.chapterNo ?? '?'}-{c.name}</option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className={`qfm-label ${isUrduSubject() ? 'urdu-label' : ''}`}>{isUrduSubject() ? 'موضوع' : 'Topic'}</label>
            <select className="form-select" name="topic_id" value={formData.topic_id} onChange={handleChange} disabled={!formData.chapter_id}>
              <option value="">{isUrduSubject() ? 'موضوع کا انتخاب کریں' : 'Select Topic'}</option>
              {filteredTopics.map(t => <option key={toId(t.id)} value={toId(t.id)}>{t.name}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="qfm-label">Question Type *</label>
            <select className="form-select" name="question_type" value={formData.question_type} onChange={handleChange} required>
              <option value="">Select Question Type</option>
              {getAvailableQuestionTypes().map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isMathScienceSubject() && <small className="text-success d-block mt-1">Math/Science: use f(x) button for formulas</small>}
          </div>

          <div className="col-md-6">
            <label className="qfm-label">Question Category</label>
            <select
              className="form-select"
              name="question_category_id"
              value={formData.question_category_id}
              onChange={handleChange}
            >
              <option value="">Select Category (optional)</option>
              {filteredQuestionCategories
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(qc => (
                  <option key={qc.id} value={qc.id}>
                    {qc.label_en}{qc.label_ur ? ` — ${qc.label_ur}` : ''}
                  </option>
                ))
              }
            </select>
          </div>

          <div className="col-md-6">
            <label className="qfm-label">Difficulty *</label>
            <select className="form-select" name="difficulty" value={formData.difficulty} onChange={handleChange} required>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="qfm-label">Source Type *</label>
            <select className="form-select" name="source_type" value={formData.source_type} onChange={handleChange} required>
              <option value="book">Book</option>
              <option value="past_paper">Past Paper</option>
              <option value="model_paper">Model Paper</option>
              <option value="custom">Custom</option>
              <option value="conceptual">Conceptual</option>
            </select>
          </div>

          {['past_paper', 'model_paper'].includes(formData.source_type) && (
            <div className="col-md-6">
              <label className="qfm-label">Year</label>
              <input type="number" className="form-control" name="source_year" value={formData.source_year} onChange={handleChange} min="1900" max={new Date().getFullYear()} />
            </div>
          )}

          <div className="col-md-12">
            <label className="qfm-label">Diagram URL</label>
            <input
              type="url"
              className="form-control"
              name="diagram"
              value={formData.diagram}
              onChange={handleChange}
              placeholder="https://example.com/diagram.png"
            />
            {formData.diagram && (
              <img
                src={formData.diagram}
                alt="Diagram preview"
                className="qfm-diagram-preview"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Question Content ── */}
      <div className="qfm-section">
        <p className="qfm-section-title">Question Content</p>
        <div className="row g-3">

          {/* ── ENGLISH ── */}
          {isEnglishSubject() && (
            <>
              {shouldShowQuestionTextField() && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">
                    {formData.question_type === 'stanza_explanation' ? 'Stanza Text *' : 'Question Text (English) *'}
                  </label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                  <p className="qfm-math-hint">Tip: click <strong>f(x)</strong> or type <code>\( formula \)</code> for inline math</p>
                </div>
              )}
              {formData.question_type === 'translate_urdu' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">English Text to Translate *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                </div>
              )}
              {formData.question_type === 'translate_english' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Urdu Text to Translate *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                </div>
              )}
              {formData.question_type === 'idiom_phrases' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Idiom/Phrase (English) *</label>
                  <textarea className="form-control" name="idiom_phrase" value={formData.idiom_phrase} onChange={handleChange} required placeholder="e.g., 'Break a leg'" rows={3} />
                </div>
              )}
              {formData.question_type === 'story' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Story Title / Prompt (English) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.story_text} onEditorChange={c => handleEditorChange(c, 'story_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.story_text} label="Preview" />
                </div>
              )}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-12 qfm-field-group">
                    <label className="qfm-label">Passage Text (English) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.passage_text} onEditorChange={c => handleEditorChange(c, 'passage_text')} init={englishEditorConfig} />
                    <PreviewBox html={formData.passage_text} label="Passage preview" />
                  </div>
                  <div className="col-12 qfm-field-group">
                    <label className="qfm-label">Question about Passage (English) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                    <PreviewBox html={formData.question_text} label="Question preview" />
                  </div>
                </>
              )}
              {formData.question_type === 'directInDirect' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Direct Speech Sentence *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.direct_sentence} onEditorChange={c => handleEditorChange(c, 'direct_sentence')} init={englishEditorConfig} />
                  <PreviewBox html={formData.direct_sentence} label="Preview" />
                </div>
              )}
              {formData.question_type === 'activePassive' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Active Voice Sentence *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.active_sentence} onEditorChange={c => handleEditorChange(c, 'active_sentence')} init={englishEditorConfig} />
                  <PreviewBox html={formData.active_sentence} label="Preview" />
                </div>
              )}
              {formData.question_type === 'summary' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Text to Summarize *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.summary_text} onEditorChange={c => handleEditorChange(c, 'summary_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.summary_text} label="Preview" />
                </div>
              )}
              {['essay', 'application', 'letter', 'punctuation', 'pair_of_words'].includes(formData.question_type) && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Question Text (English) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                </div>
              )}
            </>
          )}

          {/* ── URDU ── */}
          {isUrduSubject() && (
            <>
              {formData.question_type === 'mcq' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">سوال (اردو) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.question_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'poetry_explanation' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">شعر *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.poetry_text} onEditorChange={c => handleEditorChange(c, 'poetry_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.poetry_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'stanza_explanation' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">بند *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.poetry_text} onEditorChange={c => handleEditorChange(c, 'poetry_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.poetry_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'gazal' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">غزل *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.poetry_text} onEditorChange={c => handleEditorChange(c, 'poetry_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.poetry_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'prose_explanation' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">نثر پارہ *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.prose_text} onEditorChange={c => handleEditorChange(c, 'prose_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.prose_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {(formData.question_type === 'short' || formData.question_type === 'long') && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">سوال *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.question_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {(formData.question_type === 'sentence_correction' || formData.question_type === 'sentence_completion' || formData.question_type === 'punctuation') && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">
                    {formData.question_type === 'sentence_correction' ? 'جملہ (درستگی کے لیے) *' :
                     formData.question_type === 'sentence_completion' ? 'جملہ (تکمیل کے لیے) *' :
                     'جملہ (اوقاف کے لیے) *'}
                  </label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.sentence_text} onEditorChange={c => handleEditorChange(c, 'sentence_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.sentence_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-12 qfm-field-group">
                    <label className="qfm-label urdu-label">نثر پارہ (پاسج) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.passage_text_ur} onEditorChange={c => handleEditorChange(c, 'passage_text_ur')} init={urduEditorConfig} />
                    <PreviewBox html={formData.passage_text_ur} dir="rtl" label="پاسج پیش نظارہ" />
                  </div>
                  <div className="col-12 qfm-field-group">
                    <label className="qfm-label urdu-label">سوال (پاسج کے بارے میں) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                    <PreviewBox html={formData.question_text_ur} dir="rtl" label="سوال پیش نظارہ" />
                  </div>
                </>
              )}
              {formData.question_type === 'mokalma' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">مکالمہ کا متن *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.kahani_text} onEditorChange={c => handleEditorChange(c, 'kahani_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.kahani_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {(formData.question_type === 'Nasarkhulasa' || formData.question_type === 'markziKhyal') && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">{formData.question_type === 'Nasarkhulasa' ? 'نثر خلاصہ *' : 'مرکزی خیال *'}</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.nasar_text} onEditorChange={c => handleEditorChange(c, 'nasar_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.nasar_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {['essay', 'application', 'letter'].includes(formData.question_type) && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">
                    {formData.question_type === 'essay' ? 'مضمون *' :
                     formData.question_type === 'application' ? 'درخواست *' : 'خط *'}
                  </label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.question_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'story' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">کہانی / عنوان (اردو) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.story_text_ur} onEditorChange={c => handleEditorChange(c, 'story_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.story_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
            </>
          )}

          {/* ── OTHER (bilingual) ── */}
          {!isEnglishSubject() && !isUrduSubject() && (
            <>
              <div className="col-12 qfm-field-group">
                <label className="qfm-label">Question Text (English) *</label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                <PreviewBox html={formData.question_text} label="English preview" />
                <p className="qfm-math-hint">Tip: click <strong>f(x)</strong> or type <code>\( formula \)</code></p>
              </div>
              <div className="col-12 qfm-field-group">
                <label className="qfm-label">Question Text (Urdu)</label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                <PreviewBox html={formData.question_text_ur} dir="rtl" label="Urdu preview" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── MCQ Options ── */}
      {formData.question_type === 'mcq' && (
        <div className="qfm-section">
          <p className="qfm-section-title">{isUrduSubject() ? 'آپشنز' : 'Answer Options'}</p>
          <div className="row g-3">
            {(isEnglishSubject() || (!isEnglishSubject() && !isUrduSubject())) && (['a', 'b', 'c', 'd'] as const).map(opt => {
              const key = `option_${opt}` as keyof typeof formData;
              const required = opt === 'a' || opt === 'b';
              return (
                <div className="col-12 col-md-6" key={opt}>
                  <div className="qfm-option-card">
                    <label className="qfm-label">Option {opt.toUpperCase()} (English){required ? ' *' : ''}</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={englishOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} />
                  </div>
                </div>
              );
            })}
            {!isEnglishSubject() && !isUrduSubject() && (['a', 'b', 'c', 'd'] as const).map(opt => {
              const key = `option_${opt}_ur` as keyof typeof formData;
              return (
                <div className="col-12 col-md-6" key={`ur-${opt}`}>
                  <div className="qfm-option-card">
                    <label className="qfm-label">Option {opt.toUpperCase()} (Urdu)</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={urduOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} dir="rtl" />
                  </div>
                </div>
              );
            })}
            {isUrduSubject() && (['a', 'b', 'c', 'd'] as const).map(opt => {
              const key = `option_${opt}_ur` as keyof typeof formData;
              const labels: any = { a: 'آپشن اے', b: 'آپشن بی', c: 'آپشن سی', d: 'آپشن ڈی' };
              const required = opt === 'a' || opt === 'b';
              return (
                <div className="col-12 col-md-6" key={opt}>
                  <div className="qfm-option-card">
                    <label className="qfm-label urdu-label">{labels[opt]} (اردو){required ? ' *' : ''}</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={urduOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} dir="rtl" />
                  </div>
                </div>
              );
            })}
            <div className="col-12">
              <div className="qfm-correct-card">
                {isUrduSubject() ? (
                  <>
                    <label className="qfm-label urdu-label" style={{ textAlign: 'right', width: '100%' }}>صحیح آپشن منتخب کریں *</label>
                    <select className="form-select" name="correct_option" value={formData.correct_option} onChange={handleChange} required dir="rtl">
                      <option value="">صحیح آپشن منتخب کریں</option>
                      <option value="A">آپشن اے</option>
                      <option value="B">آپشن بی</option>
                      {formData.option_c_ur && <option value="C">آپشن سی</option>}
                      {formData.option_d_ur && <option value="D">آپشن ڈی</option>}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="qfm-label">Correct Option *</label>
                    <select className="form-select" name="correct_option" value={formData.correct_option} onChange={handleChange} required>
                      <option value="">Select correct option</option>
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      {formData.option_c && <option value="C">Option C</option>}
                      {formData.option_d && <option value="D">Option D</option>}
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Answer fields for non-MCQ ── */}
      {formData.question_type !== 'mcq' && (
        <div className="qfm-section">
          <p className="qfm-section-title">{isUrduSubject() ? 'جواب' : 'Answer'}</p>
          <div className="row g-3">
            {isEnglishSubject() && (
              <div className="col-12 qfm-field-group">
                <label className="qfm-label">
                  {formData.question_type === 'stanza_explanation' ? 'Explanation *' : 'Answer (English) *'}
                </label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text} onEditorChange={c => handleEditorChange(c, 'answer_text')} init={englishEditorConfig} />
                <PreviewBox html={formData.answer_text} label="Answer preview" />
              </div>
            )}
            {isUrduSubject() && (
              <div className="col-12 qfm-field-group">
                <label className="qfm-label urdu-label">جواب (اردو) *</label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text_ur} onEditorChange={c => handleEditorChange(c, 'answer_text_ur')} init={urduEditorConfig} />
                <PreviewBox html={formData.answer_text_ur} dir="rtl" label="جواب پیش نظارہ" />
              </div>
            )}
            {!isEnglishSubject() && !isUrduSubject() && (
              <>
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Answer (English) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text} onEditorChange={c => handleEditorChange(c, 'answer_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.answer_text} label="Answer preview" />
                </div>
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label">Answer (Urdu)</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text_ur} onEditorChange={c => handleEditorChange(c, 'answer_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.answer_text_ur} dir="rtl" label="Urdu answer preview" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="qfm-footer-bar">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        {!isEnglishSubject() && !isUrduSubject() && (
          <button type="button" className="btn btn-outline-primary" onClick={handleTranslateAll} disabled={isTranslating || loading}>
            {isTranslating ? 'Translating…' : 'Translate to Urdu'}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading || isTranslating}>
          {loading ? 'Saving…' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}
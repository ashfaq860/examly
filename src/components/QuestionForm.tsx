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
interface QuestionFormProps {
  question?: any;
  classes: any[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  classSubjects: any[];
  onClose: () => void;
}

type QuestionType =
  | 'mcq' | 'short' | 'long'
  | 'translate_urdu' | 'translate_english' | 'idiom_phrases' | 'passage'
  | 'poetry_explanation' | 'prose_explanation' | 'sentence_correction'
  | 'sentence_completion' | 'directInDirect' | 'activePassive'
  | 'darkhwast_khat' | 'kahani_makalma' | 'Nasarkhulasa_markziKhyal'
  | 'gazal' | 'summary';

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
};

/* ═══════════════════════════════════════════════════════════════════════════
   QuestionForm
═══════════════════════════════════════════════════════════════════════════*/
export default function QuestionForm({
  question, classes, subjects, chapters, topics, classSubjects, onClose,
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
  // True once the form's own fetchLookups() call has resolved. Edit-mode
  // hydration waits for this so the topic→chapter→subject→class walk has
  // real data to work with, instead of racing against an empty array.
  const [lookupsReady, setLookupsReady] = useState(false);

  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Guards the cascading class→subject→chapter→topic effects from wiping
  // out fields that hydration just set together as a group. Without this,
  // setting class_id during hydration immediately triggers the "clear
  // subject/chapter/topic if they don't belong to this class" effect,
  // because filteredSubjects/filteredChapters haven't been recomputed yet
  // on that same render pass.
  const hydratingRef = useRef(false);
  // Tracks which question.id we've already hydrated, so the effect doesn't
  // re-run (and doesn't need lookup arrays in its dependency list).
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
     Runs once lookups are ready, and only once per question.id. Sets
     class/subject/chapter/topic + all text fields together in a single
     setFormData call, guarded by hydratingRef so the cascading-filter
     effects below don't immediately clear what we just set.
  ════════════════════════════════════════════════════════════════════*/
  useEffect(() => {
    if (!question) {
      // Switching to "Add" mode (no question) — allow future edits to hydrate again.
      hydratedForId.current = null;
      return;
    }
    if (!lookupsReady) return;
    const qid = toId(question.id);
    if (hydratedForId.current === qid) return; // already hydrated for this question

    let poetryText = '', proseText = '', sentenceText = '', passageText = '', passageTextUr = '';
    let idiomPhrase = '', directSentence = '', indirectSentence = '', activeSentence = '';
    let darkhwastText = '', kahaniText = '', nasarText = '', summaryText = '';
    let passageQuestionText = '', passageQuestionTextUr = '';

    if (question.question_type === 'poetry_explanation' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس شعر کی تشریح کریں: (.*)/);
      poetryText = m ? m[1] : question.question_text_ur;
    } else if (question.question_type === 'gazal' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس غزل کی تشریح کریں: (.*)/);
      poetryText = m ? m[1] : question.question_text_ur;
    } else if (question.question_type === 'prose_explanation' && question.question_text_ur) {
      const m = question.question_text_ur.match(/اس نثر پارے کی تشریح کریں: (.*)/);
      proseText = m ? m[1] : question.question_text_ur;
    } else if (['sentence_correction', 'sentence_completion'].includes(question.question_type) && question.question_text_ur) {
      const m = question.question_text_ur.match(/(درج ذیل جملے کو درست کریں|درج ذیل جملے کو مکمل کریں): (.*)/);
      sentenceText = m ? m[2] : question.question_text_ur;
    } else if (question.question_type === 'idiom_phrases' && question.question_text) {
      const m = question.question_text.match(/Idiom\/Phrase: (.*)/);
      idiomPhrase = m ? m[1] : question.question_text;
    } else if (question.question_type === 'directInDirect' && question.question_text) {
      directSentence = question.question_text.replace('Convert the following direct speech into indirect speech: ', '');
    } else if (question.question_type === 'activePassive' && question.question_text) {
      activeSentence = question.question_text.replace('Convert the following active voice into passive voice: ', '');
    } else if (question.question_type === 'darkhwast_khat') darkhwastText = question.question_text_ur || '';
    else if (question.question_type === 'kahani_makalma') kahaniText = question.question_text_ur || '';
    else if (question.question_type === 'Nasarkhulasa_markziKhyal') nasarText = question.question_text_ur || '';
    else if (question.question_type === 'passage') {
      if (question.question_text) {
        const parts = question.question_text.split('\n\nQUESTION: ');
        passageText = parts[0] || ''; passageQuestionText = parts[1] || '';
      } else if (question.question_text_ur) {
        const parts = question.question_text_ur.split('\n\nQUESTION: ');
        passageTextUr = parts[0] || ''; passageQuestionTextUr = parts[1] || '';
      }
    } else if (question.question_type === 'summary' && question.question_text) summaryText = question.question_text;

    // Walk topic_id UP to chapter → class_subject → class/subject.
    // Prefer the topic_id's own embedded chapter (if the API already joined
    // it, e.g. question.topic?.chapter) before falling back to the lookup
    // table walk — this makes hydration work even if lookups are thin.
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

    // Pre-seed the cascading dropdown lists synchronously so the selects
    // are populated on the very first paint, instead of waiting one extra
    // render for the cascading effects to catch up.
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

    setFormData({
      question_text: passageQuestionText || question.question_text || '',
      question_text_ur: passageQuestionTextUr || question.question_text_ur || '',
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
    });

    hydratedForId.current = qid;

    // Release the guard on the next tick, after the cascading effects have
    // had a chance to see the already-correct values and become no-ops.
    const t = setTimeout(() => { hydratingRef.current = false; }, 0);
    return () => clearTimeout(t);
  }, [question, lookupsReady, activeChapters, activeClassSubjects, activeTopics, activeSubjects, compareLabels, toId]);

  /* ── cascading dropdowns (user-driven changes only — see hydratingRef guard) ── */
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
        }
      } else if (isUrduSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: formData.option_a_ur, option_b_ur: formData.option_b_ur, option_c_ur: formData.option_c_ur || null, option_d_ur: formData.option_d_ur || null, correct_option: formData.correct_option, answer_text: null, answer_text_ur: null }; break;
          case 'poetry_explanation': case 'gazal':
            specific = { question_text: null, question_text_ur: formData.poetry_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'prose_explanation':
            specific = { question_text: null, question_text_ur: formData.prose_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'short': case 'long':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'sentence_correction': case 'sentence_completion':
            specific = { question_text: null, question_text_ur: formData.sentence_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'passage':
            specific = { question_text: null, question_text_ur: `${formData.passage_text_ur}\n\nQUESTION: ${formData.question_text_ur}`, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'darkhwast_khat':
            specific = { question_text: null, question_text_ur: formData.darkhwast_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'kahani_makalma':
            specific = { question_text: null, question_text_ur: formData.kahani_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
          case 'Nasarkhulasa_markziKhyal':
            specific = { question_text: null, question_text_ur: formData.nasar_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a: null, option_b: null, option_c: null, option_d: null, option_a_ur: null, option_b_ur: null, option_c_ur: null, option_d_ur: null, correct_option: null }; break;
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
      } else {
        await createQuestion(payload);
        toast.success('Question added successfully');
        resetTextFields();
      }
      onClose();
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
    ];
    if (isUrduSubject()) return [
      { value: 'mcq', label: 'MCQ (اردو)' },
      { value: 'poetry_explanation', label: 'اشعار کی تشریح' },
      { value: 'prose_explanation', label: 'نثرپاروں کی تشریح' },
      { value: 'gazal', label: 'غزل' },
      { value: 'short', label: 'مختصر سوالات' },
      { value: 'long', label: 'تفصیلی جوابات' },
      { value: 'sentence_correction', label: 'جملوں کی درستگی' },
      { value: 'sentence_completion', label: 'جملوں کی تکمیل' },
      { value: 'passage', label: 'نثر پارہ اور سوالات' },
      { value: 'darkhwast_khat', label: 'درخواست / خط' },
      { value: 'kahani_makalma', label: 'کہانی / مکالمہ' },
      { value: 'Nasarkhulasa_markziKhyal', label: 'نثر / خلاصہ / مرکزی خیال' },
    ];
    return [
      { value: 'mcq', label: 'Multiple Choice' },
      { value: 'short', label: 'Short Answer' },
      { value: 'long', label: 'Long Answer' },
    ];
  }, [isEnglishSubject, isUrduSubject]);

  const shouldShowQuestionTextField = useCallback(() => {
    if (isEnglishSubject()) return !['translate_urdu', 'translate_english', 'idiom_phrases', 'directInDirect', 'activePassive', 'passage', 'summary'].includes(formData.question_type);
    if (isUrduSubject()) return ['mcq', 'short', 'long'].includes(formData.question_type);
    return true;
  }, [isEnglishSubject, isUrduSubject, formData.question_type]);

  /* ══════════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════════*/
  return (
    <form onSubmit={handleSubmit} className="qfm-form">
      <style>{`
        .qfm-form { font-size: .92rem; }
        .qfm-section-title {
          font-size: .78rem; font-weight: 750; text-transform: uppercase;
          letter-spacing: .06em; color: #6c7a99; margin: 0 0 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .qfm-section-title::after { content: ''; flex: 1; height: 1px; background: #e3e7f0; }
        .qfm-section { margin-bottom: 28px; }
        .qfm-label { font-size: .82rem; font-weight: 600; color: #1a2540; margin-bottom: 6px; display: block; }
        .qfm-label.urdu-label { text-align: right; direction: rtl; font-family: "Jameel Noori Nastaleeq","Noto Nastaliq Urdu",serif; font-size: .95rem; }
        .qfm-hint {
          font-size: .8rem; color: #2f54eb; background: #eef2ff; border: 1px solid #d7e0ff;
          border-radius: 8px; padding: 8px 12px; margin-bottom: 20px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
        }
        .qfm-hint code { background: #fff; border: 1px solid #d7e0ff; padding: 1px 6px; border-radius: 5px; font-size: .76rem; }
        .qfm-field-group { margin-bottom: 18px; }
        .qfm-math-hint { font-size: .74rem; color: #6c7a99; margin-top: 5px; }
        .qfm-math-hint code { background: #f0f2f8; padding: 1px 5px; border-radius: 4px; font-size: .72rem; }
        .qfm-preview-wrap { margin-top: 8px; }
        .qfm-preview-label {
          font-size: .7rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: #8890a4; margin-bottom: 4px; display: block;
        }
        .qfm-preview-box {
          padding: 10px 14px; background: #f8f9fc; border: 1px solid #e3e7f0;
          border-radius: 8px; word-break: break-word;
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
          border: 1px solid #e3e7f0; border-radius: 10px; padding: 12px 14px;
          background: #fbfbfd; height: 100%;
        }
        .qfm-correct-card {
          border: 1px solid #e3e7f0; border-radius: 10px; padding: 14px 16px;
          background: #fbfbfd; margin-top: 6px;
        }
        .qfm-footer-bar {
          display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
          padding-top: 18px; margin-top: 8px; border-top: 1px solid #e3e7f0;
        }
        @media (max-width: 576px) {
          .qfm-footer-bar { justify-content: stretch; }
          .qfm-footer-bar > button { flex: 1; }
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
                  <label className="qfm-label">Question Text (English) *</label>
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
              {(formData.question_type === 'sentence_correction' || formData.question_type === 'sentence_completion') && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">{formData.question_type === 'sentence_correction' ? 'جملہ (درستگی کے لیے) *' : 'جملہ (تکمیل کے لیے) *'}</label>
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
              {formData.question_type === 'darkhwast_khat' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">درخواست/خط کا متن *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.darkhwast_text} onEditorChange={c => handleEditorChange(c, 'darkhwast_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.darkhwast_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'kahani_makalma' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">کہانی/مکالمہ کا متن *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.kahani_text} onEditorChange={c => handleEditorChange(c, 'kahani_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.kahani_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'Nasarkhulasa_markziKhyal' && (
                <div className="col-12 qfm-field-group">
                  <label className="qfm-label urdu-label">نثر/خلاصہ/مرکزی خیال *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.nasar_text} onEditorChange={c => handleEditorChange(c, 'nasar_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.nasar_text} dir="rtl" label="پیش نظارہ" />
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

      {/* ── MCQ Options (Bootstrap grid layout — no custom CSS grid) ── */}
      {formData.question_type === 'mcq' && (
        <div className="qfm-section">
          <p className="qfm-section-title">{isUrduSubject() ? 'آپشنز' : 'Answer Options'}</p>
          <div className="row g-3">

            {/* English & bilingual MCQ options */}
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

            {/* Urdu options for bilingual subjects */}
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

            {/* Urdu-subject MCQ options */}
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

            {/* Correct option selector */}
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
                <label className="qfm-label">Answer (English) *</label>
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
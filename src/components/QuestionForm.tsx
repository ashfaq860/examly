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
 */

/* ═══════════════════════════════════════════════════════════════════════════
   KaTeX helpers + Urdu pre-processor
═══════════════════════════════════════════════════════════════════════════*/
declare global {
  interface Window {
    katex: any;
    renderMathInElement: (el: HTMLElement, opts?: any) => void;
  }
}

/* ── Urdu-in-math pre-processor ─────────────────────────────────────────────
 * Fixes two cases:
 *
 * CASE 1 — Urdu inside delimited math (KaTeX can't render Arabic in math mode)
 *   \[ \overline{حاکمیت} \]  →  \[ \overline{\text{حاکمیت}} \]
 *
 * CASE 2 — LaTeX commands with NO delimiters at all (renderMathInElement ignores them)
 *   \overline{\text{حاکمیت}}  →  \(\overline{\text{حاکمیت}}\)
 */
const _URDU_CHAR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F]/;
const _URDU_RUN  = /([\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F ]+)/g;

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
    const inD = (before.match(/\\\[/g)||[]).length > (before.match(/\\\]/g)||[]).length;
    const inI = (before.match(/\\\(/g)||[]).length > (before.match(/\\\)/g)||[]).length;
    const in$ = ((before.match(/\$\$/g)||[]).length) % 2 !== 0;
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
    { left: '\\[', right: '\\]', display: true  },
    { left: '$$',  right: '$$',  display: true  },
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
   Used below each editor so the author can see the final output immediately.
═══════════════════════════════════════════════════════════════════════════*/
interface PreviewBoxProps {
  html: string | null | undefined;
  dir?: 'ltr' | 'rtl';
  label?: string;
}

function PreviewBox({ html, dir = 'ltr', label }: PreviewBoxProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Pre-process: wrap bare Urdu inside math delimiters with \text{}
  const safeHtml = preprocessMathHtml(html);

  useEffect(() => {
    if (!ref.current || !safeHtml) return;
    const id = requestAnimationFrame(() => renderMath(ref.current));
    return () => cancelAnimationFrame(id);
  }, [safeHtml]);

  if (!safeHtml || safeHtml.replace(/<[^>]*>/g, '').trim() === '') return null;

  return (
    <div style={{ marginTop: 6 }}>
      {label && (
        <span style={{
          fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.05em', color: '#8890a4', marginBottom: 3, display: 'block',
        }}>
          {label}
        </span>
      )}
      <div
        ref={ref}
        dir={dir}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        style={{
          padding: '8px 12px',
          background: '#f8f9fc',
          border: '1px solid #e3e7f0',
          borderRadius: 6,
          fontSize: dir === 'rtl' ? '1rem' : '.9rem',
          lineHeight: dir === 'rtl' ? 1.9 : 1.6,
          fontFamily: dir === 'rtl'
            ? '"Jameel Noori Nastaleeq","Noto Nastaliq Urdu",serif'
            : 'inherit',
          wordBreak: 'break-word',
        }}
      />
      <style>{`
        /* KaTeX inside RTL previews: flip back to LTR, use Urdu font for \text{} */
        [dir="rtl"] .katex,
        [dir="rtl"] .katex-display { direction:ltr !important; display:inline-block; unicode-bidi:embed; vertical-align:middle; }
        [dir="rtl"] .katex-display  { display:block; text-align:center; }
        [dir="rtl"] .katex .mord.text,
        [dir="rtl"] .katex .mord.text .mord {
          font-family:"Jameel Noori Nastaleeq","Noto Nastaliq Urdu","Urdu Typesetting",serif !important;
          font-size:1.15em; line-height:1.6;
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   buildMathButton — TinyMCE `setup` helper
   Adds an "f(x)" button to the toolbar. Clicking it:
     1. Reads any selected text as the initial formula
     2. Opens a prompt for the LaTeX expression
     3. Asks whether it should be inline \(...\) or display \[...\]
     4. Inserts/replaces the selection with the wrapped formula
═══════════════════════════════════════════════════════════════════════════*/
function buildMathButton(editor: any) {
  editor.ui.registry.addButton('mathformula', {
    text: 'f(x)',
    tooltip: 'Insert math formula (LaTeX)',
    onAction: () => {
      const selected = editor.selection.getContent({ format: 'text' }).trim();
      const formula  = window.prompt(
        'Enter LaTeX formula (e.g.  x^2 + y^2 = r^2  or  \\frac{a}{b}):',
        selected || ''
      );
      if (!formula) return;

      const isDisplay = window.confirm(
        'Display formula on its own line?\n\n' +
        'OK = display block   \\[ ... \\]\n' +
        'Cancel = inline      \\( ... \\)'
      );

      const wrapped = isDisplay
        ? `\\[ ${formula} \\]`
        : `\\( ${formula} \\)`;

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

/* ═══════════════════════════════════════════════════════════════════════════
   QuestionForm
═══════════════════════════════════════════════════════════════════════════*/
export default function QuestionForm({
  question, classes, subjects, chapters, topics, classSubjects, onClose,
}: QuestionFormProps) {
  const toId = useCallback((v: any) => (v === null || v === undefined ? '' : String(v)), []);

  // ── TinyMCE CDN (GPL — no API key required) ──
  const TINYMCE_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tinymce@6.8.3/tinymce.min.js';

  /* ── form state ── */
  const initialTextFields = useMemo(() => ({
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
  }), []);

  const [formData, setFormData] = useState({
    ...initialTextFields,
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
  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<any[]>([]);
  const [filteredTopics,   setFilteredTopics]   = useState<any[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [isTranslating,    setIsTranslating]    = useState(false);

  /* ── subject type helpers ── */
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

  /* ══════════════════════════════════════════════════════════════════════════
     TinyMCE configs
     Key change from original: removed the MathJax plugin entirely and added
     the custom `mathformula` button via the `setup` callback.
  ══════════════════════════════════════════════════════════════════════════*/

  /** Shared `setup` function — adds the f(x) math button to every editor */
  const sharedSetup = useCallback((editor: any) => {
    buildMathButton(editor);
  }, []);

  const englishEditorConfig = useMemo<any>(() => ({
    height: 300,
    menubar: true,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount',
    ],
    // mathformula added after standard toolbar groups
    toolbar:
      'undo redo | blocks | bold italic underline strikethrough | ' +
      'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | mathformula | removeformat help',
    content_style: `
      body { font-family: Helvetica, Arial, sans-serif; font-size: 16px; }
      /* Show a visual hint for LaTeX delimiters inside the editor */
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
        const res  = await fetch('/api/upload', { method: 'POST', body: fd });
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
    height: 150,
    menubar: false,
    toolbar: 'bold italic | mathformula | removeformat',
  }), [englishEditorConfig]);

  const urduOptionEditorConfig = useMemo<any>(() => ({
    ...urduEditorConfig,
    height: 150,
    menubar: false,
    toolbar: 'bold italic | mathformula | removeformat',
  }), [urduEditorConfig]);

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
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ── reset text fields ── */
  const resetTextFields = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      question_text: '', question_text_ur: '',
      option_a: '', option_b: '', option_c: '', option_d: '',
      option_a_ur: '', option_b_ur: '', option_c_ur: '', option_d_ur: '',
      answer_text: '', answer_text_ur: '',
      passage_text: '', passage_text_ur: '',
      idiom_phrase: '', idiom_phrase_explanation: '',
      poetry_text: '', prose_text: '', sentence_text: '',
      direct_sentence: '', indirect_sentence: '',
      active_sentence: '', passive_sentence: '',
      darkhwast_text: '', kahani_text: '', nasar_text: '', summary_text: '',
      correct_option: prev.question_type === 'mcq' ? '' : prev.correct_option,
      passage_questions_count: 1,
    }));
  }, []);

  /* ── translation helper ── */
  const translateToUrdu = useCallback(async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const res  = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ur`);
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

  /* ── init form for edit mode ── */
  useEffect(() => {
    if (!question) return;

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
    } else if (['sentence_correction','sentence_completion'].includes(question.question_type) && question.question_text_ur) {
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

    const currentTopic   = activeTopics.find(t => toId(t.id) === toId(question.topic_id));
    const currentChapter = currentTopic ? activeChapters.find(c => toId(c.id) === toId(currentTopic.chapter_id)) : null;
    const classSubject   = currentChapter ? activeClassSubjects.find(cs => toId(cs.id) === toId(currentChapter.class_subject_id)) : null;

    setFormData({
      question_text:    passageQuestionText  || question.question_text    || '',
      question_text_ur: passageQuestionTextUr || question.question_text_ur || '',
      option_a: question.option_a || '', option_b: question.option_b || '',
      option_c: question.option_c || '', option_d: question.option_d || '',
      option_a_ur: question.option_a_ur || '', option_b_ur: question.option_b_ur || '',
      option_c_ur: question.option_c_ur || '', option_d_ur: question.option_d_ur || '',
      correct_option: question.correct_option || '',
      class_id:   toId(classSubject?.class_id) || '',
      subject_id: toId(classSubject?.subject_id) || '',
      chapter_id: toId(currentChapter?.id) || '',
      topic_id:   toId(question.topic_id) || '',
      difficulty:    question.difficulty    || 'medium',
      question_type: (question.question_type || 'mcq') as QuestionType,
      answer_text:    question.answer_text    || '',
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
  }, [activeChapters, activeClassSubjects, activeTopics, question, toId]);

  /* ── cascading dropdowns ── */
  useEffect(() => {
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
  }, [activeClassSubjects, activeSubjects, formData.class_id, toId]);

  useEffect(() => {
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
  }, [activeChapters, activeClassSubjects, formData.class_id, formData.subject_id, toId]);

  useEffect(() => {
    let mounted = true;
    if (!formData.chapter_id) {
      setFilteredTopics([]);
      if (formData.topic_id) setFormData(p => ({ ...p, topic_id: '' }));
      return () => { mounted = false; };
    }

    const syncTopics = async () => {
      try {
        const data = await fetchTopicsByChapter(formData.chapter_id);
        if (!mounted) return;
        setFilteredTopics((data || []).slice().sort(compareLabels));
        if (formData.topic_id && !(data || []).some(t => toId(t.id) === formData.topic_id)) {
          setFormData(p => ({ ...p, topic_id: '' }));
        }
      } catch (err) {
        console.error('Failed to load topics for chapter:', err);
        const ts = activeTopics.filter(t => toId(t.chapter_id) === formData.chapter_id).sort(compareLabels);
        setFilteredTopics(ts);
        if (formData.topic_id && !ts.some(t => toId(t.id) === formData.topic_id)) {
          setFormData(p => ({ ...p, topic_id: '' }));
        }
      }
    };

    syncTopics();
    return () => { mounted = false; };
  }, [activeTopics, compareLabels, formData.chapter_id, formData.topic_id, setFormData, toId]);

  /* ── submit ── */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const base = {
        topic_id:    formData.topic_id || null,
        difficulty:  formData.difficulty,
        question_type: formData.question_type,
        source_type: formData.source_type,
        source_year: formData.source_year ? parseInt(formData.source_year) : null,
        created_by:  user?.id ?? null,
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
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'translate_urdu':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'translate_english':
            specific = { question_text: formData.question_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'idiom_phrases':
            specific = { question_text: formData.idiom_phrase, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'passage':
            specific = { question_text: `${formData.passage_text}\n\nQUESTION: ${formData.question_text}`, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'directInDirect':
            specific = { question_text: formData.direct_sentence, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'activePassive':
            specific = { question_text: formData.active_sentence, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'summary':
            specific = { question_text: formData.summary_text, question_text_ur: null, answer_text: formData.answer_text, answer_text_ur: null, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
        }
      } else if (isUrduSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, option_a:null,option_b:null,option_c:null,option_d:null, option_a_ur: formData.option_a_ur, option_b_ur: formData.option_b_ur, option_c_ur: formData.option_c_ur || null, option_d_ur: formData.option_d_ur || null, correct_option: formData.correct_option, answer_text: null, answer_text_ur: null }; break;
          case 'poetry_explanation': case 'gazal':
            specific = { question_text: null, question_text_ur: formData.poetry_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'prose_explanation':
            specific = { question_text: null, question_text_ur: formData.prose_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'short': case 'long':
            specific = { question_text: null, question_text_ur: formData.question_text_ur, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'sentence_correction': case 'sentence_completion':
            specific = { question_text: null, question_text_ur: formData.sentence_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'passage':
            specific = { question_text: null, question_text_ur: `${formData.passage_text_ur}\n\nQUESTION: ${formData.question_text_ur}`, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'darkhwast_khat':
            specific = { question_text: null, question_text_ur: formData.darkhwast_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'kahani_makalma':
            specific = { question_text: null, question_text_ur: formData.kahani_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
          case 'Nasarkhulasa_markziKhyal':
            specific = { question_text: null, question_text_ur: formData.nasar_text, answer_text: null, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
        }
      } else {
        switch (formData.question_type) {
          case 'mcq':
            specific = { question_text: formData.question_text, question_text_ur: formData.question_text_ur, option_a: formData.option_a, option_b: formData.option_b, option_c: formData.option_c || null, option_d: formData.option_d || null, option_a_ur: formData.option_a_ur || null, option_b_ur: formData.option_b_ur || null, option_c_ur: formData.option_c_ur || null, option_d_ur: formData.option_d_ur || null, correct_option: formData.correct_option, answer_text: null, answer_text_ur: null }; break;
          case 'short': case 'long':
            specific = { question_text: formData.question_text, question_text_ur: formData.question_text_ur, answer_text: formData.answer_text, answer_text_ur: formData.answer_text_ur, option_a:null,option_b:null,option_c:null,option_d:null,option_a_ur:null,option_b_ur:null,option_c_ur:null,option_d_ur:null,correct_option:null }; break;
        }
      }

      const payload = { ...base, ...specific };
      console.log('Saving payload:', payload);

      if (question) {
        await updateQuestion(String(question.id), payload);
        toast.success('Question updated successfully');
      } else {
        await createQuestion(payload);
        toast.success('Question added successfully');
        resetTextFields();
      }
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast.error(error.message || 'Failed to save question');
    } finally { setLoading(false); }
  }, [formData, isEnglishSubject, isUrduSubject, question, resetTextFields]);

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
    if (isEnglishSubject()) return !['translate_urdu','translate_english','idiom_phrases','directInDirect','activePassive','passage','summary'].includes(formData.question_type);
    if (isUrduSubject()) return ['mcq','short','long'].includes(formData.question_type);
    return true;
  }, [isEnglishSubject, isUrduSubject, formData.question_type]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const an = parseInt(a.name), bn = parseInt(b.name);
      return (!isNaN(an) && !isNaN(bn)) ? an - bn : a.name.localeCompare(b.name);
    });
  }, [classes]);

  /* ══════════════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════════════*/
  return (
    <form onSubmit={handleSubmit}>
      {/* ── KaTeX RTL fix for previews ─────────────────────────────────── */}
      <style>{`
        .qf-preview [dir="rtl"] .katex,
        .qf-preview [dir="rtl"] .katex-display { direction:ltr!important;display:inline-block;unicode-bidi:embed; }
        .qf-math-hint { font-size:.75rem; color:#6c7a99; margin-top:4px; }
        .qf-math-hint code { background:#f0f2f8; padding:1px 5px; border-radius:4px; font-size:.72rem; }
      `}</style>

      {/* ── math syntax hint banner ── */}
      <div className="alert alert-info py-2 px-3 mb-3" style={{ fontSize: '.8rem' }}>
        <strong>Math formulas:</strong>&nbsp;
        Use <code>\( x^2 \)</code> for inline and <code>\[ \frac&#123;a&#125;&#123;b&#125; \]</code> for display math,
        or click the <strong>f(x)</strong> toolbar button to insert.
      </div>

      <div className="modal-body qf-preview">

        {/* ── Configuration ── */}
        <div className="row g-3 mb-4">
          <div className="col-12"><h5 className="mb-3">Question Configuration</h5><hr /></div>

          <div className="col-md-6">
            <label className="form-label">Class *</label>
            <select className="form-select" name="class_id" value={formData.class_id} onChange={handleChange} required>
              <option value="">Select Class</option>
              {activeClasses.map(c => <option key={toId(c.id)} value={toId(c.id)}>{c.name}{c.description ? ` — ${c.description}` : ''}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Subject *</label>
            <select className="form-select" name="subject_id" value={formData.subject_id} onChange={handleChange} required disabled={!formData.class_id}>
              <option value="">Select Subject</option>
              {filteredSubjects.map(s => <option key={toId(s.id)} value={toId(s.id)}>{s.name}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Chapter</label>
            <select className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`} name="chapter_id" value={formData.chapter_id} onChange={handleChange} disabled={!formData.class_id || !formData.subject_id}>
              <option value="">{isUrduSubject() ? 'چیپٹر کا انتخاب کریں' : 'Select Chapter'}</option>
            {filteredChapters.map(c => (<option key={toId(c.id)} value={toId(c.id)}>
            {c.chapterNo ?? '?'}-{c.name}
  </option>
))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Topic</label>
            <select className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`} name="topic_id" value={formData.topic_id} onChange={handleChange} disabled={!formData.chapter_id}>
              <option value="">{isUrduSubject() ? 'موضوع کا انتخاب کریں' : 'Select Topic'}</option>
              {filteredTopics.map(t => <option key={toId(t.id)} value={toId(t.id)}>{t.name}</option>)}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Question Type *</label>
            <select className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`} name="question_type" value={formData.question_type} onChange={handleChange} required>
              <option value="">Select Question Type</option>
              {getAvailableQuestionTypes().map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isMathScienceSubject() && <small className="text-success d-block mt-1">Math/Science: use f(x) button for formulas</small>}
          </div>

          <div className="col-md-6">
            <label className="form-label">Difficulty *</label>
            <select className="form-select" name="difficulty" value={formData.difficulty} onChange={handleChange} required>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Source Type *</label>
            <select className="form-select" name="source_type" value={formData.source_type} onChange={handleChange} required>
              <option value="book">Book</option>
              <option value="past_paper">Past Paper</option>
              <option value="model_paper">Model Paper</option>
              <option value="custom">Custom</option>
              <option value="conceptual">Conceptual</option>
            </select>
          </div>

          {['past_paper','model_paper'].includes(formData.source_type) && (
            <div className="col-md-6">
              <label className="form-label">Year</label>
              <input type="number" className="form-control" name="source_year" value={formData.source_year} onChange={handleChange} min="1900" max={new Date().getFullYear()} />
            </div>
          )}
        </div>

        {/* ── Question Content ── */}
        <div className="row g-3">
          <div className="col-12"><h5 className="mb-3">Question Content</h5><hr /></div>

          {/* ── ENGLISH ── */}
          {isEnglishSubject() && (
            <>
              {shouldShowQuestionTextField() && (
                <div className="col-md-12">
                  <label className="form-label">Question Text (English) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                  <p className="qf-math-hint">Tip: click <strong>f(x)</strong> or type <code>\( formula \)</code> for inline math</p>
                </div>
              )}
              {formData.question_type === 'translate_urdu' && (
                <div className="col-md-12">
                  <label className="form-label">English Text to Translate *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                </div>
              )}
              {formData.question_type === 'translate_english' && (
                <div className="col-md-12">
                  <label className="form-label">Urdu Text to Translate *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.question_text} label="Preview" />
                </div>
              )}
              {formData.question_type === 'idiom_phrases' && (
                <div className="col-md-12">
                  <label className="form-label">Idiom/Phrase (English) *</label>
                  <textarea className="form-control" name="idiom_phrase" value={formData.idiom_phrase} onChange={handleChange} required placeholder="e.g., 'Break a leg'" rows={3} />
                </div>
              )}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Passage Text (English) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.passage_text} onEditorChange={c => handleEditorChange(c, 'passage_text')} init={englishEditorConfig} />
                    <PreviewBox html={formData.passage_text} label="Passage preview" />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Question about Passage (English) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                    <PreviewBox html={formData.question_text} label="Question preview" />
                  </div>
                </>
              )}
              {formData.question_type === 'directInDirect' && (
                <div className="col-md-12">
                  <label className="form-label">Direct Speech Sentence *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.direct_sentence} onEditorChange={c => handleEditorChange(c, 'direct_sentence')} init={englishEditorConfig} />
                  <PreviewBox html={formData.direct_sentence} label="Preview" />
                </div>
              )}
              {formData.question_type === 'activePassive' && (
                <div className="col-md-12">
                  <label className="form-label">Active Voice Sentence *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.active_sentence} onEditorChange={c => handleEditorChange(c, 'active_sentence')} init={englishEditorConfig} />
                  <PreviewBox html={formData.active_sentence} label="Preview" />
                </div>
              )}
              {formData.question_type === 'summary' && (
                <div className="col-md-12">
                  <label className="form-label">Text to Summarize *</label>
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
                <div className="col-md-12">
                  <label className="form-label urdu-label">سوال (اردو) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.question_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'poetry_explanation' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">شعر *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.poetry_text} onEditorChange={c => handleEditorChange(c, 'poetry_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.poetry_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'gazal' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">غزل *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.poetry_text} onEditorChange={c => handleEditorChange(c, 'poetry_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.poetry_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'prose_explanation' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">نثر پارہ *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.prose_text} onEditorChange={c => handleEditorChange(c, 'prose_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.prose_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {(formData.question_type === 'short' || formData.question_type === 'long') && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">سوال *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.question_text_ur} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {(formData.question_type === 'sentence_correction' || formData.question_type === 'sentence_completion') && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">{formData.question_type === 'sentence_correction' ? 'جملہ (درستگی کے لیے) *' : 'جملہ (تکمیل کے لیے) *'}</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.sentence_text} onEditorChange={c => handleEditorChange(c, 'sentence_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.sentence_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">نثر پارہ (پاسج) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.passage_text_ur} onEditorChange={c => handleEditorChange(c, 'passage_text_ur')} init={urduEditorConfig} />
                    <PreviewBox html={formData.passage_text_ur} dir="rtl" label="پاسج پیش نظارہ" />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">سوال (پاسج کے بارے میں) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                    <PreviewBox html={formData.question_text_ur} dir="rtl" label="سوال پیش نظارہ" />
                  </div>
                </>
              )}
              {formData.question_type === 'darkhwast_khat' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">درخواست/خط کا متن *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.darkhwast_text} onEditorChange={c => handleEditorChange(c, 'darkhwast_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.darkhwast_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'kahani_makalma' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">کہانی/مکالمہ کا متن *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.kahani_text} onEditorChange={c => handleEditorChange(c, 'kahani_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.kahani_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
              {formData.question_type === 'Nasarkhulasa_markziKhyal' && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">نثر/خلاصہ/مرکزی خیال *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.nasar_text} onEditorChange={c => handleEditorChange(c, 'nasar_text')} init={urduEditorConfig} />
                  <PreviewBox html={formData.nasar_text} dir="rtl" label="پیش نظارہ" />
                </div>
              )}
            </>
          )}

          {/* ── OTHER (bilingual) ── */}
          {!isEnglishSubject() && !isUrduSubject() && (
            <>
              <div className="col-md-12">
                <label className="form-label">Question Text (English) *</label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text} onEditorChange={c => handleEditorChange(c, 'question_text')} init={englishEditorConfig} />
                <PreviewBox html={formData.question_text} label="English preview" />
                <p className="qf-math-hint">Tip: click <strong>f(x)</strong> or type <code>\( formula \)</code></p>
              </div>
              <div className="col-md-12">
                <label className="form-label">Question Text (Urdu)</label>
                <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.question_text_ur} onEditorChange={c => handleEditorChange(c, 'question_text_ur')} init={urduEditorConfig} />
                <PreviewBox html={formData.question_text_ur} dir="rtl" label="Urdu preview" />
              </div>
            </>
          )}
        </div>

        {/* ── MCQ Options ── */}
        <div className="row g-3 mt-2">

          {/* English & other subjects MCQ */}
          {(formData.question_type === 'mcq' && (isEnglishSubject() || (!isEnglishSubject() && !isUrduSubject()))) && (
            <>
              {(['a','b','c','d'] as const).map(opt => {
                const key = `option_${opt}` as keyof typeof formData;
                const required = opt === 'a' || opt === 'b';
                return (
                  <div className="col-md-6" key={opt}>
                    <label className="form-label">Option {opt.toUpperCase()} (English){required ? ' *' : ''}</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={englishOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} />
                  </div>
                );
              })}

              {/* Urdu options for bilingual subjects */}
              {!isEnglishSubject() && !isUrduSubject() && (['a','b','c','d'] as const).map(opt => {
                const key = `option_${opt}_ur` as keyof typeof formData;
                return (
                  <div className="col-md-6" key={`ur-${opt}`}>
                    <label className="form-label">Option {opt.toUpperCase()} (Urdu)</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={urduOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} dir="rtl" />
                  </div>
                );
              })}

              <div className="col-md-12">
                <label className="form-label">Correct Option *</label>
                <select className="form-select" name="correct_option" value={formData.correct_option} onChange={handleChange} required>
                  <option value="">Select correct option</option>
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  {formData.option_c && <option value="C">Option C</option>}
                  {formData.option_d && <option value="D">Option D</option>}
                </select>
              </div>
            </>
          )}

          {/* Urdu subject MCQ */}
          {formData.question_type === 'mcq' && isUrduSubject() && (
            <>
              {(['a','b','c','d'] as const).map(opt => {
                const key = `option_${opt}_ur` as keyof typeof formData;
                const labels: any = { a:'آپشن اے', b:'آپشن بی', c:'آپشن سی', d:'آپشن ڈی' };
                const required = opt === 'a' || opt === 'b';
                return (
                  <div className="col-md-6" key={opt}>
                    <label className="form-label urdu-label">{labels[opt]} (اردو){required ? ' *' : ''}</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={String(formData[key] ?? '')} onEditorChange={c => handleEditorChange(c, key)} init={urduOptionEditorConfig} />
                    <PreviewBox html={String(formData[key] ?? '')} dir="rtl" />
                  </div>
                );
              })}
              <div className="col-md-12">
                <label className="form-label urdu-text" style={{ float: 'right' }}>صحیح آپشن منتخب کریں *</label>
                <select className="form-select urdu-text" name="correct_option" value={formData.correct_option} onChange={handleChange} required>
                  <option value="">صحیح آپشن منتخب کریں</option>
                  <option value="A">آپشن اے</option>
                  <option value="B">آپشن بی</option>
                  {formData.option_c_ur && <option value="C">آپشن سی</option>}
                  {formData.option_d_ur && <option value="D">آپشن ڈی</option>}
                </select>
              </div>
            </>
          )}

          {/* Answer fields for non-MCQ */}
          {formData.question_type !== 'mcq' && (
            <>
              {isEnglishSubject() && (
                <div className="col-md-12">
                  <label className="form-label">Answer (English) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text} onEditorChange={c => handleEditorChange(c, 'answer_text')} init={englishEditorConfig} />
                  <PreviewBox html={formData.answer_text} label="Answer preview" />
                </div>
              )}
              {isUrduSubject() && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">جواب (اردو) *</label>
                  <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text_ur} onEditorChange={c => handleEditorChange(c, 'answer_text_ur')} init={urduEditorConfig} />
                  <PreviewBox html={formData.answer_text_ur} dir="rtl" label="جواب پیش نظارہ" />
                </div>
              )}
              {!isEnglishSubject() && !isUrduSubject() && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Answer (English) *</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text} onEditorChange={c => handleEditorChange(c, 'answer_text')} init={englishEditorConfig} />
                    <PreviewBox html={formData.answer_text} label="Answer preview" />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Answer (Urdu)</label>
                    <Editor tinymceScriptSrc={TINYMCE_SCRIPT_SRC} value={formData.answer_text_ur} onEditorChange={c => handleEditorChange(c, 'answer_text_ur')} init={urduEditorConfig} />
                    <PreviewBox html={formData.answer_text_ur} dir="rtl" label="Urdu answer preview" />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        {!isEnglishSubject() && !isUrduSubject() && (
          <button type="button" className="btn btn-outline-primary" onClick={handleTranslateAll} disabled={isTranslating || loading}>
            {isTranslating ? 'Translating...' : 'Translate to Urdu'}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading || isTranslating}>
          {loading ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}
'use client';
import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import {
  FiSearch, FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, FiX,
  FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight,
  FiLayers, FiAlignLeft, FiBarChart2, FiBook, FiCheckSquare,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
const QuestionForm = dynamic(() => import('@/components/QuestionForm'), { ssr: false });
import { useRouter } from 'next/navigation';
import { isUserAdmin } from '@/lib/auth-utils';

/* ═══════════════════════════ helpers ═══════════════════════════════════════*/
declare global {
  interface Window {
    katex: {
      renderToString: (tex: string, opts?: any) => string;
    };
  }
}

const stripHtml = (html: string): string => {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
};



/* ─── KaTeX + Urdu pre-processor ────────────────────────────────────────────
 * Two problems solved here:
 *
 * PROBLEM 1 — Urdu inside delimited math
 *   \[ \overline{حاکمیت} \]  →  KaTeX crash (no glyphs for Arabic in math mode)
 *   Fix: wrap bare Urdu runs inside delimiters with \text{}
 *   Result: \[ \overline{\text{حاکمیت}} \]
 *
 * PROBLEM 2 — LaTeX commands with NO delimiters at all
 *   Stored in DB as: \overline{\text{حاکمیت}}
 *   renderMathInElement never even scans it — no delimiters = invisible to KaTeX
 *   Fix: detect undelimited LaTeX command sequences and wrap them in \(...\)
 *   Result: \(\overline{\text{حاکمیت}}\)
 *
 * Already-wrapped \text{} and already-delimited expressions are left untouched.
 */
const URDU_CHAR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F]/;
const URDU_RUN  = /([\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\u200F ]+)/g;

/** Wrap bare Urdu runs inside a LaTeX snippet with \text{}, skip existing \text{} */
function wrapUrduInMath(content: string): string {
  const parts: string[] = [];
  let cursor = 0;
  const textCmd = /\\text\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = textCmd.exec(content)) !== null) {
    if (m.index > cursor) {
      parts.push(content.slice(cursor, m.index).replace(URDU_RUN, r => /^\s+$/.test(r) ? r : `\\text{${r.trim()}}`));
    }
    parts.push(m[0]);
    cursor = m.index + m[0].length;
  }
  if (cursor < content.length) {
    parts.push(content.slice(cursor).replace(URDU_RUN, r => /^\s+$/.test(r) ? r : `\\text{${r.trim()}}`));
  }
  return parts.join('');
}

/** Rewrite one delimiter pair in src, applying wrapUrduInMath to each math region */
function rewriteDelims(src: string, open: string, close: string): string {
  const out: string[] = [];
  let pos = 0;
  while (pos < src.length) {
    const oi = src.indexOf(open, pos);
    if (oi === -1) { out.push(src.slice(pos)); break; }
    out.push(src.slice(pos, oi));
    const ci = src.indexOf(close, oi + open.length);
    if (ci === -1) { out.push(src.slice(oi)); pos = src.length; break; }
    out.push(open + wrapUrduInMath(src.slice(oi + open.length, ci)) + close);
    pos = ci + close.length;
  }
  return out.join('');
}

/** Detect undelimited LaTeX sequences and wrap them in \(...\) so
 *  renderMathInElement can find and render them.
 *  e.g.  \overline{\text{حاکمیت}}  →  \(\overline{\text{حاکمیت}}\)
 */
function wrapUndelimitedLatex(src: string): string {
  // Match a LaTeX command (\name) followed by any {brace} or [opt] args,
  // optionally chained with + - = operators into compound expressions.
  const CMD  = '\\\\[a-zA-Z]+';
  const BARG = '\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}';
  const OARG = '\\[[^\\]]*\\]';
  const UNIT = `(?:${CMD}(?:\\s*(?:${BARG}|${OARG}))*)`;
  const OP   = '(?:\\s*[+\\-=]\\s*)';
  const SEQ  = new RegExp(`(${UNIT}(?:${OP}${UNIT})*)`, 'g');

  return src.replace(SEQ, (match, _p1, offset) => {
    // Skip if already inside a delimiter pair
    const before = src.slice(0, offset);
    const inDisplay = (before.match(/\\\[/g)||[]).length > (before.match(/\\\]/g)||[]).length;
    const inInline  = (before.match(/\\\(/g)||[]).length > (before.match(/\\\)/g)||[]).length;
    const inDollar  = ((before.match(/\$\$/g)||[]).length) % 2 !== 0;
    if (inDisplay || inInline || inDollar) return match;
    // Skip escape sequences like \n \t \r
    if (/^\\[ntr ]$/.test(match.trim())) return match;
    return `\\(${match}\\)`;
  });
}

function preprocessMathHtml(html: string | null | undefined): string {
  if (!html) return html ?? '';

  let r = html;

  // Step 1 — fix Urdu inside existing delimiters
  r = rewriteDelims(r, '\\[', '\\]');
  r = rewriteDelims(r, '\\(', '\\)');
  r = rewriteDelims(r, '$$', '$$');

  // Step 2 — wrap undelimited LaTeX commands so renderMathInElement sees them
  r = wrapUndelimitedLatex(r);

  return r;
}
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * renderMathInString — the RIGHT approach for React components.
 *
 * Instead of calling renderMathInElement() (which scans text nodes and can
 * miss content or double-process nodes), we call katex.renderToString()
 * directly on each delimiter-wrapped math segment in the HTML string.
 *
 * This runs SYNCHRONOUSLY at render time — no useEffect timing issues,
 * no "KaTeX not loaded yet" race conditions, no stale node refs.
 *
 * KaTeX is loaded via the useEffect in QuestionBank (imperative script tag).
 * We wait for window.katex to be available before calling this.
 */
function renderMathInString(html: string, isRtl = false): string {
  if (typeof window === 'undefined' || !window.katex) return html;

  const katex = window.katex;

  // Process display math first (\[...\] and $$...$$), then inline \(...\)
  const delimiters: Array<{ open: string; close: string; display: boolean }> = [
    { open: '\\[',  close: '\\]',  display: true  },
    { open: '$$',   close: '$$',   display: true  },
    { open: '\\(',  close: '\\)',  display: false },
  ];

  let result = html;

  for (const { open, close, display } of delimiters) {
    const parts: string[] = [];
    let pos = 0;
    while (pos < result.length) {
      const oi = result.indexOf(open, pos);
      if (oi === -1) { parts.push(result.slice(pos)); break; }
      parts.push(result.slice(pos, oi));
      const ci = result.indexOf(close, oi + open.length);
      if (ci === -1) { parts.push(result.slice(oi)); pos = result.length; break; }
      const mathStr = result.slice(oi + open.length, ci);
      try {
        const rendered = katex.renderToString(mathStr, {
          displayMode: display,
          throwOnError: false,
          strict: false,
          trust: true,
          // Output HTML so we can inject Urdu font styles
          output: 'html',
          // macros: common shortcuts
          macros: { '\\R': '\\mathbb{R}' },
        });
        parts.push(rendered);
      } catch {
        // Fallback: show original with delimiters
        parts.push(open + mathStr + close);
      }
      pos = ci + close.length;
    }
    result = parts.join('');
  }

  return result;
}

/** Context so QuestionCell knows when KaTeX JS is ready to call renderToString */
const KatexReadyContext = React.createContext(false);

/* ═══════════════════════════ QuestionCell ═══════════════════════════════════
   Renders WYSIWYG HTML + Urdu text + KaTeX math.
   
   HOW IT WORKS:
   1. preprocessMathHtml() transforms the raw DB string:
      - Wraps bare Urdu inside math delimiters with \text{}
      - Wraps undelimited LaTeX commands with \(...\)
   2. renderMathInString() calls katex.renderToString() on each math segment,
      replacing the raw \(...\) / \[...\] text with actual KaTeX HTML.
   3. The resulting HTML (mix of plain text + KaTeX HTML) is set as innerHTML.
   
   This is fully synchronous at render time — no useEffect race conditions.
═════════════════════════════════════════════════════════════════════════════*/
function QuestionCell({ en, ur }: { en?: string | null; ur?: string | null }) {
  const katexReady = React.useContext(KatexReadyContext);

  // Step 1: pre-process (wrap Urdu in \text{}, wrap undelimited LaTeX in \(...\))
  const processedEn = preprocessMathHtml(en);
  const processedUr = preprocessMathHtml(ur);

  // Step 2: render math to HTML string synchronously (only when KaTeX is loaded)
  // When katexReady is false, we show the preprocessed text (which may have
  // raw \(...\) visible for a moment) — acceptable since KaTeX loads fast.
  const safeEn = katexReady ? renderMathInString(processedEn ?? '') : (processedEn ?? '');
  const safeUr = katexReady ? renderMathInString(processedUr ?? '', true) : (processedUr ?? '');

  if (!safeEn && !safeUr) return <span style={{ color: 'var(--qb-muted)' }}>—</span>;

  return (
    <div className="qb-q-cell">
      {safeEn && (
        <div
          className="qb-q-en"
          dangerouslySetInnerHTML={{ __html: safeEn }}
        />
      )}
      {safeUr && (
        <>
          {safeEn && <div className="qb-q-divider" />}
          <div
            className="qb-q-ur"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: safeUr }}
          />
        </>
      )}
    </div>
  );
}
interface Question {
  id: string;
  question_text:    string;
  question_text_ur?: string | null;
  option_a?: string | null; option_b?: string | null;
  option_c?: string | null; option_d?: string | null;
  option_a_ur?: string | null; option_b_ur?: string | null;
  option_c_ur?: string | null; option_d_ur?: string | null;
  correct_option?: string | null;
  difficulty:   'easy' | 'medium' | 'hard';
  question_type: string;
  answer_text?:    string | null;
  answer_text_ur?: string | null;
  source_type: 'book' | 'past_paper' | 'model_paper' | 'custom' | 'conceptual';
  source_year?: number | null;
  created_at: string;
  topic_id?: string | null;
  topic?: {
    id: string; name: string; chapter_id: string;
    chapter?: {
      id: string; name: string; chapterNo?: number; class_subject_id?: string;
      class_subject?: {
        id: string; class_id: string; subject_id: string;
        class?:   { id: string; name: string; description?: string };
        subject?: { id: string; name: string; name_ur?: string };
      };
    };
  };
  _class?: string; _class_desc?: string;
  _subject?: string;
}

interface Subject      { id: string; name: string; name_ur?: string | null; }
interface Chapter      { id: string; name: string; chapterNo?: number; class_subject_id?: string; }
interface Topic        { id: string; name: string; chapter_id: string; }
interface Class        { id: string; name: string; description?: string | null; }
interface ClassSubject {
  id: string; class_id: string; subject_id: string;
  subject?: Subject;
  class?:   { id: string; name: string; description?: string };
}
interface Filters {
  class?: string; subject?: string; chapter?: string; topic?: string;
  difficulty?: string; question_type?: string; source_type?: string;
}

/* ═══════════════════════════ constants ══════════════════════════════════════*/
const QUESTION_TYPES = [
  { value: 'mcq',                      label: 'MCQ' },
  { value: 'short',                    label: 'Short Answer' },
  { value: 'long',                     label: 'Long Answer' },
  { value: 'translate_urdu',           label: 'Translate → Urdu' },
  { value: 'translate_english',        label: 'Translate → English' },
  { value: 'idiom_phrases',            label: 'Idiom / Phrases' },
  { value: 'passage',                  label: 'Passage & Questions' },
  { value: 'directInDirect',           label: 'Direct / Indirect' },
  { value: 'activePassive',            label: 'Active / Passive' },
  { value: 'poetry_explanation',       label: 'Poetry Explanation' },
  { value: 'prose_explanation',        label: 'Prose Explanation' },
  { value: 'gazal',                    label: 'Ghazal' },
  { value: 'sentence_correction',      label: 'Sentence Correction' },
  { value: 'sentence_completion',      label: 'Sentence Completion' },
  { value: 'fill_in_the_blanks',       label: 'Fill in the Blanks' },
  { value: 'true_false',               label: 'True / False' },
  { value: 'match_the_column',         label: 'Match the Column' },
  { value: 'summary',                  label: 'Summary' },
  { value: 'darkhwast_khat',           label: 'Darkhwast / Khat' },
  { value: 'kahani_makalma',           label: 'Kahani / Makalma' },
  { value: 'Nasarkhulasa_markziKhyal', label: 'Nasar Khulasa' },
];

const TAB_TYPES = [
  { value: 'all',   label: 'All',   icon: <FiLayers    size={12} /> },
  { value: 'mcq',   label: 'MCQ',   icon: <FiBarChart2 size={12} /> },
  { value: 'short', label: 'Short', icon: <FiAlignLeft size={12} /> },
  { value: 'long',  label: 'Long',  icon: <FiBook      size={12} /> },
];

const DIFF: Record<string, { cls: string; label: string }> = {
  easy:   { cls: 'qb-easy',   label: 'Easy'   },
  medium: { cls: 'qb-medium', label: 'Medium' },
  hard:   { cls: 'qb-hard',   label: 'Hard'   },
};

const getTypeLabel = (v: string) => QUESTION_TYPES.find(t => t.value === v)?.label || v;


/* ═══════════════════════════ main page ══════════════════════════════════════*/
export default function QuestionBank() {
  const [questions,      setQuestions]      = useState<Question[]>([]);
  const [subjects,       setSubjects]       = useState<Subject[]>([]);
  const [chapters,       setChapters]       = useState<Chapter[]>([]);
  const [topics,         setTopics]         = useState<Topic[]>([]);
  const [classes,        setClasses]        = useState<Class[]>([]);
  const [classSubjects,  setClassSubjects]  = useState<ClassSubject[]>([]);
  const [filters,        setFilters]        = useState<Filters>({});
  const [loading,        setLoading]        = useState(true);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [showModal,      setShowModal]      = useState(false);
  const [selQ,           setSelQ]           = useState<Question | null>(null);
  const [isExporting,    setIsExporting]    = useState(false);
  const [isImporting,    setIsImporting]    = useState(false);
  const [activeTab,      setActiveTab]      = useState<'all'|'mcq'|'short'|'long'>('all');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [itemsPerPage,   setItemsPerPage]   = useState(20);
  const [totalQ,         setTotalQ]         = useState(0);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [katexLoaded,    setKatexLoaded]    = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const router = useRouter();

  /* ── Load KaTeX core JS + CSS dynamically ──────────────────────────────────
     We use katex.renderToString() directly in QuestionCell (synchronous, no
     DOM scanning), so we only need katex.min.js — not auto-render.min.js.
     React requires onLoad to be a function so we load imperatively here.
  ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.katex) { setKatexLoaded(true); return; }

    const addLink = (href: string) => {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    };

    const addScript = (src: string): Promise<void> => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload  = () => res();
      s.onerror = () => rej(new Error(`KaTeX script failed: ${src}`));
      document.head.appendChild(s);
    });

    (async () => {
      try {
        addLink('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css');
        await addScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js');
        setKatexLoaded(true);
      } catch (err) {
        console.error('KaTeX load error:', err);
      }
    })();
  }, []);

  /* ── admin guard ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ok = await isUserAdmin();
      if (!ok) { router.replace('/unauthorized'); return; }
      setLoading(false);
    })();
  }, [router]);

  /* ── fetch lookups ── */
  const fetchClasses       = async () => { const { data } = await supabase.from('classes').select('*').order('name');                                               if (data) setClasses(data as Class[]); };
  const fetchSubjects      = async () => { const { data } = await supabase.from('subjects').select('*').order('name');                                              if (data) setSubjects(data as Subject[]); };
  const fetchChapters      = async () => { const { data } = await supabase.from('chapters').select('*').order('chapterNo',{ascending:true,nullsFirst:false});       if (data) setChapters(data as Chapter[]); };
  const fetchTopics        = async () => { const { data } = await supabase.from('topics').select('*').order('name');                                                if (data) setTopics(data as Topic[]); };
  const fetchClassSubjects = async () => {
    const { data } = await supabase.from('class_subjects').select(`
      id, class_id, subject_id,
      subject:subjects(id,name,name_ur),
      class:classes(id,name,description)
    `).order('class_id');
    if (data) setClassSubjects(data as ClassSubject[]);
  };

  /* ── dropdown helpers ── */
  const filteredSubjects = () =>
    !filters.class ? [] :
    classSubjects.filter(cs => cs.class_id === filters.class)
      .map(cs => ({ id: cs.subject_id, name: cs.subject?.name || '—' }))
      .sort((a,b) => a.name.localeCompare(b.name));

  const filteredChapters = () => {
    if (!filters.class || !filters.subject) return [];
    const cs = classSubjects.find(c => c.class_id === filters.class && c.subject_id === filters.subject);
    if (!cs) return [];
    return chapters.filter(c => c.class_subject_id === cs.id).sort((a,b) => (a.chapterNo||0)-(b.chapterNo||0));
  };

  const filteredTopics = () =>
    !filters.chapter ? [] : topics.filter(t => t.chapter_id === filters.chapter).sort((a,b) => a.name.localeCompare(b.name));

  const sortedClasses = () =>
    [...classes].sort((a,b) => { const an=parseInt(a.name),bn=parseInt(b.name); return (!isNaN(an)&&!isNaN(bn))?an-bn:a.name.localeCompare(b.name); });

  /* ── fetch questions ── */
  const fetchQuestions = useCallback(async (page = 1, search?: string) => {
    setLoading(true);
    try {
      const q = search !== undefined ? search : searchTerm;

      let topicIds: number[] | null = null;
      if (filters.class || filters.subject || filters.chapter) {
        let tq = supabase.from('topics').select('id');
        if (filters.chapter) { tq = tq.eq('chapter_id', filters.chapter); }
        else {
          let csq = supabase.from('class_subjects').select('id');
          if (filters.class)   csq = csq.eq('class_id',   filters.class);
          if (filters.subject) csq = csq.eq('subject_id', filters.subject);
          const { data: csData } = await csq;
          let chq = supabase.from('chapters').select('id, class_subject_id');
          if (csData?.length) chq = chq.in('class_subject_id', csData.map((c:any)=>c.id));
          else chq = chq.in('id', [-1]);
          const { data: chData } = await chq;
          if (chData?.length) tq = tq.in('chapter_id', chData.map((c:any)=>c.id));
          else tq = tq.in('id', [-1]);
        }
        const { data: tData } = await tq;
        topicIds = tData?.length ? tData.map((t:any)=>t.id) : [-1];
      }

      const applyFilters = (base: any) => {
        let b = base;
        if (q?.trim()) b = b.or(`question_text.ilike.*${q.trim()}*,question_text_ur.ilike.*${q.trim()}*`);
        if (topicIds)          b = b.in('topic_id', topicIds);
        if (filters.topic)     b = b.eq('topic_id', filters.topic);
        if (filters.difficulty)    b = b.eq('difficulty',    filters.difficulty);
        if (filters.question_type) b = b.eq('question_type', filters.question_type);
        if (filters.source_type)   b = b.eq('source_type',   filters.source_type);
        return b;
      };

      const { count } = await applyFilters(
        supabase.from('questions').select('id', { count: 'exact', head: true })
      );
      setTotalQ(count || 0);

      const from = (page - 1) * itemsPerPage;
      const { data, error } = await applyFilters(
        supabase.from('questions').select(`
          id, question_text, question_text_ur,
          option_a, option_b, option_c, option_d,
          option_a_ur, option_b_ur, option_c_ur, option_d_ur,
          correct_option, difficulty, question_type,
          source_type, source_year, answer_text, answer_text_ur,
          created_at, topic_id,
          topic:topics(
            id, name, chapter_id,
            chapter:chapters(
              id, name, chapterNo, class_subject_id,
              class_subject:class_subjects(
                id, class_id, subject_id,
                class:classes(id,name,description),
                subject:subjects(id,name,name_ur)
              )
            )
          )
        `).order('created_at', { ascending: false }).range(from, from + itemsPerPage - 1)
      );
      if (error) throw error;

      setQuestions((data as any[]).map(q => ({
        ...q,
        _class:      q.topic?.chapter?.class_subject?.class?.name || '—',
        _class_desc: q.topic?.chapter?.class_subject?.class?.description || '',
        _subject:    q.topic?.chapter?.class_subject?.subject?.name || '—',
      })));
      setCurrentPage(page);
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filters, itemsPerPage]);

  /* ── init ── */
  useEffect(() => {
    (async () => {
      await Promise.all([fetchClasses(), fetchSubjects(), fetchChapters(), fetchTopics(), fetchClassSubjects()]);
      fetchQuestions(1);
    })();
  }, []);

  /* ── re-fetch on filter change ── */
  useEffect(() => {
    if (!loading) { setCurrentPage(1); fetchQuestions(1, searchTerm); }
  }, [filters.class, filters.subject, filters.chapter, filters.topic, filters.difficulty, filters.question_type, filters.source_type]);

  useEffect(() => { fetchQuestions(1); }, [itemsPerPage]);

  /* ── filter helper ── */
  const handleFilterChange = (key: keyof Filters, val: string) => {
    let next = { ...filters, [key]: val || undefined };
    if (key === 'class')   next = { ...next, subject: undefined, chapter: undefined, topic: undefined };
    if (key === 'subject') next = { ...next, chapter: undefined, topic: undefined };
    if (key === 'chapter') next = { ...next, topic: undefined };
    setFilters(next);
  };

  const clearFilters = () => { setFilters({}); setSearchTerm(''); setCurrentPage(1); fetchQuestions(1, ''); };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchQuestions(page);
  };

  /* ── single delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question permanently?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Question deleted');
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    fetchQuestions(currentPage);
  };

  /* ── bulk selection ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = new Set(displayedQs.map(q => q.id));
    setSelectedIds(selectedIds.size === allIds.size ? new Set() : allIds);
  };

  /* ── bulk delete ── */
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) { toast.error('No questions selected'); return; }
    if (!confirm(`Delete ${selectedIds.size} selected question(s) permanently? This cannot be undone.`)) return;
    setIsBulkDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase.from('questions').delete().in('id', idsArray);
      if (error) throw error;
      toast.success(`${idsArray.length} question(s) deleted`);
      setSelectedIds(new Set());
      fetchQuestions(currentPage);
    } catch (err) {
      console.error(err);
      toast.error('Bulk delete failed');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  /* ── export ── */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      let query = supabase.from('questions').select(`
        id, question_text, question_text_ur, option_a, option_b, option_c, option_d,
        option_a_ur, option_b_ur, option_c_ur, option_d_ur,
        correct_option, difficulty, question_type, source_type, source_year,
        answer_text, answer_text_ur, topic_id,
        topic:topics!inner(id,name,chapter_id,chapter:chapters!inner(id,name,chapterNo,class_subject_id,
          class_subject:class_subjects!inner(id,class_id,subject_id,
            class:classes!inner(id,name,description),
            subject:subjects!inner(id,name,name_ur)
          )
        ))
      `).order('created_at', { ascending: false });

      if (filters.difficulty)    query = query.eq('difficulty',    filters.difficulty);
      if (filters.question_type) query = query.eq('question_type', filters.question_type);
      if (filters.source_type)   query = query.eq('source_type',   filters.source_type);
      if (filters.topic)         query = query.eq('topic_id',      filters.topic);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data as any[]).map(q => {
        const cs = q.topic?.chapter?.class_subject;
        return {
          'Question (HTML)': q.question_text,
          'Question (Plain)': stripHtml(q.question_text || ''),
          'Question (Urdu)': q.question_text_ur,
          'Option A': q.option_a, 'Option B': q.option_b,
          'Option C': q.option_c, 'Option D': q.option_d,
          'Option A (Urdu)': q.option_a_ur, 'Option B (Urdu)': q.option_b_ur,
          'Option C (Urdu)': q.option_c_ur, 'Option D (Urdu)': q.option_d_ur,
          'Correct Option': q.correct_option,
          Class: cs?.class?.name || '—', Subject: cs?.subject?.name || '—',
          Chapter: q.topic?.chapter?.name || '—', Topic: q.topic?.name || '—',
          Difficulty: q.difficulty, 'Question Type': q.question_type,
          'Source Type': q.source_type, 'Source Year': q.source_year,
          Answer: q.answer_text, 'Answer (Urdu)': q.answer_text_ur,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'question_bank_export.xlsx');
      toast.success(`Exported ${rows.length} questions`);
    } catch { toast.error('Export failed'); }
    finally { setIsExporting(false); }
  };

  /* ── import ── */
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const ins  = (rows as any[]).map(row => {
        let topicId = null;
        if (row.Topic && row.Chapter) {
          const t = topics.find(t => t.name === row.Topic && chapters.find(c => c.id === t.chapter_id && c.name === row.Chapter));
          topicId = t?.id || null;
        }
        return {
          question_text: row['Question (HTML)'] || row.Question,
          question_text_ur: row['Question (Urdu)'],
          option_a: row['Option A'],   option_b: row['Option B'],
          option_c: row['Option C'],   option_d: row['Option D'],
          option_a_ur: row['Option A (Urdu)'], option_b_ur: row['Option B (Urdu)'],
          option_c_ur: row['Option C (Urdu)'], option_d_ur: row['Option D (Urdu)'],
          correct_option: row['Correct Option'],
          topic_id: topicId, difficulty: row.Difficulty,
          question_type: row['Question Type'], source_type: row['Source Type'],
          source_year: row['Source Year'],
          answer_text: row['Answer'], answer_text_ur: row['Answer (Urdu)'],
        };
      });
      const { error } = await supabase.from('questions').insert(ins);
      if (error) throw error;
      toast.success(`${rows.length} questions imported`);
      fetchQuestions(currentPage);
    } catch (err: any) {
      toast.error(`Import failed: ${err?.message || 'Error'}`);
    } finally { setIsImporting(false); e.target.value = ''; }
  };

  /* ── derived ── */
  const totalPages  = Math.ceil(totalQ / itemsPerPage);
  const startIdx    = (currentPage - 1) * itemsPerPage;
  const endIdx      = Math.min(startIdx + itemsPerPage, totalQ);
  const displayedQs = questions.filter(q => activeTab === 'all' || q?.question_type === activeTab);
  const activeCount = Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0);

  const pageNums = (() => {
    const total = totalPages, cur = currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1,2,3,4,5,'…',total];
    if (cur >= total - 3) return [1,'…',total-4,total-3,total-2,total-1,total];
    return [1,'…',cur-1,cur,cur+1,'…',total];
  })();

  /* ═════════════════════════════════════════════════════════════════════════*/
  return (
    <KatexReadyContext.Provider value={katexLoaded}>
    <AdminLayout activeTab="questions">

      <style>{`
        /* ── KaTeX + Urdu ────────────────────────────────────────────────── */

        /* 1. Don't overflow narrow table cells */
        .qb-q-cell .katex-display { margin:.25em 0; overflow-x:auto; overflow-y:hidden; }

        /* 2. Scale to match surrounding question text */
        .qb-q-cell .katex { font-size:1.05em; vertical-align:middle; }

        /* 3. Inside RTL Urdu containers, KaTeX output must render LTR.
              KaTeX generates its own BFC so we just flip direction on the
              katex root span and its display wrapper. */
        .qb-q-ur .katex,
        .qb-q-ur .katex-html { direction:ltr !important; unicode-bidi:embed; }
        .qb-q-ur .katex-display { display:block; text-align:center; }
        .qb-q-ur .katex-display > .katex { display:inline-block; }

        /* 4. Urdu font for \text{} content inside KaTeX.
              KaTeX renders \text{} as:  <span class="mord text"><span class="mord">…</span></span>
              We must target BOTH the wrapper AND the inner span, and use
              !important because KaTeX inlines font-family on the inner span. */
        .qb-q-cell .katex .mord.text > .mord,
        .qb-q-cell .katex .mord.text > .mord * {
          font-family: 'JameelNoori','Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Urdu Typesetting',serif !important;
          font-size: 1.1em !important;
          line-height: 1.5;
        }

        /* 5. Urdu plain text (outside math) — use the same JameelNoori font
              that global.css defines so it's consistent */
        .qb-q-ur {
          font-family: 'JameelNoori','Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Urdu Typesetting',serif !important;
        }

        /* 6. KaTeX error spans — show gracefully, don't break row layout */
        .qb-q-cell .katex-error { color:#c92a2a; font-size:.78em; font-family:var(--qb-mono); }

        /* ── tokens ── */
        :root {
          --qb-bg       : #f2f4f8;
          --qb-surface  : #ffffff;
          --qb-border   : #e3e7f0;
          --qb-navy     : #18243f;
          --qb-accent   : #2f54eb;
          --qb-accent-lt: #eef2ff;
          --qb-text     : #1a2540;
          --qb-muted    : #6c7a99;
          --qb-shadow   : 0 1px 4px rgba(24,36,63,.07),0 4px 18px rgba(24,36,63,.06);
          --qb-radius   : 12px;
          --qb-rsm      : 7px;
          --qb-font     : 'DM Sans','Segoe UI',system-ui,sans-serif;
          --qb-mono     : 'JetBrains Mono',ui-monospace,monospace;
          --qb-red      : #fa5252;
          --qb-red-bg   : #fff5f5;
        }

        /* ── page ── */
        .qb { background:var(--qb-bg); min-height:100vh; padding:28px 24px 60px; font-family:var(--qb-font); color:var(--qb-text); }

        /* ── header ── */
        .qb-hd { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:26px; }
        .qb-hd h1 { font-size:1.45rem; font-weight:750; color:var(--qb-navy); letter-spacing:-.5px; margin:0 0 2px; }
        .qb-hd p  { font-size:.8rem; color:var(--qb-muted); margin:0; }
        .qb-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }

        /* ── buttons ── */
        .qb-btn { display:inline-flex; align-items:center; gap:5px; font-size:.81rem; font-weight:650; border-radius:var(--qb-rsm); padding:8px 14px; border:none; cursor:pointer; transition:all .14s; white-space:nowrap; font-family:var(--qb-font); }
        .qb-btn:disabled { opacity:.5; cursor:not-allowed; }
        .qb-btn-primary { background:var(--qb-accent); color:#fff; }
        .qb-btn-primary:hover:not(:disabled) { background:#2345c8; box-shadow:0 4px 14px rgba(47,84,235,.35); }
        .qb-btn-ghost   { background:var(--qb-surface); color:var(--qb-text); border:1.5px solid var(--qb-border); }
        .qb-btn-ghost:hover:not(:disabled)   { border-color:var(--qb-accent); color:var(--qb-accent); background:var(--qb-accent-lt); }
        .qb-btn-danger  { background:var(--qb-red); color:#fff; }
        .qb-btn-danger:hover:not(:disabled) { background:#e03131; }
        .qb-btn-icon    { padding:7px 9px; position:relative; }

        /* ── tabs ── */
        .qb-tabs { display:flex; gap:3px; background:var(--qb-surface); border:1.5px solid var(--qb-border); border-radius:var(--qb-rsm); padding:4px; width:fit-content; margin-bottom:18px; }
        .qb-tab  { display:inline-flex; align-items:center; gap:5px; font-size:.79rem; font-weight:650; padding:6px 13px; border-radius:5px; border:none; background:transparent; color:var(--qb-muted); cursor:pointer; transition:all .14s; font-family:var(--qb-font); }
        .qb-tab:hover { color:var(--qb-text); }
        .qb-tab.on    { background:var(--qb-accent); color:#fff; box-shadow:0 2px 8px rgba(47,84,235,.3); }

        /* ── filter card ── */
        .qb-fc { background:var(--qb-surface); border:1.5px solid var(--qb-border); border-radius:var(--qb-radius); padding:16px 18px; margin-bottom:18px; box-shadow:var(--qb-shadow); }
        .qb-fr { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .qb-fr+.qb-fr { margin-top:10px; padding-top:10px; border-top:1px solid var(--qb-border); }
        .qb-si { position:relative; flex:1 1 210px; min-width:190px; }
        .qb-si svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--qb-muted); pointer-events:none; }
        .qb-si input { width:100%; padding:8px 10px 8px 32px; font-size:.82rem; border:1.5px solid var(--qb-border); border-radius:var(--qb-rsm); background:var(--qb-bg); color:var(--qb-text); outline:none; transition:border .13s; font-family:var(--qb-font); box-sizing:border-box; }
        .qb-si input:focus { border-color:var(--qb-accent); background:#fff; }
        .qb-sel { flex:1 1 130px; min-width:120px; padding:8px 10px; font-size:.81rem; border:1.5px solid var(--qb-border); border-radius:var(--qb-rsm); background:var(--qb-bg); color:var(--qb-text); outline:none; cursor:pointer; font-family:var(--qb-font); transition:border .13s; }
        .qb-sel:focus    { border-color:var(--qb-accent); background:#fff; }
        .qb-sel:disabled { opacity:.4; cursor:not-allowed; }
        .qb-fbadge { position:absolute; top:-6px; right:-6px; background:var(--qb-accent); color:#fff; font-size:.66rem; font-weight:700; border-radius:99px; width:16px; height:16px; display:flex; align-items:center; justify-content:center; }

        /* ── bulk action bar ── */
        .qb-bulk-bar { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--qb-accent-lt); border:1.5px solid var(--qb-accent); border-radius:var(--qb-rsm); margin-bottom:12px; animation:qb-slideDown .2s ease; }
        @keyframes qb-slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .qb-bulk-bar span { font-size:.82rem; font-weight:650; color:var(--qb-accent); }

        /* ── stats bar ── */
        .qb-sb  { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
        .qb-sb-l { font-size:.8rem; color:var(--qb-muted); }
        .qb-sb-l strong { color:var(--qb-text); }
        .qb-sb-r { display:flex; align-items:center; gap:7px; font-size:.8rem; color:var(--qb-muted); }
        .qb-pps { padding:5px 8px; font-size:.78rem; border:1.5px solid var(--qb-border); border-radius:6px; background:var(--qb-surface); color:var(--qb-text); cursor:pointer; font-family:var(--qb-font); }

        /* ── table card ── */
        .qb-card  { background:var(--qb-surface); border:1.5px solid var(--qb-border); border-radius:var(--qb-radius); box-shadow:var(--qb-shadow); overflow:hidden; margin-bottom:20px; }
        .qb-tw    { overflow-x:auto; }
        .qb-table { width:100%; border-collapse:collapse; font-size:.82rem; }
        .qb-table thead tr { background:#f7f8fc; border-bottom:2px solid var(--qb-border); }
        .qb-table th { padding:10px 13px; font-size:.71rem; font-weight:750; text-transform:uppercase; letter-spacing:.07em; color:var(--qb-muted); text-align:left; white-space:nowrap; }
        .qb-table td { padding:12px 13px; vertical-align:top; border-bottom:1px solid #eff1f8; }
        .qb-table tbody tr:hover { background:#f9fafd; }
        .qb-table tbody tr.selected { background:#eef2ff; }
        .qb-table tbody tr:last-child td { border-bottom:none; }
        .qb-cb { width:16px; height:16px; cursor:pointer; accent-color:var(--qb-accent); margin:0; }

        /* ── question cell ── */
        .qb-q-cell { max-width:400px; min-width:220px; }
        .qb-q-en {
          color:var(--qb-text); line-height:1.55; word-break:break-word;
        }
        .qb-q-en p        { margin:.15em 0; }
        .qb-q-en ul,
        .qb-q-en ol       { margin:.2em 0 .2em 1.2em; }
        .qb-q-en table    { border-collapse:collapse; font-size:.9em; }
        .qb-q-en table td,
        .qb-q-en table th { border:1px solid #cdd0db; padding:3px 7px; }
        .qb-q-en img      { max-width:100%; height:auto; border-radius:4px; }
        .qb-q-divider { height:1px; background:var(--qb-border); margin:7px 0; }
        .qb-q-ur {
          direction:rtl; text-align:right;
          font-family:"Jameel Noori Nastaleeq","Noto Nastaliq Urdu","Urdu Typesetting",serif;
          font-size:.95rem; line-height:1.9; color:#374466;
          word-break:break-word;
        }
        .qb-q-ur p { margin:.1em 0; }
        .qb-serial { font-size:.73rem; color:var(--qb-muted); font-family:var(--qb-mono); white-space:nowrap; }

        /* ── badges ── */
        .qb-badge  { display:inline-flex; align-items:center; font-size:.69rem; font-weight:750; letter-spacing:.04em; padding:3px 9px; border-radius:99px; white-space:nowrap; }
        .qb-b-type { background:var(--qb-accent-lt); color:var(--qb-accent); }
        .qb-easy   { background:#ebfbee; color:#2b8a3e; }
        .qb-medium { background:#fff3bf; color:#d97706; }
        .qb-hard   { background:#ffe3e3; color:#c92a2a; }
        .qb-b-source { background:#f1f3f9; color:var(--qb-muted); }

        /* ── action btns ── */
        .qb-ab { display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; border-radius:6px; border:1.5px solid var(--qb-border); background:var(--qb-surface); color:var(--qb-muted); cursor:pointer; transition:all .13s; }
        .qb-ab:hover.edit   { border-color:var(--qb-accent); color:var(--qb-accent); background:var(--qb-accent-lt); }
        .qb-ab:hover.delete { border-color:var(--qb-red); color:var(--qb-red); background:var(--qb-red-bg); }

        /* ── empty ── */
        .qb-empty { text-align:center; padding:60px 24px; color:var(--qb-muted); }
        .qb-empty-ico { font-size:2.8rem; margin-bottom:10px; opacity:.25; }
        .qb-empty h3 { font-size:.95rem; font-weight:700; color:var(--qb-text); margin:0 0 5px; }
        .qb-empty p  { font-size:.8rem; margin:0; }

        /* ── loader ── */
        .qb-loader { text-align:center; padding:80px; }
        .qb-spin   { width:36px; height:36px; border:3px solid var(--qb-border); border-top-color:var(--qb-accent); border-radius:50%; animation:qs .65s linear infinite; margin:0 auto; }
        @keyframes qs { to { transform:rotate(360deg); } }

        /* ── pagination ── */
        .qb-pg  { display:flex; justify-content:center; align-items:center; gap:4px; flex-wrap:wrap; padding-top:4px; }
        .qb-pgb { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:34px; padding:0 6px; border-radius:7px; border:1.5px solid var(--qb-border); background:var(--qb-surface); color:var(--qb-text); font-size:.81rem; font-weight:650; cursor:pointer; transition:all .13s; font-family:var(--qb-font); }
        .qb-pgb:hover:not(:disabled):not(.on) { border-color:var(--qb-accent); color:var(--qb-accent); }
        .qb-pgb.on       { background:var(--qb-accent); border-color:var(--qb-accent); color:#fff; }
        .qb-pgb:disabled { opacity:.3; cursor:not-allowed; }
        .qb-pgb.dots     { border:none; background:transparent; cursor:default; color:var(--qb-muted); letter-spacing:.1em; }

        /* ── modal ── */
        .qb-mo { position:fixed; inset:0; background:rgba(18,30,64,.6); z-index:1050; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px); }
        .qb-md { background:var(--qb-surface); border-radius:var(--qb-radius); box-shadow:0 12px 48px rgba(18,30,64,.22); width:100%; max-width:900px; max-height:94vh; display:flex; flex-direction:column; overflow:hidden; }
        .qb-mhd { display:flex; justify-content:space-between; align-items:center; padding:16px 22px; border-bottom:1.5px solid var(--qb-border); background:#f7f8fc; }
        .qb-mhd h5 { font-size:.95rem; font-weight:750; color:var(--qb-navy); margin:0; }
        .qb-mbd { overflow-y:auto; flex:1; padding:22px; }
        .qb-xcl { display:inline-flex; align-items:center; justify-content:center; width:29px; height:29px; border-radius:6px; border:1.5px solid var(--qb-border); background:transparent; color:var(--qb-muted); cursor:pointer; transition:all .13s; }
        .qb-xcl:hover { border-color:var(--qb-red); color:var(--qb-red); background:var(--qb-red-bg); }
        .qb-meta { display:flex; flex-direction:column; gap:2px; }
        .qb-meta-main { font-size:.82rem; color:var(--qb-text); white-space:nowrap; }
        .qb-meta-sub  { font-size:.73rem; color:var(--qb-muted); white-space:nowrap; }

        @media (max-width:768px) {
          .qb { padding:14px 10px 40px; }
          .qb-hd h1 { font-size:1.15rem; }
          .qb-table th, .qb-table td { padding:9px 8px; }
          .qb-q-cell { max-width:220px; }
        }
      `}</style>

      <div className="qb">

        {/* ── Header ── */}
        <div className="qb-hd">
          <div>
            <h1>Question Bank</h1>
            <p>{totalQ.toLocaleString()} total questions</p>
          </div>
          <div className="qb-actions">
            <label className={`qb-btn qb-btn-ghost${isImporting ? ' qb-btn:disabled' : ''}`} style={{ cursor: isImporting ? 'not-allowed' : 'pointer' }}>
              <FiUpload size={13} />
              {isImporting ? 'Importing…' : 'Import'}
              <input type="file" style={{ display: 'none' }} onChange={handleImport} accept=".xlsx,.xls" disabled={isImporting} />
            </label>
            <button className="qb-btn qb-btn-ghost" onClick={handleExport} disabled={isExporting || totalQ === 0}>
              <FiDownload size={13} />
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
            <button className="qb-btn qb-btn-primary" onClick={() => { setSelQ(null); setShowModal(true); }}>
              <FiPlus size={13} /> Add Question
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="qb-tabs">
          {TAB_TYPES.map(t => (
            <button key={t.value} className={`qb-tab${activeTab === t.value ? ' on' : ''}`}
              onClick={() => setActiveTab(t.value as any)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="qb-fc">
          <div className="qb-fr">
            <div className="qb-si">
              <FiSearch size={13} />
              <input
                type="text"
                placeholder="Search questions…"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(() => { setCurrentPage(1); fetchQuestions(1, e.target.value); }, 380);
                }}
              />
            </div>
            <select className="qb-sel" value={filters.class || ''} onChange={e => handleFilterChange('class', e.target.value)}>
              <option value="">All Classes</option>
              {sortedClasses().map(c => <option key={c.id} value={c.id}>{c.name}{c.description ? ` – ${c.description}` : ''}</option>)}
            </select>
            <select className="qb-sel" value={filters.subject || ''} onChange={e => handleFilterChange('subject', e.target.value)} disabled={!filters.class}>
              <option value="">All Subjects</option>
              {filteredSubjects().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="qb-sel" value={filters.chapter || ''} onChange={e => handleFilterChange('chapter', e.target.value)} disabled={!filters.class || !filters.subject}>
              <option value="">All Chapters</option>
              {filteredChapters().map(c => <option key={c.id} value={c.id}>{c.chapterNo ? `Ch ${c.chapterNo}: ` : ''}{c.name}</option>)}
            </select>
            <select className="qb-sel" value={filters.topic || ''} onChange={e => handleFilterChange('topic', e.target.value)} disabled={!filters.chapter}>
              <option value="">All Topics</option>
              {filteredTopics().map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="qb-btn qb-btn-ghost qb-btn-icon" onClick={clearFilters} title="Clear all filters">
              <FiX size={13} />
              {activeCount > 0 && <span className="qb-fbadge">{activeCount}</span>}
            </button>
          </div>
          <div className="qb-fr">
            <select className="qb-sel" style={{ flex: '0 1 140px' }} value={filters.difficulty || ''} onChange={e => handleFilterChange('difficulty', e.target.value)}>
              <option value="">All Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select className="qb-sel" style={{ flex: '0 1 200px' }} value={filters.question_type || ''} onChange={e => handleFilterChange('question_type', e.target.value)}>
              <option value="">All Types</option>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="qb-sel" style={{ flex: '0 1 155px' }} value={filters.source_type || ''} onChange={e => handleFilterChange('source_type', e.target.value)}>
              <option value="">All Sources</option>
              <option value="book">Book</option>
              <option value="past_paper">Past Paper</option>
              <option value="model_paper">Model Paper</option>
              <option value="conceptual">Conceptual</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {/* ── Bulk Action Bar ── */}
        {selectedIds.size > 0 && (
          <div className="qb-bulk-bar">
            <FiCheckSquare size={16} style={{ color: 'var(--qb-accent)' }} />
            <span>{selectedIds.size} question(s) selected</span>
            <button
              className="qb-btn qb-btn-danger"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              style={{ marginLeft: 'auto', fontSize: '.78rem', padding: '6px 12px' }}
            >
              <FiTrash2 size={13} />
              {isBulkDeleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}
            </button>
          </div>
        )}

        {/* ── Stats bar ── */}
        <div className="qb-sb">
          <span className="qb-sb-l">
            Showing <strong>{totalQ === 0 ? 0 : startIdx + 1}–{endIdx}</strong> of <strong>{totalQ.toLocaleString()}</strong> questions
          </span>
          <div className="qb-sb-r">
            Per page:
            <select className="qb-pps" value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              {[20, 50, 100, 150, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="qb-loader"><div className="qb-spin" /></div>
        ) : (
          <>
            <div className="qb-card">
              <div className="qb-tw">
                <table className="qb-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          className="qb-cb"
                          checked={displayedQs.length > 0 && selectedIds.size === displayedQs.length}
                          ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < displayedQs.length; }}
                          onChange={toggleSelectAll}
                          title="Select / Deselect all on this page"
                        />
                      </th>
                      <th style={{ width: 38 }}>#</th>
                      <th>Question</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Chapter</th>
                      <th>Topic</th>
                      <th>Type</th>
                      <th>Diff.</th>
                      <th>Source</th>
                      <th style={{ width: 72 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedQs.length > 0 ? displayedQs.map((q, i) => {
                      const diff = DIFF[q?.difficulty] || { cls: 'qb-b-source', label: q?.difficulty };
                      const isSelected = selectedIds.has(q.id);
                      return (
                        <tr key={q?.id} className={isSelected ? 'selected' : ''}>
                          <td>
                            <input type="checkbox" className="qb-cb" checked={isSelected} onChange={() => toggleSelect(q.id)} />
                          </td>
                          <td><span className="qb-serial">{startIdx + i + 1}</span></td>
                          <td>
                            <QuestionCell en={q?.question_text} ur={q?.question_text_ur} />
                          </td>
                          <td>
                            <div className="qb-meta">
                              <span className="qb-meta-main">{(q as any)?._class || '—'}</span>
                              {(q as any)?._class_desc && <span className="qb-meta-sub">{(q as any)._class_desc}</span>}
                            </div>
                          </td>
                          <td><span className="qb-meta-main">{(q as any)?._subject || '—'}</span></td>
                          <td>
                            <div className="qb-meta">
                              {q?.topic?.chapter?.chapterNo && <span className="qb-meta-sub">Ch {q.topic.chapter.chapterNo}</span>}
                              <span className="qb-meta-main" style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                {q?.topic?.chapter?.name || '—'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="qb-meta-main" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {q?.topic?.name || '—'}
                            </span>
                          </td>
                          <td><span className="qb-badge qb-b-type">{getTypeLabel(q?.question_type)}</span></td>
                          <td><span className={`qb-badge ${diff.cls}`}>{diff.label}</span></td>
                          <td>
                            <div className="qb-meta">
                              <span className="qb-badge qb-b-source">{q?.source_type?.replace(/_/g,' ')}</span>
                              {q?.source_year && <span className="qb-meta-sub">{q.source_year}</span>}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="qb-ab edit" title="Edit" onClick={() => { setSelQ(q); setShowModal(true); }}>
                                <FiEdit size={12} />
                              </button>
                              <button className="qb-ab delete" title="Delete" onClick={() => handleDelete(q?.id)}>
                                <FiTrash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={11}>
                          <div className="qb-empty">
                            <div className="qb-empty-ico">📭</div>
                            <h3>No questions found</h3>
                            <p>Try adjusting your filters or search term</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="qb-pg">
                <button className="qb-pgb" onClick={() => handlePageChange(1)} disabled={currentPage === 1}><FiChevronsLeft size={12} /></button>
                <button className="qb-pgb" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><FiChevronLeft size={12} /></button>
                {pageNums.map((p, idx) =>
                  p === '…' ? (
                    <button key={`dots-${idx}`} className="qb-pgb dots" disabled>…</button>
                  ) : (
                    <button key={p} className={`qb-pgb${currentPage === p ? ' on' : ''}`}
                      onClick={() => handlePageChange(p as number)}>{p}</button>
                  )
                )}
                <button className="qb-pgb" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><FiChevronRight size={12} /></button>
                <button className="qb-pgb" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}><FiChevronsRight size={12} /></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="qb-mo" onClick={() => setShowModal(false)}>
          <div className="qb-md" onClick={e => e.stopPropagation()}>
            <div className="qb-mhd">
              <h5>{selQ ? '✏️ Edit Question' : '➕ Add New Question'}</h5>
              <button className="qb-xcl" onClick={() => setShowModal(false)}><FiX size={13} /></button>
            </div>
            <div className="qb-mbd">
              <QuestionForm
                question={selQ}
                classes={classes}
                subjects={subjects}
                classSubjects={classSubjects}
                chapters={chapters}
                topics={topics}
                onClose={() => { setShowModal(false); fetchQuestions(currentPage); }}
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
    </KatexReadyContext.Provider>
  );
}
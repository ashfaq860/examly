'use client';
import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { 
  FiSearch, FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, FiX,
  FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import DOMPurify from 'dompurify';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

const QuestionForm = dynamic(() => import('@/components/QuestionForm'), { ssr: false });

interface Question {
  id: string;
  question_text: string;
  question_text_ur?: string | null;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  option_a_ur?: string | null;
  option_b_ur?: string | null;
  option_c_ur?: string | null;
  option_d_ur?: string | null;
  correct_option?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'short' | 'long';
  answer_text?: string | null;
  answer_text_ur?: string | null;
  source_type: 'book' | 'past_paper' | 'model_paper' | 'custom';
  source_year?: number | null;
  created_at: string;
  class_subject_id?: string | null;
  subject?: { 
    name: string;
    class_subjects?: {
      class_id: string;
      class: { name: string }
    }[];
  };
  chapter?: { name: string };
  topic?: { name: string };
  class?: string;
  class_description?: string;
}

interface Subject { id: string; name: string; grade?: string | null; }
interface Chapter { id: string; name: string; subject_id: string; class_subject_id?: string; }
interface Topic { id: string; name: string; chapter_id: string; }
interface Class { id: string; name: string; description?: string | null; }
interface ClassSubject { 
  id: string; 
  class_id: string; 
  subject_id: string; 
  subject?: Subject; 
  class?: {
    id: string;
    name: string;
    description?: string;
  };
} 

interface Filters {
  class?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  question_type?: string;
  source_type?: string;
}

// Helper function to strip HTML tags for text display
const stripHtmlTags = (html: string | null | undefined): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

// Helper function to safely render HTML content
const SafeHtmlRender: React.FC<{ 
  html: string | null | undefined;
  maxLength?: number;
  className?: string;
}> = ({ html, maxLength, className = '' }) => {
  if (!html) return null;
  
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table',
      'tr', 'td', 'th', 'tbody', 'thead', 'img', 'a'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style', 'class', 'width', 'height']
  });

  let displayHtml = sanitizedHtml;
  let isTruncated = false;
  
  if (maxLength && sanitizedHtml.length > maxLength) {
    const textContent = stripHtmlTags(sanitizedHtml);
    if (textContent.length > maxLength) {
      displayHtml = textContent.substring(0, maxLength) + '...';
      isTruncated = true;
    }
  }

  if (isTruncated) {
    return <span className={className} title={stripHtmlTags(html)}>{displayHtml}</span>;
  }

  return (
    <div 
      className={`question-content ${className}`}
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  );
};

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mcq' | 'short' | 'long'>('all');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalFilteredQuestions, setTotalFilteredQuestions] = useState(0);
  
  const router = useRouter();

  // ✅ Check admin
  useEffect(() => {
    async function init() {
      setLoading(true);
      const admin = await isUserAdmin();
      if (!admin) {
        router.replace("/unauthorized");
        return;
      }
      setLoading(false);
    }
    init();
  }, [router]);

  // Fetch Functions
  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      setClasses(data as Class[]);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) throw error;
      setSubjects(data as Subject[]);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects');
    }
  };

  const fetchChapters = async () => {
    try {
      const { data, error } = await supabase.from('chapters').select('*').order('chapterNo');
      if (error) throw error;
      setChapters(data as Chapter[]);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      toast.error('Failed to load chapters');
    }
  };

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase.from('topics').select('*').order('name');
      if (error) throw error;
      setTopics(data as Topic[]);
    } catch (error) {
      console.error('Error fetching topics:', error);
      toast.error('Failed to load topics');
    }
  };

  const fetchClassSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .select(`
          id, 
          class_id, 
          subject_id, 
          subject:subjects(id, name),
          class:classes(id, name, description)
        `)
        .order('class_id');
      
      if (error) {
        console.error('Error fetching class subjects:', error);
        throw error;
      }
      
      setClassSubjects(data as ClassSubject[]);
      
    } catch (error) {
      console.error('Error in fetchClassSubjects:', error);
      toast.error('Failed to load subjects for classes');
    }
  };

  // Get filtered data based on hierarchy
  const getFilteredSubjects = () => {
    if (!filters.class) return [];
    return classSubjects
      .filter(cs => cs.class_id === filters.class)
      .map(cs => ({
        id: cs.subject_id,
        name: cs.subject?.name || 'Unknown Subject'
      }));
  };

  const getFilteredChapters = () => {
    if (!filters.class || !filters.subject) return [];
    
    const classSubject = classSubjects.find(
      cs => cs.class_id === filters.class && cs.subject_id === filters.subject
    );
    
    if (!classSubject) return [];
    
    return chapters.filter(chapter => chapter.class_subject_id === classSubject.id);
  };

  const getFilteredTopics = () => {
    if (!filters.chapter) return [];
    return topics.filter(topic => topic.chapter_id === filters.chapter);
  };

  const fetchQuestions = async (page = 1, isSearchOrTabChange = false) => {
    setLoading(true);
    try {
      // Build the base query for counting total
      let countQuery = supabase
        .from('questions')
        .select('id', { count: 'exact', head: true });

      // Build the base query for fetching data
      let dataQuery = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          question_text_ur,
          option_a,
          option_b,
          option_c,
          option_d,
          option_a_ur,
          option_b_ur,
          option_c_ur,
          option_d_ur,
          correct_option,
          difficulty,
          question_type,
          source_type,
          source_year,
          answer_text,
          answer_text_ur,
          created_at,
          subject_id,
          chapter_id,
          topic_id,
          class_subject_id,
          subject:subjects(name),
          chapter:chapters(name),
          topic:topics(name),
          class_subject:class_subjects!fk_questions_class_subjects(
            class_id,
            class:classes(name, description)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by class via class_subject_id
      if (filters.class) {
        const classSubjectIds = classSubjects
          .filter(cs => cs.class_id === filters.class)
          .map(cs => cs.id);
        if (classSubjectIds.length > 0) {
          countQuery = countQuery.in('class_subject_id', classSubjectIds);
          dataQuery = dataQuery.in('class_subject_id', classSubjectIds);
        } else {
          setQuestions([]);
          setTotalQuestions(0);
          setTotalFilteredQuestions(0);
          setLoading(false);
          return;
        }
      }

      // Filter by subject via class_subject_id
      if (filters.subject) {
        const classSubjectIds = classSubjects
          .filter(cs => cs.subject_id === filters.subject)
          .map(cs => cs.id);
        if (classSubjectIds.length > 0) {
          countQuery = countQuery.in('class_subject_id', classSubjectIds);
          dataQuery = dataQuery.in('class_subject_id', classSubjectIds);
        } else {
          setQuestions([]);
          setTotalQuestions(0);
          setTotalFilteredQuestions(0);
          setLoading(false);
          return;
        }
      }

      // Apply other filters
      if (filters.chapter) {
        countQuery = countQuery.eq('chapter_id', filters.chapter);
        dataQuery = dataQuery.eq('chapter_id', filters.chapter);
      }
      if (filters.topic) {
        countQuery = countQuery.eq('topic_id', filters.topic);
        dataQuery = dataQuery.eq('topic_id', filters.topic);
      }
      if (filters.difficulty) {
        countQuery = countQuery.eq('difficulty', filters.difficulty);
        dataQuery = dataQuery.eq('difficulty', filters.difficulty);
      }
      if (filters.question_type) {
        countQuery = countQuery.eq('question_type', filters.question_type);
        dataQuery = dataQuery.eq('question_type', filters.question_type);
      }
      if (filters.source_type) {
        countQuery = countQuery.eq('source_type', filters.source_type);
        dataQuery = dataQuery.eq('source_type', filters.source_type);
      }

      // Apply search filter if exists
      if (searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        countQuery = countQuery.or(`question_text.ilike.${searchPattern},question_text_ur.ilike.${searchPattern},subject:name.ilike.${searchPattern},chapter:name.ilike.${searchPattern},topic:name.ilike.${searchPattern}`);
        dataQuery = dataQuery.or(`question_text.ilike.${searchPattern},question_text_ur.ilike.${searchPattern},subject:name.ilike.${searchPattern},chapter:name.ilike.${searchPattern},topic:name.ilike.${searchPattern}`);
      }

      // Apply active tab filter if not 'all'
      if (activeTab !== 'all') {
        countQuery = countQuery.eq('question_type', activeTab);
        dataQuery = dataQuery.eq('question_type', activeTab);
      }

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) {
        console.error('Count query error:', countError);
        throw countError;
      }
      
      const total = count || 0;
      setTotalQuestions(total);
      setTotalFilteredQuestions(total);

      // Calculate pagination
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      dataQuery = dataQuery.range(from, to);

      const { data, error } = await dataQuery;

      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }
      
      const processedData = (data as any[]).map(q => ({
        ...q,
        class: q.class_subject?.class?.name ? String(q.class_subject.class.name) : '-',
        class_description: q.class_subject?.class?.description ? String(q.class_subject.class.description) : '-',
        subject: q.subject || { name: '-' }
      })) as Question[];

      setQuestions(processedData);
      setCurrentPage(page);

      // If this was triggered by search/tab change and we got no results, reset to page 1
      if (isSearchOrTabChange && processedData.length === 0 && page > 1) {
        setCurrentPage(1);
      }

    } catch (error: any) {
      console.error('Error fetching questions:', error);
      
      if (error?.message) console.error('Message:', error.message);
      if (error?.code) console.error('Code:', error.code);
      if (error?.details) console.error('Details:', error.details);
      
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchClasses(),
        fetchSubjects(),
        fetchChapters(),
        fetchTopics(),
        fetchClassSubjects(),
      ]);
      await fetchQuestions();
    };
    initializeData();
  }, []);

  // Reset dependent filters when parent filter changes
  useEffect(() => {
    setFilters(prev => ({
      class: prev.class,
      subject: undefined,
      chapter: undefined,
      topic: undefined,
      difficulty: prev.difficulty,
      question_type: prev.question_type,
      source_type: prev.source_type
    }));
  }, [filters.class]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      chapter: undefined,
      topic: undefined
    }));
  }, [filters.subject]);

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      topic: undefined
    }));
  }, [filters.chapter]);

  // Refetch questions when filters change
  useEffect(() => {
    if (classSubjects.length > 0) {
      setCurrentPage(1);
      fetchQuestions(1);
    }
  }, [filters, classSubjects]);

  // Refetch questions when items per page changes
  useEffect(() => {
    if (classSubjects.length > 0) {
      fetchQuestions(1);
    }
  }, [itemsPerPage]);

  // Refetch questions when search term changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (classSubjects.length > 0) {
        setCurrentPage(1);
        fetchQuestions(1, true);
      }
    }, 500); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Refetch questions when active tab changes
  useEffect(() => {
    if (classSubjects.length > 0) {
      setCurrentPage(1);
      fetchQuestions(1, true);
    }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      
      await fetchQuestions(currentPage);
      toast.success('Question deleted');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let query = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          question_text_ur,
          option_a,
          option_b,
          option_c,
          option_d,
          option_a_ur,
          option_b_ur,
          option_c_ur,
          option_d_ur,
          correct_option,
          difficulty,
          question_type,
          source_type,
          source_year,
          answer_text,
          answer_text_ur,
          subject_id,
          chapter_id,
          topic_id,
          class_subject_id,
          subject:subjects(name),
          chapter:chapters(name),
          topic:topics(name),
          class_subject:class_subjects!fk_questions_class_subjects(
            class_id,
            class:classes(name, description)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply all filters for export
      if (filters.class) {
        const classSubjectIds = classSubjects
          .filter(cs => cs.class_id === filters.class)
          .map(cs => cs.id);
        if (classSubjectIds.length > 0) {
          query = query.in('class_subject_id', classSubjectIds);
        }
      }

      if (filters.subject) {
        const classSubjectIds = classSubjects
          .filter(cs => cs.subject_id === filters.subject)
          .map(cs => cs.id);
        if (classSubjectIds.length > 0) {
          query = query.in('class_subject_id', classSubjectIds);
        }
      }

      if (filters.chapter) query = query.eq('chapter_id', filters.chapter);
      if (filters.topic) query = query.eq('topic_id', filters.topic);
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters.question_type) query = query.eq('question_type', filters.question_type);
      if (filters.source_type) query = query.eq('source_type', filters.source_type);

      if (searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        query = query.or(`question_text.ilike.${searchPattern},question_text_ur.ilike.${searchPattern}`);
      }

      if (activeTab !== 'all') {
        query = query.eq('question_type', activeTab);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const dataToExport = (data as any[]).map(q => ({
        ID: q.id,
        Question: stripHtmlTags(q.question_text),
        'Question (Urdu)': stripHtmlTags(q.question_text_ur),
        'Option A': stripHtmlTags(q.option_a),
        'Option B': stripHtmlTags(q.option_b),
        'Option C': stripHtmlTags(q.option_c),
        'Option D': stripHtmlTags(q.option_d),
        'Option A (Urdu)': stripHtmlTags(q.option_a_ur),
        'Option B (Urdu)': stripHtmlTags(q.option_b_ur),
        'Option C (Urdu)': stripHtmlTags(q.option_c_ur),
        'Option D (Urdu)': stripHtmlTags(q.option_d_ur),
        'Correct Option': q.correct_option,
        'Class': q.class_subject?.class?.name || '-',
        'Subject': q.subject?.name || '-',
        'Chapter': q.chapter?.name || '-',
        'Topic': q.topic?.name || '-',
        'Difficulty': q.difficulty,
        'Question Type': q.question_type,
        'Source Type': q.source_type,
        'Source Year': q.source_year,
        'Answer Text': stripHtmlTags(q.answer_text),
        'Answer Text (Urdu)': stripHtmlTags(q.answer_text_ur),
        'Created At': new Date(q.created_at).toLocaleDateString()
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      
      // Set column widths
      const wscols = [
        { wch: 10 }, // ID
        { wch: 50 }, // Question
        { wch: 50 }, // Question Urdu
        { wch: 20 }, // Option A
        { wch: 20 }, // Option B
        { wch: 20 }, // Option C
        { wch: 20 }, // Option D
        { wch: 20 }, // Option A Urdu
        { wch: 20 }, // Option B Urdu
        { wch: 20 }, // Option C Urdu
        { wch: 20 }, // Option D Urdu
        { wch: 15 }, // Correct Option
        { wch: 15 }, // Class
        { wch: 20 }, // Subject
        { wch: 20 }, // Chapter
        { wch: 20 }, // Topic
        { wch: 10 }, // Difficulty
        { wch: 10 }, // Question Type
        { wch: 15 }, // Source Type
        { wch: 10 }, // Source Year
        { wch: 50 }, // Answer Text
        { wch: 50 }, // Answer Text Urdu
        { wch: 15 }, // Created At
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, `question_bank_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exported ${dataToExport.length} questions successfully`);
    } catch (error) {
      console.error('Error exporting questions:', error);
      toast.error('Failed to export questions');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const insertData = (rows as any[]).map((row: any) => {
        const subjectId =
          row['Subject ID'] ||
          subjects.find(s => s.name === row.Subject)?.id ||
          null;

        const chapterId =
          chapters.find(c => c.name === row.Chapter)?.id || null;

        const topicId =
          topics.find(t => t.name === row.Topic)?.id || null;

        let classSubjectId = null;
        if (row['Class ID'] && subjectId) {
          const classSubject = classSubjects.find(
            cs => cs.class_id === row['Class ID'] && cs.subject_id === subjectId
          );
          classSubjectId = classSubject?.id || null;
        }

        return {
          question_text: row.Question,
          question_text_ur: row['Question (Urdu)'],
          option_a: row['Option A'],
          option_b: row['Option B'],
          option_c: row['Option C'],
          option_d: row['Option D'],
          option_a_ur: row['Option A (Urdu)'],
          option_b_ur: row['Option B (Urdu)'],
          option_c_ur: row['Option C (Urdu)'],
          option_d_ur: row['Option D (Urdu)'],
          correct_option: row['Correct Option'],
          subject_id: subjectId,
          chapter_id: chapterId,
          topic_id: topicId,
          class_subject_id: classSubjectId,
          difficulty: row.Difficulty,
          question_type: row['Question Type'],
          source_type: row['Source Type'],
          source_year: row['Source Year'],
          answer_text: row['Answer Text'],
          answer_text_ur: row['Answer Text (Urdu)']
        };
      });

      const { error } = await supabase.from('questions').insert(insertData);
      if (error) throw error;
      toast.success(`${(rows as any[]).length} questions imported successfully`);
      await fetchQuestions(currentPage);
    } catch (error) {
      console.error('Error importing questions:', error);
      toast.error('Failed to import questions');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(totalFilteredQuestions / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalFilteredQuestions);

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Helper function to get nav link class
  const getNavLinkClass = (tab: string) => {
    return `nav-link ${activeTab === tab ? 'active' : ''}`;
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchQuestions(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  // Generate pagination range
  const getPaginationRange = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    range.push(1);
    
    for (let i = currentPage - delta; i <= currentPage + delta; i++) {
      if (i > 1 && i < totalPages) {
        range.push(i);
      }
    }
    
    if (totalPages > 1) {
      range.push(totalPages);
    }
    
    range.sort((a, b) => a - b);
    
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    
    return rangeWithDots;
  };

  return (
    <AdminLayout activeTab="questions">
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 mb-md-4">
          {/* Left side (Heading) */}
          <h2 className="mb-2 mb-md-0 text-center text-md-start fs-4 fs-md-2">
            Question Bank Management
          </h2>

          {/* Right side (Buttons) */}
          <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-md-end">
            <button 
              className="btn btn-primary"
              onClick={() => { setSelectedQuestion(null); setShowModal(true); }}
            >
              <FiPlus className="me-1" /> Add Question
            </button>

            <label className="btn btn-secondary mb-0">
              <FiUpload className="me-1" /> 
              {isImporting ? 'Importing...' : 'Import'}
              <input 
                type="file" 
                className="d-none" 
                onChange={handleImport}
                accept=".xlsx,.xls"
                disabled={isImporting}
              />
            </label>

            <button 
              className="btn btn-success" 
              onClick={handleExport}
              disabled={isExporting || totalFilteredQuestions === 0}
            >
              <FiDownload className="me-1" /> 
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* Tabs for question types */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button 
              className={getNavLinkClass('all')}
              onClick={() => setActiveTab('all')}
            >
              All Questions
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={getNavLinkClass('mcq')}
              onClick={() => setActiveTab('mcq')}
            >
              MCQ
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={getNavLinkClass('short')}
              onClick={() => setActiveTab('short')}
            >
              Short Questions
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={getNavLinkClass('long')}
              onClick={() => setActiveTab('long')}
            >
              Long Questions
            </button>
          </li>
        </ul>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-md-3">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{marginBottom: '0px'}}
                  />
                  <button className="btn btn-outline-secondary" style={{paddingBottom: '8px', borderColor: '#ccc'}} type="button">
                    <FiSearch />
                  </button>
                </div>
              </div>
              
              {/* Class Filter */}
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.class || ''}
                  onChange={e => setFilters({...filters, class: e.target.value || undefined})}
                >
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}-{c.description}</option>
                  ))}
                </select>
              </div>

              {/* Subject Filter (dependent on Class) */}
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.subject || ''}
                  onChange={e => setFilters({...filters, subject: e.target.value || undefined})}
                  disabled={!filters.class}
                >
                  <option value="">All Subjects</option>
                  {getFilteredSubjects().map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter Filter (dependent on Class and Subject) */}
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.chapter || ''}
                  onChange={e => setFilters({...filters, chapter: e.target.value || undefined})}
                  disabled={!filters.class || !filters.subject}
                >
                  <option value="">All Chapters</option>
                  {getFilteredChapters().map(chapter => (
                    <option key={chapter?.id} value={chapter?.id}>{chapter?.name}</option>
                  ))}
                </select>
              </div>

              {/* Topic Filter (dependent on Chapter) */}
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.topic || ''}
                  onChange={e => setFilters({...filters, topic: e.target.value || undefined})}
                  disabled={!filters.chapter}
                >
                  <option value="">All Topics</option>
                  {getFilteredTopics().map(topic => (
                    <option key={topic?.id} value={topic?.id}>{topic?.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-1">
                <button 
                  className="btn btn-outline-danger w-100"
                  onClick={clearAllFilters}
                  title="Clear all filters"
                >
                  <FiX />
                </button>
              </div>
            </div>

            {/* Additional Filters Row */}
            <div className="row g-3 mt-2">
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.difficulty || ''}
                  onChange={e => setFilters({...filters, difficulty: e.target.value || undefined})}
                >
                  <option value="">All Difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.question_type || ''}
                  onChange={e => setFilters({...filters, question_type: e.target.value || undefined})}
                >
                  <option value="">All Types</option>
                  <option value="mcq">MCQ</option>
                  <option value="short">Short</option>
                  <option value="long">Long</option>
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.source_type || ''}
                  onChange={e => setFilters({...filters, source_type: e.target.value || undefined})}
                >
                  <option value="">All Sources</option>
                  <option value="book">Book</option>
                  <option value="past_paper">Past Paper</option>
                  <option value="model_paper">Model Paper</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Info and Items Per Page */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted">
            {totalFilteredQuestions > 0 ? (
              <>
                Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{' '}
                <strong>{totalFilteredQuestions}</strong> questions
              </>
            ) : (
              'No questions found'
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted">Items per page:</span>
            <select 
              className="form-select form-select-sm w-auto"
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="card mb-4">
              <div className="card-body table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th>Question</th>
                      <th style={{ width: '100px' }}>Class</th>
                      <th style={{ width: '100px' }}>Subject</th>
                      <th style={{ width: '100px' }}>Chapter</th>
                      <th style={{ width: '100px' }}>Topic</th>
                      <th style={{ width: '80px' }}>Type</th>
                      <th style={{ width: '100px' }}>Difficulty</th>
                      <th style={{ width: '120px' }}>Source</th>
                      <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.length > 0 ? questions.map((q, i) => (
                      <tr key={q?.id}>
                        <td>{startIndex + i}</td>
                        <td>
                          <div className="question-text-container" style={{ maxWidth: '400px' }}>
                            <SafeHtmlRender 
                              html={q?.question_text}
                              maxLength={150}
                              className="text-truncate"
                            />
                            {q?.question_text_ur && (
                              <div className="text-muted small urdu-text mt-1" style={{ direction: 'rtl' }}>
                                <SafeHtmlRender 
                                  html={q?.question_text_ur}
                                  maxLength={100}
                                  className="text-truncate"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-secondary">
                            {q?.class || '-'}
                          </span>
                        </td>
                        <td>{q?.subject?.name || '-'}</td>
                        <td>{q?.chapter?.name || '-'}</td>
                        <td>{q?.topic?.name || '-'}</td>
                        <td>
                          <span className={`badge ${
                            q.question_type === 'mcq' ? 'bg-primary' : 
                            q.question_type === 'short' ? 'bg-info' : 'bg-warning'
                          }`}>
                            {q?.question_type.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            q?.difficulty === 'easy' ? 'bg-success' : 
                            q?.difficulty === 'medium' ? 'bg-warning text-dark' : 'bg-danger'
                          }`}>
                            {q?.difficulty.charAt(0).toUpperCase() + q?.difficulty.slice(1)}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-dark">
                            {q?.source_type.replace('_', ' ')}
                            {q?.source_year ? ` (${q.source_year})` : ''}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button 
                              className="btn btn-sm btn-outline-primary" 
                              onClick={() => { setSelectedQuestion(q); setShowModal(true); }}
                              title="Edit"
                            >
                              <FiEdit />
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger" 
                              onClick={() => handleDelete(q?.id)}
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10} className="text-center py-5">
                          <div className="alert alert-info mb-0 d-flex flex-column align-items-center">
                            <div className="mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className="bi bi-question-circle" viewBox="0 0 16 16">
                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
                              </svg>
                            </div>
                            <div>No questions found matching your criteria</div>
                            <button 
                              className="btn btn-sm btn-primary mt-3"
                              onClick={() => { setSelectedQuestion(null); setShowModal(true); }}
                            >
                              <FiPlus className="me-1" /> Add First Question
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalFilteredQuestions > 0 && totalPages > 1 && (
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small">
                  Page {currentPage} of {totalPages}
                </div>
                <nav aria-label="Question pagination">
                  <ul className="pagination mb-0">
                    {/* First Page */}
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        aria-label="First Page"
                      >
                        <FiChevronsLeft />
                      </button>
                    </li>

                    {/* Previous Page */}
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous Page"
                      >
                        <FiChevronLeft />
                      </button>
                    </li>

                    {/* Page Numbers */}
                    {getPaginationRange().map((pageNum, index) => (
                      <li 
                        key={index} 
                        className={`page-item ${pageNum === '...' ? 'disabled' : ''} ${currentPage === pageNum ? 'active' : ''}`}
                      >
                        {pageNum === '...' ? (
                          <span className="page-link">...</span>
                        ) : (
                          <button 
                            className="page-link" 
                            onClick={() => handlePageChange(pageNum as number)}
                          >
                            {pageNum}
                          </button>
                        )}
                      </li>
                    ))}

                    {/* Next Page */}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next Page"
                      >
                        <FiChevronRight />
                      </button>
                    </li>

                    {/* Last Page */}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        aria-label="Last Page"
                      >
                        <FiChevronsRight />
                      </button>
                    </li>
                  </ul>
                </nav>
                <div className="text-muted small">
                  {itemsPerPage} per page
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal */}
        {showModal && (
          <div 
            className="modal fade show d-block" 
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={() => setShowModal(false)}
          >
            <div 
              className="modal-dialog modal-lg modal-dialog-centered"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {selectedQuestion ? 'Edit Question' : 'Add New Question'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <QuestionForm
                    question={selectedQuestion}
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
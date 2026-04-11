'use client';
import { useState, useEffect, ChangeEvent } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { 
  FiSearch, FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, FiX,
  FiChevronLeft, FiChevronRight, FiChevronsLeft, FiChevronsRight
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
const QuestionForm = dynamic(() => import('@/components/QuestionForm'), { ssr: false });
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

// Helper function to strip HTML tags for search and preview
const stripHtml = (html: string) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// Helper function to truncate HTML content while preserving tags
const truncateHtml = (html: string, maxLength: number = 150) => {
  if (!html) return '';
  const stripped = stripHtml(html);
  if (stripped.length <= maxLength) return html;
  
  // Find a good break point
  const truncatedStripped = stripped.substring(0, maxLength) + '...';
  
  // Try to preserve HTML structure by finding the last closing tag
  const lastTagClose = html.lastIndexOf('>', maxLength);
  if (lastTagClose > 0) {
    return html.substring(0, lastTagClose + 1) + '...';
  }
  
  return truncatedStripped;
};

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
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'short' | 'long' | 'translate_urdu' | 'translate_english' | 'idiom_phrases' | 'passage' | 'poetry_explanation' | 'prose_explanation' | 'sentence_correction' | 'sentence_completion' | 'directInDirect' | 'activePassive' | 'darkhwast_khat' | 'kahani_makalma' | 'Nasarkhulasa_markziKhyal' | 'summary';
  answer_text?: string | null;
  answer_text_ur?: string | null;
  source_type: 'book' | 'past_paper' | 'model_paper' | 'custom';
  source_year?: number | null;
  created_at: string;
  topic_id?: string | null;
  topic?: {
    id: string;
    name: string;
    chapter_id: string;
    chapter?: {
      id: string;
      name: string;
      class_subject_id?: string;
      class_subject?: {
        id: string;
        class_id: string;
        subject_id: string;
        class?: {
          id: string;
          name: string;
          description?: string;
        };
        subject?: {
          id: string;
          name: string;
          name_ur?: string;
        };
      };
    };
  };
}

interface Subject { id: string; name: string; name_ur?: string | null; }
interface Chapter { id: string; name: string; class_subject_id?: string; }
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

// Define all valid question types for the select dropdown
const QUESTION_TYPES = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'short', label: 'Short Question' },
  { value: 'long', label: 'Long Question' },
  { value: 'translate_urdu', label: 'Translate to Urdu' },
  { value: 'translate_english', label: 'Translate to English' },
  { value: 'idiom_phrases', label: 'Idiom & Phrases' },
  { value: 'passage', label: 'Passage' },
  { value: 'poetry_explanation', label: 'Poetry Explanation' },
  { value: 'prose_explanation', label: 'Prose Explanation' },
  { value: 'gazal', label: 'Gazal' },
  { value: 'sentence_correction', label: 'Sentence Correction' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'directInDirect', label: 'Direct/Indirect' },
  { value: 'activePassive', label: 'Active/Passive' },
  { value: 'summary', label: 'Summary' },
  { value: 'darkhwast_khat', label: 'Darkhwast/Khat' },
  { value: 'kahani_makalma', label: 'Kahani/Makalma' },
  { value: 'Nasarkhulasa_markziKhyal', label: 'Nasarkhulasa/Markzi Khyal' },
];

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
  const [activeTab, setActiveTab] = useState<'all' | 'mcq' | 'short' | 'long' | 'translate_urdu' | 'translate_english' | 'idiom_phrases' | 'passage' | 'poetry_explanation' | 'prose_explanation' | 'gazal' | 'sentence_correction' | 'sentence_completion' | 'directInDirect' | 'activePassive' | 'summary' | 'darkhwast_khat' | 'kahani_makalma' | 'Nasarkhulasa_markziKhyal'>('all');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalQuestions, setTotalQuestions] = useState(0);
  
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
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true }); // Ensure ascending order
      if (error) throw error;
      setClasses(data as Class[]);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setSubjects(data as Subject[]);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load subjects');
    }
  };

  const fetchChapters = async () => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .order('chapterNo', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setChapters(data as Chapter[]);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      toast.error('Failed to load chapters');
    }
  };

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setTopics(data as Topic[]);
    } catch (error) {
      console.error('Error fetching topics:', error);
      toast.error('Failed to load topics');
    }
  };

  const fetchClassSubjects = async () => {
    try {
      console.log('Fetching class subjects...');
      const { data, error } = await supabase
        .from('class_subjects')
        .select(`
          id, 
          class_id, 
          subject_id, 
          subject:subjects(id, name, name_ur),
          class:classes(id, name, description)
        `)
        .order('class_id');
      
      if (error) {
        console.error('Error fetching class subjects:', error);
        throw error;
      }
      
      console.log('Class subjects fetched:', data);
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
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort subjects alphabetically
  };

  const getFilteredChapters = () => {
    if (!filters.class || !filters.subject) return [];
    
    // Find the class_subject_id for the selected class and subject
    const classSubject = classSubjects.find(
      cs => cs.class_id === filters.class && cs.subject_id === filters.subject
    );
    
    if (!classSubject) return [];
    
    // Filter chapters by class_subject_id and sort by chapterNo
    return chapters
      .filter(chapter => chapter.class_subject_id === classSubject.id)
      .sort((a, b) => {
        const aNum = a.chapterNo ? Number(a.chapterNo) : 0;
        const bNum = b.chapterNo ? Number(b.chapterNo) : 0;
        return aNum - bNum;
      });
  };

  const getFilteredTopics = () => {
    if (!filters.chapter) return [];
    return topics
      .filter(topic => topic.chapter_id === filters.chapter)
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort topics alphabetically
  };

  // Sort classes function for consistent ordering
  const getSortedClasses = () => {
    return [...classes].sort((a, b) => {
      // Try to parse as numbers for numeric sorting (e.g., 1, 2, 3, 10)
      const aNum = parseInt(a.name);
      const bNum = parseInt(b.name);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      // Fallback to alphabetical
      return a.name.localeCompare(b.name);
    });
  };

  const fetchQuestions = async (page = 1) => {
    setLoading(true);
    try {
      console.log('Fetching questions with filters:', filters);
      
      // Build the base query for counting total
      let countQuery = supabase
        .from('questions')
        .select('id', { count: 'exact', head: true });

      // Build the base query for fetching data with nested relations
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
          topic_id,
          topic:topics!questions_topic_id_fkey(
            id,
            name,
            chapter_id,
            chapter:chapters(
              id,
              name,
              class_subject_id,
              class_subject:class_subjects(
                id,
                class_id,
                subject_id,
                class:classes(id, name, description),
                subject:subjects(id, name, name_ur)
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by class via topic -> chapter -> class_subject
      if (filters.class) {
        // First, find all topics that belong to chapters linked to this class
        const topicsInClass = topics.filter(topic => {
          const chapter = chapters.find(c => c.id === topic.chapter_id);
          return chapter && classSubjects.some(
            cs => cs.id === chapter.class_subject_id && cs.class_id === filters.class
          );
        });
        
        if (topicsInClass.length > 0) {
          const topicIds = topicsInClass.map(t => t.id);
          countQuery = countQuery.in('topic_id', topicIds);
          dataQuery = dataQuery.in('topic_id', topicIds);
        } else {
          setQuestions([]);
          setTotalQuestions(0);
          setLoading(false);
          return;
        }
      }

      // Filter by subject via topic -> chapter -> class_subject
      if (filters.subject) {
        const topicsInSubject = topics.filter(topic => {
          const chapter = chapters.find(c => c.id === topic.chapter_id);
          return chapter && classSubjects.some(
            cs => cs.id === chapter.class_subject_id && cs.subject_id === filters.subject
          );
        });
        
        if (topicsInSubject.length > 0) {
          const topicIds = topicsInSubject.map(t => t.id);
          countQuery = countQuery.in('topic_id', topicIds);
          dataQuery = dataQuery.in('topic_id', topicIds);
        } else {
          setQuestions([]);
          setTotalQuestions(0);
          setLoading(false);
          return;
        }
      }

      // Filter by chapter via topic
      if (filters.chapter) {
        const topicsInChapter = topics.filter(t => t.chapter_id === filters.chapter);
        if (topicsInChapter.length > 0) {
          const topicIds = topicsInChapter.map(t => t.id);
          countQuery = countQuery.in('topic_id', topicIds);
          dataQuery = dataQuery.in('topic_id', topicIds);
        } else {
          setQuestions([]);
          setTotalQuestions(0);
          setLoading(false);
          return;
        }
      }
      
      // Filter by topic
      if (filters.topic) {
        countQuery = countQuery.eq('topic_id', filters.topic);
        dataQuery = dataQuery.eq('topic_id', filters.topic);
      }
      
      // Apply other filters
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

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) {
        console.error('Count query error:', countError);
        throw countError;
      }
      setTotalQuestions(count || 0);

      // Calculate pagination
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      dataQuery = dataQuery.range(from, to);

      const { data, error } = await dataQuery;

      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      console.log('Raw data from Supabase:', data);
      
      const processedData = (data as any[]).map(q => {
        // Extract class and subject info from nested relations
        const chapter = q.topic?.chapter;
        const classSubject = chapter?.class_subject;
        const classInfo = classSubject?.class;
        const subjectInfo = classSubject?.subject;
        
        return {
          ...q,
          class: classInfo?.name || '-',
          class_description: classInfo?.description || '-',
          subject: subjectInfo || { name: '-' }
        };
      }) as Question[];

      console.log('Processed data:', processedData);
      setQuestions(processedData);
      setCurrentPage(page);

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
    if (topics.length > 0 && classSubjects.length > 0) {
      setCurrentPage(1);
      fetchQuestions(1);
    }
  }, [filters, topics, classSubjects]);

  // Refetch questions when items per page changes
  useEffect(() => {
    if (topics.length > 0 && classSubjects.length > 0) {
      fetchQuestions(1);
    }
  }, [itemsPerPage]);

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
      // Fetch all questions without pagination for export
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
          topic_id,
          topic:topics!questions_topic_id_fkey(
            id,
            name,
            chapter_id,
            chapter:chapters(
              id,
              name,
              class_subject_id,
              class_subject:class_subjects(
                id,
                class_id,
                subject_id,
                class:classes(id, name, description),
                subject:subjects(id, name, name_ur)
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters if any (same logic as fetchQuestions)
      if (filters.class) {
        const topicsInClass = topics.filter(topic => {
          const chapter = chapters.find(c => c.id === topic.chapter_id);
          return chapter && classSubjects.some(
            cs => cs.id === chapter.class_subject_id && cs.class_id === filters.class
          );
        });
        if (topicsInClass.length > 0) {
          const topicIds = topicsInClass.map(t => t.id);
          query = query.in('topic_id', topicIds);
        }
      }

      if (filters.subject) {
        const topicsInSubject = topics.filter(topic => {
          const chapter = chapters.find(c => c.id === topic.chapter_id);
          return chapter && classSubjects.some(
            cs => cs.id === chapter.class_subject_id && cs.subject_id === filters.subject
          );
        });
        if (topicsInSubject.length > 0) {
          const topicIds = topicsInSubject.map(t => t.id);
          query = query.in('topic_id', topicIds);
        }
      }

      if (filters.chapter) {
        const topicsInChapter = topics.filter(t => t.chapter_id === filters.chapter);
        if (topicsInChapter.length > 0) {
          const topicIds = topicsInChapter.map(t => t.id);
          query = query.in('topic_id', topicIds);
        }
      }
      
      if (filters.topic) query = query.eq('topic_id', filters.topic);
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters.question_type) query = query.eq('question_type', filters.question_type);
      if (filters.source_type) query = query.eq('source_type', filters.source_type);

      const { data, error } = await query;
      
      if (error) throw error;

      const dataToExport = (data as any[]).map(q => {
        const chapter = q.topic?.chapter;
        const classSubject = chapter?.class_subject;
        
        return {
          'Question (HTML)': q.question_text,
          'Question (Plain Text)': stripHtml(q.question_text || ''),
          'Question (Urdu)': q.question_text_ur,
          'Option A': q.option_a,
          'Option B': q.option_b,
          'Option C': q.option_c,
          'Option D': q.option_d,
          'Option A (Urdu)': q.option_a_ur,
          'Option B (Urdu)': q.option_b_ur,
          'Option C (Urdu)': q.option_c_ur,
          'Option D (Urdu)': q.option_d_ur,
          'Correct Option': q.correct_option,
          Class: classSubject?.class?.name || '-',
          Subject: classSubject?.subject?.name || '-',
          Chapter: q.topic?.chapter?.name || '-',
          Topic: q.topic?.name || '-',
          Difficulty: q.difficulty,
          'Question Type': q.question_type,
          'Source Type': q.source_type,
          'Source Year': q.source_year,
          'Answer Text': q.answer_text,
          'Answer Text (Urdu)': q.answer_text_ur
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'question_bank_export.xlsx');
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
        // Find topic by name and chapter
        let topicId = null;
        if (row.Topic && row.Chapter) {
          const topic = topics.find(t => 
            t.name === row.Topic && 
            chapters.find(c => c.id === t.chapter_id && c.name === row.Chapter)
          );
          topicId = topic?.id || null;
        }

        return {
          question_text: row['Question (HTML)'] || row.Question,
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
          topic_id: topicId,
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
  const totalPages = Math.ceil(totalQuestions / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalQuestions);

  // Filter questions based on active tab and search term (search on stripped HTML)
  const filteredQuestions = questions
    .filter(q => activeTab === 'all' || q?.question_type === activeTab)
    .filter(q => {
      const searchLower = searchTerm.toLowerCase();
      const plainTextQuestion = stripHtml(q?.question_text || '');
      
      return plainTextQuestion.toLowerCase().includes(searchLower) ||
        (q?.question_text_ur && q?.question_text_ur.toLowerCase().includes(searchLower)) ||
        (q?.class && q?.class?.toLowerCase().includes(searchLower)) ||
        (q?.subject?.name && q?.subject?.name.toLowerCase().includes(searchLower)) ||
        (q?.topic?.name && q?.topic?.name.toLowerCase().includes(searchLower));
    });

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
    }
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  return (
    <AdminLayout activeTab="questions">
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 mb-md-4">
          <h2 className="mb-2 mb-md-0 text-center text-md-start fs-4 fs-md-2">
            Question Bank Management
          </h2>

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
              disabled={isExporting || totalQuestions === 0}
            >
              <FiDownload className="me-1" /> 
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* Tabs for question types */}
        <ul className="nav nav-tabs mb-4 flex-wrap">
          <li className="nav-item">
            <button 
              className={getNavLinkClass('all')}
              onClick={() => setActiveTab('all')}
            >
              All Questions
            </button>
          </li>
          {QUESTION_TYPES.map(type => (
            <li key={type.value} className="nav-item">
              <button 
                className={getNavLinkClass(type.value)}
                onClick={() => setActiveTab(type.value as any)}
              >
                {type.label}
              </button>
            </li>
          ))}
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
              
              {/* Class Filter - Sorted in ascending order */}
              <div className="col-md-2">
                <select
                  className="form-select"
                  value={filters.class || ''}
                  onChange={e => setFilters({...filters, class: e.target.value || undefined})}
                >
                  <option value="">All Classes</option>
                  {getSortedClasses().map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.description ? `- ${c.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
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

              {/* Chapter Filter */}
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

              {/* Topic Filter */}
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
                  {QUESTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
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
            Showing {startIndex + 1} to {endIndex} of {totalQuestions} questions
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
                      <th>#</th>
                      <th>Question</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Chapter</th>
                      <th>Topic</th>
                      <th>Type</th>
                      <th>Difficulty</th>
                      <th>Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.length > 0 ? filteredQuestions.map((q, i) => {
                      const getQuestionTypeLabel = (type: string) => {
                        const found = QUESTION_TYPES.find(t => t.value === type);
                        return found ? found.label : type.toUpperCase();
                      };
                      
                      // Check if question_text contains HTML
                      const hasHtml = q?.question_text && /<[a-z][\s\S]*>/i.test(q.question_text);
                      
                      return (
                        <tr key={q?.id}>
                          <td className="align-middle">{startIndex + i + 1}</td>
                          <td className="align-middle" style={{maxWidth: '350px'}}>
                            {hasHtml ? (
                              <div 
                                className="question-preview"
                                dangerouslySetInnerHTML={{ 
                                  __html: truncateHtml(q?.question_text || '', 150)
                                }}
                                style={{ 
                                  maxHeight: '80px', 
                                  overflow: 'hidden',
                                  wordBreak: 'break-word'
                                }}
                              />
                            ) : (
                              <div className="text-truncate" style={{maxWidth: '300px'}} title={q?.question_text}>
                                {q?.question_text}
                              </div>
                            )}
                            {q?.question_text_ur && (
                              <div 
                                className="text-muted small urdu-text mt-1" 
                                style={{direction: 'rtl'}}
                                dangerouslySetInnerHTML={{ 
                                  __html: truncateHtml(q.question_text_ur, 100)
                                }}
                              />
                            )}
                          </td>
                          <td className="align-middle">{q?.class || '-'}{q?.class_description ? `-${q.class_description}` : ''}</td>
                          <td className="align-middle">{q?.subject?.name || '-'}</td>
                          <td className="align-middle">{q?.topic?.chapter?.name || '-'}</td>
                          <td className="align-middle">{q?.topic?.name || '-'}</td>
                          <td className="align-middle">
                            <span className="badge bg-primary" style={{fontSize: '0.75rem'}}>
                              {getQuestionTypeLabel(q?.question_type)}
                            </span>
                          </td>
                          <td className="align-middle">
                            <span className={`badge ${
                              q?.difficulty === 'easy' ? 'bg-success' : 
                              q?.difficulty === 'medium' ? 'bg-warning' : 'bg-danger'
                            }`}>
                              {q?.difficulty}
                            </span>
                          </td>
                          <td className="align-middle">
                            <span className="badge bg-secondary">
                              {q?.source_type?.replace('_', ' ')}
                              {q?.source_year ? ` ${q.source_year}` : ''}
                            </span>
                          </td>
                          <td className="align-middle">
                            <div className="d-flex gap-2">
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
                      );
                    }) : (
                      <tr>
                        <td colSpan={10} className="text-center py-4">
                          <div className="alert alert-info mb-0">
                            No questions found matching your criteria
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalQuestions > 0 && (
              <nav aria-label="Question pagination">
                <ul className="pagination justify-content-center">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    >
                      <FiChevronsLeft />
                    </button>
                  </li>
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <FiChevronLeft />
                    </button>
                  </li>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                        <button 
                          className="page-link" 
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      </li>
                    );
                  })}
                  
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <FiChevronRight />
                    </button>
                  </li>
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <FiChevronsRight />
                    </button>
                  </li>
                </ul>
              </nav>
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
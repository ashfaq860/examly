'use client';
import { useState, useEffect, ChangeEvent } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { 
  FiSearch, FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, FiX 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import QuestionForm from '@/components/QuestionForm';
import { useRouter } from "next/navigation";
import { isUserAdmin } from "@/lib/auth-utils";

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
      console.log('Fetching class subjects...');
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
      }));
  };

  const getFilteredChapters = () => {
    if (!filters.class || !filters.subject) return [];
    
    // Find the class_subject_id for the selected class and subject
    const classSubject = classSubjects.find(
      cs => cs.class_id === filters.class && cs.subject_id === filters.subject
    );
    
    if (!classSubject) return [];
    
    // Filter chapters by class_subject_id
    return chapters.filter(chapter => chapter.class_subject_id === classSubject.id);
  };

  const getFilteredTopics = () => {
    if (!filters.chapter) return [];
    return topics.filter(topic => topic.chapter_id === filters.chapter);
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      console.log('Fetching questions with filters:', filters);
      
      // Build the base query
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
          query = query.in('class_subject_id', classSubjectIds);
        } else {
          // No class subjects found for this class
          setQuestions([]);
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
          query = query.in('class_subject_id', classSubjectIds);
        } else {
          // No class subjects found for this subject
          setQuestions([]);
          setLoading(false);
          return;
        }
      }

      // Apply other filters
      if (filters.chapter) {
        query = query.eq('chapter_id', filters.chapter);
      }
      if (filters.topic) {
        query = query.eq('topic_id', filters.topic);
      }
      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }
      if (filters.question_type) {
        query = query.eq('question_type', filters.question_type);
      }
      if (filters.source_type) {
        query = query.eq('source_type', filters.source_type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      console.log('Raw data from Supabase:', data);
      
      const processedData = (data as any[]).map(q => ({
        ...q,
        class: q.class_subject?.class?.name ? String(q.class_subject.class.name) : '-',
        class_description: q.class_subject?.class?.description ? String(q.class_subject.class.description) : '-',
        subject: q.subject || { name: '-' }
      })) as Question[];

      console.log('Processed data:', processedData);
      setQuestions(processedData);

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
      fetchQuestions();
    }
  }, [filters, classSubjects]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast.success('Question deleted');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataToExport = questions.map(q => ({
        Question: q.question_text,
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
        'Class ID': classSubjects.find(cs => cs.subject_id === q.subject_id)?.class_id || '',
        Class: q.class,
        'Subject ID': q.subject_id || '',
        Subject: q.subject?.name,
        Chapter: q.chapter?.name,
        Topic: q.topic?.name,
        Difficulty: q.difficulty,
        'Question Type': q.question_type,
        'Source Type': q.source_type,
        'Source Year': q.source_year,
        'Answer Text': q.answer_text,
        'Answer Text (Urdu)': q.answer_text_ur
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'question_bank_export.xlsx');
      toast.success('Export completed successfully');
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

        // Find class_subject_id based on class and subject
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
      fetchQuestions();
    } catch (error) {
      console.error('Error importing questions:', error);
      toast.error('Failed to import questions');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const filteredQuestions = questions
    .filter(q => activeTab === 'all' || q?.question_type === activeTab)
    .filter(q =>
      q?.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q?.question_text_ur && q?.question_text_ur.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q?.class && q?.class?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q?.subject?.name && q?.subject?.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q?.chapter?.name && q?.chapter?.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q?.topic?.name && q?.topic?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // Helper function to get nav link class
  const getNavLinkClass = (tab: string) => {
    return `nav-link ${activeTab === tab ? 'active' : ''}`;
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
              disabled={isExporting || questions.length === 0}
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

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="card">
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
                  {filteredQuestions.length > 0 ? filteredQuestions.map((q, i) => (
                    <tr key={q?.id}>
                      <td>{i + 1}</td>
                      <td className="text-truncate" style={{maxWidth: '300px'}} title={q?.question_text}>
                        {q?.question_text}
                        {q?.question_text_ur && (
                          <div className="text-muted small urdu-text" style={{direction: 'rtl'}}>
                            {q?.question_text_ur}
                          </div>
                        )}
                      </td>
                      <td>{q?.class || '-'}-{q?.class_description || '-'} </td>
                      <td>{q?.subject?.name || '-'}</td>
                      <td>{q?.chapter?.name || '-'}</td>
                      <td>{q?.topic?.name || '-'}</td>
                      <td>
                        <span className={`badge ${q.question_type === 'mcq' ? 'bg-primary' : 'bg-info'}`}>
                          {q?.question_type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          q?.difficulty === 'easy' ? 'bg-success' : 
                          q?.difficulty === 'medium' ? 'bg-warning' : 'bg-danger'
                        }`}>
                          {q?.difficulty}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {q?.source_type.replace('_', ' ')}
                          {q?.source_year ? ` ${q.source_year}` : ''}
                        </span>
                      </td>
                      <td>
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
                  )) : (
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
                    onClose={() => { setShowModal(false); fetchQuestions(); }}
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
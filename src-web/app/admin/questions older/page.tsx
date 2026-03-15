'use client';
import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { supabase } from '../../../lib/supabaseClient';
import { 
  FiSearch, FiEdit, FiTrash2, 
  FiCheck, FiX, FiDownload, 
  FiUpload, FiPlus, FiFilter,
  FiBook, FiBookOpen, FiLayers 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Define TypeScript interfaces for your data models
interface Question {
  id: string;
  question_text: string;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_option?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'short' | 'long';
  answer_text?: string | null;
  created_at: string;
  subject?: {
    name: string;
  };
  chapter?: {
    name: string;
  };
  topic?: {
    name: string;
  };
  created_by?: string | null;
}

interface Subject {
  id: string;
  name: string;
  grade?: string | null;
  created_at: string;
}

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  chapter_id: string;
  created_at: string;
}

interface Class {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  assigned_at: string;
  subject?: Subject;
}

interface FormData {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: 'mcq' | 'short' | 'long';
  answer_text: string;
}

interface Filters {
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  question_type: string;
  class?: string;
}

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSubjectAssignmentModal, setShowSubjectAssignmentModal] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: '',
    subject_id: '',
    chapter_id: '',
    topic_id: '',
    difficulty: 'medium',
    question_type: 'mcq',
    answer_text: ''
  });
  const [newClass, setNewClass] = useState({
    name: '',
    description: ''
  });
  const [filters, setFilters] = useState<Filters>({
    subject: '',
    chapter: '',
    topic: '',
    difficulty: '',
    question_type: '',
    class: ''
  });

  useEffect(() => {
    fetchQuestions();
    fetchSubjects();
    fetchClasses();
  }, [filters]);

  useEffect(() => {
    if (formData.subject_id) {
      fetchChapters(formData.subject_id);
    }
    if (formData.chapter_id) {
      fetchTopics(formData.chapter_id);
    }
  }, [formData.subject_id, formData.chapter_id]);

  useEffect(() => {
    if (filters.class) {
      fetchClassSubjects(filters.class);
    }
  }, [filters.class]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('questions')
        .select(`
          *,
          subject:subjects(name),
          chapter:chapters(name),
          topic:topics(name)
        `)
        .order('created_at', { ascending: false });

      if (filters.subject) query = query.eq('subject_id', filters.subject);
      if (filters.chapter) query = query.eq('chapter_id', filters.chapter);
      if (filters.topic) query = query.eq('topic_id', filters.topic);
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters.question_type) query = query.eq('question_type', filters.question_type);

      const { data, error } = await query;

      if (error) throw error;
      setQuestions(data as Question[]);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error) {
      setSubjects(data as Subject[]);
    }
  };

  const fetchChapters = async (subjectId: string) => {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .order('name', { ascending: true });
    
    if (!error) {
      setChapters(data as Chapter[]);
    }
  };

  const fetchTopics = async (chapterId: string) => {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('name', { ascending: true });
    
    if (!error) {
      setTopics(data as Topic[]);
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('name', { ascending: true });
    
    if (!error) {
      setClasses(data as Class[]);
    }
  };

  const fetchClassSubjects = async (classId: string) => {
    const { data, error } = await supabase
      .from('class_subjects')
      .select(`
        *,
        subject:subjects(*)
      `)
      .eq('class_id', classId);
    
    if (!error) {
      setClassSubjects(data as ClassSubject[]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editMode && selectedQuestion) {
        const { error } = await supabase
          .from('questions')
          .update(formData)
          .eq('id', selectedQuestion.id);
        
        if (error) throw error;
        
        setQuestions(questions.map(q => 
          q.id === selectedQuestion.id ? { ...q, ...formData } : q
        ));
        toast.success('Question updated successfully');
      } else {
        const { data, error } = await supabase
          .from('questions')
          .insert([formData])
          .select();
        
        if (error) throw error;
        
        setQuestions([data[0] as Question, ...questions]);
        toast.success('Question added successfully');
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert([newClass])
        .select();
      
      if (error) throw error;
      
      setClasses([data[0] as Class, ...classes]);
      toast.success('Class created successfully');
      setShowClassModal(false);
      setNewClass({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Failed to create class');
    }
  };

  const handleAssignSubject = async (subjectId: string) => {
    if (!filters.class) return;
    
    try {
      const { data, error } = await supabase
        .from('class_subjects')
        .insert([{
          class_id: filters.class,
          subject_id: subjectId
        }])
        .select();
      
      if (error) throw error;
      
      setClassSubjects([...classSubjects, data[0] as ClassSubject]);
      toast.success('Subject assigned to class successfully');
    } catch (error) {
      console.error('Error assigning subject:', error);
      toast.error('Failed to assign subject to class');
    }
  };

  const handleRemoveSubject = async (classSubjectId: string) => {
    try {
      const { error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('id', classSubjectId);
      
      if (error) throw error;
      
      setClassSubjects(classSubjects.filter(cs => cs.id !== classSubjectId));
      toast.success('Subject removed from class successfully');
    } catch (error) {
      console.error('Error removing subject:', error);
      toast.error('Failed to remove subject from class');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setQuestions(questions.filter(q => q.id !== id));
      toast.success('Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const handleExport = () => {
    const dataToExport = questions.map(q => ({
      Question: q.question_text,
      'Option A': q.option_a,
      'Option B': q.option_b,
      'Option C': q.option_c,
      'Option D': q.option_d,
      'Correct Option': q.correct_option,
      Subject: q.subject?.name,
      Chapter: q.chapter?.name,
      Topic: q.topic?.name,
      Difficulty: q.difficulty,
      'Question Type': q.question_type,
      'Answer Text': q.answer_text
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "question_bank_export.xlsx");
  };

  const filteredQuestions = questions.filter(q => 
    q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.subject?.name && q.subject.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (q.chapter?.name && q.chapter.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (q.topic?.name && q.topic.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableSubjects = subjects.filter(subject => 
    !classSubjects.some(cs => cs.subject_id === subject.id)
  );

  return (
    <AdminLayout activeTab="questions">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Question Bank</h2>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-primary"
            onClick={() => {
              setSelectedQuestion(null);
              setEditMode(false);
              setFormData({
                question_text: '',
                option_a: '',
                option_b: '',
                option_c: '',
                option_d: '',
                correct_option: '',
                subject_id: '',
                chapter_id: '',
                topic_id: '',
                difficulty: 'medium',
                question_type: 'mcq',
                answer_text: ''
              });
              setShowModal(true);
            }}
          >
            <FiPlus className="me-1" /> Add Question
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowClassModal(true)}
          >
            <FiLayers className="me-1" /> Manage Classes
          </button>
        </div>
      </div>

      <div className="row mb-4 g-3">
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text">
              <FiSearch />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-6 d-flex gap-2">
          <div className="dropdown">
            <button 
              className="btn btn-outline-secondary dropdown-toggle"
              type="button"
              id="classFilter"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <FiBook className="me-1" /> {filters.class ? classes.find(c => c.id === filters.class)?.name : 'All Classes'}
            </button>
            <ul className="dropdown-menu" aria-labelledby="classFilter">
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => setFilters({...filters, class: '', subject: '', chapter: '', topic: ''})}
                >
                  All Classes
                </button>
              </li>
              {classes.map(cls => (
                <li key={cls.id}>
                  <button 
                    className={`dropdown-item ${
                      filters.class === cls.id ? 'active' : ''
                    }`}
                    onClick={() => setFilters({...filters, class: cls.id, subject: '', chapter: '', topic: ''})}
                  >
                    {cls.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dropdown">
            <button 
              className="btn btn-outline-secondary dropdown-toggle"
              type="button"
              id="subjectFilter"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              disabled={!filters.class}
            >
              <FiBookOpen className="me-1" /> {filters.subject ? subjects.find(s => s.id === filters.subject)?.name : 'All Subjects'}
            </button>
            <ul className="dropdown-menu" aria-labelledby="subjectFilter">
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => setFilters({...filters, subject: '', chapter: '', topic: ''})}
                >
                  All Subjects
                </button>
              </li>
              {classSubjects.map(cs => (
                <li key={cs.subject_id}>
                  <button 
                    className={`dropdown-item ${
                      filters.subject === cs.subject_id ? 'active' : ''
                    }`}
                    onClick={() => setFilters({...filters, subject: cs.subject_id, chapter: '', topic: ''})}
                  >
                    {cs.subject?.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dropdown">
            <button 
              className="btn btn-outline-secondary dropdown-toggle"
              type="button"
              id="chapterFilter"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              disabled={!filters.subject}
            >
              <FiFilter className="me-1" /> {filters.chapter ? chapters.find(c => c.id === filters.chapter)?.name : 'All Chapters'}
            </button>
            <ul className="dropdown-menu" aria-labelledby="chapterFilter">
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => setFilters({...filters, chapter: '', topic: ''})}
                >
                  All Chapters
                </button>
              </li>
              {chapters.filter(c => c.subject_id === filters.subject).map(chapter => (
                <li key={chapter.id}>
                  <button 
                    className={`dropdown-item ${
                      filters.chapter === chapter.id ? 'active' : ''
                    }`}
                    onClick={() => setFilters({...filters, chapter: chapter.id, topic: ''})}
                  >
                    {chapter.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dropdown">
            <button 
              className="btn btn-outline-secondary dropdown-toggle"
              type="button"
              id="topicFilter"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              disabled={!filters.chapter}
            >
              <FiFilter className="me-1" /> {filters.topic ? topics.find(t => t.id === filters.topic)?.name : 'All Topics'}
            </button>
            <ul className="dropdown-menu" aria-labelledby="topicFilter">
              <li>
                <button 
                  className="dropdown-item"
                  onClick={() => setFilters({...filters, topic: ''})}
                >
                  All Topics
                </button>
              </li>
              {topics.filter(t => t.chapter_id === filters.chapter).map(topic => (
                <li key={topic.id}>
                  <button 
                    className={`dropdown-item ${
                      filters.topic === topic.id ? 'active' : ''
                    }`}
                    onClick={() => setFilters({...filters, topic: topic.id})}
                  >
                    {topic.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button className="btn btn-success" onClick={handleExport}>
            <FiDownload className="me-1" /> Export
          </button>
        </div>
      </div>

      {filters.class && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">Assigned Subjects</h5>
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => setShowSubjectAssignmentModal(true)}
            >
              <FiPlus className="me-1" /> Assign Subject
            </button>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {classSubjects.length > 0 ? (
              classSubjects.map(cs => (
                <div key={cs.id} className="badge bg-primary d-flex align-items-center gap-1">
                  {cs.subject?.name}
                  <button 
                    className="btn btn-sm p-0 text-white"
                    onClick={() => handleRemoveSubject(cs.id)}
                  >
                    <FiX />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-muted">No subjects assigned to this class</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-bordered table-hover">
            <thead className="table-dark">
              <tr>
                <th>Question</th>
                <th>Subject</th>
                <th>Chapter</th>
                <th>Topic</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.length > 0 ? (
                filteredQuestions.map(q => (
                  <tr key={q.id}>
                    <td className="text-truncate" style={{maxWidth: '300px'}}>
                      {q.question_text}
                    </td>
                    <td>{q.subject?.name || '-'}</td>
                    <td>{q.chapter?.name || '-'}</td>
                    <td>{q.topic?.name || '-'}</td>
                    <td>
                      <span className={`badge ${
                        q.question_type === 'mcq' ? 'bg-primary' : 'bg-info'
                      }`}>
                        {q.question_type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        q.difficulty === 'easy' ? 'bg-success' :
                        q.difficulty === 'medium' ? 'bg-warning' :
                        'bg-danger'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-outline-primary btn-sm me-2"
                        onClick={() => {
                          setSelectedQuestion(q);
                          setFormData({
                            question_text: q.question_text,
                            option_a: q.option_a || '',
                            option_b: q.option_b || '',
                            option_c: q.option_c || '',
                            option_d: q.option_d || '',
                            correct_option: q.correct_option || '',
                            subject_id: q.subject_id || '',
                            chapter_id: q.chapter_id || '',
                            topic_id: q.topic_id || '',
                            difficulty: q.difficulty,
                            question_type: q.question_type,
                            answer_text: q.answer_text || ''
                          });
                          setEditMode(true);
                          setShowModal(true);
                        }}
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDelete(q.id)}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    <div className="alert alert-info">
                      No questions found matching your criteria
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Question Modal */}
      <div 
        className={`modal fade ${showModal ? 'show d-block' : ''}`}
        tabIndex="-1"
        aria-labelledby="questionModalLabel"
        aria-hidden={!showModal}
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="questionModalLabel">
                {editMode ? 'Edit Question' : 'Add New Question'}
              </h5>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Question Text</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.question_text}
                    onChange={(e) => setFormData({...formData, question_text: e.target.value})}
                    required
                  />
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Subject</label>
                    <select
                      className="form-select"
                      value={formData.subject_id}
                      onChange={(e) => setFormData({...formData, subject_id: e.target.value, chapter_id: '', topic_id: ''})}
                      required
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Chapter</label>
                    <select
                      className="form-select"
                      value={formData.chapter_id}
                      onChange={(e) => setFormData({...formData, chapter_id: e.target.value, topic_id: ''})}
                      disabled={!formData.subject_id}
                    >
                      <option value="">Select Chapter</option>
                      {chapters.filter(c => c.subject_id === formData.subject_id).map(chapter => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Topic</label>
                    <select
                      className="form-select"
                      value={formData.topic_id}
                      onChange={(e) => setFormData({...formData, topic_id: e.target.value})}
                      disabled={!formData.chapter_id}
                    >
                      <option value="">Select Topic</option>
                      {topics.filter(t => t.chapter_id === formData.chapter_id).map(topic => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Question Type</label>
                    <select
                      className="form-select"
                      value={formData.question_type}
                      onChange={(e) => setFormData({...formData, question_type: e.target.value as 'mcq' | 'short' | 'long'})}
                    >
                      <option value="mcq">Multiple Choice</option>
                      <option value="short">Short Answer</option>
                      <option value="long">Long Answer</option>
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Difficulty</label>
                    <select
                      className="form-select"
                      value={formData.difficulty}
                      onChange={(e) => setFormData({...formData, difficulty: e.target.value as 'easy' | 'medium' | 'hard'})}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {formData.question_type === 'mcq' && (
                  <>
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Option A</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.option_a}
                          onChange={(e) => setFormData({...formData, option_a: e.target.value})}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Option B</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.option_b}
                          onChange={(e) => setFormData({...formData, option_b: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label className="form-label">Option C</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.option_c}
                          onChange={(e) => setFormData({...formData, option_c: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Option D</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.option_d}
                          onChange={(e) => setFormData({...formData, option_d: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Correct Option</label>
                      <select
                        className="form-select"
                        value={formData.correct_option}
                        onChange={(e) => setFormData({...formData, correct_option: e.target.value})}
                        required
                      >
                        <option value="">Select correct option</option>
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        {formData.option_c && <option value="C">Option C</option>}
                        {formData.option_d && <option value="D">Option D</option>}
                      </select>
                    </div>
                  </>
                )}

                {(formData.question_type === 'short' || formData.question_type === 'long') && (
                  <div className="mb-3">
                    <label className="form-label">Answer Text</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={formData.answer_text}
                      onChange={(e) => setFormData({...formData, answer_text: e.target.value})}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editMode ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Class Management Modal */}
      <div 
        className={`modal fade ${showClassModal ? 'show d-block' : ''}`}
        tabIndex="-1"
        aria-labelledby="classModalLabel"
        aria-hidden={!showClassModal}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="classModalLabel">Manage Classes</h5>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setShowClassModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateClass}>
                <div className="mb-3">
                  <label className="form-label">Class Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClass.name}
                    onChange={(e) => setNewClass({...newClass, name: e.target.value})}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={newClass.description}
                    onChange={(e) => setNewClass({...newClass, description: e.target.value})}
                  />
                </div>
                <div className="d-flex justify-content-end">
                  <button type="submit" className="btn btn-primary">
                    Create Class
                  </button>
                </div>
              </form>

              <div className="mt-4">
                <h6>Existing Classes</h6>
                <div className="list-group">
                  {classes.map(cls => (
                    <div key={cls.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{cls.name}</strong>
                        {cls.description && <div className="text-muted small">{cls.description}</div>}
                      </div>
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          setSelectedClass(cls);
                          setFilters({...filters, class: cls.id});
                          setShowClassModal(false);
                        }}
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowClassModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Assignment Modal */}
      <div 
        className={`modal fade ${showSubjectAssignmentModal ? 'show d-block' : ''}`}
        tabIndex="-1"
        aria-labelledby="subjectAssignmentModalLabel"
        aria-hidden={!showSubjectAssignmentModal}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="subjectAssignmentModalLabel">
                Assign Subjects to {selectedClass?.name || 'Class'}
              </h5>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setShowSubjectAssignmentModal(false)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {availableSubjects.length > 0 ? (
                <div className="list-group">
                  {availableSubjects.map(subject => (
                    <div key={subject.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{subject.name}</strong>
                        {subject.grade && <div className="text-muted small">Grade: {subject.grade}</div>}
                      </div>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAssignSubject(subject.id)}
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert alert-info">
                  All available subjects have been assigned to this class
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowSubjectAssignmentModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && <div className="modal-backdrop fade show"></div>}
      {showClassModal && <div className="modal-backdrop fade show"></div>}
      {showSubjectAssignmentModal && <div className="modal-backdrop fade show"></div>}
    </AdminLayout>
  );
}
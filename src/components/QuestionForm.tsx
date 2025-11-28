// components/QuestionForm.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface QuestionFormProps {
  question?: any;
  classes: any[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  classSubjects: any[]; // { id, class_id, subject_id, ... }
  onClose: () => void;
}

export default function QuestionForm({
  question,
  classes,
  subjects,
  chapters,
  topics,
  classSubjects,
  onClose
}: QuestionFormProps) {
  const toId = (v: any) => (v === null || v === undefined ? '' : String(v));

  // Initial form state for text fields only
  const initialTextFields = {
    question_text: '',
    question_text_ur: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_a_ur: '',
    option_b_ur: '',
    option_c_ur: '',
    option_d_ur: '',
    answer_text: '',
    answer_text_ur: '',
    source_year: ''
  };

  const [formData, setFormData] = useState({
    ...initialTextFields,
    correct_option: '',
    class_id: '',
    subject_id: '',
    chapter_id: '',
    topic_id: '',
    difficulty: 'medium',
    question_type: 'mcq' as 'mcq' | 'short' | 'long',
    source_type: 'book' as 'book' | 'past_paper' | 'model_paper' | 'custom',
  });

  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Function to reset only text fields
  const resetTextFields = () => {
    setFormData(prev => ({
     // ...prev,
     // ...initialTextFields,
      // Keep the correct_option reset only if it's an MCQ
     // correct_option: prev.question_type === 'mcq' ? '' : prev.correct_option
       ...prev,
    // Reset only the text content fields
    question_text: '',
    question_text_ur: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_a_ur: '',
    option_b_ur: '',
    option_c_ur: '',
    option_d_ur: '',
    answer_text: '',
    answer_text_ur: '',
    // Reset correct_option only for MCQ questions
    correct_option: prev.question_type === 'mcq' ? '' : prev.correct_option
    }));
  };

  // Function to translate English to Urdu using MyMemory API
  const translateToUrdu = async (text: string): Promise<string> => {
    if (!text) return '';
    
    try {
      // Using MyMemory Translation API
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ur`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
      
      console.warn('Translation API returned unexpected format:', data);
      return text; // Fallback to original text
      
    } catch (err) {
      console.error('Translation error:', err);
      return text; // Fallback to original text
    }
  };

  // Manual translation function
  const handleTranslateAll = async () => {
    setIsTranslating(true);
    try {
      const updates: any = {};
      
      // Translate question text
      if (formData.question_text && !formData.question_text_ur) {
        updates.question_text_ur = await translateToUrdu(formData.question_text);
      }
      
      // Translate options if it's an MCQ
      if (formData.question_type === 'mcq') {
        if (formData.option_a && !formData.option_a_ur) {
          updates.option_a_ur = await translateToUrdu(formData.option_a);
        }
        if (formData.option_b && !formData.option_b_ur) {
          updates.option_b_ur = await translateToUrdu(formData.option_b);
        }
        if (formData.option_c && !formData.option_c_ur) {
          updates.option_c_ur = await translateToUrdu(formData.option_c);
        }
        if (formData.option_d && !formData.option_d_ur) {
          updates.option_d_ur = await translateToUrdu(formData.option_d);
        }
      }
      
      // Translate answer text for non-MCQ questions
      if (formData.question_type !== 'mcq' && formData.answer_text && !formData.answer_text_ur) {
        updates.answer_text_ur = await translateToUrdu(formData.answer_text);
      }
      
      // Update form data
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
        toast.success('Translation completed');
      } else {
        toast('No fields need translation');
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Failed to translate');
    } finally {
      setIsTranslating(false);
    }
  };

  // Check if we're in edit mode
  const isEditMode = Boolean(question);

  // ---- Initialize form (Edit mode) ----
  useEffect(() => {
    if (!question) return;

    // Prefer deriving class via class_subject_id (authoritative)
    const fromClassSubjectLink = classSubjects.find(
      (cs) => toId(cs.id) === toId(question.class_subject_id)
    );
    // Fallbacks if class_subject_id missing in question payload
    const fromSubjectMap = classSubjects.find(
      (cs) => toId(cs.subject_id) === toId(question.subject_id)
    );
    const fromSubjectJoin = toId(
      question.subject?.class_subjects?.[0]?.class_id
    );

    const derivedClassId =
      toId(fromClassSubjectLink?.class_id) ||
      toId(fromSubjectMap?.class_id) ||
      fromSubjectJoin ||
      '';

    setFormData({
      question_text: question.question_text || '',
      question_text_ur: question.question_text_ur || '',
      option_a: question.option_a || '',
      option_b: question.option_b || '',
      option_c: question.option_c || '',
      option_d: question.option_d || '',
      option_a_ur: question.option_a_ur || '',
      option_b_ur: question.option_b_ur || '',
      option_c_ur: question.option_c_ur || '',
      option_d_ur: question.option_d_ur || '',
      correct_option: question.correct_option || '',
      class_id: derivedClassId,
      subject_id: toId(question.subject_id) || '',
      chapter_id: toId(question.chapter_id) || '',
      topic_id: toId(question.topic_id) || '',
      difficulty: question.difficulty || 'medium',
      question_type: (question.question_type || 'mcq') as 'mcq' | 'short' | 'long',
      answer_text: question.answer_text || '',
      answer_text_ur: question.answer_text_ur || '',
      source_type: (question.source_type || 'book') as 'book' | 'past_paper' | 'model_paper' | 'custom',
      source_year: question.source_year ? String(question.source_year) : ''
    });
  }, [question, classSubjects]);

  // ---- Filter subjects when class changes ----
  useEffect(() => {
    const classId = formData.class_id;

    if (classId) {
      const subjectsForClass = subjects.filter((subj) =>
        classSubjects.some(
          (cs) => toId(cs.class_id) === classId && toId(cs.subject_id) === toId(subj.id)
        )
      );
      setFilteredSubjects(subjectsForClass);

      if (
        formData.subject_id &&
        !subjectsForClass.some((s) => toId(s.id) === formData.subject_id)
      ) {
        setFormData((prev) => ({ ...prev, subject_id: '', chapter_id: '', topic_id: '' }));
      }
    } else {
      setFilteredSubjects([]);
      if (formData.subject_id) {
        setFormData((prev) => ({ ...prev, subject_id: '', chapter_id: '', topic_id: '' }));
      }
    }
  }, [formData.class_id, subjects, classSubjects]);

  // ---- Filter chapters when class and subject change ----
  useEffect(() => {
    const classId = formData.class_id;
    const subjectId = formData.subject_id;

    if (classId && subjectId) {
      // Find the class_subject_id for the selected class and subject
      const classSubject = classSubjects.find(
        cs => toId(cs.class_id) === classId && toId(cs.subject_id) === subjectId
      );
      
      if (classSubject) {
        // Filter chapters by class_subject_id
        const chaptersForClassSubject = chapters.filter(
          chapter => toId(chapter.class_subject_id) === toId(classSubject.id)
        );
        setFilteredChapters(chaptersForClassSubject);

        if (
          formData.chapter_id &&
          !chaptersForClassSubject.some((c) => toId(c.id) === formData.chapter_id)
        ) {
          setFormData((prev) => ({ ...prev, chapter_id: '', topic_id: '' }));
        }
      } else {
        setFilteredChapters([]);
        if (formData.chapter_id) {
          setFormData((prev) => ({ ...prev, chapter_id: '', topic_id: '' }));
        }
      }
    } else {
      setFilteredChapters([]);
      if (formData.chapter_id) {
        setFormData((prev) => ({ ...prev, chapter_id: '', topic_id: '' }));
      }
    }
  }, [formData.class_id, formData.subject_id, chapters, classSubjects]);

  // ---- Filter topics when chapter changes ----
  useEffect(() => {
    const chapterId = formData.chapter_id;

    if (chapterId) {
      const topicsForChapter = topics.filter(
        (t) => toId(t.chapter_id) === chapterId
      );
      setFilteredTopics(topicsForChapter);

      if (
        formData.topic_id &&
        !topicsForChapter.some((t) => toId(t.id) === formData.topic_id)
      ) {
        setFormData((prev) => ({ ...prev, topic_id: '' }));
      }
    } else {
      setFilteredTopics([]);
      if (formData.topic_id) {
        setFormData((prev) => ({ ...prev, topic_id: '' }));
      }
    }
  }, [formData.chapter_id, topics]);

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determine class_subject_id for the selected class + subject
      const classSubject = classSubjects.find(
        (cs) =>
          toId(cs.class_id) === formData.class_id &&
          toId(cs.subject_id) === formData.subject_id
      );
      
      if (!classSubject) {
        toast.error('Please select a valid class and subject combination');
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .single();

      const payload = {
        question_text: formData.question_text,
        question_text_ur: formData.question_text_ur,
        option_a: formData.question_type === 'mcq' ? formData.option_a : null,
        option_b: formData.question_type === 'mcq' ? formData.option_b : null,
        option_c: formData.question_type === 'mcq' ? formData.option_c : null,
        option_d: formData.question_type === 'mcq' ? formData.option_d : null,
        option_a_ur: formData.question_type === 'mcq' ? formData.option_a_ur : null,
        option_b_ur: formData.question_type === 'mcq' ? formData.option_b_ur : null,
        option_c_ur: formData.question_type === 'mcq' ? formData.option_c_ur : null,
        option_d_ur: formData.question_type === 'mcq' ? formData.option_d_ur : null,
        correct_option: formData.question_type === 'mcq' ? formData.correct_option : null,
        subject_id: formData.subject_id || null,
        chapter_id: formData.chapter_id || null,
        topic_id: formData.topic_id || null,
        difficulty: formData.difficulty,
        question_type: formData.question_type,
        answer_text: formData.question_type !== 'mcq' ? formData.answer_text : null,
        answer_text_ur: formData.question_type !== 'mcq' ? formData.answer_text_ur : null,
        source_type: formData.source_type,
        source_year: formData.source_year ? parseInt(formData.source_year) : null,
        class_subject_id: classSubject.id,
        created_by: profile?.id,
      };

      if (question) {
        const { error } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', question.id);
        if (error) throw error;
        toast.success('Question updated successfully');
      } else {
        const { error } = await supabase.from('questions').insert([payload]);
        if (error) throw error;
        toast.success('Question added successfully');
        // Reset only text fields after successful save (for new questions only)
        resetTextFields();
      }
      
     // onClose();
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast.error(error.message || 'Failed to save question');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="row g-3">
          {/* Question text */}
          <div className="col-md-12">
            <label className="form-label">Question Text (English) *</label>
            <textarea
              className="form-control"
              rows={3}
              name="question_text"
              value={formData.question_text}
              onChange={handleChange}
              required
            />
          </div>

          {/* Urdu Question text */}
          <div className="col-md-12">
            <label className="form-label">Question Text (Urdu)</label>
            <textarea
              className="form-control urdu-text"
              rows={3}
              name="question_text_ur"
              value={formData.question_text_ur}
              onChange={handleChange}
              style={{ direction: 'rtl' }}
            />
          </div>

          {/* Class */}
          <div className="col-md-6">
            <label className="form-label">Class *</label>
            <select
              className="form-select"
              name="class_id"
              value={formData.class_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={toId(cls.id)} value={toId(cls.id)}>
                  {cls.name}
                  {cls.description ? ` — ${cls.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="col-md-6">
            <label className="form-label">Subject *</label>
            <select
              className="form-select"
              name="subject_id"
              value={formData.subject_id}
              onChange={handleChange}
              required
              disabled={!formData.class_id}
            >
              <option value="">Select Subject</option>
              {filteredSubjects.map((subject) => (
                <option key={toId(subject.id)} value={toId(subject.id)}>
                  {subject.name}
                  {subject.description ? ` — ${subject.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter */}
          <div className="col-md-6">
            <label className="form-label">Chapter</label>
            <select
              className="form-select"
              name="chapter_id"
              value={formData.chapter_id}
              onChange={handleChange}
              disabled={!formData.class_id || !formData.subject_id}
            >
              <option value="">Select Chapter</option>
              {filteredChapters.map((chapter) => (
                <option key={toId(chapter.id)} value={toId(chapter.id)}>
                  {chapter.name}
                  {chapter.description ? ` — ${chapter.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div className="col-md-6">
            <label className="form-label">Topic</label>
            <select
              className="form-select"
              name="topic_id"
              value={formData.topic_id}
              onChange={handleChange}
              disabled={!formData.chapter_id}
            >
              <option value="">Select Topic</option>
              {filteredTopics.map((topic) => (
                <option key={toId(topic.id)} value={toId(topic.id)}>
                  {topic.name}
                  {topic.description ? ` — ${topic.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Question Type */}
          <div className="col-md-6">
            <label className="form-label">Question Type *</label>
            <select
              className="form-select"
              name="question_type"
              value={formData.question_type}
              onChange={handleChange}
              required
            >
              <option value="mcq">Multiple Choice</option>
              <option value="short">Short Answer</option>
              <option value="long">Long Answer</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="col-md-6">
            <label className="form-label">Difficulty *</label>
            <select
              className="form-select"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleChange}
              required
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Source Type */}
          <div className="col-md-6">
            <label className="form-label">Source Type *</label>
            <select
              className="form-select"
              name="source_type"
              value={formData.source_type}
              onChange={handleChange}
              required
            >
              <option value="book">Book</option>
              <option value="past_paper">Past Paper</option>
              <option value="model_paper">Model Paper</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Source Year */}
          {['past_paper', 'model_paper'].includes(formData.source_type) && (
            <div className="col-md-6">
              <label className="form-label">Year</label>
              <input
                type="number"
                className="form-control"
                name="source_year"
                value={formData.source_year}
                onChange={handleChange}
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
          )}

          {/* MCQ Options */}
          {formData.question_type === 'mcq' && (
            <>
              <div className="col-md-6">
                <label className="form-label">Option A (English) *</label>
                <input
                  type="text"
                  className="form-control"
                  name="option_a"
                  value={formData.option_a}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Option A (Urdu)</label>
                <input
                  type="text"
                  className="form-control urdu-text"
                  name="option_a_ur"
                  value={formData.option_a_ur}
                  onChange={handleChange}
                  style={{ direction: 'rtl' }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option B (English) *</label>
                <input
                  type="text"
                  className="form-control"
                  name="option_b"
                  value={formData.option_b}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Option B (Urdu)</label>
                <input
                  type="text"
                  className="form-control urdu-text"
                  name="option_b_ur"
                  value={formData.option_b_ur}
                  onChange={handleChange}
                  style={{ direction: 'rtl' }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option C (English)</label>
                <input
                  type="text"
                  className="form-control"
                  name="option_c"
                  value={formData.option_c}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Option C (Urdu)</label>
                <input
                  type="text"
                  className="form-control urdu-text"
                  name="option_c_ur"
                  value={formData.option_c_ur}
                  onChange={handleChange}
                  style={{ direction: 'rtl' }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option D (English)</label>
                <input
                  type="text"
                  className="form-control"
                  name="option_d"
                  value={formData.option_d}
                  onChange={handleChange}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Option D (Urdu)</label>
                <input
                  type="text"
                  className="form-control urdu-text"
                  name="option_d_ur"
                  value={formData.option_d_ur}
                  onChange={handleChange}
                  style={{ direction: 'rtl' }}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label">Correct Option *</label>
                <select
                  className="form-select"
                  name="correct_option"
                  value={formData.correct_option}
                  onChange={handleChange}
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

          {/* Short/Long Answer */}
          {(formData.question_type === 'short' ||
            formData.question_type === 'long') && (
            <>
              <div className="col-md-12">
                <label className="form-label">Answer Text (English) *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  name="answer_text"
                  value={formData.answer_text}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="col-md-12">
                <label className="form-label">Answer Text (Urdu)</label>
                <textarea
                  className="form-control urdu-text"
                  rows={3}
                  name="answer_text_ur"
                  value={formData.answer_text_ur}
                  onChange={handleChange}
                  style={{ direction: 'rtl' }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
        
        <button 
          type="button" 
          className="btn btn-outline-primary"
          onClick={handleTranslateAll}
          disabled={isTranslating || loading}
        >
          {isTranslating ? 'Translating...' : 'Translate to Urdu'}
        </button>
        
        <button type="submit" className="btn btn-primary" disabled={loading || isTranslating}>
          {loading ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}
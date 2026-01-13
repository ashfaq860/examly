// components/QuestionForm.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';
import { Editor } from '@tinymce/tinymce-react';

interface QuestionFormProps {
  question?: any;
  classes: any[];
  subjects: any[];
  chapters: any[];
  topics: any[];
  classSubjects: any[]; // { id, class_id, subject_id, ... }
  onClose: () => void;
}

// Define question types based on database schema
type QuestionType = 
  | 'mcq' 
  | 'short' 
  | 'long' 
  | 'translate_urdu' 
  | 'translate_english' 
  | 'idiom_phrases' 
  | 'passage' 
  | 'poetry_explanation' 
  | 'prose_explanation' 
  | 'sentence_correction' 
  | 'sentence_completion'
  | 'directInDirect'
  | 'activePassive';

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
    source_year: '',
    // Note: These are form-only fields, not database columns
    passage_text: '',
    passage_text_ur: '',
    idiom_phrase: '',
    idiom_phrase_explanation: '',
    poetry_text: '',
    prose_text: '',
    sentence_text: '',
    // New fields for direct/indirect and active/passive
    direct_sentence: '',
    indirect_sentence: '',
    active_sentence: '',
    passive_sentence: '',
  };

  const [formData, setFormData] = useState({
    ...initialTextFields,
    correct_option: '',
    class_id: '',
    subject_id: '',
    chapter_id: '',
    topic_id: '',
    difficulty: 'medium',
    question_type: 'mcq' as QuestionType,
    source_type: 'book' as 'book' | 'past_paper' | 'model_paper' | 'custom',
    passage_questions_count: 1,
  });

  const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
  const [filteredChapters, setFilteredChapters] = useState<any[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const editorRef = useRef<any>(null);
  
  // TinyMCE API Key (get from https://www.tiny.cloud/)
  // Store this in your .env.local file: NEXT_PUBLIC_TINYMCE_API_KEY=your-api-key
  const TINYMCE_API_KEY ='qqbfm54y8414ospds0zs0yfpy23me5hjvl26retbbz6372pk';
  
  // TinyMCE configuration for English/Math/Science
  const englishEditorConfig = {
    height: 300,
    menubar: true,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount',
      'math' // Math formula plugin (premium)
    ],
    toolbar: 
      'undo redo | blocks | bold italic underline strikethrough | ' +
      'forecolor backcolor | alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | superscript subscript | ' +
      'formula | removeformat help',
    content_style: 'body { font-family: Helvetica, Arial, sans-serif; font-size: 16px; }',
    directionality: 'ltr',
    // Math plugin configuration
    math: {
      mathml: true,
      engine: 'mathjax',
      lib: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
    },
    // Enable file upload for images
    images_upload_url: '/api/upload',
    images_upload_handler: async (blobInfo: any) => {
      try {
        // You'll need to implement your own image upload endpoint
        const formData = new FormData();
        formData.append('file', blobInfo.blob(), blobInfo.filename());
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        return data.location;
      } catch (error) {
        console.error('Image upload error:', error);
        return '';
      }
    }
  };

  // TinyMCE configuration for Urdu (RTL)
  const urduEditorConfig = {
    ...englishEditorConfig,
    content_style: 'body { font-family: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif; font-size: 16pt; direction: rtl; }',
    directionality: 'rtl',
    toolbar: 
      'undo redo | blocks | bold italic underline strikethrough | ' +
      'forecolor backcolor | alignright aligncenter alignleft alignjustify | ' +
      'bullist numlist outdent indent | ' +
      'formula | removeformat help',
  };

  // Check if selected subject is English
  const isEnglishSubject = () => {
    const selectedSubject = subjects.find(s => toId(s.id) === formData.subject_id);
    return selectedSubject?.name?.toLowerCase().includes('english') || false;
  };

  // Check if selected subject is Urdu
  const isUrduSubject = () => {
    const selectedSubject = subjects.find(s => toId(s.id) === formData.subject_id);
    return selectedSubject?.name?.toLowerCase().includes('urdu') || false;
  };

  // Check if subject is Math/Science (needs formula support)
  const isMathScienceSubject = () => {
    const selectedSubject = subjects.find(s => toId(s.id) === formData.subject_id);
    const subjectName = selectedSubject?.name?.toLowerCase() || '';
    return subjectName.includes('math') || 
           subjectName.includes('physics') || 
           subjectName.includes('chemistry') ||
           subjectName.includes('science');
  };

  // Function to reset only text fields
  const resetTextFields = () => {
    setFormData(prev => ({
      ...prev,
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
      // Form-only fields
      passage_text: '',
      passage_text_ur: '',
      idiom_phrase: '',
      idiom_phrase_explanation: '',
      poetry_text: '',
      prose_text: '',
      sentence_text: '',
      direct_sentence: '',
      indirect_sentence: '',
      active_sentence: '',
      passive_sentence: '',
      correct_option: (prev.question_type === 'mcq') ? '' : prev.correct_option,
      passage_questions_count: 1,
    }));
  };

  // Function to translate English to Urdu using MyMemory API
  const translateToUrdu = async (text: string): Promise<string> => {
    if (!text) return '';
    
    try {
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
      return text;
      
    } catch (err) {
      console.error('Translation error:', err);
      return text;
    }
  };

  // Manual translation function (only for non-English/Urdu subjects)
  const handleTranslateAll = async () => {
    if (!isEnglishSubject() && !isUrduSubject()) {
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
    }
  };

  // Check if we're in edit mode
  const isEditMode = Boolean(question);

  // Initialize form (Edit mode)
  useEffect(() => {
    if (!question) return;

    // Extract data from existing question
    let poetryText = '';
    let proseText = '';
    let sentenceText = '';
    let passageText = '';
    let passageTextUr = '';
    let idiomPhrase = '';
    let idiomPhraseExplanation = '';
    let directSentence = '';
    let indirectSentence = '';
    let activeSentence = '';
    let passiveSentence = '';
    let passageQuestionText = '';
    let passageQuestionTextUr = '';

    // Parse specialized fields from stored text
    if (question.question_type === 'poetry_explanation' && question.question_text_ur) {
      const match = question.question_text_ur.match(/اس شعر کی تشریح کریں: (.*)/);
      poetryText = match ? match[1] : question.question_text_ur;
    } else if (question.question_type === 'prose_explanation' && question.question_text_ur) {
      const match = question.question_text_ur.match(/اس نثر پارے کی تشریح کریں: (.*)/);
      proseText = match ? match[1] : question.question_text_ur;
    } else if ((question.question_type === 'sentence_correction' || question.question_type === 'sentence_completion') && question.question_text_ur) {
      const match = question.question_text_ur.match(/(درج ذیل جملے کو درست کریں|درج ذیل جملے کو مکمل کریں): (.*)/);
      sentenceText = match ? match[2] : question.question_text_ur;
    } else if (question.question_type === 'idiom_phrases' && question.question_text) {
      const match = question.question_text.match(/Idiom\/Phrase: (.*)/);
      idiomPhrase = match ? match[1] : question.question_text;
      idiomPhraseExplanation = question.answer_text || '';
    } else if (question.question_type === 'directInDirect' && question.question_text) {
      const match = question.question_text.match(/Convert the following direct speech into indirect speech: (.*)/);
      directSentence = match ? match[1] : question.question_text.replace('Convert the following direct speech into indirect speech: ', '');
      indirectSentence = question.answer_text || '';
    } else if (question.question_type === 'activePassive' && question.question_text) {
      const match = question.question_text.match(/Convert the following active voice into passive voice: (.*)/);
      activeSentence = match ? match[1] : question.question_text.replace('Convert the following active voice into passive voice: ', '');
      passiveSentence = question.answer_text || '';
    } else if (question.question_type === 'passage') {
      // Parse passage and question from stored text
      if (question.question_text) {
        // English passage
        const parts = question.question_text.split('\n\nQUESTION: ');
        passageText = parts[0] || '';
        passageQuestionText = parts[1] || '';
      } else if (question.question_text_ur) {
        // Urdu passage
        const parts = question.question_text_ur.split('\n\nQUESTION: ');
        passageTextUr = parts[0] || '';
        passageQuestionTextUr = parts[1] || '';
      }
    }

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
      question_text: passageQuestionText || question.question_text || '',
      question_text_ur: passageQuestionTextUr || question.question_text_ur || '',
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
      question_type: (question.question_type || 'mcq') as QuestionType,
      answer_text: question.answer_text || '',
      answer_text_ur: question.answer_text_ur || '',
      source_type: (question.source_type || 'book') as 'book' | 'past_paper' | 'model_paper' | 'custom',
      source_year: question.source_year ? String(question.source_year) : '',
      // Form-only fields (parsed from existing data)
      passage_text: passageText,
      passage_text_ur: passageTextUr,
      idiom_phrase: idiomPhrase,
      idiom_phrase_explanation: idiomPhraseExplanation,
      poetry_text: poetryText,
      prose_text: proseText,
      sentence_text: sentenceText,
      direct_sentence: directSentence,
      indirect_sentence: indirectSentence,
      active_sentence: activeSentence,
      passive_sentence: passiveSentence,
      passage_questions_count: 1,
    });
  }, [question, classSubjects]);

  // Filter subjects when class changes
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

  // Filter chapters when class and subject change
  useEffect(() => {
    const classId = formData.class_id;
    const subjectId = formData.subject_id;

    if (classId && subjectId) {
      const classSubject = classSubjects.find(
        cs => toId(cs.class_id) === classId && toId(cs.subject_id) === subjectId
      );
      
      if (classSubject) {
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

  // Filter topics when chapter changes
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

  // Submit
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

      // Build payload based on question type and subject
      const basePayload = {
        subject_id: formData.subject_id || null,
        chapter_id: formData.chapter_id || null,
        topic_id: formData.topic_id || null,
        difficulty: formData.difficulty,
        question_type: formData.question_type,
        source_type: formData.source_type,
        source_year: formData.source_year ? parseInt(formData.source_year) : null,
        class_subject_id: classSubject.id,
        created_by: profile?.id,
      };

      let typeSpecificPayload = {};

      // Handle English subject questions
      if (isEnglishSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: null,
              option_a: formData.option_a,
              option_b: formData.option_b,
              option_c: formData.option_c || null,
              option_d: formData.option_d || null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: formData.correct_option,
              answer_text: null,
              answer_text_ur: null,
            };
            break;

          case 'short':
          case 'long':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'translate_urdu':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: null,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'translate_english':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'idiom_phrases':
            typeSpecificPayload = {
              question_text: formData.idiom_phrase,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'passage':
            typeSpecificPayload = {
              question_text: `${formData.passage_text}\n\nQUESTION: ${formData.question_text}`,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'directInDirect':
            typeSpecificPayload = {
              question_text: formData.direct_sentence,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'activePassive':
            typeSpecificPayload = {
              question_text: formData.active_sentence,
              question_text_ur: null,
              answer_text: formData.answer_text,
              answer_text_ur: null,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;
        }
      }
      // Handle Urdu subject questions
      else if (isUrduSubject()) {
        switch (formData.question_type) {
          case 'mcq':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.question_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: formData.option_a_ur,
              option_b_ur: formData.option_b_ur,
              option_c_ur: formData.option_c_ur || null,
              option_d_ur: formData.option_d_ur || null,
              correct_option: formData.correct_option,
              answer_text: null,
              answer_text_ur: null,
            };
            break;

          case 'poetry_explanation':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.poetry_text,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'prose_explanation':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.prose_text,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'short':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.question_text_ur,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'long':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.question_text_ur,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'sentence_correction':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.sentence_text,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'sentence_completion':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: formData.sentence_text,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;

          case 'passage':
            typeSpecificPayload = {
              question_text: null,
              question_text_ur: `${formData.passage_text_ur}\n\nQUESTION: ${formData.question_text_ur}`,
              answer_text: null,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;
        }
      }
      // Handle other subjects (bilingual)
      else {
        switch (formData.question_type) {
          case 'mcq':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: formData.question_text_ur,
              option_a: formData.option_a,
              option_b: formData.option_b,
              option_c: formData.option_c || null,
              option_d: formData.option_d || null,
              option_a_ur: formData.option_a_ur || null,
              option_b_ur: formData.option_b_ur || null,
              option_c_ur: formData.option_c_ur || null,
              option_d_ur: formData.option_d_ur || null,
              correct_option: formData.correct_option,
              answer_text: null,
              answer_text_ur: null,
            };
            break;

          case 'short':
          case 'long':
            typeSpecificPayload = {
              question_text: formData.question_text,
              question_text_ur: formData.question_text_ur,
              answer_text: formData.answer_text,
              answer_text_ur: formData.answer_text_ur,
              option_a: null,
              option_b: null,
              option_c: null,
              option_d: null,
              option_a_ur: null,
              option_b_ur: null,
              option_c_ur: null,
              option_d_ur: null,
              correct_option: null,
            };
            break;
        }
      }

      const payload = { ...basePayload, ...typeSpecificPayload };

      console.log('Saving payload:', payload);

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
        resetTextFields();
      }
      
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

  // Special handler for TinyMCE editor changes
  const handleEditorChange = (content: string, fieldName: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: content }));
  };

  // Get available question types based on subject
  const getAvailableQuestionTypes = () => {
    if (isEnglishSubject()) {
      return [
        { value: 'mcq', label: 'Multiple Choice' },
        { value: 'short', label: 'Short Answer' },
        { value: 'long', label: 'Long Answer' },
        { value: 'translate_urdu', label: 'Translate into Urdu' },
        { value: 'translate_english', label: 'Translate into English' },
        { value: 'idiom_phrases', label: 'Idiom/Phrases' },
        { value: 'passage', label: 'Passage and Questions' },
        { value: 'directInDirect', label: 'Direct In Direct' },
        { value: 'activePassive', label: 'Active Voice / Passive Voice' },
      ];
    } else if (isUrduSubject()) {
      return [
        { value: 'mcq', label: 'MCQ (اردو)' },
        { value: 'poetry_explanation', label: 'اشعار کی تشریح' },
        { value: 'prose_explanation', label: 'نثرپاروں کی تشریح' },
        { value: 'short', label: 'مختصر سوالات' },
        { value: 'long', label: 'تفصیلی جوابات' },
        { value: 'sentence_correction', label: 'جملوں کی درستگی' },
        { value: 'sentence_completion', label: 'جملوں کی تکمیل' },
        { value: 'passage', label: 'نثر پارہ اور سوالات' },
      ];
    } else {
      return [
        { value: 'mcq', label: 'Multiple Choice' },
        { value: 'short', label: 'Short Answer' },
        { value: 'long', label: 'Long Answer' },
      ];
    }
  };

  // Helper function to determine which fields to show based on question type
  const shouldShowQuestionTextField = () => {
    if (isEnglishSubject()) {
      return !['translate_urdu', 'translate_english', 'idiom_phrases', 'directInDirect', 'activePassive', 'passage'].includes(formData.question_type);
    } else if (isUrduSubject()) {
      return ['mcq', 'short', 'long'].includes(formData.question_type);
    } else {
      return true;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="row g-3">
          {/* Question fields based on subject */}
          {isEnglishSubject() && (
            <>
              {/* English Question text - all types except specific ones */}
              {shouldShowQuestionTextField() && (
                <div className="col-md-12">
                  <label className="form-label">
                    Question Text (English) *
                  </label>
                  <Editor
                    apiKey={TINYMCE_API_KEY}
                    value={formData.question_text}
                    onEditorChange={(content) => handleEditorChange(content, 'question_text')}
                    init={englishEditorConfig}
                  />
                </div>
              )}

              {/* Text to translate for translate_urdu */}
              {formData.question_type === 'translate_urdu' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">English Text to Translate *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text')}
                      init={englishEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Text to translate for translate_english */}
              {formData.question_type === 'translate_english' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Urdu Text to Translate *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text')}
                      init={englishEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Idiom/Phrase fields */}
              {formData.question_type === 'idiom_phrases' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Idiom/Phrase (English) *</label>
                    <textarea
                      className="form-control"
                      name="idiom_phrase"
                      value={formData.idiom_phrase}
                      onChange={handleChange}
                      required
                      placeholder="e.g., 'Break a leg'"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* Passage fields */}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Passage Text (English) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.passage_text}
                      onEditorChange={(content) => handleEditorChange(content, 'passage_text')}
                      init={englishEditorConfig}
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Question about Passage (English) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text')}
                      init={englishEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Direct/Indirect Speech fields */}
              {formData.question_type === 'directInDirect' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Direct Speech Sentence *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.direct_sentence}
                      onEditorChange={(content) => handleEditorChange(content, 'direct_sentence')}
                      init={englishEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Active/Passive Voice fields */}
              {formData.question_type === 'activePassive' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Active Voice Sentence *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.active_sentence}
                      onEditorChange={(content) => handleEditorChange(content, 'active_sentence')}
                      init={englishEditorConfig}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {isUrduSubject() && (
            <>
              {/* Urdu MCQ */}
              {formData.question_type === 'mcq' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">سوال (اردو) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text_ur')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Urdu Poetry Explanation */}
              {formData.question_type === 'poetry_explanation' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">شعر *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.poetry_text}
                      onEditorChange={(content) => handleEditorChange(content, 'poetry_text')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Urdu Prose Explanation */}
              {formData.question_type === 'prose_explanation' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">نثر پارہ *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.prose_text}
                      onEditorChange={(content) => handleEditorChange(content, 'prose_text')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Short and Long Questions */}
              {(formData.question_type === 'short' || formData.question_type === 'long') && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">سوال *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text_ur')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Sentence Correction/Completion */}
              {(formData.question_type === 'sentence_correction' || formData.question_type === 'sentence_completion') && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">
                      {formData.question_type === 'sentence_correction' ? 'جملہ (درستگی کے لیے) *' : 'جملہ (تکمیل کے لیے) *'}
                    </label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.sentence_text}
                      onEditorChange={(content) => handleEditorChange(content, 'sentence_text')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}

              {/* Urdu Passage fields */}
              {formData.question_type === 'passage' && (
                <>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">نثر پارہ (پاسج) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.passage_text_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'passage_text_ur')}
                      init={urduEditorConfig}
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label urdu-label">سوال (پاسج کے بارے میں) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.question_text_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'question_text_ur')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* For other subjects (bilingual) */}
          {!isEnglishSubject() && !isUrduSubject() && (
            <>
              {/* English Question text */}
              <div className="col-md-12">
                <label className="form-label">Question Text (English) *</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.question_text}
                  onEditorChange={(content) => handleEditorChange(content, 'question_text')}
                  init={isMathScienceSubject() ? englishEditorConfig : {
                    ...englishEditorConfig,
                    plugins: englishEditorConfig.plugins.filter(p => p !== 'math'),
                    toolbar: englishEditorConfig.toolbar.replace('formula | ', '')
                  }}
                />
              </div>

              {/* Urdu Question text */}
              <div className="col-md-12">
                <label className="form-label">Question Text (Urdu)</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.question_text_ur}
                  onEditorChange={(content) => handleEditorChange(content, 'question_text_ur')}
                  init={urduEditorConfig}
                />
              </div>
            </>
          )}

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
              className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`}
              name="chapter_id"
              value={formData.chapter_id}
              onChange={handleChange}
              disabled={!formData.class_id || !formData.subject_id}
            >
              <option value="">{isUrduSubject()?'چیپٹر کا انتخاب کریں':'Select Chapter'}</option>
              {filteredChapters.map((chapter,index) => (
                <option key={toId(chapter.id)} value={toId(chapter.id)}>
                 {index+1}-{chapter.name}
                  {chapter.description ? ` — ${chapter.description}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div className="col-md-6">
            <label className="form-label">Topic</label>
            <select
              className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`}
              name="topic_id"
              value={formData.topic_id}
              onChange={handleChange}
              disabled={!formData.chapter_id}
            >
              <option value="">{isUrduSubject()?'موضوع کا انتخاب کریں':'Select Topic'}</option>
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
              className={`form-select ${isUrduSubject() ? 'urdu-text' : ''}`}
              name="question_type"
              value={formData.question_type}
              onChange={handleChange}
              required
            >
              <option value="">Select Question Type</option>
              {getAvailableQuestionTypes().map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {isEnglishSubject() && (
              <small className="text-muted d-block mt-1">
                English subject supports specialized question types
              </small>
            )}
            {isUrduSubject() && (
              <small className="text-muted d-block mt-1">
                Urdu subject supports specialized question types
              </small>
            )}
            {isMathScienceSubject() && (
              <small className="text-success d-block mt-1">
                Math/Science subject: Formula editor enabled
              </small>
            )}
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
        </div>
        <div className="row g-3 mt-2">
          {/* English and Other Subjects MCQ Options */}
          {(formData.question_type === 'mcq' && (isEnglishSubject() || (!isEnglishSubject() && !isUrduSubject()))) && (
            <>
              <div className="col-md-6">
                <label className="form-label">Option A (English) *</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_a}
                  onEditorChange={(content) => handleEditorChange(content, 'option_a')}
                  init={{
                    ...englishEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript | formula'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option B (English) *</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_b}
                  onEditorChange={(content) => handleEditorChange(content, 'option_b')}
                  init={{
                    ...englishEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript | formula'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option C (English)</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_c}
                  onEditorChange={(content) => handleEditorChange(content, 'option_c')}
                  init={{
                    ...englishEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript | formula'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Option D (English)</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_d}
                  onEditorChange={(content) => handleEditorChange(content, 'option_d')}
                  init={{
                    ...englishEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript | formula'
                  }}
                />
              </div>

              {/* Urdu options for other subjects only */}
              {!isEnglishSubject() && !isUrduSubject() && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Option A (Urdu)</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.option_a_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'option_a_ur')}
                      init={{
                        ...urduEditorConfig,
                        height: 150,
                        menubar: false,
                        toolbar: 'bold italic | superscript subscript | formula'
                      }}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Option B (Urdu)</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.option_b_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'option_b_ur')}
                      init={{
                        ...urduEditorConfig,
                        height: 150,
                        menubar: false,
                        toolbar: 'bold italic | superscript subscript | formula'
                      }}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Option C (Urdu)</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.option_c_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'option_c_ur')}
                      init={{
                        ...urduEditorConfig,
                        height: 150,
                        menubar: false,
                        toolbar: 'bold italic | superscript subscript | formula'
                      }}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Option D (Urdu)</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.option_d_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'option_d_ur')}
                      init={{
                        ...urduEditorConfig,
                        height: 150,
                        menubar: false,
                        toolbar: 'bold italic | superscript subscript | formula'
                      }}
                    />
                  </div>
                </>
              )}

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

          {/* Urdu Subject MCQ Options */}
          {formData.question_type === 'mcq' && isUrduSubject() && (
            <>
              <div className="col-md-6">
                <label className="form-label urdu-label">آپشن اے (اردو) *</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_a_ur}
                  onEditorChange={(content) => handleEditorChange(content, 'option_a_ur')}
                  init={{
                    ...urduEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label urdu-label">آپشن بی (اردو) *</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_b_ur}
                  onEditorChange={(content) => handleEditorChange(content, 'option_b_ur')}
                  init={{
                    ...urduEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label urdu-label">آپشن سی (اردو)</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_c_ur}
                  onEditorChange={(content) => handleEditorChange(content, 'option_c_ur')}
                  init={{
                    ...urduEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript'
                  }}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label urdu-label">آپشن ڈی (اردو)</label>
                <Editor
                  apiKey={TINYMCE_API_KEY}
                  value={formData.option_d_ur}
                  onEditorChange={(content) => handleEditorChange(content, 'option_d_ur')}
                  init={{
                    ...urduEditorConfig,
                    height: 150,
                    menubar: false,
                    toolbar: 'bold italic | superscript subscript'
                  }}
                />
              </div>

              <div className="col-md-12">
                <label className="form-label urdu-text" style={{float:'right'}}>صحیح آپشن منتخب کریں *</label>
                <select
                  className="form-select urdu-text"
                  name="correct_option"
                  value={formData.correct_option}
                  onChange={handleChange}
                  required
                >
                  <option value="">صحیح آپشن منتخب کریں</option>
                  <option value="A">آپشن اے</option>
                  <option value="B">آپشن بی</option>
                  {formData.option_c_ur && <option value="C">آپشن سی</option>}
                  {formData.option_d_ur && <option value="D">آپشن ڈی</option>}
                </select>
              </div>
            </>
          )}

          {/* Answer fields for non-MCQ questions */}
          {formData.question_type !== 'mcq' && (
            <>
              {isEnglishSubject() && (
                <div className="col-md-12">
                  <label className="form-label">Answer (English) *</label>
                  <Editor
                    apiKey={TINYMCE_API_KEY}
                    value={formData.answer_text}
                    onEditorChange={(content) => handleEditorChange(content, 'answer_text')}
                    init={englishEditorConfig}
                  />
                </div>
              )}

              {isUrduSubject() && (
                <div className="col-md-12">
                  <label className="form-label urdu-label">جواب (اردو) *</label>
                  <Editor
                    apiKey={TINYMCE_API_KEY}
                    value={formData.answer_text_ur}
                    onEditorChange={(content) => handleEditorChange(content, 'answer_text_ur')}
                    init={urduEditorConfig}
                  />
                </div>
              )}

              {!isEnglishSubject() && !isUrduSubject() && (
                <>
                  <div className="col-md-12">
                    <label className="form-label">Answer (English) *</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.answer_text}
                      onEditorChange={(content) => handleEditorChange(content, 'answer_text')}
                      init={isMathScienceSubject() ? englishEditorConfig : {
                        ...englishEditorConfig,
                        plugins: englishEditorConfig.plugins.filter(p => p !== 'math'),
                        toolbar: englishEditorConfig.toolbar.replace('formula | ', '')
                      }}
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Answer (Urdu)</label>
                    <Editor
                      apiKey={TINYMCE_API_KEY}
                      value={formData.answer_text_ur}
                      onEditorChange={(content) => handleEditorChange(content, 'answer_text_ur')}
                      init={urduEditorConfig}
                    />
                  </div>
                </>
              )}
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
        
        {/* Show translation button only for non-English/Urdu subjects */}
        {!isEnglishSubject() && !isUrduSubject() && (
          <button 
            type="button" 
            className="btn btn-outline-primary"
            onClick={handleTranslateAll}
            disabled={isTranslating || loading}
          >
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
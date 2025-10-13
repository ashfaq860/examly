// API routes for the quiz system
import { supabase } from "@/lib/supabaseClient";
// GET /api/classes - Get all classes
app.get('/api/quizz', async (req, res) => {
  try {
    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .order('name');
    
    if (error) throw error;
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/classes/:classId/subjects - Get subjects for a class
app.get('/api/quizz/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const { data: subjects, error } = await supabase
      .from('class_subjects')
      .select(`
        subject:subjects(*)
      `)
      .eq('class_id', classId);
    
    if (error) throw error;
    
    const formattedSubjects = subjects.map(item => item.subject);
    res.json(formattedSubjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/subjects/:subjectId/chapters - Get chapters for a subject and class
app.get('/api/subjects/:subjectId/chapters', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { class_id } = req.query;
    
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('class_id', class_id)
      .order('chapterNo');
    
    if (error) throw error;
    res.json(chapters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/generate-quiz - Generate quiz based on selection
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { classId, subjectId, quizType, chapters, questionCount, difficulty } = req.body;
    
    let query = supabase
      .from('questions')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('class_subject_id', classId) // Using class_subject relationship
      .eq('question_type', 'mcq'); // Only MCQ questions

    // Filter by chapters if chapter-wise quiz
    if (quizType === 'chapter' && chapters && chapters.length > 0) {
      query = query.in('chapter_id', chapters);
    }

    // Filter by difficulty if specified
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }

    // Limit number of questions
    if (questionCount) {
      query = query.limit(questionCount);
    }

    const { data: questions, error } = await query;
    
    if (error) throw error;
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
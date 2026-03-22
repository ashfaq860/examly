import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Helper function to flatten the nested Supabase join response 
 * into a clean object for the frontend components.
 */
const flattenQuestion = (q: any) => ({
  ...q,
  // Ensure we get string IDs for consistent frontend comparison
  id: String(q.id),
  // Extracting nested relationship data
  chapterNo: q.topics?.chapters?.chapterNo || 'N/A',
  chapterName: q.topics?.chapters?.name || 'N/A',
  topicName: q.topics?.name || 'General',
  // Providing a clean source field
  source: q.source_type || 'book'
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // 1. Extract Query Params
    const subjectId = searchParams.get('subjectId');
    const classId = searchParams.get('classId');
    const questionType = searchParams.get('questionType');
    const difficulty = searchParams.get('difficulty');
    const chapterIdsParam = searchParams.get('chapterIds');
    const topicIdsParam = searchParams.get('topicIds');
    const questionIdsParam = searchParams.get('questionIds');
    const language = searchParams.get('language');
    const sourceTypeParam = searchParams.get('source_type');
    
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const random = searchParams.get('random') === 'true';

    // --- CASE A: Manual Selection by IDs ---
    // Used when loading specific questions for an existing paper
    if (questionIdsParam) {
      const ids = questionIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json([]);

      const { data, error } = await supabaseAdmin
        .from('questions')
        .select(`
          *,
          topics (
            id,
            name,
            chapters (
              id, 
              name, 
              "chapterNo"
            )
          )
        `)
        .in('id', ids);

      if (error) throw error;
      return NextResponse.json((data || []).map(flattenQuestion));
    }

    // --- CASE B: Filtered Search / Auto Generation ---
    // 2. Validation
    if (!questionType) {
      return NextResponse.json({ error: 'questionType is required' }, { status: 400 });
    }

    // 3. Build the Relational Join Query
    // We use !inner joins to ensure we only get questions that belong 
    // to the correct Class and Subject hierarchy.
    let query = supabaseAdmin
      .from('questions')
      .select(`
        *,
        topics!inner (
          id,
          name,
          chapter_id,
          chapters!inner (
            id,
            name,
            "chapterNo",
            class_subjects!inner (
              class_id,
              subject_id
            )
          )
        )
      `, { count: 'exact' })
      .eq('question_type', questionType);

    // Apply Hierarchy Filters
    if (classId) {
      query = query.eq('topics.chapters.class_subjects.class_id', classId);
    }
    if (subjectId) {
      query = query.eq('topics.chapters.class_subjects.subject_id', subjectId);
    }

    // Apply Chapter & Topic Filters
    if (chapterIdsParam) {
      const requestedChapters = chapterIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (requestedChapters.length > 0) {
        query = query.in('topics.chapter_id', requestedChapters);
      }
    }

    if (topicIdsParam) {
      const requestedTopics = topicIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (requestedTopics.length > 0) {
        query = query.in('topic_id', requestedTopics);
      }
    }

    // Apply Language Filter (Filters for bilingual/Urdu content availability)
    if (language === 'urdu') {
      query = query.not('question_text_ur', 'is', null);
    }

    // Apply Source Type Filter (e.g., past_paper, model_paper)
    if (sourceTypeParam && sourceTypeParam !== 'all') {
      const sources = sourceTypeParam.split(',').map(s => s.trim());
      query = query.in('source_type', sources);
    }

    // Apply Difficulty Filter
    if (difficulty && difficulty !== 'any') {
      query = query.eq('difficulty', difficulty);
    }

    // 4. Execution & Randomization
    // If random is true, we fetch a larger pool and shuffle manually
    const { data: questionsData, error: fetchError } = await query.limit(random ? 200 : limit);
    if (fetchError) throw fetchError;

    let finalResult = questionsData || [];

    if (random) {
      finalResult = finalResult.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    // 5. Final Mapping
    return NextResponse.json(finalResult.map(flattenQuestion));

  } catch (error: any) {
    console.error('DATABASE ERROR:', error.message, error.details);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error.message,
        hint: 'Check if table names or relationship joins match your schema'
      }, 
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subjectId,
      classId,
      chapterIds = [],
      topicIds = [], // Receives specific topics to include (skips the rest)
      questionType,
      language = 'english',
      sourceTypes = ['all'],
      limit = 10
    } = body;

    // 1. Validation
    if (!subjectId || !classId || !questionType) {
      return NextResponse.json(
        { error: 'subjectId, classId, and questionType are required' },
        { status: 400 }
      );
    }

    // 2. Resolve the Junction (class_subjects) to find the correct Chapters
    const { data: classSubject, error: csError } = await supabaseAdmin
      .from('class_subjects')
      .select('id')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .single();

    if (csError || !classSubject) {
      return NextResponse.json({ error: 'Subject not assigned to this class' }, { status: 404 });
    }

    // 3. Build Query with Topic/Chapter Filtering
    let query = supabaseAdmin
      .from('questions')
      .select(`
        *,
        topics!inner (
          id,
          chapter_id,
          chapters!inner (id, name, "chapterNo")
        )
      `)
      .eq('question_type', questionType);

    /**
     * TOPIC SKIPPING LOGIC:
     * If topicIds are provided, we filter strictly by those topics.
     * Otherwise, we fallback to all topics within the selected chapters.
     */
    if (topicIds.length > 0) {
      query = query.in('topic_id', topicIds);
    } else {
      // Get all valid chapter IDs for this subject if none specified
      const { data: chaptersData } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .eq('class_subject_id', classSubject.id);
      
      const dbChapterIds = chaptersData?.map(ch => ch.id) || [];
      const targetChapterIds = chapterIds.length > 0 
        ? dbChapterIds.filter(id => chapterIds.includes(id)) 
        : dbChapterIds;

      query = query.in('topics.chapter_id', targetChapterIds);
    }

    // 4. Filter by Source
    if (sourceTypes.length > 0 && !sourceTypes.includes('all')) {
      query = query.in('source_type', sourceTypes);
    }

    // Over-fetch to allow for better randomization
    const { data, error } = await query.limit(limit * 4);

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }

    // 5. Shuffle and Language Shaping
    const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, limit);

    const formatted = shuffled.map(q => {
      const base = {
        ...q,
        chapterNo: q.topics?.chapters?.chapterNo,
        chapterName: q.topics?.chapters?.name
      };

      // CASE: URDU ONLY - Replace English fields with Urdu
      if (language === 'urdu') {
        return {
          ...base,
          question_text: q.question_text_ur || q.question_text,
          option_a: q.option_a_ur || q.option_a,
          option_b: q.option_b_ur || q.option_b,
          option_c: q.option_c_ur || q.option_c,
          option_d: q.option_d_ur || q.option_d,
          answer_text: q.answer_text_ur || q.answer_text
        };
      }

      // CASE: BILINGUAL - Return both (Original fields + _ur fields)
      // We do NOT overwrite here; the frontend handles displaying both.
      if (language === 'bilingual') {
        return {
          ...base,
          isBilingual: true // Helper flag for your renderer
        };
      }

      // CASE: ENGLISH ONLY
      return base; 
    });

    return NextResponse.json(formatted);

  } catch (err: any) {
    console.error('Random API Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
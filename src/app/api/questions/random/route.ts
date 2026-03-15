// api/question/random/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subjectId,
      classId, // Changed from classSubjectId to match your front-end/GET logic
      chapterIds = [],
      questionType,
      language = 'english',
      sourceTypes = ['book'],
      limit = 10
    } = body;

    // 1. Validation (Matches your GET route logic)
    if (!subjectId || !classId || !questionType) {
      return NextResponse.json(
        { error: 'subjectId, classId, and questionType are required' },
        { status: 400 }
      );
    }

    // 2. Resolve Chapters (Crucial Step from your GET route)
    // This ensures we only get questions for the right Class + Subject combo
    const { data: chaptersData, error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('class_id', classId);

    if (chaptersError) throw chaptersError;
    const dbChapterIds = chaptersData?.map(ch => ch.id) || [];

    // Filter by user-selected chapters OR use all chapters for that subject/class
    let targetChapterIds = dbChapterIds;
    if (chapterIds.length > 0) {
      targetChapterIds = dbChapterIds.filter(id => chapterIds.includes(id));
    }

    if (targetChapterIds.length === 0) {
      return NextResponse.json({ error: 'No chapters found' }, { status: 404 });
    }

    // 3. Build Query
    let query = supabaseAdmin
      .from('questions')
      .select('*') // Select all to handle language shaping later
      .in('chapter_id', targetChapterIds)
      .eq('question_type', questionType);

    // Filter Source Types
    if (sourceTypes.length > 0 && !sourceTypes.includes('all')) {
      query = query.in('source_type', sourceTypes);
    }

    // Over-fetch for better randomness shuffle
    const { data, error } = await query.limit(limit * 4);

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No questions found' }, { status: 404 });
    }

    // 4. Shuffle and Language Shaping
    const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, limit);

    const formatted = shuffled.map(q => {
      if (language === 'urdu') {
        return {
          ...q,
          question_text: q.question_text_ur || q.question_text,
          option_a: q.option_a_ur || q.option_a,
          option_b: q.option_b_ur || q.option_b,
          option_c: q.option_c_ur || q.option_c,
          option_d: q.option_d_ur || q.option_d,
          answer_text: q.answer_text_ur || q.answer_text
        };
      }
      return q; 
    });

    return NextResponse.json(formatted);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
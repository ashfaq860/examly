// app/api/questions/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/questions/export
 * Returns all question rows (with nested joins) that match optional filters.
 * The client side is responsible for XLSX generation.
 */
export async function GET(req: NextRequest) {
  try {
    const sp           = req.nextUrl.searchParams;
    const difficulty   = sp.get('difficulty')    || '';
    const question_type = sp.get('question_type') || '';
    const source_type  = sp.get('source_type')   || '';
    const topic_id     = sp.get('topic_id')      || '';

    let query = supabase
      .from('questions')
      .select(`
        id, question_text, question_text_ur,
        option_a, option_b, option_c, option_d,
        option_a_ur, option_b_ur, option_c_ur, option_d_ur,
        correct_option, difficulty, question_type,
        source_type, source_year, answer_text, answer_text_ur,
        topic_id,
        topic:topics!inner(
          id, name, chapter_id,
          chapter:chapters!inner(
            id, name, chapterNo, class_subject_id,
            class_subject:class_subjects!inner(
              id, class_id, subject_id,
              class:classes!inner(id,name,description),
              subject:subjects!inner(id,name,name_ur)
            )
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (difficulty)    query = query.eq('difficulty',    difficulty);
    if (question_type) query = query.eq('question_type', question_type);
    if (source_type)   query = query.eq('source_type',   source_type);
    if (topic_id)      query = query.eq('topic_id',      topic_id);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /api/questions/export]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// app/api/admin/questions/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const sp                   = req.nextUrl.searchParams;
    const difficulty            = sp.get('difficulty')           || '';
    const question_type         = sp.get('question_type')        || '';
    const source_type           = sp.get('source_type')          || '';
    const topic_id               = sp.get('topic_id')              || '';
    const chapter_id             = sp.get('chapter_id')            || '';
    const subject_id             = sp.get('subject_id')            || '';
    const class_id               = sp.get('class_id')              || '';
    const search                 = sp.get('search')                || '';
    const question_category_id   = sp.get('question_category_id') || '';

    let query = supabase
      .from('questions')
      .select(`
        id, question_text, question_text_ur,
        option_a, option_b, option_c, option_d,
        option_a_ur, option_b_ur, option_c_ur, option_d_ur,
        correct_option, difficulty, question_type,
        source_type, source_year, answer_text, answer_text_ur,
        diagram, topic_id, question_category_id,
        topic:topics(
          id, name, chapter_id,
          chapter:chapters(
            id, name, chapterNo, class_subject_id,
            class_subject:class_subjects(
              id, class_id, subject_id,
              class:classes(id, name, description),
              subject:subjects(id, name, name_ur)
            )
          )
        ),
        question_category_rel:question_categories(
          id, question_type, category_value, label_en, label_ur
        )
      `)
      .order('created_at', { ascending: false });

    // Direct question-level filters
    if (difficulty)           query = query.eq('difficulty', difficulty);
    if (question_type)        query = query.eq('question_type', question_type);
    if (source_type)          query = query.overlaps('source_type', [source_type]);
    if (topic_id)              query = query.eq('topic_id', topic_id);
    if (question_category_id) query = query.eq('question_category_id', question_category_id);

    // Full-text search on question_text
    if (search) query = query.ilike('question_text', `%${search}%`);

    // For chapter/subject/class filters we filter via the joined topic relation.
    // Supabase supports filtering on embedded relations using dot notation.
    if (chapter_id) {
      query = query.eq('topic.chapter_id', chapter_id);
    }
    if (subject_id) {
      query = query.eq('topic.chapter.class_subject.subject_id', subject_id);
    }
    if (class_id) {
      query = query.eq('topic.chapter.class_subject.class_id', class_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Post-filter: when filtering by chapter/subject/class via joined relation,
    // Supabase returns all rows but nullifies the nested object when it doesn't match.
    // We must drop rows where the join didn't satisfy the filter.
    let filtered = data ?? [];

    if (chapter_id) {
      filtered = filtered.filter(q => (q.topic as any)?.chapter_id === chapter_id);
    }
    if (subject_id) {
      filtered = filtered.filter(q =>
        (q.topic as any)?.chapter?.class_subject?.subject_id === subject_id
      );
    }
    if (class_id) {
      filtered = filtered.filter(q =>
        (q.topic as any)?.chapter?.class_subject?.class_id === class_id
      );
    }

    return NextResponse.json({ data: filtered });
  } catch (err: any) {
    console.error('[GET /api/admin/questions/export]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
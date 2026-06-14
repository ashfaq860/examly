// app/api/questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only service role key
);

const QUESTION_SELECT = `
  id, question_text, question_text_ur,
  option_a, option_b, option_c, option_d,
  option_a_ur, option_b_ur, option_c_ur, option_d_ur,
  correct_option, difficulty, question_type,
  source_type, source_year, answer_text, answer_text_ur,
  created_at, topic_id,
  topic:topics(
    id, name, chapter_id,
    chapter:chapters(
      id, name, chapterNo, class_subject_id,
      class_subject:class_subjects(
        id, class_id, subject_id,
        class:classes(id,name,description),
        subject:subjects(id,name,name_ur)
      )
    )
  )
`;

async function resolveTopicIds(params: {
  class_id?: string;
  subject_id?: string;
  chapter_id?: string;
}): Promise<string[] | null> {
  const { class_id, subject_id, chapter_id } = params;
  if (!class_id && !subject_id && !chapter_id) return null;

  if (chapter_id) {
    const { data } = await supabase
      .from('topics')
      .select('id')
      .eq('chapter_id', chapter_id);
    return data?.length ? data.map((t: any) => t.id) : ['-1'];
  }

  // Resolve class_subjects → chapters → topics
  let csQuery = supabase.from('class_subjects').select('id');
  if (class_id)   csQuery = csQuery.eq('class_id',   class_id);
  if (subject_id) csQuery = csQuery.eq('subject_id', subject_id);
  const { data: csData } = await csQuery;

  let chQuery = supabase.from('chapters').select('id, class_subject_id');
  if (csData?.length) chQuery = chQuery.in('class_subject_id', csData.map((c: any) => c.id));
  else chQuery = chQuery.in('id', ['-1']);
  const { data: chData } = await chQuery;

  let tQuery = supabase.from('topics').select('id');
  if (chData?.length) tQuery = tQuery.in('chapter_id', chData.map((c: any) => c.id));
  else tQuery = tQuery.in('id', ['-1']);
  const { data: tData } = await tQuery;

  return tData?.length ? tData.map((t: any) => t.id) : ['-1'];
}

/** GET /api/questions */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const page        = Math.max(1, Number(sp.get('page')  || 1));
    const perPage     = Math.min(200, Math.max(1, Number(sp.get('per_page') || 20)));
    const search      = sp.get('search')        || '';
    const class_id    = sp.get('class_id')      || '';
    const subject_id  = sp.get('subject_id')    || '';
    const chapter_id  = sp.get('chapter_id')    || '';
    const topic_id    = sp.get('topic_id')      || '';
    const difficulty  = sp.get('difficulty')    || '';
    const question_type = sp.get('question_type') || '';
    const source_type = sp.get('source_type')   || '';

    // Resolve topic IDs from hierarchical filters
    const topicIds = await resolveTopicIds({
      class_id:   class_id   || undefined,
      subject_id: subject_id || undefined,
      chapter_id: chapter_id || undefined,
    });

    const applyFilters = (base: any) => {
      let b = base;
      if (search.trim()) {
        b = b.or(`question_text.ilike.*${search.trim()}*,question_text_ur.ilike.*${search.trim()}*`);
      }
      if (topicIds)      b = b.in('topic_id', topicIds);
      if (topic_id)      b = b.eq('topic_id',      topic_id);
      if (difficulty)    b = b.eq('difficulty',    difficulty);
      if (question_type) b = b.eq('question_type', question_type);
      if (source_type)   b = b.eq('source_type',   source_type);
      return b;
    };

    // Count
    const { count, error: countError } = await applyFilters(
      supabase.from('questions').select('id', { count: 'exact', head: true })
    );
    if (countError) throw countError;

    // Data
    const from = (page - 1) * perPage;
    const { data, error } = await applyFilters(
      supabase
        .from('questions')
        .select(QUESTION_SELECT)
        .order('created_at', { ascending: false })
        .range(from, from + perPage - 1)
    );
    if (error) throw error;

    return NextResponse.json({ data, total: count ?? 0, page, per_page: perPage });
  } catch (err: any) {
    console.error('[GET /api/questions]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/questions  — bulk import */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows: any[] = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array required' }, { status: 400 });
    }
    const { error } = await supabase.from('questions').insert(rows);
    if (error) throw error;
    return NextResponse.json({ inserted: rows.length });
  } catch (err: any) {
    console.error('[POST /api/questions]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
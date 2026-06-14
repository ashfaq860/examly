// app/api/admin/lookups/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/admin/lookups
 * Returns all lookup tables in one request:
 *   { classes, subjects, chapters, topics, classSubjects }
 *
 * NOTE: .range(0, 9999) overrides Supabase's default 1000-row cap.
 * Supabase silently truncates queries that exceed the limit without
 * any error, which causes topic matching to fail on large datasets.
 */
export async function GET() {
  try {
    const [
      { data: classes,       error: e1 },
      { data: subjects,      error: e2 },
      { data: chapters,      error: e3 },
      { data: topics,        error: e4 },
      { data: classSubjects, error: e5 },
    ] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('chapters').select('*').order('chapterNo', { ascending: true, nullsFirst: false }).range(0, 9999),
      supabase.from('topics').select('*').order('name').range(0, 9999),
      supabase
        .from('class_subjects')
        .select(`
          id, class_id, subject_id,
          subject:subjects(id,name,name_ur),
          class:classes(id,name,description)
        `)
        .order('class_id'),
    ]);

    const firstError = e1 || e2 || e3 || e4 || e5;
    if (firstError) throw firstError;

    return NextResponse.json({ classes, subjects, chapters, topics, classSubjects });
  } catch (err: any) {
    console.error('[GET /api/admin/lookups]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
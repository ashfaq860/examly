// src/app/api/admin/questions/route.ts
//
// Question Bank CRUD — list (GET) + create (POST).
// This path is owned by lib/questionsApi.ts (admin Question Bank page).
// It is NOT the paper-generator sampling endpoint — that lives at
// /api/questions (see src/app/api/questions/route.ts), which is called
// by PaperBuilderApp / useGeneratePaper / ruleBasedSelector etc.
// Do not merge paper-generator sampling logic back into this file.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/api-auth';
import { sanitizeRichTextFields } from '@/lib/sanitizeHtml';

const QUESTION_SELECT = `
  *,
  topic:topics (
    id, name, chapter_id,
    chapter:chapters (
      id, name, "chapterNo", class_subject_id,
      class_subject:class_subjects (
        id, class_id, subject_id,
        class:classes ( id, name, description ),
        subject:subjects ( id, name, name_ur )
      )
    )
  ),
  question_category_rel:question_categories (
    id, question_type, category_value, label_en, label_ur
  )
`;

// ── GET /api/admin/questions ────────────────────────────────────────────────
// Paginated, filtered list for the Question Bank admin table.
export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);

  try {
    const page     = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage  = Math.max(1, parseInt(searchParams.get('per_page') || '20', 10));

    const search               = searchParams.get('search');
    const classId              = searchParams.get('class_id');
    const subjectId            = searchParams.get('subject_id');
    const chapterId             = searchParams.get('chapter_id');
    const topicId               = searchParams.get('topic_id');
    const difficulty            = searchParams.get('difficulty');
    const questionType          = searchParams.get('question_type');
    const sourceType            = searchParams.get('source_type');
    const questionCategoryId    = searchParams.get('question_category_id');

    const from = (page - 1) * perPage;
    const to   = from + perPage - 1;

    let q = supabaseAdmin
      .from('questions')
      .select(QUESTION_SELECT, { count: 'exact' });

    // Nested-relation filters require !inner so the filter actually
    // restricts the parent row set (Supabase/PostgREST quirk: a plain
    // left join filter on a nested column is ignored unless the join
    // is forced to inner).
    if (classId || subjectId) {
      q = supabaseAdmin
        .from('questions')
        .select(
          QUESTION_SELECT.replace('topic:topics (', 'topic:topics!inner (')
                          .replace('chapter:chapters (', 'chapter:chapters!inner (')
                          .replace('class_subject:class_subjects (', 'class_subject:class_subjects!inner (')
          , { count: 'exact' }
        );
      if (classId)   q = q.eq('topic.chapter.class_subject.class_id', classId);
      if (subjectId) q = q.eq('topic.chapter.class_subject.subject_id', subjectId);
    }

    if (chapterId)            q = q.eq('topic.chapter_id', chapterId);
    if (topicId)               q = q.eq('topic_id', topicId);
    if (difficulty)            q = q.eq('difficulty', difficulty);
    if (questionType)          q = q.eq('question_type', questionType);
    if (questionCategoryId)    q = q.eq('question_category_id', questionCategoryId);

    if (sourceType) {
      const sources = sourceType.split(',').map(s => s.trim()).filter(Boolean);
      if (sources.length === 1) q = q.eq('source_type', sources[0]);
      else if (sources.length > 1) q = q.in('source_type', sources);
    }

    if (search) {
      q = q.or(
        `question_text.ilike.%${search}%,question_text_ur.ilike.%${search}%`
      );
    }

    q = q.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      per_page: perPage,
    });

  } catch (error: any) {
    console.error('GET /api/admin/questions error:', error.message, error.details);
    return NextResponse.json(
      { error: error.message || 'Failed to load questions' },
      { status: 500 }
    );
  }
}

// ── POST /api/admin/questions ───────────────────────────────────────────────
// Create a single question from the Add Question form.
// Body: { rows: [questionObject] } — always exactly one row.
export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'rows is required and must be a non-empty array' }, { status: 400 });
    }

    const RICH_TEXT_FIELDS = [
      'question_text', 'question_text_ur',
      'option_a', 'option_b', 'option_c', 'option_d',
      'option_a_ur', 'option_b_ur', 'option_c_ur', 'option_d_ur',
      'answer_text', 'answer_text_ur',
    ] as const;
    const sanitizedRows = rows.map((row: Record<string, any>) => sanitizeRichTextFields(row, RICH_TEXT_FIELDS));

    const { data, error } = await supabaseAdmin
      .from('questions')
      .insert(sanitizedRows)
      .select('id');

    if (error) throw error;

    return NextResponse.json({ inserted: data?.length || 0 });

  } catch (error: any) {
    console.error('POST /api/admin/questions error:', error.message, error.details);
    return NextResponse.json(
      { error: error.message || 'Failed to create question' },
      { status: 500 }
    );
  }
}
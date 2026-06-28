// app/api/chapter-range-rules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

const TABLE = 'chapter_question_rules';

async function requireSession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null };
}

function normalizeCategoryId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeNullableText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeNullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  return Number(value);
}

async function findOverlappingRules(
  supabase: Awaited<ReturnType<typeof createSupabaseAdminClient>>,
  params: {
    subject_id: string;
    class_id?: string | null;
    chapter_start: number;
    chapter_end: number;
    question_type: string;
    question_category_id?: string | null;
    excludeId?: string;
  }
) {
  let query = supabase
    .from(TABLE)
    .select('id')
    .eq('subject_id', params.subject_id)
    .eq('question_type', params.question_type)
    .lte('chapter_start', params.chapter_end)
    .gte('chapter_end', params.chapter_start);

  const categoryId = normalizeCategoryId(params.question_category_id);
  if (categoryId) {
    query = query.eq('question_category_id', categoryId);
  } else {
    query = query.is('question_category_id', null);
  }

  if (params.class_id) {
    query = query.or(`class_id.eq.${params.class_id},class_id.is.null`);
  } else {
    query = query.is('class_id', null);
  }

  if (params.excludeId) {
    query = query.neq('id', params.excludeId);
  }

  return query;
}

export async function GET(request: NextRequest) {
  try {
    const userClient = await createSupabaseServerClient();
    const auth = await requireSession(userClient);
    if (auth.error) return auth.error;

    const adminClient = await createSupabaseAdminClient();

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const classId   = searchParams.get('classId');

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
    }

    let query = adminClient
      .from(TABLE)
      .select(`
        *,
        question_category:question_categories (
          id,
          label_en,
          label_ur,
          category_value,
          default_marks
        )
      `)
      .eq('subject_id', subjectId);

    if (classId) {
      query = query.or(`class_id.is.null,class_id.eq.${classId}`);
    }

    const { data: rules, error } = await query
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(rules || []);
  } catch (error: any) {
    console.error('Error in GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userClient = await createSupabaseServerClient();
    const auth = await requireSession(userClient);
    if (auth.error) return auth.error;

    const adminClient = await createSupabaseAdminClient();
    const body = await request.json();
    const {
      subject_id,
      class_id,
      chapter_start,
      chapter_end,
      question_type,
      question_category_id,
      rule_mode,
      min_questions,
      max_questions,
      sort_order,
      q_label,
      q_label_ur,
      attempt_count,
      group_key,
      is_paired,
      is_alternative,
    } = body;

    if (
      !subject_id ||
      chapter_start == null ||
      chapter_end == null ||
      !question_type ||
      !rule_mode ||
      min_questions == null
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (Number(chapter_start) > Number(chapter_end)) {
      return NextResponse.json(
        { error: 'chapter_start must be less than or equal to chapter_end' },
        { status: 400 }
      );
    }

    if (max_questions != null && Number(max_questions) < Number(min_questions)) {
      return NextResponse.json(
        { error: 'max_questions must be >= min_questions' },
        { status: 400 }
      );
    }

    const attemptCountNormalized = normalizeNullableInt(attempt_count);
    if (attemptCountNormalized != null && attemptCountNormalized > Number(min_questions)) {
      return NextResponse.json(
        { error: 'attempt_count must be <= min_questions' },
        { status: 400 }
      );
    }

    const { data: existingRules, error: checkError } = await findOverlappingRules(adminClient, {
      subject_id,
      class_id: class_id || null,
      chapter_start: Number(chapter_start),
      chapter_end: Number(chapter_end),
      question_type,
      question_category_id,
    });

    if (checkError) {
      return NextResponse.json(
        { error: 'Failed to check existing rules', details: checkError.message },
        { status: 500 }
      );
    }

    if (existingRules && existingRules.length > 0) {
      return NextResponse.json(
        { error: 'Overlapping rule already exists for this type, category, and chapter range' },
        { status: 409 }
      );
    }

    const { data, error } = await adminClient
      .from(TABLE)
      .insert([{
        subject_id,
        class_id: class_id || null,
        chapter_start: Number(chapter_start),
        chapter_end: Number(chapter_end),
        question_type,
        question_category_id: normalizeCategoryId(question_category_id),
        rule_mode,
        min_questions: Number(min_questions),
        max_questions: max_questions == null || max_questions === ''
          ? null
          : Number(max_questions),
        sort_order: sort_order == null || sort_order === '' ? 0 : Number(sort_order),
        q_label: normalizeNullableText(q_label),
        q_label_ur: normalizeNullableText(q_label_ur),
        attempt_count: attemptCountNormalized,
        group_key: normalizeNullableText(group_key),
        is_paired: Boolean(is_paired),
        is_alternative: Boolean(is_alternative),
        created_by: auth.session!.user.id,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating rule:', error);
      return NextResponse.json(
        { error: 'Failed to create rule', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userClient = await createSupabaseServerClient();
    const auth = await requireSession(userClient);
    if (auth.error) return auth.error;

    const adminClient = await createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');
    const body = await request.json();

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const {
      subject_id,
      class_id,
      chapter_start,
      chapter_end,
      question_type,
      question_category_id,
      rule_mode,
      min_questions,
      max_questions,
      sort_order,
      q_label,
      q_label_ur,             // ✅ FIX: Added missing destructuring
      attempt_count,
      group_key,
      is_paired,
      is_alternative,
    } = body;

    if (Number(chapter_start) > Number(chapter_end)) {
      return NextResponse.json(
        { error: 'chapter_start must be less than or equal to chapter_end' },
        { status: 400 }
      );
    }

    const attemptCountNormalized = normalizeNullableInt(attempt_count);
    if (attemptCountNormalized != null && attemptCountNormalized > Number(min_questions)) {
      return NextResponse.json(
        { error: 'attempt_count must be <= min_questions' },
        { status: 400 }
      );
    }

    const { data: existingRules, error: checkError } = await findOverlappingRules(adminClient, {
      subject_id,
      class_id: class_id || null,
      chapter_start: Number(chapter_start),
      chapter_end: Number(chapter_end),
      question_type,
      question_category_id,
      excludeId: ruleId,
    });

    if (checkError) {
      return NextResponse.json(
        { error: 'Failed to check existing rules', details: checkError.message },
        { status: 500 }
      );
    }

    if (existingRules && existingRules.length > 0) {
      return NextResponse.json(
        { error: 'Overlapping rule already exists for this type, category, and chapter range' },
        { status: 409 }
      );
    }

    const { data, error } = await adminClient
      .from(TABLE)
      .update({
        chapter_start: Number(chapter_start),
        chapter_end: Number(chapter_end),
        question_type,
        question_category_id: normalizeCategoryId(question_category_id),
        rule_mode,
        min_questions: Number(min_questions),
        max_questions: max_questions == null || max_questions === ''
          ? null
          : Number(max_questions),
        class_id: class_id || null,
        sort_order: sort_order == null || sort_order === '' ? 0 : Number(sort_order),
        q_label: normalizeNullableText(q_label),
        q_label_ur: normalizeNullableText(q_label_ur),    // ✅ Now works
        attempt_count: attemptCountNormalized,
        group_key: normalizeNullableText(group_key),
        is_paired: Boolean(is_paired),
        is_alternative: Boolean(is_alternative),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating rule:', error);
      return NextResponse.json(
        { error: 'Failed to update rule', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userClient = await createSupabaseServerClient();
    const auth = await requireSession(userClient);
    if (auth.error) return auth.error;

    const adminClient = await createSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const { error } = await adminClient
      .from(TABLE)
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error deleting rule:', error);
      return NextResponse.json(
        { error: 'Failed to delete rule', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
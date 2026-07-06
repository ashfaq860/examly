import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// class_id/subject_id are interpolated directly into a raw PostgREST `.or()`
// filter string below — must be validated as a UUID first so they can't be
// used to inject extra filter clauses.
function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const questionType = searchParams.get('question_type');
  const classId      = searchParams.get('class_id');
  const subjectId    = searchParams.get('subject_id');

  if (classId && !isValidUuid(classId)) {
    return NextResponse.json({ error: 'Invalid class_id' }, { status: 400 });
  }
  if (subjectId && !isValidUuid(subjectId)) {
    return NextResponse.json({ error: 'Invalid subject_id' }, { status: 400 });
  }

  let query = supabase
    .from('question_categories')
    .select('*')
    .order('question_type')
    .order('sort_order')
    .order('label_en');

  if (questionType) query = query.eq('question_type', questionType);
  if (classId)      query = query.or(`class_hint.is.null,class_hint.eq.${classId}`);
  if (subjectId)    query = query.or(`subject_hint.is.null,subject_hint.eq.${subjectId}`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const body = await req.json();
  const {
    question_type, category_value, label_en, label_ur,
    subject_hint, class_hint, default_marks, sort_order, is_active,
  } = body;

  if (!question_type || !category_value || !label_en) {
    return NextResponse.json(
      { error: 'question_type, category_value and label_en are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('question_categories')
    .insert({
      question_type:  question_type.trim(),
      category_value: category_value.trim(),
      label_en:       label_en.trim(),
      label_ur:       label_ur?.trim()     || null,
      subject_hint:   subject_hint?.trim() || null,
      class_hint:     class_hint?.trim()   || null,
      default_marks:  default_marks ?? null,
      sort_order:     sort_order ?? 0,
      is_active:      is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A category with type "${question_type}" and value "${category_value}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = await req.json();
  const {
    question_type, category_value, label_en, label_ur,
    subject_hint, class_hint, default_marks, sort_order, is_active,
  } = body;

  if (!question_type || !category_value || !label_en) {
    return NextResponse.json(
      { error: 'question_type, category_value and label_en are required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('question_categories')
    .update({
      question_type:  question_type.trim(),
      category_value: category_value.trim(),
      label_en:       label_en.trim(),
      label_ur:       label_ur?.trim()     || null,
      subject_hint:   subject_hint?.trim() || null,
      class_hint:     class_hint?.trim()   || null,
      default_marks:  default_marks ?? null,
      sort_order:     sort_order ?? 0,
      is_active:      is_active ?? true,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A category with type "${question_type}" and value "${category_value}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const [{ count: qCount }, { count: rCount }] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('question_category_id', id),
    supabase.from('chapter_question_rules').select('id', { count: 'exact', head: true }).eq('question_category_id', id),
  ]);

  if ((qCount ?? 0) > 0 || (rCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot delete — used by ${qCount} question(s) and ${rCount} rule(s). Deactivate instead.` },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('question_categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
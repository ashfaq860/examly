// app/api/admin/questions/[id]/route.ts
//
// FIX: Next.js 15 made dynamic route `params` a Promise — you must
// `await` it before reading `.id`. The build error
//   "Route ... used `params.id`. `params` should be awaited..."
// happens because the old signature destructured params synchronously:
//   { params }: { params: { id: string } }
// The fix changes the type to Promise<{ id: string }> and awaits it
// inside each handler before use.
//
// This is the SAME fix needed in BOTH possible files — whichever one
// is actually at src/app/api/admin/questions/[id]/route.ts (confirmed
// by the build error's exact path) is the one that needs this applied.
// If you also have a parallel non-admin route at
// app/api/questions/[id]/route.ts serving a different feature, apply
// the identical params-await pattern there too if it shows the same
// warning/error.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { sanitizeRichTextFields } from '@/lib/sanitizeHtml';
import { invalidateQuestionPoolCache } from '@/lib/questionPoolCache';

const RICH_TEXT_FIELDS = [
  'question_text', 'question_text_ur',
  'option_a', 'option_b', 'option_c', 'option_d',
  'option_a_ur', 'option_b_ur', 'option_c_ur', 'option_d_ur',
  'answer_text', 'answer_text_ur',
] as const;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** GET /api/admin/questions/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        question_category_rel:question_categories(
          id, question_type, category_value, label_en, label_ur
        ),
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
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[GET /api/admin/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/questions/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
    invalidateQuestionPoolCache();
    return NextResponse.json({ deleted: id });
  } catch (err: any) {
    console.error('[DELETE /api/admin/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** PUT /api/admin/questions/:id */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = sanitizeRichTextFields(await req.json(), RICH_TEXT_FIELDS);
    const { error, data } = await supabase
      .from('questions')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    invalidateQuestionPoolCache();
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[PUT /api/admin/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
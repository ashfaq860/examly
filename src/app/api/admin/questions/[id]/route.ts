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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** GET /api/admin/questions/:id */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
  try {
    const { id } = await params;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
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
  try {
    const { id } = await params;
    const body = await req.json();
    const { error, data } = await supabase
      .from('questions')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[PUT /api/admin/questions/:id]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
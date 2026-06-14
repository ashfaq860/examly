// app/api/admin/questions/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    let body = await req.json();

    // Allow wrapped format { questions: [...] } or direct array
    if (!Array.isArray(body)) {
      if (body.questions && Array.isArray(body.questions)) {
        body = body.questions;
      } else {
        return NextResponse.json(
          { error: 'Request body must be an array or { questions: [...] }' },
          { status: 400 },
        );
      }
    }

    // Basic validation
    const required = ['question_text', 'difficulty', 'question_type', 'source_type'];
    for (const [i, q] of body.entries()) {
      for (const field of required) {
        if (!q[field]) {
          return NextResponse.json(
            { error: `Row ${i + 1}: missing "${field}"` },
            { status: 400 },
          );
        }
      }
    }

    const { data, error } = await supabase
      .from('questions')
      .insert(body)
      .select();

    if (error) {
      console.error('Import error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      inserted: data?.length ?? 0,
      message: `Successfully imported ${data?.length} questions`,
    });
  } catch (err: any) {
    console.error('Import route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
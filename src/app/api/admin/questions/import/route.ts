// app/api/admin/questions/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import { sanitizeRichText } from '@/lib/sanitizeHtml';
import { invalidateQuestionPoolCache } from '@/lib/questionPoolCache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin', 'super_admin']);
  if (auth.error) return auth.error;

  try {
    let body = await req.json();

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

    // Only require the fields the DB actually enforces as NOT NULL / no default
    const required = ['question_text', 'difficulty', 'question_type', 'source_type'];

    const validationErrors: string[] = [];
    for (const [i, q] of body.entries()) {
      for (const field of required) {
        if (!q[field]) {
          validationErrors.push(`Row ${i + 1}: missing required field "${field}"`);
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.slice(0, 5).join('; ') + (validationErrors.length > 5 ? ` … and ${validationErrors.length - 5} more` : '') },
        { status: 400 },
      );
    }

    // Sanitise rows: strip unknown keys, keep topic_id only when it resolved
    const rows = body.map((q: any) => ({
      question_text:    sanitizeRichText(q.question_text),
      question_text_ur: q.question_text_ur   ? sanitizeRichText(q.question_text_ur) : null,
      option_a:         q.option_a           ? sanitizeRichText(q.option_a) : null,
      option_b:         q.option_b           ? sanitizeRichText(q.option_b) : null,
      option_c:         q.option_c           ? sanitizeRichText(q.option_c) : null,
      option_d:         q.option_d           ? sanitizeRichText(q.option_d) : null,
      option_a_ur:      q.option_a_ur        ? sanitizeRichText(q.option_a_ur) : null,
      option_b_ur:      q.option_b_ur        ? sanitizeRichText(q.option_b_ur) : null,
      option_c_ur:      q.option_c_ur        ? sanitizeRichText(q.option_c_ur) : null,
      option_d_ur:      q.option_d_ur        ? sanitizeRichText(q.option_d_ur) : null,
      correct_option:   q.correct_option     || null,
      topic_id:         q.topic_id           || null,   // null is fine — the DB allows it
      difficulty:       q.difficulty,
      question_type:    q.question_type,
      source_type:      q.source_type,
      source_year:      q.source_year        || null,
      answer_text:      q.answer_text        ? sanitizeRichText(q.answer_text) : null,
      answer_text_ur:   q.answer_text_ur     ? sanitizeRichText(q.answer_text_ur) : null,
    }));

    const { data, error } = await supabase
      .from('questions')
      .insert(rows)
      .select('id');

    if (error) {
      console.error('Import DB insertion error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateQuestionPoolCache();
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
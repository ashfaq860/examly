// Generates and caches a grading rubric for one subjective (short/long)
// question. Generated once per question (via Claude), persisted to
// questions.rubric, and reused by every future submission that includes
// this question — never regenerated unless the question itself changes.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { callClaudeJson } from '@/lib/checker/claude';

// Rubric generation stays on Sonnet by default (callClaudeJson's own
// default) deliberately — it's a one-time, text-only, per-question,
// class-amortized cost that sets the grading standard every future
// submission is measured against, not where the Haiku-first cost savings
// should come from (see claude.ts's model-constants doc comment).

export interface RubricCriterion {
  point: string;
  marks: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
  total_marks: number;
}

export interface RubricQuestion {
  id: string;
  question_text: string | null;
  question_text_ur: string | null;
  answer_text: string | null;
  answer_text_ur: string | null;
  question_type: string | null;
  default_marks: number | null;
  rubric: Rubric | null;
}

function fallbackRubric(totalMarks: number): Rubric {
  return { criteria: [{ point: 'Overall correctness and completeness of the answer', marks: totalMarks }], total_marks: totalMarks };
}

/** Returns the question's cached rubric, generating (and persisting) one if
 *  it doesn't have one yet. Never throws — a generation failure returns an
 *  uncached fallback rubric instead, so a single question's rubric outage
 *  never blocks grading; the next attempt will simply try to generate a
 *  real one again since nothing was written to the DB. `paperId`, when
 *  given, tags this call's cost telemetry (see gradingTelemetry.ts) —
 *  optional since not every caller of this function has one handy, and a
 *  missing tag just means one fewer row, not a broken call. */
export async function ensureRubric(question: RubricQuestion, paperId?: string): Promise<Rubric> {
  if (question.rubric && Array.isArray(question.rubric.criteria) && question.rubric.criteria.length > 0) {
    return question.rubric;
  }

  const totalMarks = question.default_marks ?? 1;

  try {
    const prompt = [
      'You are building a grading rubric for one exam question, to be used later to grade a student\'s handwritten answer against.',
      `Question type: ${question.question_type || 'short/long answer'}`,
      `Total marks available: ${totalMarks}`,
      `Question (English): ${question.question_text || '(none)'}`,
      question.question_text_ur ? `Question (Urdu): ${question.question_text_ur}` : null,
      `Model answer (English): ${question.answer_text || '(none)'}`,
      question.answer_text_ur ? `Model answer (Urdu): ${question.answer_text_ur}` : null,
      '',
      `Break the total marks down into 2-5 concrete grading criteria that sum to exactly ${totalMarks}.`,
      'Respond with ONLY a JSON object of this exact shape, no markdown fences, no commentary:',
      '{"criteria": [{"point": "<short description of what earns these marks>", "marks": <number>}], "total_marks": ' + totalMarks + '}',
    ].filter(Boolean).join('\n');

    const rubric = await callClaudeJson<Rubric>({
      prompt, maxTokens: 1024, callLabel: `rubric:${question.id}`,
      ...(paperId ? { telemetry: { submissionId: null, paperId, callKind: 'rubric' } } : {}),
    });
    if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
      throw new Error('Malformed rubric response');
    }

    await supabaseAdmin.from('questions').update({ rubric }).eq('id', question.id);
    return rubric;
  } catch (e: any) {
    console.error(`Rubric generation failed for question ${question.id}:`, e.message || e);
    return fallbackRubric(totalMarks);
  }
}

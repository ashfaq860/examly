// app/api/checker/answers/[id]/route.ts
// Teacher override for a single submission_answer row — the contract
// branches on answer_kind since MCQ and subjective overrides are
// fundamentally different actions:
//   - mcq: teacher picks the correct option (override_option), final_marks
//     is derived from whether that matches correct_option.
//   - subjective: there's no "correct option" concept for free-form marks —
//     the teacher sets final_marks directly (clamped to [0, max_marks]),
//     overriding whatever the AI grader (or a previous override) had set.
//   - promote_excess: turns an EXCESS_ATTEMPT row (attempt-count
//     enforcement — see gradeSubjective.ts) into a real graded answer. This
//     doesn't just flip a flag: the paper's "attempt any N of M" limit is
//     still in force, so grading one more answer means the group would now
//     have N+1 counted — the LAST-counted unit in that same choice group
//     (by printed order) is demoted back to EXCESS_ATTEMPT to keep the
//     count at N. The client confirms this swap with the teacher before
//     calling in; this route doesn't re-confirm.
// The mcq/subjective paths clear needs_review, stamp reviewed_by/
// reviewed_at, and recompute the parent submission's totals via the shared
// helper so MCQ and subjective scores can never drift apart. That same
// helper (finalizeSubmissionTotals, given the submission's current status/
// error columns) also recomputes mcq_status/subjective_status from the
// CURRENT rows — those two columns used to only ever be written once, at
// grade time, so a section flagged needs_review there stayed that way
// forever even after every row was resolved, permanently blocking the
// review page's Finalize button. Passing the fresh values back into this
// route's own submissions.update() (instead of echoing the stale ones this
// route read before the edit) is the fix.
// Requires the 'paper_checker' feature (admin/super_admin bypass).
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { isAnswerCorrect, computeOverallStatus } from '@/lib/checker/answers';
import { downloadScan } from '@/lib/checker/scanStorage';
import { ClaudeImageInput } from '@/lib/checker/claude';
import { ensureRubric, RubricQuestion } from '@/lib/checker/rubric';
import { resolveChoiceGroups, gradeSubjectiveQuestion, SubjectiveQuestion, finalizeSubmissionTotals, identityPageResolver } from '@/lib/checker/gradeSubjective';

const VALID_OPTIONS = ['A', 'B', 'C', 'D', 'BLANK'];

/** Re-derives which choice group `questionId` belongs to (same logic
 *  grading time uses), grades every currently-excess member of that unit,
 *  and demotes the group's last-counted unit (excluding the one just
 *  promoted) to keep the count at N. Returns the ids of every
 *  submission_answers row that changed, so the caller can recompute totals
 *  from a fresh fetch afterward. */
async function promoteExcessAnswer(submissionId: string, paperId: string, questionId: string): Promise<{ error?: string; status?: number; paperContent?: any }> {
  const [{ data: paper }, { data: siblingRows }] = await Promise.all([
    supabaseAdmin.from('papers').select('content').eq('id', paperId).maybeSingle(),
    supabaseAdmin.from('submission_answers').select('*').eq('submission_id', submissionId).eq('answer_kind', 'subjective'),
  ]);
  if (!paper) return { error: 'Paper not found', status: 404 };

  const groups = resolveChoiceGroups(paper.content);
  const group = groups.find(g => g.units.some(unit => unit.includes(questionId)));
  if (!group) return { error: 'This answer is not part of a limited choice group', status: 400 };

  const rowsByQid = new Map((siblingRows || []).map((r: any) => [r.question_id, r]));
  const promotedUnit = group.units.find(unit => unit.includes(questionId))!;

  // The last COUNTED unit (every member not EXCESS_ATTEMPT), by printed
  // order (q_number), excluding the unit being promoted itself.
  const countedUnits = group.units.filter(unit =>
    unit !== promotedUnit &&
    unit.every(id => rowsByQid.has(id) && rowsByQid.get(id)!.teacher_note !== 'EXCESS_ATTEMPT'),
  );
  if (countedUnits.length === 0) {
    return { error: 'No other counted answer to demote — nothing to swap', status: 400 };
  }
  const unitQNumber = (unit: string[]) => Math.max(...unit.map(id => Number(rowsByQid.get(id)?.q_number) || 0));
  const demotedUnit = countedUnits.reduce((a, b) => (unitQNumber(a) > unitQNumber(b) ? a : b));

  // Grade every currently-excess member of the promoted unit.
  const questionIds = promotedUnit.filter(id => rowsByQid.get(id)?.teacher_note === 'EXCESS_ATTEMPT');
  if (questionIds.length > 0) {
    const { data: questionRows } = await supabaseAdmin
      .from('questions')
      .select('id, question_text, question_text_ur, answer_text, answer_text_ur, question_type, default_marks, rubric')
      .in('id', questionIds);
    const questionRowById = new Map((questionRows || []).map((q: any) => [q.id, q]));

    const { data: submission } = await supabaseAdmin.from('submissions').select('scan_urls').eq('id', submissionId).maybeSingle();
    const scanUrls: string[] = Array.isArray(submission?.scan_urls) ? submission!.scan_urls : [];
    if (scanUrls.length === 0) return { error: 'Submission has no scan images', status: 400 };

    let images: ClaudeImageInput[];
    try {
      const buffers = await Promise.all(scanUrls.map(url => downloadScan(url)));
      images = buffers.map(buf => ({ mediaType: 'image/jpeg', base64: buf.toString('base64') }));
    } catch (e: any) {
      return { error: `Failed to download scan pages: ${e.message || e}`, status: 500 };
    }
    const pages = identityPageResolver(scanUrls);

    for (const qid of questionIds) {
      const row = rowsByQid.get(qid)!;
      const qRow = questionRowById.get(qid);
      const rubricQuestion: RubricQuestion = qRow
        ? { id: qRow.id, question_text: qRow.question_text, question_text_ur: qRow.question_text_ur, answer_text: qRow.answer_text, answer_text_ur: qRow.answer_text_ur, question_type: qRow.question_type, default_marks: qRow.default_marks, rubric: qRow.rubric }
        : { id: qid, question_text: null, question_text_ur: null, answer_text: null, answer_text_ur: null, question_type: null, default_marks: row.max_marks, rubric: null };
      const rubric = await ensureRubric(rubricQuestion);

      const subjectiveQuestion: SubjectiveQuestion = {
        question_id: qid,
        q_number: row.q_number,
        question_text: rubricQuestion.question_text,
        question_text_ur: rubricQuestion.question_text_ur,
        answer_text: rubricQuestion.answer_text,
        answer_text_ur: rubricQuestion.answer_text_ur,
        question_type: rubricQuestion.question_type,
        max_marks: row.max_marks,
      };

      const graded = await gradeSubjectiveQuestion(subjectiveQuestion, rubric, images, submissionId, pages);
      await supabaseAdmin.from('submission_answers').update({
        detected_option: graded.detected_option,
        fill_confidence: graded.fill_confidence,
        transcription: graded.transcription,
        rubric_scores: graded.rubric_scores,
        ai_marks: graded.ai_marks,
        ai_confidence: graded.ai_confidence,
        ai_justification: graded.ai_justification,
        region_crop_url: graded.region_crop_url,
        needs_review: graded.needs_review,
        final_marks: graded.final_marks,
        teacher_note: graded.teacher_note,
        page_index: graded.page_index,
        answer_top_pct: graded.answer_top_pct,
        answer_bottom_pct: graded.answer_bottom_pct,
        answer_left_pct: graded.answer_left_pct,
        answer_right_pct: graded.answer_right_pct,
        answer_ink_top_pct: graded.answer_ink_top_pct,
        answer_ink_bottom_pct: graded.answer_ink_bottom_pct,
        answer_ink_left_pct: graded.answer_ink_left_pct,
        answer_ink_right_pct: graded.answer_ink_right_pct,
        transcription_lang: graded.transcription_lang,
        question_top_pct: graded.question_top_pct,
        deduction_reason: graded.deduction_reason,
        reason_codes: graded.reason_codes,
      }).eq('id', row.id);
    }
  }

  // Demote the previously-counted unit — reviewed_by/at cleared since its
  // status fundamentally changed, it's no longer a teacher-confirmed grade.
  for (const qid of demotedUnit) {
    const row = rowsByQid.get(qid);
    if (!row) continue;
    await supabaseAdmin.from('submission_answers').update({
      final_marks: 0,
      needs_review: false,
      teacher_note: 'EXCESS_ATTEMPT',
      reviewed_by: null,
      reviewed_at: null,
    }).eq('id', row.id);
  }

  return { paperContent: paper.content };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: answerId } = await params;
    const body = await req.json();

    const { data: answer, error: answerErr } = await supabaseAdmin
      .from('submission_answers')
      .select('*')
      .eq('id', answerId)
      .maybeSingle();
    if (answerErr || !answer) {
      return NextResponse.json({ error: answerErr?.message || 'Answer not found' }, { status: 404 });
    }

    const ownership = await verifySubmissionOwnership(answer.submission_id, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });

    if (ownership.submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized — cannot edit answers' }, { status: 409 });
    }

    if (body?.promote_excess === true) {
      if (answer.teacher_note !== 'EXCESS_ATTEMPT') {
        return NextResponse.json({ error: 'This answer is not marked as an excess attempt' }, { status: 400 });
      }
      const result = await promoteExcessAnswer(answer.submission_id, ownership.submission.paper_id, answer.question_id);
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });

      const { data: promotedAnswer, error: refetchErr } = await supabaseAdmin.from('submission_answers').select('*').eq('id', answerId).maybeSingle();
      if (refetchErr || !promotedAnswer) return NextResponse.json({ error: refetchErr?.message || 'Answer not found after promotion' }, { status: 500 });

      const totals = await finalizeSubmissionTotals(answer.submission_id, result.paperContent, {
        mcqStatus: ownership.submission.mcq_status,
        subjectiveStatus: ownership.submission.subjective_status,
        mcqError: ownership.submission.mcq_error,
        subjectiveError: ownership.submission.subjective_error,
      });
      const { data: updatedSubmission, error: submissionUpdateErr } = await supabaseAdmin
        .from('submissions')
        .update({
          mcq_score: totals.mcqScore,
          subjective_score: totals.subjectiveScore,
          total_score: totals.totalScore,
          max_score: totals.maxScore,
          mcq_status: totals.mcqStatus,
          subjective_status: totals.subjectiveStatus,
          subjective_marks_side: totals.subjectiveMarksSide,
          status: computeOverallStatus(totals.mcqStatus, totals.subjectiveStatus, totals.anyNeedsReview),
        })
        .eq('id', answer.submission_id)
        .select()
        .single();
      if (submissionUpdateErr) return NextResponse.json({ error: submissionUpdateErr.message }, { status: 500 });

      return NextResponse.json({ answer: promotedAnswer, submission: updatedSubmission });
    }

    let updatePatch: Record<string, any>;

    if (answer.answer_kind === 'subjective') {
      const finalMarks = Number(body?.final_marks);
      if (!Number.isFinite(finalMarks) || finalMarks < 0 || finalMarks > answer.max_marks) {
        return NextResponse.json({ error: `final_marks must be a number between 0 and ${answer.max_marks}` }, { status: 400 });
      }
      updatePatch = { final_marks: finalMarks };
    } else {
      const overrideOption = body?.override_option;
      if (!VALID_OPTIONS.includes(overrideOption)) {
        return NextResponse.json({ error: `override_option must be one of ${VALID_OPTIONS.join(', ')}` }, { status: 400 });
      }
      const isCorrect = isAnswerCorrect({ override_option: overrideOption, detected_option: answer.detected_option, correct_option: answer.correct_option });
      updatePatch = { override_option: overrideOption, final_marks: isCorrect ? answer.max_marks : 0 };
    }

    const { data: updatedAnswer, error: updateErr } = await supabaseAdmin
      .from('submission_answers')
      .update({
        ...updatePatch,
        needs_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', answerId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { data: paperRow, error: paperErr } = await supabaseAdmin
      .from('papers')
      .select('content')
      .eq('id', ownership.submission.paper_id)
      .maybeSingle();
    if (paperErr || !paperRow) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }

    const totals = await finalizeSubmissionTotals(answer.submission_id, paperRow.content, {
      mcqStatus: ownership.submission.mcq_status,
      subjectiveStatus: ownership.submission.subjective_status,
      mcqError: ownership.submission.mcq_error,
      subjectiveError: ownership.submission.subjective_error,
    });

    const { data: updatedSubmission, error: submissionUpdateErr } = await supabaseAdmin
      .from('submissions')
      .update({
        mcq_score: totals.mcqScore,
        subjective_score: totals.subjectiveScore,
        total_score: totals.totalScore,
        max_score: totals.maxScore,
        mcq_status: totals.mcqStatus,
        subjective_status: totals.subjectiveStatus,
        subjective_marks_side: totals.subjectiveMarksSide,
        status: computeOverallStatus(totals.mcqStatus, totals.subjectiveStatus, totals.anyNeedsReview),
      })
      .eq('id', answer.submission_id)
      .select()
      .single();

    if (submissionUpdateErr) {
      return NextResponse.json({ error: submissionUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({ answer: updatedAnswer, submission: updatedSubmission });
  } catch (error: any) {
    console.error('Error overriding answer:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

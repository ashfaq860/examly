// app/api/checker/answers/[id]/recapture/route.ts
// "Retake this answer" — the per-question escape hatch for a subjective
// row the AI graded from a blurry/unreadable photo: the teacher takes one
// new close-up photo of just that answer (reusing the same CameraCapture
// component as submission upload), it becomes this answer's
// region_crop_url, and just this one question is regraded against it —
// there is no per-question submission mode, this only ever updates the
// single existing submission_answers row in place.
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionFromRequest } from '@/lib/api-auth';
import { requireFeatureOrAdmin } from '@/lib/entitlements';
import { verifySubmissionOwnership } from '@/lib/checker/ownership';
import { DEFAULT_SCAN_BUCKET } from '@/lib/checker/scanStorage';
import { ensureRubric, RubricQuestion } from '@/lib/checker/rubric';
import { gradeSubjectiveQuestion, SubjectiveQuestion, finalizeSubmissionTotals, identityPageResolver } from '@/lib/checker/gradeSubjective';
import { computeOverallStatus } from '@/lib/checker/answers';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getSessionFromRequest();
    if (auth.error) return auth.error;
    const { user } = auth;

    const gate = await requireFeatureOrAdmin(auth.supabase, user.id, 'paper_checker');
    if (gate) return gate;

    const { id: answerId } = await params;

    const { data: answer, error: answerErr } = await supabaseAdmin
      .from('submission_answers')
      .select('*')
      .eq('id', answerId)
      .maybeSingle();
    if (answerErr || !answer) {
      return NextResponse.json({ error: answerErr?.message || 'Answer not found' }, { status: 404 });
    }
    if (answer.answer_kind !== 'subjective') {
      return NextResponse.json({ error: 'Retake only applies to subjective answers' }, { status: 400 });
    }

    const ownership = await verifySubmissionOwnership(answer.submission_id, user.id);
    if (!ownership.authorized) return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    const submission = ownership.submission;

    if (submission.status === 'finalized') {
      return NextResponse.json({ error: 'Submission is already finalized — cannot edit answers' }, { status: 409 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'An image file is required' }, { status: 400 });
    }

    const { data: questionRow, error: questionErr } = await supabaseAdmin
      .from('questions')
      .select('id, question_text, question_text_ur, answer_text, answer_text_ur, question_type, default_marks, rubric')
      .eq('id', answer.question_id)
      .maybeSingle();
    if (questionErr || !questionRow) {
      return NextResponse.json({ error: questionErr?.message || 'Question not found' }, { status: 404 });
    }

    const path = `${submission.paper_id}/${submission.id}/recapture-${answerId}-${Date.now()}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(DEFAULT_SCAN_BUCKET)
      .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: true });
    if (uploadErr) {
      return NextResponse.json({ error: `Failed to upload photo: ${uploadErr.message}` }, { status: 500 });
    }

    const rubricQuestion: RubricQuestion = questionRow as RubricQuestion;
    const rubric = await ensureRubric(rubricQuestion);

    const question: SubjectiveQuestion = {
      question_id: answer.question_id,
      q_number: answer.q_number,
      question_text: questionRow.question_text,
      question_text_ur: questionRow.question_text_ur,
      answer_text: questionRow.answer_text,
      answer_text_ur: questionRow.answer_text_ur,
      question_type: questionRow.question_type,
      max_marks: answer.max_marks,
    };

    const image = { mediaType: (file.type === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/jpeg' | 'image/png', base64: buffer.toString('base64') };
    // Only one image is provided — always this recapture, regardless of
    // whatever page_index the model reports.
    const graded = await gradeSubjectiveQuestion(question, rubric, [image], submission.id, identityPageResolver([path]));

    const { data: updatedAnswer, error: updateErr } = await supabaseAdmin
      .from('submission_answers')
      .update({
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
        override_option: null,
        reviewed_by: null,
        reviewed_at: null,
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
      .eq('id', submission.paper_id)
      .maybeSingle();
    if (paperErr || !paperRow) {
      return NextResponse.json({ error: paperErr?.message || 'Paper not found' }, { status: 404 });
    }

    const totals = await finalizeSubmissionTotals(submission.id, paperRow.content, {
      mcqStatus: submission.mcq_status,
      subjectiveStatus: submission.subjective_status,
      mcqError: submission.mcq_error,
      subjectiveError: submission.subjective_error,
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
      .eq('id', submission.id)
      .select()
      .single();
    if (submissionUpdateErr) {
      return NextResponse.json({ error: submissionUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({ answer: updatedAnswer, submission: updatedSubmission });
  } catch (error: any) {
    console.error('Error recapturing answer:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

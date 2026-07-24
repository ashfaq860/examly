import { describe, it, expect } from 'vitest';
import { resolveChoiceGroups, applyChoiceGroupSelection, ChoiceGroup, SubjectiveQuestion, SubjectiveAnswerRow } from './gradeSubjective';

function question(id: string, max_marks = 2): SubjectiveQuestion {
  return {
    question_id: id,
    q_number: id,
    question_text: null,
    question_text_ur: null,
    answer_text: null,
    answer_text_ur: null,
    question_type: null,
    max_marks,
  };
}

function gradedRow(id: string, opts: { blank?: boolean; final_marks?: number; max_marks?: number } = {}): SubjectiveAnswerRow {
  const max_marks = opts.max_marks ?? 2;
  const blank = opts.blank ?? false;
  const final_marks = blank ? 0 : opts.final_marks ?? max_marks;
  return {
    submission_id: 'sub-1',
    question_id: id,
    q_number: id,
    answer_kind: 'subjective',
    detected_option: blank ? 'BLANK' : null,
    correct_option: null,
    override_option: null,
    fill_confidence: blank ? 0 : 0.9,
    bubble_overlay: null,
    transcription: blank ? null : `answer for ${id}`,
    transcription_lang: blank ? null : 'en',
    rubric_scores: { criteria: [], mistakes: [] },
    ai_marks: final_marks,
    ai_confidence: blank ? 0 : 0.9,
    ai_justification: null,
    region_crop_url: null,
    max_marks,
    needs_review: false,
    final_marks,
    teacher_note: null,
    page_index: 0,
    answer_top_pct: null,
    answer_bottom_pct: null,
    answer_left_pct: null,
    answer_right_pct: null,
    answer_ink_top_pct: null,
    answer_ink_bottom_pct: null,
    answer_ink_left_pct: null,
    answer_ink_right_pct: null,
    question_top_pct: null,
    deduction_reason: null,
    reason_codes: null,
  };
}

describe('resolveChoiceGroups', () => {
  it('resolves a simple "attempt N of M" section into one group of single-question units', () => {
    const content = [
      { type: 'subjective', attemptCount: 2, questions: [{ id: 'q2i' }, { id: 'q2ii' }, { id: 'q2iii' }] },
    ];
    const groups = resolveChoiceGroups(content);
    expect(groups).toHaveLength(1);
    expect(groups[0].attemptLimit).toBe(2);
    expect(groups[0].units).toEqual([['q2i'], ['q2ii'], ['q2iii']]);
  });

  it('does not form a group when attemptCount covers every question (nothing optional)', () => {
    const content = [{ type: 'subjective', attemptCount: 3, questions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }];
    expect(resolveChoiceGroups(content)).toHaveLength(0);
  });

  it('ignores mcq sections entirely', () => {
    const content = [{ type: 'mcq', attemptCount: 1, questions: [{ id: 'm1' }, { id: 'm2' }] }];
    expect(resolveChoiceGroups(content)).toHaveLength(0);
  });
});

// Reproduces the sample paper's Q.2 scenario used to diagnose the cost pass:
// "attempt any 2 of 3" with Q.2(i)/(ii) attempted and Q.2(iii) genuinely
// blank. Before this round, an `is_blank` read this cheap came from a
// separate detectAttempted probe call; now it's read straight off the one
// real batch/escalation grading result — this proves the SELECTION logic
// (not the call graph) is unchanged: the blank unit is still an ordinary
// row (not EXCESS_ATTEMPT), and the denominator-relevant count of "counted"
// units is still exactly attemptLimit.
describe('applyChoiceGroupSelection', () => {
  const group: ChoiceGroup = { attemptLimit: 2, units: [['q2i'], ['q2ii'], ['q2iii']] };
  const unitQuestionLists = [[question('q2i')], [question('q2ii')], [question('q2iii')]];

  it('first_n: 2 attempted + 1 genuinely blank in a "2 of 3" group — blank stays a normal row, nothing marked excess', () => {
    const gradedByQid = new Map([
      ['q2i', gradedRow('q2i', { final_marks: 2 })],
      ['q2ii', gradedRow('q2ii', { final_marks: 1 })],
      ['q2iii', gradedRow('q2iii', { blank: true })],
    ]);

    const rows = applyChoiceGroupSelection(group, unitQuestionLists, gradedByQid, 'first_n');

    expect(rows).toHaveLength(3);
    const byId = new Map(rows.map(r => [r.question_id, r]));
    expect(byId.get('q2i')!.teacher_note).toBeNull();
    expect(byId.get('q2i')!.final_marks).toBe(2);
    expect(byId.get('q2ii')!.teacher_note).toBeNull();
    expect(byId.get('q2ii')!.final_marks).toBe(1);
    // Blank unit: still just a blank row, not excess — it never touches the
    // "counted" total, matching computePaperMaxScore's own paper.content-only denominator.
    expect(byId.get('q2iii')!.detected_option).toBe('BLANK');
    expect(byId.get('q2iii')!.teacher_note).toBeNull();
    expect(byId.get('q2iii')!.final_marks).toBe(0);

    const countedMarks = rows.filter(r => r.teacher_note !== 'EXCESS_ATTEMPT').reduce((s, r) => s + r.final_marks, 0);
    expect(countedMarks).toBe(3); // 2 + 1, exactly the two counted attempts
  });

  it('first_n: attempting all 3 beyond the limit forces the extra one to EXCESS_ATTEMPT (0 marks)', () => {
    const gradedByQid = new Map([
      ['q2i', gradedRow('q2i', { final_marks: 2 })],
      ['q2ii', gradedRow('q2ii', { final_marks: 1 })],
      ['q2iii', gradedRow('q2iii', { final_marks: 2 })],
    ]);

    const rows = applyChoiceGroupSelection(group, unitQuestionLists, gradedByQid, 'first_n');
    const byId = new Map(rows.map(r => [r.question_id, r]));

    expect(byId.get('q2i')!.teacher_note).toBeNull();
    expect(byId.get('q2ii')!.teacher_note).toBeNull();
    // Printed order determines which is "first N" — the third unit is the excess one.
    expect(byId.get('q2iii')!.teacher_note).toBe('EXCESS_ATTEMPT');
    expect(byId.get('q2iii')!.final_marks).toBe(0);
    expect(byId.get('q2iii')!.needs_review).toBe(false);
  });

  it('all 3 genuinely blank — no unit is ever marked excess', () => {
    const gradedByQid = new Map([
      ['q2i', gradedRow('q2i', { blank: true })],
      ['q2ii', gradedRow('q2ii', { blank: true })],
      ['q2iii', gradedRow('q2iii', { blank: true })],
    ]);

    const rows = applyChoiceGroupSelection(group, unitQuestionLists, gradedByQid, 'first_n');
    expect(rows.every(r => r.teacher_note !== 'EXCESS_ATTEMPT')).toBe(true);
    expect(rows.every(r => r.final_marks === 0)).toBe(true);
  });

  it('grade_all_best_n: keeps the top-scoring attemptLimit units, demotes the rest to EXCESS_ATTEMPT', () => {
    const gradedByQid = new Map([
      ['q2i', gradedRow('q2i', { final_marks: 1 })], // lowest of the 3 attempted
      ['q2ii', gradedRow('q2ii', { final_marks: 2 })],
      ['q2iii', gradedRow('q2iii', { final_marks: 2 })],
    ]);

    const rows = applyChoiceGroupSelection(group, unitQuestionLists, gradedByQid, 'grade_all_best_n');
    const byId = new Map(rows.map(r => [r.question_id, r]));

    // Best 2 of 3 by score are ii and iii; i (lowest) is demoted regardless of printed order.
    expect(byId.get('q2i')!.teacher_note).toBe('EXCESS_ATTEMPT');
    expect(byId.get('q2i')!.final_marks).toBe(0);
    expect(byId.get('q2ii')!.teacher_note).toBeNull();
    expect(byId.get('q2iii')!.teacher_note).toBeNull();
  });

  it('grade_all_best_n: a blank unit is never counted toward attemptLimit even if best_n picks around it', () => {
    const gradedByQid = new Map([
      ['q2i', gradedRow('q2i', { final_marks: 2 })],
      ['q2ii', gradedRow('q2ii', { final_marks: 1 })],
      ['q2iii', gradedRow('q2iii', { blank: true })],
    ]);

    const rows = applyChoiceGroupSelection(group, unitQuestionLists, gradedByQid, 'grade_all_best_n');
    const byId = new Map(rows.map(r => [r.question_id, r]));

    expect(byId.get('q2i')!.teacher_note).toBeNull();
    expect(byId.get('q2ii')!.teacher_note).toBeNull();
    expect(byId.get('q2iii')!.teacher_note).toBeNull(); // blank, not excess
    expect(byId.get('q2iii')!.detected_option).toBe('BLANK');
  });
});

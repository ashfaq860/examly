// Grades every subjective (short/long/essay — i.e. every non-MCQ section)
// question in a submission via Claude vision. Per the chosen design, the
// model is shown scanned page images (only the pages that can actually
// carry an answer — see the page-exclusion logic in
// gradeSubjectiveForSubmission) and locates the relevant answer itself
// using the question text, rather than a homography-cropped region — this
// avoids requiring every paper to carry registration squares on every
// page (per-question cropping was investigated and deferred; see the cost
// round's plan for why).
//
// Grading is BATCHED and HAIKU-FIRST: every question that needs a real
// grade is sent in ONE Claude call on claude-haiku-4-5 (system prompt =
// every question's text+rubric, marked cache_control:ephemeral so grading
// the rest of a class on the same paper reuses Anthropic's prompt cache
// instead of re-billing/re-processing the same rubric text every time;
// user message = just the page images) — image tokens are the dominant
// cost here, and Haiku's per-token image price is a fraction of Sonnet's.
// Any question Haiku comes back uncertain about (low confidence, or ANY
// partial-credit judgment — see gradeSubjectiveBatchWithEscalation) gets
// ONE follow-up Sonnet call scoped to just those questions, never the
// whole submission. If the batch call's response is missing an entry or
// malformed, this falls back to the original one-call-per-question path
// (gradeSubjectiveQuestion, also Haiku) so a bad batch response degrades to
// slower-but-working rather than zeroing every question in the submission.
// A single fallback question's own failure (API error, or still-invalid
// JSON after callClaudeJson's one retry) never fails the whole submission
// either — it writes a needs_review row with teacher_note 'AI grading
// failed' instead.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { downloadScan } from '@/lib/checker/scanStorage';
import {
  callClaudeJson, mapWithConcurrency, ClaudeImageInput, describeClaudeError, isRetryableErrorKind,
  ErrorKind, ClaudeErrorInfo, CallTelemetry, CLAUDE_MODEL_SONNET, CLAUDE_MODEL_HAIKU, HAIKU_ESCALATION_CONFIDENCE_THRESHOLD,
} from '@/lib/checker/claude';
import { prepareImageForClaude } from '@/lib/checker/prepareImageForClaude';
import { ensureRubric, Rubric, RubricQuestion } from '@/lib/checker/rubric';
import { recomputeSubmissionTotals, recomputeSectionStatus } from '@/lib/checker/answers';
import { LOW_CONFIDENCE } from '@/lib/checker/gradeMcq';
import { REASON_CODES } from '@/lib/checker/annotate/symbols';
import { SectionStatus } from '@/types/checker';

// How many fallback/rubric-generation calls this ONE submission dispatches
// at once (via mapWithConcurrency below) — composes with, doesn't
// duplicate, claude.ts's MAX_CONCURRENT_CLAUDE_CALLS, which additionally
// bounds the GLOBAL total across every submission grading concurrently.
const CONCURRENCY = 3;

export interface SubjectiveQuestion {
  question_id: string;
  q_number: string;
  question_text: string | null;
  question_text_ur: string | null;
  answer_text: string | null;
  answer_text_ur: string | null;
  question_type: string | null;
  max_marks: number;
}

/** Every question in every non-'mcq' section of the paper's content, in
 *  document order. q_number is a running counter continuing AFTER the
 *  paper's MCQ question count (not necessarily the printed question number
 *  — sections can carry paired/attempt-count structures too irregular to
 *  reliably re-derive here) — this matters because MCQ's own q_number
 *  comes from the layout map's real question_number (e.g. 1-12); starting
 *  subjective at 1 too would collide with those in anything keyed by
 *  q_number alone (the xlsx export's per-question columns, most notably).
 *  Continuing the count instead (13, 14, ...) also reads naturally, same
 *  as a real paper's own section-B numbering. The question text shown
 *  alongside each row is what disambiguates it for a teacher either way. */
export function buildSubjectiveQuestions(content: any): SubjectiveQuestion[] {
  const out: SubjectiveQuestion[] = [];
  if (!Array.isArray(content)) return out;

  let mcqCount = 0;
  for (const section of content) {
    if (section?.type === 'mcq' && Array.isArray(section.questions)) mcqCount += section.questions.length;
  }

  let counter = mcqCount;
  for (const section of content) {
    if (!section || section.type === 'mcq' || !Array.isArray(section.questions)) continue;
    for (const q of section.questions) {
      if (!q?.id) continue;
      counter++;
      out.push({
        question_id: q.id,
        q_number: String(counter),
        question_text: q.question_text ?? null,
        question_text_ur: q.question_text_ur ?? null,
        answer_text: q.answer_text ?? null,
        answer_text_ur: q.answer_text_ur ?? null,
        question_type: q.question_type ?? section.type ?? null,
        max_marks: q.marks ?? section.marksEach ?? 1,
      });
    }
  }
  return out;
}

// Board comment codes valid for this prompt — built from REASON_CODES
// (symbols.ts) rather than hardcoded here, so the model's allowed-code list
// and the on-page/legend rendering can never drift out of sync with each
// other; see JSON_ITEM_SHAPE below, which embeds this same string.
const REASON_CODE_LIST = Object.entries(REASON_CODES).map(([code, word]) => `"${code}" (${word})`).join(', ');

interface ClaudeSubjectiveResponse {
  q_number?: string; // present in batch responses, absent (ignored) in single-question ones
  transcription: string;
  is_blank: boolean;
  page_index: number; // 0-based index into the provided images, or -1 if not found/blank
  // A BAND, not a single guessed point — a single y_pct tended to land
  // annotation marks on the question line rather than in the student's
  // actual answer area. question_top_pct is only used as a sanity check
  // that the answer band doesn't overlap the question text. For a blank
  // question, the band is still the empty ruled-line area belonging to
  // that question (not 0) — annotatePdf.ts centers the "no answer" cross
  // there.
  answer_top_pct: number; // 0-100 from the top of the page
  answer_bottom_pct: number; // 0-100 from the top of the page
  // Horizontal extent of the writing (or, for a blank answer, the ruled
  // line itself) — 0-100 from the LEFT of the page. Needed alongside the
  // top/bottom band so a mark can be centered on the answer on BOTH axes.
  answer_left_pct: number;
  answer_right_pct: number;
  // A SECOND, TIGHTER box — just the visible handwritten ink strokes, not
  // the ruled lines or surrounding whitespace the band above can include.
  // This is what a symbol actually centers on when it's usable (see
  // symbols.ts's resolveAnswerBox); the band above remains the fallback.
  // For a blank answer, or whenever the model isn't confident isolating a
  // tight box, it's instructed to repeat the answer_top/bottom/left/right_pct
  // values verbatim — buildAnswerRow treats that repeat (or a missing/
  // degenerate box) as "no ink box," not a real one.
  answer_ink_top_pct: number;
  answer_ink_bottom_pct: number;
  answer_ink_left_pct: number;
  answer_ink_right_pct: number;
  question_top_pct: number; // 0-100, where the question text itself starts
  // The SCRIPT the student physically wrote the answer in — not the
  // question's own language. null for a blank/unattempted answer. Decides
  // which margin the awarded-marks text is written in (Urdu is
  // right-to-left, so its natural margin is the left).
  answer_language: 'en' | 'ur' | null;
  rubric_scores: { point: string; marks_awarded: number; max_marks: number }[];
  total_marks: number;
  confidence: number;
  justification: string;
  mistakes: string[];
  deduction_reason: string; // short plain-English annotation comment, empty if full marks
  // Compact official board comment code(s) for the ON-PAGE annotation (see
  // REASON_CODES in lib/checker/annotate/symbols.ts) — a wrong/partial
  // answer can carry SEVERAL at once (e.g. ["IN","GR"]); empty/omitted when
  // marks weren't lost. deduction_reason above remains the fuller free-text
  // version for the review UI; this is deliberately terser so it fits on
  // the page.
  reason_codes?: string[];
}

export interface SubjectiveAnswerRow {
  submission_id: string;
  question_id: string;
  q_number: string;
  answer_kind: 'subjective';
  detected_option: 'BLANK' | null;
  correct_option: null;
  override_option: null;
  fill_confidence: number | null;
  bubble_overlay: null;
  transcription: string | null;
  transcription_lang: 'en' | 'ur' | null;
  rubric_scores: { criteria: { point: string; marks_awarded: number; max_marks: number }[]; mistakes: string[] } | null;
  ai_marks: number | null;
  ai_confidence: number | null;
  ai_justification: string | null;
  region_crop_url: string | null;
  max_marks: number;
  needs_review: boolean;
  final_marks: number;
  teacher_note: string | null;
  page_index: number | null;
  answer_top_pct: number | null;
  answer_bottom_pct: number | null;
  answer_left_pct: number | null;
  answer_right_pct: number | null;
  /** Null whenever there's no USABLE ink box — a blank answer, a model
   *  response that repeated the band verbatim (its own "not confident"
   *  signal), or one that failed the plausibility check in buildAnswerRow.
   *  Never a half-populated set — all four are null together, or all four
   *  are set together. */
  answer_ink_top_pct: number | null;
  answer_ink_bottom_pct: number | null;
  answer_ink_left_pct: number | null;
  answer_ink_right_pct: number | null;
  question_top_pct: number | null;
  deduction_reason: string | null;
  reason_codes: string[] | null;
}

const JSON_ITEM_SHAPE = `"transcription": "<verbatim transcription of the student's answer, empty string if blank>", "is_blank": <true|false>, "page_index": <0-based index of the image the answer was found on, or -1 if truly not on any page>, "answer_top_pct": <0-100, top edge of the student's handwritten answer block on that page measured from the page top; if blank, the top edge of the EMPTY RULED-LINE AREA belonging to this question instead>, "answer_bottom_pct": <0-100, bottom edge of that same block/area>, "answer_left_pct": <0-100 from the page's LEFT edge, left edge of that same block/area>, "answer_right_pct": <0-100 from the page's LEFT edge, right edge of that same block/area>, "answer_ink_top_pct": <0-100, top edge of a TIGHT box around ONLY the visible handwritten ink strokes for this answer \\u2014 not the ruled lines, not surrounding whitespace; if blank, or you cannot confidently isolate a tight box, repeat the exact same value as answer_top_pct instead>, "answer_ink_bottom_pct": <same tight-ink rule as above, or repeat answer_bottom_pct>, "answer_ink_left_pct": <same tight-ink rule as above, or repeat answer_left_pct>, "answer_ink_right_pct": <same tight-ink rule as above, or repeat answer_right_pct>, "answer_language": <"en" if the answer is written in English/Latin script, "ur" if written in Urdu/Nastaliq script, null if blank>, "question_top_pct": <0-100, where the PRINTED QUESTION TEXT itself starts on that page>, "rubric_scores": [{"point": "<criterion>", "marks_awarded": <number>, "max_marks": <number>}], "total_marks": <number, sum of marks_awarded, 0 if blank>, "confidence": <0-1>, "justification": "<1-2 sentence explanation>", "mistakes": ["<specific mistake>", "..."], "deduction_reason": "<one short plain-English phrase, 60 characters or less, e.g. 'Incomplete \\u2014 example missing', empty string if full marks>", "reason_codes": [<zero or more of these official board comment codes that apply, ONLY from this exact list: ${REASON_CODE_LIST}; empty array if full marks or none fit>]`;

/** The model's own `page_index` in its JSON response is 0-based WITHIN the
 *  images array actually SENT to it, not the submission's real
 *  `scan_urls` — gradeSubjectiveForSubmission can exclude pages (the MCQ
 *  bubble sheet, a trailing printed answer-key page) before sending, which
 *  renumbers whatever's left. Every caller of buildAnswerRow must supply a
 *  PageResolver built from the SAME index mapping used to build the
 *  `images` array for that call, so a stored page_index/region_crop_url
 *  always points at the real physical page — never the identity mapping
 *  by accident once exclusion is in play. When nothing was excluded, the
 *  resolver IS the identity mapping (see gradeSubjectiveForSubmission). */
interface PageResolver {
  toOriginalPageIndex: (sentIndex: number) => number | null;
  resolveCropUrl: (sentIndex: number) => string | null;
}

function buildAnswerRow(
  question: SubjectiveQuestion,
  result: ClaudeSubjectiveResponse,
  submissionId: string,
  pages: PageResolver,
): SubjectiveAnswerRow {
  const clampedMarks = Math.max(0, Math.min(question.max_marks, Number(result.total_marks) || 0));
  const confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
  // A confidently-detected blank is a clear 0, same as MCQ's confident
  // BLANK — it's an uncertain read that needs a human look, not blankness
  // itself.
  const needsReview = result.is_blank ? false : confidence < LOW_CONFIDENCE;
  const sentPageIndex = typeof result.page_index === 'number' && result.page_index >= 0 ? Math.trunc(result.page_index) : null;
  const pageIndex = sentPageIndex != null ? pages.toOriginalPageIndex(sentPageIndex) : null;
  const clampPct = (v: unknown) => (typeof v === 'number' ? Math.max(0, Math.min(100, v)) : null);
  let answerTopPct = clampPct(result.answer_top_pct);
  let answerBottomPct = clampPct(result.answer_bottom_pct);
  let answerLeftPct = clampPct(result.answer_left_pct);
  let answerRightPct = clampPct(result.answer_right_pct);
  const questionTopPct = clampPct(result.question_top_pct);
  // Defensive: a bottom above the top, or an answer band starting above
  // (i.e. before) the question itself, is not a physically sane band —
  // treat it the same as "no position reported" rather than annotate at a
  // nonsensical spot. annotatePdf.ts falls back to a fixed margin when
  // both are null.
  if (answerTopPct != null && answerBottomPct != null && answerBottomPct < answerTopPct) {
    [answerTopPct, answerBottomPct] = [answerBottomPct, answerTopPct];
  }
  if (answerTopPct != null && questionTopPct != null && answerTopPct < questionTopPct) {
    answerTopPct = null;
    answerBottomPct = null;
  }
  // Same inversion guard on the horizontal pair — independent of the
  // vertical band's own validity (a bad left/right shouldn't null out an
  // otherwise-good top/bottom, and vice versa).
  if (answerLeftPct != null && answerRightPct != null && answerRightPct < answerLeftPct) {
    [answerLeftPct, answerRightPct] = [answerRightPct, answerLeftPct];
  }

  // Tight ink box — same clamp + inversion guards as the band above, then
  // collapsed to null (meaning "no usable ink box," symbols.ts's
  // resolveAnswerBox contract) whenever the model reported a blank answer,
  // omitted a field, or simply repeated the band's own values (its
  // instructed signal for "not confident enough to isolate a tight box" —
  // see JSON_ITEM_SHAPE). A FURTHER plausibility check (positive area,
  // contained within the band) happens once, at render time, in
  // symbols.ts's resolveAnswerBox — not duplicated here.
  let inkTopPct = clampPct(result.answer_ink_top_pct);
  let inkBottomPct = clampPct(result.answer_ink_bottom_pct);
  let inkLeftPct = clampPct(result.answer_ink_left_pct);
  let inkRightPct = clampPct(result.answer_ink_right_pct);
  if (inkTopPct != null && inkBottomPct != null && inkBottomPct < inkTopPct) {
    [inkTopPct, inkBottomPct] = [inkBottomPct, inkTopPct];
  }
  if (inkLeftPct != null && inkRightPct != null && inkRightPct < inkLeftPct) {
    [inkLeftPct, inkRightPct] = [inkRightPct, inkLeftPct];
  }
  const INK_REPEAT_EPSILON = 0.5; // pct-points — treats a near-exact repeat of the band as "no ink box", not a coincidentally-tiny real one
  const closeTo = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) <= INK_REPEAT_EPSILON;
  const inkAllPresent = inkTopPct != null && inkBottomPct != null && inkLeftPct != null && inkRightPct != null;
  const inkRepeatsband =
    closeTo(inkTopPct, answerTopPct) && closeTo(inkBottomPct, answerBottomPct) &&
    closeTo(inkLeftPct, answerLeftPct) && closeTo(inkRightPct, answerRightPct);
  const hasUsableInk = !result.is_blank && inkAllPresent && !inkRepeatsband;

  const transcriptionLang: 'en' | 'ur' | null = result.answer_language === 'en' || result.answer_language === 'ur' ? result.answer_language : null;
  // Never trust the model's codes verbatim onto a rendered page — only
  // known REASON_CODES keys survive (typos/hallucinated codes are simply
  // dropped, same defensive stance as the old single-code check). When
  // marks were actually lost on a genuinely-attempted answer and the model
  // returned nothing valid, fall back to a sensible default rather than
  // leaving the mark uncoded — IN (Incomplete) for a partial award, IR
  // (Irrelevant) for a zero award; a confidently-blank answer never gets a
  // fallback code (none of the official codes mean "not attempted").
  const validCodes = Array.isArray(result.reason_codes)
    ? result.reason_codes.filter(c => Object.prototype.hasOwnProperty.call(REASON_CODES, c))
    : [];
  const marksLost = clampedMarks < question.max_marks;
  const reasonCodes = validCodes.length > 0
    ? validCodes
    : (marksLost && !result.is_blank ? [clampedMarks > 0 ? 'IN' : 'IR'] : null);

  return {
    submission_id: submissionId,
    question_id: question.question_id,
    q_number: question.q_number,
    answer_kind: 'subjective',
    detected_option: result.is_blank ? 'BLANK' : null,
    correct_option: null,
    override_option: null,
    fill_confidence: confidence,
    bubble_overlay: null,
    transcription: result.transcription || null,
    transcription_lang: transcriptionLang,
    rubric_scores: { criteria: result.rubric_scores || [], mistakes: result.mistakes || [] },
    ai_marks: clampedMarks,
    ai_confidence: confidence,
    ai_justification: result.justification || null,
    region_crop_url: pages.resolveCropUrl(sentPageIndex ?? -1),
    max_marks: question.max_marks,
    needs_review: needsReview,
    final_marks: clampedMarks,
    teacher_note: null,
    page_index: pageIndex,
    answer_top_pct: answerTopPct,
    answer_bottom_pct: answerBottomPct,
    answer_left_pct: answerLeftPct,
    answer_right_pct: answerRightPct,
    answer_ink_top_pct: hasUsableInk ? inkTopPct : null,
    answer_ink_bottom_pct: hasUsableInk ? inkBottomPct : null,
    answer_ink_left_pct: hasUsableInk ? inkLeftPct : null,
    answer_ink_right_pct: hasUsableInk ? inkRightPct : null,
    question_top_pct: questionTopPct,
    deduction_reason: result.deduction_reason || null,
    reason_codes: reasonCodes,
  };
}

function failedAnswerRow(question: SubjectiveQuestion, submissionId: string): SubjectiveAnswerRow {
  return {
    submission_id: submissionId,
    question_id: question.question_id,
    q_number: question.q_number,
    answer_kind: 'subjective',
    detected_option: null,
    correct_option: null,
    override_option: null,
    fill_confidence: null,
    bubble_overlay: null,
    transcription: null,
    transcription_lang: null,
    rubric_scores: null,
    ai_marks: null,
    ai_confidence: null,
    ai_justification: null,
    region_crop_url: null,
    max_marks: question.max_marks,
    needs_review: true,
    final_marks: 0,
    teacher_note: 'AI grading failed',
    page_index: null,
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

/** The STABLE, per-question text (question + rubric + model answer) that
 *  belongs in a cacheable prefix — identical for the same question+rubric
 *  regardless of which student is being graded. Shared by the batch
 *  prompt (one block per question, below) and the single-question prompt
 *  (gradeSubjectiveQuestion), so both paths describe a question the exact
 *  same way — never two copies of this text that could drift apart. */
function buildQuestionBlock(q: SubjectiveQuestion, rubric: Rubric | undefined): string {
  return [
    `Question ${q.q_number} (${q.question_type || 'short/long answer'}, ${q.max_marks} marks):`,
    `English: ${q.question_text || '(none)'}`,
    q.question_text_ur ? `Urdu: ${q.question_text_ur}` : null,
    `Model answer (English): ${q.answer_text || '(none)'}`,
    q.answer_text_ur ? `Model answer (Urdu): ${q.answer_text_ur}` : null,
    `Rubric: ${JSON.stringify(rubric?.criteria ?? [])}`,
  ].filter(Boolean).join('\n');
}

/** The single-question equivalent of buildBatchSystemPrompt below — same
 *  reasoning: everything stable (instructions + this one question's own
 *  text/rubric) goes in `system` with cache_control, so every student who
 *  falls back to per-question grading (or every recapture retake) for the
 *  SAME question hits the same cached prefix, instead of never attempting
 *  caching at all. Previously this was inlined directly into the user
 *  prompt with no system block — the actual reason the per-question path
 *  never cached anything. */
function buildSingleQuestionSystemPrompt(question: SubjectiveQuestion, rubric: Rubric): string {
  return [
    'You are grading one exam question from a student\'s handwritten answer sheet. The images provided are photos/scans of the ENTIRE answer sheet (all pages, in order) — find and grade only the answer to the specific question below; ignore all other questions and any MCQ bubble-sheet pages.',
    '',
    buildQuestionBlock(question, rubric),
    '',
    'Find the student\'s handwritten answer to this specific question in the provided images, transcribe it, and grade it against the rubric.',
    `Respond with ONLY a JSON object of this exact shape, no markdown fences, no commentary: {${JSON_ITEM_SHAPE}}`,
  ].join('\n');
}

/** The trivial case: nothing was excluded before sending `images`, so
 *  "index within the sent array" already IS the original `scan_urls`
 *  index. Used by every caller that hands over its own already-decided,
 *  unfiltered image set — every external caller of gradeSubjectiveQuestion
 *  (the recapture retake route, promote-excess) and the per-question
 *  fallback loop below, which reuses whatever `images`/PageResolver
 *  gradeSubjectiveForSubmission already built for the (possibly
 *  page-excluded) batch call it fell back from. */
export function identityPageResolver(scanUrls: string[]): PageResolver {
  const inRange = (i: number) => i >= 0 && i < scanUrls.length;
  return {
    toOriginalPageIndex: sentIndex => (inRange(sentIndex) ? sentIndex : null),
    resolveCropUrl: sentIndex => (inRange(sentIndex) ? scanUrls[sentIndex] : null),
  };
}

/** Grades ONE question against ONE set of images (a single teacher-
 *  recaptured close-up for the per-question retake path, or as the
 *  fallback path when a batch call fails) — the atomic unit the recapture
 *  route builds on directly, and gradeQuestionsBatchWithFallback falls
 *  back to per-question when the batch call's response can't be trusted.
 *  `pages` turns the model's reported (sent-array-relative) page_index
 *  into a real scan_urls index and a region_crop_url — see PageResolver's
 *  own doc comment for why this can't just be scan_urls directly. `model`
 *  defaults to Sonnet (the safe default for a single, teacher-triggered,
 *  low-volume call like a recapture retake); gradeQuestionsBatchWithFallback
 *  passes Haiku explicitly for its own fallback loop, matching the
 *  Haiku-first policy the batch path uses. */
export async function gradeSubjectiveQuestion(
  question: SubjectiveQuestion,
  rubric: Rubric,
  images: ClaudeImageInput[],
  submissionId: string,
  pages: PageResolver,
  options?: { model?: string; telemetry?: CallTelemetry },
): Promise<SubjectiveAnswerRow> {
  const { model = CLAUDE_MODEL_SONNET, telemetry } = options ?? {};
  try {
    const system = buildSingleQuestionSystemPrompt(question, rubric);
    const prompt = 'Grade this student\'s handwritten answer now, following the instructions and exact JSON shape given above.';
    const result = await callClaudeJson<ClaudeSubjectiveResponse>({ images, prompt, system, maxTokens: 1536, callLabel: `per-question:${question.question_id}`, model, telemetry });
    return buildAnswerRow(question, result, submissionId, pages);
  } catch (e: unknown) {
    const info = describeClaudeError(e);
    console.error(`Subjective grading failed for question ${question.question_id} (submission ${submissionId}): ${info.summary}`, e);
    return failedAnswerRow(question, submissionId);
  }
}

/** Everything except the images in one stable block — every student of the
 *  SAME paper sends this exact same text, so marking it cache_control:
 *  ephemeral in claude.ts lets Anthropic reuse the cache across a whole
 *  class's worth of grading calls instead of re-processing it every time. */
function buildBatchSystemPrompt(questions: SubjectiveQuestion[], rubrics: Map<string, Rubric>): string {
  const questionBlocks = questions.map(q => buildQuestionBlock(q, rubrics.get(q.question_id))).join('\n\n');

  return [
    'You are grading a student\'s handwritten exam answer sheet against ALL of the following questions in one pass. You will be given photos/scans of the ENTIRE answer sheet (all pages, in 0-based index order). For EACH question below, find that student\'s answer to it anywhere in the images, transcribe it, and grade it against its own rubric — ignore any MCQ bubble-sheet pages.',
    '',
    questionBlocks,
    '',
    'Respond with ONLY a JSON array (no markdown fences, no commentary) — exactly one object per question listed above, in this exact shape:',
    `[{"q_number": "<matching a Question number above>", ${JSON_ITEM_SHAPE}}]`,
    '',
    'Return one entry for every question listed, even ones the student left blank.',
  ].join('\n');
}

/** ONE Claude call covering every question in `questions`, on whichever
 *  `model` the caller specifies — throws (never swallows) if the response
 *  isn't a well-formed array or is missing an entry, so the caller can
 *  fall back to per-question grading for the whole set rather than
 *  silently under-grading some of them. */
async function gradeSubjectiveBatch(
  questions: SubjectiveQuestion[],
  rubrics: Map<string, Rubric>,
  images: ClaudeImageInput[],
  submissionId: string,
  pages: PageResolver,
  model: string,
  telemetry: CallTelemetry,
): Promise<SubjectiveAnswerRow[]> {
  const system = buildBatchSystemPrompt(questions, rubrics);
  const prompt = 'Grade this student\'s handwritten answers now, following the instructions and exact JSON array shape given above. Return one entry for every question listed, even if blank.';
  const maxTokens = Math.min(8192, 900 + questions.length * 500);

  const result = await callClaudeJson<any>({ images, prompt, system, maxTokens, callLabel: 'batch', model, telemetry });
  const list: any[] | null = Array.isArray(result) ? result : Array.isArray(result?.answers) ? result.answers : null;
  if (!list) throw new Error('Batch grading response was not a JSON array');

  const byQNumber = new Map(list.map((r: any) => [String(r.q_number), r]));
  return questions.map(q => {
    const r = byQNumber.get(q.q_number);
    if (!r) throw new Error(`Batch grading response missing question ${q.q_number}`);
    return buildAnswerRow(q, r, submissionId, pages);
  });
}

/** A Haiku-graded row is worth a Sonnet double-check when its own
 *  confidence falls below HAIKU_ESCALATION_CONFIDENCE_THRESHOLD, OR
 *  (independent of confidence) it's a partial-credit result — partial
 *  credit is the single most subjective judgment a grader makes, called
 *  out as its own escalation trigger regardless of how confident Haiku
 *  reported being. A confident BLANK never escalates — there's no
 *  judgment call to double-check. */
function needsHaikuEscalation(row: SubjectiveAnswerRow): 'low_confidence' | 'partial_credit' | null {
  if (row.detected_option === 'BLANK') return null;
  const isPartialCredit = row.final_marks > 0 && row.final_marks < row.max_marks;
  if (isPartialCredit) return 'partial_credit';
  if ((row.ai_confidence ?? 0) < HAIKU_ESCALATION_CONFIDENCE_THRESHOLD) return 'low_confidence';
  return null;
}

/** Runs the batch call on Haiku first (image tokens dominate this
 *  pipeline's cost, and Haiku's per-token image price is a fraction of
 *  Sonnet's — see claude.ts's model-constants doc comment), then escalates
 *  any uncertain question (see needsHaikuEscalation) to ONE follow-up
 *  Sonnet call scoped to just those question ids — never the whole
 *  submission. Every escalation is logged (`[GRADE-HAIKU-ESCALATE]`) with
 *  its trigger and Haiku's own confidence, so the escalation rate is
 *  visible in logs immediately. If the Sonnet follow-up itself fails,
 *  Haiku's own (still usable) results are kept rather than losing the row
 *  entirely — an escalation is a quality upgrade attempt, never a
 *  prerequisite for having a grade at all. */
async function gradeSubjectiveBatchWithEscalation(
  questions: SubjectiveQuestion[],
  rubrics: Map<string, Rubric>,
  images: ClaudeImageInput[],
  submissionId: string,
  paperId: string,
  pages: PageResolver,
): Promise<SubjectiveAnswerRow[]> {
  const haikuRows = await gradeSubjectiveBatch(questions, rubrics, images, submissionId, pages, CLAUDE_MODEL_HAIKU, { submissionId, paperId, callKind: 'batch' });

  const escalations = haikuRows
    .map(row => ({ row, reason: needsHaikuEscalation(row) }))
    .filter((e): e is { row: SubjectiveAnswerRow; reason: 'low_confidence' | 'partial_credit' } => e.reason !== null);
  if (escalations.length === 0) return haikuRows;

  for (const { row, reason } of escalations) {
    console.log(`[GRADE-HAIKU-ESCALATE] submission=${submissionId} question=${row.question_id} reason=${reason} haikuConfidence=${row.ai_confidence}`);
  }

  const escalateIds = new Set(escalations.map(e => e.row.question_id));
  const escalateQuestions = questions.filter(q => escalateIds.has(q.question_id));
  let sonnetRows: SubjectiveAnswerRow[];
  try {
    sonnetRows = await gradeSubjectiveBatch(escalateQuestions, rubrics, images, submissionId, pages, CLAUDE_MODEL_SONNET, { submissionId, paperId, callKind: 'escalation' });
  } catch (e: unknown) {
    console.error(`[GRADE-HAIKU-ESCALATE] Sonnet escalation call failed for submission ${submissionId}, keeping Haiku results: ${describeClaudeError(e).summary}`, e);
    return haikuRows;
  }

  const sonnetByQid = new Map(sonnetRows.map(r => [r.question_id, r]));
  return haikuRows.map(r => sonnetByQid.get(r.question_id) ?? r);
}

interface BatchWithFallbackResult {
  rows: SubjectiveAnswerRow[];
  /** Set whenever the batch call itself failed, regardless of whether the
   *  fallback below then recovered every row successfully — the caller
   *  decides whether it's still worth surfacing (see gradeSubjectiveForSubmission,
   *  which only propagates it onto the section-level result when at least
   *  one row actually ended up needing review). */
  failure: ClaudeErrorInfo | null;
}

/** Tries the single batched (Haiku-first, escalating) call first. On
 *  failure, classifies WHY (see claude.ts's describeClaudeError): a
 *  network/timeout/unknown failure might succeed on a fresh attempt, so
 *  this falls back to the original one-call-per-question loop (also
 *  Haiku, matching the batch path's own model policy) — the safety net
 *  that keeps per-question failure isolation working even though the
 *  common path is now one call. A billing/auth/bad_request failure is
 *  GUARANTEED to fail identically on every one of those N per-question
 *  retries too (this is literally what an insufficient-credit account
 *  looks like in the logs: one batch 400, then N identical per-question
 *  400s) — for that class, the fallback is skipped entirely and every
 *  question goes straight to needs_review with the one real cause
 *  attached once, instead of repeating a doomed call. */
async function gradeQuestionsBatchWithFallback(
  questions: SubjectiveQuestion[],
  rubrics: Map<string, Rubric>,
  images: ClaudeImageInput[],
  submissionId: string,
  paperId: string,
  pages: PageResolver,
): Promise<BatchWithFallbackResult> {
  if (questions.length === 0) return { rows: [], failure: null };
  try {
    const rows = await gradeSubjectiveBatchWithEscalation(questions, rubrics, images, submissionId, paperId, pages);
    return { rows, failure: null };
  } catch (e: unknown) {
    const info = describeClaudeError(e);
    console.error(`[GRADE-DEBUG] batch subjective grading failed for submission ${submissionId} (${questions.length} questions): ${info.summary}`, e);

    if (!isRetryableErrorKind(info.kind)) {
      console.error(`[GRADE-DEBUG] skipping per-question fallback for submission ${submissionId} — ${info.kind} failures are guaranteed to repeat`);
      return { rows: questions.map(q => failedAnswerRow(q, submissionId)), failure: info };
    }

    console.error(`[GRADE-DEBUG] falling back to one call per question for submission ${submissionId}`);
    const rows = await mapWithConcurrency(questions, CONCURRENCY, q => gradeSubjectiveQuestion(q, rubrics.get(q.question_id)!, images, submissionId, pages, { model: CLAUDE_MODEL_HAIKU, telemetry: { submissionId, paperId, callKind: 'per_question' } }));
    return { rows, failure: info };
  }
}

// ── Attempt-count enforcement ───────────────────────────────────────────
// Board rule: in a "choice" section (e.g. "attempt any 3 of the following
// 5"), only the first N attempted answers count — extra attempted answers
// beyond N are marked EXCESS_ATTEMPT (0 marks, excluded from the paper's
// fixed denominator — see computePaperMaxScore). Every unit in a group is
// sent to the one real batch/escalation call (see gradeQuestionsBatchWithFallback
// above) — attempted-vs-blank comes from that call's own is_blank field,
// not a separate pre-filter call, so selection below reads real grading
// results, not a cheap detector's guess.
//
// Group boundaries are read directly from paper.content — specifically the
// attemptCount/sharedAttemptCount/sharedTotalPairs fields the paper
// generator (PaperBuilderApp.tsx) already stamps onto each PaperSection —
// rather than re-querying chapter_question_rules at grading time, since
// content reflects exactly what was printed even if a rule was edited
// since. Only two directly-inspectable patterns are enforced (see
// resolveChoiceGroups below); anything else grades every attempted
// question normally, same as before this feature existed — never guess at
// a grouping and risk zeroing a legitimately-required answer.

export interface ChoiceGroup {
  attemptLimit: number;
  /** Each entry is one "attemptable unit" in printed order — a single
   *  question_id for a simple "attempt N of M" section, or a pair of
   *  question_ids (both move together) for a paired-long group, where the
   *  choice is between whole pairs, not their individual a/b parts. */
  units: string[][];
}

export function resolveChoiceGroups(content: any): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  if (!Array.isArray(content)) return groups;

  let i = 0;
  while (i < content.length) {
    const section = content[i];
    if (!section || section.type === 'mcq' || !Array.isArray(section.questions)) { i++; continue; }

    // Paired-long run: consecutive sections sharing a carried-forward
    // sharedAttemptCount/sharedTotalPairs, stamped only on the first
    // section of the run (null on the rest) — PaperBuilderApp's own
    // convention for these groups.
    if (section.sharedAttemptCount != null && section.sharedTotalPairs != null) {
      const attemptLimit = section.sharedAttemptCount;
      const totalPairs = section.sharedTotalPairs;
      const units: string[][] = [];
      let j = i;
      while (j < content.length && units.length < totalPairs) {
        const s = content[j];
        if (!s || !Array.isArray(s.questions)) break;
        const ids = s.questions.map((q: any) => q?.id).filter(Boolean);
        if (ids.length > 0) units.push(ids);
        j++;
      }
      if (attemptLimit < units.length) groups.push({ attemptLimit, units });
      i = j;
      continue;
    }

    // Simple case: one section, per-question choice.
    const attemptCount = section.attemptCount;
    const ids: string[] = section.questions.map((q: any) => q?.id).filter(Boolean);
    if (typeof attemptCount === 'number' && attemptCount < ids.length) {
      groups.push({ attemptLimit: attemptCount, units: ids.map((id: string) => [id]) });
    }
    i++;
  }

  return groups;
}

/** Applies one choice group's first-N/best-N cap to a set of rows that have
 *  ALREADY been graded for every unit (see the comment above
 *  resolveChoiceGroups — attempted/blank status comes straight from each
 *  row's own `detected_option`, not a separate pre-filter call). Pure and
 *  synchronous — no grading call, no DB access — specifically so this can
 *  be unit-tested with synthetic rows (see gradeSubjective.test.ts) without
 *  mocking Claude or Supabase. Returns this group's rows in printed order,
 *  with excess units overridden to 0 marks / EXCESS_ATTEMPT; a genuinely
 *  blank unit is left as an ordinary blank row, never marked excess (the
 *  paper's denominator is computed independently from paper.content — see
 *  computePaperMaxScore — so a blank optional question can't corrupt it). */
export function applyChoiceGroupSelection(
  group: ChoiceGroup,
  unitQuestionLists: SubjectiveQuestion[][],
  gradedByQid: Map<string, SubjectiveAnswerRow>,
  policy: 'first_n' | 'grade_all_best_n',
): SubjectiveAnswerRow[] {
  const rows: SubjectiveAnswerRow[] = [];

  if (policy === 'grade_all_best_n') {
    const unitSummaries = unitQuestionLists.map(uq => {
      const unitRows = uq.map(q => gradedByQid.get(q.question_id)!);
      return {
        rows: unitRows,
        total: unitRows.reduce((sum, r) => sum + (r.final_marks ?? 0), 0),
        attempted: unitRows.some(r => r.detected_option !== 'BLANK'),
      };
    });
    const attemptedIdx = unitSummaries.map((_, i) => i).filter(i => unitSummaries[i].attempted);
    // Stable sort — ties keep printed order, a sensible tiebreak even under "best N".
    const rankedIdx = [...attemptedIdx].sort((a, b) => unitSummaries[b].total - unitSummaries[a].total);
    const countedIdx = new Set(rankedIdx.slice(0, group.attemptLimit));
    unitSummaries.forEach((s, i) => {
      const isExcess = attemptedIdx.includes(i) && !countedIdx.has(i);
      rows.push(...(isExcess ? s.rows.map(r => ({ ...r, final_marks: 0, needs_review: false, teacher_note: 'EXCESS_ATTEMPT' })) : s.rows));
    });
    return rows;
  }

  // 'first_n': authoritative attempted status comes from the real grading
  // result (detected_option !== 'BLANK') — every unit was actually graded,
  // so this is real signal, not a cheap detector's guess.
  let countedSoFar = 0;
  for (const uq of unitQuestionLists) {
    const unitRows = uq.map(q => gradedByQid.get(q.question_id)!);
    const reallyAttempted = unitRows.some(r => r.detected_option !== 'BLANK');

    if (!reallyAttempted) {
      rows.push(...unitRows); // genuinely blank — normal rows, not excess
    } else if (countedSoFar < group.attemptLimit) {
      rows.push(...unitRows);
      countedSoFar++;
    } else {
      // Beyond the required N — force to excess regardless of what was
      // graded. Excess answers contribute 0 to both the numerator
      // (final_marks here) and the denominator (excess rows are never
      // part of the paper's fixed max_score — see computePaperMaxScore).
      rows.push(...unitRows.map(r => ({ ...r, final_marks: 0, needs_review: false, teacher_note: 'EXCESS_ATTEMPT' })));
    }
  }
  return rows;
}

// ── Paper-level max marks (the fixed denominator) ───────────────────────
// A paper's "out of 60" is a property of the PAPER, not of any one
// student's submission — every submission for the same paper must show
// the same max_score, regardless of how many choice questions that
// particular student happened to attempt. Deriving it by summing
// submission_answers rows (as this used to do) got this wrong: a student
// who attempted fewer than the required N in a choice section would end
// up with a SMALLER denominator too, when the true paper total never
// changes. The fix is to compute it purely from paper.content, once,
// independent of grading.
export interface PaperMaxScore {
  mcqMax: number;
  subjectiveMax: number;
  totalMax: number;
}

/** Primary computation: trusts each PaperSection's own `totalMarks` field,
 *  which the generator (PaperBuilderApp.tsx) already computes correctly
 *  for this exact purpose — e.g. a "5 of 8" section gets totalMarks =
 *  5 x marksEach, and a paired-long group with 0 required attempts gets
 *  totalMarks = 0. This is the SAME field the printed "Maximum Marks" on
 *  the paper is derived from, so it's expected to already match. */
function sumDeclaredSectionMarks(content: any): { mcqMax: number; subjectiveMax: number } {
  let mcqMax = 0;
  let subjectiveMax = 0;
  if (!Array.isArray(content)) return { mcqMax, subjectiveMax };
  for (const section of content) {
    if (!section) continue;
    const tm = Number(section.totalMarks) || 0;
    if (section.type === 'mcq') mcqMax += tm;
    else subjectiveMax += tm;
  }
  return { mcqMax, subjectiveMax };
}

/** Independent cross-check: re-derives the subjective max from
 *  attempt_count x marks directly (resolveChoiceGroups for the limited
 *  sections, full sum for everything else) instead of trusting
 *  section.totalMarks — if this disagrees with the primary computation,
 *  something about a section's shape wasn't handled the way either
 *  computation assumed, and that's worth a loud warning rather than
 *  silently trusting either number. */
function crossCheckSubjectiveMax(content: any): number {
  const allQuestions = buildSubjectiveQuestions(content);
  const questionsById = new Map(allQuestions.map(q => [q.question_id, q]));
  const groups = resolveChoiceGroups(content);
  const groupedIds = new Set(groups.flatMap(g => g.units.flat()));

  let total = 0;
  for (const group of groups) {
    const firstUnit = group.units[0] || [];
    const unitMarks = firstUnit.reduce((sum, id) => sum + (questionsById.get(id)?.max_marks || 0), 0);
    total += group.attemptLimit * unitMarks;
  }
  for (const q of allQuestions) {
    if (!groupedIds.has(q.question_id)) total += q.max_marks;
  }
  return total;
}

/** The paper's fixed max_score — same for every submission of this paper. */
export function computePaperMaxScore(content: any): PaperMaxScore {
  const { mcqMax, subjectiveMax } = sumDeclaredSectionMarks(content);

  const crossCheck = crossCheckSubjectiveMax(content);
  if (crossCheck !== subjectiveMax) {
    // eslint-disable-next-line no-console
    console.warn(`[GRADE-DEBUG] paper max-marks mismatch: section.totalMarks sums to ${subjectiveMax}, independent attempt-count recomputation gives ${crossCheck} — using ${subjectiveMax} (matches what's printed on the paper as "Maximum Marks")`);
  }

  return { mcqMax, subjectiveMax, totalMax: mcqMax + subjectiveMax };
}

// ── Marks side — ONE side for the whole paper, decided once ────────────
// Previously each row's own transcription_lang independently decided its
// own marks' margin (onLeftMargin in annotatePdf.ts/ScanViewer.tsx) — on a
// paper mixing Urdu and English answers that printed some marks on the
// left and some on the right within the SAME paper. This decides a single
// side for the whole submission instead, by majority vote across every
// subjective answer's actual script.
export type MarksSide = 'left' | 'right';

/** Majority of `PaperSection.language` across the paper's own subjective
 *  (non-mcq) sections — used only as decideSubjectiveMarksSide's tie-break
 *  when the answers themselves don't decide it (an exact vote tie, or an
 *  all-blank submission with no language signal at all). */
function sectionLanguageMajority(content: any): MarksSide | null {
  if (!Array.isArray(content)) return null;
  let urdu = 0;
  let english = 0;
  for (const section of content) {
    if (!section || section.type === 'mcq') continue;
    const lang = String(section.language || '').toLowerCase();
    if (lang === 'urdu') urdu++;
    else if (lang === 'english') english++;
    // 'bilingual' (or anything unrecognized) casts no vote here — genuinely
    // ambiguous at the section level, same as a null transcription_lang.
  }
  if (urdu === english) return null;
  return urdu > english ? 'left' : 'right';
}

/** Decides the ONE marks-side for a whole submission: majority of
 *  `transcription_lang` ('ur' -> left, 'en' -> right) across every
 *  subjective answer row (a blank/null-language row casts no vote — there
 *  is no script to read). An exact tie — including an all-blank
 *  submission, 0 votes either way — falls back to the paper's own section
 *  language majority (see sectionLanguageMajority above); if that's still
 *  undetermined, defaults to 'right'. Pure and cheap: called once by
 *  finalizeSubmissionTotals (the authoritative recompute already run after
 *  every grade/regrade/override), which persists the result so the PDF and
 *  the review overlay always read the SAME value instead of two
 *  independent computations that could drift after a teacher edits an
 *  answer. */
export function decideSubjectiveMarksSide(
  content: any,
  answerRows: { transcription_lang: string | null }[],
): MarksSide {
  let urdu = 0;
  let english = 0;
  for (const row of answerRows) {
    if (row.transcription_lang === 'ur') urdu++;
    else if (row.transcription_lang === 'en') english++;
  }
  if (urdu !== english) return urdu > english ? 'left' : 'right';
  return sectionLanguageMajority(content) ?? 'right';
}

// ── Per-section subtotals (Fix 4: a circled "Q.2: 5/10" near each section
// heading) ───────────────────────────────────────────────────────────────
// Deliberately NEVER persisted — computed fresh from paper.content + live
// submission_answers rows every time it's needed (annotatePdf.ts at
// annotation time, the submissions GET route for the review-UI badges),
// same "single recomputed source of truth, never a stored derived number"
// stance computePaperMaxScore/finalizeSubmissionTotals already take.
export interface SectionSubtotal {
  /** "Q.N" — derived from section ORDER (MCQ, if present, is always Q.1),
   *  not re-derived from PaperLayoutRenderer's own full numbering logic
   *  (which also has to handle Urdu/English pairing quirks a printed
   *  annotation doesn't need to reproduce exactly) — good enough for a
   *  cosmetic on-page/on-screen label, not used for any scoring math. */
  heading: string;
  awarded: number;
  max: number;
  /** Every question_id belonging to this section (a paired-long run
   *  contributes all of its member sections' ids) — the caller picks
   *  whichever one it actually has position data for as the anchor,
   *  rather than this purely-content-driven helper guessing at that. */
  questionIds: string[];
}

export function computeSectionSubtotals(
  content: any,
  answerRows: { question_id: string; final_marks: number | null; teacher_note?: string | null }[],
): SectionSubtotal[] {
  const out: SectionSubtotal[] = [];
  if (!Array.isArray(content)) return out;

  const rowByQid = new Map(answerRows.map(r => [r.question_id, r]));
  const hasMcq = content.some((s: any) => s?.type === 'mcq');
  let headingNumber = hasMcq ? 2 : 1;

  let i = 0;
  while (i < content.length) {
    const section = content[i];
    if (!section || section.type === 'mcq' || !Array.isArray(section.questions)) { i++; continue; }

    // Paired-long run: same grouping rule resolveChoiceGroups uses — a run
    // of sections sharing a carried-forward sharedAttemptCount/
    // sharedTotalPairs is ONE printed heading covering the whole run.
    const group: any[] = [section];
    if (section.sharedAttemptCount != null && section.sharedTotalPairs != null) {
      let j = i + 1;
      while (j < content.length && group.length < section.sharedTotalPairs) {
        const s = content[j];
        if (!s || !Array.isArray(s.questions)) break;
        group.push(s);
        j++;
      }
      i = j;
    } else {
      i++;
    }

    const ids: string[] = group.flatMap(s => (s.questions || []).map((q: any) => q?.id).filter(Boolean));
    if (ids.length === 0) continue;

    let awarded = 0;
    for (const id of ids) {
      const row = rowByQid.get(id);
      if (!row || row.teacher_note === 'EXCESS_ATTEMPT') continue;
      awarded += row.final_marks ?? 0;
    }
    const max = group.reduce((sum, s) => sum + (Number(s.totalMarks) || 0), 0);

    out.push({ heading: `Q.${headingNumber}`, awarded, max, questionIds: ids });
    headingNumber++;
  }

  return out;
}

export interface SectionSubtotalAnchor extends SectionSubtotal {
  pageIndex: number;
  /** %-of-page-height from the top (TOP-origin, same convention as
   *  answer_top_pct), already offset above the section's own printed
   *  heading — the same anchor rule annotatePdf.ts's circle uses. */
  topPct: number;
}

const SECTION_SUBTOTAL_ANCHOR_OFFSET_PCT = 3; // % of page height, upward from the anchor row's own answer_top_pct

/** computeSectionSubtotals plus WHERE to draw it — the anchor-row-picking
 *  logic annotatePdf.ts's own circle used to inline itself, factored out
 *  so the submissions API route (for the review overlay's matching badge)
 *  can compute the exact same anchor instead of re-deriving it. A section
 *  with no gradable position data anywhere among its questions is simply
 *  omitted (never a guess). */
export function computeSectionSubtotalAnchors(
  content: any,
  answerRows: { question_id: string; answer_kind?: string | null; final_marks: number | null; teacher_note?: string | null; page_index?: number | null; answer_top_pct?: number | null }[],
): SectionSubtotalAnchor[] {
  const subtotals = computeSectionSubtotals(content, answerRows);
  const out: SectionSubtotalAnchor[] = [];
  for (const subtotal of subtotals) {
    let anchorRow: (typeof answerRows)[number] | null = null;
    for (const qid of subtotal.questionIds) {
      const row = answerRows.find(a => a.answer_kind === 'subjective' && a.question_id === qid && a.page_index != null);
      if (row) { anchorRow = row; break; }
    }
    if (!anchorRow || anchorRow.page_index == null) continue;
    const topPct = Math.max(0, (anchorRow.answer_top_pct ?? 0) - SECTION_SUBTOTAL_ANCHOR_OFFSET_PCT);
    out.push({ ...subtotal, pageIndex: anchorRow.page_index, topPct });
  }
  return out;
}

/** Loads (generating if missing) the rubric for every given question,
 *  keyed by question_id — a single batched+concurrency-capped pass so
 *  gradeSubjectiveForSubmission doesn't need to think about caching itself.
 *  `paperId` tags any rubric-generation calls' cost telemetry. */
export async function loadRubrics(questions: SubjectiveQuestion[], paperId?: string): Promise<Map<string, Rubric>> {
  const questionIds = questions.map(q => q.question_id);
  const { data: questionRows } = await supabaseAdmin
    .from('questions')
    .select('id, question_text, question_text_ur, answer_text, answer_text_ur, question_type, default_marks, rubric')
    .in('id', questionIds);
  const rowById = new Map((questionRows || []).map((q: any) => [q.id, q]));

  const rubrics = new Map<string, Rubric>();
  await mapWithConcurrency(questions, CONCURRENCY, async (q) => {
    const row = rowById.get(q.question_id);
    const rubricQuestion: RubricQuestion = row
      ? { id: row.id, question_text: row.question_text, question_text_ur: row.question_text_ur, answer_text: row.answer_text, answer_text_ur: row.answer_text_ur, question_type: row.question_type, default_marks: row.default_marks, rubric: row.rubric }
      : { id: q.question_id, question_text: q.question_text, question_text_ur: q.question_text_ur, answer_text: q.answer_text, answer_text_ur: q.answer_text_ur, question_type: q.question_type, default_marks: q.max_marks, rubric: null };
    rubrics.set(q.question_id, await ensureRubric(rubricQuestion, paperId));
  });
  return rubrics;
}

export interface GradeSubjectiveResult {
  ok: boolean;
  error?: string;
  /** Machine-readable classification of `error` (see claude.ts's
   *  describeClaudeError) — set whenever `error` came from a classifiable
   *  API/network failure, present even when `ok:true` (a batch failure
   *  that a per-question fallback partially or fully recovered from is
   *  still worth surfacing if anything ended up needing review). */
  errorKind?: ErrorKind;
  status?: number;
  skipped?: boolean;
  answerRows?: SubjectiveAnswerRow[];
  subjectiveScore?: number;
  maxScore?: number;
  anyNeedsReview?: boolean;
}

/** paper is pre-fetched by the caller (route or orchestrator), same
 *  reasoning as gradeMcqForSubmission. */
export async function gradeSubjectiveForSubmission(params: {
  submissionId: string;
  submission: any;
  paper: any;
  /** When false (default), subjective questions the teacher has already
   *  reviewed (submission_answers.reviewed_by set) are left untouched —
   *  not regraded, not deleted. true wipes and regrades everything, used
   *  by the regrade route's ?force=1. */
  force?: boolean;
  /** true when the orchestrator is running this alongside MCQ grading
   *  (Promise.allSettled) and will do its OWN authoritative status write
   *  once both settle — see gradeMcqForSubmission's matching param for the
   *  full reasoning (this was the actual cause of the submissions list
   *  briefly showing "Graded" with only the MCQ score while subjective
   *  grading was still running). Standalone/subjective-only callers leave
   *  this false so this function's own status write still applies. */
  skipStatusUpdate?: boolean;
  /** The paper's layout map (paper_layout_maps row) — used ONLY to derive
   *  which trailing page(s) are the printed answer-key page (see
   *  resolveSentPageIndices below), not for any coordinate/alignment work.
   *  null/absent (a paper with no layout map at all, or the caller didn't
   *  fetch one) just means no page can be safely excluded — every page is
   *  sent, exactly like before this cost-reduction pass. */
  layoutMapRow?: any | null;
  /** The MCQ page index gradeMcqForSubmission's OWN fiducial detection
   *  identified for THIS scan (its `gradedScanIndex`) — orchestrated by
   *  gradeOrchestrator.ts awaiting MCQ grading before starting this
   *  function, specifically so this real, scan-specific evidence is
   *  available here (not a template-position guess). null means no MCQ
   *  page could be identified (MCQ-less paper, or MCQ grading itself
   *  failed) — nothing gets excluded on that basis. */
  mcqGradedScanIndex?: number | null;
}): Promise<GradeSubjectiveResult> {
  const { submissionId, submission, paper, force = false, skipStatusUpdate = false, layoutMapRow = null, mcqGradedScanIndex = null } = params;
  const paperId: string = paper.id;

  const allQuestions = buildSubjectiveQuestions(paper.content);
  if (allQuestions.length === 0) {
    // Not an error — this paper simply has no subjective section (MCQ-only).
    return { ok: true, skipped: true, answerRows: [], subjectiveScore: 0, maxScore: 0, anyNeedsReview: false };
  }

  let questions = allQuestions;
  if (!force) {
    const { data: reviewedRows } = await supabaseAdmin
      .from('submission_answers')
      .select('question_id')
      .eq('submission_id', submissionId)
      .eq('answer_kind', 'subjective')
      .not('reviewed_by', 'is', null);
    const protectedIds = new Set((reviewedRows || []).map(r => r.question_id));
    if (protectedIds.size > 0) {
      questions = allQuestions.filter(q => !protectedIds.has(q.question_id));
      if (questions.length === 0) {
        // Every subjective question was already teacher-reviewed — nothing left to (re)grade.
        return { ok: true, skipped: true, answerRows: [], subjectiveScore: 0, maxScore: 0, anyNeedsReview: false };
      }
    }
  }

  const scanUrls: string[] = Array.isArray(submission.scan_urls) ? submission.scan_urls : [];
  if (scanUrls.length === 0) {
    return { ok: false, error: 'Submission has no scan images', status: 400 };
  }

  // Which ORIGINAL scan_urls indices actually get downloaded/sent — never
  // guessed from layout alone (see the per-branch comments), always
  // falling back to "send everything" (today's behavior, byte-identical)
  // whenever the evidence for excluding a page isn't solid.
  let sentPageIndices = scanUrls.map((_, i) => i);

  // The printed answer-key page (student never writes on it): safe to
  // exclude ONLY when the scan's own page count matches the template's
  // expected count EXACTLY — i.e. the teacher scanned precisely what was
  // printed, template and scan agree 1:1. On any mismatch (missing pages,
  // extra pages, a differently-ordered scan) this doesn't guess; it sends
  // everything, same as before. MCQAnswerKeyPage (PaperLayoutRenderer.tsx)
  // always renders as exactly one trailing `.paper-sheet` whenever the
  // paper has any MCQ bubbles, and page_count (already captured at layout-
  // map time) counts it — so the student-facing count is simply
  // page_count minus one in that case.
  if (layoutMapRow?.page_count != null && scanUrls.length === layoutMapRow.page_count) {
    const hasAnswerKeyPage = (layoutMapRow.mcq_bubbles?.length ?? 0) > 0;
    const studentPageCount = layoutMapRow.page_count - (hasAnswerKeyPage ? 1 : 0);
    if (hasAnswerKeyPage && studentPageCount >= 0) {
      sentPageIndices = sentPageIndices.filter(i => i < studentPageCount);
    }
  }

  // The MCQ bubble-sheet page: excluding EXACTLY the page real fiducial
  // detection locked onto for THIS scan (not a layout/ordering guess) is
  // safe because it's evidence about this specific submission, not an
  // assumption about page order.
  if (mcqGradedScanIndex != null) {
    sentPageIndices = sentPageIndices.filter(i => i !== mcqGradedScanIndex);
  }

  // Safety backstop: if both exclusions together would remove every page
  // (a layout this pass didn't fully characterize — e.g. a "combined"
  // layout that might interleave MCQ and subjective content on the same
  // physical page, which I could not fully rule out — see the cost-round
  // plan's own caveat), never send zero images. Fall back to everything.
  if (sentPageIndices.length === 0) sentPageIndices = scanUrls.map((_, i) => i);

  if (sentPageIndices.length < scanUrls.length) {
    console.log(`[GRADE-DEBUG] submission=${submissionId} sending ${sentPageIndices.length}/${scanUrls.length} pages to Claude (excluded: ${scanUrls.map((_, i) => i).filter(i => !sentPageIndices.includes(i)).join(',')})`);
  }

  const pages: PageResolver = {
    toOriginalPageIndex: sentIndex => (sentIndex >= 0 && sentIndex < sentPageIndices.length ? sentPageIndices[sentIndex] : null),
    resolveCropUrl: sentIndex => {
      const original = sentIndex >= 0 && sentIndex < sentPageIndices.length ? sentPageIndices[sentIndex] : null;
      return original != null && original < scanUrls.length ? scanUrls[original] : null;
    },
  };

  let images: ClaudeImageInput[];
  try {
    const buffers = await Promise.all(sentPageIndices.map(i => downloadScan(scanUrls[i])));
    // Always re-encoded server-side regardless of whether the client
    // already downscaled on upload — see prepareImageForClaude.ts's own
    // doc comment for why relying on the client alone isn't a safe enough
    // guarantee. Anthropic downscales past ~1568px anyway, so this never
    // costs the model any information, only upload time and timeout risk.
    const prepared = await Promise.all(buffers.map(buf => prepareImageForClaude(buf)));
    images = prepared.map(buf => ({ mediaType: 'image/jpeg', base64: buf.toString('base64') }));
  } catch (e: unknown) {
    const info = describeClaudeError(e);
    console.error(`Failed to download/prepare scan pages for submission ${submissionId}: ${info.summary}`, e);
    return { ok: false, error: `Failed to download scan pages: ${info.summary}`, errorKind: info.kind, status: 500 };
  }

  const rubrics = await loadRubrics(questions, paperId);

  // Choice groups (attempt-count enforcement) — only enforced when EVERY
  // member of the group is actually in `questions` (i.e. none of them is
  // protected/already-reviewed this pass); a partially-protected group
  // just dissolves back into the normal per-question path below rather
  // than risk mis-selecting "first N" from an incomplete set.
  const rawGroups = resolveChoiceGroups(paper.content);
  const activeGroups = rawGroups.filter(g => g.units.flat().every(id => questions.some(q => q.question_id === id)));
  const groupedQuestionIds = new Set(activeGroups.flatMap(g => g.units.flat()));
  const ungroupedQuestions = questions.filter(q => !groupedQuestionIds.has(q.question_id));
  const questionsById = new Map(questions.map(q => [q.question_id, q]));

  const policy: 'first_n' | 'grade_all_best_n' = paper.settings?.excessAttemptPolicy === 'grade_all_best_n' ? 'grade_all_best_n' : 'first_n';

  // Every candidate that needs a real grade: ungrouped questions PLUS
  // EVERY unit in every choice group — no pre-filter call anymore. The one
  // batch call below reports is_blank/final_marks per question, real
  // signal read straight off the actual grading pass instead of a
  // separate cheap probe's guess (removed: detectAttempted used to run
  // one extra full image-bearing call per group before this). This is
  // simultaneously cheaper (one fewer image-send) and more accurate.
  const groupUnitQuestionLists = new Map<ChoiceGroup, SubjectiveQuestion[][]>();
  for (const group of activeGroups) {
    groupUnitQuestionLists.set(group, group.units.map(ids => ids.map(id => questionsById.get(id)).filter((q): q is SubjectiveQuestion => Boolean(q))));
  }
  const allToGrade = [
    ...ungroupedQuestions,
    ...activeGroups.flatMap(g => groupUnitQuestionLists.get(g)!.flat()),
  ];
  const { rows: gradedRows, failure: batchFailure } = await gradeQuestionsBatchWithFallback(allToGrade, rubrics, images, submissionId, paperId, pages);
  const gradedByQid = new Map(gradedRows.map(r => [r.question_id, r]));

  // Apply each group's first-N/best-N cap using the real grading results
  // (every unit was graded above — no "did the cheap detector even send
  // this one" bookkeeping needed anymore). See applyChoiceGroupSelection's
  // own doc comment for why this is a separate pure function.
  const groupRows: SubjectiveAnswerRow[] = [];
  for (const group of activeGroups) {
    groupRows.push(...applyChoiceGroupSelection(group, groupUnitQuestionLists.get(group)!, gradedByQid, policy));
  }

  const ungroupedRows = ungroupedQuestions.map(q => gradedByQid.get(q.question_id)!);
  const answerRows = [...ungroupedRows, ...groupRows];

  if (activeGroups.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[GRADE-DEBUG] attempt-enforcement submission=${submissionId} policy=${policy} groups=${activeGroups.length} totalGraded=${allToGrade.length}`);
  }

  // Without force, only non-reviewed existing subjective rows are cleared
  // — reviewed rows for OTHER questions are left in place and never
  // re-inserted (answerRows above already excludes them).
  let deleteQuery = supabaseAdmin.from('submission_answers').delete().eq('submission_id', submissionId).eq('answer_kind', 'subjective');
  if (!force) deleteQuery = deleteQuery.is('reviewed_by', null);
  await deleteQuery;

  const { error: insertErr } = await supabaseAdmin.from('submission_answers').insert(answerRows);
  if (insertErr) return { ok: false, error: insertErr.message, status: 500 };

  const { subjectiveScore, maxScore, anyNeedsReview } = recomputeSubmissionTotals(answerRows as any);

  // Provisional — final when subjective is the only section graded;
  // superseded by the orchestrator's combined recompute otherwise. (Under
  // Promise.allSettled, this and gradeMcqForSubmission's own provisional
  // update can race and each read a stale snapshot of the OTHER kind's
  // score from the `submission` closure — harmless, since the orchestrator
  // always overwrites both with an authoritative recompute within
  // moments of both settling.) `status` is omitted when skipStatusUpdate
  // is set — see the param's own doc comment: only the orchestrator's own
  // final update may move the row out of 'processing' in that case.
  //
  // Wrapped in its own try/catch (not left to propagate) — grading itself
  // already succeeded by this point (answerRows are inserted); a transient
  // Supabase network blip on this specific write shouldn't turn an
  // otherwise-successful grade into a rejected promise. The orchestrator's
  // own final combined update is authoritative regardless, so a failure
  // here just means this provisional snapshot is stale for a few moments,
  // never a lost grade.
  try {
    await supabaseAdmin
      .from('submissions')
      .update({
        subjective_score: subjectiveScore,
        total_score: (submission.mcq_score ?? 0) + subjectiveScore,
        ...(skipStatusUpdate ? {} : { status: anyNeedsReview ? 'in_review' : 'graded' }),
        processing_error: null,
      })
      .eq('id', submissionId);
  } catch (e: unknown) {
    console.error(`Provisional subjective-score update failed for submission ${submissionId} (grading itself succeeded): ${describeClaudeError(e).summary}`, e);
  }

  // batchFailure is only surfaced when it actually left something needing
  // review — a batch hiccup the per-question fallback fully recovered from
  // isn't worth alarming a teacher about after the fact.
  return {
    ok: true, answerRows, subjectiveScore, maxScore, anyNeedsReview,
    ...(batchFailure && anyNeedsReview ? { error: batchFailure.summary, errorKind: batchFailure.kind } : {}),
  };
}

export interface FinalizedTotals {
  mcqScore: number;
  subjectiveScore: number;
  totalScore: number;
  maxScore: number;
  anyNeedsReview: boolean;
  /** Only present when `currentSectionStatus` was passed in — the freshly
   *  recomputed mcq_status/subjective_status for the caller to persist.
   *  Absent (not just undefined-valued) for the grade-time caller
   *  (gradeOrchestrator.ts), which derives these from the live grading
   *  result instead of re-deriving them from rows that were JUST written
   *  by that same grading pass. */
  mcqStatus?: SectionStatus;
  subjectiveStatus?: SectionStatus;
  /** Always present — the one marks-side (see decideSubjectiveMarksSide)
   *  every caller must persist to submissions.subjective_marks_side so the
   *  PDF and the review overlay never compute it independently. */
  subjectiveMarksSide: MarksSide;
}

/** The single authoritative place a submission's stored totals get
 *  computed from: numerators (mcqScore/subjectiveScore) come from summing
 *  actual submission_answers rows (via recomputeSubmissionTotals, which
 *  already excludes EXCESS_ATTEMPT rows); the denominator (maxScore) is
 *  the paper's own FIXED total (computePaperMaxScore), never derived from
 *  rows — so it never shrinks just because a student attempted fewer
 *  choice questions than the required N. totalScore is clamped to
 *  maxScore as a hard backstop: a student's score must never exceed the
 *  paper's declared total, regardless of any edge case in how the
 *  numerator was computed.
 *
 *  Used by every place that writes submissions.max_score/total_score
 *  after the initial grade (grade orchestrator, answer overrides,
 *  promote-excess, recapture) so they can never drift back to a
 *  row-summed denominator.
 *
 *  `currentSectionStatus`, when passed, makes this ALSO the authoritative
 *  place mcq_status/subjective_status get recomputed — this is the fix for
 *  the Finalize button staying disabled forever: those two columns used to
 *  only ever get written once, at grade time, and every override/recapture
 *  route recomputed totals here without ever re-deriving them. Every
 *  affected call site already calls this function, so extending it (rather
 *  than adding a second, parallel recompute path) means there's no way for
 *  totals and statuses to drift out of sync with each other again. */
export async function finalizeSubmissionTotals(
  submissionId: string,
  paperContent: any,
  currentSectionStatus?: { mcqStatus: SectionStatus | null; subjectiveStatus: SectionStatus | null; mcqError: string | null; subjectiveError: string | null },
): Promise<FinalizedTotals> {
  const { data: allAnswers } = await supabaseAdmin
    .from('submission_answers')
    .select('answer_kind, max_marks, needs_review, override_option, detected_option, correct_option, final_marks, teacher_note, transcription_lang')
    .eq('submission_id', submissionId);

  const rowTotals = recomputeSubmissionTotals(allAnswers || []);
  const paperMax = computePaperMaxScore(paperContent);
  const totalScore = Math.min(rowTotals.mcqScore + rowTotals.subjectiveScore, paperMax.totalMax);
  const subjectiveMarksSide = decideSubjectiveMarksSide(paperContent, allAnswers || []);

  let mcqStatus: SectionStatus | undefined;
  let subjectiveStatus: SectionStatus | undefined;
  if (currentSectionStatus) {
    const rows = allAnswers || [];
    const mcqRows = rows.filter(r => r.answer_kind === 'mcq');
    const subjectiveRows = rows.filter(r => r.answer_kind === 'subjective');
    mcqStatus = recomputeSectionStatus(mcqRows, currentSectionStatus.mcqStatus, Boolean(currentSectionStatus.mcqError));
    subjectiveStatus = recomputeSectionStatus(subjectiveRows, currentSectionStatus.subjectiveStatus, Boolean(currentSectionStatus.subjectiveError));
  }

  return {
    mcqScore: rowTotals.mcqScore,
    subjectiveScore: rowTotals.subjectiveScore,
    totalScore,
    maxScore: paperMax.totalMax,
    anyNeedsReview: rowTotals.anyNeedsReview,
    subjectiveMarksSide,
    ...(mcqStatus !== undefined ? { mcqStatus } : {}),
    ...(subjectiveStatus !== undefined ? { subjectiveStatus } : {}),
  };
}

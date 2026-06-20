// src/lib/paperQuestionBuckets.ts
//
// Single source of truth for classifying question `type` values into
// short / long / mcq buckets. Used by PaperLayoutRenderer (to split
// questions across paper-builder layouts like four_papers) and by
// QuestionSelectorModal (to enforce per-layout question caps at add time).
//
// If a new question_type is ever added to the DB enum, add it to one of
// the sets below — both files pick it up automatically via getBucket().

export const SHORT_BUCKET_TYPES = new Set<string>([
  'short',
  'idiom_phrases',
  'poetry_explanation',
  'sentence_correction',
  'sentence_completion',
  'directInDirect',
  'activePassive',
    'gazal',
]);

export const LONG_BUCKET_TYPES = new Set<string>([
  'long',
  'translate_urdu',
  'translate_english',
  'prose_explanation',
  'darkhwast_khat',
  'kahani_makalma',
  'passage',

  'summary',
  'Nasarkhulasa_markziKhyal',
]);

export type QuestionBucket = 'short' | 'long' | 'mcq' | 'other';

/**
 * Classifies a raw question `type` string into one of:
 * - 'mcq'   exact match on 'mcq'
 * - 'short' anything in SHORT_BUCKET_TYPES
 * - 'long'  anything in LONG_BUCKET_TYPES
 * - 'other' anything not recognized above
 *
 * NOTE: matching is case-sensitive and matches the exact casing used in
 * the DB enum (e.g. 'directInDirect', 'activePassive'). If stored values
 * are ever inconsistent in casing, normalize on both sides before calling.
 */
export const getBucket = (type: string): QuestionBucket => {
  if (type === 'mcq') return 'mcq';
  if (SHORT_BUCKET_TYPES.has(type)) return 'short';
  if (LONG_BUCKET_TYPES.has(type)) return 'long';
  return 'other';
};

// Caps used specifically by the four_papers layout (7 short / 5 long,
// combined across all bucketed types — not per individual type).
export const FOUR_PAPERS_SHORT_CAP = 7;
export const FOUR_PAPERS_LONG_CAP = 5;
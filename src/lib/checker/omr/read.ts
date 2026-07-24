// Deterministic MCQ bubble reading — pure image processing, never an LLM.
// Examly generates its own bubble sheets, so every bubble's TRUE template
// position is already known (BubbleLayoutV3.bubbles) — grading only ever
// needs to find where that known layout landed on a scanned photo (align.ts)
// and measure ink at each known point, never guess where a bubble might be.
import { GrayImage, sampleDarkness } from '@/lib/checker/imaging';
import { Alignment } from '@/lib/checker/omr/align';
import { BubbleOption, DetectedOption, TemplateBubble } from '@/types/checker';

// Named, documented thresholds — tune against real scans here, in one
// place, rather than as inline magic numbers.
/** Below this normalized darkness (0=white, 1=solid black), a bubble is
 *  considered unmarked. */
export const FILL_THRESHOLD = 0.22;
/** If the second-darkest option's darkness is still this fraction of the
 *  top option's, treat the question as ambiguously multi-marked rather
 *  than trusting the darker one. */
export const AMBIGUOUS_RATIO = 0.75;
/** Below this confidence (however it was derived — floor margin or
 *  ambiguity margin), the row needs a human look regardless of which
 *  option was picked. Shared with gradeSubjective.ts's own confidence
 *  convention so both grading engines agree on one meaning for "low
 *  confidence." */
export const LOW_CONFIDENCE = 0.4;

const OPTIONS: BubbleOption[] = ['A', 'B', 'C', 'D'];

export interface BubbleReading {
  q: number;
  question_id: string;
  detected_option: DetectedOption;
  fill_confidence: number;
  /** Per-option sampled darkness + the scan-pixel position/radius it was
   *  sampled at — everything the review UI's overlay and the debug
   *  composite need, computed once here rather than recomputed later. */
  options: Record<BubbleOption, { darkness: number; cx: number; cy: number; r: number }>;
}

/** The core decision table, pulled out as its own pure function so it can
 *  be unit-tested directly against synthetic darkness values without any
 *  image/homography machinery. */
export function decideBubble(darkness: Record<BubbleOption, number>): { option: DetectedOption; confidence: number } {
  const sorted = OPTIONS.map(opt => ({ opt, darkness: darkness[opt] })).sort((a, b) => b.darkness - a.darkness);
  const [top, second] = sorted;

  if (top.darkness < FILL_THRESHOLD) {
    return { option: 'BLANK', confidence: 0 };
  }
  if (second.darkness >= FILL_THRESHOLD && second.darkness / top.darkness > AMBIGUOUS_RATIO) {
    return { option: 'MULTIPLE', confidence: 1 - second.darkness / top.darkness };
  }
  return { option: top.opt, confidence: 1 - second.darkness / top.darkness };
}

/** Reads every bubble in `bubbles` against `gray` using `alignment` to map
 *  each one's known template position onto this specific scan's pixels. */
export function readBubbles(gray: GrayImage, alignment: Alignment, bubbles: TemplateBubble[]): BubbleReading[] {
  const byQuestion = new Map<number, { question_id: string; options: Partial<Record<BubbleOption, TemplateBubble>> }>();
  for (const b of bubbles) {
    let entry = byQuestion.get(b.q);
    if (!entry) {
      entry = { question_id: b.question_id, options: {} };
      byQuestion.set(b.q, entry);
    }
    entry.options[b.option] = b;
  }

  const readings: BubbleReading[] = [];
  for (const [q, { question_id, options }] of byQuestion) {
    if (!options.A || !options.B || !options.C || !options.D) continue; // incomplete row — shouldn't happen with a valid layout, skip defensively

    const sampled = {} as BubbleReading['options'];
    const darkness = {} as Record<BubbleOption, number>;
    for (const opt of OPTIONS) {
      const bubble = options[opt]!;
      const px = alignment.transformPoint({ x: bubble.x, y: bubble.y });
      const r = alignment.localScale({ x: bubble.x, y: bubble.y }) * bubble.r;
      const d = sampleDarkness(gray, px.x, px.y, r);
      sampled[opt] = { darkness: d, cx: px.x, cy: px.y, r };
      darkness[opt] = d;
    }

    const { option, confidence } = decideBubble(darkness);
    readings.push({ q, question_id, detected_option: option, fill_confidence: confidence, options: sampled });
  }

  return readings.sort((a, b) => a.q - b.q);
}

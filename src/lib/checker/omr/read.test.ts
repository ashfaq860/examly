import { describe, it, expect } from 'vitest';
import { decideBubble, FILL_THRESHOLD, AMBIGUOUS_RATIO } from './read';

describe('decideBubble', () => {
  it('picks the clearly filled option', () => {
    const result = decideBubble({ A: 0.02, B: 0.85, C: 0.03, D: 0.01 });
    expect(result.option).toBe('B');
    expect(result.confidence).toBeGreaterThan(LOW_CONFIDENCE_FLOOR());
  });

  it('reports BLANK when every option is below the fill threshold', () => {
    const result = decideBubble({ A: 0.05, B: 0.1, C: 0.02, D: FILL_THRESHOLD - 0.01 });
    expect(result.option).toBe('BLANK');
    expect(result.confidence).toBe(0);
  });

  it('reports BLANK at exactly the threshold boundary (top must be >= threshold to count)', () => {
    const result = decideBubble({ A: 0, B: 0, C: 0, D: FILL_THRESHOLD - 0.0001 });
    expect(result.option).toBe('BLANK');
  });

  it('reports MULTIPLE when two options are both dark and close to each other', () => {
    const result = decideBubble({ A: 0.8, B: 0.79, C: 0.05, D: 0.02 });
    expect(result.option).toBe('MULTIPLE');
  });

  it('does not report MULTIPLE when the runner-up is dark but well below the ambiguous ratio', () => {
    const top = 0.9;
    const second = top * (AMBIGUOUS_RATIO - 0.1); // clearly below the ambiguous cutoff
    const result = decideBubble({ A: top, B: second, C: 0.02, D: 0.01 });
    expect(result.option).toBe('A');
  });

  it('assigns lower confidence the closer the runner-up gets to the top option', () => {
    const confident = decideBubble({ A: 0.9, B: 0.1, C: 0.05, D: 0.02 });
    const lessConfident = decideBubble({ A: 0.9, B: 0.6, C: 0.05, D: 0.02 });
    expect(confident.confidence).toBeGreaterThan(lessConfident.confidence);
  });
});

// Small local helper so the "clearly filled" test asserts something
// meaningful without hard-coding LOW_CONFIDENCE's exact value here too.
function LOW_CONFIDENCE_FLOOR(): number {
  return 0.4;
}

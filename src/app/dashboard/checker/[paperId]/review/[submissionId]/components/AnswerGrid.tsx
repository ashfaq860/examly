// One row per MCQ question. Only rows the system actually flagged
// (needs_review) are interactive — the teacher shouldn't have to open and
// re-check every confidently auto-graded question, just the ones the CV
// itself wasn't sure about. Flagged rows sort to the top, stand out
// visually, and are the only ones with a tap-to-override picker; resolved/
// confident rows render as plain read-only summaries.
'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SubmissionAnswerRow, BubbleOption } from '@/types/checker';

const OPTIONS: (BubbleOption | 'BLANK')[] = ['A', 'B', 'C', 'D', 'BLANK'];

export function AnswerGrid({
  answers,
  finalized,
  overridingId,
  onOverride,
}: {
  answers: SubmissionAnswerRow[];
  finalized: boolean;
  overridingId: string | null;
  onOverride: (answerId: string, option: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...answers].sort((a, b) => {
    if (a.needs_review !== b.needs_review) return a.needs_review ? -1 : 1;
    return Number(a.q_number) - Number(b.q_number);
  });

  return (
    <div className="chk-ag">
      {sorted.map(a => {
        const effective = a.override_option ?? a.detected_option;
        const isCorrect = effective != null && effective === a.correct_option;
        const isExpanded = expandedId === a.id;
        const reviewable = a.needs_review && !finalized;

        const rowContent = (
          <>
            <span className="chk-ag-qnum chk-mono">Q{a.q_number}</span>
            <span className="chk-ag-detected">
              Detected: <strong>{a.detected_option}</strong>
              {a.override_option && <span className="chk-ag-override"> → {a.override_option}</span>}
            </span>
            <span className="chk-ag-correct">Correct: <strong>{a.correct_option || '—'}</strong></span>
            <span className="chk-ag-conf chk-mono">{Math.round((a.fill_confidence || 0) * 100)}%</span>
            <span className={`chk-ag-marks ${isCorrect ? 'chk-ag-marks-ok' : 'chk-ag-marks-bad'}`}>
              {isCorrect ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {a.final_marks ?? 0}/{a.max_marks}
            </span>
          </>
        );

        return (
          <div key={a.id} className={`chk-ag-row ${a.needs_review ? 'chk-ag-row-flag' : ''}`}>
            {reviewable ? (
              <button
                type="button"
                className="chk-ag-row-main"
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
              >
                {rowContent}
              </button>
            ) : (
              <div className="chk-ag-row-main chk-ag-row-static">{rowContent}</div>
            )}

            {reviewable && isExpanded && (
              <>
                {a.bubble_overlay && (
                  <div className="chk-ag-darkness chk-mono">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => (
                      <span key={opt} className={effective === opt ? 'chk-ag-darkness-top' : ''}>
                        {opt} {Math.round((a.bubble_overlay![opt]?.darkness || 0) * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                <div className="chk-ag-picker">
                  {OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      className={`chk-ag-pick ${effective === opt ? 'chk-ag-pick-active' : ''}`}
                      disabled={overridingId === a.id}
                      onClick={() => { onOverride(a.id, opt); setExpandedId(null); }}
                    >
                      {opt === 'BLANK' ? 'Blank' : opt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      <style jsx>{`
        .chk-ag { display: flex; flex-direction: column; gap: 6px; }
        .chk-ag-row { border: 1px solid var(--chk-border); border-radius: var(--chk-radius-md); overflow: hidden; }
        .chk-ag-row-flag { border-color: var(--chk-amber); background: var(--chk-amber-soft); }
        .chk-ag-row-main {
          width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 0.6rem 0.8rem; background: none; border: none; text-align: left; cursor: pointer; font: inherit; color: inherit;
        }
        .chk-ag-row-static { cursor: default; opacity: 0.85; }
        .chk-ag-qnum { font-weight: 700; color: var(--chk-navy); min-width: 2.5rem; }
        .chk-ag-detected, .chk-ag-correct { font-size: 0.82rem; color: var(--chk-muted); }
        .chk-ag-override { color: var(--chk-accent); font-weight: 700; }
        .chk-ag-conf { font-size: 0.78rem; color: var(--chk-muted); margin-left: auto; }
        .chk-ag-marks { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 0.82rem; }
        .chk-ag-marks-ok { color: var(--chk-green); }
        .chk-ag-marks-bad { color: var(--chk-danger); }
        .chk-ag-darkness {
          display: flex; gap: 10px; padding: 0 0.8rem 0.4rem; font-size: 0.76rem; color: var(--chk-muted);
        }
        .chk-ag-darkness-top { color: var(--chk-accent); font-weight: 700; }
        .chk-ag-picker { display: flex; gap: 6px; padding: 0 0.8rem 0.7rem; flex-wrap: wrap; }
        .chk-ag-pick {
          padding: 0.4rem 0.8rem; border-radius: var(--chk-radius-sm); border: 1px solid var(--chk-border);
          background: var(--chk-surface); font-weight: 700; font-size: 0.82rem; cursor: pointer;
        }
        .chk-ag-pick-active { background: var(--chk-accent); border-color: var(--chk-accent); color: #fff; }
      `}</style>
    </div>
  );
}

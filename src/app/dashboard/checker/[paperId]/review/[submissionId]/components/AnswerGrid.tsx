// One row per question (MCQ or subjective). Only rows the system actually
// flagged (needs_review) are interactive — the teacher shouldn't have to
// open and re-check every confidently auto-graded question, just the ones
// grading itself wasn't sure about. Flagged rows sort to the top, stand out
// visually, and are the only ones with a tap-to-override control; resolved/
// confident rows render as plain read-only summaries.
//
// MCQ rows keep the existing A/B/C/D/Blank picker (override_option). There
// is no "correct option" concept for a subjective free-form answer, so
// those rows show the AI's transcription/justification/rubric breakdown
// instead, plus a direct marks-override number input and a "Retake this
// answer" camera button (the per-question escape hatch for a blurry photo
// — see the review page's recapture handler).
'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Camera } from 'lucide-react';
import { SubmissionAnswerRow, BubbleOption, SectionOutcome } from '@/types/checker';
import { REASON_CODES } from '@/lib/checker/annotate/symbols';

const OPTIONS: (BubbleOption | 'BLANK')[] = ['A', 'B', 'C', 'D', 'BLANK'];

export type AnswerOverridePayload = { override_option: string } | { final_marks: number } | { promote_excess: true };

/** A billing failure (API credits exhausted) gets a distinct, actionable
 *  headline instead of the raw Anthropic error JSON — the raw message
 *  stays visible underneath for anyone who wants the detail, same as
 *  every other section-error case. */
function SectionErrorBanner({ label, outcome }: { label: string; outcome: SectionOutcome }) {
  const isBilling = outcome.errorKind === 'billing';
  return (
    <div className="chk-ag-section-banner">
      <AlertTriangle size={14} />
      {isBilling ? (
        <span>AI grading unavailable — API credits exhausted <span className="chk-ag-section-banner-detail">({outcome.error})</span></span>
      ) : (
        <span>{label} section could not be graded — {outcome.error}</span>
      )}
    </div>
  );
}

export function AnswerGrid({
  answers,
  finalized,
  overridingId,
  onOverride,
  onRetake,
  mcqOutcome,
  subjectiveOutcome,
  selectedAnswerId,
  onSelect,
}: {
  answers: SubmissionAnswerRow[];
  finalized: boolean;
  overridingId: string | null;
  onOverride: (answerId: string, payload: AnswerOverridePayload) => void;
  onRetake: (answerId: string) => void;
  /** When a section's own grading failed outright (no rows exist for it
   *  despite the paper declaring one), the answer list itself has nothing
   *  to show for it — this banner is the only place that failure is
   *  visible, distinct from the per-row needs_review styling below which
   *  only covers sections that DID grade. */
  mcqOutcome?: SectionOutcome;
  subjectiveOutcome?: SectionOutcome;
  /** Every row is clickable to jump the scan viewer to its page and
   *  highlight its mark — reviewable rows already use their click to
   *  expand, so that same tap also selects; read-only rows had no click
   *  behavior before and now use theirs purely to select. */
  selectedAnswerId?: string | null;
  onSelect?: (answerId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [marksDraft, setMarksDraft] = useState('');
  const [confirmPromoteId, setConfirmPromoteId] = useState<string | null>(null);

  const sorted = [...answers].sort((a, b) => {
    if (a.needs_review !== b.needs_review) return a.needs_review ? -1 : 1;
    return Number(a.q_number) - Number(b.q_number);
  });

  // Every MCQ row reading BLANK is possible (a student really can skip the
  // whole section) but is at least as often a sign the registration-square
  // alignment was off for this particular scan (see imaging.ts's
  // detectSquareBlobs) — sampling landed on blank paper near, not on, the
  // real ink. mcqOutcome.error only covers an outright detection failure;
  // this covers the quieter case where detection nominally "succeeded" but
  // every single bubble still came back unmarked, which is unusual enough
  // to be worth calling out rather than leaving as 10 individually-amber
  // rows with no explanation.
  const mcqRows = answers.filter(a => a.answer_kind === 'mcq');
  const allMcqBlank = mcqRows.length > 0 && mcqRows.every(a => a.detected_option === 'BLANK');

  const toggleExpand = (a: SubmissionAnswerRow) => {
    onSelect?.(a.id);
    if (expandedId === a.id) { setExpandedId(null); setConfirmPromoteId(null); return; }
    setExpandedId(a.id);
    setConfirmPromoteId(null);
    if (a.answer_kind === 'subjective') setMarksDraft(String(a.final_marks ?? a.ai_marks ?? 0));
  };

  return (
    <div className="chk-ag">
      {mcqOutcome?.error && <SectionErrorBanner label="MCQ" outcome={mcqOutcome} />}
      {subjectiveOutcome?.error && <SectionErrorBanner label="Subjective" outcome={subjectiveOutcome} />}
      {!mcqOutcome?.error && allMcqBlank && (
        <div className="chk-ag-section-banner chk-ag-section-banner-warn">
          <AlertTriangle size={14} /> Every MCQ bubble on this scan read as unmarked — if the student did fill them in,
          this usually means the scan alignment was off. Try Retry/Regrade with a clearer, well-lit photo before
          trusting these as real blanks.
        </div>
      )}
      {sorted.map(a => {
        const isExcess = a.answer_kind === 'subjective' && a.teacher_note === 'EXCESS_ATTEMPT';
        // Excess rows are always tappable (to offer the promote action)
        // even though needs_review is false for them — everything else
        // keeps the "only flagged rows are interactive" rule.
        const reviewable = (a.needs_review || isExcess) && !finalized;
        const isExpanded = expandedId === a.id;

        if (a.answer_kind === 'subjective') {
          if (isExcess) {
            const rowContent = (
              <>
                <span className="chk-ag-qnum chk-mono">Q{a.q_number}</span>
                <span className="chk-ag-excess-badge">Not marked — beyond required N</span>
                <span className="chk-ag-marks chk-ag-marks-neutral">{a.max_marks} max</span>
              </>
            );
            return (
              <div key={a.id} className={`chk-ag-row chk-ag-row-excess ${a.id === selectedAnswerId ? 'chk-ag-row-selected' : ''}`}>
                {reviewable ? (
                  <button type="button" className="chk-ag-row-main" onClick={() => toggleExpand(a)}>{rowContent}</button>
                ) : (
                  <button type="button" className="chk-ag-row-main chk-ag-row-static" onClick={() => onSelect?.(a.id)}>{rowContent}</button>
                )}
                {reviewable && isExpanded && (
                  <div className="chk-ag-subjective">
                    {confirmPromoteId === a.id ? (
                      <div className="chk-ag-confirm">
                        <p className="chk-ag-confirm-text">
                          This will grade this answer and demote the last-counted answer in this
                          section back to not-marked, keeping the required number counted. Continue?
                        </p>
                        <div className="chk-ag-marks-row">
                          <button
                            type="button"
                            className="chk-ag-save-btn"
                            disabled={overridingId === a.id}
                            onClick={() => { onOverride(a.id, { promote_excess: true }); setExpandedId(null); setConfirmPromoteId(null); }}
                          >
                            Confirm swap
                          </button>
                          <button type="button" className="chk-ag-retake-btn" onClick={() => setConfirmPromoteId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="chk-ag-save-btn" onClick={() => setConfirmPromoteId(a.id)}>
                        Grade this answer instead
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const isBlank = a.detected_option === 'BLANK';
          const marksOk = !a.needs_review;

          const rowContent = (
            <>
              <span className="chk-ag-qnum chk-mono">Q{a.q_number}</span>
              <span className="chk-ag-detected">
                {isBlank ? 'Blank' : (a.transcription ? `"${a.transcription.slice(0, 60)}${a.transcription.length > 60 ? '…' : ''}"` : (a.teacher_note || 'Ungraded'))}
              </span>
              <span className="chk-ag-conf chk-mono">{a.ai_confidence != null ? `${Math.round(a.ai_confidence * 100)}%` : '—'}</span>
              <span className={`chk-ag-marks ${marksOk ? 'chk-ag-marks-ok' : 'chk-ag-marks-bad'}`}>
                {marksOk ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {a.final_marks ?? 0}/{a.max_marks}
              </span>
            </>
          );

          return (
            <div key={a.id} className={`chk-ag-row ${a.needs_review ? 'chk-ag-row-flag' : ''} ${a.id === selectedAnswerId ? 'chk-ag-row-selected' : ''}`}>
              {reviewable ? (
                <button type="button" className="chk-ag-row-main" onClick={() => toggleExpand(a)}>{rowContent}</button>
              ) : (
                <button type="button" className="chk-ag-row-main chk-ag-row-static" onClick={() => onSelect?.(a.id)}>{rowContent}</button>
              )}

              {reviewable && isExpanded && (
                <div className="chk-ag-subjective">
                  {a.teacher_note && <p className="chk-ag-note"><AlertTriangle size={13} /> {a.teacher_note}</p>}
                  {a.transcription && <p className="chk-ag-transcription">"{a.transcription}"</p>}
                  {(a.reason_codes || []).filter(c => REASON_CODES[c]).length > 0 && (
                    <p className="chk-ag-reason-code">
                      {(a.reason_codes || []).filter(c => REASON_CODES[c]).map(c => `${c} = ${REASON_CODES[c]}`).join(' · ')}
                    </p>
                  )}
                  {a.ai_justification && <p className="chk-ag-justification">{a.ai_justification}</p>}
                  {a.rubric_scores?.criteria && a.rubric_scores.criteria.length > 0 && (
                    <ul className="chk-ag-rubric">
                      {a.rubric_scores.criteria.map((c, i) => (
                        <li key={i}><span>{c.point}</span><span className="chk-mono">{c.marks_awarded}/{c.max_marks}</span></li>
                      ))}
                    </ul>
                  )}
                  {a.rubric_scores?.mistakes && a.rubric_scores.mistakes.length > 0 && (
                    <ul className="chk-ag-mistakes">
                      {a.rubric_scores.mistakes.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}

                  <div className="chk-ag-marks-row">
                    <input
                      type="number" min={0} max={a.max_marks} step="0.5"
                      value={marksDraft}
                      onChange={e => setMarksDraft(e.target.value)}
                      className="chk-ag-marks-input"
                    />
                    <span className="chk-mono">/ {a.max_marks}</span>
                    <button
                      type="button"
                      className="chk-ag-save-btn"
                      disabled={overridingId === a.id}
                      onClick={() => { onOverride(a.id, { final_marks: Number(marksDraft) }); setExpandedId(null); }}
                    >
                      Save
                    </button>
                    <button type="button" className="chk-ag-retake-btn" onClick={() => onRetake(a.id)}>
                      <Camera size={13} /> Retake
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }

        const effective = a.override_option ?? a.detected_option;
        const isCorrect = effective != null && effective === a.correct_option;

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
          <div key={a.id} className={`chk-ag-row ${a.needs_review ? 'chk-ag-row-flag' : ''} ${a.id === selectedAnswerId ? 'chk-ag-row-selected' : ''}`}>
            {reviewable ? (
              <button
                type="button"
                className="chk-ag-row-main"
                onClick={() => toggleExpand(a)}
              >
                {rowContent}
              </button>
            ) : (
              <button type="button" className="chk-ag-row-main chk-ag-row-static" onClick={() => onSelect?.(a.id)}>
                {rowContent}
              </button>
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
                      onClick={() => { onOverride(a.id, { override_option: opt }); setExpandedId(null); }}
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
        .chk-ag-section-banner {
          display: flex; align-items: center; gap: 6px; padding: 0.6rem 0.8rem; border-radius: var(--chk-radius-md);
          background: var(--chk-danger-soft); color: var(--chk-danger); font-size: 0.82rem; font-weight: 600;
        }
        .chk-ag-section-banner-warn { background: var(--chk-amber-soft); color: var(--chk-amber); }
        .chk-ag-section-banner-detail { font-weight: 400; opacity: 0.85; }
        .chk-ag-row { border: 1px solid var(--chk-border); border-radius: var(--chk-radius-md); overflow: hidden; }
        .chk-ag-row-flag { border-color: var(--chk-amber); background: var(--chk-amber-soft); }
        .chk-ag-row-selected { outline: 2px solid var(--chk-accent); outline-offset: -1px; }
        .chk-ag-row-main {
          width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 0.6rem 0.8rem; background: none; border: none; text-align: left; cursor: pointer; font: inherit; color: inherit;
        }
        .chk-ag-row-static { opacity: 0.85; }
        .chk-ag-qnum { font-weight: 700; color: var(--chk-navy); min-width: 2.5rem; }
        .chk-ag-detected, .chk-ag-correct { font-size: 0.82rem; color: var(--chk-muted); }
        .chk-ag-override { color: var(--chk-accent); font-weight: 700; }
        .chk-ag-conf { font-size: 0.78rem; color: var(--chk-muted); margin-left: auto; }
        .chk-ag-marks { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 0.82rem; }
        .chk-ag-marks-ok { color: var(--chk-green); }
        .chk-ag-marks-bad { color: var(--chk-danger); }
        .chk-ag-marks-neutral { color: var(--chk-muted); font-weight: 600; }
        .chk-ag-row-excess { background: var(--chk-bg); }
        .chk-ag-excess-badge {
          font-size: 0.78rem; color: var(--chk-muted); font-weight: 600; font-style: italic;
        }
        .chk-ag-confirm { display: flex; flex-direction: column; gap: 6px; }
        .chk-ag-confirm-text { margin: 0; font-size: 0.78rem; color: var(--chk-muted); }
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

        .chk-ag-subjective { padding: 0 0.8rem 0.8rem; display: flex; flex-direction: column; gap: 6px; }
        .chk-ag-note { display: flex; align-items: center; gap: 5px; color: var(--chk-danger); font-size: 0.78rem; margin: 0; font-weight: 600; }
        .chk-ag-transcription { margin: 0; font-size: 0.83rem; color: var(--chk-text); font-style: italic; }
        .chk-ag-reason-code {
          display: inline-flex; align-self: flex-start; margin: 0; padding: 2px 8px; border-radius: 999px;
          background: var(--chk-danger-soft); color: var(--chk-danger); font-size: 0.72rem; font-weight: 700;
        }
        .chk-ag-justification { margin: 0; font-size: 0.8rem; color: var(--chk-muted); }
        .chk-ag-rubric, .chk-ag-mistakes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .chk-ag-rubric li { display: flex; justify-content: space-between; gap: 8px; font-size: 0.78rem; color: var(--chk-muted); }
        .chk-ag-mistakes li { font-size: 0.78rem; color: var(--chk-danger); }
        .chk-ag-mistakes li::before { content: '• '; }
        .chk-ag-marks-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
        .chk-ag-marks-input {
          width: 4.5rem; padding: 0.35rem 0.5rem; border-radius: var(--chk-radius-sm); border: 1px solid var(--chk-border);
          font-size: 0.85rem; font-family: inherit;
        }
        .chk-ag-save-btn, .chk-ag-retake-btn {
          display: inline-flex; align-items: center; gap: 5px; padding: 0.4rem 0.7rem; border-radius: var(--chk-radius-sm);
          border: 1px solid var(--chk-border); background: var(--chk-surface); font-weight: 700; font-size: 0.8rem; cursor: pointer;
        }
        .chk-ag-save-btn { background: var(--chk-accent); border-color: var(--chk-accent); color: #fff; }
      `}</style>
    </div>
  );
}

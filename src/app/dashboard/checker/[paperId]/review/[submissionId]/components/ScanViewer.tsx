// Scanned answer-sheet viewer: pinch/pan/zoom via the Pointer Events API
// (one active pointer = pan, two = pinch-scale; wheel = desktop zoom) and
// plain CSS transforms — no gesture library. Overlay circles are children
// of the same transformed "stage" element as the image, so they pan/zoom
// together for free; each is positioned with plain percentage left/top
// from the answer's stored bubble_overlay fractions (see grade-mcq's
// persistence of these — no CV re-run happens here).
'use client';

import { useEffect, useRef, useState } from 'react';
import { SubmissionAnswerRow, BubbleOption } from '@/types/checker';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const OPTIONS: BubbleOption[] = ['A', 'B', 'C', 'D'];

interface Pt { x: number; y: number }
const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function ScanViewer({ imageUrl, answers }: { imageUrl: string; answers: SubmissionAnswerRow[] }) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  // The viewport used to be a fixed height (52vh) regardless of the image's
  // own aspect ratio — a short/wide image (e.g. a tight crop of just the
  // OMR box) doesn't fill that height, leaving the viewport's own dark
  // background visible as dead space below it. Sizing the viewport to the
  // image's actual aspect ratio (once known, from onLoad) avoids that.
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const lastPinchDist = useRef<number | null>(null);
  const lastPan = useRef<Pt | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastPan.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      lastPinchDist.current = distance(pts[0], pts[1]);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1 && lastPan.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (pointers.current.size === 2 && lastPinchDist.current) {
      const pts = Array.from(pointers.current.values());
      const dist = distance(pts[0], pts[1]);
      const delta = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setTransform(t => ({ ...t, scale: clampScale(t.scale * delta) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastPinchDist.current = null;
    if (pointers.current.size === 1) {
      lastPan.current = Array.from(pointers.current.values())[0];
    } else {
      lastPan.current = null;
    }
  };

  // Attached manually (not via React's onWheel prop) with { passive: false }:
  // browsers/React may register wheel listeners as passive by default for
  // scroll-perf reasons, which silently makes preventDefault() a no-op — the
  // page would scroll underneath the zoom gesture instead of the image
  // zooming, and "Reset zoom" would look broken because it resets the image
  // transform but can't undo a page scroll it never caused.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform(t => ({ ...t, scale: clampScale(t.scale * delta) }));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const reset = () => setTransform({ scale: 1, x: 0, y: 0 });

  return (
    <div
      ref={viewportRef}
      className="chk-scan-viewport"
      style={aspectRatio ? { aspectRatio: `${1 / aspectRatio}`, height: 'auto', maxHeight: '70vh' } : undefined}
    >
      <button type="button" className="chk-scan-reset" onClick={reset}>Reset zoom</button>
      <div
        className="chk-scan-stage"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          draggable={false}
          className="chk-scan-img"
          alt="Scanned answer sheet"
          onLoad={e => {
            const el = e.currentTarget;
            if (el.naturalWidth > 0) setAspectRatio(el.naturalHeight / el.naturalWidth);
          }}
        />
        {answers.map(a => a.bubble_overlay && <OverlayForAnswer key={a.id} answer={a} />)}
      </div>

      <style jsx>{`
        .chk-scan-viewport {
          position: relative; overflow: hidden; touch-action: none;
          background: #0b0f1e; border-radius: var(--chk-radius-lg); height: 52vh; min-height: 320px;
        }
        .chk-scan-reset {
          position: absolute; top: 8px; right: 8px; z-index: 2;
          background: rgba(16, 25, 53, 0.75); color: #fff; border: none; border-radius: var(--chk-radius-sm);
          padding: 5px 10px; font-size: 0.75rem; cursor: pointer;
        }
        .chk-scan-stage { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; }
        .chk-scan-img { width: 100%; display: block; user-select: none; }
      `}</style>
    </div>
  );
}

function OverlayForAnswer({ answer }: { answer: SubmissionAnswerRow }) {
  const overlay = answer.bubble_overlay!;
  const effective = answer.override_option ?? answer.detected_option;
  const isMultiple = answer.detected_option === 'MULTIPLE';

  // For an ambiguous MULTIPLE read, the two darkest bubbles are the ones the
  // teacher actually needs to see marked — there's no single "effective"
  // option (of the A-D shape) to compare against opt for that case.
  const darkestOptions = isMultiple
    ? OPTIONS.slice().sort((a, b) => overlay[b].darkness - overlay[a].darkness).slice(0, 2)
    : [];

  const colorFor = (opt: BubbleOption): 'green' | 'red' | 'amber' | 'gray-outline' | 'gray' => {
    if (isMultiple) {
      if (darkestOptions.includes(opt)) return 'amber';
      if (opt === answer.correct_option) return 'gray-outline';
      return 'gray';
    }
    // effective is 'A'|'B'|'C'|'D'|'BLANK'|null here (MULTIPLE handled above);
    // BLANK/null never equal an option, so this only ever matches a real pick.
    if (opt === effective) {
      return effective === answer.correct_option ? 'green' : 'red';
    }
    if (opt === answer.correct_option) return 'gray-outline';
    return 'gray';
  };

  return (
    <>
      {OPTIONS.map(opt => {
        const rect = overlay[opt];
        if (!rect) return null;
        const color = colorFor(opt);
        const pos = { left: `${rect.xFrac * 100}%`, top: `${rect.yFrac * 100}%`, width: `${rect.rFrac * 2 * 100}%` };

        // The effective pick (right or wrong) gets a tick/cross badge instead
        // of a plain ring — it's the one answer the teacher needs to judge at
        // a glance, so it should read as a verdict, not just a highlight.
        if (color === 'green' || color === 'red') {
          return (
            <div key={opt} className={`chk-ov-badge chk-ov-badge-${color}`} style={pos}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                {color === 'green' ? (
                  <polyline points="4 13 9 18 20 5" />
                ) : (
                  <>
                    <line x1="5" y1="5" x2="19" y2="19" />
                    <line x1="19" y1="5" x2="5" y2="19" />
                  </>
                )}
              </svg>
            </div>
          );
        }

        return <div key={opt} className={`chk-ov-dot chk-ov-${color}`} style={pos} />;
      })}
      <style jsx>{`
        .chk-ov-dot {
          position: absolute; transform: translate(-50%, -50%); aspect-ratio: 1 / 1;
          border-radius: 50%; pointer-events: none; box-sizing: border-box;
        }
        .chk-ov-gray { border: 2px solid rgba(255, 255, 255, 0.35); }
        .chk-ov-gray-outline { border: 2px dashed var(--chk-green); }
        .chk-ov-amber { border: 3px solid var(--chk-amber); background: rgba(183, 121, 31, 0.3); }

        .chk-ov-badge {
          position: absolute; transform: translate(-50%, -50%); aspect-ratio: 1 / 1;
          border-radius: 50%; pointer-events: none; box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95), 0 1px 4px rgba(0, 0, 0, 0.5);
        }
        .chk-ov-badge-green { background: var(--chk-green); }
        .chk-ov-badge-red { background: var(--chk-danger); }
        .chk-ov-badge svg { width: 62%; height: 62%; color: #fff; }
      `}</style>
    </>
  );
}

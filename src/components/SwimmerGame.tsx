'use client';
import { useEffect, useRef, useState } from 'react';

/* ─── Animated SVG swimmer ─────────────────────────────────────────── */
function AnimatedSwimmer({ state }: { state: 'swim' | 'struggle' | 'panic' | 'drown' }) {
  const [phase, setPhase] = useState(0);
  const rafRef  = useRef<number>(0);
  const prev    = useRef<number>(0);
  const elapsed = useRef<number>(0);

  useEffect(() => {
    if (state === 'drown') { setPhase(0); return; }
    prev.current = 0;
    const step = (ts: number) => {
      if (prev.current) elapsed.current += ts - prev.current;
      prev.current = ts;
      setPhase(elapsed.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state]);

  /* ── drown: static vertical sinking figure ── */
  if (state === 'drown') return (
    <svg viewBox="0 0 60 82" width="60" height="82" style={{ overflow: 'visible' }}>
      {/* bubbles */}
      <circle cx="38" cy="18" r="3" fill="rgba(186,230,253,0.8)" />
      <circle cx="28" cy="8"  r="2" fill="rgba(186,230,253,0.7)" />
      <circle cx="44" cy="6"  r="1.5" fill="rgba(186,230,253,0.6)" />
      {/* head */}
      <circle cx="30" cy="14" r="11" fill="#FBBF24" />
      <path d="M 20 11 Q 30 1 40 11" fill="#EF4444" />
      {/* goggles */}
      <rect x="22" y="13" width="7" height="4" rx="2" fill="none" stroke="#7DD3FC" strokeWidth="1.2"/>
      <rect x="31" y="13" width="7" height="4" rx="2" fill="none" stroke="#7DD3FC" strokeWidth="1.2"/>
      {/* body */}
      <ellipse cx="30" cy="38" rx="8" ry="14" fill="#1D4ED8" />
      {/* arms (up, desperate) */}
      <line x1="30" y1="27" x2="10" y2="16" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round"/>
      <line x1="30" y1="27" x2="50" y2="16" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round"/>
      {/* legs */}
      <line x1="26" y1="52" x2="20" y2="76" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
      <line x1="34" y1="52" x2="40" y2="76" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );

  /* ── swim / struggle / panic ── */
  // speed in rad / ms
  const speed  = state === 'panic' ? 0.0055 : state === 'struggle' ? 0.0038 : 0.0022;
  const p      = (phase * speed);        // current phase (radians)
  const sin    = Math.sin(p);
  const sin2   = Math.sin(p * 2);        // twice frequency for legs

  // body bob
  const bob = sin * (state === 'panic' ? 4 : 2.5);

  // ── pivot points ──
  const shoulderX = 128, shoulderY = 36 + bob;
  const hipX      = 68,  hipY      = 40 + bob;
  const headX     = 148, headY     = shoulderY - 5;

  // ── front arm (in water, pulling) ──
  // oscillates between pointing forward-left and straight down
  const fAngle = (-170 + sin * (state === 'panic' ? 38 : 30)) * Math.PI / 180;
  const fax = shoulderX + 80 * Math.cos(fAngle);
  const fay = shoulderY + 80 * Math.sin(fAngle);

  // ── back arm (recovery arc over water) ──
  // panic: arms go more vertical / wild
  const bAngleDeg = state === 'panic'
    ? 30 - sin * 90        // flailing up
    : 15 - sin * 55;       // normal overhead arc
  const bAngle = bAngleDeg * Math.PI / 180;
  const bax = shoulderX + 72 * Math.cos(bAngle);
  const bay = shoulderY + 72 * Math.sin(bAngle);

  // ── legs – flutter kick ──
  const legLen = 52;
  const l1Angle = (153 + sin2 * (state === 'panic' ? 22 : 14)) * Math.PI / 180;
  const l2Angle = (158 - sin2 * (state === 'panic' ? 22 : 14)) * Math.PI / 180;
  const l1x = hipX + legLen * Math.cos(l1Angle);
  const l1y = hipY + legLen * Math.sin(l1Angle);
  const l2x = hipX + legLen * Math.cos(l2Angle);
  const l2y = hipY + legLen * Math.sin(l2Angle);

  // ── splash ──
  const splashOp = Math.max(0, -Math.sin(p)) * 0.7;

  // body tilt: panic = more vertical (head up)
  const bodyTilt = state === 'panic' ? -14 : state === 'struggle' ? -8 : -5;
  const bodyCX   = (shoulderX + hipX) / 2;
  const bodyCY   = (shoulderY + hipY) / 2 + 4;

  // struggle/panic expression
  const mouthPath = state === 'panic'
    ? `M ${headX-6} ${headY+7} Q ${headX} ${headY+3} ${headX+6} ${headY+7}`  // open mouth
    : `M ${headX-5} ${headY+6} Q ${headX} ${headY+9} ${headX+5} ${headY+6}`; // normal

  return (
    <svg viewBox="0 0 200 80" width="200" height="80" style={{ overflow: 'visible' }}>
      {/* Splash at front arm water entry */}
      {splashOp > 0.08 && (
        <ellipse cx={fax} cy={fay+3} rx="16" ry="5"
          fill={`rgba(186,230,253,${splashOp})`} />
      )}

      {/* Front arm (pulling through water) */}
      <line x1={shoulderX} y1={shoulderY} x2={fax} y2={fay}
        stroke="#FBBF24" strokeWidth="5.5" strokeLinecap="round" />

      {/* Body (swimsuit) */}
      <ellipse cx={bodyCX} cy={bodyCY} rx="33" ry="11" fill="#1D4ED8"
        transform={`rotate(${bodyTilt}, ${bodyCX}, ${bodyCY})`} />

      {/* Head */}
      <circle cx={headX} cy={headY} r="13.5" fill="#FBBF24" />
      {/* Swim cap */}
      <path d={`M ${headX-13} ${headY-2} Q ${headX} ${headY-17} ${headX+13} ${headY-2}`}
        fill={state === 'panic' ? '#DC2626' : '#EF4444'} />
      {/* Goggles */}
      <rect x={headX-13} y={headY-0.5} width="9" height="5.5" rx="2.7"
        fill="none" stroke="#7DD3FC" strokeWidth="1.6"/>
      <rect x={headX+2}  y={headY-0.5} width="9" height="5.5" rx="2.7"
        fill="none" stroke="#7DD3FC" strokeWidth="1.6"/>
      <line x1={headX-4} y1={headY+2.3} x2={headX+2} y2={headY+2.3}
        stroke="#7DD3FC" strokeWidth="1.2"/>
      {/* Mouth */}
      <path d={mouthPath} fill="none"
        stroke={state === 'panic' ? '#DC2626' : '#F59E0B'}
        strokeWidth="1.6" strokeLinecap="round"/>

      {/* Back arm (recovery over water) */}
      <line x1={shoulderX} y1={shoulderY} x2={bax} y2={bay}
        stroke="#FBBF24" strokeWidth="5.5" strokeLinecap="round" />

      {/* Legs */}
      <line x1={hipX} y1={hipY} x2={l1x} y2={l1y}
        stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
      <line x1={hipX} y1={hipY} x2={l2x} y2={l2y}
        stroke="#1D4ED8" strokeWidth="4"   strokeLinecap="round" />
      {/* Feet */}
      <line x1={l1x} y1={l1y} x2={l1x-9} y2={l1y+6}
        stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
      <line x1={l2x} y1={l2y} x2={l2x-9} y2={l2y+6}
        stroke="#1D4ED8" strokeWidth="3"   strokeLinecap="round" />
    </svg>
  );
}

/* ─── Cloud helper ──────────────────────────────────────────────────── */
function Cloud({ left, top, small }: { left: string; top: number; small?: boolean }) {
  const s = small ? 0.7 : 1;
  return (
    <div style={{ position: 'absolute', top, left, display: 'flex', alignItems: 'flex-end', zIndex: 2 }}>
      <div style={{ width: 28*s, height: 18*s, borderRadius: 999, background: 'rgba(255,255,255,0.92)' }} />
      <div style={{ width: 38*s, height: 24*s, borderRadius: 999, background: '#fff', marginLeft: -10*s, marginBottom: -2 }} />
      <div style={{ width: 24*s, height: 16*s, borderRadius: 999, background: 'rgba(255,255,255,0.88)', marginLeft: -8*s }} />
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
interface Props {
  consecutiveWrong: number;
  lastResult: 'correct' | 'wrong' | null;
  gameOver: boolean;
}

export default function SwimmerGame({ consecutiveWrong, lastResult, gameOver }: Props) {
  const [bouncing, setBouncing] = useState(false);
  const [shaking,  setShaking]  = useState(false);
  const [splash,   setSplash]   = useState(false);

  useEffect(() => {
    if (lastResult === 'correct') {
      setBouncing(true); setSplash(true);
      const t1 = setTimeout(() => setBouncing(false), 900);
      const t2 = setTimeout(() => setSplash(false),   700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (lastResult === 'wrong') {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 600);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  const swimState: 'swim'|'struggle'|'panic'|'drown' =
    gameOver            ? 'drown'
    : consecutiveWrong === 2 ? 'panic'
    : consecutiveWrong === 1 ? 'struggle'
    :                          'swim';

  /* Swimmer vertical position inside 220px container.
     Wave line sits at ~42% ≈ 92px.
     Swimmer SVG is 80px tall – we position its top edge so
     the body centre lands at the wave line.
     As consecutive wrongs rise, swimmer sinks deeper.            */
  const swimmerTop =
    gameOver            ? 155               // fully submerged
    : consecutiveWrong === 2 ? 86           // chest at water
    : consecutiveWrong === 1 ? 74           // shoulders at water
    :                          58;          // head/shoulders above water

  const bubbleCount = gameOver ? 7 : consecutiveWrong;

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden', marginBottom: 18,
      boxShadow: '0 8px 32px rgba(3,105,161,0.35)',
      position: 'relative', height: 220, userSelect: 'none',
    }}>
      {/* Sky + sea */}
      <div style={{ position: 'absolute', inset: 0, background:
        'linear-gradient(180deg,#bae6fd 0%,#7dd3fc 32%,#38bdf8 42%,#0369a1 42%,#0c4a6e 72%,#082f49 100%)' }} />

      {/* Sun */}
      <div style={{ position:'absolute', top:14, right:28, width:38, height:38, borderRadius:'50%',
        background:'#fde68a', boxShadow:'0 0 0 8px rgba(253,230,138,.25),0 0 0 16px rgba(253,230,138,.12)' }} />

      {/* Clouds */}
      <Cloud left="12%" top={12} />
      <Cloud left="52%" top={6}  small />

      {/* Fish in the deep */}
      <div style={{ position:'absolute', bottom:26, left:'18%', fontSize:'1rem', zIndex:3, opacity:0.35, animation:'fishSwim 9s linear infinite' }}>🐟</div>
      <div style={{ position:'absolute', bottom:14, left:'68%', fontSize:'0.8rem', zIndex:3, opacity:0.30, animation:'fishSwim 13s linear infinite reverse' }}>🐠</div>

      {/* ── SWIMMER ── */}
      <div style={{
        position:   'absolute',
        top:        swimmerTop,
        left:       '50%',
        transform: [
          'translateX(-60%)',
          bouncing ? 'translateY(-32px) scale(1.12)' : '',
          shaking  ? 'rotate(9deg)'  : '',
          gameOver ? 'translateY(10px) scale(0.88)' : '',
        ].join(' '),
        transition: gameOver
          ? 'top 1.5s cubic-bezier(.55,0,1,.45), transform 1.5s ease-in'
          : 'top 0.8s cubic-bezier(.34,1.56,.64,1)',
        zIndex: 4,
      }}>
        <AnimatedSwimmer state={swimState} />
      </div>

      {/* Splash ring (on correct answer) */}
      {splash && (
        <div style={{
          position:'absolute', top: swimmerTop + 38, left:'50%',
          transform:'translateX(-50%)',
          width:50, height:16, borderRadius:'50%',
          border:'2.5px solid rgba(125,211,252,0.85)',
          zIndex:8, animation:'splashRing 0.65s ease-out forwards',
        }} />
      )}

      {/* Wave layer 1 */}
      <svg viewBox="0 0 1200 44" preserveAspectRatio="none"
        style={{ position:'absolute', top:'39%', left:0, width:'200%', height:46, zIndex:5, animation:'waveFlow 4s linear infinite' }}>
        <path d="M0,22 C100,0 200,44 300,22 C400,0 500,44 600,22 C700,0 800,44 900,22 C1000,0 1100,44 1200,22 L1200,44 L0,44 Z" fill="#0369a1"/>
      </svg>

      {/* Wave layer 2 */}
      <svg viewBox="0 0 1200 38" preserveAspectRatio="none"
        style={{ position:'absolute', top:'41%', left:0, width:'200%', height:40, zIndex:6, opacity:0.65, animation:'waveFlow 6.5s linear infinite reverse' }}>
        <path d="M0,19 C150,0 300,38 450,19 C600,0 750,38 900,19 C1050,0 1200,38 1350,19 L1350,38 L0,38 Z" fill="#0c4a6e"/>
      </svg>

      {/* Bubbles (rise from swimmer position) */}
      {bubbleCount > 0 && Array.from({ length: bubbleCount }).map((_, i) => (
        <div key={i} style={{
          position:'absolute', bottom:8,
          left:`${45 + (i % 5) * 2.5 - 4}%`,
          width: 5 + (i % 3) * 3, height: 5 + (i % 3) * 3,
          borderRadius:'50%',
          background:'rgba(186,230,253,0.75)',
          border:'1px solid rgba(255,255,255,0.6)',
          zIndex:7,
          animation:`bubbleRise ${1.2 + i * 0.22}s ease-in infinite`,
          animationDelay:`${i * 0.32}s`,
        }} />
      ))}

      {/* Hearts */}
      <div style={{ position:'absolute', top:10, left:12, display:'flex', gap:3, zIndex:10 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            fontSize:'1.15rem',
            opacity: consecutiveWrong > i ? 0.15 : 1,
            filter:  consecutiveWrong > i ? 'grayscale(1)' : 'none',
            transition:'opacity 0.4s, filter 0.4s',
            display:'inline-block',
          }}>❤️</span>
        ))}
      </div>

      {/* Status badge */}
      {!gameOver && (
        <div style={{
          position:'absolute', bottom:10, right:12, zIndex:10,
          background: consecutiveWrong === 0 ? 'rgba(22,163,74,.88)' : consecutiveWrong === 1 ? 'rgba(217,119,6,.88)' : 'rgba(220,38,38,.92)',
          color:'#fff', borderRadius:8, padding:'3px 10px',
          fontSize:'0.72rem', fontWeight:700, transition:'background 0.4s',
        }}>
          {consecutiveWrong === 0 ? '🏊 Keep swimming!' : consecutiveWrong === 1 ? '⚠️ 1/3 wrong streak!' : '🚨 2/3 — Last chance!'}
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div style={{
          position:'absolute', inset:0, zIndex:20,
          background:'rgba(8,47,73,.82)', backdropFilter:'blur(4px)',
          display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column',
          animation:'fadeIn 0.5s ease',
        }}>
          <div style={{ fontSize:'2.8rem', animation:'pulse 1s ease infinite', marginBottom:6 }}>🌊</div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:'1.25rem', marginBottom:4 }}>Your swimmer drowned!</div>
          <div style={{ color:'rgba(147,210,240,.9)', fontSize:'0.82rem' }}>3 wrong answers in a row</div>
        </div>
      )}

      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes waveFlow   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes bubbleRise { 0%{transform:translateY(0) scale(1);opacity:.85} 80%{opacity:.5} 100%{transform:translateY(-90px) scale(1.7);opacity:0} }
        @keyframes fishSwim   { 0%{transform:translateX(0)} 100%{transform:translateX(130px)} }
        @keyframes splashRing { 0%{width:30px;height:10px;opacity:1} 100%{width:100px;height:34px;opacity:0} }
        @keyframes pulse      { 0%,100%{transform:scale(1)} 50%{transform:scale(1.13)} }
        @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}

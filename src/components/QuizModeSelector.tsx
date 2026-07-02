'use client';

interface Props {
  onSelect: (mode: 'simple' | 'game') => void;
}

export default function QuizModeSelector({ onSelect }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,15,35,0.82)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: 580, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>🎮</div>
        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(1.4rem,4vw,2rem)', marginBottom: 6 }}>
          Choose Your Quiz Mode
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 28, fontSize: '0.95rem' }}>
          How do you want to experience this quiz?
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Simple */}
          <button className="qms-card" onClick={() => onSelect('simple')}
            style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#0369a1 100%)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>📋</div>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>Simple Quiz</h3>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Classic mode. Navigate freely, review answers, submit when ready.
            </p>
            <div style={{ marginTop: 16, padding: '7px 20px', background: 'rgba(255,255,255,0.15)', borderRadius: 999, color: '#fff', fontSize: '0.82rem', fontWeight: 600, display: 'inline-block' }}>
              Start Simple →
            </div>
          </button>

          {/* Game */}
          <button className="qms-card qms-game" onClick={() => onSelect('game')}
            style={{ background: 'linear-gradient(135deg,#0c4a6e 0%,#065f46 100%)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>🏊‍♂️</div>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1.15rem', marginBottom: 8 }}>Game Mode</h3>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
              Your swimmer is in the sea! 3 wrong answers in a row and he <strong style={{ color: '#fca5a5' }}>drowns</strong>. Right answers keep him strong!
            </p>
            <div style={{ marginTop: 12, display: 'flex', gap: 6, justifyContent: 'center' }}>
              <span style={{ background: 'rgba(220,38,38,0.25)', border: '1px solid rgba(220,38,38,0.5)', borderRadius: 999, padding: '4px 12px', color: '#fca5a5', fontSize: '0.78rem', fontWeight: 600 }}>
                ❤️❤️❤️ 3 lives
              </span>
              <span style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 999, padding: '4px 12px', color: '#86efac', fontSize: '0.78rem', fontWeight: 600 }}>
                ✓ Right = Reset streak
              </span>
            </div>
            <div style={{ marginTop: 14, padding: '7px 20px', background: 'rgba(255,255,255,0.15)', borderRadius: 999, color: '#fff', fontSize: '0.82rem', fontWeight: 600, display: 'inline-block' }}>
              Dive In 🌊
            </div>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .qms-card {
          flex: 1; min-width: 220px;
          border-radius: 22px; padding: 2rem 1.6rem;
          border: 1.5px solid rgba(255,255,255,0.12);
          cursor: pointer; text-align: left;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s;
        }
        .qms-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          border-color: rgba(255,255,255,0.35);
        }
        .qms-game:hover { border-color: rgba(34,197,94,0.5) !important; }
      `}</style>
    </div>
  );
}

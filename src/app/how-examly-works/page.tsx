'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BreadcrumbAuto from '@/components/BreadcrumbAuto';

/* ── data ────────────────────────────────────────────── */
const FEATURES = [
  {
    accent: '#1e4fa6',
    glyph: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Make Exam Papers',
    desc: 'Generate BISE-aligned papers in minutes — chapter-wise, half-book or full-book, 1 to 4 tests per page.',
    bullets: ['AI question selection', 'Multiple difficulty levels', 'Customizable templates', 'Instant PDF & Word'],
  },
  {
    accent: '#0e7a71',
    glyph: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'Quiz & Practice',
    desc: 'Students practise with unlimited quizzes, get instant feedback and track their progress with rich analytics.',
    bullets: ['Real-time evaluation', 'Progress tracking', 'Chapter-wise & full-subject', 'Mobile friendly'],
  },
  {
    accent: '#7c3aed',
    glyph: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
    title: 'Job Exam Prep',
    desc: 'Comprehensive preparation for competitive and job exams with curated past papers and timed mock tests.',
    bullets: ['Exam-specific content', 'Time management practice', 'Performance analytics', 'Previous year papers'],
  },
];

const TRIAL_STEPS = [
  { n: '01', title: 'Sign Up Free', desc: 'Create your account in 30 seconds — no card needed.', color: '#1e4fa6' },
  { n: '02', title: 'Complete Profile', desc: 'Provide your Academy Name, Teacher Name, Institute Address, and Cell No (required).', color: '#0b8c80' },
  { n: '03', title: 'Generate Unlimited', desc: 'Access all features free for 3 months — no limits.', color: '#7c3aed' },
];

const REFERRAL_STEPS = [
  { icon: '🔗', title: 'Share Your Link', desc: 'Copy your unique referral link from your dashboard.' },
  { icon: '👥', title: 'Friend Signs Up', desc: 'They register using your link and verify their account.' },
  { icon: '🎁', title: 'Earn a Free Month', desc: 'You both get +1 month free — unlimited referrals.' },
];

const SUB_STEPS = [
  { n: 1, title: 'Select a Package', desc: 'Browse affordable monthly and yearly plans from your dashboard.' },
  { n: 2, title: 'We Contact You', desc: 'Our team verifies your details and processes the payment securely.' },
  { n: 3, title: 'Instant Activation', desc: 'Get full premium access the moment your plan is confirmed.' },
];

/* ── component ───────────────────────────────────────── */
export default function HowItWorks() {
  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>

      <main className="hiw-root">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="hiw-hero">
          <div className="hiw-blob hiw-ba" />
          <div className="hiw-blob hiw-bb" />

          <div className="hiw-hero-inner">
            {/* left */}
            <div className="hiw-hero-copy">
              <div className="hiw-eyebrow">How Examly Works</div>
              <h1 className="hiw-hero-h1">
                From blank page<br />
                <span className="hiw-grad-text">to perfect paper</span><br />
                in 1 minute.
              </h1>
              <p className="hiw-hero-sub">
                Examly is Pakistan's smartest exam-paper platform — built for teachers, used by 5,000+ educators across all PTB subjects — papers ready in under 1 minute.
              </p>

              {/* stat pills */}
              <div className="hiw-stat-row">
                {[
                  { v: '10K+', l: 'Papers Generated' },
                  { v: '5K+',  l: 'Active Educators' },
                  { v: '1 min',l: 'Average Time'     },
                ].map((s, i) => (
                  <div key={i} className="hiw-stat-pill">
                    <span className="hiw-stat-v">{s.v}</span>
                    <span className="hiw-stat-l">{s.l}</span>
                  </div>
                ))}
              </div>

              <div className="hiw-hero-ctas">
                <Link href="/auth/signup" className="hiw-btn-primary">
                  Start 3 Months Free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="#features" className="hiw-btn-ghost">Explore Features</Link>
              </div>
              <p className="hiw-fine">No credit card required &bull; Cancel anytime</p>
            </div>

            {/* right — paper mockup */}
            <div className="hiw-hero-visual">
              <div className="hiw-paper">
                <div className="hiw-paper-top">
                  <div className="hiw-paper-school">Punjab Textbook Board</div>
                  <div className="hiw-paper-meta">
                    <span className="hiw-chip">Class 10</span>
                    <span className="hiw-chip">Physics</span>
                    <span className="hiw-chip">Chapter 1</span>
                  </div>
                </div>
                <div className="hiw-paper-title">Annual Examination 2025</div>
                <div className="hiw-paper-info">Total Marks: 75 &nbsp;|&nbsp; Time: 3 Hours</div>
                <div className="hiw-paper-divider" />
                {[
                  'Which of the following is a scalar quantity?',
                  'The SI unit of force is:',
                  'Newton\'s first law is also known as:',
                  'Work done is zero when force and displacement are:',
                ].map((q, i) => (
                  <div key={i} className="hiw-paper-q">
                    <span className="hiw-qn">{i + 1}.</span>
                    <div>
                      <div className="hiw-qtext">{q}</div>
                      <div className="hiw-opts">
                        {['(A)', '(B)', '(C)', '(D)'].map((o, oi) => (
                          <span key={o} className={`hiw-opt ${oi === i % 4 ? 'hiw-opt-sel' : ''}`}>{o}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* floating badges */}
              <div className="hiw-fb hiw-fb-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e"><path d="M20 6L9 17l-5-5"/></svg>
                Generated in 1 min
              </div>
              <div className="hiw-fb hiw-fb-2">
                ⬇ Instant Download
              </div>
            </div>
          </div>
        </section>

        {/* ══ FEATURES ══════════════════════════════════════ */}
        <section id="features" className="hiw-section hiw-sec-light">
          <div className="hiw-container">
            <div className="hiw-section-head">
              <div className="hiw-eyebrow hiw-ey-dark">Core Features</div>
              <h2 className="hiw-h2">Everything in one platform</h2>
              <p className="hiw-section-sub">Built for Pakistani educators, aligned to PTB curriculum</p>
            </div>

            <div className="hiw-feat-grid">
              {FEATURES.map((f, i) => (
                <div key={i} className="hiw-feat-card" style={{ '--accent': f.accent } as React.CSSProperties}>
                  <div className="hiw-feat-top">
                    <div className="hiw-feat-icon" style={{ background: f.accent }}>{f.glyph}</div>
                    <h3 className="hiw-feat-title">{f.title}</h3>
                  </div>
                  <p className="hiw-feat-desc">{f.desc}</p>
                  <ul className="hiw-feat-ul">
                    {f.bullets.map((b, bi) => (
                      <li key={bi}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="12" fill={f.accent} fillOpacity="0.12"/>
                          <path d="M7 12l3.5 3.5L17 8" stroke={f.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="hiw-feat-bar" style={{ background: f.accent }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FREE TRIAL ════════════════════════════════════ */}
        <section className="hiw-section hiw-sec-white">
          <div className="hiw-container">
            <div className="hiw-section-head">
              <div className="hiw-eyebrow hiw-ey-dark">Get Started</div>
              <h2 className="hiw-h2">3 months free — 3 simple steps</h2>
              <p className="hiw-section-sub">No credit card, no commitment. Just create and go.</p>
            </div>

            <div className="hiw-steps">
              {TRIAL_STEPS.map((s, i) => (
                <div key={i} className="hiw-step">
                  {i < TRIAL_STEPS.length - 1 && <div className="hiw-connector" />}
                  <div className="hiw-step-num" style={{ background: s.color }}>{s.n}</div>
                  <h4 className="hiw-step-title">{s.title}</h4>
                  <p className="hiw-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="hiw-trial-cta">
              <Link href="/auth/signup" className="hiw-btn-primary">
                Claim Your Free 3 Months
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ══ REFERRAL ══════════════════════════════════════ */}
        <section className="hiw-section hiw-sec-brand">
          <svg className="hiw-hero-grid" aria-hidden="true">
            <defs>
              <pattern id="hgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hgrid)" />
          </svg>
          <div className="hiw-blob hiw-ba" style={{ opacity: 0.12 }} />

          <div className="hiw-container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="hiw-section-head">
              <div className="hiw-eyebrow" style={{ color: '#6ee7b7', borderColor: 'rgba(110,231,183,0.3)', background: 'rgba(110,231,183,0.1)' }}>Referral Program</div>
              <h2 className="hiw-h2" style={{ color: '#fff' }}>Refer friends. Earn free months.</h2>
              <p className="hiw-section-sub" style={{ color: 'rgba(220,240,255,0.65)' }}>Love Examly? Share it — and both of you get rewarded.</p>
            </div>

            <div className="hiw-ref-row">
              {REFERRAL_STEPS.map((r, i) => (
                <div key={i} className="hiw-ref-card">
                  {i < REFERRAL_STEPS.length - 1 && (
                    <svg className="hiw-ref-arrow" viewBox="0 0 40 24" fill="none">
                      <path d="M0 12h32M24 4l8 8-8 8" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <div className="hiw-ref-icon">{r.icon}</div>
                  <h4 className="hiw-ref-title">{r.title}</h4>
                  <p className="hiw-ref-desc">{r.desc}</p>
                </div>
              ))}
            </div>

            <div className="hiw-ref-banner">
              <span className="hiw-ref-highlight">+1 month free</span> for every successful referral &mdash; unlimited!
            </div>
          </div>
        </section>

        {/* ══ SUBSCRIPTION ══════════════════════════════════ */}
        <section className="hiw-section hiw-sec-light">
          <div className="hiw-container">
            <div className="hiw-section-head">
              <div className="hiw-eyebrow hiw-ey-dark">After Free Trial</div>
              <h2 className="hiw-h2">Subscribing is effortless</h2>
              <p className="hiw-section-sub">Pick a plan, we handle the rest.</p>
            </div>

            <div className="hiw-sub-grid">
              {SUB_STEPS.map((s, i) => (
                <div key={i} className="hiw-sub-card">
                  <div className="hiw-sub-num">{s.n}</div>
                  <h4 className="hiw-sub-title">{s.title}</h4>
                  <p className="hiw-sub-desc">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="hiw-sub-cta-box">
              <h3 className="hiw-sub-box-h">Ready to subscribe?</h3>
              <p className="hiw-sub-box-p">Log in, pick a plan, and we'll activate your premium access within hours.</p>
              <div className="hiw-sub-box-btns">
                <Link href="/auth/login" className="hiw-btn-primary">Login &amp; Choose Plan</Link>
                <Link href="/packages" className="hiw-btn-outline">View Packages</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ═════════════════════════════════════ */}
        <section className="hiw-final">
          <div className="hiw-blob hiw-ba" />
          <div className="hiw-blob hiw-bb" />
          <div className="hiw-final-inner">
            <div className="hiw-eyebrow">
              Start Today
            </div>
            <h2 className="hiw-final-h2">Join 5,000+ educators already<br />using Examly</h2>
            <p className="hiw-final-sub">Unlimited paper generation &bull; No credit card &bull; BISE aligned</p>
            <div className="hiw-final-btns">
              <Link href="/auth/signup" className="hiw-btn-primary hiw-btn-lg">
                🚀 Get 3 Months Free
              </Link>
              <Link href="/quiz" className="hiw-btn-ghost hiw-btn-lg">Try a Demo Quiz</Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />

      <style jsx>{`
        /* ── base ─────────────────────────────────── */
        .hiw-root { overflow-x: hidden; }
        .hiw-container { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }
        .hiw-section { padding: 5rem 0; }
        .hiw-sec-white { background: #fff; }
        .hiw-sec-light { background: #f5f7fb; }
        .hiw-sec-brand {
          background: linear-gradient(145deg, #1c3565 0%, #1e4fa6 50%, #126f63 100%);
          position: relative; overflow: hidden;
        }

        /* ── shared typography ────────────────────── */
        .hiw-section-head { text-align: center; margin-bottom: 3.5rem; }
        .hiw-eyebrow {
          display: inline-flex; align-items: center;
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #1ba699;
          background: rgba(27,166,153,0.12);
          border: 1px solid rgba(27,166,153,0.35);
          border-radius: 999px; padding: 4px 14px;
          margin-bottom: 1rem;
        }
        .hiw-ey-dark { color: #1e4fa6; background: rgba(30,79,166,0.08); border-color: rgba(30,79,166,0.2); }
        .hiw-h2 {
          font-size: clamp(1.7rem, 3vw, 2.4rem);
          font-weight: 800; color: #0f172a;
          letter-spacing: -0.025em; margin-bottom: 0.6rem;
        }
        .hiw-section-sub { font-size: 1rem; color: #64748b; margin: 0; }

        /* ── hero ─────────────────────────────────── */
        .hiw-hero {
          background: linear-gradient(135deg, #dbeafe 0%, #eef6ff 45%, #ccfbf1 100%);
          position: relative; overflow: hidden;
          padding: 6rem 1.5rem 5rem;
        }
        .hiw-hero-grid {
          position: absolute; inset: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .hiw-blob {
          position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none;
        }
        .hiw-ba { width:500px; height:500px; background:rgba(27,166,153,0.32); top:-150px; right:-100px; }
        .hiw-bb { width:380px; height:380px; background:rgba(7,62,140,0.24); bottom:-120px; left:-80px; }

        .hiw-hero-inner {
          max-width: 1120px; margin: 0 auto;
          display: flex; align-items: center; gap: 4rem;
          position: relative; z-index: 1;
        }
        .hiw-hero-copy { flex: 1 1 50%; }
        .hiw-hero-visual { flex: 0 0 46%; display: flex; justify-content: center; align-items: center; position: relative; }

        .hiw-hero-h1 {
          font-size: clamp(2.2rem, 4vw, 3.4rem);
          font-weight: 800; color: var(--text-main, #0f172a);
          line-height: 1.12; letter-spacing: -0.03em;
          margin-bottom: 1.2rem;
        }
        .hiw-grad-text {
          background: linear-gradient(90deg, var(--brand-primary, #073e8c), var(--brand-accent, #1ba699));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hiw-hero-sub {
          font-size: 1rem; color: var(--text-secondary, #334155);
          line-height: 1.7; margin-bottom: 2rem; max-width: 480px;
        }

        /* stat row */
        .hiw-stat-row {
          display: flex; gap: 0; margin-bottom: 2.2rem;
          background: #fff;
          border: 1px solid var(--border-subtle, #e2e8f0);
          border-radius: 14px; overflow: hidden;
          max-width: 420px;
          box-shadow: var(--shadow-sm);
        }
        .hiw-stat-pill {
          flex: 1; text-align: center; padding: 0.8rem 0.5rem;
          border-right: 1px solid var(--border-subtle, #e2e8f0);
          display: flex; flex-direction: column; gap: 2px;
        }
        .hiw-stat-pill:last-child { border-right: none; }
        .hiw-stat-v { font-size: 1.3rem; font-weight: 800; color: var(--text-main, #0f172a); }
        .hiw-stat-l { font-size: 0.62rem; font-weight: 600; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.06em; }

        /* ctas */
        .hiw-hero-ctas { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .hiw-fine { font-size: 0.75rem; color: var(--text-faint, #94a3b8); margin: 0; }

        /* ── buttons ──────────────────────────────── */
        /* :global() is required — styled-jsx doesn't scope next/link's
           rendered <a>, only native lowercase JSX elements. */
        :global(.hiw-btn-primary) {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, var(--brand-primary, #073e8c), var(--brand-accent, #1ba699));
          color: #fff; font-weight: 700; font-size: 0.9rem;
          padding: 0.7rem 1.5rem; border-radius: 10px; border: none;
          text-decoration: none; cursor: pointer;
          box-shadow: 0 6px 20px -4px rgba(7,62,140,0.45);
          transition: transform 0.18s, box-shadow 0.18s;
        }
        :global(.hiw-btn-primary):hover { transform: translateY(-2px); box-shadow: 0 10px 28px -4px rgba(7,62,140,0.5); color: #fff; text-decoration: none; }
        :global(.hiw-btn-lg) { font-size: 1rem; padding: 0.85rem 2rem; }

        :global(.hiw-btn-ghost) {
          display: inline-flex; align-items: center; gap: 7px;
          background: transparent;
          border: 1.5px solid var(--border-medium, #cbd5e1);
          color: var(--text-main, #0f172a); font-weight: 600; font-size: 0.9rem;
          padding: 0.7rem 1.5rem; border-radius: 10px;
          text-decoration: none; cursor: pointer;
          transition: background 0.18s, border-color 0.18s, color 0.18s;
        }
        :global(.hiw-btn-ghost):hover { background: var(--brand-primary-50, #eff6ff); border-color: var(--brand-primary, #073e8c); color: var(--brand-primary, #073e8c); text-decoration: none; }
        :global(.hiw-btn-ghost.hiw-btn-lg) { font-size: 1rem; padding: 0.85rem 2rem; }

        :global(.hiw-btn-outline) {
          display: inline-flex; align-items: center; gap: 7px;
          background: #fff; border: 1.5px solid #e2e8f0;
          color: #1e4fa6; font-weight: 600; font-size: 0.9rem;
          padding: 0.7rem 1.5rem; border-radius: 10px;
          text-decoration: none; cursor: pointer;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        :global(.hiw-btn-outline):hover { border-color: #1e4fa6; box-shadow: 0 2px 8px rgba(30,79,166,0.12); color: #1e4fa6; text-decoration: none; }

        /* ── paper mockup ─────────────────────────── */
        .hiw-paper {
          background: #fff; border-radius: 16px;
          padding: 1.4rem 1.6rem;
          box-shadow: 0 24px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.12);
          max-width: 360px; width: 100%;
          transform: rotate(2deg);
        }
        .hiw-paper-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
        .hiw-paper-school { font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
        .hiw-paper-meta { display: flex; gap: 4px; }
        .hiw-chip { font-size: 0.6rem; font-weight: 600; background: #f0f4ff; color: #1e4fa6; border-radius: 999px; padding: 2px 8px; }
        .hiw-paper-title { font-size: 0.82rem; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 2px; }
        .hiw-paper-info { font-size: 0.62rem; color: #64748b; text-align: center; margin-bottom: 0.6rem; }
        .hiw-paper-divider { height: 1.5px; background: linear-gradient(90deg,#1e4fa6,#126f63); margin-bottom: 0.8rem; border-radius: 2px; }
        .hiw-paper-q { display: flex; gap: 6px; margin-bottom: 0.6rem; }
        .hiw-qn { font-size: 0.7rem; font-weight: 700; color: #1e4fa6; flex-shrink: 0; margin-top: 1px; }
        .hiw-qtext { font-size: 0.68rem; color: #0f172a; line-height: 1.4; margin-bottom: 4px; }
        .hiw-opts { display: flex; gap: 4px; flex-wrap: wrap; }
        .hiw-opt { font-size: 0.6rem; font-weight: 600; color: #64748b; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
        .hiw-opt-sel { background: #1e4fa6; color: #fff; border-color: #1e4fa6; }

        /* floating badges */
        .hiw-fb {
          position: absolute;
          display: flex; align-items: center; gap: 6px;
          background: #fff; border-radius: 999px;
          padding: 6px 14px; font-size: 0.75rem; font-weight: 700;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          white-space: nowrap;
        }
        .hiw-fb-1 { bottom: -12px; left: -20px; color: #15803d; }
        .hiw-fb-2 { top: -12px; right: -16px; color: #1e4fa6; }

        /* ── features ─────────────────────────────── */
        .hiw-feat-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
        }
        .hiw-feat-card {
          background: #fff; border-radius: 18px;
          border: 1px solid #e8eef5; padding: 1.8rem 1.6rem 2rem;
          position: relative; overflow: hidden;
          transition: transform 0.22s, box-shadow 0.22s;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
        }
        .hiw-feat-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(15,23,42,0.1); }
        .hiw-feat-bar {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 3px; opacity: 0; transition: opacity 0.22s;
        }
        .hiw-feat-card:hover .hiw-feat-bar { opacity: 1; }
        .hiw-feat-top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .hiw-feat-icon {
          width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .hiw-feat-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; }
        .hiw-feat-desc { font-size: 0.86rem; color: #475569; line-height: 1.65; margin-bottom: 1.2rem; }
        .hiw-feat-ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 7px; }
        .hiw-feat-ul li { display: flex; align-items: center; gap: 8px; font-size: 0.83rem; color: #374151; }

        /* ── steps ────────────────────────────────── */
        .hiw-steps {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 2rem;
          position: relative; margin-bottom: 3rem;
        }
        .hiw-step { text-align: center; position: relative; }
        .hiw-connector {
          position: absolute; top: 28px; left: calc(50% + 36px);
          width: calc(100% - 36px); height: 2px;
          background: linear-gradient(90deg,#e2e8f0,#e2e8f0);
          background-image: repeating-linear-gradient(90deg,#cbd5e1 0,#cbd5e1 6px,transparent 0,transparent 12px);
        }
        .hiw-step-num {
          width: 56px; height: 56px; border-radius: 50%;
          color: #fff; font-size: 1rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1rem;
          box-shadow: 0 6px 20px rgba(0,0,0,0.18);
          position: relative; z-index: 1;
        }
        .hiw-step-title { font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem; }
        .hiw-step-desc { font-size: 0.85rem; color: #64748b; line-height: 1.6; margin: 0; }
        .hiw-trial-cta { text-align: center; }

        /* ── referral ─────────────────────────────── */
        .hiw-ref-row {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem;
          position: relative; margin-bottom: 2.5rem;
        }
        .hiw-ref-card {
          text-align: center; position: relative;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 18px; padding: 2rem 1.5rem;
          backdrop-filter: blur(8px);
        }
        .hiw-ref-arrow {
          position: absolute; right: -28px; top: 50%; transform: translateY(-50%);
          width: 40px; z-index: 2;
        }
        .hiw-ref-icon { font-size: 2.4rem; margin-bottom: 1rem; display: block; }
        .hiw-ref-title { font-size: 1rem; font-weight: 800; color: #fff; margin-bottom: 0.4rem; }
        .hiw-ref-desc { font-size: 0.84rem; color: rgba(220,232,255,0.7); line-height: 1.6; margin: 0; }
        .hiw-ref-banner {
          text-align: center;
          background: rgba(110,231,183,0.1); border: 1px solid rgba(110,231,183,0.28);
          border-radius: 12px; padding: 1rem 1.5rem;
          font-size: 0.9rem; color: rgba(220,232,255,0.8);
        }
        .hiw-ref-highlight {
          font-weight: 800; font-size: 1.05rem; color: #6ee7b7;
        }

        /* ── subscription ─────────────────────────── */
        .hiw-sub-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem;
          margin-bottom: 3rem;
        }
        .hiw-sub-card {
          background: #fff; border-radius: 16px; padding: 1.8rem 1.6rem;
          border: 1px solid #e8eef5;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .hiw-sub-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(15,23,42,0.09); }
        .hiw-sub-num {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg,#1e4fa6,#126f63);
          color: #fff; font-size: 1.1rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .hiw-sub-title { font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; }
        .hiw-sub-desc { font-size: 0.85rem; color: #64748b; line-height: 1.6; margin: 0; }

        .hiw-sub-cta-box {
          background: linear-gradient(135deg,#f0f4ff,#e8f8f5);
          border: 1.5px solid #c7d8f8; border-radius: 20px;
          padding: 2.5rem 2rem; text-align: center;
        }
        .hiw-sub-box-h { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem; }
        .hiw-sub-box-p { font-size: 0.88rem; color: #475569; max-width: 500px; margin: 0 auto 1.5rem; }
        .hiw-sub-box-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* ── final cta ────────────────────────────── */
        .hiw-final {
          background: linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding: 6rem 1.5rem; text-align: center;
          position: relative; overflow: hidden;
        }
        .hiw-final-inner { position: relative; z-index: 1; max-width: 680px; margin: 0 auto; }
        .hiw-final-h2 {
          font-size: clamp(1.8rem, 3.5vw, 2.8rem);
          font-weight: 800; color: var(--text-main, #0f172a);
          line-height: 1.2; letter-spacing: -0.025em; margin-bottom: 1rem;
        }
        .hiw-final-sub { font-size: 0.92rem; color: var(--text-secondary, #334155); margin-bottom: 2.2rem; }
        .hiw-final-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* ── responsive ───────────────────────────── */
        @media (max-width: 960px) {
          .hiw-hero-inner { flex-direction: column; gap: 2.5rem; }
          .hiw-hero-visual { width: 100%; max-width: 380px; }
          .hiw-paper { transform: none; }
          .hiw-feat-grid, .hiw-steps, .hiw-ref-row, .hiw-sub-grid {
            grid-template-columns: 1fr 1fr;
          }
          .hiw-connector, .hiw-ref-arrow { display: none; }
        }
        @media (max-width: 640px) {
          .hiw-hero { padding: 4rem 1.2rem 3rem; }
          .hiw-section { padding: 3.5rem 0; }
          .hiw-feat-grid, .hiw-steps, .hiw-ref-row, .hiw-sub-grid {
            grid-template-columns: 1fr;
          }
          .hiw-stat-row { max-width: 100%; }
          .hiw-hero-visual { display: none; }
          .hiw-final { padding: 4rem 1.2rem; }
        }
      `}</style>
    </>
  );
}

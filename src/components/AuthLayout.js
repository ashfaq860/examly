'use client';
import Header from './Header';
import Footer from './Footer';
import Link from 'next/link';

const PANELS = {
  login: {
    eyebrow: 'Trusted by Pakistani Educators',
    headline: ['Smarter Papers,', 'Happier Teachers.'],
    sub: 'Thousands of educators create BISE-aligned exam papers in under 3 minutes.',
    stats: [
      { value: '10K+', label: 'Papers Made'  },
      { value: '5K+',  label: 'Educators'    },
      { value: '3 min',label: 'Avg. Time'    },
    ],
    offer: null,
    features: [
      { color: '#6ee7b7', text: 'AI-powered question selection' },
      { color: '#93c5fd', text: 'Full-book, half-book & chapter-wise' },
      { color: '#c4b5fd', text: 'BISE aligned — PTB syllabus' },
      { color: '#fda4af', text: 'Instant PDF & Word download' },
    ],
    testimonial: {
      quote: '"I used to spend 2 hours on one paper. Examly does it in 3 minutes."',
      name: 'Usman Ghani',
      role: 'Senior Teacher, Lahore',
      initial: 'U',
    },
    switchText: "Don't have an account?",
    switchLink: '/auth/signup',
    switchLabel: 'Sign up free →',
  },
  signup: {
    eyebrow: '🎁 Limited Offer — No Card Needed',
    headline: ['3 Months Free,', 'Unlimited Papers.'],
    sub: 'Get complete access — all subjects, all classes — absolutely free for 3 months.',
    stats: [
      { value: '3',  label: 'Months Free'  },
      { value: '∞',  label: 'Papers/Month' },
      { value: '₨0', label: 'Cost to Start' },
    ],
    offer: {
      title: 'Everything included free',
      points: [
        { color: '#6ee7b7', text: 'Unlimited paper generation' },
        { color: '#6ee7b7', text: 'All classes & PTB subjects'  },
        { color: '#6ee7b7', text: 'PDF + Word instant download' },
        { color: '#fde68a', text: 'Refer friends → earn extra months' },
      ],
    },
    features: null,
    testimonial: null,
    switchText: 'Already have an account?',
    switchLink: '/auth/login',
    switchLabel: 'Sign in →',
  },
};

export default function AuthLayout({ children, title, subtitle, mode = 'login' }) {
  const p = PANELS[mode] || PANELS.login;

  return (
    <>
      <Header />
      <div className="al-root">

        {/* ══════ LEFT ══════ */}
        <div className="al-left">
          <svg className="al-pattern" aria-hidden="true">
            <defs>
              <pattern id="aldots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1" fill="rgba(255,255,255,0.06)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#aldots)" />
          </svg>
          <div className="al-blob al-blob-a" />
          <div className="al-blob al-blob-b" />

          <div className="al-left-inner">
            <Link href="/" className="al-logo">
              <img src="/examly.png" alt="Examly" height="36" style={{ borderRadius: 7 }} />
            </Link>

            <div className="al-eyebrow">{p.eyebrow}</div>

            <h1 className="al-headline">
              {p.headline.map((line, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {i === 0 ? line : <span className="al-hl">{line}</span>}
                </span>
              ))}
            </h1>

            <p className="al-sub">{p.sub}</p>

            <div className="al-stats">
              {p.stats.map((s, i) => (
                <div key={i} className="al-stat">
                  <div className="al-stat-val">{s.value}</div>
                  <div className="al-stat-lbl">{s.label}</div>
                </div>
              ))}
            </div>

            {p.offer && (
              <div className="al-offer-box">
                <div className="al-offer-title">{p.offer.title}</div>
                <ul className="al-offer-list">
                  {p.offer.points.map((pt, i) => (
                    <li key={i}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="7" fill={pt.color} fillOpacity="0.18"/>
                        <path d="M3.5 7l2.5 2.5 4-4" stroke={pt.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {pt.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {p.features && (
              <ul className="al-features">
                {p.features.map((f, i) => (
                  <li key={i}>
                    <span className="al-dot" style={{ background: f.color, boxShadow: `0 0 7px ${f.color}90` }} />
                    {f.text}
                  </li>
                ))}
              </ul>
            )}

            {p.testimonial && (
              <div className="al-testi">
                <p className="al-quote">{p.testimonial.quote}</p>
                <div className="al-author">
                  <div className="al-avatar">{p.testimonial.initial}</div>
                  <div>
                    <div className="al-aname">{p.testimonial.name}</div>
                    <div className="al-arole">{p.testimonial.role}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="al-switch">
              {p.switchText}&ensp;
              <Link href={p.switchLink} className="al-switch-link">{p.switchLabel}</Link>
            </div>
          </div>
        </div>

        {/* ══════ RIGHT ══════ */}
        <div className="al-right">
          <div className="al-card">
            <div className="al-card-bar" />
            <div className="al-mobile-logo">
              <img src="/examly.png" alt="Examly" height="46" />
              <div className="al-mobile-tagline">Trusted by Pakistani Educators</div>
            </div>
            {title    && <h2 className="al-card-title">{title}</h2>}
            {subtitle && <p  className="al-card-sub">{subtitle}</p>}
            {children}
            <div className="al-secure">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Secured with 256-bit SSL
            </div>
          </div>
        </div>
      </div>

      <Footer />

      <style jsx global>{`
        /* root */
        .al-root {
          display: flex;
          min-height: calc(100vh - 62px);
          margin-top: 62px;
          overflow: hidden;
        }

        /* ── LEFT ─────────────────────────── */
        .al-left {
          flex: 1 1 50%;
          position: relative;
          overflow: hidden;
          background: linear-gradient(148deg,
            #1c3565 0%,
            #1e4fa6 42%,
            #126f63 100%);
          display: flex;
          align-items: center;
        }
        .al-pattern {
          position: absolute; inset: 0; width: 100%; height: 100%;
          pointer-events: none;
        }
        .al-blob {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
        }
        .al-blob-a {
          width: 380px; height: 380px;
          background: rgba(99,210,190,0.14);
          top: -100px; right: -80px;
        }
        .al-blob-b {
          width: 300px; height: 300px;
          background: rgba(30,79,166,0.2);
          bottom: -80px; left: -50px;
        }

        .al-left-inner {
          position: relative; z-index: 2;
          padding: 1.8rem 2.6rem;
          width: 100%; max-width: 520px; margin: 0 auto;
        }

        .al-logo { display: block; margin-bottom: 1.4rem; }

        .al-eyebrow {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          color: #6ee7b7;
          background: rgba(110,231,183,0.1);
          border: 1px solid rgba(110,231,183,0.28);
          border-radius: 999px; padding: 3px 11px;
          margin-bottom: 0.85rem;
        }

        .al-headline {
          font-size: clamp(1.7rem, 2.6vw, 2.2rem);
          font-weight: 800; color: #e8eef8;
          line-height: 1.18; letter-spacing: -0.025em;
          margin-bottom: 0.7rem;
        }
        .al-hl {
          background: linear-gradient(90deg,#6ee7b7,#93c5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .al-sub {
          font-size: 0.87rem;
          color: rgba(220,232,255,0.68);
          line-height: 1.65; margin-bottom: 1.2rem;
          max-width: 400px;
        }

        /* stats */
        .al-stats {
          display: flex; gap: 0;
          margin-bottom: 1.2rem;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px; overflow: hidden;
        }
        .al-stat {
          flex: 1; text-align: center; padding: 0.7rem 0.4rem;
          border-right: 1px solid rgba(255,255,255,0.1);
        }
        .al-stat:last-child { border-right: none; }
        .al-stat-val {
          font-size: 1.25rem; font-weight: 800;
          color: #e8eef8; line-height: 1; margin-bottom: 2px;
        }
        .al-stat-lbl {
          font-size: 0.62rem; font-weight: 600;
          color: rgba(220,232,255,0.5);
          text-transform: uppercase; letter-spacing: 0.06em;
        }

        /* offer */
        .al-offer-box {
          background: rgba(251,191,36,0.07);
          border: 1px solid rgba(251,191,36,0.24);
          border-radius: 12px; padding: 0.9rem 1.1rem;
          margin-bottom: 1.2rem;
        }
        .al-offer-title {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #fbbf24; margin-bottom: 8px;
        }
        .al-offer-list {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 6px;
        }
        .al-offer-list li {
          display: flex; align-items: center; gap: 7px;
          font-size: 0.83rem; color: rgba(220,232,255,0.82);
        }

        /* features */
        .al-features {
          list-style: none; padding: 0; margin: 0 0 1.2rem;
          display: flex; flex-direction: column; gap: 7px;
        }
        .al-features li {
          display: flex; align-items: center; gap: 9px;
          font-size: 0.83rem; color: rgba(220,232,255,0.8);
        }
        .al-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }

        /* testimonial */
        .al-testi {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 0.9rem 1.1rem;
          margin-bottom: 1.2rem;
        }
        .al-quote {
          font-size: 0.83rem; color: rgba(220,232,255,0.82);
          line-height: 1.6; margin: 0 0 10px; font-style: italic;
        }
        .al-author { display: flex; align-items: center; gap: 9px; }
        .al-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg,#1ba699,#1e4fa6);
          color: #fff; font-weight: 700; font-size: 0.82rem;
          display: flex; align-items: center; justify-content: center;
        }
        .al-aname { font-size: 0.79rem; font-weight: 700; color: #e8eef8; }
        .al-arole { font-size: 0.7rem; color: rgba(220,232,255,0.48); }

        /* switch */
        .al-switch { font-size: 0.79rem; color: rgba(220,232,255,0.45); }
        .al-switch-link { color: #6ee7b7; font-weight: 600; text-decoration: none; }
        .al-switch-link:hover { color: #a7f3d0; }

        /* ── RIGHT ────────────────────────── */
        .al-right {
          flex: 0 0 50%;
          background: #f5f7fb;
          display: flex; align-items: center; justify-content: center;
          padding: 2rem 2.5rem;
        }
        .al-card {
          background: #fff;
          border-radius: 20px;
          box-shadow:
            0 0 0 1px rgba(15,23,42,0.05),
            0 4px 6px rgba(15,23,42,0.03),
            0 20px 48px rgba(15,23,42,0.07);
          width: 100%; max-width: 410px;
          overflow: hidden;
          animation: alIn 0.45s cubic-bezier(0.34,1.4,0.64,1) both;
        }
        @keyframes alIn {
          from { opacity:0; transform:translateY(18px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }

        /* animated gradient top bar */
        .al-card-bar {
          height: 3px;
          background: linear-gradient(90deg,#1e4fa6,#1ba699,#6ee7b7,#1e4fa6);
          background-size: 300% 100%;
          animation: alBar 5s linear infinite;
        }
        @keyframes alBar {
          0%   { background-position: 0%   0%; }
          100% { background-position: 300% 0%; }
        }

        .al-mobile-logo { display:none; padding:1.8rem 1.8rem 0; text-align:center; }
        .al-mobile-tagline {
          font-size: 0.72rem; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase;
          color: #6b7280; margin-top: 6px;
        }

        .al-card-title {
          font-size: 1.35rem; font-weight: 800;
          color: #0f172a; margin: 0 0 3px;
          text-align: center; letter-spacing: -0.02em;
          padding: 1.4rem 1.8rem 0;
        }
        .al-card-sub {
          font-size: 0.79rem; color: #ef4444;
          text-align: center; margin: 0 0 1.1rem;
          padding: 0 1.8rem;
        }

        /* form wrapper */
        .al-card form { padding: 0.3rem 1.8rem 0; }

        /* labels */
        .al-card .form-label {
          font-size: 0.78rem; font-weight: 600;
          color: #4b5563; margin-bottom: 4px; display: block;
        }

        /* inputs */
        .al-card .form-control {
          height: 42px; border-radius: 9px;
          border: 1.5px solid #e5e7eb;
          background: #fafafa;
          font-size: 0.88rem; color: #0f172a;
          padding: 0 12px; width: 100%;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          outline: none; box-sizing: border-box;
        }
        .al-card .form-control:focus {
          border-color: #1e4fa6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(30,79,166,0.09);
        }
        .al-card .form-control::placeholder { color: #9ca3af; }
        .al-card textarea.form-control { height: auto; padding: 10px 12px; }
        .al-card .mb-3 { margin-bottom: 0.85rem !important; }

        /* primary button */
        .al-card .btn-primary {
          height: 44px;
          background: linear-gradient(135deg,#1e4fa6 0%,#126f63 100%);
          border: none; border-radius: 10px;
          font-weight: 700; font-size: 0.9rem;
          color: #fff; width: 100%;
          display: flex; align-items: center; justify-content: center;
          gap: 7px; position: relative; overflow: hidden;
          box-shadow: 0 3px 14px rgba(30,79,166,0.22);
          transition: transform 0.18s, box-shadow 0.18s;
          cursor: pointer;
        }
        .al-card .btn-primary::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.18) 50%,transparent 70%);
          transform:translateX(-120%);
          transition:transform 0.5s ease;
        }
        .al-card .btn-primary:hover:not(:disabled) {
          transform:translateY(-2px);
          box-shadow:0 7px 22px rgba(30,79,166,0.3);
        }
        .al-card .btn-primary:hover:not(:disabled)::before { transform:translateX(120%); }
        .al-card .btn-primary:disabled { opacity:0.65; cursor:not-allowed; }

        /* OR divider */
        .al-card .text-center.my-3 {
          position:relative; font-size:0.72rem; font-weight:600;
          letter-spacing:0.07em; text-transform:uppercase;
          color:#9ca3af !important;
        }
        .al-card .text-center.my-3::before,
        .al-card .text-center.my-3::after {
          content:''; position:absolute; top:50%;
          width:calc(50% - 22px); height:1px; background:#e5e7eb;
        }
        .al-card .text-center.my-3::before { left:0; }
        .al-card .text-center.my-3::after  { right:0; }

        /* Google button */
        .al-card .btn-outline-danger {
          height: 42px; border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          background: #fff; color: #374151;
          font-weight: 600; font-size: 0.86rem; width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          transition: background 0.16s, border-color 0.16s, box-shadow 0.16s;
          cursor: pointer;
        }
        .al-card .btn-outline-danger:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #d1d5db;
          box-shadow: 0 2px 6px rgba(15,23,42,0.05);
        }

        /* alert */
        .al-card .alert {
          border-radius: 9px; font-size: 0.82rem;
          padding: 0.6rem 0.9rem; margin-bottom: 0.85rem;
        }

        /* inline links */
        .al-card a:not(.btn) { color:#1e4fa6; font-weight:600; text-decoration:none; }
        .al-card a:not(.btn):hover { text-decoration:underline; }

        /* password toggle */
        .al-card .position-relative .border-0 { color:#9ca3af; transition:color 0.16s; }
        .al-card .position-relative .border-0:hover { color:#1e4fa6; }

        /* secure */
        .al-secure {
          display:flex; align-items:center; justify-content:center; gap:5px;
          font-size:0.67rem; color:#9ca3af;
          padding:0.8rem 1.8rem 1.3rem;
        }

        /* ── Mobile ───────────────────────── */
        @media (max-width: 900px) {
          .al-left  { display:none; }
          .al-right {
            flex: 1;
            min-height: calc(100vh - 62px);
            padding: 2.5rem 1.2rem 3rem;
            background: #f5f7fb;
          }
          .al-card { max-width: 480px; margin: 0 auto; }
          .al-mobile-logo { display: block; }
        }
        @media (max-width: 576px) {
          .al-right { padding: 1.8rem 1rem 2.5rem; }
          .al-card { border-radius: 16px; }
          .al-card form { padding: 0.3rem 1.3rem 0; }
          .al-card-title, .al-card-sub { padding-left: 1.3rem; padding-right: 1.3rem; }
          .al-mobile-logo { padding: 1.2rem 1.3rem 0; }
          .al-secure { padding: 0.7rem 1.3rem 1.2rem; }
        }
      `}</style>
    </>
  );
}

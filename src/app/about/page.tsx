'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BreadcrumbAuto from '@/components/BreadcrumbAuto';

const STATS = [
  { value: '50K+',  label: 'Papers Generated'          },
  { value: '5K+',   label: 'Active Educators'           },
  { value: '100+',  label: 'Institutions Served'        },
  { value: '95%',   label: 'Satisfaction Rate'          },
];

const VALUES = [
  {
    color: '#1e4fa6',
    glyph: <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#fff"/>,
    title: 'Innovation',
    desc: 'Constantly evolving our platform to meet the changing demands of modern Pakistani classrooms.',
  },
  {
    color: '#0b8c80',
    glyph: <path d="M9 12l2 2 4-4M12 3a9 9 0 110 18A9 9 0 0112 3z" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    title: 'Quality',
    desc: 'Questions sourced from past papers, model papers, and our own curated question bank.',
  },
  {
    color: '#7c3aed',
    glyph: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    title: 'Accessibility',
    desc: 'Making it effortless for any educator to create papers in seconds — no technical expertise needed.',
  },
  {
    color: '#db6c1e',
    glyph: <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" stroke="#fff" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    title: 'Growth',
    desc: 'Helping educators save hours and helping students from Class 5–12 achieve their full potential.',
  },
];

const TEAM = [
  { name: 'Abdul Rauf',     role: 'Founder & CEO',        desc: 'Former educator with 10+ years in curriculum development', color: '#1e4fa6' },
  { name: 'Fahad Farooq',   role: 'CTO',                  desc: 'Tech entrepreneur passionate about EdTech solutions',      color: '#0b8c80' },
  { name: 'Dr. Saeed Ahmad',role: 'Head of Education',    desc: 'M.Phil in Educational Technology, 15 years teaching',     color: '#7c3aed' },
  { name: 'Mushtaq Ahmed',  role: 'Product Lead',         desc: 'Product manager focused on UX and innovation',            color: '#db6c1e' },
];

const MILESTONES = [
  { title: 'Founded',             desc: 'Born from a vision to transform educational assessment in Pakistan.' },
  { title: 'Platform Launch',     desc: 'Launched Examly — paper maker, quiz, and practice features go live.' },
  { title: '10,000+ Users',       desc: 'Reached a major milestone of educators and students across Pakistan.' },
  { title: 'New Features',        desc: 'Added job-test prep, game-mode quizzes, and advanced analytics.' },
];

const DIFFERENTIATORS = [
  { color: '#1e4fa6', title: 'Paper Ready in 1 Minute',    desc: 'Generate a complete BISE-aligned exam paper in under 60 seconds.' },
  { color: '#0b8c80', title: 'PTB Syllabus — All Classes', desc: 'Complete coverage of Class 5–12, all subjects, English & Urdu.' },
  { color: '#7c3aed', title: 'Game-Mode Quizzes',          desc: 'Students stay engaged with animated swimmer quizzes and streaks.' },
  { color: '#db6c1e', title: '3 Months Free Trial',        desc: 'No credit card needed — full access to every feature for 90 days.' },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>

      <main className="ab-root">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="ab-hero">
          <div className="ab-blob ab-ba" />
          <div className="ab-blob ab-bb" />

          <div className="ab-hero-inner">
            <div className="ab-hero-copy">
              <div className="ab-eyebrow">About Examly.pk</div>
              <h1 className="ab-hero-h1">
                Empowering Pakistan's<br />
                <span className="ab-grad">educators, one paper</span><br />
                at a time.
              </h1>
              <p className="ab-hero-sub">
                We're revolutionising the way teachers create papers and students
                practise — saving hours of work with a platform built specifically
                for the PTB curriculum.
              </p>
              <div className="ab-hero-ctas">
                <Link href="/auth/signup" className="ab-btn-primary">
                  Start 3 Months Free
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/how-examly-works" className="ab-btn-ghost">How It Works</Link>
              </div>
            </div>

            {/* stat grid */}
            <div className="ab-stat-grid">
              {STATS.map((s, i) => (
                <div key={i} className="ab-stat-card">
                  <div className="ab-stat-val">{s.value}</div>
                  <div className="ab-stat-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ MISSION & VISION ══════════════════════════════ */}
        <section className="ab-section ab-light">
          <div className="ab-container">
            <div className="ab-sec-head">
              <div className="ab-eyebrow ab-ey-dark">Who We Are</div>
              <h2 className="ab-h2">Mission &amp; Vision</h2>
            </div>
            <div className="ab-mv-grid">
              <div className="ab-mv-card">
                <div className="ab-mv-icon" style={{ background: 'linear-gradient(135deg,#1e4fa6,#2563eb)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                    <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                  </svg>
                </div>
                <h3 className="ab-mv-title">Our Mission</h3>
                <p className="ab-mv-desc">
                  To empower educators with intelligent tools that let them create
                  papers and tests in seconds — freeing up time to focus on what
                  truly matters: teaching. And to give students a platform to assess
                  their skills and drive their own academic success.
                </p>
              </div>
              <div className="ab-mv-card">
                <div className="ab-mv-icon" style={{ background: 'linear-gradient(135deg,#0b8c80,#0e7a71)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <h3 className="ab-mv-title">Our Vision</h3>
                <p className="ab-mv-desc">
                  A Pakistan where every educator — from any city, any school —
                  has access to powerful paper-making tools through Examly.pk.
                  And every student from Class 5 to 12 has a digital space to
                  strengthen their learning and reach their full potential.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ STORY ═════════════════════════════════════════ */}
        <section className="ab-section ab-brand">
          <svg className="ab-grid" aria-hidden="true">
            <defs>
              <pattern id="abgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#abgrid)" />
          </svg>
          <div className="ab-blob ab-ba" style={{ opacity: 0.12 }} />

          <div className="ab-container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="ab-story-grid">
              <div className="ab-story-copy">
                <div className="ab-eyebrow" style={{ color: '#6ee7b7', background: 'rgba(110,231,183,0.1)', borderColor: 'rgba(110,231,183,0.28)' }}>Our Story</div>
                <h2 className="ab-h2" style={{ color: '#e8eef8' }}>From a classroom problem<br />to a national solution.</h2>
                <p className="ab-story-p">
                  Examly was born from a simple observation: Pakistani educators
                  were spending 2–3 hours making a single paper — time that could
                  be spent teaching. Students, meanwhile, had no reliable digital
                  platform aligned to the PTB curriculum to practise on.
                </p>
                <p className="ab-story-p">
                  Founded in 2025 by a team of educators and technologists, we
                  combined deep subject expertise with modern AI to build a
                  platform that generates a complete, BISE-aligned exam paper in
                  under 1 minute.
                </p>
                <p className="ab-story-p" style={{ marginBottom: 0 }}>
                  Today we serve thousands of teachers and students across Pakistan,
                  and we're just getting started.
                </p>
              </div>

              {/* timeline */}
              <div className="ab-timeline">
                {MILESTONES.map((m, i) => (
                  <div key={i} className="ab-tl-item">
                    <div className="ab-tl-dot" />
                    {i < MILESTONES.length - 1 && <div className="ab-tl-line" />}
                    <div className="ab-tl-body">
                      <div className="ab-tl-title">{m.title}</div>
                      <div className="ab-tl-desc">{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ VALUES ════════════════════════════════════════ */}
        <section className="ab-section ab-white">
          <div className="ab-container">
            <div className="ab-sec-head">
              <div className="ab-eyebrow ab-ey-dark">What Drives Us</div>
              <h2 className="ab-h2">Our Core Values</h2>
              <p className="ab-sec-sub">The principles behind every decision we make</p>
            </div>
            <div className="ab-val-grid">
              {VALUES.map((v, i) => (
                <div key={i} className="ab-val-card">
                  <div className="ab-val-icon" style={{ background: v.color }}>
                    <svg width="24" height="24" viewBox="0 0 24 24">{v.glyph}</svg>
                  </div>
                  <h4 className="ab-val-title">{v.title}</h4>
                  <p className="ab-val-desc">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TEAM ══════════════════════════════════════════ */}
        <section className="ab-section ab-light">
          <div className="ab-container">
            <div className="ab-sec-head">
              <div className="ab-eyebrow ab-ey-dark">The People</div>
              <h2 className="ab-h2">Meet Our Team</h2>
              <p className="ab-sec-sub">Educators and technologists working together</p>
            </div>
            <div className="ab-team-grid">
              {TEAM.map((m, i) => (
                <div key={i} className="ab-team-card">
                  <div className="ab-team-avatar" style={{ background: `linear-gradient(135deg,${m.color},${m.color}99)` }}>
                    {m.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <h4 className="ab-team-name">{m.name}</h4>
                  <div className="ab-team-role" style={{ color: m.color }}>{m.role}</div>
                  <p className="ab-team-desc">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ DIFFERENTIATORS ═══════════════════════════════ */}
        <section className="ab-section ab-white">
          <div className="ab-container">
            <div className="ab-sec-head">
              <div className="ab-eyebrow ab-ey-dark">Why Examly</div>
              <h2 className="ab-h2">What makes us different</h2>
            </div>
            <div className="ab-diff-grid">
              {DIFFERENTIATORS.map((d, i) => (
                <div key={i} className="ab-diff-card">
                  <div className="ab-diff-dot" style={{ background: d.color, boxShadow: `0 0 10px ${d.color}60` }} />
                  <div>
                    <h4 className="ab-diff-title">{d.title}</h4>
                    <p className="ab-diff-desc">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════ */}
        <section className="ab-cta">
          <div className="ab-blob ab-ba" />
          <div className="ab-blob ab-bb" />
          <div className="ab-cta-inner">
            <div className="ab-eyebrow" style={{ color: '#1ba699', background: 'rgba(27,166,153,0.12)', borderColor: 'rgba(27,166,153,0.35)' }}>Join Us</div>
            <h2 className="ab-cta-h2">Join the Examly community</h2>
            <p className="ab-cta-sub">Be part of Pakistan's fastest-growing EdTech platform. Start free — no card needed.</p>
            <div className="ab-cta-btns">
              <Link href="/auth/signup" className="ab-btn-primary">🚀 Start 3 Months Free</Link>
              <Link href="/how-examly-works" className="ab-btn-ghost">How It Works →</Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />

      <style jsx>{`
        /* ── base ─────────────────────────────── */
        .ab-root { overflow-x: hidden; }
        .ab-container { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }
        .ab-section { padding: 5rem 0; }
        .ab-white { background: #fff; }
        .ab-light { background: #f5f7fb; }
        .ab-brand {
          background: linear-gradient(145deg,#0f2452 0%,#1e4fa6 48%,#0d6b60 100%);
          position: relative; overflow: hidden;
        }
        .ab-grid { position:absolute;inset:0;width:100%;height:100%;pointer-events:none; }
        .ab-blob { position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none; }
        .ab-ba { width:500px;height:500px;background:rgba(27,166,153,0.32);top:-150px;right:-80px; }
        .ab-bb { width:380px;height:380px;background:rgba(7,62,140,0.24);bottom:-120px;left:-60px; }

        /* section head */
        .ab-sec-head { text-align:center;margin-bottom:3rem; }
        .ab-eyebrow {
          display:inline-flex;align-items:center;
          font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:#1ba699;background:rgba(27,166,153,0.12);border:1px solid rgba(27,166,153,0.35);
          border-radius:999px;padding:4px 14px;margin-bottom:0.9rem;
        }
        .ab-ey-dark { color:#1e4fa6;background:rgba(30,79,166,0.08);border-color:rgba(30,79,166,0.2); }
        .ab-h2 {
          font-size:clamp(1.7rem,3vw,2.4rem);font-weight:800;
          color:#0f172a;letter-spacing:-0.025em;margin-bottom:0.5rem;
        }
        .ab-sec-sub { font-size:0.95rem;color:#64748b;margin:0; }

        /* ── hero ─────────────────────────────── */
        .ab-hero {
          background:linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding:5.5rem 1.5rem 4.5rem;position:relative;overflow:hidden;
        }
        .ab-hero-inner {
          max-width:1120px;margin:0 auto;
          display:flex;align-items:center;gap:4rem;position:relative;z-index:1;
        }
        .ab-hero-copy { flex:1 1 55%; }
        .ab-hero-h1 {
          font-size:clamp(2.1rem,3.8vw,3.2rem);font-weight:800;
          color:var(--text-main,#0f172a);line-height:1.13;letter-spacing:-0.03em;margin-bottom:1.1rem;
        }
        .ab-grad {
          background:linear-gradient(90deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .ab-hero-sub { font-size:1rem;color:var(--text-secondary,#334155);line-height:1.7;margin-bottom:2rem;max-width:500px; }
        .ab-hero-ctas { display:flex;gap:1rem;flex-wrap:wrap; }

        /* stat grid */
        .ab-stat-grid {
          flex:0 0 42%;
          display:grid;grid-template-columns:1fr 1fr;gap:1rem;
        }
        .ab-stat-card {
          background:#fff;border:1px solid var(--border-subtle,#e2e8f0);
          border-radius:16px;padding:1.4rem 1.2rem;text-align:center;
          box-shadow:var(--shadow-sm);
          transition:box-shadow 0.2s,transform 0.2s;
        }
        .ab-stat-card:hover { box-shadow:var(--shadow-md);transform:translateY(-2px); }
        .ab-stat-val { font-size:1.9rem;font-weight:900;color:var(--text-main,#0f172a);line-height:1;margin-bottom:4px; }
        .ab-stat-lbl { font-size:0.72rem;font-weight:600;color:var(--text-muted,#64748b);text-transform:uppercase;letter-spacing:0.06em; }

        /* ── buttons ──────────────────────────── */
        /* :global() is required — styled-jsx doesn't scope next/link's
           rendered <a>, only native lowercase JSX elements. */
        :global(.ab-btn-primary) {
          display:inline-flex;align-items:center;gap:8px;
          background:linear-gradient(135deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          color:#fff;font-weight:700;font-size:0.9rem;
          padding:0.72rem 1.5rem;border-radius:10px;border:none;
          text-decoration:none;box-shadow:0 6px 18px -4px rgba(7,62,140,0.45);
          transition:transform 0.18s,box-shadow 0.18s;
        }
        :global(.ab-btn-primary):hover { transform:translateY(-2px);box-shadow:0 10px 26px -4px rgba(7,62,140,0.5);color:#fff;text-decoration:none; }
        :global(.ab-btn-ghost) {
          display:inline-flex;align-items:center;gap:7px;
          background:transparent;border:1.5px solid var(--border-medium,#cbd5e1);
          color:var(--text-main,#0f172a);font-weight:600;font-size:0.9rem;
          padding:0.72rem 1.5rem;border-radius:10px;text-decoration:none;
          transition:background 0.18s,border-color 0.18s,color 0.18s;
        }
        :global(.ab-btn-ghost):hover { background:var(--brand-primary-50,#eff6ff);border-color:var(--brand-primary,#073e8c);color:var(--brand-primary,#073e8c);text-decoration:none; }

        /* ── mission / vision ─────────────────── */
        .ab-mv-grid { display:grid;grid-template-columns:1fr 1fr;gap:1.5rem; }
        .ab-mv-card {
          background:#fff;border-radius:20px;padding:2rem 1.8rem;
          border:1px solid #e8eef5;
          box-shadow:0 2px 8px rgba(15,23,42,0.04);
          transition:transform 0.2s,box-shadow 0.2s;
        }
        .ab-mv-card:hover { transform:translateY(-4px);box-shadow:0 14px 40px rgba(15,23,42,0.09); }
        .ab-mv-icon {
          width:52px;height:52px;border-radius:14px;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:1.2rem;box-shadow:0 4px 14px rgba(0,0,0,0.15);
        }
        .ab-mv-title { font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:0.7rem; }
        .ab-mv-desc { font-size:0.9rem;color:#475569;line-height:1.7;margin:0; }

        /* ── story ────────────────────────────── */
        .ab-story-grid {
          display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:start;
        }
        .ab-story-p { font-size:0.92rem;color:rgba(220,232,255,0.72);line-height:1.75;margin-bottom:1rem; }

        /* timeline */
        .ab-timeline { display:flex;flex-direction:column;gap:0; }
        .ab-tl-item { display:flex;gap:1rem;position:relative; }
        .ab-tl-dot {
          width:14px;height:14px;border-radius:50%;flex-shrink:0;
          background:#6ee7b7;margin-top:4px;position:relative;z-index:1;
          box-shadow:0 0 8px #6ee7b760;
        }
        .ab-tl-line {
          position:absolute;left:6px;top:18px;bottom:-24px;
          width:2px;background:rgba(110,231,183,0.25);
        }
        .ab-tl-body { padding-bottom:2rem; }
        .ab-tl-title { font-size:0.95rem;font-weight:800;color:#e8eef8;margin-bottom:3px; }
        .ab-tl-desc { font-size:0.82rem;color:rgba(220,232,255,0.6);line-height:1.6; }

        /* ── values ───────────────────────────── */
        .ab-val-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1.2rem; }
        .ab-val-card {
          background:#f5f7fb;border-radius:16px;padding:1.6rem 1.3rem;
          border:1px solid #e8eef5;
          transition:transform 0.2s,box-shadow 0.2s,background 0.2s;
        }
        .ab-val-card:hover { transform:translateY(-5px);box-shadow:0 12px 36px rgba(15,23,42,0.08);background:#fff; }
        .ab-val-icon {
          width:46px;height:46px;border-radius:12px;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:1rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);
        }
        .ab-val-title { font-size:0.95rem;font-weight:800;color:#0f172a;margin-bottom:0.4rem; }
        .ab-val-desc { font-size:0.82rem;color:#64748b;line-height:1.6;margin:0; }

        /* ── team ─────────────────────────────── */
        .ab-team-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1.3rem; }
        .ab-team-card {
          background:#fff;border-radius:18px;padding:1.8rem 1.4rem;text-align:center;
          border:1px solid #e8eef5;
          box-shadow:0 2px 8px rgba(15,23,42,0.04);
          transition:transform 0.2s,box-shadow 0.2s;
        }
        .ab-team-card:hover { transform:translateY(-5px);box-shadow:0 14px 40px rgba(15,23,42,0.09); }
        .ab-team-avatar {
          width:72px;height:72px;border-radius:50%;
          color:#fff;font-size:1.4rem;font-weight:800;
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 1rem;
          box-shadow:0 6px 20px rgba(0,0,0,0.18);
        }
        .ab-team-name { font-size:1rem;font-weight:800;color:#0f172a;margin-bottom:3px; }
        .ab-team-role { font-size:0.78rem;font-weight:700;margin-bottom:0.6rem; }
        .ab-team-desc { font-size:0.8rem;color:#64748b;line-height:1.55;margin:0; }

        /* ── differentiators ──────────────────── */
        .ab-diff-grid { display:grid;grid-template-columns:1fr 1fr;gap:1.2rem; }
        .ab-diff-card {
          display:flex;gap:1rem;align-items:flex-start;
          background:#f5f7fb;border-radius:14px;padding:1.4rem 1.3rem;
          border:1px solid #e8eef5;
          transition:transform 0.2s,box-shadow 0.2s;
        }
        .ab-diff-card:hover { transform:translateY(-3px);box-shadow:0 8px 24px rgba(15,23,42,0.07); }
        .ab-diff-dot { width:10px;height:10px;border-radius:50%;flex-shrink:0;margin-top:6px; }
        .ab-diff-title { font-size:0.95rem;font-weight:800;color:#0f172a;margin-bottom:3px; }
        .ab-diff-desc { font-size:0.83rem;color:#475569;line-height:1.6;margin:0; }

        /* ── cta ──────────────────────────────── */
        .ab-cta {
          background:linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding:5.5rem 1.5rem;text-align:center;position:relative;overflow:hidden;
        }
        .ab-cta-inner { position:relative;z-index:1;max-width:640px;margin:0 auto; }
        .ab-cta-h2 {
          font-size:clamp(1.8rem,3.5vw,2.8rem);font-weight:800;
          color:var(--text-main,#0f172a);letter-spacing:-0.025em;margin-bottom:0.8rem;
        }
        .ab-cta-sub { font-size:0.95rem;color:var(--text-secondary,#334155);margin-bottom:2rem; }
        .ab-cta-btns { display:flex;gap:1rem;justify-content:center;flex-wrap:wrap; }

        /* ── responsive ───────────────────────── */
        @media(max-width:1024px){
          .ab-val-grid { grid-template-columns:repeat(2,1fr); }
          .ab-team-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media(max-width:900px){
          .ab-hero-inner { flex-direction:column;gap:2.5rem; }
          .ab-stat-grid { grid-template-columns:repeat(4,1fr); }
          .ab-mv-grid,
          .ab-story-grid,
          .ab-diff-grid { grid-template-columns:1fr; }
        }
        @media(max-width:640px){
          .ab-hero { padding:4rem 1rem 3rem; }
          .ab-section { padding:3.5rem 0; }
          .ab-stat-grid { grid-template-columns:1fr 1fr;gap:0.75rem; }
          .ab-val-grid,
          .ab-team-grid { grid-template-columns:1fr; }
          .ab-cta { padding:4rem 1rem; }
        }
      `}</style>
    </>
  );
}

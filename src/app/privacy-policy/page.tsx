'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BreadcrumbAuto from '@/components/BreadcrumbAuto';

const SECTIONS = [
  { id: 'collect',    label: 'Information We Collect'      },
  { id: 'use',        label: 'How We Use Your Data'         },
  { id: 'sharing',    label: 'Data Sharing'                 },
  { id: 'trial',      label: 'Free Trial Policy'            },
  { id: 'referral',   label: 'Referral Program'             },
  { id: 'security',   label: 'Data Security'                },
  { id: 'cookies',    label: 'Cookies & Analytics'          },
  { id: 'children',   label: "Children's Privacy"           },
  { id: 'updates',    label: 'Policy Updates'               },
  { id: 'contact',    label: 'Contact Us'                   },
];

export default function PrivacyPolicy() {
  const date = new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>
      <main className="pp-root">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="pp-hero">
          <svg className="pp-grid" aria-hidden="true">
            <defs>
              <pattern id="ppgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ppgrid)" />
          </svg>
          <div className="pp-blob pp-ba" /><div className="pp-blob pp-bb" />

          <div className="pp-hero-inner">
            <div className="pp-eyebrow">Legal</div>
            <h1 className="pp-h1">Privacy Policy</h1>
            <p className="pp-hero-sub">
              Your privacy matters. Here's exactly how Examly.pk collects,
              uses, and protects your personal information.
            </p>
            <div className="pp-hero-meta">
              <span className="pp-meta-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Effective: {date}
              </span>
              <span className="pp-meta-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Examly.pk
              </span>
            </div>
          </div>
        </section>

        {/* ══ BODY ══════════════════════════════════════════ */}
        <div className="pp-body">
          {/* sidebar TOC */}
          <aside className="pp-sidebar">
            <div className="pp-toc">
              <div className="pp-toc-title">On this page</div>
              {SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`} className="pp-toc-link">{s.label}</a>
              ))}
            </div>
          </aside>

          {/* content */}
          <article className="pp-content">

            {/* intro */}
            <div className="pp-intro">
              At <strong>Examly.pk</strong>, we respect the privacy of teachers, institutions,
              and educational professionals who use our platform to create question papers,
              assessments, and tests. This Privacy Policy explains how we collect, use, and
              protect your personal information.
            </div>

            {/* 1 */}
            <section id="collect" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#1e4fa6' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Information We Collect</h2>
                <p>When you register and use Examly.pk, we may collect:</p>
                <ul className="pp-list">
                  {['Full name', 'Email address', 'Mobile / cell phone number', 'School, college, or institute name', 'Account and profile information', 'Generated question papers and assessments'].map((item, i) => (
                    <li key={i}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#1e4fa6" fillOpacity="0.1"/><path d="M7 12l3.5 3.5L17 8" stroke="#1e4fa6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 2 */}
            <section id="use" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#0b8c80' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>How We Use Your Information</h2>
                <p>
                  Your data is used strictly to manage your account, enable paper generation,
                  provide platform features, verify eligibility for free trials or referrals,
                  and communicate important service-related updates. We never use your data
                  for advertising purposes.
                </p>
              </div>
            </section>

            {/* 3 — highlighted green */}
            <section id="sharing" className="pp-sec pp-highlight pp-highlight-green">
              <div className="pp-sec-icon" style={{ background: '#16a34a' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Data Sharing &amp; Confidentiality</h2>
                <p>
                  Examly.pk <strong>does not sell, rent, or share</strong> your personal
                  information with any third party. Your email address, mobile number,
                  institute details, and generated content remain completely private and
                  confidential.
                </p>
              </div>
            </section>

            {/* 4 — highlighted amber */}
            <section id="trial" className="pp-sec pp-highlight pp-highlight-amber">
              <div className="pp-sec-icon" style={{ background: '#d97706' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Free Trial Policy</h2>
                <p>
                  Examly.pk offers a <strong>3-month (90 days) free trial</strong> to eligible
                  users. To avail this trial, users must register on the platform (or sign in
                  via Google) and complete their profile with a <strong>valid mobile number</strong>.
                </p>
                <p>
                  Providing an incorrect, fake, or invalid mobile number may result in
                  immediate suspension of the trial or permanent removal of the account
                  without prior notice.
                </p>
              </div>
            </section>

            {/* 5 — highlighted blue */}
            <section id="referral" className="pp-sec pp-highlight pp-highlight-blue">
              <div className="pp-sec-icon" style={{ background: '#2563eb' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Referral Program Policy</h2>
                <p>
                  Users who refer Examly.pk to others via their referral code will earn
                  <strong> 1 month of free access</strong> for each successful referral.
                  Rewards are granted only when the referred user successfully registers,
                  completes their profile, and provides a valid mobile number.
                </p>
                <p>
                  Examly.pk reserves the right to withhold or cancel referral rewards in
                  case of misuse, fraud, or incomplete verification.
                </p>
              </div>
            </section>

            {/* 6 */}
            <section id="security" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#7c3aed' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Data Security</h2>
                <p>
                  We implement appropriate security measures including secure authentication,
                  encrypted storage, and restricted internal access to protect your data from
                  unauthorised access or disclosure.
                </p>
              </div>
            </section>

            {/* 7 */}
            <section id="cookies" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#db6c1e' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1" fill="#fff"/><circle cx="15" cy="8" r="1" fill="#fff"/><circle cx="10" cy="15" r="1" fill="#fff"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Cookies &amp; Analytics</h2>
                <p>
                  Examly.pk may use cookies and similar technologies to maintain user sessions
                  and improve platform performance. Cookies never store sensitive personal
                  information.
                </p>
              </div>
            </section>

            {/* 8 */}
            <section id="children" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#0b8c80' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Children's Privacy</h2>
                <p>
                  Examly.pk is designed for teachers and educational professionals only.
                  We do not knowingly collect personal information from children under the
                  age of 13.
                </p>
              </div>
            </section>

            {/* 9 */}
            <section id="updates" className="pp-sec">
              <div className="pp-sec-icon" style={{ background: '#1e4fa6' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
              </div>
              <div className="pp-sec-body">
                <h2>Policy Updates</h2>
                <p>
                  This Privacy Policy may be updated from time to time. Continued use of the
                  platform after changes are posted indicates your acceptance of the updated policy.
                  We recommend reviewing this page periodically.
                </p>
              </div>
            </section>

            {/* 10 — contact */}
            <section id="contact" className="pp-contact-box">
              <div className="pp-contact-icon">✉️</div>
              <h3>Questions about this policy?</h3>
              <p>If you have any questions or concerns about our Privacy Policy, reach out to us.</p>
              <div className="pp-contact-links">
                <a href="mailto:examlypk@gmail.com" className="pp-contact-link pp-cl-email">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  examlypk@gmail.com
                </a>
                <a href="tel:03430041686" className="pp-contact-link pp-cl-phone">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.1 2.18 2 2 0 012.09.02h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  0343-0041686
                </a>
              </div>
              <Link href="/contact" className="pp-contact-cta">Go to Contact Page →</Link>
            </section>

          </article>
        </div>

      </main>
      <Footer />

      <style jsx>{`
        /* ── base ─────────────────────────────────── */
        .pp-root { overflow-x:hidden; }

        /* ── hero ─────────────────────────────────── */
        .pp-hero {
          background:linear-gradient(145deg,#0f2452 0%,#1e4fa6 48%,#0d6b60 100%);
          padding:5rem 1.5rem 4rem;text-align:center;position:relative;overflow:hidden;
        }
        .pp-grid { position:absolute;inset:0;width:100%;height:100%;pointer-events:none; }
        .pp-blob { position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none; }
        .pp-ba { width:450px;height:450px;background:rgba(100,210,190,0.14);top:-130px;right:-80px; }
        .pp-bb { width:350px;height:350px;background:rgba(30,79,166,0.18);bottom:-100px;left:-60px; }

        .pp-hero-inner { position:relative;z-index:1;max-width:680px;margin:0 auto; }
        .pp-eyebrow {
          display:inline-flex;align-items:center;
          font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:#6ee7b7;background:rgba(110,231,183,0.1);border:1px solid rgba(110,231,183,0.28);
          border-radius:999px;padding:4px 14px;margin-bottom:0.9rem;
        }
        .pp-h1 {
          font-size:clamp(2rem,4vw,3rem);font-weight:800;color:#e8eef8;
          letter-spacing:-0.025em;margin-bottom:0.9rem;
        }
        .pp-hero-sub { font-size:1rem;color:rgba(220,232,255,0.68);line-height:1.7;margin-bottom:1.5rem; }
        .pp-hero-meta { display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap; }
        .pp-meta-pill {
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
          border-radius:999px;padding:5px 14px;
          font-size:0.78rem;font-weight:600;color:rgba(220,232,255,0.78);
        }

        /* ── body layout ──────────────────────────── */
        .pp-body {
          display:grid;grid-template-columns:220px 1fr;gap:0;
          max-width:1120px;margin:0 auto;padding:3.5rem 1.5rem 5rem;
          align-items:start;
        }

        /* sidebar */
        .pp-sidebar { position:sticky;top:90px;padding-right:2rem; }
        .pp-toc {
          background:#f5f7fb;border-radius:16px;padding:1.2rem 1.1rem;
          border:1px solid #e8eef5;
        }
        .pp-toc-title {
          font-size:0.68rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
          color:#94a3b8;margin-bottom:0.8rem;
        }
        .pp-toc-link {
          display:block;font-size:0.8rem;font-weight:500;color:#475569;
          padding:0.35rem 0.5rem;border-radius:7px;text-decoration:none;
          transition:background 0.16s,color 0.16s;margin-bottom:2px;
        }
        .pp-toc-link:hover { background:#e8eef5;color:#1e4fa6; }

        /* content */
        .pp-content { min-width:0; }
        .pp-intro {
          background:#f0f4ff;border:1px solid #c7d8f8;border-radius:14px;
          padding:1.2rem 1.4rem;font-size:0.9rem;color:#374151;line-height:1.7;
          margin-bottom:2rem;
        }

        /* section */
        .pp-sec {
          display:flex;gap:1.2rem;align-items:flex-start;
          background:#fff;border-radius:16px;padding:1.6rem 1.6rem;
          border:1px solid #e8eef5;margin-bottom:1rem;
          box-shadow:0 2px 6px rgba(15,23,42,0.03);
          transition:box-shadow 0.2s;
          scroll-margin-top:100px;
        }
        .pp-sec:hover { box-shadow:0 6px 24px rgba(15,23,42,0.07); }

        /* highlighted variants */
        .pp-highlight-green { background:#f0fdf4;border-color:#bbf7d0; }
        .pp-highlight-amber { background:#fffbeb;border-color:#fde68a; }
        .pp-highlight-blue  { background:#eff6ff;border-color:#bfdbfe; }

        .pp-sec-icon {
          width:42px;height:42px;border-radius:12px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 12px rgba(0,0,0,0.14);margin-top:2px;
        }
        .pp-sec-body h2 {
          font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 0.6rem;
        }
        .pp-sec-body p { font-size:0.87rem;color:#475569;line-height:1.72;margin:0 0 0.6rem; }
        .pp-sec-body p:last-child { margin-bottom:0; }

        .pp-list { list-style:none;padding:0;margin:0.4rem 0 0;display:flex;flex-direction:column;gap:7px; }
        .pp-list li { display:flex;align-items:center;gap:8px;font-size:0.86rem;color:#374151; }

        /* contact box */
        .pp-contact-box {
          background:linear-gradient(135deg,#f0f4ff,#e8f8f5);
          border:1.5px solid #c7d8f8;border-radius:20px;
          padding:2.5rem 2rem;text-align:center;
          scroll-margin-top:100px;
        }
        .pp-contact-icon { font-size:2.2rem;margin-bottom:0.8rem; }
        .pp-contact-box h3 { font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:0.5rem; }
        .pp-contact-box p  { font-size:0.88rem;color:#475569;margin-bottom:1.3rem; }
        .pp-contact-links { display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.3rem; }
        .pp-contact-link {
          display:inline-flex;align-items:center;gap:7px;
          font-size:0.86rem;font-weight:700;padding:0.55rem 1.2rem;
          border-radius:999px;text-decoration:none;transition:opacity 0.18s;
        }
        .pp-contact-link:hover { opacity:0.82; }
        .pp-cl-email { background:#eff6ff;color:#1e4fa6;border:1px solid #bfdbfe; }
        .pp-cl-phone { background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0; }
        .pp-contact-cta {
          display:inline-flex;align-items:center;gap:6px;
          font-size:0.86rem;font-weight:700;color:#1e4fa6;text-decoration:none;
        }
        .pp-contact-cta:hover { text-decoration:underline; }

        /* ── responsive ───────────────────────────── */
        @media(max-width:820px) {
          .pp-body { grid-template-columns:1fr;padding:2.5rem 1rem 4rem; }
          .pp-sidebar { position:static;padding:0;margin-bottom:2rem; }
          .pp-toc { display:flex;flex-wrap:wrap;gap:6px;background:none;border:none;padding:0; }
          .pp-toc-title { width:100%; }
          .pp-toc-link { background:#f0f4ff;border:1px solid #c7d8f8;padding:4px 12px;font-size:0.75rem; }
        }
        @media(max-width:576px) {
          .pp-hero { padding:4rem 1rem 3rem; }
          .pp-sec { flex-direction:column;gap:0.8rem; }
          .pp-contact-box { padding:1.8rem 1.2rem; }
        }
      `}</style>
    </>
  );
}

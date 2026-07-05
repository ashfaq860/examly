'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BreadcrumbAuto from '@/components/BreadcrumbAuto';

type Package = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  paper_quantity: number | null;
  duration_days: number | null;
  price: number;
  is_active: boolean;
};

/* accent gradient per card index, cycles if more than 3 */
const ACCENTS = [
  { from: '#1e4fa6', to: '#2563eb' },
  { from: '#0b8c80', to: '#0e7a71' },
  { from: '#7c3aed', to: '#6d28d9' },
  { from: '#db6c1e', to: '#c2410c' },
];

function durationLabel(days: number | null) {
  if (!days) return null;
  if (days % 365 === 0) return `${days / 365} Year${days / 365 > 1 ? 's' : ''}`;
  if (days % 30 === 0) return `${days / 30} Month${days / 30 > 1 ? 's' : ''}`;
  return `${days} Days`;
}

/* skeleton card for loading state */
function SkeletonCard() {
  return (
    <div className="pkg-card pkg-skel">
      <div className="pkg-skel-head" />
      <div className="pkg-card-body">
        <div className="pkg-skel-line" style={{ width: '55%', height: 14 }} />
        <div className="pkg-skel-line" style={{ width: '80%', height: 10, marginTop: 10 }} />
        <div className="pkg-skel-line" style={{ width: '65%', height: 10, marginTop: 6 }} />
        <div className="pkg-skel-line" style={{ width: '40%', height: 38, marginTop: 24, borderRadius: 10 }} />
      </div>
    </div>
  );
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('packages')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setPackages(data || []);
        setLoading(false);
      });
  }, []);

  /* mark the middle card as popular */
  const popularIdx = Math.floor((packages.length - 1) / 2);

  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>

      <main className="pkg-root">

        {/* ══ HERO ══════════════════════════════════════ */}
        <section className="pkg-hero">
          <div className="pkg-blob pkg-ba" />
          <div className="pkg-blob pkg-bb" />

          <div className="pkg-hero-inner">
            <div className="pkg-eyebrow">Flexible Pricing</div>
            <h1 className="pkg-hero-h1">
              Simple plans for every<br />
              <span className="pkg-grad">educator & academy</span>
            </h1>
            <p className="pkg-hero-sub">
              Start with a 3-month free trial — no card needed. Upgrade whenever you're ready.
            </p>

            {/* trust pills */}
            <div className="pkg-trust-row">
              {[
                { icon: '🎁', text: '3 Months Free to Start' },
                { icon: '🔒', text: 'Secure Payments' },
                { icon: '📞', text: 'We Contact You First' },
              ].map((t, i) => (
                <div key={i} className="pkg-trust-pill">
                  <span>{t.icon}</span>{t.text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FREE TRIAL BANNER ═════════════════════════ */}
        <div className="pkg-trial-bar">
          <span className="pkg-trial-icon">🎁</span>
          <span>
            <strong>Not ready to subscribe?</strong> Start with 3 months completely free —
            no credit card, no commitment.
          </span>
          <Link href="/auth/signup" className="pkg-trial-btn">Claim Free Trial →</Link>
        </div>

        {/* ══ CARDS ═════════════════════════════════════ */}
        <section className="pkg-section">
          <div className="pkg-container">

            {loading ? (
              <div className="pkg-grid-cards">
                {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : packages.length === 0 ? (
              <div className="pkg-empty">
                <div className="pkg-empty-icon">📦</div>
                <h3>No packages available right now</h3>
                <p>Check back soon, or start your free trial while we get things ready.</p>
                <Link href="/auth/signup" className="pkg-btn-primary">Start Free Trial</Link>
              </div>
            ) : (
              <div className="pkg-grid-cards">
                {packages.map((pkg, i) => {
                  const accent = ACCENTS[i % ACCENTS.length];
                  const popular = i === popularIdx;
                  const dur = durationLabel(pkg.duration_days);

                  return (
                    <div key={pkg.id} className={`pkg-card${popular ? ' pkg-popular' : ''}`}>
                      {popular && <div className="pkg-popular-badge">⭐ Most Popular</div>}

                      {/* header */}
                      <div className="pkg-card-head" style={{
                        background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      }}>
                        <div className="pkg-type-tag">{pkg.type.replace(/_/g, ' ')}</div>
                        <div className="pkg-card-name">{pkg.name}</div>
                        <div className="pkg-price-row">
                          <span className="pkg-currency">Rs</span>
                          <span className="pkg-price">{pkg.price.toLocaleString()}</span>
                          {dur && <span className="pkg-period">/ {dur}</span>}
                        </div>
                      </div>

                      {/* body */}
                      <div className="pkg-card-body">
                        {pkg.description && (
                          <p className="pkg-desc">{pkg.description}</p>
                        )}

                        <ul className="pkg-feature-list">
                          {pkg.paper_quantity != null && (
                            <li>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="12" fill={accent.from} fillOpacity="0.12"/>
                                <path d="M7 12l3.5 3.5L17 8" stroke={accent.from} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span><strong>{pkg.paper_quantity}</strong> papers included</span>
                            </li>
                          )}
                          {dur && (
                            <li>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="12" fill={accent.from} fillOpacity="0.12"/>
                                <path d="M7 12l3.5 3.5L17 8" stroke={accent.from} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span>Valid for <strong>{dur}</strong></span>
                            </li>
                          )}
                          <li>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="12" fill={accent.from} fillOpacity="0.12"/>
                              <path d="M7 12l3.5 3.5L17 8" stroke={accent.from} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>PDF &amp;  download</span>
                          </li>
                          <li>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="12" fill={accent.from} fillOpacity="0.12"/>
                              <path d="M7 12l3.5 3.5L17 8" stroke={accent.from} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>BISE aligned — all PTB subjects</span>
                          </li>
                          <li>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="12" fill={accent.from} fillOpacity="0.12"/>
                              <path d="M7 12l3.5 3.5L17 8" stroke={accent.from} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>Priority support</span>
                          </li>
                        </ul>

                        <Link
                          href="/auth/login"
                          className="pkg-card-btn"
                          style={{
                            background: popular
                              ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                              : '#fff',
                            color: popular ? '#fff' : accent.from,
                            border: popular ? 'none' : `1.5px solid ${accent.from}`,
                          }}
                        >
                          Get Started
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </Link>

                        <p className="pkg-note">We'll contact you to verify & activate.</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ══ HOW IT WORKS STRIP ════════════════════════ */}
        <section className="pkg-how">
          <div className="pkg-container">
            <div className="pkg-how-title">How subscribing works</div>
            <div className="pkg-how-steps">
              {[
                { n: '1', label: 'Pick a plan above', icon: '📋' },
                { n: '2', label: 'Log in & select package', icon: '🔑' },
                { n: '3', label: 'We verify & activate', icon: '✅' },
              ].map((s, i) => (
                <div key={i} className="pkg-how-step">
                  {i > 0 && <div className="pkg-how-arrow">→</div>}
                  <div className="pkg-how-icon">{s.icon}</div>
                  <div className="pkg-how-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ BOTTOM CTA ════════════════════════════════ */}
        <section className="pkg-cta">
          <div className="pkg-blob pkg-ba" />
          <div className="pkg-blob pkg-bb" />
          <div className="pkg-cta-inner">
            <h2 className="pkg-cta-h2">Still deciding? Start free.</h2>
            <p className="pkg-cta-sub">3 months, unlimited papers, zero cost — no card needed.</p>
            <div className="pkg-cta-btns">
              <Link href="/auth/signup" className="pkg-btn-primary">🚀 Start Free Trial</Link>
              <Link href="/how-examly-works" className="pkg-btn-ghost">How it works →</Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />

      <style jsx>{`
        /* ── base ─────────────────────────── */
        .pkg-root { overflow-x: hidden; }
        .pkg-container { max-width: 1120px; margin: 0 auto; padding: 0 1.5rem; }

        /* ── hero ─────────────────────────── */
        .pkg-hero {
          background: linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding: 5.5rem 1.5rem 4rem;
          position: relative; overflow: hidden; text-align: center;
        }
        .pkg-grid { position:absolute;inset:0;width:100%;height:100%;pointer-events:none; }
        .pkg-blob { position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none; }
        .pkg-ba { width:500px;height:500px;background:rgba(27,166,153,0.32);top:-150px;right:-80px; }
        .pkg-bb { width:380px;height:380px;background:rgba(7,62,140,0.24);bottom:-120px;left:-60px; }

        .pkg-hero-inner { position:relative;z-index:1;max-width:700px;margin:0 auto; }
        .pkg-eyebrow {
          display:inline-flex;align-items:center;
          font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:#1ba699;background:rgba(27,166,153,0.12);border:1px solid rgba(27,166,153,0.35);
          border-radius:999px;padding:4px 14px;margin-bottom:1rem;
        }
        .pkg-hero-h1 {
          font-size:clamp(2rem,4vw,3rem);font-weight:800;color:var(--text-main,#0f172a);
          line-height:1.15;letter-spacing:-0.025em;margin-bottom:1rem;
        }
        .pkg-grad {
          background:linear-gradient(90deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .pkg-hero-sub { font-size:1rem;color:var(--text-secondary,#334155);margin-bottom:2rem; }

        .pkg-trust-row {
          display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;
        }
        .pkg-trust-pill {
          display:inline-flex;align-items:center;gap:6px;
          background:#fff;border:1px solid var(--border-subtle,#e2e8f0);
          border-radius:999px;padding:5px 14px;
          font-size:0.78rem;font-weight:600;color:var(--text-secondary,#334155);
          box-shadow:var(--shadow-xs);
        }

        /* ── trial bar ────────────────────── */
        .pkg-trial-bar {
          background:linear-gradient(90deg,#fef3c7,#fde68a);
          border-bottom:1px solid #fcd34d;
          display:flex;align-items:center;justify-content:center;
          gap:1rem;flex-wrap:wrap;padding:0.85rem 1.5rem;
          font-size:0.88rem;color:#78350f;
        }
        .pkg-trial-icon { font-size:1.2rem; }
        /* :global() is required — styled-jsx doesn't scope next/link's
           rendered <a>, only native lowercase JSX elements. */
        :global(.pkg-trial-btn) {
          background:#1e4fa6;color:#fff;font-weight:700;font-size:0.82rem;
          padding:5px 16px;border-radius:999px;text-decoration:none;
          transition:opacity 0.18s;flex-shrink:0;
        }
        :global(.pkg-trial-btn):hover { opacity:0.88;color:#fff;text-decoration:none; }

        /* ── cards section ────────────────── */
        .pkg-section { padding:4rem 0 5rem;background:#f5f7fb; }

        .pkg-grid-cards {
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
          gap:1.6rem;
          align-items:start;
        }

        /* card */
        .pkg-card {
          background:#fff;border-radius:20px;overflow:hidden;
          border:1px solid #e8eef5;
          box-shadow:0 2px 8px rgba(15,23,42,0.05);
          transition:transform 0.22s,box-shadow 0.22s;
          position:relative;
        }
        .pkg-card:hover { transform:translateY(-6px);box-shadow:0 20px 52px rgba(15,23,42,0.1); }

        /* popular card */
        .pkg-popular {
          border-color:#1e4fa6;
          box-shadow:0 4px 24px rgba(30,79,166,0.18);
          transform:scale(1.02);
        }
        .pkg-popular:hover { transform:scale(1.02) translateY(-6px); }

        .pkg-popular-badge {
          position:absolute;top:12px;right:12px;
          background:#fbbf24;color:#78350f;
          font-size:0.68rem;font-weight:800;
          padding:3px 10px;border-radius:999px;
          letter-spacing:0.04em;z-index:2;
        }

        /* card head */
        .pkg-card-head {
          padding:1.6rem 1.6rem 1.4rem;color:#fff;
        }
        .pkg-type-tag {
          font-size:0.65rem;font-weight:700;letter-spacing:0.1em;
          text-transform:uppercase;color:rgba(255,255,255,0.65);
          margin-bottom:4px;
        }
        .pkg-card-name {
          font-size:1.2rem;font-weight:800;margin-bottom:0.8rem;
          letter-spacing:-0.01em;
        }
        .pkg-price-row { display:flex;align-items:baseline;gap:3px; }
        .pkg-currency { font-size:1rem;font-weight:700;opacity:0.85;margin-right:2px; }
        .pkg-price { font-size:2.2rem;font-weight:900;line-height:1; }
        .pkg-period { font-size:0.82rem;opacity:0.72;margin-left:4px; }

        /* card body */
        .pkg-card-body { padding:1.4rem 1.6rem 1.6rem; }
        .pkg-desc { font-size:0.85rem;color:#64748b;line-height:1.6;margin-bottom:1.2rem; }

        .pkg-feature-list {
          list-style:none;padding:0;margin:0 0 1.4rem;
          display:flex;flex-direction:column;gap:8px;
        }
        .pkg-feature-list li {
          display:flex;align-items:center;gap:8px;
          font-size:0.84rem;color:#374151;
        }

        :global(.pkg-card-btn) {
          display:flex;align-items:center;justify-content:center;gap:7px;
          width:100%;padding:0.72rem 1rem;border-radius:11px;
          font-weight:700;font-size:0.9rem;text-decoration:none;
          transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s;
          box-shadow:0 2px 8px rgba(0,0,0,0.1);
        }
        :global(.pkg-card-btn):hover { transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.15);text-decoration:none; }

        .pkg-note {
          text-align:center;font-size:0.72rem;color:#94a3b8;margin:0.7rem 0 0;
        }

        /* ── skeleton ─────────────────────── */
        .pkg-skel { animation:pkgPulse 1.4s ease-in-out infinite; }
        .pkg-skel-head { height:130px;background:#e2e8f0; }
        .pkg-skel-line {
          background:#e2e8f0;border-radius:6px;margin-bottom:4px;
        }
        @keyframes pkgPulse {
          0%,100%{opacity:1} 50%{opacity:0.55}
        }

        /* ── empty ────────────────────────── */
        .pkg-empty {
          text-align:center;padding:4rem 2rem;
        }
        .pkg-empty-icon { font-size:3rem;margin-bottom:1rem; }
        .pkg-empty h3 { font-size:1.3rem;font-weight:700;color:#0f172a;margin-bottom:0.5rem; }
        .pkg-empty p { color:#64748b;margin-bottom:1.5rem; }

        /* ── buttons ──────────────────────── */
        /* :global() is required — styled-jsx doesn't scope next/link's
           rendered <a>, only native lowercase JSX elements. */
        :global(.pkg-btn-primary) {
          display:inline-flex;align-items:center;gap:8px;
          background:linear-gradient(135deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          color:#fff;font-weight:700;font-size:0.9rem;
          padding:0.75rem 1.8rem;border-radius:10px;
          text-decoration:none;box-shadow:0 6px 18px -4px rgba(7,62,140,0.45);
          transition:transform 0.18s,box-shadow 0.18s;
        }
        :global(.pkg-btn-primary):hover { transform:translateY(-2px);box-shadow:0 10px 26px -4px rgba(7,62,140,0.5);color:#fff;text-decoration:none; }

        :global(.pkg-btn-ghost) {
          display:inline-flex;align-items:center;gap:7px;
          background:transparent;border:1.5px solid var(--border-medium,#cbd5e1);
          color:var(--text-main,#0f172a);font-weight:600;font-size:0.9rem;
          padding:0.75rem 1.8rem;border-radius:10px;text-decoration:none;
          transition:background 0.18s,border-color 0.18s,color 0.18s;
        }
        :global(.pkg-btn-ghost):hover { background:var(--brand-primary-50,#eff6ff);border-color:var(--brand-primary,#073e8c);color:var(--brand-primary,#073e8c);text-decoration:none; }

        /* ── how it works strip ───────────── */
        .pkg-how {
          background:#fff;border-top:1px solid #e8eef5;border-bottom:1px solid #e8eef5;
          padding:2.5rem 1.5rem;
        }
        .pkg-how-title {
          text-align:center;font-size:0.75rem;font-weight:700;
          letter-spacing:0.08em;text-transform:uppercase;
          color:#64748b;margin-bottom:1.5rem;
        }
        .pkg-how-steps {
          display:flex;align-items:center;justify-content:center;
          gap:0.75rem;flex-wrap:wrap;
        }
        .pkg-how-step { display:flex;align-items:center;gap:0.6rem; }
        .pkg-how-icon { font-size:1.3rem; }
        .pkg-how-label { font-size:0.88rem;font-weight:600;color:#374151; }
        .pkg-how-arrow { font-size:1.2rem;color:#cbd5e1; }

        /* ── bottom cta ───────────────────── */
        .pkg-cta {
          background:linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding:5rem 1.5rem;text-align:center;
          position:relative;overflow:hidden;
        }
        .pkg-cta-inner { position:relative;z-index:1;max-width:560px;margin:0 auto; }
        .pkg-cta-h2 {
          font-size:clamp(1.7rem,3.5vw,2.5rem);font-weight:800;
          color:var(--text-main,#0f172a);letter-spacing:-0.025em;margin-bottom:0.7rem;
        }
        .pkg-cta-sub { font-size:0.95rem;color:var(--text-secondary,#334155);margin-bottom:2rem; }
        .pkg-cta-btns { display:flex;gap:1rem;justify-content:center;flex-wrap:wrap; }

        /* ── responsive ───────────────────── */
        @media(max-width:640px){
          .pkg-hero { padding:4rem 1rem 3rem; }
          .pkg-popular { transform:none; }
          .pkg-popular:hover { transform:translateY(-6px); }
          .pkg-section { padding:3rem 0 4rem; }
          .pkg-cta { padding:3.5rem 1rem; }
        }
      `}</style>
    </>
  );
}

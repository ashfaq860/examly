'use client';
import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BreadcrumbAuto from '@/components/BreadcrumbAuto';

const METHODS = [
  { color: '#1e4fa6', bg: 'rgba(30,79,166,0.08)', icon: <PhoneIcon />, label: 'Call Us',       value: '0343-0041686',       sub: 'Mon – Fri, 9 AM – 6 PM',   href: 'tel:03430041686' },
  { color: '#0b8c80', bg: 'rgba(11,140,128,0.08)', icon: <MailIcon  />, label: 'Email Us',      value: 'examlypk@gmail.com', sub: 'Reply within 24 hours',    href: 'mailto:examlypk@gmail.com' },
  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: <WAIcon    />, label: 'WhatsApp',      value: '0343-0041686',       sub: 'Quick chat support',       href: 'https://wa.me/923430041686' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: <PinIcon   />, label: 'Visit Office',  value: 'ToyoTa Ada Kasur Rd', sub: 'Raiwind, Lahore, Pakistan', href: '#' },
];

const FAQS = [
  { q: 'How do I start my free trial?', a: 'Sign up on our website — you automatically get 3 months of full access with no credit card required.' },
  { q: 'What happens after my free trial ends?', a: 'Choose from our affordable packages. Our team contacts you to select the right plan and process payment.' },
  { q: 'Can I extend my free trial?', a: 'Yes! Refer friends to Examly and earn +1 free month for every successful referral.' },
  { q: 'Do you offer institutional plans?', a: 'Absolutely — we have special packages for schools, colleges, and coaching centres. Contact us for customised pricing.' },
];

function PhoneIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.1 2.18 2 2 0 012.09.02h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
}
function MailIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function WAIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.5 2.003C6.149 2.003 1.8 6.352 1.8 11.703c0 1.699.445 3.289 1.22 4.668L1.8 21.003l4.742-1.203A9.656 9.656 0 0011.5 21.403c5.351 0 9.7-4.349 9.7-9.7s-4.349-9.7-9.7-9.7zm0 17.8a8.068 8.068 0 01-4.113-1.129l-.295-.175-3.052.775.804-2.973-.191-.304A8.048 8.048 0 013.4 11.703c0-4.465 3.633-8.1 8.1-8.1s8.1 3.635 8.1 8.1-3.635 8.1-8.1 8.1z"/></svg>;
}
function PinIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill={color} fillOpacity="0.12"/>
      <path d="M7 12l3.5 3.5L17 8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', userType: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    if (status === 'err') { setStatus('idle'); setErrMsg(''); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setStatus('idle');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        setStatus('ok');
        setForm({ name: '', email: '', phone: '', userType: '', subject: '', message: '' });
      } else {
        const d = await res.json();
        setStatus('err'); setErrMsg(d.message || 'Failed to send. Please try again.');
      }
    } catch {
      setStatus('err'); setErrMsg('Network error. Please check your connection.');
    } finally { setSending(false); }
  };

  return (
    <>
      <Header />
      <div className="container pt-header pb-2"><BreadcrumbAuto /></div>
      <main className="ct-root">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="ct-hero">
          <div className="ct-blob ct-ba" /><div className="ct-blob ct-bb" />

          <div className="ct-hero-inner">
            <div className="ct-hero-copy">
              <div className="ct-eyebrow">Get in Touch</div>
              <h1 className="ct-h1">
                We're here to<br />
                <span className="ct-grad">help you succeed.</span>
              </h1>
              <p className="ct-hero-sub">
                Questions about paper generation, free trials, packages, or anything
                else — our team is ready to help.
              </p>
              <div className="ct-hero-btns">
                <a href="tel:03430041686" className="ct-btn-primary">
                  <PhoneIcon /> Call Now
                </a>
                <a href="https://wa.me/923430041686" target="_blank" rel="noopener noreferrer" className="ct-btn-ghost">
                  <WAIcon /> WhatsApp
                </a>
              </div>
            </div>

            {/* quick contact card */}
            <div className="ct-hero-card">
              <div className="ct-hc-title">Quick contact</div>
              {METHODS.slice(0, 3).map((m, i) => (
                <a key={i} href={m.href} target={m.href.startsWith('http') ? '_blank' : undefined}
                   rel={m.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                   className="ct-hc-row">
                  <span className="ct-hc-icon" style={{ color: m.color, background: m.bg }}>{m.icon}</span>
                  <span>
                    <span className="ct-hc-label">{m.label}</span>
                    <span className="ct-hc-val">{m.value}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CONTACT METHODS ═══════════════════════════════ */}
        <section className="ct-section ct-light">
          <div className="ct-container">
            <div className="ct-sec-head">
              <div className="ct-eyebrow ct-ey-dark">Reach Us</div>
              <h2 className="ct-h2">Multiple ways to connect</h2>
            </div>
            <div className="ct-methods">
              {METHODS.map((m, i) => (
                <a key={i} href={m.href}
                   target={m.href.startsWith('http') ? '_blank' : undefined}
                   rel={m.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                   className="ct-method-card">
                  <div className="ct-method-icon" style={{ color: m.color, background: m.bg }}>{m.icon}</div>
                  <div className="ct-method-label">{m.label}</div>
                  <div className="ct-method-val" style={{ color: m.color }}>{m.value}</div>
                  <div className="ct-method-sub">{m.sub}</div>
                  <div className="ct-method-bar" style={{ background: m.color }} />
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FORM ══════════════════════════════════════════ */}
        <section className="ct-section ct-white">
          <div className="ct-container">
            <div className="ct-form-grid">
              {/* left info */}
              <div className="ct-form-info">
                <div className="ct-eyebrow ct-ey-dark">Send a Message</div>
                <h2 className="ct-h2" style={{ textAlign: 'left' }}>We'll reply within<br />24 hours.</h2>
                <p className="ct-form-sub">Fill in the form and our team will get back to you by email or phone.</p>
                <ul className="ct-form-perks">
                  {['Fast response time', 'Dedicated support team', 'Help with packages & billing', 'Technical assistance'].map((p, i) => (
                    <li key={i}><CheckIcon color="#1e4fa6" />{p}</li>
                  ))}
                </ul>
                <div className="ct-form-note">
                  Prefer a call? <a href="tel:03430041686">0343-0041686</a>
                </div>
              </div>

              {/* form card */}
              <div className="ct-form-card">
                <div className="ct-form-bar" />
                <div className="ct-form-body">
                  {status === 'ok' && (
                    <div className="ct-alert ct-alert-ok">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#22c55e" fillOpacity="0.15"/><path d="M7 12l3.5 3.5L17 8" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Message sent! We'll get back to you within 24 hours.
                    </div>
                  )}
                  {status === 'err' && (
                    <div className="ct-alert ct-alert-err">
                      {errMsg || 'Something went wrong. Please try again.'}
                    </div>
                  )}

                  <form onSubmit={submit}>
                    <div className="ct-row2">
                      <div className="ct-field">
                        <label>Full Name *</label>
                        <input name="name" required placeholder="Your full name" value={form.name} onChange={change} disabled={sending} />
                      </div>
                      <div className="ct-field">
                        <label>Email *</label>
                        <input name="email" type="email" required placeholder="your@email.com" value={form.email} onChange={change} disabled={sending} />
                      </div>
                    </div>
                    <div className="ct-row2">
                      <div className="ct-field">
                        <label>Phone</label>
                        <input name="phone" type="tel" placeholder="0300-1234567" value={form.phone} onChange={change} disabled={sending} />
                      </div>
                      <div className="ct-field">
                        <label>I am a *</label>
                        <select name="userType" required value={form.userType} onChange={change} disabled={sending}>
                          <option value="">Select your role</option>
                          <option value="teacher">Teacher / Educator</option>
                          <option value="student">Student</option>
                          <option value="institution">Institution Admin</option>
                          <option value="job_seeker">Job Seeker</option>
                          <option value="parent">Parent</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="ct-field">
                      <label>Subject *</label>
                      <input name="subject" required placeholder="What's this about?" value={form.subject} onChange={change} disabled={sending} />
                    </div>
                    <div className="ct-field">
                      <label>Message *</label>
                      <textarea name="message" required rows={4} placeholder="How can we help you?" value={form.message} onChange={change} disabled={sending} />
                    </div>
                    <button type="submit" className="ct-submit" disabled={sending}>
                      {sending
                        ? <><span className="ct-spin" /> Sending…</>
                        : <>Send Message <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></>}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FAQ ═══════════════════════════════════════════ */}
        <section className="ct-section ct-light">
          <div className="ct-container">
            <div className="ct-sec-head">
              <div className="ct-eyebrow ct-ey-dark">FAQ</div>
              <h2 className="ct-h2">Common questions</h2>
            </div>
            <div className="ct-faq">
              {FAQS.map((f, i) => (
                <div key={i} className={`ct-faq-item${openFaq === i ? ' ct-faq-open' : ''}`}>
                  <button className="ct-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {f.q}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                         style={{ transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  {openFaq === i && <div className="ct-faq-a">{f.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ BOTTOM CTA ════════════════════════════════════ */}
        <section className="ct-cta">
          <div className="ct-blob ct-ba" /><div className="ct-blob ct-bb" />
          <div className="ct-cta-inner">
            <div className="ct-eyebrow">Ready to Start?</div>
            <h2 className="ct-cta-h2">Join 5,000+ educators on Examly</h2>
            <p className="ct-cta-sub">3 months free — unlimited papers — no credit card needed.</p>
            <div className="ct-cta-btns">
              <Link href="/auth/signup" className="ct-btn-primary">🚀 Start Free Trial</Link>
              <a href="tel:03430041686" className="ct-btn-ghost"><PhoneIcon /> Call Support</a>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <style jsx>{`
        /* ── base ─────────────────────────────────── */
        .ct-root { overflow-x:hidden; }
        .ct-container { max-width:1120px;margin:0 auto;padding:0 1.5rem; }
        .ct-section { padding:5rem 0; }
        .ct-white { background:#fff; }
        .ct-light { background:#f5f7fb; }

        /* ── hero ─────────────────────────────────── */
        .ct-hero {
          background:linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding:5.5rem 1.5rem 4.5rem;position:relative;overflow:hidden;
        }
        .ct-grid { position:absolute;inset:0;width:100%;height:100%;pointer-events:none; }
        .ct-blob { position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none; }
        .ct-ba { width:500px;height:500px;background:rgba(27,166,153,0.32);top:-150px;right:-80px; }
        .ct-bb { width:380px;height:380px;background:rgba(7,62,140,0.24);bottom:-120px;left:-60px; }

        .ct-hero-inner {
          max-width:1120px;margin:0 auto;
          display:flex;align-items:center;gap:4rem;position:relative;z-index:1;
        }
        .ct-hero-copy { flex:1 1 55%; }

        .ct-eyebrow {
          display:inline-flex;align-items:center;
          font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;
          color:#1ba699;background:rgba(27,166,153,0.12);border:1px solid rgba(27,166,153,0.35);
          border-radius:999px;padding:4px 14px;margin-bottom:0.9rem;
        }
        .ct-ey-dark { color:#1e4fa6;background:rgba(30,79,166,0.08);border-color:rgba(30,79,166,0.2); }

        .ct-h1 {
          font-size:clamp(2.1rem,3.8vw,3.2rem);font-weight:800;color:var(--text-main,#0f172a);
          line-height:1.13;letter-spacing:-0.03em;margin-bottom:1.1rem;
        }
        .ct-grad {
          background:linear-gradient(90deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        }
        .ct-hero-sub { font-size:1rem;color:var(--text-secondary,#334155);line-height:1.7;margin-bottom:2rem;max-width:480px; }
        .ct-hero-btns { display:flex;gap:1rem;flex-wrap:wrap; }

        /* hero quick-contact card */
        .ct-hero-card {
          flex:0 0 38%;
          background:#fff;border:1px solid var(--border-subtle,#e2e8f0);
          border-radius:20px;padding:1.6rem 1.5rem;box-shadow:var(--shadow-md);
        }
        .ct-hc-title { font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted,#64748b);margin-bottom:1rem; }
        .ct-hc-row {
          display:flex;align-items:center;gap:0.9rem;
          padding:0.75rem 0;border-top:1px solid var(--border-subtle,#e2e8f0);
          text-decoration:none;transition:opacity 0.18s;
        }
        .ct-hc-row:hover { opacity:0.82; }
        .ct-hc-icon {
          width:38px;height:38px;border-radius:10px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
        }
        .ct-hc-label { display:block;font-size:0.68rem;font-weight:600;color:var(--text-muted,#64748b);text-transform:uppercase;letter-spacing:0.06em; }
        .ct-hc-val   { display:block;font-size:0.88rem;font-weight:700;color:var(--text-main,#0f172a); }

        /* ── buttons ──────────────────────────────── */
        /* :global() is required — styled-jsx doesn't scope next/link's
           rendered <a>, only native lowercase JSX elements. */
        :global(.ct-btn-primary) {
          display:inline-flex;align-items:center;gap:8px;
          background:linear-gradient(135deg,var(--brand-primary,#073e8c),var(--brand-accent,#1ba699));
          color:#fff;font-weight:700;font-size:0.9rem;
          padding:0.72rem 1.5rem;border-radius:10px;border:none;
          text-decoration:none;box-shadow:0 6px 18px -4px rgba(7,62,140,0.45);
          transition:transform 0.18s,box-shadow 0.18s;cursor:pointer;
        }
        :global(.ct-btn-primary):hover { transform:translateY(-2px);box-shadow:0 10px 26px -4px rgba(7,62,140,0.5);color:#fff;text-decoration:none; }
        :global(.ct-btn-ghost) {
          display:inline-flex;align-items:center;gap:8px;
          background:transparent;border:1.5px solid var(--border-medium,#cbd5e1);
          color:var(--text-main,#0f172a);font-weight:600;font-size:0.9rem;
          padding:0.72rem 1.5rem;border-radius:10px;text-decoration:none;
          transition:background 0.18s,border-color 0.18s,color 0.18s;
        }
        :global(.ct-btn-ghost):hover { background:var(--brand-primary-50,#eff6ff);border-color:var(--brand-primary,#073e8c);color:var(--brand-primary,#073e8c);text-decoration:none; }

        /* ── methods grid ─────────────────────────── */
        .ct-sec-head { text-align:center;margin-bottom:3rem; }
        .ct-h2 { font-size:clamp(1.7rem,3vw,2.4rem);font-weight:800;color:#0f172a;letter-spacing:-0.025em;margin-bottom:0.5rem;text-align:center; }

        .ct-methods { display:grid;grid-template-columns:repeat(4,1fr);gap:1.3rem; }
        .ct-method-card {
          background:#fff;border-radius:18px;padding:1.8rem 1.4rem 1.4rem;
          border:1px solid #e8eef5;position:relative;overflow:hidden;
          box-shadow:0 2px 8px rgba(15,23,42,0.04);
          text-decoration:none;color:#0f172a;
          transition:transform 0.22s,box-shadow 0.22s;display:block;
        }
        .ct-method-card:hover { transform:translateY(-6px);box-shadow:0 16px 44px rgba(15,23,42,0.1);text-decoration:none;color:#0f172a; }
        .ct-method-icon {
          width:50px;height:50px;border-radius:14px;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:1rem;
        }
        .ct-method-label { font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:4px; }
        .ct-method-val   { font-size:0.95rem;font-weight:800;margin-bottom:3px; }
        .ct-method-sub   { font-size:0.78rem;color:#94a3b8; }
        .ct-method-bar   { position:absolute;bottom:0;left:0;right:0;height:3px;opacity:0;transition:opacity 0.22s; }
        .ct-method-card:hover .ct-method-bar { opacity:1; }

        /* ── form section ─────────────────────────── */
        .ct-form-grid { display:grid;grid-template-columns:1fr 1.7fr;gap:4rem;align-items:start; }
        .ct-form-info {}
        .ct-form-sub { font-size:0.92rem;color:#64748b;line-height:1.7;margin:0.6rem 0 1.5rem; }
        .ct-form-perks { list-style:none;padding:0;margin:0 0 1.5rem;display:flex;flex-direction:column;gap:9px; }
        .ct-form-perks li { display:flex;align-items:center;gap:8px;font-size:0.86rem;color:#374151; }
        .ct-form-note { font-size:0.82rem;color:#94a3b8; }
        .ct-form-note a { color:#1e4fa6;font-weight:600;text-decoration:none; }
        .ct-form-note a:hover { text-decoration:underline; }

        .ct-form-card {
          background:#fff;border-radius:20px;overflow:hidden;
          box-shadow:0 0 0 1px rgba(15,23,42,0.06),0 20px 50px rgba(15,23,42,0.08);
        }
        .ct-form-bar {
          height:3px;
          background:linear-gradient(90deg,#1e4fa6,#0b8c80,#6ee7b7,#1e4fa6);
          background-size:300% 100%;
          animation:ctBar 5s linear infinite;
        }
        @keyframes ctBar { 0%{background-position:0%} 100%{background-position:300%} }
        .ct-form-body { padding:1.8rem 2rem 2rem; }

        .ct-alert {
          border-radius:10px;padding:0.8rem 1rem;font-size:0.85rem;
          display:flex;align-items:center;gap:8px;margin-bottom:1.2rem;
        }
        .ct-alert-ok  { background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0; }
        .ct-alert-err { background:#fef2f2;color:#dc2626;border:1px solid #fecaca; }

        .ct-row2 { display:grid;grid-template-columns:1fr 1fr;gap:1rem; }
        .ct-field { display:flex;flex-direction:column;gap:5px;margin-bottom:1rem; }
        .ct-field label { font-size:0.79rem;font-weight:600;color:#475569; }
        .ct-field input,
        .ct-field select,
        .ct-field textarea {
          height:42px;border-radius:9px;
          border:1.5px solid #e5e7eb;background:#fafafa;
          font-size:0.88rem;color:#0f172a;padding:0 12px;
          transition:border-color 0.18s,box-shadow 0.18s,background 0.18s;
          outline:none;box-sizing:border-box;font-family:inherit;width:100%;
        }
        .ct-field textarea { height:auto;padding:10px 12px;resize:vertical; }
        .ct-field input:focus,
        .ct-field select:focus,
        .ct-field textarea:focus {
          border-color:#1e4fa6;background:#fff;
          box-shadow:0 0 0 3px rgba(30,79,166,0.09);
        }
        .ct-field input::placeholder,
        .ct-field textarea::placeholder { color:#9ca3af; }

        .ct-submit {
          display:flex;align-items:center;justify-content:center;gap:8px;
          width:100%;height:46px;margin-top:0.4rem;
          background:linear-gradient(135deg,#1e4fa6,#0b8c80);
          border:none;border-radius:11px;
          color:#fff;font-weight:700;font-size:0.93rem;
          cursor:pointer;box-shadow:0 4px 18px rgba(30,79,166,0.22);
          transition:transform 0.18s,box-shadow 0.18s;
        }
        .ct-submit:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 8px 24px rgba(30,79,166,0.3); }
        .ct-submit:disabled { opacity:0.65;cursor:not-allowed; }
        .ct-spin {
          width:16px;height:16px;border-radius:50%;
          border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;
          animation:ctSpin 0.7s linear infinite;
        }
        @keyframes ctSpin { to { transform:rotate(360deg); } }

        /* ── faq ──────────────────────────────────── */
        .ct-faq { max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:0.6rem; }
        .ct-faq-item {
          background:#fff;border-radius:14px;border:1px solid #e8eef5;
          overflow:hidden;transition:box-shadow 0.2s;
        }
        .ct-faq-item.ct-faq-open { box-shadow:0 4px 20px rgba(30,79,166,0.09);border-color:#c7d8f8; }
        .ct-faq-q {
          width:100%;display:flex;align-items:center;justify-content:space-between;gap:1rem;
          padding:1.1rem 1.3rem;background:none;border:none;text-align:left;
          font-size:0.92rem;font-weight:700;color:#0f172a;cursor:pointer;
          transition:color 0.18s;
        }
        .ct-faq-open .ct-faq-q { color:#1e4fa6; }
        .ct-faq-a { padding:0 1.3rem 1.1rem;font-size:0.86rem;color:#475569;line-height:1.7; }

        /* ── cta ──────────────────────────────────── */
        .ct-cta {
          background:linear-gradient(135deg,#dbeafe 0%,#eef6ff 45%,#ccfbf1 100%);
          padding:5.5rem 1.5rem;text-align:center;position:relative;overflow:hidden;
        }
        .ct-cta-inner { position:relative;z-index:1;max-width:600px;margin:0 auto; }
        .ct-cta-h2 { font-size:clamp(1.8rem,3.5vw,2.7rem);font-weight:800;color:var(--text-main,#0f172a);letter-spacing:-0.025em;margin-bottom:0.8rem; }
        .ct-cta-sub { font-size:0.95rem;color:var(--text-secondary,#334155);margin-bottom:2rem; }
        .ct-cta-btns { display:flex;gap:1rem;justify-content:center;flex-wrap:wrap; }

        /* ── responsive ───────────────────────────── */
        @media(max-width:960px) {
          .ct-hero-inner { flex-direction:column;gap:2.5rem; }
          .ct-hero-card { width:100%; }
          .ct-methods { grid-template-columns:1fr 1fr; }
          .ct-form-grid { grid-template-columns:1fr;gap:2rem; }
        }
        @media(max-width:640px) {
          .ct-hero { padding:4rem 1rem 3rem; }
          .ct-section { padding:3.5rem 0; }
          .ct-methods { grid-template-columns:1fr; }
          .ct-row2 { grid-template-columns:1fr; }
          .ct-form-body { padding:1.4rem 1.3rem 1.6rem; }
          .ct-cta { padding:4rem 1rem; }
        }
      `}</style>
    </>
  );
}

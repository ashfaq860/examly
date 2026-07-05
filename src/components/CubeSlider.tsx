"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

const defaultSlides = [
  {
    title: "AI-Powered Test Generator for Educators",
    description:
      "Create exam papers in minutes. Generate full-book, half-book, and chapter-wise tests automatically — tailored to your curriculum.",
    shortDescription: "Smart question paper generator for schools and colleges.",
    image: "/smartPaperMaker.png",
    cta: "Start Creating",
    link: "/auth/login",
    secondaryCta: "How It Works",
    secondaryLink: "/how-examly-works",
    badge: "For Educators",
    accent: "#1ba699",
    gradient: "linear-gradient(135deg,#dbeafe 0%,#eef6ff 38%,#ccfbf1 100%)",
    blob1: "rgba(27,166,153,0.38)",
    blob2: "rgba(7,62,140,0.30)",
    chipTop:    { icon: "✓", label: "BISE Standard" },
    chipBottom: { icon: "⚡", label: "Instant Download" },
  },
  {
    title: "3 Months Free — Unlimited Paper Generation",
    description:
      "Sign up today and get 3 months of completely free access. Refer friends for extra months. No credit card, no limits.",
    shortDescription: "3 months free unlimited test generation for educators.",
    image: "/sliderFreeOffer.jpg",
    cta: "Claim Free Access",
    link: "/auth/signup",
    secondaryCta: "View Packages",
    secondaryLink: "/packages",
    badge: "🎁 Limited Offer",
    accent: "#f59e0b",
    gradient: "linear-gradient(135deg,#fef3c7 0%,#fff8ec 38%,#a7f3d0 100%)",
    blob1: "rgba(245,158,11,0.36)",
    blob2: "rgba(15,118,110,0.30)",
    chipTop:    { icon: "🎁", label: "3 Months Free" },
    chipBottom: { icon: "🚫", label: "No Credit Card" },
  },
  {
    title: "Practice MCQs & Mock Exams Online",
    description:
      "Chapter-wise quizzes, full-length mock tests, and performance analytics — everything students need to excel in BISE exams.",
    shortDescription: "Online MCQ tests and practice quizzes for exam prep.",
    image: "/student.jpg",
    cta: "Try Free Quiz",
    link: "/quiz",
    secondaryCta: "See Demo",
    secondaryLink: "/how-examly-works",
    badge: "For Students",
    accent: "#2aa7ff",
    gradient: "linear-gradient(135deg,#dbeafe 0%,#eff6ff 38%,#bfe6ff 100%)",
    blob1: "rgba(42,167,255,0.36)",
    blob2: "rgba(7,62,140,0.32)",
    chipTop:    { icon: "📚", label: "Chapter-wise Tests" },
    chipBottom: { icon: "📊", label: "Instant Results" },
  },
];

const INTERVAL = 5500;
const TRANSITION = 700;

export default function CubeSlider({ slides = defaultSlides }) {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeRef = useRef(0);
  const animatingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopProgress = useCallback(() => {
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // Moves to `idx`. Every slide's position is derived from its offset
  // relative to `active` (see render), so this only needs to update the
  // index — the whole filmstrip slides smoothly in the right direction,
  // including wraparound, with no extra "direction" bookkeeping needed.
  const goTo = useCallback((idx: number) => {
    if (animatingRef.current || idx === activeRef.current) return;
    animatingRef.current = true;
    setAnimating(true);
    activeRef.current = idx;
    setActive(idx);
    setProgress(0);
    setTimeout(() => {
      animatingRef.current = false;
      setAnimating(false);
    }, TRANSITION + 50);
  }, []);

  const startCycle = useCallback(() => {
    stopProgress();
    setProgress(0);
    const tick = 50;
    const steps = INTERVAL / tick;
    let step = 0;
    progressRef.current = setInterval(() => {
      step++;
      setProgress(Math.min((step / steps) * 100, 100));
    }, tick);
    intervalRef.current = setInterval(() => {
      const next = (activeRef.current + 1) % slides.length;
      goTo(next);
    }, INTERVAL);
  }, [stopProgress, goTo, slides.length]);

  useEffect(() => {
    startCycle();
    return stopProgress;
  }, [startCycle, stopProgress]);

  const handleDot = (idx: number) => {
    stopProgress();
    goTo(idx);
    setTimeout(startCycle, TRANSITION + 100);
  };

  const handlePrev = () => {
    stopProgress();
    goTo((activeRef.current - 1 + slides.length) % slides.length);
    setTimeout(startCycle, TRANSITION + 100);
  };

  const handleNext = () => {
    stopProgress();
    goTo((activeRef.current + 1) % slides.length);
    setTimeout(startCycle, TRANSITION + 100);
  };

  return (
    <div className="hs-root" aria-label="Hero slider">
      {slides.map((slide, i) => {
        // Shortest signed distance from `active`, wrapping around the ends —
        // always -1, 0, or 1 for this 3-slide set, so the whole filmstrip
        // glides continuously left/right instead of hard-cutting between slides.
        let offset = i - active;
        const half = slides.length / 2;
        if (offset > half) offset -= slides.length;
        if (offset < -half) offset += slides.length;
        const isActive = offset === 0;

        return (
          <div
            key={i}
            className="hs-slide"
            style={{
              background: slide.gradient,
              transform: `translateX(${offset * 100}%)`,
              opacity: isActive ? 1 : 0,
              zIndex: isActive ? 2 : 1,
              pointerEvents: isActive ? "auto" : "none",
            }}
            aria-hidden={!isActive}
          >
            {/* Background blobs */}
            <div className="hs-blob hs-blob-1" style={{ background: slide.blob1 }} />
            <div className="hs-blob hs-blob-2" style={{ background: slide.blob2 }} />

            <div className="container h-100">
              <div className="hs-inner">
                {/* ── Text column ── */}
                <div className={`hs-text-col ${isActive ? "hs-text-in" : ""}`}>
                  <span
                    className="hs-deco-dot"
                    style={{ background: slide.accent, boxShadow: `0 0 0 6px ${slide.accent}1f` }}
                  />
                  <span className="hs-badge" style={{ borderColor: `${slide.accent}60`, color: slide.accent, background: `${slide.accent}18` }}>
                    {slide.badge}
                  </span>
                  <h2 className="hs-title">{slide.title}</h2>
                  <p className="hs-desc desktop-desc">{slide.description}</p>
                  <p className="hs-desc mobile-desc">{slide.shortDescription}</p>
                  <div className="hs-actions">
                    <Link
                      href={slide.link}
                      className="hs-btn-primary"
                      tabIndex={isActive ? 0 : -1}
                      style={{ '--btn-accent': slide.accent } as React.CSSProperties}
                    >
                      <span className="hs-btn-shimmer" />
                      {slide.cta}
                      <svg className="hs-btn-arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                    <Link
                      href={slide.secondaryLink}
                      className="hs-btn-secondary"
                      tabIndex={isActive ? 0 : -1}
                      style={{ '--btn-accent': slide.accent } as React.CSSProperties}
                    >
                      {slide.secondaryCta}
                      <svg className="hs-sec-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  </div>
                </div>

                {/* ── Image column ── */}
                <div className={`hs-img-col ${isActive ? "hs-img-in" : ""}`}>
                  <div className="hs-img-frame">
                    <div className="hs-img-glow" style={{ background: slide.accent }} />
                    <div className="hs-img-card">
                      <img
                        src={slide.image}
                        alt={slide.shortDescription}
                        className="hs-img"
                        loading={i === 0 ? "eager" : "lazy"}
                        width={520}
                        height={420}
                      />
                    </div>
                    {/* Floating accent chips — per-slide */}
                    {slide.chipTop && (
                      <div className="hs-float hs-float-tl">
                        <span className="hs-float-icon" style={{ background: `${slide.accent}18`, color: slide.accent }}>{slide.chipTop.icon}</span> {slide.chipTop.label}
                      </div>
                    )}
                    {slide.chipBottom && (
                      <div className="hs-float hs-float-br">
                        <span className="hs-float-icon" style={{ background: `${slide.accent}18`, color: slide.accent }}>{slide.chipBottom.icon}</span> {slide.chipBottom.label}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Bottom wave — eases the hero's brand-color wash into the white section below ── */}
      <svg className="hs-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0,48 C240,90 480,10 720,28 C960,46 1200,88 1440,44 L1440,100 L0,100 Z"
          style={{ fill: 'var(--surface, #ffffff)' }}
        />
      </svg>

      {/* ── Nav arrows ── */}
      <button className="hs-nav hs-nav-prev" onClick={handlePrev} aria-label="Previous slide" disabled={animating}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button className="hs-nav hs-nav-next" onClick={handleNext} aria-label="Next slide" disabled={animating}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* ── Dot indicators (vertical rail) ── */}
      <div className="hs-dots">
        {slides.map((slide, i) => (
          <button
            key={i}
            className={`hs-dot ${active === i ? "hs-dot-active" : ""}`}
            onClick={() => handleDot(i)}
            aria-label={`Go to slide ${i + 1}`}
          >
            {active === i && (
              <>
                <span
                  className="hs-dot-ring"
                  style={{
                    background: `conic-gradient(${slide.accent} ${progress}%, rgba(15,23,42,0.14) 0)`,
                  }}
                />
                <span className="hs-dot-core" style={{ background: slide.accent }} />
              </>
            )}
          </button>
        ))}
      </div>

      <style jsx>{`
        /* ── Root ── */
        .hs-root {
          position: relative;
          height: 640px;
          overflow: hidden;
          background: linear-gradient(135deg, #dbeafe 0%, #eef6ff 45%, #ccfbf1 100%);
          margin-top: 0;
        }

        /* ── Slides ── */
        .hs-slide {
          position: absolute;
          inset: 0;
          overflow: hidden;
          transition: transform ${TRANSITION}ms cubic-bezier(0.65, 0, 0.35, 1), opacity ${TRANSITION}ms ease;
          will-change: transform, opacity;
        }

        /* ── Background decorations ── */
        .hs-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(64px);
          pointer-events: none;
        }
        .hs-blob-1 { width: 480px; height: 480px; top: -150px; right: -60px; }
        .hs-blob-2 { width: 460px; height: 460px; bottom: -160px; left: -90px; }

        /* ── Layout ── */
        .hs-inner {
          display: flex;
          align-items: center;
          height: 640px;
          gap: 3rem;
          padding-top: 70px;
        }

        /* ── Text column ── */
        .hs-text-col {
          flex: 0 0 50%;
          color: var(--text-main, #0f172a);
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease 0.1s, transform 0.65s ease 0.1s;
        }
        .hs-text-in {
          opacity: 1;
          transform: translateY(0);
        }

        .hs-deco-dot {
          display: block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-bottom: 1.4rem;
        }

        .hs-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 1.2rem;
        }

        .hs-title {
          font-size: clamp(1.9rem, 3.6vw, 3.15rem);
          font-weight: 800;
          line-height: 1.12;
          margin-bottom: 1.15rem;
          letter-spacing: -0.025em;
          color: var(--text-main, #0f172a);
        }

        .hs-desc {
          font-size: 1.05rem;
          line-height: 1.7;
          color: var(--text-muted, #64748b);
          margin-bottom: 1.9rem;
          max-width: 480px;
        }
        .mobile-desc { display: none; }

        .hs-actions {
          display: flex;
          align-items: center;
          gap: 1.6rem;
          flex-wrap: wrap;
        }

        /* ── Primary CTA ──
           :global() is required here because styled-jsx only
           auto-scopes native lowercase tags — it never injects its
           scope class into a custom component like next/link's
           <Link>, so an unscoped selector is the only way these
           rules can match the rendered <a>. */
        :global(.hs-btn-primary) {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0.85rem 1.7rem;
          border-radius: var(--radius-md, 10px);
          font-weight: 700;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #fff;
          text-decoration: none;
          overflow: hidden;
          background: var(--btn-accent, #1ba699);
          box-shadow: 0 8px 20px -6px var(--btn-accent, #1ba699);
          transition: transform 0.22s ease, box-shadow 0.22s ease, color 0s;
          white-space: nowrap;
          line-height: 1;
        }

        .hs-btn-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg,
            transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 0.55s ease;
          pointer-events: none;
        }

        .hs-btn-arrow-icon {
          flex-shrink: 0;
          transition: transform 0.22s ease;
        }

        :global(.hs-btn-primary):hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 12px 26px -6px var(--btn-accent, #1ba699);
          color: #fff;
        }
        :global(.hs-btn-primary):hover .hs-btn-shimmer    { transform: translateX(120%); }
        :global(.hs-btn-primary):hover .hs-btn-arrow-icon  { transform: translateX(5px); }

        /* ── Secondary CTA (ghost link) ── */
        :global(.hs-btn-secondary) {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0.5rem 0;
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-main, #0f172a);
          text-decoration: none;
          border: none;
          border-bottom: 2px solid var(--border-medium, #cbd5e1);
          background: transparent;
          transition: color 0.2s ease, border-color 0.2s ease;
          white-space: nowrap;
          line-height: 1;
        }

        .hs-sec-arrow {
          flex-shrink: 0;
          opacity: 0.85;
          transition: transform 0.22s ease, opacity 0.22s ease;
        }

        :global(.hs-btn-secondary):hover {
          color: var(--btn-accent, #073e8c);
          border-color: var(--btn-accent, #073e8c);
        }
        :global(.hs-btn-secondary):hover .hs-sec-arrow { transform: translateX(4px); opacity: 1; }

        /* ── Image column ── */
        .hs-img-col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateX(32px) scale(0.97);
          transition: opacity 0.7s ease 0.25s, transform 0.7s ease 0.25s;
        }
        .hs-img-in {
          opacity: 1;
          transform: translateX(0) scale(1);
        }

        .hs-img-frame {
          position: relative;
          width: 100%;
          max-width: 460px;
        }

        .hs-img-glow {
          position: absolute;
          inset: -30px;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.3;
          z-index: 0;
        }

        .hs-img-card {
          position: relative;
          z-index: 2;
          background: #fff;
          border-radius: 26px;
          padding: 14px;
          box-shadow:
            0 24px 48px -12px rgba(15, 23, 42, 0.18),
            0 4px 14px rgba(15, 23, 42, 0.06);
        }

        .hs-img {
          width: 100%;
          height: auto;
          border-radius: 16px;
          display: block;
        }

        /* Floating accent chips */
        .hs-float {
          position: absolute;
          z-index: 3;
          background: #fff;
          border: 1px solid var(--border-subtle, #e2e8f0);
          border-radius: 999px;
          padding: 7px 15px 7px 7px;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          box-shadow: var(--shadow-md, 0 4px 12px rgba(15,23,42,0.08));
        }
        .hs-float-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          font-size: 0.85rem;
        }
        .hs-float-tl { top: -16px; left: 20px; }
        .hs-float-br { bottom: -16px; right: 20px; }

        /* ── Bottom wave ── */
        .hs-wave {
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          width: 100%;
          height: 56px;
          z-index: 5;
          pointer-events: none;
        }

        /* ── Nav arrows ── */
        .hs-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 30;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--border-subtle, #e2e8f0);
          background: #fff;
          color: var(--text-main, #0f172a);
          box-shadow: var(--shadow-md, 0 4px 12px rgba(15,23,42,0.08));
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.25s, background 0.2s, color 0.2s, transform 0.2s;
        }
        .hs-root:hover .hs-nav { opacity: 1; }
        .hs-nav:hover { background: var(--brand-primary, #073e8c); color: #fff; border-color: var(--brand-primary, #073e8c); transform: translateY(-50%) scale(1.08); }
        .hs-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .hs-nav-prev { left: 1.25rem; }
        .hs-nav-next { right: 4.5rem; }

        /* ── Dot indicators (vertical rail) ── */
        .hs-dots {
          position: absolute;
          top: 50%;
          right: 1.6rem;
          transform: translateY(-50%);
          z-index: 30;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }

        .hs-dot {
          position: relative;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: transparent;
          border: 2px solid rgba(15, 23, 42, 0.22);
          padding: 0;
          cursor: pointer;
          transition: transform 0.25s ease, border-color 0.25s ease;
        }
        .hs-dot:hover { border-color: rgba(15, 23, 42, 0.45); transform: scale(1.15); }
        .hs-dot-active {
          border-color: transparent;
        }
        .hs-dot-ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
        }
        .hs-dot-core {
          position: absolute;
          inset: 0;
          margin: auto;
          border-radius: 50%;
        }

        /* ── Responsive ── */
        @media (max-width: 991px) {
          .hs-root { height: 460px; }
          .hs-inner {
            flex-direction: column;
            height: 100%;
            padding: 84px 0 64px;
            gap: 1.4rem;
            justify-content: center;
          }
          .hs-text-col { flex: none; width: 100%; text-align: center; }
          .hs-deco-dot { margin-left: auto; margin-right: auto; }
          .hs-desc { margin-left: auto; margin-right: auto; margin-bottom: 0; }
          .hs-actions { justify-content: center; }
          .hs-img-col { display: none; }
          .hs-nav-next { right: 1.25rem; }
          .hs-dots {
            top: auto;
            bottom: 1.4rem;
            right: 50%;
            transform: translateX(50%);
            flex-direction: row;
          }
          .hs-wave { height: 28px; }
        }

        @media (max-width: 768px) {
          .hs-nav { opacity: 1; }
          .hs-root { height: 420px; }
          .hs-inner { padding: 80px 0 56px; }
          .hs-title { font-size: 1.7rem; margin-bottom: 0.8rem; }
          .hs-desc { font-size: 0.92rem; }
          .desktop-desc { display: none; }
          .mobile-desc { display: block !important; }
          .hs-badge { font-size: 0.72rem; margin-bottom: 0.8rem; }
        }

        @media (max-width: 576px) {
          .hs-root { height: 400px; }
          .hs-inner { padding: 72px 0 52px; gap: 1.1rem; }
          .hs-title { font-size: 1.45rem; }
          .hs-actions { gap: 1rem; }
          .hs-btn-primary { font-size: 0.78rem; padding: 0.7rem 1.3rem; gap: 6px; }
          .hs-btn-secondary { font-size: 0.85rem; }
          .hs-nav { width: 36px; height: 36px; }
        }
      `}</style>
    </div>
  );
}

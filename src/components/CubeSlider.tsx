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
    gradient: "linear-gradient(140deg,#073e8c 0%,#0e5c8a 45%,#0e7a71 100%)",
    blob1: "rgba(27,166,153,0.18)",
    blob2: "rgba(7,62,140,0.25)",
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
    gradient: "linear-gradient(140deg,#0f766e 0%,#065f46 45%,#073e8c 100%)",
    blob1: "rgba(245,158,11,0.15)",
    blob2: "rgba(15,118,110,0.25)",
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
    gradient: "linear-gradient(140deg,#073e8c 0%,#0369a1 45%,#0e7490 100%)",
    blob1: "rgba(42,167,255,0.18)",
    blob2: "rgba(14,116,144,0.22)",
    chipTop:    { icon: "📚", label: "Chapter-wise Tests" },
    chipBottom: { icon: "📊", label: "Instant Results" },
  },
];

const INTERVAL = 5500;
const TRANSITION = 700;

export default function CubeSlider({ slides = defaultSlides }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
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

  const goTo = useCallback((idx: number) => {
    if (animatingRef.current || idx === activeRef.current) return;
    animatingRef.current = true;
    setAnimating(true);
    setPrev(activeRef.current);
    activeRef.current = idx;
    setActive(idx);
    setProgress(0);
    setTimeout(() => {
      animatingRef.current = false;
      setAnimating(false);
      setPrev(null);
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
        const isActive = i === active;
        const isPrev = i === prev;
        return (
          <div
            key={i}
            className={`hs-slide ${isActive ? "hs-in" : isPrev ? "hs-out" : "hs-hidden"}`}
            style={{ background: slide.gradient }}
            aria-hidden={!isActive}
          >
            {/* Background blobs */}
            <div className="hs-blob hs-blob-1" style={{ background: slide.blob1 }} />
            <div className="hs-blob hs-blob-2" style={{ background: slide.blob2 }} />
            <div className="hs-blob hs-blob-3" />
            <div className="hs-grid-overlay" />

            <div className="container h-100">
              <div className="hs-inner">
                {/* ── Text column ── */}
                <div className={`hs-text-col ${isActive ? "hs-text-in" : ""}`}>
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
                      <svg className="hs-btn-arrow-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                    <Link
                      href={slide.secondaryLink}
                      className="hs-btn-secondary"
                      tabIndex={isActive ? 0 : -1}
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
                    <img
                      src={slide.image}
                      alt={slide.shortDescription}
                      className="hs-img"
                      loading={i === 0 ? "eager" : "lazy"}
                      width={520}
                      height={420}
                    />
                    {/* Floating accent chips — per-slide */}
                    {slide.chipTop && (
                      <div className="hs-float hs-float-tl" style={{ borderColor: `${slide.accent}40` }}>
                        <span style={{ color: slide.accent }}>{slide.chipTop.icon}</span> {slide.chipTop.label}
                      </div>
                    )}
                    {slide.chipBottom && (
                      <div className="hs-float hs-float-br" style={{ borderColor: `${slide.accent}40` }}>
                        <span style={{ color: slide.accent }}>{slide.chipBottom.icon}</span> {slide.chipBottom.label}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Nav arrows ── */}
      <button className="hs-nav hs-nav-prev" onClick={handlePrev} aria-label="Previous slide" disabled={animating}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button className="hs-nav hs-nav-next" onClick={handleNext} aria-label="Next slide" disabled={animating}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      {/* ── Dot indicators ── */}
      <div className="hs-dots">
        {slides.map((slide, i) => (
          <button
            key={i}
            className={`hs-dot ${active === i ? "hs-dot-active" : ""}`}
            onClick={() => handleDot(i)}
            aria-label={`Go to slide ${i + 1}`}
          >
            {active === i && (
              <span className="hs-dot-fill" style={{ width: `${progress}%`, background: slide.accent }} />
            )}
          </button>
        ))}
      </div>

      <style jsx>{`
        /* ── Root ── */
        .hs-root {
          position: relative;
          height: 620px;
          overflow: hidden;
          background: #000;
          margin-top: 0;
        }

        /* ── Slides ── */
        .hs-slide {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .hs-hidden  { opacity: 0; z-index: 0; pointer-events: none; }
        .hs-out     { opacity: 0; z-index: 1; pointer-events: none; transition: opacity ${TRANSITION}ms ease; }
        .hs-in      { opacity: 1; z-index: 2; pointer-events: auto; transition: opacity ${TRANSITION}ms ease; }

        /* ── Background decorations ── */
        .hs-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .hs-blob-1 { width: 500px; height: 500px; top: -120px; right: -80px; }
        .hs-blob-2 { width: 400px; height: 400px; bottom: -100px; left: -60px; }
        .hs-blob-3 {
          width: 300px; height: 300px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255,255,255,0.04);
          filter: blur(60px);
        }
        .hs-grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        /* ── Layout ── */
        .hs-inner {
          display: flex;
          align-items: center;
          height: 620px;
          gap: 3rem;
          padding-top: 70px;
        }

        /* ── Text column ── */
        .hs-text-col {
          flex: 0 0 52%;
          color: #fff;
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease 0.1s, transform 0.65s ease 0.1s;
        }
        .hs-text-in {
          opacity: 1;
          transform: translateY(0);
        }

        .hs-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border: 1px solid;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 1.1rem;
        }

        .hs-title {
          font-size: clamp(1.75rem, 3.5vw, 2.8rem);
          font-weight: 800;
          line-height: 1.18;
          margin-bottom: 1.1rem;
          letter-spacing: -0.02em;
          text-shadow: 0 2px 20px rgba(0,0,0,0.2);
        }

        .hs-desc {
          font-size: 1.05rem;
          line-height: 1.7;
          color: rgba(255,255,255,0.82);
          margin-bottom: 1.8rem;
          max-width: 480px;
        }
        .mobile-desc { display: none; }

        .hs-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* ── Primary CTA ── */
        .hs-btn-primary {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0.78rem 1.55rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          color: #fff;
          text-decoration: none;
          overflow: hidden;
          background: var(--btn-accent, #1ba699);
          box-shadow: 0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
          transition: transform 0.22s ease, box-shadow 0.22s ease, color 0s;
          white-space: nowrap;
          line-height: 1;
        }

        .hs-btn-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg,
            transparent 30%, rgba(255,255,255,0.26) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 0.55s ease;
          pointer-events: none;
        }

        .hs-btn-arrow-icon {
          flex-shrink: 0;
          transition: transform 0.22s ease;
        }

        .hs-btn-primary:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 10px 32px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.25);
          color: #fff;
        }
        .hs-btn-primary:hover .hs-btn-shimmer    { transform: translateX(120%); }
        .hs-btn-primary:hover .hs-btn-arrow-icon  { transform: translateX(5px); }

        /* ── Secondary CTA ── */
        .hs-btn-secondary {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0.78rem 1.45rem;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          color: rgba(255,255,255,0.92);
          text-decoration: none;
          border: 1.5px solid rgba(255,255,255,0.32);
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
          transition: border-color 0.22s, background 0.22s, transform 0.22s, box-shadow 0.22s, color 0s;
          white-space: nowrap;
          line-height: 1;
        }

        .hs-sec-arrow {
          flex-shrink: 0;
          opacity: 0.65;
          transition: transform 0.22s ease, opacity 0.22s ease;
        }

        .hs-btn-secondary:hover {
          border-color: rgba(255,255,255,0.58);
          background: rgba(255,255,255,0.17);
          color: #fff;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .hs-btn-secondary:hover .hs-sec-arrow { transform: translateX(4px); opacity: 1; }

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
          max-width: 480px;
        }

        .hs-img-glow {
          position: absolute;
          inset: -20px;
          border-radius: 28px;
          filter: blur(50px);
          opacity: 0.35;
          z-index: 0;
        }

        .hs-img {
          position: relative;
          z-index: 2;
          width: 100%;
          height: auto;
          border-radius: 20px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.12),
            0 30px 60px rgba(0,0,0,0.5);
          display: block;
        }

        /* Floating accent chips */
        .hs-float {
          position: absolute;
          z-index: 3;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(12px);
          border: 1px solid;
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.76rem;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .hs-float-tl { top: -14px; left: 16px; }
        .hs-float-br { bottom: -14px; right: 16px; }

        /* ── Nav arrows ── */
        .hs-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 30;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(12px);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.25s, background 0.2s, transform 0.2s;
        }
        .hs-root:hover .hs-nav { opacity: 1; }
        .hs-nav:hover { background: rgba(255,255,255,0.22); transform: translateY(-50%) scale(1.08); }
        .hs-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .hs-nav-prev { left: 1.25rem; }
        .hs-nav-next { right: 1.25rem; }

        /* ── Dot indicators ── */
        .hs-dots {
          position: absolute;
          bottom: 1.6rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .hs-dot {
          position: relative;
          width: 36px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.28);
          border: none;
          cursor: pointer;
          overflow: hidden;
          padding: 0;
          transition: width 0.25s ease, background 0.25s ease;
        }
        .hs-dot-active {
          width: 64px;
          background: rgba(255,255,255,0.2);
        }
        .hs-dot-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          border-radius: 999px;
          transition: none;
        }

        /* ── Responsive ── */
        @media (max-width: 991px) {
          .hs-root { height: auto; min-height: 480px; }
          .hs-inner { flex-direction: column; height: auto; padding: 100px 0 80px; gap: 2rem; }
          .hs-text-col { flex: none; width: 100%; text-align: center; }
          .hs-desc { margin-left: auto; margin-right: auto; }
          .hs-actions { justify-content: center; }
          .hs-img-col { display: none; }
          .hs-float { display: none; }
          .hs-slide { position: absolute; inset: 0; }
          .hs-root { height: 480px; }
        }

        @media (max-width: 768px) {
          .hs-root { height: 460px; }
          .hs-inner { padding: 90px 0 70px; }
          .hs-title { font-size: 1.7rem; }
          .hs-desc { font-size: 0.95rem; }
          .desktop-desc { display: none; }
          .mobile-desc { display: block !important; }
          .hs-badge { font-size: 0.72rem; }
        }

        @media (max-width: 576px) {
          .hs-root { height: 420px; }
          .hs-inner { padding: 80px 0 60px; gap: 1.2rem; }
          .hs-title { font-size: 1.5rem; }
          .hs-actions { gap: 0.75rem; }
          .hs-btn-primary { font-size: 0.875rem; padding: 0.65rem 1.25rem; gap: 7px; }
          .hs-btn-secondary { font-size: 0.875rem; padding: 0.65rem 1.1rem; gap: 6px; }
          .hs-nav { width: 38px; height: 38px; }
        }
      `}</style>
    </div>
  );
}

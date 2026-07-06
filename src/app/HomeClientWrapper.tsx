'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const CubeSlider = dynamic(() => import('@/components/CubeSlider'), {
  ssr: false,
  loading: () => <div style={{ height: 340 }} />,
});

export default function HomeClientWrapper() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          setScrollProgress((window.scrollY / h) * 100);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '60px' }
    );
    const elements = document.querySelectorAll('[data-animate]');
    elements.forEach((el) => observer.observe(el));
    return () => { elements.forEach((el) => observer.unobserve(el)); observer.disconnect(); };
  }, []);

  return (
    <>
      {/* Scroll Progress */}
      <div className="scroll-progress-bar">
        <div className="scroll-progress-fill" style={{ transform: `scaleX(${scrollProgress / 100})` }} />
      </div>

      <CubeSlider />

      <main>
        {/* ═══ PAPER MAKER SECTION ═══ */}
        <section data-animate className="scroll-animate" style={{ padding: '2rem 0', background: 'var(--surface)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }} data-animate>
              <span className="section-eyebrow">AI-Powered Assessment</span>
              <h1
                className="section-title"
                style={{ marginTop: '0.6rem', marginBottom: '1rem' }}
              >
                Advanced{' '}
                <span style={{ color: 'var(--brand-primary)' }}>Test Maker</span>{' '}
                &amp;{' '}
                <span style={{ color: 'var(--brand-accent)' }}>Question Paper Generator</span>
              </h1>
              <p className="section-subtitle">
                Create <strong>BISE-standard</strong> exams for <strong>classes 5th to 12th</strong> using full book,
                half book, or custom chapters — with smart question selection and instant downloads.
              </p>
            </div>

            <div className="row g-4">
              <FeatureCard
                img="/createProfessionalTest.jpg"
                eyebrow="For Teachers"
                title="Professional Tests"
                subtitle="Classes 5th to 12th"
                list={[
                  'Generate full, half-book, or chapter-specific papers',
                  'Auto & manual question selection for full control',
                  'Set difficulty for balanced assessments',
                  'Perfect for schools, colleges & academies',
                ]}
                href="/auth/login"
                ctaLabel="Start Creating"
                delay={0}
                theme="teal"
                priority
              />
              <FeatureCard
                img="/1monthfree.jpg"
                eyebrow="🎁 Limited Offer"
                title="100% Free Trial"
                subtitle="3 Months Unlimited Access"
                list={[
                  'Signup and get 3 months of unlimited access',
                  'Refer friends for extra free months',
                  'Access full question banks for all classes',
                  'No credit card required',
                ]}
                href="/auth/signup"
                ctaLabel="Claim Free Access"
                delay={150}
                theme="amber"
                highlight
              />
              <FeatureCard
                img="/boardPattern.jpg"
                eyebrow="Board Exams"
                title="BISE Pattern Papers"
                subtitle="Official Format Supported"
                list={[
                  'Papers exactly in official BISE board format',
                  'Auto generation by syllabus and chapters',
                  'Manual customization available',
                  'Instant download — print-ready A4,Legal format',
                ]}
                href="/auth/login"
                ctaLabel="Try Board Pattern"
                delay={300}
                theme="blue"
              />
            </div>
          </div>
        </section>

        {/* ═══ PAPER LAYOUTS SECTION ═══ */}
        <section data-animate className="scroll-animate paper-layouts-section" style={{ padding: '5rem 0', background: 'var(--surface-muted)', position: 'relative', overflow: 'hidden' }}>
          <div className="section-blob section-blob-1" aria-hidden="true" />
          <div className="section-blob section-blob-2" aria-hidden="true" />
          <div className="container" style={{ position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }} data-animate>
              <span className="section-eyebrow">Paper Layouts</span>
              <h2 className="section-title" style={{ marginTop: '0.6rem', marginBottom: '1rem' }}>
                Multiple Formats &amp; Demo Videos
              </h2>
              <p className="section-subtitle">
                Choose from MCQ-only, subjective-only, or combined layouts. Watch demos to see exactly how each format works before generating.
              </p>
            </div>

            <div className="row g-4">
              <PaperLayoutCard
                title="Separate Papers"
                description="Distinct MCQ sheet and subjective paper — ideal for board-style exams."
                youtubeId="YOUTUBE_ID_1"
                delay={0}
                theme="blue"
              />
              <PaperLayoutCard
                title="Combined Single Paper"
                description="MCQs and subjective questions on one sheet for streamlined exams."
                youtubeId="YOUTUBE_ID_2"
                delay={150}
                theme="teal"
              />
              <PaperLayoutCard
                title="Two Per Page"
                description="Front page MCQs + back page subjective — saves paper, perfect for class tests."
                youtubeId="YOUTUBE_ID_3"
                delay={300}
                theme="amber"
              />
              <PaperLayoutCard
                title="Three Per Page"
                description="Three mini-papers per page for quick assessments and save on printing."
                youtubeId="YOUTUBE_ID_4"
                delay={450}
                theme="skyblue"
              />
            </div>
          </div>
        </section>

        {/* ═══ STUDENT PREP SECTION ═══ */}
        <section data-animate className="scroll-animate" style={{ padding: '5rem 0', background: 'var(--surface)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }} data-animate>
              <span className="section-eyebrow">For Students</span>
              <h2 className="section-title" style={{ marginTop: '0.6rem', marginBottom: '1rem' }}>
                Smart Exam Preparation
              </h2>
              <p className="section-subtitle">
                AI-powered practice from 5th to 12th class — quizzes, mock exams, and performance analytics.
              </p>
            </div>

            <div className="row g-4">
              <StudentCard
                img="/studentQuizz.jpg"
                eyebrow="MCQ Practice"
                title="Chapter-wise Quizzes"
                description="Practice chapter-wise MCQs online. Improve speed, accuracy, and exam confidence with interactive quizzes."
                btn="Start Practice"
                link="/quiz"
                delay={0}
                theme="teal"
              />
              <StudentCard
                img="/mockTest.jpg"
                eyebrow="Simulation"
                title="Career Mock Exams"
                description="Full-length mock exams to simulate real BISE conditions. Track performance and boost your score."
                btn="Try Mock Test"
                delay={150}
                theme="amber"
              />
              <StudentCard
                img="/checkPerformance.jpg"
                eyebrow="Analytics"
                title="Performance Insights"
                description="Detailed analytics to identify weak areas, track progress, and improve results before the final exam."
                btn="View Analytics"
                delay={300}
                theme="blue"
              />
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .section-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .section-blob-1 { width: 420px; height: 420px; top: -160px; right: -100px; background: rgba(27,166,153,0.10); }
        .section-blob-2 { width: 380px; height: 380px; bottom: -160px; left: -100px; background: rgba(7,62,140,0.08); }

        .feature-card-inner {
          background: #fff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          overflow: hidden;
          height: 100%;
          box-shadow: var(--shadow-sm);
          transition: transform 0.25s var(--ease-out), box-shadow 0.25s ease;
        }
        .feature-card-inner:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-lg);
        }
        .feature-card-inner.highlight {
          border-color: var(--card-ring-border, rgba(27,166,153,0.3));
          box-shadow: 0 0 0 3px var(--card-ring-glow, rgba(27,166,153,0.08)), var(--shadow-sm);
        }
        .feature-card-inner.highlight:hover {
          box-shadow: 0 0 0 3px var(--card-ring-glow-hover, rgba(27,166,153,0.12)), var(--shadow-lg);
        }

        .paper-card-inner {
          background: #fff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          overflow: hidden;
          height: 100%;
          box-shadow: var(--shadow-sm);
          transition: transform 0.25s var(--ease-out), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .paper-card-inner:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--card-hover-border, var(--brand-accent));
        }

        .student-card-inner {
          background: #fff;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          overflow: hidden;
          height: 100%;
          box-shadow: var(--shadow-sm);
          transition: transform 0.25s var(--ease-out), box-shadow 0.25s ease;
        }
        .student-card-inner:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </>
  );
}

/* ═══ REUSABLE COMPONENTS ═══ */

/* Shared accent themes — mirrors the hero slider's per-slide colors
   (teal/amber/sky-blue) so the palette reads as one system across the page. */
const THEMES: Record<string, { solid: string; gradient: string; ringBorder: string; ringGlow: string; ringGlowHover: string }> = {
  teal: {
    solid: '#1ba699',
    gradient: 'linear-gradient(135deg, #1ba699, #0e7a71)',
    ringBorder: 'rgba(27,166,153,0.3)',
    ringGlow: 'rgba(27,166,153,0.08)',
    ringGlowHover: 'rgba(27,166,153,0.12)',
  },
  amber: {
    solid: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    ringBorder: 'rgba(245,158,11,0.3)',
    ringGlow: 'rgba(245,158,11,0.08)',
    ringGlowHover: 'rgba(245,158,11,0.12)',
  },
  blue: {
    solid: 'var(--brand-primary)',
    gradient: 'linear-gradient(135deg, var(--brand-primary), #0a51b5)',
    ringBorder: 'rgba(7,62,140,0.25)',
    ringGlow: 'rgba(7,62,140,0.07)',
    ringGlowHover: 'rgba(7,62,140,0.11)',
  },
  skyblue: {
    solid: '#2aa7ff',
    gradient: 'linear-gradient(135deg, #2aa7ff, #0369a1)',
    ringBorder: 'rgba(42,167,255,0.3)',
    ringGlow: 'rgba(42,167,255,0.08)',
    ringGlowHover: 'rgba(42,167,255,0.12)',
  },
};

const FeatureCard = memo(function FeatureCard({
  img, eyebrow, title, subtitle, list, href, ctaLabel, delay, highlight, theme = 'blue', priority = false,
}: any) {
  const t = THEMES[theme] || THEMES.blue;
  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms`, height: '100%' }}
        className="scroll-animate zoom-in"
      >
        <div
          className={`feature-card-inner ${highlight ? 'highlight' : ''}`}
          style={{
            '--card-ring-border': t.ringBorder,
            '--card-ring-glow': t.ringGlow,
            '--card-ring-glow-hover': t.ringGlowHover,
          } as React.CSSProperties}
        >
          <div style={{ height: 4, background: t.gradient }} />
          <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1 / 1' }}>
            <Image
              src={img}
              alt={title}
              width={400}
              height={400}
              className="card-img-top"
              loading={priority ? undefined : 'lazy'}
              priority={priority}
              quality={60}
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {highlight && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                background: t.gradient,
                color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                padding: '3px 10px', borderRadius: 99,
                letterSpacing: '0.04em',
              }}>
                FREE OFFER
              </div>
            )}
          </div>
          <div style={{ padding: '1.4rem' }}>
            <span className="section-eyebrow" style={{ display: 'block', marginBottom: 6, color: t.solid }}>{eyebrow}</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-main)' }}>{title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--brand-primary)', fontWeight: 600, marginBottom: '0.85rem' }}>{subtitle}</p>
            <ul style={{ paddingLeft: '1.1rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
              {list.map((i: string) => (
                <li key={i} style={{ fontSize: '0.83rem', lineHeight: 1.6, marginBottom: 4 }}>{i}</li>
              ))}
            </ul>
            <Link
              href={href}
              style={{
                display: 'block', textAlign: 'center',
                padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none',
                background: t.gradient,
                color: '#fff',
                transition: 'opacity 0.2s, transform 0.2s',
                boxShadow: '0 2px 8px rgba(7,62,140,0.2)',
              }}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

const LazyYoutubeEmbed = memo(function LazyYoutubeEmbed({ youtubeId, title }: any) {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div
      style={{
        position: 'relative', paddingTop: '56.25%',
        background: '#0f172a', cursor: 'pointer', overflow: 'hidden',
      }}
      onClick={() => setIsLoaded(true)}
    >
      {!isLoaded ? (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <path d="M3 2l11 6-11 6V2z" />
            </svg>
          </div>
          <span style={{ fontWeight: 500 }}>Click to watch demo</span>
        </div>
      ) : (
        <iframe
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      )}
    </div>
  );
});

const PaperLayoutCard = memo(function PaperLayoutCard({ title, description, youtubeId, delay, theme = 'blue' }: any) {
  const t = THEMES[theme] || THEMES.blue;
  return (
    <div className="col-md-6 col-lg-3">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms`, height: '100%' }}
        className="scroll-animate zoom-in"
      >
        <div className="paper-card-inner" style={{ '--card-hover-border': t.solid } as React.CSSProperties}>
          <div style={{ height: 4, background: t.gradient }} />
          <LazyYoutubeEmbed youtubeId={youtubeId} title={title} />
          <div style={{ padding: '1rem 1.1rem 1.25rem' }}>
            <h5 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6, color: 'var(--text-main)' }}>{title}</h5>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const StudentCard = memo(function StudentCard({ img, eyebrow, title, description, btn, delay, link = null, theme = 'teal' }: any) {
  const router = useRouter();
  const t = THEMES[theme] || THEMES.teal;
  const handleClick = useCallback(() => {
    if (link) router.push(link);
    else toast.success('Coming soon!');
  }, [link, router]);

  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms`, height: '100%' }}
        className="scroll-animate fade-up"
      >
        <div className="student-card-inner">
          <div style={{ height: 4, background: t.gradient }} />
          <Image
            src={img}
            alt={title}
            width={600}
            height={400}
            loading="lazy"
            quality={60}
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <div style={{ padding: '1.4rem' }}>
            <span className="section-eyebrow" style={{ display: 'block', marginBottom: 6, color: t.solid }}>{eyebrow}</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-main)' }}>{title}</h3>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1.1rem' }}>{description}</p>
            <button
              onClick={handleClick}
              style={{
                padding: '0.55rem 1.2rem', border: 'none',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: t.gradient,
                color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                fontFamily: 'inherit',
                transition: 'opacity 0.2s, transform 0.2s',
                boxShadow: '0 2px 8px rgba(27,166,153,0.25)',
              }}
            >
              {btn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

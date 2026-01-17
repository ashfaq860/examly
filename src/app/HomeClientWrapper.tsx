'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
/* Dynamically load CubeSlider only on client */
const CubeSlider = dynamic(() => import('@/components/CubeSlider'), {
  ssr: false,
  loading: () => <div style={{ height: 300 }} />,
});

export default function HomeClientWrapper() {
  const [scrollProgress, setScrollProgress] = useState(0);

  /* -------------------- SCROLL PROGRESS -------------------- */
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

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* -------------------- SCROLL ANIMATIONS -------------------- */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Scroll Progress */}
      <div className="scroll-progress-bar">
        <div
          className="scroll-progress-fill"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Cube Slider */}
      <CubeSlider />

      <main>
        {/* ================= PAPER MAKER ================= */}
        <section
          data-animate
          className="scroll-animate fade-up py-5 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
        >
          <div className="container">
            <div className="text-center mb-3" data-animate>
              <h1 className="display-5 fw-bold text-success">
                ✨ Advanced <span className="text-primary">Test Maker</span> &{' '}
                <span className="text-primary">Question Paper Generator</span>
              </h1>
              <p className="lead text-muted">
                Create <strong>BISE-standard</strong> exams for{' '}
                <strong>classes 5th to 12th</strong> using{' '}
                <span className="text-success">full book</span>,{' '}
                <span className="text-success">half book</span>, or{' '}
                <span className="text-success">custom chapters</span>. Smart question selection, balanced difficulty, and instant downloads — all in one platform.
              </p>
            </div>

            <div className="row g-4" data-animate>
              <FeatureCard
                img="/createProfessionalTest.jpg"
                title="Make Professional Tests"
                subtitle="Classes 5th to 12th"
                list={[
                  'Generate full, half-book, single chapter, and custom chapter papers quickly',
                  'Auto & manual question selection for complete control',
                  'Set difficulty levels to create balanced assessments',
                  'Perfect for schools, colleges, and academies'
                ]}
                href="/auth/login"
                delay={0}
              />

              <FeatureCard
                img="/1monthfree.jpg"
                title="100% Free Offer"
                subtitle="Unlimited Paper Generation"
                list={[
                  'Free signup with 3 months of unlimited access',
                  'Referral bonus: Invite friends and earn 1 month free',
                  'Access question banks for all classes',
                  'Create online tests and printable exam papers at no cost'
                ]}
                href="/auth/signup"
                delay={150}
                highlight
              />

              <FeatureCard
                img="/boardPattern.jpg"
                title="Board Pattern Papers"
                subtitle="BISE Format Supported"
                list={[
                  'Generate papers exactly in BISE board format',
                  'Automatic generation based on syllabus, chapters, and question types',
                  'Manual customization available',
                  'Instant download and print-ready papers'
                ]}
                href="/auth/login"
                delay={300}
              />
            </div>
          </div>
        </section>

        {/* ================= PAPER LAYOUTS ================= */}
        <section
          data-animate
          className="scroll-animate fade-up py-5 bg-light dark:bg-gray-900"
        >
          <div className="container">
            <div className="text-center mb-5" data-animate>
              <h2 className="display-5 fw-bold text-success">
                Paper Layouts & Demo Videos
              </h2>
              <p className="lead text-muted dark:text-gray-300">
                Explore different paper formats for exams with MCQs, subjective questions, or combined layouts. Watch YouTube demos to see how each layout works.
              </p>
            </div>

            <div className="row g-4">
              <PaperLayoutCard
                title="Separate Papers: MCQ & Subjective"
                description="Two separate papers: one for MCQs and one for subjective questions."
                youtubeId="YOUTUBE_ID_1"
                delay={0}
              />
              <PaperLayoutCard
                title="Combined Paper: MCQ + Subjective"
                description="MCQs and subjective questions on the same page for a streamlined exam format."
                youtubeId="YOUTUBE_ID_2"
                delay={150}
              />
              <PaperLayoutCard
                title="Two Papers on Single Page"
                description="Front page: MCQs, Back page: Subjective questions for efficient printing."
                youtubeId="YOUTUBE_ID_3"
                delay={300}
              />
              <PaperLayoutCard
                title="Three Papers on Single Page"
                description="Front paper MCQs and back paper subjective questions with three layouts in one page."
                youtubeId="YOUTUBE_ID_4"
                delay={450}
              />
            </div>
          </div>
        </section>

        {/* ================= STUDENT PREP ================= */}
<section
  data-animate
  className="scroll-animate fade-up py-5 bg-light dark:bg-gray-800"
>
  <div className="container">
    <div className="text-center mb-5" data-animate>
      <Image
        src="/studentSection.jpg"
        alt="Students"
        width={400}
        height={160}
        className="img-fluid mb-4"
      />
      <h2 className="display-5 fw-bold text-success">
        Student Exam Preparation
      </h2>
      <p className="lead text-muted dark:text-gray-300">
        Smart AI-powered practice from 5th to 12th
      </p>
    </div>

    <div className="row g-4">
      <StudentCard
        img="/studentQuizz.jpg"
        title="Prepare Your MCQ Part"
        description="Practice chapter-wise MCQs online for 5th to 12th class exams. Improve knowledge, speed, and exam accuracy with interactive quizzes."
        btn="Start Practice"
        link="/quiz"
        delay={0}
      />
      <StudentCard
        img="/mockTest.jpg"
        title="Career Mock Exams"
        description="Take full-length mock exams for better exam readiness. Simulate real BISE exams and track performance to boost confidence and scores."
        btn="Try Mock Test"
        delay={150}
      />
      <StudentCard
        img="/checkPerformance.jpg"
        title="Performance Insights"
        description="Analyze your exam performance with detailed insights. Identify weak areas, track progress, and improve results for better academic outcomes."
        btn="View Analytics"
        delay={300}
      />
    </div>
  </div>
</section>
      </main>

      {/* ================= STYLES ================= */}
      <style jsx>{`
        .scroll-progress-bar {
          position: fixed;
          top: 70px;
          width: 100%;
          height: 3px;
          z-index: 999;
          background: rgba(255, 255, 255, 0.1);
        }
        .scroll-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1ba699, #159380);
        }

        .scroll-animate {
          opacity: 0;
          transform: translateY(40px);
          transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .scroll-animate.in-view {
          opacity: 1;
          transform: translateY(0);
        }

        .zoom-in {
          transform: scale(0.9);
        }
        .zoom-in.in-view {
          transform: scale(1);
        }

        .feature-card {
          transition: all 0.3s ease-in-out;
        }
        .feature-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
        }

        .feature-card.highlight {
          border: 3px solid #1ba699;
          background: linear-gradient(145deg, #e0f7f5, #c0f0eb);
        }

        .paper-card {
          position: relative;
          overflow: hidden;
          border: 2px solid transparent;
          border-radius: 1rem;
          background: #fff;
          transition: all 0.3s ease-in-out;
        }

        .paper-card:hover {
          transform: translateY(-8px) scale(1.03);
          box-shadow: 0 15px 40px rgba(0,0,0,0.2);
          border-color: #1ba699;
        }

        .paper-card iframe {
          border-radius: 0.5rem 0.5rem 0 0;
        }

        .watch-demo-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(27, 166, 153, 0.5);
          color: #fff;
          font-weight: bold;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 0.5rem 0.5rem 0 0;
          cursor: pointer;
        }
        .paper-card:hover .watch-demo-overlay {
          opacity: 1;
        }
      `}</style>
    </>
  );
}

/* ================= REUSABLE COMPONENTS ================= */
function FeatureCard({ img, title, subtitle, list, href, delay, highlight }: any) {
  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms` }}
        className={`scroll-animate zoom-in card feature-card border-0 rounded-4 shadow-lg ${highlight ? 'highlight' : ''}`}
      >
        <Image src={img} alt={title} width={400} height={320} className="card-img-top" loading="lazy" />
        <div className="card-body p-4">
          <h3 className="fw-bold">{title}</h3>
          <p className="text-primary fw-semibold">{subtitle}</p>
          <ul className="text-muted">{list.map((i: string) => <li key={i}>{i}</li>)}</ul>
          <Link href={href} className="btn btn-success w-100">Start Now</Link>
        </div>
      </div>
    </div>
  );
}

function PaperLayoutCard({ title, description, youtubeId, delay }: any) {
  return (
    <div className="col-md-6 col-lg-3">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms` }}
        className="scroll-animate zoom-in card paper-card h-100 border-0 shadow-lg rounded-0"
      >
        <div className="ratio ratio-16x9 position-relative">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div
            className="watch-demo-overlay"
            onClick={() =>
              window.open(`https://www.youtube.com/watch?v=${youtubeId}`, "_blank")
            }
          >
            ▶ Watch Demo
          </div>
        </div>
        <div className="card-body p-3">
          <h5 className="fw-bold">{title}</h5>
          <p className="text-muted small">{description}</p>
        </div>
      </div>
    </div>
  );
}

function StudentCard({ img, title, description, btn, delay, link=null }: any) {
  const router = useRouter();

  const handleClick = () => {
    if (link) {
      router.push(link);
    } else {
      toast.success('Coming soon!');
    }
  };

  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms` }}
        className="scroll-animate fade-up card feature-card h-100 border-0 shadow-sm"
      >
        <Image
          src={img}
          alt={title}
          width={400}
          height={260}
          className="card-img-top"
          loading="lazy"
        />
        <div className="card-body p-4">
          <h3 className="fw-bold">{title}</h3>
          <p className="text-muted small">{description}</p>
          <button className="btn btn-success" onClick={handleClick}>
            {btn}
          </button>
        </div>
      </div>
    </div>
  );
}


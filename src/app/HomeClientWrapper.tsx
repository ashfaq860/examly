'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

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
            <div className="text-center mb-5" data-animate>
              <h2 className="display-5 fw-bold text-success">
                ✨ Advanced Paper Maker
              </h2>
              <p className="lead text-muted dark:text-gray-300">
                Professionally organized question bank for exam papers
              </p>
            </div>

            <div className="row g-4">
              <FeatureCard
                img="/createProfessionalTest.jpg"
                title="Create Professional Tests"
                subtitle="Classes 5th to 12th"
                list={['Full / Half book papers', 'Auto & manual selection', 'Difficulty control']}
                href="/auth/login"
                delay={0}
              />
              <FeatureCard
                img="/1monthfree.jpg"
                title="100% Free Offer"
                subtitle="Unlimited paper generation"
                list={['Free signup', 'Referral bonus', 'All classes access']}
                href="/auth/signup"
                delay={150}
              />
              <FeatureCard
                img="/boardPattern.jpg"
                title="Board Pattern Papers"
                subtitle="BISE format supported"
                list={['Auto generation', 'Manual control', 'Instant download']}
                href="/auth/login"
                delay={300}
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
              <StudentCard img="/studentQuizz.jpg" title="Chapter Quizzes" btn="Start Practice" delay={0} />
              <StudentCard img="/mockTest.jpg" title="Career Mock Exams" btn="Try Mock Test" delay={150} />
              <StudentCard img="/checkPerformance.jpg" title="Performance Insights" btn="View Analytics" delay={300} />
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

        .feature-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </>
  );
}

/* ================= REUSABLE COMPONENTS ================= */
function FeatureCard({ img, title, subtitle, list, href, delay }: any) {
  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms` }}
        className="scroll-animate zoom-in card feature-card border-0 rounded-4 shadow-lg"
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

function StudentCard({ img, title, btn, delay }: any) {
  return (
    <div className="col-md-4">
      <div
        data-animate
        style={{ transitionDelay: `${delay}ms` }}
        className="scroll-animate fade-up card feature-card h-100 border-0 shadow-sm"
      >
        <Image src={img} alt={title} width={400} height={260} className="card-img-top" loading="lazy" />
        <div className="card-body p-4">
          <h3 className="fw-bold">{title}</h3>
          <button className="btn btn-success" onClick={() => toast.success('Coming soon!')}>{btn}</button>
        </div>
      </div>
    </div>
  );
}

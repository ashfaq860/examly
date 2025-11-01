'use client';
import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import CubeSlider from '@/components/CubeSlider';
import toast from 'react-hot-toast';

export default function Home() {
  const [darkMode, setDarkMode] = useState(false);
   const [scrollProgress, setScrollProgress] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainRef = useRef<HTMLDivElement>(null);

  // Dark mode setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true' || 
                    (!localStorage.getItem('darkMode') && 
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
      setDarkMode(isDark);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Scroll progress and animations
  useEffect(() => {
    const handleScroll = () => {
      if (mainRef.current) {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / docHeight) * 100;
        setScrollProgress(progress);
      }
    };

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fadeInUp');
        }
      });
    }, { 
      threshold: 0.1,
      rootMargin: '-50px 0px -50px 0px'
    });

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <>
      <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      
      {/* Scroll Progress Bar */}
      <div className="scroll-progress-bar">
        <div 
          className="scroll-progress-fill" 
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>
<CubeSlider />
      {/* Main Content with Scroll Animations */}
      <main ref={mainRef}>
        {/* Paper Generation Tools Section */}
       <section 
  ref={el => sectionRefs.current[0] = el}
  className="py-5 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 opacity-0 transition-all duration-700 transform translate-y-8"
>
  <div className="container">
    <div className="text-center mb-5">
      <h2 className="display-5 fw-bold " style ={{ color: '#198754' }}>
        ✨ Advanced Paper Maker 
      </h2>
      <p className="lead text-muted dark:text-gray-300">
        Professionally Orgnized Questions Bank To Make Your Exam Papers
      </p>
    </div>

    <div className="row g-4">
      {/* Card 1 */}
<div className="col-md-4">
  <div className="card feature-card  border-0 rounded-4 shadow-lg dark:bg-gray-800 dark:border-gray-700 bg-white/70 backdrop-blur-md transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:-translate-y-2">
    <div className="position-relative overflow-hidden">
      <img
        src="/createProfessionalTest.jpg"
        alt="Online Test Generator for Classes 5 to 12"
        className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '300px' }} // Optional: Control height for consistency
      />
      <div className="position-absolute top-0 start-0 w-100 bg-gradient-to-t from-primary/80 to-transparent"></div>
    </div>
    <div className="card-body p-4">
      <h3 className="fw-bold mb-1 dark:text-white">
        Create Professional Tests
      </h3>
      <p className="text-primary fw-semibold mb-3">
        For Classes 5th to 12th
      </p>
      <ul className="text-muted dark:text-gray-300 mb-4">
        <li>Generate full book exams instantly.</li>
        <li>Half book and unit-wise test options.</li>
        <li>Adjust difficulty levels easily.</li>
        <li>Auto Generate or Manual Questions Selection.</li>
      </ul>
      <Link href="/auth/login" className="btn   w-100"
       style={{ color:'white', fontWeight:'bold',
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #1BA699, #159380)",
                        border: "none",
                        transition: "all 0.3s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }

      >
        Start Now
      </Link>
    </div>
  </div>
</div>


      {/* Card 2 */}
<div className="col-md-4 d-flex justify-content-center">
  <div className="card feature-card  border-0 rounded-4 shadow-lg dark:bg-gray-800 dark:border-gray-700 bg-white/80 backdrop-blur-md transition-all duration-500 hover:shadow-2xl ring-1 ring-primary/30">
    <div className="position-relative overflow-hidden">
      <img
        src="/1monthfree.jpg"
        alt="Online Test Generator for Classes 5 to 12"
        className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '300px' }}
      />
      <div className="position-absolute top-0 start-0 w-100 h-100 bg-gradient-to-t from-primary/70 to-transparent"></div>
    </div>
    <div className="card-body p-4">
      <h3 className="fw-bold mb-1 dark:text-white">
        Enjoy 100% Free Offer
      </h3>
      <p className="text-primary fw-semibold mb-3">
        Sign up and unlock unlimited paper generation
      </p>
      <ul className="text-muted dark:text-gray-300 mb-4">
        <li>Register and complete your profile.</li>
        <li>Enjoy full access — completely free.</li>
        <li>Refer friends to extend your free plan.</li>
        <li>Make papers for 5 to 12 classes.</li>
      </ul>
      <Link href="/auth/signup" className="btn w-100"
       style={{color:'white', fontWeight:'bold',
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #1BA699, #159380)",
                        border: "none",
                        transition: "all 0.3s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }

      
      >Register Now</Link>
    </div>
  </div>
</div>


      {/* Card 3 */}
<div className="col-md-4">
  <div className="card feature-card h-100 border-0 rounded-4 shadow-lg dark:bg-gray-800 dark:border-gray-700 bg-white/70 backdrop-blur-md transform transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:-translate-y-2">
    <div className="position-relative overflow-hidden">
      <img
        src="/boardPattern.jpg"
        alt="Online Test Generator for Classes 5 to 12"
        className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '300px' }} // Optional: Control height for consistency
      />
      <div className="position-absolute top-0 start-0 w-100 h-100 bg-gradient-to-t from-primary/80 to-transparent"></div>
    </div>
    <div className="card-body p-4">
      <h3 className="fw-bold mb-1 dark:text-white">
 Make Board Pattern Paper.
</h3>
<p className="text-primary fw-semibold mb-3">
  Auto Generate Board Pattern Papers
</p>
<ul className="text-muted dark:text-gray-300 mb-4">
  <li>Generate paper Following BISE Board pattern.</li>
  <li>Choose Questions Manually.</li>
  <li>Auto Questions Selection From Questions Bank.</li>
   <li>Just Clicks To Generate Papers.</li>
</ul>
      <Link href="/auth/login" 
      className="btn  w-100"
       style={{color:'white', fontWeight:'bold',
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #1BA699, #159380)",
                        border: "none",
                        transition: "all 0.3s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "0.9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
      >Try Now</Link>
    </div>
  </div>
</div>
    </div>
  </div>
</section>


        {/* Student Exam Preparation Section */}
   <section 
  ref={el => sectionRefs.current[1] = el}
  className="py-5 bg-light dark:bg-gray-800 opacity-0 transition-all duration-700 transform translate-y-8"
>
  <div className="container">
    {/* Section Header */}
    <div className="text-center mb-5">
      {/* Banner Image */}
      <img 
        src="/studentSection.jpg" 
        alt="Exam Preparation" 
        className="img-fluid mx-auto mb-4 d-block"
        style={{ maxHeight: "160px" }}
      />

      <h2 className="display-5 fw-bold text-success dark:text-success-300">
        Student Exam Preparation
      </h2>
      <p className="lead text-muted dark:text-gray-300">
        Prepare smarter with AI-powered practice — from 5<sup>th</sup> to 12<sup>th</sup> class, 
        and excel in competitive entrance exams with confidence.
      </p>
    </div>

    {/* Feature Cards */}
    <div className="row g-4">
      {/* Card 1 */}
      <div className="col-md-4">
        <div className="card feature-card h-100 border-0 overflow-hidden shadow-sm dark:bg-gray-700 dark:border-gray-600 transform transition-transform duration-500 hover:scale-105">
          <div className="card-img-top feature-image-container">
            <img src="/studentQuizz.jpg" alt="Chapter Quizzes" 
             className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '400px' }}
            />
            <div className="image-overlay bg-success"></div>
          </div>
          <div className="card-body p-4">
            <h3 className="fw-bold mb-3 dark:text-white">Chapter Quizzes</h3>
            <p className="text-muted dark:text-gray-300 mb-4">
              Topic-focused quizzes from 5<sup>th</sup> to 12<sup>th</sup> class to strengthen subject mastery.
            </p>
            <Link 
              href="/quiz" 
              className="btn btn-success px-4 fw-semibold dark:bg-success-300 dark:text-gray-900"
            >
              Start Practice
            </Link>
          </div>
        </div>
      </div>

      {/* Card 2 */}
      <div className="col-md-4">
        <div className="card feature-card h-100 border-0 overflow-hidden shadow-sm dark:bg-gray-700 dark:border-gray-600 transform transition-transform duration-500 hover:scale-105">
          <div className="card-img-top feature-image-container">
            <img src="/mockTest.jpg" alt="Mock Exams" 
             className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '400px' }}
            />
            <div className="image-overlay bg-success"></div>
          </div>
          <div className="card-body p-4">
            <h3 className="fw-bold mb-3 dark:text-white">Career Mock Exams</h3>
            <p className="text-muted dark:text-gray-300 mb-4">
             Prepare yourself to get a job, English, Computer, General Science, Politics.
            </p>
            <button 
              className="btn btn-success px-4 fw-semibold dark:bg-success-300 dark:text-gray-900"
            onClick={()=>toast.success("we are working on it!")}
            >
              Try Mock Test
            </button>
          </div>
        </div>
      </div>

      {/* Card 3 */}
      <div className="col-md-4">
        <div className="card feature-card h-100 border-0 overflow-hidden shadow-sm dark:bg-gray-700 dark:border-gray-600 transform transition-transform duration-500 hover:scale-105">
          <div className="card-img-top feature-image-container">
            <img src="/checkPerformance.jpg" alt="Performance Analytics"  className="w-100 h-auto rounded-top object-cover"
        style={{ maxHeight: '400px' }} />
            <div className="image-overlay bg-success"></div>
          </div>
          <div className="card-body p-4">
            <h3 className="fw-bold mb-3 dark:text-white">Performance Insights</h3>
            <p className="text-muted dark:text-gray-300 mb-4">
              Get smart analytics that track progress, highlight strengths, and reveal improvement areas.
            </p>
            <button 
 
              className="btn btn-success px-4 fw-semibold dark:bg-success-300 dark:text-gray-900"
onClick={()=> toast.success("We are working on it!")}
>
              View Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

             </main>

      <Footer darkMode={darkMode} />

      <style jsx>{`
        /* Scroll Progress Bar */
        .scroll-progress-bar {
          position: fixed;
          top: 70px;
          left: 0;
          width: 100%;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          z-index: 1000;
        }

        .scroll-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          transition: width 0.1s ease;
        }

        /* 3D Cube Slider Styles - Reduced Height */
        .cube-slider-container {
          perspective: 1400px;
          height: 600px; /* Reduced from calc(100vh - 70px) */
          overflow: hidden;
          position: relative;
          background: #000;
          margin-top: 70px;
          border-radius: 0 !important;
        }

        .cube-slider {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 1.2s cubic-bezier(0.68, -0.55, 0.27, 1.55);
          transform: translateZ(-300px); /* Adjusted for smaller height */
        }

        .cube-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0 !important;
          overflow: hidden;
        }

        /* Cube Transformations - Adjusted for smaller height */
        .cube-slider.show-0 { transform: translateZ(-300px) rotateY(0deg); }
        .cube-slider.show-1 { transform: translateZ(-300px) rotateY(-120deg); }
        .cube-slider.show-2 { transform: translateZ(-300px) rotateY(-240deg); }

        .cube-face-0 { 
          transform: rotateY(0deg) translateZ(300px); /* Adjusted */
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .cube-face-1 { 
          transform: rotateY(120deg) translateZ(300px); /* Adjusted */
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .cube-face-2 { 
          transform: rotateY(240deg) translateZ(300px); /* Adjusted */
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .cube-content {
          width: 100%;
          height: 100%;
          position: relative;
          z-index: 2;
        }

        .slide-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(0,0,0,0.4) 0%, transparent 100%);
          z-index: 1;
        }

        /* Content Styling - Adjusted for smaller height */
        .min-h-96 {
          min-height: 600px; /* Reduced from calc(100vh - 70px) */
        }

        .slide-icon {
          font-size: 3rem; /* Reduced from 4rem */
          animation: bounce 2s infinite;
        }

        .slide-badge {
          animation: slideInDown 0.8s ease;
        }

        .slide-content h1 {
          animation: fadeInUp 0.8s ease 0.3s both;
          font-size: 2.5rem; /* Reduced from 3.5rem */
          text-shadow: 0 4px 8px rgba(0,0,0,0.3);
          margin-bottom: 1rem !important; /* Reduced spacing */
        }

        .slide-content .lead {
          animation: fadeInUp 0.8s ease 0.5s both;
          font-size: 1.1rem; /* Slightly smaller */
          margin-bottom: 2rem !important; /* Reduced spacing */
        }

        .slide-actions {
          animation: fadeInUp 0.8s ease 0.7s both;
        }

        .slide-image {
          animation: float 6s ease-in-out infinite;
          border-radius: 1rem;
          box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.4);
          transform: perspective(1000px) rotateY(-10deg) rotateX(5deg);
          max-height: 400px; /* Limit image height */
          width: auto;
        }

        .image-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 110%;
          height: 120%;
          background: inherit;
          filter: blur(60px);
          opacity: 0.4;
          z-index: -1;
          border-radius: 2rem;
        }

        /* Navigation - Adjusted positioning */
        .cube-navigation-container {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          transform: translateY(-50%);
          z-index: 20;
          pointer-events: none;
        }

        .cube-nav-btn {
          position: absolute;
          width: 60px; /* Slightly smaller */
          height: 60px; /* Slightly smaller */
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(15px);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          color: white;
          font-size: 1.3rem; /* Slightly smaller */
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: all;
          z-index: 30;
        }

        .cube-nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.15);
          border-color: rgba(255, 255, 255, 0.5);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .cube-nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cube-prev {
          left: 2rem; /* Closer to edge */
          transform: translateX(-20px);
          opacity: 0;
          animation: slideInLeft 0.8s ease 1s forwards;
        }

        .cube-next {
          right: 2rem; /* Closer to edge */
          transform: translateX(20px);
          opacity: 0;
          animation: slideInRight 0.8s ease 1s forwards;
        }

        /* Indicators - Adjusted positioning */
        .cube-indicators-container {
          position: absolute;
          bottom: 2rem; /* Higher up */
          left: 0;
          right: 0;
          z-index: 20;
        }

        .indicators-wrapper {
          display: flex;
          justify-content: center;
          gap: 1rem;
        }

        .cube-indicator {
          width: 60px; /* Smaller */
          height: 4px; /* Thinner */
          background: rgba(255, 255, 255, 0.3);
          border: none;
          border-radius: 2px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          transform: translateY(20px);
          opacity: 0;
          animation: slideInUp 0.8s ease 1.2s forwards;
        }

        .cube-indicator:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
        }

        .cube-indicator.active {
          background: rgba(255, 255, 255, 0.2);
        }

        .indicator-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0%;
          background: white;
          border-radius: 2px;
          transition: width 5s linear;
        }

        .cube-indicator.active .indicator-progress {
          animation: progress 5s linear;
        }

        /* Counter - Adjusted positioning */
        .cube-counter {
          position: absolute;
          top: 2rem; /* Lower down */
          right: 2rem; /* Closer to edge */
          color: white;
          font-size: 1.1rem; /* Smaller */
          font-weight: 700;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(15px);
          padding: 0.5rem 1rem; /* Smaller padding */
          border-radius: 1.5rem;
          z-index: 20;
          transform: translateY(-20px);
          opacity: 0;
          animation: slideInDown 0.8s ease 1s forwards;
        }

        .current-slide {
          font-size: 1.2rem; /* Smaller */
        }

        /* Scroll Down Arrow - Adjusted positioning
        .scroll-down-arrow {
          position: absolute;
          bottom: 1rem; /* Higher up */
          left: 50%;
          transform: translateX(-50%);
          color: white;
          text-align: center;
          cursor: pointer;
          z-index: 20;
          animation: bounce 2s infinite;
        }
 */
        .arrow-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .arrow {
          width: 2px;
          height: 12px; /* Shorter */
          background: white;
          margin: 2px 0;
          animation: arrowWave 1.5s infinite;
        }

        .arrow:nth-child(2) {
          animation-delay: 0.2s;
        }

        .arrow:nth-child(3) {
          animation-delay: 0.4s;
        }

        .scroll-text {
          font-size: 0.8rem; /* Smaller */
          opacity: 0.8;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Perspective Lines */
        .perspective-lines {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 5;
        }

        .line {
          position: absolute;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          height: 1px;
        }

        .line-1 { top: 25%; left: 10%; right: 10%; animation: lineGlow 4s ease-in-out infinite; }
        .line-2 { top: 50%; left: 15%; right: 15%; animation: lineGlow 4s ease-in-out 1s infinite; }
        .line-3 { top: 75%; left: 20%; right: 20%; animation: lineGlow 4s ease-in-out 2s infinite; }
        .line-4 { bottom: 20%; left: 25%; right: 25%; animation: lineGlow 4s ease-in-out 3s infinite; }

        /* Animations */
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); } /* Smaller bounce */
          60% { transform: translateY(-3px); } /* Smaller bounce */
        }

        @keyframes arrowWave {
          0%, 100% { opacity: 0; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(3px); } /* Smaller movement */
        }

        @keyframes float {
          0% { transform: perspective(1000px) rotateY(-10deg) rotateX(5deg) translateY(0px); }
          50% { transform: perspective(1000px) rotateY(-10deg) rotateX(5deg) translateY(-10px); } /* Smaller float */
          100% { transform: perspective(1000px) rotateY(-10deg) rotateX(5deg) translateY(0px); }
        }

        @keyframes lineGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        @keyframes slideInDown {
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInUp {
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideInLeft {
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideInRight {
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); } /* Smaller initial offset */
          to { opacity: 1; transform: translateY(0); }
        }

        .hover-lift:hover {
          transform: translateY(-2px); /* Smaller lift */
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.3s ease;
        }

        /* Scroll Animation Classes */
        .animate-fadeInUp {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        /* Responsive Design - Adjusted for smaller base height */
        @media (max-width: 1200px) {
          .cube-slider-container {
            height: 500px;
            perspective: 1200px;
          }
          
          .cube-slider {
            transform: translateZ(-250px);
          }
          
          .cube-face-0 { transform: rotateY(0deg) translateZ(250px); }
          .cube-face-1 { transform: rotateY(120deg) translateZ(250px); }
          .cube-face-2 { transform: rotateY(240deg) translateZ(250px); }
          
          .cube-slider.show-0 { transform: translateZ(-250px) rotateY(0deg); }
          .cube-slider.show-1 { transform: translateZ(-250px) rotateY(-120deg); }
          .cube-slider.show-2 { transform: translateZ(-250px) rotateY(-240deg); }

          .min-h-96 {
            min-height: 500px;
          }

          .slide-content h1 {
            font-size: 2.2rem;
          }
        }

        @media (max-width: 768px) {
          .cube-slider-container {
            height: 450px;
            perspective: 1000px;
          }
          
          .cube-slider {
            transform: translateZ(-225px);
          }
          
          .cube-face-0 { transform: rotateY(0deg) translateZ(225px); }
          .cube-face-1 { transform: rotateY(120deg) translateZ(225px); }
          .cube-face-2 { transform: rotateY(240deg) translateZ(225px); }
          
          .cube-slider.show-0 { transform: translateZ(-225px) rotateY(0deg); }
          .cube-slider.show-1 { transform: translateZ(-225px) rotateY(-120deg); }
          .cube-slider.show-2 { transform: translateZ(-225px) rotateY(-240deg); }

          .min-h-96 {
            min-height: 450px;
          }

          .slide-content h1 {
            font-size: 1.8rem;
          }
          
          .cube-nav-btn {
            width: 50px;
            height: 50px;
            font-size: 1.1rem;
          }
          
          .cube-prev { left: 1rem; }
          .cube-next { right: 1rem; }
          
          .cube-counter {
            top: 1rem;
            right: 1rem;
          }
        }

        @media (max-width: 576px) {
          .cube-slider-container {
            height: 400px;
          }

          .min-h-96 {
            min-height: 400px;
          }
          
          .slide-content h1 {
            font-size: 1.5rem;
          }
          
          .slide-actions .btn {
            display: block;
            width: 100%;
            margin-bottom: 1rem;
          }
          
          .slide-actions .btn:last-child {
            margin-bottom: 0;
            margin-left: 0;
          }

          .slide-icon {
            font-size: 2rem;
          }
        }
      `}</style>



    </>
  );
}
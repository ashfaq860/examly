"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const defaultSlides = [
  {
    title: "Examly — Smart Paper Maker & Online Test Generator for Educators",
    description:
      "Create professional exam papers in minutes with Examly, the advanced online test maker and question paper generator. Generate full-book, half-book, chapter-wise, custom chapters, and randomized papers tailored to your curriculum. Perfect for schools, colleges, and academies, Examly ensures balanced difficulty, fair assessments, and high-quality, printable exams to save teachers time and enhance student learning outcomes.",
    image: "/smartPaperMaker.png",
    cta: "Try Now",
    link: "/auth/login",
    bgClass: "bg-educator",
    icon: "📊",
    imageStyle: "floating",
  },
  {
    title: "Register & Get 3 Month Free — Unlimited Test & Paper Generation",
    description:
      "Sign up today and get 3 months of free access to Examly's online test maker and question paper generator. Refer a friend and earn an additional 1 month free! Effortlessly create unlimited full-book, half-book, chapter-wise, and custom chapters exam papers. Ideal for teachers, academies, and educational institutes looking to save time while producing professional, balanced, and printable assessments for students.",
    image: "/sliderFreeOffer.jpg",
    cta: "Claim Offer",
    link: "/auth/signup",
    bgClass: "bg-fullbook",
    icon: "🎯",
    imageStyle: "perspective",
  },
  {
    title: "Assess Your MCQ Preparation with Examly — Online Quizzes & Tests",
    description:
      "Prepare effectively for exams using Examly's online quizzes and full-book MCQ tests. Identify knowledge gaps, track progress, and ensure readiness for final exams. Our smart test maker provides balanced question distribution, instant results, and printable quizzes. Perfect for students and educators seeking efficient online assessment tools and high-quality question papers to improve exam performance.",
    image: "/student.jpg",
    cta: "Try Full Book Quiz",
    link: "/auth/login",
    bgClass: "bg-halfbook",
    icon: "⚡",
    imageStyle: "layered",
  },
];

export default function CubeSlider({ slides = defaultSlides, autoRotateInterval = 6000, transitionMs = 1200 }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs for stable values inside intervals / listeners
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isAnimatingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const activeSlideRef = useRef(0);

  useEffect(() => {
    activeSlideRef.current = activeSlide;
  }, [activeSlide]);

  const endAnimating = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isAnimatingRef.current = false;
    setIsAnimating(false);
  };

  useEffect(() => {
    const node = sliderRef.current;
    if (!node) return;

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName && e.propertyName.includes("transform")) {
        endAnimating();
      }
    };

    node.addEventListener("transitionend", onTransitionEnd);
    return () => node.removeEventListener("transitionend", onTransitionEnd);
  }, []);

  const goToSlide = (index: number) => {
    if (index === activeSlideRef.current || isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setActiveSlide(index);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      endAnimating();
    }, transitionMs + 100);
  };

  const nextSlide = () => goToSlide((activeSlideRef.current + 1) % slides.length);
  const prevSlide = () => goToSlide((activeSlideRef.current - 1 + slides.length) % slides.length);

  const startAutoRotate = () => {
    if (intervalRef.current) return;
    intervalRef.current = window.setInterval(() => {
      if (!isAnimatingRef.current) nextSlide();
    }, autoRotateInterval);
  };

  const stopAutoRotate = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    startAutoRotate();
    const node = containerRef.current;
    if (!node) return;

    node.addEventListener("mouseenter", stopAutoRotate);
    node.addEventListener("mouseleave", startAutoRotate);

    return () => {
      stopAutoRotate();
      node.removeEventListener("mouseenter", stopAutoRotate);
      node.removeEventListener("mouseleave", startAutoRotate);
    };
  }, []);

  const getImageStyleClass = (style: string) => {
    switch (style) {
      case "floating": return "floating-image";
      case "perspective": return "perspective-image";
      case "layered": return "layered-image";
      default: return "floating-image";
    }
  };

  return (
    <div className="cube-slider-container position-relative overflow-hidden" ref={containerRef}>
      <div className={`cube-slider show-${activeSlide}`} ref={sliderRef}>
        {slides.map((slide, index) => (
          <div
  key={index}
  className={`cube-face cube-face-${index} ${slide.bgClass} ${
    index === activeSlide ? "active" : ""
  }`}
>

            <div className="slide-overlay"></div>
            <div className="cube-content" >
              <div className="container h-100 position-relative z-10">
                <div className="row align-items-center h-100 min-h-96">
                  <div className="col-lg-6 text-white">
                    <div className="slide-content" style={{ position: 'relative', zIndex: 9999, pointerEvents: 'all' }}>
                      <div className="slide-icon mb-4">
                        <div className="icon-container">
                          <span className="icon-display">{slide.icon}</span>
                          <div className="icon-glow"></div>
                        </div>
                      </div>
                      <div className="slide-badge mb-3">
                        <span className="badge bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full text-sm font-medium border border-white/30">
                          {index === 0 ? "For Educators" : index === 1 ? "Special Offer" : "For Students"}
                        </span>
                      </div>
                      <h1 className="display-4 fw-bold mb-4 leading-tight">{slide.title}</h1>
                      <p className="lead mb-5 opacity-90 text-lg">{slide.description}</p>
                      <div className="slide-actions" style={{zIndex:'10000'}}>
                        <Link href={slide.link} className="btn btn-light btn-lg px-5 py-3 rounded-lg font-semibold shadow-lg hover-lift">
                          {slide.cta} <i className="bi bi-arrow-right ms-2"></i>
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-6 d-none d-lg-block">
                    <div className={`slide-image-container ${getImageStyleClass(slide.imageStyle)}`}>
                      <img 
                        src={slide.image} 
                        alt={slide.title} 
                        className="slide-image"
                      />
                      <div className="image-glow"></div>
                      
                      {/* Floating elements for visual interest */}
                      <div className="floating-element el-1"></div>
                      <div className="floating-element el-2"></div>
                      <div className="floating-element el-3"></div>
                      
                      {/* Decorative shapes */}
                      <div className="deco-shape shape-1"></div>
                      <div className="deco-shape shape-2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="cube-navigation-container">
        <button className="cube-nav-btn cube-prev" onClick={prevSlide} disabled={isAnimating}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button className="cube-nav-btn cube-next" onClick={nextSlide} disabled={isAnimating}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Cube Indicators */}
      <div className="cube-indicators-container">
        <div className="indicators-wrapper">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`cube-indicator ${activeSlide === index ? "active" : ""}`}
              onClick={() => goToSlide(index)}
              disabled={isAnimating}
            >
              <div className="indicator-progress"></div>
            </button>
          ))}
        </div>
      </div>

      {/* Slide Counter */}
      <div className="cube-counter">
        <span className="current-slide">0{activeSlide + 1}</span>
        <span className="counter-divider">/</span>
        <span className="total-slides">0{slides.length}</span>
      </div>

      {/* Enhanced Styles */}
      <style jsx>{`
        .cube-slider-container { 
          perspective: 1400px; 
          height: 700px; 
          overflow: hidden; 
          position: relative; 
          background: #000; 
          margin-top: 70px; 
        }
        .cube-slider { 
          width: 100%; 
          height: 100%; 
          position: relative; 
          transform-style: preserve-3d; 
          transition: transform ${transitionMs}ms cubic-bezier(0.68, -0.55, 0.27, 1.55); 
          transform: translateZ(-300px); 
        }
        .cube-face { 
          position: absolute; 
          width: 100%; 
          height: 100%; 
          backface-visibility: hidden; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          overflow: hidden; 
        }

        .cube-slider.show-0 { transform: translateZ(-300px) rotateY(0deg); }
        .cube-slider.show-1 { transform: translateZ(-300px) rotateY(-120deg); }
        .cube-slider.show-2 { transform: translateZ(-300px) rotateY(-240deg); }

        .cube-face-0 { 
          transform: rotateY(0deg) translateZ(300px); 
          //background: linear-gradient(135deg, #073E8C 0%, #2f5babff 100%); 
        background: linear-gradient(135deg, #1BA69A 0%, #2f5babff 100%);
          }
        .cube-face-1 { 
          transform: rotateY(120deg) translateZ(300px); 
          //background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
        background: linear-gradient(135deg, #1BA69A 0%, #2f5babff 100%);
          }
        .cube-face-2 { 
          transform: rotateY(240deg) translateZ(300px); 
          background: linear-gradient(135deg, #073E8C 0%, #00f2fe 100%); 
        }

        /* Base Image Container */
        .slide-image-container {
          position: relative;
          width: 100%;
          height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Floating Image Style */
        .floating-image .slide-image {
          width: 85%;
          max-width: 450px;
          border-radius: 20px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          transform: translateY(0px) rotate(-5deg);
          animation: float 6s ease-in-out infinite;
          position: relative;
          z-index: 3;
        }

        /* Perspective Image Style */
        .perspective-image .slide-image {
          width: 90%;
          max-width: 500px;
          border-radius: 15px;
          box-shadow: 
            0 30px 60px -12px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.15);
          transform: perspective(1000px) rotateY(-15deg) rotateX(5deg);
          transition: transform 0.3s ease;
          position: relative;
          z-index: 3;
        }

        .perspective-image:hover .slide-image {
          transform: perspective(1000px) rotateY(-10deg) rotateX(3deg);
        }

        /* Layered Image Style */
        .layered-image .slide-image {
          width: 80%;
          max-width: 420px;
          border-radius: 25px;
          box-shadow: 
            0 20px 40px -12px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          transform: rotate(3deg) scale(0.95);
          position: relative;
          z-index: 3;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .layered-image::before {
          content: '';
          position: absolute;
          width: 85%;
          height: 100%;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 25px;
          transform: rotate(-5deg) translateX(20px) translateY(10px);
          z-index: 2;
          backdrop-filter: blur(10px);
        }

        .layered-image::after {
          content: '';
          position: absolute;
          width: 80%;
          height: 100%;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 25px;
          transform: rotate(8deg) translateX(-15px) translateY(15px);
          z-index: 1;
          backdrop-filter: blur(5px);
        }

        /* Image Glow Effect */
        .image-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60%;
          height: 70%;
          background: radial-gradient(
            ellipse at center,
            rgba(255, 255, 255, 0.3) 0%,
            rgba(255, 255, 255, 0) 70%
          );
          filter: blur(20px);
          z-index: 2;
          opacity: 0.6;
        }

        /* Floating Elements */
        .floating-element {
          position: absolute;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 1;
        }

        .floating-element.el-1 {
          width: 80px;
          height: 80px;
          top: 20%;
          right: 10%;
          animation: float-element 8s ease-in-out infinite;
        }

        .floating-element.el-2 {
          width: 40px;
          height: 40px;
          bottom: 30%;
          left: 15%;
          animation: float-element 6s ease-in-out infinite 1s;
        }

        .floating-element.el-3 {
          width: 60px;
          height: 60px;
          top: 60%;
          right: 20%;
          animation: float-element 10s ease-in-out infinite 2s;
        }

        /* Decorative Shapes */
        .deco-shape {
          position: absolute;
          background: linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          border-radius: 10px;
          z-index: 0;
        }

        .deco-shape.shape-1 {
          width: 120px;
          height: 120px;
          top: 10%;
          left: 5%;
          transform: rotate(45deg);
          animation: rotate-slow 20s linear infinite;
        }

        .deco-shape.shape-2 {
          width: 80px;
          height: 80px;
          bottom: 10%;
          right: 8%;
          transform: rotate(30deg);
          animation: rotate-slow-reverse 25s linear infinite;
        }

        /* Animations */
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-5deg); }
          50% { transform: translateY(-20px) rotate(-3deg); }
        }

        @keyframes float-element {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(120deg); }
          66% { transform: translateY(10px) rotate(240deg); }
        }

        @keyframes rotate-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes rotate-slow-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }

        /* Enhanced Icon Styles */
        .slide-icon {
          position: relative;
          display: inline-block;
        }

        .icon-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-display {
          font-size: 3.5rem;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
          display: inline-block;
          transition: all 0.3s ease;
          z-index: 2;
          position: relative;
        }

        .icon-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%);
          border-radius: 50%;
          z-index: 1;
          opacity: 0.6;
        }

        /* Enhanced Navigation */
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
          pointer-events: all;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 50px;
          height: 50px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .cube-nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-50%) scale(1.1);
        }

        .cube-prev { left: 2rem; }
        .cube-next { right: 2rem; }

        .cube-indicators-container { 
          position: absolute; 
          bottom: 2rem; 
          left: 0; 
          right: 0; 
          z-index: 20; 
        }
        
        .cube-counter { 
          position: absolute; 
          top: 2rem; 
          right: 2rem; 
          z-index: 20; 
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Accessibility */
        .cube-nav-btn:disabled { 
          opacity: 0.3; 
          cursor: not-allowed; 
        }

        /* Enhanced badge styling */
        .slide-badge .badge {
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-weight: 500;
          letter-spacing: 0.5px;
          backdrop-filter: blur(10px);
        }
       .cube-slider {
  pointer-events: none; /* cube itself won’t block clicks */
}

.cube-face {
  pointer-events: none; /* hidden slides won't receive clicks */
}

.cube-face.active {
  pointer-events: all; /* only visible face clickable */
  z-index: 100;
}

      `}</style>
    </div>
  );
}

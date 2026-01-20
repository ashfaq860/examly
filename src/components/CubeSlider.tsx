"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const defaultSlides = [
  {
    title: "Examly — AI-Powered Test Generator for Educators",
    description:
      "Create exam papers in minutes with Examly's smart question paper generator. Generate full-book, half-book, and chapter-wise tests automatically. Save time with balanced assessments tailored to your curriculum.",
    shortDescription: "AI-powered test generator for educators - create exam papers in minutes",
    image: "/smartPaperMaker.png",
    cta: "Try Now",
    link: "/auth/login",
    bgClass: "bg-educator",
    icon: "📊",
    imageStyle: "floating",
  },
  {
    title: "3 Months Free — Unlimited Test Generation",
    description:
      "Get 3 months free access to Examly's test generator. Create unlimited exam papers for schools and colleges. Refer friends for extra free months. Professional, printable assessments made easy.",
    shortDescription: "3 months free unlimited test generation offer for educators",
    image: "/sliderFreeOffer.jpg",
    cta: "Claim Offer",
    link: "/auth/signup",
    bgClass: "bg-fullbook",
    icon: "🎯",
    imageStyle: "perspective",
  },
  {
    title: "Online MCQ Tests & Practice Quizzes",
    description:
      "Prepare for exams with full-book MCQ tests and online quizzes. Track progress, identify gaps, and improve performance. Instant results with printable quizzes for effective study.",
    shortDescription: "Online MCQ tests and practice quizzes for exam preparation",
    image: "/student.jpg",
    cta: "Try Quiz",
    link: "/auth/login",
    bgClass: "bg-halfbook",
    icon: "⚡",
    imageStyle: "layered",
  },
];

export default function CubeSlider({ slides = defaultSlides, autoRotateInterval = 6000, transitionMs = 1200 }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

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

  const goToSlide = (index: number, dir: 'next' | 'prev' = 'next') => {
    if (index === activeSlideRef.current || isAnimatingRef.current) return;

    isAnimatingRef.current = true;
    setIsAnimating(true);
    setDirection(dir);
    setActiveSlide(index);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      endAnimating();
    }, transitionMs + 100);
  };

  const nextSlide = () => goToSlide((activeSlideRef.current + 1) % slides.length, 'next');
  const prevSlide = () => goToSlide((activeSlideRef.current - 1 + slides.length) % slides.length, 'prev');

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
    <div className="slider-container position-relative overflow-hidden" ref={containerRef}>
      <div className="slider-wrapper" ref={sliderRef}>
        {slides.map((slide, index) => {
          const isActive = index === activeSlide;
          return (
            <div
              key={index}
              className={`slider-slide ${slide.bgClass} ${isActive ? 'active' : 'inactive'}`}
              style={{
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'translateX(0)' : index < activeSlide ? 'translateX(-100%)' : 'translateX(100%)',
                zIndex: isActive ? 10 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="slide-content-wrapper">
                <div className="container h-100 position-relative">
                  <div className="row align-items-center h-100 min-h-slider">
                    <div className="col-lg-6 col-md-8 col-12 text-white">
                      <div className="slide-content">
                        <div className="slide-icon mb-3 mb-md-4">
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
                        <h1 className="slider-title fw-bold mb-3 mb-md-4 leading-tight">{slide.title}</h1>
                        
                        {/* Desktop description - full for SEO */}
                        <p className="slider-description desktop-description lead mb-4 mb-md-5 opacity-90">
                          {slide.description}
                        </p>
                        
                        {/* Mobile description - shorter for better UX */}
                        <p className="slider-description mobile-description lead mb-4 opacity-90">
                          {slide.shortDescription}
                        </p>
                        
                        <div className="slide-actions">
                          <Link 
                            href={slide.link} 
                            className="btn btn-light btn-lg px-4 px-md-5 py-2 py-md-3 rounded-lg font-semibold shadow-lg hover-lift"
                            style={{ pointerEvents: isActive ? 'auto' : 'none' }}
                            onClick={(e) => {
                              if (!isActive) {
                                e.preventDefault();
                              }
                            }}
                            tabIndex={isActive ? 0 : -1}
                            aria-label={`${slide.cta} - ${slide.shortDescription}`}
                          >
                            {slide.cta} <i className="bi bi-arrow-right ms-2"></i>
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="col-lg-6 d-none d-lg-block">
                      <div className={`slide-image-container ${getImageStyleClass(slide.imageStyle)}`}>
                        <img 
                          src={slide.image} 
                          alt={slide.shortDescription} 
                          className="slide-image"
                          loading={index === 0 ? "eager" : "lazy"}
                          width="500"
                          height="500"
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
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="slider-navigation-container">
        <button 
          className="slider-nav-btn slider-prev" 
          onClick={prevSlide} 
          disabled={isAnimating}
          aria-label="Previous slide"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button 
          className="slider-nav-btn slider-next" 
          onClick={nextSlide} 
          disabled={isAnimating}
          aria-label="Next slide"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Indicators */}
      <div className="slider-indicators-container">
        <div className="indicators-wrapper">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`slider-indicator ${activeSlide === index ? "active" : ""}`}
              onClick={() => goToSlide(index, index > activeSlide ? 'next' : 'prev')}
              disabled={isAnimating}
              aria-label={`Go to slide ${index + 1}`}
            >
              <div className="indicator-progress"></div>
            </button>
          ))}
        </div>
      </div>

      {/* Slide Counter - Fixed positioning */}
      <div className="slider-counter">
        <span className="current-slide">0{activeSlide + 1}</span>
        <span className="counter-divider">/</span>
        <span className="total-slides">0{slides.length}</span>
      </div>

      {/* Enhanced Responsive Styles */}
      <style jsx>{`
        .slider-container { 
          height: 700px; 
          overflow: hidden; 
          position: relative; 
          background: #000; 
          margin-top: 0;
        }
        
        .slider-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .slider-slide {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          transition: transform ${transitionMs}ms cubic-bezier(0.68, -0.55, 0.27, 1.55), 
                     opacity ${transitionMs}ms cubic-bezier(0.68, -0.55, 0.27, 1.55);
          will-change: transform, opacity;
        }
        
        .slider-slide.inactive {
          opacity: 0;
          z-index: 0;
          pointer-events: none;
        }
        
        .slider-slide.active {
          opacity: 1;
          z-index: 10;
          pointer-events: auto;
        }
        
        .slider-slide.active * {
          pointer-events: auto;
        }
        
        .slide-content-wrapper {
          width: 100%;
          height: 100%;
          pointer-events: auto;
          padding: 1rem;
        }
        
        .slide-content {
          pointer-events: auto;
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
        }
        
        /* Background gradients */
        .bg-educator {
          background: linear-gradient(135deg, #1BA69A 0%, #2f5babff 100%);
        }
        
        .bg-fullbook {
          background: linear-gradient(135deg, #1BA69A 0%, #2f5babff 100%);
        }
        
        .bg-halfbook {
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
        .slider-navigation-container { 
          position: absolute; 
          top: 50%; 
          left: 0; 
          right: 0; 
          transform: translateY(-50%); 
          z-index: 100; 
          pointer-events: none; 
        }
        
        .slider-nav-btn {
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
          z-index: 101;
        }

        .slider-nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-50%) scale(1.1);
        }

        .slider-prev { left: 1rem; }
        .slider-next { right: 1rem; }

        .slider-indicators-container { 
          position: absolute; 
          bottom: 2rem; 
          left: 0; 
          right: 0; 
          z-index: 100; 
        }
        
        /* Slide Counter - Fixed position below header */
        .slider-counter { 
          position: absolute; 
          top: 95px; /* Positioned below typical header height */
          right: 2rem; 
          z-index: 999; 
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        /* Accessibility */
        .slider-nav-btn:disabled { 
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
        
        /* SEO optimized text styling */
        .slider-title {
          font-size: 3rem;
          line-height: 1.2;
        }
        
        .slider-description {
          font-size: 1.25rem;
          line-height: 1.6;
        }
        
        .mobile-description {
          display: none;
        }
        
        /* Make sure the entire content area is interactive */
        .slider-slide.active .slide-content-wrapper {
          pointer-events: auto;
        }
        
        .slider-slide.active .slide-content-wrapper * {
          pointer-events: auto;
        }
        
        .indicators-wrapper{display:none !important;}
        
        .min-h-slider {
          min-height: 400px;
        }
        
        /* ===== RESPONSIVE STYLES ===== */
        
        /* Large Desktop */
        @media (min-width: 1440px) {
          .slider-container { 
            height: 750px; 
          }
          
          .slider-title {
            font-size: 3.5rem;
          }
          
          .slide-image-container {
            height: 550px;
          }
        }
        
        /* Tablet Devices */
        @media (max-width: 1024px) {
          .slider-container { 
            height: 600px; 
          }
          
          .slider-title {
            font-size: 2.5rem;
          }
          
          .slider-description {
            font-size: 1.1rem;
          }
          
          .slide-image-container {
            height: 400px;
          }
          
          .icon-display {
            font-size: 3rem;
          }
          
          .slider-nav-btn {
            width: 45px;
            height: 45px;
          }
          
          .min-h-slider {
            min-height: 350px;
          }
          
          .slider-counter {
            top: 80px;
            right: 1.5rem;
            font-size: 1rem;
          }
        }
        
        /* Small Tablets */
        @media (max-width: 768px) {
          .slider-container { 
            height: 500px; 
          }
          
          .slider-title {
            font-size: 2rem;
            margin-bottom: 1rem !important;
          }
          
          .slider-description {
            font-size: 1rem;
            margin-bottom: 1.5rem !important;
          }
          
          .desktop-description {
            display: none;
          }
          
          .mobile-description {
            display: block;
          }
          
          .slide-content-wrapper {
            padding: 1.5rem;
          }
          
          .slide-icon {
            margin-bottom: 1rem !important;
          }
          
          .slide-badge {
            margin-bottom: 1rem !important;
          }
          
          .icon-display {
            font-size: 2.5rem;
          }
          
          .slider-nav-btn {
            width: 40px;
            height: 40px;
          }
          
          .slider-prev { left: 0.5rem; }
          .slider-next { right: 0.5rem; }
          
          .slider-counter { 
            top: 80px; 
            right: 1rem; 
            font-size: 0.9rem;
            padding: 0.4rem 0.8rem;
          }
          
          .min-h-slider {
            min-height: 300px;
          }
          
          .btn-lg {
            padding: 0.75rem 1.5rem !important;
            font-size: 1rem !important;
          }
        }
        
        /* Mobile Devices */
        @media (max-width: 576px) {
          .slider-container { 
            height: 450px; 
          }
          
          .slider-title {
            font-size: 1.75rem;
            line-height: 1.3;
          }
          
          .slider-description {
            font-size: 0.95rem;
            line-height: 1.5;
          }
          
          .slide-content-wrapper {
            padding: 1rem;
          }
          
          .icon-display {
            font-size: 2rem;
          }
          
          .icon-glow {
            width: 60px;
            height: 60px;
          }
          
          .slider-nav-btn {
            width: 35px;
            height: 35px;
          }
          
          .slider-nav-btn svg {
            width: 16px;
            height: 16px;
          }
          
          .slider-counter { 
            top: 75px; 
            right: 0.75rem; 
            font-size: 0.8rem;
            padding: 0.3rem 0.6rem;
          }
          
          .slide-badge .badge {
            font-size: 0.8rem;
            padding: 0.25rem 0.75rem;
          }
          
          .min-h-slider {
            min-height: 250px;
          }
          
          .btn-lg {
            padding: 0.6rem 1.25rem !important;
            font-size: 0.9rem !important;
          }
        }
        
        /* Very Small Mobile Devices */
        @media (max-width: 375px) {
          .slider-container { 
            height: 400px; 
          }
          
          .slider-title {
            font-size: 1.5rem;
          }
          
          .slider-description {
            font-size: 0.875rem;
          }
          
          .slide-icon {
            margin-bottom: 0.75rem !important;
          }
          
          .icon-display {
            font-size: 1.75rem;
          }
          
          .slider-counter { 
            top: 60px; 
            right: 0.5rem; 
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
          }
          
          .min-h-slider {
            min-height: 200px;
          }
        }
        
        /* Landscape Mode */
        @media (max-height: 600px) and (orientation: landscape) {
          .slider-container { 
            height: 400px; 
          }
          
          .min-h-slider {
            min-height: 250px;
          }
          
          .slider-title {
            font-size: 1.75rem;
            margin-bottom: 0.75rem !important;
          }
          
          .slider-description {
            font-size: 0.9rem;
            margin-bottom: 1rem !important;
          }
          
          .slide-actions {
            margin-top: 0.5rem;
          }
          
          .slider-counter {
            top: 80px;
          }
        }
        
        /* Adjust for fixed header */
        @media (max-width: 991px) {
          .slider-counter {
            top: 80px;
          }
        }
        
        /* Extra adjustment for very small screens */
        @media (max-width: 320px) {
          .slider-counter {
            display: none; /* Hide on very small screens */
          }
        }
      `}</style>
    </div>
  );
}
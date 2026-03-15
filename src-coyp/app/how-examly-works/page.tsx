'use client';
import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(1);

  const features = [
    {
      icon: "bi bi-file-earmark-text",
      title: "Make Papers for Educators",
      description: "Make customized question papers, tests, and assessments with our intelligent paper maker,examly. Make tests 3 test on single page, 2 tests on single page, 1 test single page and 2 pager test. Save time and ensure quality.",
      benefits: ["AI-powered question selection", "Multiple difficulty levels", "Customizable templates", "Instant download"]
    },
    {
      icon: "bi bi-pencil-square",
      title: "Take Quizzes for Students",
      description: "Practice with unlimited quizzes, get instant feedback, and track your learning progress with detailed analytics.",
      benefits: ["Real-time evaluation", "Progress tracking", "Multiple quiz types", "Mobile friendly"]
    },
    {
      icon: "bi bi-briefcase",
      title: "Prepare for Job Exams",
      description: "Comprehensive test preparation for competitive exams, job interviews, and certification tests with curated content.",
      benefits: ["Exam-specific content", "Time management practice", "Performance analytics", "Previous year papers"]
    }
  ];

  const freeTrialSteps = [
    {
      step: 1,
      title: "Sign Up",
      description: "Create your free account in 30 seconds",
      icon: "bi bi-person-plus"
    },
    {
      step: 2,
      title: "Complete Profile",
      description: "Tell us about your needs and preferences",
      icon: "bi bi-person-check"
    },
    {
      step: 3,
      title: "Generate Unlimited Papers",
      description: "Access all features for 1 month absolutely free",
      icon: "bi bi-file-earmark-plus"
    }
  ];

  const referralBenefits = [
    {
      title: "Refer Friends",
      description: "Share your referral link with friends and colleagues",
      icon: "bi bi-share"
    },
    {
      title: "They Sign Up",
      description: "Your friends create their accounts using your link",
      icon: "bi bi-people"
    },
    {
      title: "Get 1 Month Free",
      description: "Receive an additional free month for each successful referral",
      icon: "bi bi-gift"
    }
  ];

  const subscriptionProcess = [
    {
      step: 1,
      title: "Select Package",
      description: "Choose the plan that fits your needs from our affordable packages",
      icon: "bi bi-box"
    },
    {
      step: 2,
      title: "Contact Us",
      description: "We'll reach out to verify your requirements and process payment",
      icon: "bi bi-telephone"
    },
    {
      step: 3,
      title: "Activate Plan",
      description: "Get instant access to premium features after verification",
      icon: "bi bi-lightning"
    }
  ];

  return (
    <>
      <Header />
      
      <div className="how-it-works-page">
        {/* Hero Section */}
        <section className="hero-section bg-primary text-white py-5">
          <div className="container">
            <div className="row align-items-center min-vh-60 py-5">
              <div className="col-lg-6">
                <h1 className="display-4 fw-bold mb-4">
                  How <span className="text-warning">Examly</span> Works
                </h1>
                <p className="lead mb-4 opacity-75">
                  Transform your teaching and learning experience with our comprehensive assessment platform. 
                 Make papers, Make Tests, take quizzes, and prepare for exams - all in one place.
                </p>
                <div className="d-flex gap-3 flex-wrap">
                  <Link href="/auth/signup" className="btn btn-warning btn-lg px-4 py-2 fw-bold">
                    Start 1 Month Free Trial
                  </Link>
                  <Link href="#features" className="btn btn-outline-light btn-lg px-4 py-2">
                    Explore Features
                  </Link>
                </div>
                <div className="mt-3">
                  <small className="opacity-75">No credit card required • Cancel anytime</small>
                </div>
              </div>
              <div className="col-lg-6 text-center">
                <div className="hero-illustration bg-white bg-opacity-10 rounded-3 p-5">
                  <i className="bi bi-rocket-takeoff display-1 text-warning"></i>
                  <h4 className="mt-3 fw-bold">Start Your Free Month Today!</h4>
                  <p className="mb-0 opacity-75">Unlimited paper generation for 30 days</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Features Section */}
        <section id="features" className="features-section py-5 bg-light">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Our Core Features</h2>
              <p className="lead text-muted">Everything you need for effective teaching and learning</p>
            </div>
            <div className="row g-4">
              {features.map((feature, index) => (
                <div key={index} className="col-lg-4">
                  <div className="feature-card h-100 bg-white rounded-3 shadow-sm p-4 text-center transition-all hover-lift">
                    <div className="feature-icon bg-primary rounded-circle mx-auto d-flex align-items-center justify-content-center mb-4"
                         style={{width: '80px', height: '80px'}}>
                      <i className={`${feature.icon} text-white fs-2`}></i>
                    </div>
                    <h4 className="fw-bold mb-3 text-dark">{feature.title}</h4>
                    <p className="text-muted mb-4">{feature.description}</p>
                    <ul className="list-unstyled text-start">
                      {feature.benefits.map((benefit, benefitIndex) => (
                        <li key={benefitIndex} className="mb-2">
                          <i className="bi bi-check-circle-fill text-success me-2"></i>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free Trial Section */}
        <section className="free-trial-section py-5 bg-white">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Get 1 Month Free Trial</h2>
              <p className="lead text-muted">Start making unlimited papers immediately</p>
            </div>
            <div className="row g-4">
              {freeTrialSteps.map((step, index) => (
                <div key={index} className="col-md-4">
                  <div className="step-card text-center p-4 h-100">
                    <div className="step-number bg-primary text-white rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                         style={{width: '60px', height: '60px', fontSize: '1.5rem'}}>
                      {step.step}
                    </div>
                    <div className="step-icon text-primary mb-3">
                      <i className={`${step.icon} fs-1`}></i>
                    </div>
                    <h5 className="fw-bold mb-3 text-dark">{step.title}</h5>
                    <p className="text-muted mb-0">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-5">
              <Link href="/auth/signup" className="btn btn-primary btn-lg px-5">
                Start Free Trial Now
              </Link>
            </div>
          </div>
        </section>

        {/* Referral Program Section */}
        <section className="referral-section py-5 bg-primary text-white">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6">
                <h2 className="h1 fw-bold mb-4">Refer & Earn More Free Months!</h2>
                <p className="lead mb-4 opacity-75">
                  Love Examly? Share it with others and get additional free months for every friend who signs up.
                </p>
                <div className="row g-3">
                  {referralBenefits.map((benefit, index) => (
                    <div key={index} className="col-12">
                      <div className="d-flex align-items-center">
                        <div className="benefit-icon me-3">
                          <i className={`${benefit.icon} text-warning fs-3`}></i>
                        </div>
                        <div>
                          <h6 className="fw-bold mb-1">{benefit.title}</h6>
                          <p className="mb-0 opacity-75 small">{benefit.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-lg-6 text-center">
                <div className="referral-illustration bg-white bg-opacity-10 rounded-3 p-5">
                  <i className="bi bi-gift display-1 text-warning"></i>
                  <h4 className="mt-3 fw-bold">+1 Month Free Per Referral</h4>
                  <p className="text-warning mb-0">Unlimited referrals, unlimited free months!</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subscription Process Section */}
        <section className="subscription-section py-5 bg-light">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Subscribe to Continue</h2>
              <p className="lead text-muted">After your free trial, choose a plan that works for you</p>
            </div>
            <div className="row g-4">
              {subscriptionProcess.map((step, index) => (
                <div key={index} className="col-lg-4">
                  <div className="process-card text-center p-4 bg-white rounded-3 shadow-sm h-100">
                    <div className="process-number bg-success text-white rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                         style={{width: '50px', height: '50px', fontSize: '1.2rem'}}>
                      {step.step}
                    </div>
                    <div className="process-icon text-success mb-3">
                      <i className={`${step.icon} fs-2`}></i>
                    </div>
                    <h5 className="fw-bold mb-3 text-dark">{step.title}</h5>
                    <p className="text-muted mb-0">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-5">
              <div className="row justify-content-center">
                <div className="col-lg-8">
                  <div className="bg-white rounded-3 p-4 shadow-sm">
                    <h5 className="fw-bold text-dark mb-3">Ready to Subscribe?</h5>
                    <p className="text-muted mb-4">
                      Login to your account, select your preferred package, and we'll contact you 
                      to verify payment details and activate your premium features.
                    </p>
                    <div className="d-flex gap-3 justify-content-center flex-wrap">
                      <Link href="/auth/login" className="btn btn-success btn-lg">
                        Login & Choose Package
                      </Link>
                      <Link href="/packages" className="btn btn-outline-success btn-lg">
                        View Packages
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="final-cta-section py-5 bg-dark text-white">
          <div className="container">
            <div className="row justify-content-center text-center">
              <div className="col-lg-8">
                <h2 className="h1 fw-bold mb-4">Start Your Examly Journey Today</h2>
                <p className="lead mb-4 opacity-75">
                  Join thousands of educators and students who are already transforming their 
                  teaching and learning experience with Examly.
                </p>
                <div className="d-flex gap-3 justify-content-center flex-wrap">
                  <Link href="/auth/signup" className="btn btn-warning btn-lg px-5 py-3 fw-bold">
                    🚀 Get 1 Month Free
                  </Link>
                  <Link href="/quiz" className="btn btn-outline-light btn-lg px-5 py-3">
                    Try Demo Quiz
                  </Link>
                </div>
                <div className="mt-4">
                  <small className="opacity-75">
                    ✓ Unlimited paper generation ✓ No credit card required ✓ Cancel anytime
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <style jsx>{`
        .min-vh-60 {
          min-height: 60vh;
        }
        
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.175) !important;
        }
        
        .transition-all {
          transition: all 0.3s ease;
        }
        
        .step-card, .process-card {
          transition: all 0.3s ease;
        }
        
        .step-card:hover, .process-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
        
        .hero-illustration, .referral-illustration {
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        @media (max-width: 768px) {
          .hero-section .display-4 {
            font-size: 2.5rem !important;
          }
          
          .min-vh-60 {
            min-height: 40vh;
          }
        }
      `}</style>
    </>
  );
}
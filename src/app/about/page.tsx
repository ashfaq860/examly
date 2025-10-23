'use client';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function AboutUs() {
  const teamMembers = [
    {
      name: "Abdul Rauf",
      role: "Founder & CEO",
      image: "/team/sarah.jpg",
      description: "Former educator with 10+ years experience in curriculum development",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "Fahad Farooq",
      role: "CTO",
      image: "/team/michael.jpg",
      description: "Tech entrepreneur passionate about EdTech solutions",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "Dr. Saeed Ahmad",
      role: "Head of Education",
      image: "/team/priya.jpg",
      description: "M.Phil in Educational Technology with 15 years teaching experience",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    },
    {
      name: "Mushtaq Ahmed",
      role: "Product Lead",
      image: "/team/david.jpg",
      description: "Product manager focused on user experience and innovation",
      social: {
        linkedin: "#",
        twitter: "#"
      }
    }
  ];

  const milestones = [
    {
      year: "2025",
      title: "Company Founded",
      description: "Started with a vision to transform educational assessment"
    },
    {
      year: "2025",
      title: "Platform Launch",
      description: "Launched Examly as Paper Maker and quiz features"
    },
    {
      year: "2025",
      title: "10,000+ Users",
      description: "Reached milestone of serving educators and students worldwide"
    },
    {
      year: "2025",
      title: "New Features",
      description: "Added job test preparation and advanced analytics"
    }
  ];

  const values = [
    {
      icon: "bi bi-lightbulb",
      title: "Innovation",
      description: "Constantly evolving to meet the changing needs of Making papers and tests."
    },
    {
      icon: "bi bi-shield-check",
      title: "Quality",
      description: "Committed to Provide Questions from Past papers, Model papers and our own quality questions Bank."
    },
    {
      icon: "bi bi-people",
      title: "Accessibility",
      description: "Making it very easy to make papers and tests for educators and learning for students."
    },
    {
      icon: "bi bi-graph-up-arrow",
      title: "Growth",
      description: "Helping Educators to make make paper, make tests in seconds with examly a best paper maker and students achieve their full potential."
    }
  ];

  const stats = [
    {
      number: "50,000+",
      label: "Papers Generated"
    },
    {
      number: "25,000+",
      label: "Active Users"
    },
    {
      number: "100+",
      label: "Educational Institutions"
    },
    {
      number: "95%",
      label: "User Satisfaction"
    }
  ];

  return (
    <>
      <Header />
      
      <div className="about-page">
        {/* Hero Section */}
        <section className="hero-section bg-primary text-white py-5">
          <div className="container">
            <div className="row align-items-center min-vh-60 py-5">
              <div className="col-lg-6">
                <h1 className="display-4 fw-bold mb-4">
                  About <span className="text-warning">Examly.<sub>pk</sub></span>
                </h1>
                <p className="lead mb-4 opacity-75">
                  We're revolutionizing the way educators make paper, tests and save their hours of time and students test their learning level  with digital technology. Our mission is to provide a quick way to make papers, design tests and save hours of time of educators,wasted in making papers and tests.
                </p>
                <div className="d-flex gap-3 flex-wrap">
                  <Link href="/auth/signup" className="btn btn-warning btn-lg px-4 py-2 fw-bold">
                    Start Free Trial
                  </Link>
                  <Link href="/how" className="btn btn-outline-light btn-lg px-4 py-2">
                    How It Works
                  </Link>
                </div>
              </div>
              <div className="col-lg-6 text-center">
                <div className="hero-illustration bg-white bg-opacity-10 rounded-3 p-5">
                  <i className="bi bi-mortarboard display-1 text-warning"></i>
                  <h4 className="mt-3 fw-bold">Transforming Education</h4>
                  <p className="mb-0 opacity-75">One assessment at a time</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision Section */}
        <section className="mission-section py-5 bg-light">
          <div className="container">
            <div className="row g-5">
              <div className="col-lg-6">
                <div className="mission-card bg-white rounded-3 p-4 shadow-sm h-100">
                  <div className="mission-icon bg-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                       style={{width: '70px', height: '70px'}}>
                    <i className="bi bi-bullseye text-white fs-3"></i>
                  </div>
                  <h3 className="fw-bold mb-3 text-dark">Our Mission</h3>
                  <p className="text-muted fs-5">
                    To empower educators with intelligent tools that enable them to create papers and tests within seconds—saving valuable time and allowing them to focus on teaching effectiveness—while providing students with a platform to assess their learning and drive academic success.
                  </p>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="vision-card bg-white rounded-3 p-4 shadow-sm h-100">
                  <div className="vision-icon bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
                       style={{width: '70px', height: '70px'}}>
                    <i className="bi bi-eye text-white fs-3"></i>
                  </div>
                  <h3 className="fw-bold mb-3 text-dark">Our Vision</h3>
                  <p className="text-muted fs-5">
                    We envision a Pakistan where every educator has access to powerful tools through Examly.pk, the leading paper-making platform, enabling them to create papers and tests within seconds. We aim to provide every student from 5th to 12th class with a digital platform to assess their skills, strengthen their learning, and ensure their path to academic success.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section py-5 bg-white">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Making an Impact</h2>
              <p className="lead text-muted">Join thousands of educators and students transforming education with Examly.<sub>pk</sub></p>
            </div>
            <div className="row g-4">
              {stats.map((stat, index) => (
                <div key={index} className="col-lg-3 col-md-6">
                  <div className="stat-card text-center p-4">
                    <h2 className="display-4 fw-bold text-primary mb-2">{stat.number}</h2>
                    <p className="text-muted fw-medium mb-0">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="story-section py-5 bg-primary text-white">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6">
                <h2 className="h1 fw-bold mb-4">Our Story</h2>
                <p className="lead mb-4 opacity-75">
                  Examly was born from a simple observation: educators spend countless hours 
                  creating assessments while students struggle to find quality practice materials.
                </p>
                <p className="mb-4 opacity-75">
                  Founded in 2025 by a team of educators and technologists, we set out to 
                  bridge this gap. We combined artificial intelligence with educational expertise 
                  to create a platform that simplifies assessment creation while enhancing 
                  learning outcomes.
                </p>
                <p className="mb-0 opacity-75">
                  Today, we serve thousands of educators, students, and institutions worldwide, 
                  constantly innovating to meet the evolving needs of modern education.
                </p>
              </div>
              <div className="col-lg-6">
                <div className="timeline">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="timeline-item position-relative ps-4 pb-4">
                      <div className="timeline-year bg-warning text-dark rounded-pill px-3 py-1 d-inline-block fw-bold mb-2">
                        {milestone.year}
                      </div>
                      <h5 className="fw-bold mb-2">{milestone.title}</h5>
                      <p className="opacity-75 mb-0">{milestone.description}</p>
                      {index < milestones.length - 1 && (
                        <div className="timeline-connector position-absolute start-0 top-0 h-100 border-start border-2 border-warning"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="values-section py-5 bg-light">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Our Values</h2>
              <p className="lead text-muted">The principles that guide everything we do</p>
            </div>
            <div className="row g-4">
              {values.map((value, index) => (
                <div key={index} className="col-lg-3 col-md-6">
                  <div className="value-card text-center bg-white rounded-3 p-4 shadow-sm h-100 transition-all hover-lift">
                    <div className="value-icon bg-primary rounded-circle mx-auto d-flex align-items-center justify-content-center mb-3"
                         style={{width: '80px', height: '80px'}}>
                      <i className={`${value.icon} text-white fs-2`}></i>
                    </div>
                    <h5 className="fw-bold mb-3 text-dark">{value.title}</h5>
                    <p className="text-muted mb-0">{value.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="team-section py-5 bg-white">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Meet Our Team</h2>
              <p className="lead text-muted">Passionate educators and innovators driving change</p>
            </div>
            <div className="row g-4">
              {teamMembers.map((member, index) => (
                <div key={index} className="col-lg-3 col-md-6">
                  <div className="team-card text-center bg-light rounded-3 p-4 h-100 transition-all hover-lift">
                    <div className="team-image bg-primary rounded-circle mx-auto mb-3 d-flex align-items-center justify-content-center"
                         style={{width: '120px', height: '120px'}}>
                      <i className="bi bi-person-fill text-white fs-1"></i>
                    </div>
                    <h5 className="fw-bold mb-2 text-dark">{member.name}</h5>
                    <p className="text-primary fw-medium mb-2">{member.role}</p>
                    <p className="text-muted small mb-3">{member.description}</p>
                    <div className="social-links">
                      <a href={member.social.linkedin} className="text-muted me-2 hover-text-primary">
                        <i className="bi bi-linkedin fs-5"></i>
                      </a>
                      <a href={member.social.twitter} className="text-muted hover-text-primary">
                        <i className="bi bi-twitter fs-5"></i>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Highlight Section */}
        <section className="features-highlight-section py-5 bg-primary text-white">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-6">
                <h2 className="h1 fw-bold mb-4">What Makes Examly Different</h2>
                <div className="feature-list">
                  <div className="feature-item d-flex align-items-start mb-4">
                    <div className="feature-icon me-3">
                      <i className="bi bi-lightning-charge-fill text-warning fs-4"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-2">AI-Powered Paper Maker</h5>
                      <p className="opacity-75 mb-0">Create customized assessments in seconds, not hours</p>
                    </div>
                  </div>
                  <div className="feature-item d-flex align-items-start mb-4">
                    <div className="feature-icon me-3">
                      <i className="bi bi-graph-up-arrow text-warning fs-4"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-2">Smart Analytics</h5>
                      <p className="opacity-75 mb-0">Track student progress and identify learning gaps</p>
                    </div>
                  </div>
                  <div className="feature-item d-flex align-items-start mb-4">
                    <div className="feature-icon me-3">
                      <i className="bi bi-phone-fill text-warning fs-4"></i>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-2">Mobile-First Design</h5>
                      <p className="opacity-75 mb-0">Learn and teach anywhere, on any device</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6 text-center">
                <div className="feature-illustration bg-white bg-opacity-10 rounded-3 p-5">
                  <i className="bi bi-star-fill display-1 text-warning"></i>
                  <h4 className="mt-3 fw-bold">Trusted by Educators</h4>
                  <p className="mb-0 opacity-75">Rated 4.8/5 by thousands of users</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section py-5 bg-dark text-white">
          <div className="container">
            <div className="row justify-content-center text-center">
              <div className="col-lg-8">
                <h2 className="h1 fw-bold mb-4">Join the Examly Community</h2>
                <p className="lead mb-4 opacity-75">
                  Be part of the educational revolution. Start creating better assessments 
                  and engaging learning experiences today.
                </p>
                <div className="d-flex gap-3 justify-content-center flex-wrap">
                  <Link href="/auth/signup" className="btn btn-warning btn-lg px-5 py-3 fw-bold">
                    Start Free Trial
                  </Link>
                  <Link href="/contact" className="btn btn-outline-light btn-lg px-5 py-3">
                    Contact Us
                  </Link>
                </div>
                <div className="mt-4">
                  <small className="opacity-75">
                    ✓ 1 Month Free Trial ✓ No Credit Card Required ✓ Cancel Anytime
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <style jsx>{`
        .about-page {
          font-family: 'Inter', sans-serif;
        }
        
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
        
        .hover-text-primary:hover {
          color: var(--bs-primary) !important;
        }
        
        .timeline {
          position: relative;
        }
        
        .timeline-item {
          border-left: 2px solid var(--bs-warning);
        }
        
        .timeline-connector {
          left: -1px;
        }
        
        .team-image {
          background: linear-gradient(135deg, var(--bs-primary), var(--bs-info));
        }
        
        .hero-illustration, .feature-illustration {
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .stat-card {
          border-right: 1px solid #e9ecef;
        }
        
        .stat-card:last-child {
          border-right: none;
        }
        
        @media (max-width: 768px) {
          .hero-section .display-4 {
            font-size: 2.5rem !important;
          }
          
          .stat-card {
            border-right: none;
            border-bottom: 1px solid #e9ecef;
            padding-bottom: 2rem;
          }
          
          .stat-card:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
        }
      `}</style>
    </>
  );
}
'use client';
import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    userType: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing again
    if (submitStatus === 'error') {
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      // In the handleSubmit function, replace the success response handling:
if (response.ok) {
  const result = await response.json();
  setSubmitStatus('success');
  // Reset form
  setFormData({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    userType: ''
  });
} else {
  const result = await response.json();
  setSubmitStatus('error');
  setErrorMessage(result.message || 'Failed to send message. Please try again.');
}
    } catch (error) {
      console.error('Error sending message:', error);
      setSubmitStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: "bi bi-telephone-fill",
      title: "Call Us",
      details: "0343-0041686",
      description: "Available Monday to Friday, 9AM - 6PM",
      link: "tel:0343-0041686",
      color: "primary"
    },
    {
      icon: "bi bi-envelope-fill",
      title: "Email Us",
      details: "examlypk@gmail.com",
      description: "We'll respond within 24 hours",
      link: "mailto:examlypk@gmail.com",
      color: "success"
    },
    {
      icon: "bi bi-whatsapp",
      title: "WhatsApp",
      details: "0343-0041686",
      description: "Quick chat support",
      link: "https://wa.me/923430041686",
      color: "success"
    },
    {
      icon: "bi bi-geo-alt-fill",
      title: "Visit Office",
      details: "ToyoTa Ada Kasur Road, Raiwind",
      description: "Lahore, Pakistan",
      link: "#",
      color: "warning"
    }
  ];

  const faqs = [
    {
      question: "How do I start my free trial?",
      answer: "Simply sign up on our website and you'll automatically get 1 month of free access to all paper generation features."
    },
    {
      question: "What happens after my free trial ends?",
      answer: "After your free trial, you can choose from our affordable packages. We'll contact you to help select the right plan and process payment."
    },
    {
      question: "Can I extend my free trial?",
      answer: "Yes! Refer friends to Examly and get 1 additional free month for each successful referral."
    },
    {
      question: "Do you offer institutional plans?",
      answer: "Absolutely! We have special packages for schools, colleges, and coaching centers. Contact us for customized institutional pricing."
    }
  ];

  return (
    <>
      <Header />
      
      <div className="contact-page">
        {/* Hero Section */}
        <section className="hero-section bg-primary text-white py-5">
          <div className="container">
            <div className="row align-items-center min-vh-50 py-5">
              <div className="col-lg-6">
                <h1 className="display-4 fw-bold mb-4">
                  Contact <span className="text-warning">Examly</span>
                </h1>
                <p className="lead mb-4 opacity-75">
                  We're here to help you succeed! Get in touch with our team for any questions about 
                  paper generation, quiz features, or getting started with your free trial.
                </p>
                <div className="d-flex gap-3 flex-wrap">
                  <a href="tel:03045302981" className="btn btn-warning btn-lg px-4 py-2 fw-bold">
                    <i className="bi bi-telephone me-2"></i>
                    Call Now
                  </a>
                  <Link href="/auth/signup" className="btn btn-outline-light btn-lg px-4 py-2">
                    Start Free Trial
                  </Link>
                </div>
              </div>
              <div className="col-lg-6 text-center">
                <div className="hero-illustration bg-white bg-opacity-10 rounded-3 p-5">
                  <i className="bi bi-headset display-1 text-warning"></i>
                  <h4 className="mt-3 fw-bold">24/7 Support</h4>
                  <p className="mb-0 opacity-75">We're always here to help you</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Methods Section */}
        <section className="contact-methods-section py-5 bg-light">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Get in Touch</h2>
              <p className="lead text-muted">Multiple ways to reach us for quick support</p>
            </div>
            <div className="row g-4">
              {contactMethods.map((method, index) => (
                <div key={index} className="col-lg-3 col-md-6">
                  <a 
                    href={method.link} 
                    className={`contact-method-card text-decoration-none text-dark bg-white rounded-3 p-4 d-block h-100 transition-all hover-lift ${
                      method.color === 'primary' ? 'border-primary' : 
                      method.color === 'success' ? 'border-success' : 
                      'border-warning'
                    }`}
                    style={{borderLeft: `4px solid var(--bs-${method.color})`}}
                    target={method.link.startsWith('http') ? '_blank' : '_self'}
                    rel={method.link.startsWith('http') ? 'noopener noreferrer' : ''}
                  >
                    <div className={`method-icon bg-${method.color} rounded-circle d-inline-flex align-items-center justify-content-center mb-3`}
                         style={{width: '60px', height: '60px'}}>
                      <i className={`${method.icon} text-white fs-4`}></i>
                    </div>
                    <h5 className="fw-bold mb-2">{method.title}</h5>
                    <p className="h6 text-primary mb-2">{method.details}</p>
                    <p className="text-muted small mb-0">{method.description}</p>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="contact-form-section py-5 bg-white">
          <div className="container">
            <div className="row">
              <div className="col-lg-8 mx-auto">
                <div className="text-center mb-5">
                  <h2 className="h1 fw-bold mb-3 text-dark">Send us a Message</h2>
                  <p className="lead text-muted">Fill out the form below and we'll get back to you within 24 hours</p>
                </div>

                <div className="contact-form-card bg-light rounded-3 p-4 p-lg-5">
                  {submitStatus === 'success' && (
                    <div className="alert alert-success alert-dismissible fade show" role="alert">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      <strong>Thank you for your message!</strong> We've received your inquiry and will get back to you within 24 hours at <strong>{formData.email}</strong>.
                      <button type="button" className="btn-close" onClick={() => setSubmitStatus('idle')}></button>
                    </div>
                  )}

                  {submitStatus === 'error' && (
                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      <strong>There was an error sending your message.</strong> {errorMessage || 'Please try again or contact us directly at '}
                      {!errorMessage && <a href="tel:03045302981" className="alert-link">0304-5302981</a>}
                      <button type="button" className="btn-close" onClick={() => setSubmitStatus('idle')}></button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label htmlFor="name" className="form-label fw-medium">Full Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Enter your full name"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="email" className="form-label fw-medium">Email Address *</label>
                        <input
                          type="email"
                          className="form-control form-control-lg"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          placeholder="Enter your email"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="phone" className="form-label fw-medium">Phone Number</label>
                        <input
                          type="tel"
                          className="form-control form-control-lg"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="0300-1234567"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="userType" className="form-label fw-medium">I am a *</label>
                        <select
                          className="form-select form-select-lg"
                          id="userType"
                          name="userType"
                          value={formData.userType}
                          onChange={handleChange}
                          required
                          disabled={isSubmitting}
                        >
                          <option value="">Select your role</option>
                          <option value="teacher">Teacher/Educator</option>
                          <option value="student">Student</option>
                          <option value="institution">Institution Admin</option>
                          <option value="job_seeker">Job Seeker</option>
                          <option value="parent">Parent</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="col-12">
                        <label htmlFor="subject" className="form-label fw-medium">Subject *</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          placeholder="What is this regarding?"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="col-12">
                        <label htmlFor="message" className="form-label fw-medium">Message *</label>
                        <textarea
                          className="form-control form-control-lg"
                          id="message"
                          name="message"
                          rows={5}
                          value={formData.message}
                          onChange={handleChange}
                          required
                          placeholder="Tell us how we can help you..."
                          disabled={isSubmitting}
                        ></textarea>
                      </div>
                      <div className="col-12">
                        <button
                          type="submit"
                          className="btn btn-primary btn-lg px-5 py-3 w-100 fw-bold"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                              Sending to meshfaq@yahoo.com...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-send-fill me-2"></i>
                              Send Message to meshfaq@yahoo.com
                            </>
                          )}
                        </button>
                      </div>
                      <div className="col-12 text-center">
                        <small className="text-muted">
                          Prefer to call? Reach us directly at <a href="tel:03045302981" className="text-primary">0304-5302981</a>
                        </small>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section py-5 bg-light">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="h1 fw-bold mb-3 text-dark">Frequently Asked Questions</h2>
              <p className="lead text-muted">Quick answers to common questions</p>
            </div>
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <div className="accordion" id="faqAccordion">
                  {faqs.map((faq, index) => (
                    <div key={index} className="accordion-item border-0 mb-3 shadow-sm">
                      <h3 className="accordion-header">
                        <button
                          className="accordion-button collapsed rounded-3 fw-medium"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#faq${index}`}
                        >
                          {faq.question}
                        </button>
                      </h3>
                      <div
                        id={`faq${index}`}
                        className="accordion-collapse collapse"
                        data-bs-parent="#faqAccordion"
                      >
                        <div className="accordion-body text-muted">
                          {faq.answer}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4">
                  <p className="text-muted">
                    Still have questions? <a href="tel:03045302981" className="text-primary fw-medium">Call us at 0343-0041686</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Support Section */}
        <section className="emergency-support-section py-5 bg-primary text-white">
          <div className="container">
            <div className="row align-items-center text-center text-lg-start">
              <div className="col-lg-8">
                <h3 className="h2 fw-bold mb-3">Need Immediate Help?</h3>
                <p className="lead mb-4 opacity-75">
                  Having trouble with your account, payment, or technical issues? 
                  Our support team is ready to help you right away.
                </p>
                <div className="d-flex gap-3 flex-wrap justify-content-center justify-content-lg-start">
                  <a href="tel:03045302981" className="btn btn-warning btn-lg px-4 py-2 fw-bold">
                    <i className="bi bi-telephone-fill me-2"></i>
                    Call Support: 0343-0041686
                  </a>
                  <a href="https://wa.me/923430041686" className="btn btn-success btn-lg px-4 py-2" target="_blank" rel="noopener noreferrer">
                    <i className="bi bi-whatsapp me-2"></i>
                    WhatsApp Chat
                  </a>
                </div>
              </div>
              <div className="col-lg-4 text-center">
                <div className="support-illustration">
                  <i className="bi bi-lightning-charge-fill display-1 text-warning"></i>
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
                <h2 className="h1 fw-bold mb-4">Ready to Get Started?</h2>
                <p className="lead mb-4 opacity-75">
                  Join thousands of educators and students already using Examly to transform their teaching and learning experience.
                </p>
                <div className="d-flex gap-3 justify-content-center flex-wrap">
                  <Link href="/auth/signup" className="btn btn-warning btn-lg px-5 py-3 fw-bold">
                    Start 3 Month Free Trial
                  </Link>
                  <a href="tel:03045302981" className="btn btn-outline-light btn-lg px-5 py-3">
                    <i className="bi bi-telephone me-2"></i>
                    Call to Learn More
                  </a>
                </div>
                <div className="mt-4">
                  <small className="opacity-75">
                    ✓ Free 3 Month Trial ✓ No Credit Card Required ✓ Expert Support Available
                  </small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />

      <style jsx>{`
        .contact-page {
          font-family: 'Inter', sans-serif;
        }
        
        .min-vh-50 {
          min-height: 50vh;
        }
        
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.175) !important;
        }
        
        .transition-all {
          transition: all 0.3s ease;
        }
        
        .contact-method-card:hover {
          text-decoration: none;
          color: var(--bs-dark) !important;
        }
        
        .hero-illustration {
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .contact-form-card {
          border: 1px solid #e9ecef;
        }
        
        .form-control, .form-select {
          border: 1px solid #dee2e6;
          transition: all 0.3s ease;
        }
        
        .form-control:focus, .form-select:focus {
          border-color: var(--bs-primary);
          box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
        }
        
        .accordion-button:not(.collapsed) {
          background-color: var(--bs-primary);
          color: white;
        }
        
        .accordion-button:focus {
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
        
        @media (max-width: 768px) {
          .hero-section .display-4 {
            font-size: 2.5rem !important;
          }
          
          .contact-methods-section .col-lg-3 {
            margin-bottom: 1rem;
          }
        }
      `}</style>
    </>
  );
}
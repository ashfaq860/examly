import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: "Privacy Policy | Examly.pk",
  description:
    "Privacy Policy of Examly.pk – Teacher paper generation and assessment platform",
};

export default function PrivacyPolicy() {
  return (
    <>
      <Header />

      <main className="privacy-policy-page">

        {/* Hero Section */}
        <section className="hero-section bg-primary text-white py-5">
          <div className="container">
            <div className="row justify-content-center text-center py-5">
              <div className="col-lg-8">
                <h1 className="display-5 fw-bold mb-3">
                  Privacy Policy
                </h1>
                <p className="lead opacity-75">
                  Your privacy matters to us. Learn how Examly.pk protects your data.
                </p>
                <small className="opacity-75">
                  Effective Date: {new Date().toLocaleDateString()}
                </small>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="content-section py-5 bg-light">
          <div className="container">
            <div className="row g-4">

              {/* Introduction */}
              <div className="col-12">
                <div className="bg-white rounded-3 shadow-sm p-4">
                  <p className="text-muted mb-0">
                    At <strong>Examly.pk</strong>, we respect the privacy of teachers,
                    institutions, and educational professionals who use our platform
                    to create question papers, assessments, and tests. This Privacy
                    Policy explains how we collect, use, and protect your personal
                    information.
                  </p>
                </div>
              </div>

              {/* Information Collection */}
              <div className="col-lg-6">
                <div className="bg-white rounded-3 shadow-sm p-4 h-100">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-database-lock me-2 text-primary"></i>
                    Information We Collect
                  </h5>
                  <ul className="text-muted mb-0">
                    <li>Full name</li>
                    <li>Email address</li>
                    <li>Mobile / cell phone number</li>
                    <li>School, college, or institute name</li>
                    <li>Account and profile information</li>
                    <li>Generated question papers and assessments</li>
                  </ul>
                </div>
              </div>

              {/* Usage */}
              <div className="col-lg-6">
                <div className="bg-white rounded-3 shadow-sm p-4 h-100">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-gear me-2 text-primary"></i>
                    How We Use Your Information
                  </h5>
                  <p className="text-muted mb-0">
                    Your data is used strictly to manage your account, enable
                    paper generation, provide platform features, verify eligibility
                    for free trials or referrals, and communicate important
                    service-related updates.
                  </p>
                </div>
              </div>

              {/* Data Sharing */}
              <div className="col-12">
                <div className="bg-success bg-opacity-10 border border-success rounded-3 p-4">
                  <h5 className="fw-bold text-success mb-2">
                    <i className="bi bi-shield-check me-2"></i>
                    Data Sharing & Confidentiality
                  </h5>
                  <p className="text-muted mb-0">
                    Examly.pk <strong>does not sell, rent, or share</strong> your
                    personal information with any third party. Your email address,
                    mobile number, institute details, and generated content remain
                    completely private and confidential.
                  </p>
                </div>
              </div>

              {/* Trial Policy */}
              <div className="col-12">
                <div className="bg-warning bg-opacity-10 border border-warning rounded-3 p-4">
                  <h5 className="fw-bold text-warning mb-2">
                    <i className="bi bi-gift me-2"></i>
                    Free Trial Policy
                  </h5>
                  <p className="text-muted mb-2">
                    Examly.pk offers a <strong>3-month (90 days) free trial</strong>
                    to eligible users. To avail this trial, users must register
                    on the platform or log in using Google and complete their
                    profile with a <strong>valid mobile number</strong>.
                  </p>
                  <p className="text-muted mb-0">
                    Providing an incorrect, fake, or invalid mobile number may
                    result in immediate suspension of the trial period or
                    permanent removal of the account without prior notice.
                  </p>
                </div>
              </div>

              {/* Referral Policy */}
              <div className="col-12">
                <div className="bg-info bg-opacity-10 border border-info rounded-3 p-4">
                  <h5 className="fw-bold text-info mb-2">
                    <i className="bi bi-people-fill me-2"></i>
                    Referral Program Policy
                  </h5>
                  <p className="text-muted mb-2">
                    Users who refer Examly.pk to others using their referral
                    code will be rewarded with <strong>1 month of free access</strong>
                    for each successful referral.
                  </p>
                  <p className="text-muted mb-0">
                    Referral rewards are granted only when the referred user
                    successfully registers, completes their profile, and
                    provides a <strong>valid mobile number</strong>. Examly.pk
                    reserves the right to withhold or cancel referral rewards
                    in case of misuse, fraud, or incomplete verification.
                  </p>
                </div>
              </div>

              {/* Security */}
              <div className="col-lg-6">
                <div className="bg-white rounded-3 shadow-sm p-4 h-100">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-lock me-2 text-primary"></i>
                    Data Security
                  </h5>
                  <p className="text-muted mb-0">
                    We implement appropriate security measures including secure
                    authentication, encrypted storage, and restricted internal
                    access to protect your data from unauthorized access.
                  </p>
                </div>
              </div>

              {/* Cookies */}
              <div className="col-lg-6">
                <div className="bg-white rounded-3 shadow-sm p-4 h-100">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-cookie me-2 text-primary"></i>
                    Cookies & Analytics
                  </h5>
                  <p className="text-muted mb-0">
                    Examly.pk may use cookies and similar technologies to
                    maintain user sessions and improve platform performance.
                    Cookies never store sensitive personal information.
                  </p>
                </div>
              </div>

              {/* Children */}
              <div className="col-12">
                <div className="bg-white rounded-3 shadow-sm p-4">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-people me-2 text-primary"></i>
                    Children’s Privacy
                  </h5>
                  <p className="text-muted mb-0">
                    Examly.pk is designed for teachers and educational
                    professionals only. We do not knowingly collect personal
                    information from children under the age of 13.
                  </p>
                </div>
              </div>

              {/* Updates */}
              <div className="col-12">
                <div className="bg-white rounded-3 shadow-sm p-4">
                  <h5 className="fw-bold mb-3">
                    <i className="bi bi-arrow-repeat me-2 text-primary"></i>
                    Policy Updates
                  </h5>
                  <p className="text-muted mb-0">
                    This Privacy Policy may be updated from time to time.
                    Continued use of the platform indicates acceptance of the
                    updated policy.
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="col-12">
                <div className="bg-dark text-white rounded-3 p-4 text-center">
                  <h5 className="fw-bold mb-2">Contact Us</h5>
                  <p className="opacity-75 mb-2">
                    If you have any questions regarding this Privacy Policy:
                  </p>
                  <p className="fw-bold mb-0">
                    📧 examlypk@gmail.com
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}

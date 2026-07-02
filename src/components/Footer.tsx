// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer({ darkMode = false }: { darkMode?: boolean }) {
  return (
    <footer className="app-footer">
      <div className="container">
        <div className="row gy-4 gx-5">

          {/* Brand column */}
          <div className="col-12 col-lg-4">
            <div className="mb-3">
              <h4 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                Examly<span style={{ color: 'rgba(43,167,255,0.9)' }}>.pk</span>
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'rgba(219,234,254,0.7)', lineHeight: 1.7, marginBottom: '1.25rem', maxWidth: '32ch' }}>
                AI-powered paper generation, quizzes, and assessment tools built for Pakistani teachers, academies, and students.
              </p>
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {['BISE Standard', 'Class 5–12', 'Urdu + English'].map((label) => (
                <span
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 99,
                    padding: '3px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'rgba(219,234,254,0.8)',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="col-6 col-md-4 col-lg-2">
            <h5>Services</h5>
            <ul>
              <li><Link href="/dashboard/generate-paper">Make Paper</Link></li>
              <li><Link href="/quiz">Online Quiz</Link></li>
              <li><Link href="/dashboard/make-time-table">Time Table</Link></li>
              <li><Link href="/packages">Pricing Plans</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="col-6 col-md-4 col-lg-2">
            <h5>Company</h5>
            <ul>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/how-examly-works">How It Works</Link></li>
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions">Terms</Link></li>
            </ul>
          </div>

          {/* Get started CTA */}
          <div className="col-12 col-md-4 col-lg-4">
            <h5>Start for Free</h5>
            <p style={{ fontSize: '0.875rem', color: 'rgba(219,234,254,0.65)', lineHeight: 1.65, marginBottom: '1rem' }}>
              Generate your first paper in minutes. No credit card required. 3 months free access on signup.
            </p>
            <Link
              href="/auth/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #1ba699 0%, #0b63d4 100%)',
                color: '#fff',
                padding: '0.6rem 1.4rem',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '0.875rem',
                textDecoration: 'none',
                transition: 'opacity 0.2s, transform 0.2s',
                letterSpacing: '0.01em',
              }}
            >
              Create Free Account →
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
          <div>&copy; {new Date().getFullYear()} Examly.pk — All rights reserved</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/privacy-policy" style={{ color: 'rgba(219,234,254,0.5)', fontSize: '0.8rem' }}>Privacy</Link>
            <Link href="/terms-and-conditions" style={{ color: 'rgba(219,234,254,0.5)', fontSize: '0.8rem' }}>Terms</Link>
            <Link href="/contact" style={{ color: 'rgba(219,234,254,0.5)', fontSize: '0.8rem' }}>Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

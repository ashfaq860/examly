// src/components/AuthLayout.tsx
'use client';
import Header from './Header';
import Footer from './Footer';
import '@/app/styles/auth.css';

export default function AuthLayout({ children, title, subtitle } ) {
  return (
    <>
      <Header />
      <main className="auth-wrapper d-flex align-items-center justify-content-center">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-sm-10 col-md-8 col-lg-5">
              <div className="card auth-card shadow-sm p-4">
                {title && <h3 className="mb-1">{title}</h3>}
                {subtitle && <p className="text-muted small mb-3">{subtitle}</p>}
                {children}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

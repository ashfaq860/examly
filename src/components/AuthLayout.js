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
             <h3 className="mb-1 text-center"><img src="/examly.png" height="60" width="180" className='text-center'/></h3>
             {subtitle && <p className=" small mb-3 text-danger text-center">*{subtitle}*</p>}
                 {title && <h3 className="mb-1 text-center">{title}</h3>}
                
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

// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="app-footer mt-5">
      <div className="container">
        <div className="row gy-3">
          <div className="col-md-4">
            <h5>Examly</h5>
            <p className="small-muted">Learn • Generate Papers • Quiz Online</p>
            <p className="small">Contact: support@examly.pk</p>
          </div>

          <div className="col-md-4">
            <h6>Product</h6>
            <ul className="list-unstyled">
              <li><Link href="/features">Features</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </div>

          <div className="col-md-4">
            <h6>Company</h6>
            <ul className="list-unstyled">
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>

        <hr style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <div className="d-flex justify-content-between small">
          <div>© {new Date().getFullYear()} Examly.pk</div>
          <div>Made with ❤️ for students & academies</div>
        </div>
      </div>
    </footer>
  );
}

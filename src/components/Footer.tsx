// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="app-footer mt-5">
      <div className="container">
        <div className="row gy-3">
          <div className="col-md-4">
            <h5>Examly</h5>
            <p className="small-muted">Make Papers • Quiz Online</p>
            <p className="small">Contact: support@examly.pk</p>
          </div>

          <div className="col-md-4">
            <h6>Product</h6>
            <ul className="list-unstyled">
              <li><Link href="/dashboard/generate-paper">Make Paper</Link></li>
              <li><Link href="/packages">Packages</Link></li>
               <li><Link href="/quiz">Quiz</Link></li>
             
            </ul>
          </div>

          <div className="col-md-4">
            <h6>Company</h6>
            <ul className="list-unstyled">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact Us</Link></li>
              
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

// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="app-footer mt-0 pt-2">
      <div className="container">
        <div className="row gy-3">
         

          <div className="col-6 col-md-4">
            <h4>Our Services</h4>
            <ul className="list-unstyled">
              <li><Link href="/dashboard/generate-paper">Make Paper</Link></li>
              <li><Link href="/dashboard/make-time-table">Make Time Table</Link></li>
               <li><Link href="/quiz">Quiz</Link></li>
             
            </ul>
          </div>

          <div className="col-6 col-md-4">
            
            <ul className="list-unstyled">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact Us</Link></li>
                <li><Link href="/privacy-policy">Privacy Policy</Link></li>
                  <li><Link href="/terms-and-conditions">Terms&Conditions</Link></li>
              <li><Link href="/packages">Packages</Link></li>
            </ul>
          </div>
        </div>

       
        <div className="d-flex justify-content-between small">
          <div>© {new Date().getFullYear()} Examly.pk</div>
          <div>Made with ❤️ for students & academies</div>
        </div>
      </div>
    </footer>
  );
}

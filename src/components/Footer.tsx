// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer({ darkMode = false }: { darkMode?: boolean }) {
  return (
    <footer className={`app-footer mt-0 ${darkMode ? 'app-footer-dark' : ''}`}>
      <div className="container">
        <div className="row gy-3">
          <div className="col-12 col-md-4">
            <h4>Examly.pk</h4>
            <p className="small-muted mb-0">
              Paper generation, quizzes, and assessment tools for teachers, academies, and students.
            </p>
          </div>

          <div className="col-6 col-md-4">
            <h4>Our Services</h4>
            <ul className="list-unstyled">
              <li><Link href="/dashboard/generate-paper">Make Paper</Link></li>
              <li><Link href="/dashboard/make-time-table">Make Time Table</Link></li>
              <li><Link href="/quiz">Quiz</Link></li>
            </ul>
          </div>

          <div className="col-6 col-md-4">
            <h4>Company</h4>
            <ul className="list-unstyled">
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact Us</Link></li>
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions">Terms & Conditions</Link></li>
              <li><Link href="/packages">Packages</Link></li>
            </ul>
          </div>
        </div>

        <div className="d-flex flex-column flex-md-row gap-2 justify-content-between small border-top border-light border-opacity-25 pt-3 mt-3">
          <div>(c) {new Date().getFullYear()} Examly.pk</div>
          <div>Made for students and academies</div>
        </div>
      </div>
    </footer>
  );
}

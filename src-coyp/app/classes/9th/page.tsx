'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumb from '@/components/Breadcrumb';
import { useRouter } from 'next/navigation';
const subjects9th = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Urdu',
  'Islamiat',
  'Pakistan Studies',
];

export default function Class9thPage() {
    const router=   useRouter();
  return (
    <>
      <Header />
      <main className="container py-5">
        <button
          type="button"
          className="btn btn-link mb-4"
          onClick={() => router.back()}
          style={{ textDecoration: 'none' }}
        >
          &larr; Back
        </button>
        <h2 className="mb-4">Class 9 Subjects</h2>
        <div className="row g-4">
          {subjects9th.map((subject) => (
            <div key={subject} className="col-6 col-md-4 col-lg-3">
              <Link
                href={`/quiz/9th/${subject.toLowerCase().replace(/\s+/g, '-')}`}
                className="card shadow-sm text-center text-decoration-none p-4"
                style={{ borderRadius: 12 }}
              >
                <h5 className="mb-0">{subject}</h5>
              </Link>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

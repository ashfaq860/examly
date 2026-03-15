'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Breadcrumb from '@/components/Breadcrumb';
import { useRouter } from 'next/navigation';

const classes = [
  { id: '1', label: 'Class 1' },
  { id: '2', label: 'Class 2' },
  { id: '3', label: 'Class 3' }, 
  { id: '4', label: 'Class 4' },
  { id: '5', label: 'Class 5' },
  { id: '6', label: 'Class 6' },
  { id: '7', label: 'Class 7' },
  { id: '8', label: 'Class 8' },
  { id: '9', label: 'Class 9' },
  { id: '10', label: 'Class 10' },
  { id: '11', label: 'Class 11' },
  { id: '12', label: 'Class 12' },
  { id: 'job-prep', label: 'Job Preparation' },
];

export default function ClassesOverviewPage() {
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
        <h2 className="mb-4 text-center">All Classes & Job Preparation</h2>
        <div className="row g-4 justify-content-center">
          {classes.map(({ id, label }) => (
            <div key={id} className="col-6 col-md-4 col-lg-3">
              <Link
                href={`/classes/${id}`}
                className="card shadow-sm text-center text-decoration-none p-4"
                style={{ borderRadius: 12 }}
              >
                <h3 className="mb-0">{label}</h3>
              </Link>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

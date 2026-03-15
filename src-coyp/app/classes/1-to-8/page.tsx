'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';

const classes = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Classes1to8Page() {
 const router=  useRouter();
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
        <h2 className="mb-4">Classes 1 to 8</h2>
        <div className="row g-4">
          {classes.map((cls) => (
            <div key={cls} className="col-6 col-md-3 col-lg-2">
              <Link
                href={`/classes/1-to-8/${cls}`}
                className="card shadow-sm text-center text-decoration-none p-4"
                style={{ borderRadius: 12 }}
              >
                <h3 className="mb-0">Class {cls}</h3>
              </Link>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

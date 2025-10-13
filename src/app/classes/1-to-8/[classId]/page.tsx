'use client';

import { useParams,useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
const subjectsByClass: Record<string, string[]> = {
  '1': ['Mathematics', 'English', 'Science', 'Urdu'],
  '2': ['Mathematics', 'English', 'Science', 'Urdu'],
  '3': ['Mathematics', 'English', 'Science', 'Urdu', 'Social Studies'],
  // ... up to class 8
  '8': ['Mathematics', 'English', 'Science', 'Urdu', 'Social Studies', 'Islamiyat'],
};

export default function ClassSubjectsPage() {
  const params = useParams();
const router= useRouter();
  const classId = params.classId;

  const subjects = subjectsByClass[classId] || ['Mathematics', 'English', 'Science'];

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
        <h2 className="mb-4">Class {classId} - Subjects</h2>
        <div className="row g-4">
          {subjects.map((subject) => (
            <div key={subject} className="col-6 col-md-4 col-lg-3">
              <Link
                href={`/quiz/${classId}/${subject.toLowerCase()}`}
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

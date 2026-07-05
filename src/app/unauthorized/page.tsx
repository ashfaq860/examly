// app/unauthorized/page.tsx
'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Unauthorized() {
  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = '/auth/login';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-lg text-gray-600 mb-4">
          You don't have permission to access this page.
        </p>
        <p className="text-gray-500">
          Redirecting to login page...
        </p>
        <Link href="/auth/login" className="text-blue-600 hover:underline mt-4 inline-block">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
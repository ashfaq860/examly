'use client';

import { Suspense } from 'react';
import SignupForm from './SignupFormContent';

export default function SignupPage() {
  // ✅ Wrap content inside Suspense
  return (
    <Suspense fallback={<div>Loading signup form...</div>}>
      <SignupForm />
    </Suspense>
  );
}

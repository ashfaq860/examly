// src/app/dashboard/layout.tsx
// ✅ This is the KEY file — it keeps AcademyLayout mounted persistently
// across ALL /dashboard/* routes so it never remounts on navigation.

import type { Metadata } from 'next';
import AcademyLayout from '@/components/AcademyLayout';

// Belt-and-suspenders alongside robots.ts: keep signed-in-only pages out of
// search results even if a dashboard URL ever gets linked/crawled externally.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademyLayout>
      {children}
    </AcademyLayout>
  );
}

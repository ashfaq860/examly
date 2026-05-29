// src/app/dashboard/layout.tsx
// ✅ This is the KEY file — it keeps AcademyLayout mounted persistently
// across ALL /dashboard/* routes so it never remounts on navigation.

import AcademyLayout from '@/components/AcademyLayout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademyLayout>
      {children}
    </AcademyLayout>
  );
}

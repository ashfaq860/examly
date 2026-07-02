import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Examly.pk',
  description: 'Learn about Examly.pk — our mission, values, and the team building Pakistan\'s smart question paper generator and online test maker for schools, colleges, and academies.',
  alternates: { canonical: '/about' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing & Packages | Examly.pk',
  description: 'Compare Examly.pk subscription plans and paper packages for teachers, schools, and academies. Start with a free trial and unlock unlimited paper generation.',
  alternates: { canonical: '/packages' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

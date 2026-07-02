import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Examly.pk',
  description: 'Privacy Policy of Examly.pk – Teacher paper generation and assessment platform',
  alternates: { canonical: '/privacy-policy' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

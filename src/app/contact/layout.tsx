import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | Examly.pk',
  description: 'Get in touch with the Examly.pk team for support, sales enquiries, or feedback about our online test maker and question paper generator.',
  alternates: { canonical: '/contact' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

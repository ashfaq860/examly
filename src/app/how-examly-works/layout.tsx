import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How Examly Works | Examly.pk',
  description: 'See how Examly.pk helps teachers generate board-pattern exam papers, run online quizzes, and manage question banks in just a few simple steps.',
  alternates: { canonical: '/how-examly-works' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

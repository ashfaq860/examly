// src/app/layout.tsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
//import '../styles/nprogress.css';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { Poppins } from 'next/font/google';
import { UserProvider } from './context/userContext';
import ClientLayoutWrapper from "./ClientLayoutWrapper";
import ChunkErrorReload from '@/components/ChunkErrorReload';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});


export const metadata = {
  metadataBase: new URL('https://www.examly.pk'),
  title: {
    default: 'Examly - Online Test Maker, Question Paper Generator & Quiz Platform',
    template: '%s',
  },
  description: 'Examly is a powerful online test maker and question paper generator designed for schools, colleges, and academies. Create professional exams, full or half-book papers, and custom chapter tests with difficulty-based and question-type balanced distribution. Generate board pattern papers in BISE format, manage online quizzes, and design teacher timetables easily. Perfect for educators seeking a smart, time-saving system for high-quality assessments. With Examly, you can automate test creation, instantly download printable papers, and provide students with accurate, organized, and fair evaluations. Boost efficiency, save time, and enhance academic performance with our comprehensive paper generation and online test platform.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Examly.pk',
    title: 'Examly - Online Test Maker, Question Paper Generator & Quiz Platform',
    description: 'Create professional exams, board-pattern papers, and online quizzes in minutes — built for schools, colleges, and academies.',
    url: 'https://www.examly.pk',
    images: ['/examly.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Examly - Online Test Maker, Question Paper Generator & Quiz Platform',
    description: 'Create professional exams, board-pattern papers, and online quizzes in minutes — built for schools, colleges, and academies.',
    images: ['/examly.png'],
  },
};


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>
        {/* Note: the JameelNoori Urdu font (~5.4MB) is intentionally NOT preloaded
            here — it's only used on Urdu question/paper screens, and preloading it
            sitewide was forcing a huge high-priority download on every page load
            (including this marketing homepage), which tanked LCP. It still loads
            on-demand via @font-face + font-display: swap wherever `.urdu-text` is used. */}
      </head>

      <body>
        <ChunkErrorReload />
        {/* MathJax is NOT loaded here — it was previously loaded globally
            (tex-mml-chtml.js, ~250KB) on every single page even though it's
            only needed on the admin question bank / manual question selection
            screens, which already load their own copy (tex-svg.js) on demand
            via ManualQuestionSelection.tsx and admin/management/questions.
            The global copy was pure dead weight (100% unused JS) everywhere else. */}
        <Toaster
  position="top-center" 
  reverseOrder={false} 
  containerStyle={{
    zIndex: 999999, // Higher than your modal's 9999
  }}
  toastOptions={{
    // This ensures individual toasts also respect the depth
    style: {
      zIndex: 999999,
    },
  }}
/>
        <UserProvider>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </UserProvider>
      </body>
    </html>
  );
}

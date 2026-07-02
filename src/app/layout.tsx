// src/app/layout.tsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
//import '../styles/nprogress.css';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { UserProvider } from './context/userContext';
import ClientLayoutWrapper from "./ClientLayoutWrapper";

import 'katex/dist/katex.min.css';
// @ts-ignore
import { InlineMath, BlockMath } from 'react-katex';


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
    <html lang="en">
      <head>
        <meta
  name="viewport"
  content="width=device-width, initial-scale=1"
/>
        {/* Preconnect to external font resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
  rel="preload"
  href="/fonts/JameelNooriNastaleeqRegular.woff2"
  as="font"
  type="font/woff2"
  crossOrigin="anonymous"
/>
        {/* Load only necessary font weights for better performance */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body>
        {/* Only the admin question bank / manual question selection screens
            use MathJax — load it off the critical path everywhere else so
            it doesn't block first paint on marketing/dashboard pages. */}
        <Script
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="lazyOnload"
        />
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

// src/app/layout.tsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
//import '../styles/nprogress.css';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { UserProvider } from './context/userContext';
import ClientLayoutWrapper from "./ClientLayoutWrapper";


export const metadata = {
  title: 'Examly — Online Test Maker, Question Paper Generator & Quiz Platform',
  description: 'Examly is a powerful online test maker and question paper generator designed for schools, colleges, and academies. Create professional exams, full or half-book papers, and custom chapter tests with difficulty-based and question-type balanced distribution. Generate board pattern papers in BISE format, manage online quizzes, and design teacher timetables easily. Perfect for educators seeking a smart, time-saving system for high-quality assessments. With Examly, you can automate test creation, instantly download printable papers, and provide students with accurate, organized, and fair evaluations. Boost efficiency, save time, and enhance academic performance with our comprehensive paper generation and online test platform.'
};


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body>
        <Toaster />
        <UserProvider>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </UserProvider>
      </body>
    </html>
  );
}

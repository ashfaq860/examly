// src/app/layout.tsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
//import '../styles/nprogress.css';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { UserProvider } from './context/userContext';
import ClientLayoutWrapper from "./ClientLayoutWrapper";


export const metadata = {
  title: 'Examly —  Generate Papers • Make Tests • Make Teacher Time Table • Quiz Online',
  description: 'Examly - Make Tests, paper generation, Make Teacher Time Table and online quizzes for students and academies.',
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

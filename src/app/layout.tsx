// src/app/layout.tsx
import './globals.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Toaster } from 'react-hot-toast';
import type { ReactNode } from 'react';
import { UserProvider } from './context/userContext';

export const metadata = {
  title: 'Examly — Learn • Generate Papers • Quiz Online',
  description: 'Examly - learning resources, paper generation, and online quizzes for students and academies.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Toaster />
        <UserProvider>
        {children}
        </UserProvider>
      </body>
    </html>
  );
}

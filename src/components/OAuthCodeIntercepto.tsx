// Add this component to your home page (app/page.tsx or src/app/page.tsx)
// It detects a stray ?code= param and forwards it to the real callback handler.

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OAuthCodeInterceptor() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // The OAuth code landed on the wrong page — forward it to the real handler.
      console.warn('[OAuthInterceptor] Stray OAuth code detected, forwarding to /auth/callback');
      router.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    }
  }, [router]);

  return null; // Renders nothing
}
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const setupUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.replace('/auth/login');
      return;
    }

    const res = await fetch('/api/auth/google-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        full_name: session.user.user_metadata?.name || '',
        email: session.user.email,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Google callback failed', res.status, text);
      return;
    }

    const data = await res.json();
    console.log('Google callback data:', data);

    // Redirect based on role
    if (data.role === 'admin') router.replace('/admin');
    else router.replace('/dashboard');
  };

  setupUserProfile();
}, [router, supabase]);


  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100">
      <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <p className="text-muted">Completing sign-in… please wait</p>
    </div>
  );
}

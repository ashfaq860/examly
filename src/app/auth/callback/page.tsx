'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function GoogleCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const setupUserProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/auth/login');
        return;
      }

      // Call API to create profile and set referral code
      const res = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          full_name: session.user.user_metadata?.name || '',
          email: session.user.email,
        }),
      });

      const result = await res.json();
      console.log('Google profile setup result:', result);

      // Redirect to dashboard
      router.replace('/dashboard');
    };

    setupUserProfile();
  }, [router, supabase]);

  return <div>Setting up your account...</div>;
}

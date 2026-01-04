'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';

// Inner component that uses useSearchParams
function AuthCallbackInner() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check for OAuth error in URL
        const errorCode = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (errorCode) {
          console.error('OAuth Error:', errorCode, errorDescription);
          setError(`Authentication failed: ${errorDescription || errorCode}`);
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }

        // Check for OAuth success code
        const code = searchParams.get('code');
        if (!code) {
          // If no code, check if we already have a session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            console.error('No session found and no OAuth code');
            setTimeout(() => router.push('/auth/login'), 2000);
            return;
          }
          
          // We have a session, proceed
          await processUserSession(session);
          return;
        }

        // Exchange the code for a session
        const { data: { session }, error: oauthError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (oauthError || !session) {
          console.error('OAuth exchange error:', oauthError);
          setError('Failed to complete authentication. Please try again.');
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }

        await processUserSession(session);

      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        
        // Sign out to clear invalid session
        await supabase.auth.signOut();
        
        setTimeout(() => router.push('/auth/login'), 3000);
      } finally {
        setLoading(false);
      }
    };

    const processUserSession = async (session: any) => {
      if (!session?.user) {
        throw new Error('No user found in session');
      }

      // Call your API to create/update profile
      const response = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          full_name: session.user.user_metadata?.full_name || 
                    session.user.user_metadata?.name || 
                    '',
          email: session.user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to setup profile');
      }

      const data = await response.json();
      
      // Get user role from API response or fetch it
      let userRole = data.role;
      
      // If role not in API response, fetch it from database
      if (!userRole) {
        const { data: roleData, error: roleError } = await supabase
          .rpc('get_user_role', { user_id: session.user.id });
        
        if (roleError) {
          console.error('Role fetch error:', roleError);
          userRole = 'teacher'; // Default fallback
        } else {
          userRole = roleData;
        }
      }

      // Save role to cookies
      Cookies.set('role', userRole, { expires: 7, path: '/' });
      
      // Redirect based on role
      if (userRole === 'admin' || userRole === 'super_admin') {
        router.push('/admin');
      } else if (userRole === 'teacher' || userRole === 'academy') {
        router.push('/dashboard');
      } else {
        setError('Access denied: Invalid user role');
        await supabase.auth.signOut();
        setTimeout(() => router.push('/auth/login'), 3000);
      }
    };

    handleGoogleCallback();
  }, [router, supabase, searchParams]);

  if (loading) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted">Completing sign-in… please wait</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center vh-100">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Authentication Failed</h4>
          <p>{error}</p>
          <hr />
          <p className="mb-0">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return null;
}

// Main component with Suspense boundary
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="d-flex flex-column justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted">Loading authentication...</p>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';
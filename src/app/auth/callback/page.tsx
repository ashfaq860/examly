'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get the hash from the URL (PKCE stores token in hash fragment)
        const hash = window.location.hash;
        
        if (hash) {
          // Parse the hash to get access token if present
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session manually
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error('Session error:', sessionError);
              throw sessionError;
            }
            
            if (session?.user) {
              await processUser(session.user);
              return;
            }
          }
        }

        // Fallback: Try to get the current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Failed to authenticate. Please try again.');
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }

        if (!session?.user) {
          console.error('No user found in session');
          setError('No user found. Redirecting to login...');
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }

        await processUser(session.user);

      } catch (err: any) {
        console.error('Callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        
        // Clear any invalid session
        await supabase.auth.signOut();
        
        setTimeout(() => router.push('/auth/login'), 3000);
      } finally {
        setLoading(false);
      }
    };

    const processUser = async (user: any) => {
      // Call your API to create/update profile
      const response = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          full_name: user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    '',
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to setup profile');
      }

      const data = await response.json();
      
      // Get user role
      let userRole = data.role;
      
      // If role not in API response, fetch it from database
      if (!userRole) {
        const { data: roleData, error: roleError } = await supabase
          .rpc('get_user_role', { user_id: user.id });
        
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

    handleCallback();
  }, [router, supabase]);

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
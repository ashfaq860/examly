// src/app/dashboard/generate-paper/hooks/useAuthGuard.ts
import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const useAuthGuard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          setAuthError('Please log in to access this page');
          setAuthChecked(true);
          return;
        }

        const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');

        if (roleError || (roleData !== 'teacher' && roleData !== 'academy')) {
          setAuthError('This page is only available to teachers and academies');
          setAuthChecked(true);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        setAuthError('Authentication error. Please try again.');
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, [supabase]);

  return { isAuthenticated, authChecked, authError };
};
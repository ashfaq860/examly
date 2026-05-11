// src/app/dashboard/generate-paper/hooks/useAuthGuard.ts
import { useState, useEffect } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export const useAuthGuard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          setAuthError('Please log in to access this page');
          setAuthChecked(true);
          return;
        }

        const { data: roleData, error: roleError } = await supabase.rpc(
          'get_user_role',
          { user_id: session.user.id }
        );

        if (roleError || roleData !== 'teacher') {
          setAuthError('This page is only available to teachers');
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
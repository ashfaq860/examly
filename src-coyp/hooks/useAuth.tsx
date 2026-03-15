// src/hooks/useAuth.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type Profile = {
  id: string;
  full_name?: string | null;
  role?: 'student' | 'teacher' | string | null;
  institution?: string | null;
  subjects?: string[] | null;
  created_at?: string;
};

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getUser();
      const sessionUser = data?.user ?? null;
      if (mounted) setUser(sessionUser);

      if (sessionUser) {
        // fetch profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();
        if (mounted) setProfile(prof ?? null);

        // if profile doesn't exist, create a default (you may show role-selection screen after)
        if (!prof) {
          await supabase.from('profiles').insert({
            id: sessionUser.id,
            full_name: sessionUser.user_metadata?.full_name ?? null,
            role: 'student'
          });
          // re-fetch
          const { data: p2 } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();
          if (mounted) setProfile(p2 ?? null);
        }
      }

      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single();
        if (prof) setProfile(prof);
        else {
          await supabase.from('profiles').upsert({ id: u.id, role: 'student' });
          const { data: prof2 } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', u.id)
            .single();
          setProfile(prof2 ?? null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}

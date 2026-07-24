'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// classes/subjects/chapters/topics/questions all require the `authenticated`
// role under RLS (no anon policy) — this subtree has no auth guard of its
// own today, so an unauthenticated visit silently renders empty
// lists/"not found" instead of a clean redirect. One shared guard here
// covers every page under /quiz regardless of which URL is hit directly.
export default function QuizLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        router.replace('/auth/login');
        return;
      }
      setChecked(true);
    });
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}

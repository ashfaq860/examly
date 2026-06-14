// src/lib/session.ts
'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentSession() {
  const supabase = await createSupabaseServerClient()

  // Instead of getSession (insecure), use getUser (verified by Supabase)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return user
}

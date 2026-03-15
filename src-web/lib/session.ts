// src/lib/session.ts
'use server'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// ✅ Always async now
export async function getCurrentSession() {
  const cookieStore = await cookies()  // <- await is required in Next.js 15
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Instead of getSession (insecure), use getUser (verified by Supabase)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error fetching user:', error)
    return null
  }

  return user
}

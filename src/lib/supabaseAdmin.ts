// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set!');
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // ✅ URL can stay public
  process.env.SUPABASE_SERVICE_ROLE_KEY!,      // ✅ must be service role key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

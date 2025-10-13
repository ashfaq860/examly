// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

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

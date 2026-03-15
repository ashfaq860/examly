// pages/api/internal/profile.js
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req, res) {
  // keep this route internal (not exposed to clients) — no auth checks here for brevity
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json(data);
}

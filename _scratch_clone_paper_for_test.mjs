import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_ID = '53dc121f-6d87-4d70-9d3a-e9f879354c67';

const { data: source, error: fetchErr } = await supabase
  .from('papers')
  .select('*')
  .eq('id', '8e0b5754-17af-4dae-a923-d21a447019c3')
  .maybeSingle();
if (fetchErr || !source) { console.error('fetch failed', fetchErr); process.exit(1); }

const { id, created_at, ...rest } = source;
const { data: created, error: insertErr } = await supabase
  .from('papers')
  .insert({ ...rest, created_by: ADMIN_ID, title: `${source.title} (print-test clone)` })
  .select()
  .single();
if (insertErr || !created) { console.error('insert failed', insertErr); process.exit(1); }

console.log('cloned paper id:', created.id);
writeFileSync(
  'C:/Users/HP/AppData/Local/Temp/claude/d--examly-examly/59a2ea25-8bb0-4038-8391-9b8468396320/scratchpad/pw-verify/test-paper-id.json',
  JSON.stringify({ id: created.id })
);

// Dummy Supabase env vars so importing a module that transitively touches
// src/lib/supabaseAdmin.ts (which throws at IMPORT time, not call time, if
// these are unset) doesn't fail every test file in that import chain —
// even ones that only exercise pure functions and never actually call
// supabaseAdmin. Never real credentials; only ever used to satisfy
// createClient's constructor, which makes no network call on its own.
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-dummy-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-dummy-project.supabase.co';

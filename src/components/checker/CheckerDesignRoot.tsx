// Shared server-side shell for every route segment that uses the "ledger"
// design system originally built for /dashboard/checker (fonts, --chk-*
// tokens, shared .chk-btn* classes) and its 'paper_checker' feature gate.
// Extracted out of dashboard/checker/layout.tsx so /dashboard/students can
// reuse the exact same look and the exact same server-side entitlement
// check without being nested under /dashboard/checker's URL or React tree
// — Students is its own top-level identity in the sidebar/routing, not a
// sub-page of Paper Checker, even though it shares this visual system and
// is gated by the same feature.
import type { ReactNode } from 'react';
import { Lexend, JetBrains_Mono } from 'next/font/google';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hasFeature } from '@/lib/entitlements';
import { UpgradeScreen } from '@/components/UpgradeModal';

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--chk-font-ui',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--chk-font-mono',
  display: 'swap',
});

async function isLocked(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false; // unauthenticated — let the client guard handle it

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && ['admin', 'super_admin'].includes(profile.role)) return false;

  const allowed = await hasFeature(supabase, 'paper_checker');
  return !allowed;
}

export async function CheckerDesignRoot({ children }: { children: ReactNode }) {
  const locked = await isLocked();

  return (
    <div className={`${lexend.variable} ${jetbrainsMono.variable} chk-root`}>
      {locked ? <UpgradeScreen reason="subscription_required" /> : children}
      {/* Plain style tag (not styled-jsx) — this file has no dynamic values
          to interpolate, and styled-jsx's runtime pulls in 'client-only',
          which errors from a Server Component. A layout has no need to be a
          Client Component just to declare some CSS custom properties.

          The shared .chk-btn* classes below are declared HERE (globally),
          not per-page via styled-jsx, because styled-jsx's scoping only
          reaches elements written directly in the component that declares
          it — it does not cascade into separately-rendered child
          components. Every checker/students page/component uses these same
          classes, so they have to live somewhere genuinely global to
          actually apply.

          Note: don't put a literal opening-angle-bracket + "style" sequence
          inside this style tag's own rendered CSS text, including inside a
          CSS comment there — React escapes that sequence differently
          between server and client rendering (a defensive measure against
          premature tag termination), which produces a hydration mismatch.
          Comments like this one, outside the template literal, are
          compiled away and never reach the DOM, so they're always safe
          regardless of content. */}
      <style>{`
        .chk-root {
          --chk-navy: #101935;
          --chk-navy-soft: #1a2647;
          --chk-accent: #2f4fe0;
          --chk-accent-soft: #eef1ff;
          --chk-bg: #f5f6fb;
          --chk-surface: #ffffff;
          --chk-border: #e6e8f1;
          --chk-text: #15192b;
          --chk-muted: #686f8c;
          --chk-green: #1f9d55;
          --chk-green-soft: #e7f8ee;
          --chk-amber: #b7791f;
          --chk-amber-soft: #fef3e0;
          --chk-danger: #c8473a;
          --chk-danger-soft: #fdeeec;
          --chk-radius-lg: 16px;
          --chk-radius-md: 11px;
          --chk-radius-sm: 8px;
          --chk-shadow-sm: 0 1px 2px rgba(16, 25, 53, 0.06);
          --chk-shadow-md: 0 8px 24px rgba(16, 25, 53, 0.08);
          font-family: var(--chk-font-ui), 'Lexend', 'Inter', system-ui, sans-serif;
          color: var(--chk-text);
        }
        .chk-mono {
          font-family: var(--chk-font-mono), 'JetBrains Mono', ui-monospace, monospace;
        }
        .chk-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 0.55rem 1.1rem; border-radius: var(--chk-radius-md); font-weight: 700; font-size: 0.85rem;
          text-decoration: none; border: none; cursor: pointer; white-space: nowrap;
          font-family: inherit;
        }
        .chk-btn-primary { background: linear-gradient(135deg, var(--chk-navy) 0%, var(--chk-accent) 100%); color: #fff; }
        .chk-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .chk-btn-ghost { background: var(--chk-bg); color: var(--chk-navy); }
        .chk-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

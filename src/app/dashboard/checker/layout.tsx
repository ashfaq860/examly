// Segment layout for /dashboard/checker/* — loads the real Lexend +
// JetBrains Mono fonts (the rest of the "ledger" admin UI only ever
// references these as bare font-family strings that silently fall back to
// Inter/system-ui, since nothing actually loads them; scoping the real
// fonts to just this route segment via next/font costs nothing elsewhere)
// and declares the ledger design tokens once as CSS custom properties,
// mirroring AdminLayout.tsx's --adm-* values so this feature matches that
// look exactly, without touching AcademyLayout's own --brand-* theme used
// by the rest of the teacher dashboard.
//
// Also the server-side enforcement point for the 'paper_checker' feature
// gate: hiding the sidebar link (AcademyLayout) is a UX nicety only, so
// every page under this segment is additionally checked here — an
// unentitled user hitting a /dashboard/checker/* URL directly gets the
// upgrade screen instead of the real page, never just a client-side
// redirect that a slower connection could momentarily skip past. Signed-
// out visitors fall through unlocked; the existing per-page
// useCheckerAuthGuard client hook is what shows their "please log in"
// message, unchanged.
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

  const allowed = await hasFeature(supabaseAdmin, user.id, 'paper_checker');
  return !allowed;
}

export default async function CheckerLayout({ children }: { children: ReactNode }) {
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
          components. Every checker page/component uses these same classes,
          so they have to live somewhere genuinely global to actually apply.

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

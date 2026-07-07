// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pingdom|uptimerobot/i;

function getDeviceType(userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get('host');
  const { pathname, search } = request.nextUrl;

  // 1. Force Canonical Subdomain Redirect (apex to www)
  if (host === 'examly.pk') {
    return NextResponse.redirect(`https://www.examly.pk${pathname}${search}`, 301);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Read session from cookie — the JWT is cryptographically signed by
  // Supabase, so `session.user.id` can't be forged by the client. The
  // `role` cookie, by contrast, is a plain non-httpOnly string the client
  // can freely rewrite — it must never be used for authorization.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  // Protect /admin — only admin and super_admin. Role is looked up from
  // the database using the verified user id, never trusted from a cookie.
  if (pathname.startsWith('/admin') && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // /admin needs a role check; /dashboard just needs the disabled check
  // below. Both reuse a single profile lookup when there's a logged-in user.
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_disabled')
      .eq('id', user.id)
      .maybeSingle();

    // A disabled account loses access immediately, even mid-session — this
    // check runs on every request to these routes rather than only at
    // login, so a stale-but-unexpired token can't be used to keep going.
    if (profile?.is_disabled) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('error', 'account_disabled');
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname.startsWith('/admin') && (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin'))) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  // Fire-and-forget site visit logging for the admin analytics dashboard.
  // Skipped for /admin (own traffic) and /api (not a page view). Bots are
  // filtered by a simple UA heuristic — not perfect, but keeps obvious
  // crawler noise out of visit counts.
  const userAgent = request.headers.get('user-agent') || '';
  if (
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !BOT_UA_PATTERN.test(userAgent)
  ) {
    let visitorId = request.cookies.get('ex_vid')?.value;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      supabaseResponse.cookies.set('ex_vid', visitorId, {
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }

    event.waitUntil(
      supabaseAdmin
        .from('site_visits')
        .insert({
          visitor_id: visitorId,
          user_id: user?.id ?? null,
          path: pathname,
          referrer: request.headers.get('referer') || null,
          user_agent: userAgent || null,
          device_type: getDeviceType(userAgent),
        })
        .then(
          ({ error }) => { if (error) console.error('site_visits insert error:', error.message); },
          (error) => console.error('site_visits insert failed:', error)
        )
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|auth/session|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
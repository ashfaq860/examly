import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['teacher', 'admin', 'super_admin', 'academy'] as const;
type UserRole = (typeof ALLOWED_ROLES)[number];

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  // ✅ Build the success redirect response FIRST.
  // We write session cookies onto THIS response so the browser receives them.
  // The redirect destination will be updated below once we know the role.
  const response = NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);

  // ✅ Read cookies from the INCOMING REQUEST (where the verifier lives).
  // Write cookies onto the OUTGOING RESPONSE (so browser gets the session).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read from the request — this is where the PKCE verifier cookie is
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write onto the response — this is what the browser will receive
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options ?? {});
          });
        },
      },
    }
  );

  const {
    data: { session },
    error: exchangeError,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !session) {
    console.error('[callback] Session exchange error:', exchangeError?.message);
    return response; // already points to /auth/login?error=auth_failed
  }

  try {
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[callback] Profile fetch error:', fetchError);
      return response;
    }

    let role: string = 'teacher';

    if (!existingProfile) {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name:
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split('@')[0] ||
            'User',
          role: 'teacher',
          login_method: 'google',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[callback] Profile insert error:', insertError);
        return NextResponse.redirect(
          `${origin}/auth/login?error=profile_creation_failed`
        );
      }
    } else {
      role = existingProfile.role ?? 'teacher';
    }

    if (!ALLOWED_ROLES.includes(role as UserRole)) {
      console.error('[callback] Unauthorized role:', role);
      return NextResponse.redirect(
        `${origin}/auth/login?error=unauthorized_role`
      );
    }

    const redirectPath =
      role === 'admin' || role === 'super_admin' ? '/admin' : '/dashboard';

    // ✅ Now redirect to the correct destination.
    // Reuse the same response object so session cookies set by setAll() above
    // are preserved — do NOT create a new NextResponse here.
    response.headers.set('Location', `${origin}${redirectPath}`);

    // Role cookie — JS-readable
    response.cookies.set('role', role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;

  } catch (error) {
    console.error('[callback] Unexpected error:', error);
    return response;
  }
}
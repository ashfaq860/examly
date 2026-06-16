// src/app/api/auth/temp-session/route.ts
// Reads the short-lived sb-temp-session cookie set by /auth/callback
// and returns the tokens to the client-side /auth/session page.
// The cookie is httpOnly so JS can't read it directly.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const tempCookie = cookieStore.get('sb-temp-session')?.value;

  if (!tempCookie) {
    return NextResponse.json({ error: 'No temp session' }, { status: 404 });
  }

  try {
    const session = JSON.parse(tempCookie);

    if (!session.access_token || !session.refresh_token) {
      return NextResponse.json({ error: 'Invalid temp session' }, { status: 400 });
    }

    // Delete the temp cookie immediately — single use
    const response = NextResponse.json(session);
    response.cookies.delete('sb-temp-session');
    return response;

  } catch {
    return NextResponse.json({ error: 'Malformed temp session' }, { status: 400 });
  }
}
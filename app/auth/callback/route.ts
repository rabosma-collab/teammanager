import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

const FALLBACK_URL = 'https://hyjewtsmytpfojdvdsta.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5amV3dHNteXRwZm9qZHZkc3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzU5ODMsImV4cCI6MjA4NTk1MTk4M30.4CXjyPsTn6n--v_HwnvuCzXk7eP6X6yPlT8R4ll6V5s';

function resolveUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  return FALLBACK_URL;
}

function resolveKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof v === 'string' && v.length > 0) return v;
  return FALLBACK_KEY;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const inviteToken = searchParams.get('inviteToken');

  const redirectUrl = inviteToken
    ? new URL(`/join/${inviteToken}`, request.url)
    : new URL('/', request.url);

  if (code) {
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      resolveUrl(),
      resolveKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookies) {
            for (const { name, value, options } of cookies) {
              request.cookies.set({ name, value });
              response.cookies.set({ name, value, ...options });
            }
          },
        },
      },
    );

    await supabase.auth.exchangeCodeForSession(code);
    return response;
  }

  return NextResponse.redirect(redirectUrl);
}

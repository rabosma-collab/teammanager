import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

const FALLBACK_URL = 'https://hyjewtsmytpfojdvdsta.supabase.co';
const FALLBACK_KEY = 'sb_publishable_7RPcZtEDjt9YVrP_Ohn1lA_B2FjFKzQ';

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

  const redirectUrl = new URL('/', request.url);

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

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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

const PUBLIC_ROUTES = ['/login', '/register', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

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

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // Not logged in + protected route → redirect to login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Logged in + auth page → redirect to home
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

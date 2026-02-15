import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

const PUBLIC_ROUTES = ['/login', '/register', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hyjewtsmytpfojdvdsta.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_7RPcZtEDjt9YVrP_Ohn1lA_B2FjFKzQ',
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

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user) {
    // New sprint routes → /login (with returnUrl)
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/standard')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }

    // Legacy routes → /sign-up-login-screen
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Legacy protected routes
    '/teacher-dashboard/:path*',
    '/student-home/:path*',
    '/student-diagnostic/:path*',
    '/student-teach/:path*',
    '/student-reassess/:path*',
    '/student-practice/:path*',
    // Sprint 1 protected routes
    '/dashboard/:path*',
    '/standard/:path*',
  ],
};

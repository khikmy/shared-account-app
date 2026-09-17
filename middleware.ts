import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, isValidSessionToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const ok = await isValidSessionToken(token);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/health).*)'],
};

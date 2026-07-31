import { NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';

const ADMIN_API_PREFIX = '/api/admin';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const isAdminApi = pathname.startsWith(ADMIN_API_PREFIX) && !pathname.endsWith('/api/admin/auth');

  if (isAdminPage || isAdminApi) {
    const token = getTokenFromRequest(request);
    if (!token) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

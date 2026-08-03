import { NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only protect API routes — pages handled by layout
  if (pathname.startsWith('/api/admin') && !pathname.endsWith('/api/admin/auth')) {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};

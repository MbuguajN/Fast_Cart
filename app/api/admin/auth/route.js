import { NextResponse } from 'next/server';
import { signToken, adminCookieOptions, ADMIN_COOKIE } from '@/lib/auth';
import { timingSafeEquals } from '@/lib/crypto-tokens';
import { rateLimitRequest } from '@/lib/rate-limit';

const ADMIN_ROLES = ['administrator', 'shop_manager'];

async function verifyWordPressCredentials(username, password) {
  const wpUrl = process.env.WOOCOMMERCE_STORE_URL;
  if (!wpUrl) return null;

  try {
    // Use WP REST API with Application Passwords / Basic Auth
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const res = await fetch(`${wpUrl}/wp-json/wp/v2/users/me?context=edit`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!res.ok) return null;

    const user = await res.json();

    // Check if user has an admin-level role
    const roles = user.roles || [];
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.slug,
      displayName: user.name || user.first_name || user.slug,
      avatar: user.avatar_urls?.['96'] || user.avatar_urls?.['48'] || null,
      roles,
    };
  } catch {
    return null;
  }
}

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 5, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Strategy 1: Try WordPress REST API authentication
    const wpUser = await verifyWordPressCredentials(email, password);
    if (wpUser) {
      const token = await signToken({
        email: wpUser.email,
        name: wpUser.displayName,
        avatar: wpUser.avatar,
        role: 'admin',
        wpUserId: wpUser.id,
      });

      const response = NextResponse.json({ success: true, name: wpUser.displayName });
      response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
      return response;
    }

    // Strategy 2: .env credentials.
    //
    // Development only, and now actually enforced — this was previously
    // labelled "dev only" in a comment with no NODE_ENV check, so setting
    // ADMIN_EMAIL/ADMIN_PASSWORD in production created a live login that
    // bypassed the WordPress role check entirely.
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const fallbackAllowed = process.env.NODE_ENV !== 'production';

    if (
      fallbackAllowed &&
      adminEmail &&
      adminPassword &&
      timingSafeEquals(email, adminEmail) &&
      timingSafeEquals(password, adminPassword)
    ) {
      const token = await signToken({ email, name: 'Admin', role: 'admin' });

      const response = NextResponse.json({ success: true, name: 'Admin' });
      response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
      return response;
    }

    return NextResponse.json({ error: 'Invalid credentials or insufficient permissions' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(), maxAge: 0 });
  return response;
}

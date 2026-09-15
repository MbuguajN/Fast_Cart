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

    if (!res.ok) {
      // Never log credentials. The status/body alone is enough to tell apart
      // "wrong password" (401) from "WP unreachable / REST disabled" (404/5xx)
      // from a reverse proxy or security plugin blocking the request (403).
      const body = await res.text().catch(() => '');
      console.error(`Admin WP auth: users/me returned ${res.status} for ${wpUrl}`, body.slice(0, 300));
      return null;
    }

    const user = await res.json();

    // Check if user has an admin-level role
    const roles = user.roles || [];
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) {
      console.error(`Admin WP auth: user ${user.slug || user.id} lacks admin role. Has: [${roles.join(', ')}]`);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.slug,
      displayName: user.name || user.first_name || user.slug,
      avatar: user.avatar_urls?.['96'] || user.avatar_urls?.['48'] || null,
      roles,
    };
  } catch (err) {
    console.error(`Admin WP auth: request to ${wpUrl} failed:`, err.message);
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
    // Allows authoritative login using ADMIN_EMAIL and ADMIN_PASSWORD configured in
    // environment variables. Matches either the full email or username prefix (e.g. "admin").
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      const inputIdentifier = String(email).trim().toLowerCase();
      const targetEmail = String(adminEmail).trim().toLowerCase();
      const targetUsername = targetEmail.split('@')[0];

      const identifierMatches =
        timingSafeEquals(inputIdentifier, targetEmail) ||
        timingSafeEquals(inputIdentifier, targetUsername);
      const passwordMatches = timingSafeEquals(password, adminPassword);

      if (identifierMatches && passwordMatches) {
        const token = await signToken({ email: adminEmail, name: 'Admin', role: 'admin' });

        const response = NextResponse.json({ success: true, name: 'Admin' });
        response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions());
        return response;
      }

      console.error(`Admin .env auth: identifier match=${identifierMatches} password match=${passwordMatches}`);
    } else {
      console.error('Admin .env auth: ADMIN_EMAIL and/or ADMIN_PASSWORD not set in this environment.');
    }

    return NextResponse.json({ error: 'Invalid credentials or insufficient permissions' }, { status: 401 });
  } catch (err) {
    console.error('Admin auth error:', err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(), maxAge: 0 });
  return response;
}

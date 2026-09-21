import { NextResponse } from 'next/server';
import { signToken, adminCookieOptions, ADMIN_COOKIE } from '@/lib/auth';
import { timingSafeEquals } from '@/lib/crypto-tokens';
import { rateLimitRequest } from '@/lib/rate-limit';
import { getAdminStaffByEmail } from '@/lib/admin-store.js';

const ADMIN_ROLES = ['administrator', 'shop_manager'];

/**
 * /admin access is an explicit allowlist, not "anyone with the right
 * credentials". Successfully authenticating (WordPress or the .env
 * fallback) only proves who someone is — whether they're allowed in at all,
 * and what they're scoped to, is decided by the admin_staff roster. The
 * .env ADMIN_EMAIL is the one exception: it's the bootstrap/owner account,
 * so it always resolves to 'owner' even with no roster row — otherwise
 * there'd be no way to create the first roster entry.
 */
async function resolveStaffRole(email) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const normalized = String(email || '').trim().toLowerCase();
  if (adminEmail && normalized === adminEmail) {
    return { role: 'owner', name: 'Owner' };
  }

  const staff = await getAdminStaffByEmail(normalized);
  if (!staff || !staff.isActive) return null;
  return { role: staff.role, name: staff.name || null };
}

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
      const staffRole = await resolveStaffRole(wpUser.email);
      if (!staffRole) {
        console.error(`Admin auth: ${wpUser.email} authenticated with WordPress but is not on the staff roster.`);
        return NextResponse.json(
          { error: 'Your account is not provisioned for admin access. Contact the owner.' },
          { status: 403 }
        );
      }

      const token = await signToken({
        email: wpUser.email,
        name: staffRole.name || wpUser.displayName,
        avatar: wpUser.avatar,
        role: staffRole.role,
        wpUserId: wpUser.id,
      });

      const response = NextResponse.json({ success: true, name: staffRole.name || wpUser.displayName, role: staffRole.role });
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
        // Always the bootstrap owner — the whole point of this path is to
        // never be lockable-out by the staff roster.
        const token = await signToken({ email: adminEmail, name: 'Owner', role: 'owner' });

        const response = NextResponse.json({ success: true, name: 'Owner', role: 'owner' });
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

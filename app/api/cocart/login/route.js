import { NextResponse } from 'next/server';
import { rateLimitRequest, rateLimitIdentity } from '@/lib/rate-limit';
import { createCustomerSession, setSessionCookie, normalizePhone } from '@/lib/session';
import { cocartLogin } from '@/lib/cocart';
import { findCustomerByPhone } from '@/lib/customer';

/**
 * POST /api/cocart/login
 *
 * Proxied CoCart login — accepts phone + password, authenticates via CoCart,
 * and returns the customer profile merged with WooCommerce data.
 *
 * This keeps WC credentials server-side (BFF pattern).
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 15, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { phone, password } = await request.json();

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 1) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Throttle per account as well as per IP, so rotating IPs cannot brute
    // force one customer's password.
    const identityLimit = await rateLimitIdentity(normalizePhone(phone), {
      scope: 'cocart-login',
      maxRequests: 8,
      windowMs: 900000,
    });
    if (!identityLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts for this number. Please try again later.' },
        { status: 429 }
      );
    }

    // Attempt CoCart login with phone + password
    const loginResult = await cocartLogin(phone, password);

    if (!loginResult.ok) {
      // If CoCart login fails, return the error
      return NextResponse.json({
        error: loginResult.error || 'Invalid phone number or password',
        code: loginResult.code,
      }, { status: 401 });
    }

    // Login succeeded — enrich with WooCommerce customer data
    const cocartUser = loginResult.user;

    // Also fetch full WC customer for meta_data (landmark, zone, etc.)
    let customer = null;
    try {
      customer = await findCustomerByPhone(phone);
    } catch {
      // Non-fatal — CoCart login was still successful
    }

    const session = {
      phone: phone.replace(/\s/g, ''),
      name: [cocartUser.firstName, cocartUser.lastName].filter(Boolean).join(' ') || cocartUser.displayName || '',
      email: cocartUser.email || customer?.email || '',
      customerId: parseInt(cocartUser.id, 10) || customer?.id || null,
      landmark: customer?.meta_data?.find(m => m.key === 'landmark_hint')?.value || customer?.shipping?.address_1 || '',
      zone: customer?.meta_data?.find(m => m.key === 'delivery_zone')?.value || '',
      needsDetails: !cocartUser.firstName && !customer?.first_name,
      verified: true,
      authMethod: 'cocart_password',
    };

    const token = await createCustomerSession({
      customerId: session.customerId,
      phone,
      authMethod: 'password',
    });

    return setSessionCookie(NextResponse.json({ success: true, session }), token);
  } catch (error) {
    // Avoid logging credentials
    console.error('CoCart login proxy error:', error.message);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findOrCreateCustomer } from '@/lib/customer';
import { requireCustomerOr401 } from '@/lib/api-guard';
import { createCustomerSession, setSessionCookie } from '@/lib/session';

/**
 * POST /api/auth/register — complete a profile for an already-verified number.
 *
 * Requires a session, so the phone number has been proven by OTP before any
 * WooCommerce customer is created. The phone is taken from the session, not
 * the body: registering against someone else's number is not expressible.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 5, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { session, denied } = await requireCustomerOr401(request);
  if (denied) return denied;

  try {
    const { name, landmark, email, zone } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // The session stores the last 9 digits; WooCommerce records use the
    // national 0-prefixed form.
    const formattedPhone = `0${session.phone}`;
    if (!/^0\d{9}$/.test(formattedPhone)) {
      return NextResponse.json({ error: 'Session phone number is invalid' }, { status: 400 });
    }

    const customer = await findOrCreateCustomer({
      phone: formattedPhone,
      name,
      email,
      landmark,
      zone,
    });

    // Re-issue the session now that a WooCommerce customer ID exists, so
    // subsequent account calls resolve by ID rather than by phone lookup.
    const token = await createCustomerSession({
      customerId: customer.id,
      phone: session.phone,
      authMethod: session.authMethod,
    });

    return setSessionCookie(
      NextResponse.json({ customerId: customer.id, success: true }),
      token
    );
  } catch (error) {
    console.error('Register error:', error.message);
    return NextResponse.json({ error: 'Could not complete registration' }, { status: 500 });
  }
}

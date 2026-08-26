import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
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
  const rl = rateLimitRequest(request, { maxRequests: 15, windowMs: 300000 });
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

    return NextResponse.json({ success: true, session });
  } catch (error) {
    // Avoid logging credentials
    console.error('CoCart login proxy error:', error.message);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}

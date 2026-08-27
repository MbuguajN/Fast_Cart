import { NextResponse } from 'next/server';
import { getCustomerSession, clearSessionCookie } from '@/lib/session';
import { findCustomerByPhone } from '@/lib/customer';

/**
 * GET /api/auth/session — who is signed in, according to the server.
 *
 * The client calls this on load instead of trusting `localStorage`. The
 * response is derived entirely from the signed cookie, so a tampered local
 * session simply resolves to `authenticated: false`.
 */
export async function GET(request) {
  const session = await getCustomerSession(request);

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Hydrate the display profile from WooCommerce rather than from anything the
  // client stored. Failure here is non-fatal: the session is still valid.
  let customer = null;
  try {
    customer = await findCustomerByPhone(session.phone);
  } catch (error) {
    console.error('Session profile hydration failed:', error.message);
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      phone: session.phone,
      customerId: customer?.id ?? session.customerId ?? null,
      name: [customer?.first_name, customer?.last_name].filter(Boolean).join(' '),
      email: customer?.email || '',
      landmark:
        customer?.meta_data?.find((m) => m.key === 'landmark_hint')?.value ||
        customer?.shipping?.address_1 ||
        '',
      zone: customer?.meta_data?.find((m) => m.key === 'delivery_zone')?.value || '',
      needsDetails: !customer?.first_name,
      verified: true,
      authMethod: session.authMethod,
    },
  });
}

/** DELETE /api/auth/session — sign out. */
export async function DELETE() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}

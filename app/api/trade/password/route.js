import { NextResponse } from 'next/server';
import { requireTradeOr401 } from '@/lib/api-guard';
import { setTradeUserPasswordHash } from '@/lib/trade/trade-store.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/trade/trade-password.js';
import { rateLimitRequest } from '@/lib/rate-limit';

/**
 * POST /api/trade/password — change your own trade portal password.
 *
 * Requires the current password even though the caller already holds a valid
 * session: without that, a borrowed or stolen session could lock the real
 * account holder out permanently.
 *
 * Body: { currentPassword, newPassword }
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 6, windowMs: 900000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
  }

  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    const { currentPassword, newPassword } = await request.json();

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }

    const currentOk = await verifyPassword(currentPassword, auth.user.passwordHash);
    if (!currentOk) {
      return NextResponse.json({ error: 'Your current password is incorrect' }, { status: 401 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Choose a password you have not used before' }, { status: 400 });
    }

    const problem = validatePasswordStrength(newPassword);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await setTradeUserPasswordHash(auth.user.id, passwordHash, { mustChange: false });

    return NextResponse.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Trade password change failed:', error.message);
    return NextResponse.json({ error: 'Could not update your password' }, { status: 500 });
  }
}

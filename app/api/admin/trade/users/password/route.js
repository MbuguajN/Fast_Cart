import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import {
  findTradeUserByIdentifier,
  setTradeUserPasswordHash,
  toPublicTradeUser,
} from '@/lib/trade/trade-store.js';
import {
  hashPassword,
  generateTemporaryPassword,
  validatePasswordStrength,
} from '@/lib/trade/trade-password.js';

/**
 * POST /api/admin/trade/users/password
 *
 * Issues or resets portal credentials for a trade seat.
 *
 * Body: { identifier, password? }
 *   - `password` omitted → a temporary password is generated and returned once,
 *     flagged `mustChangePassword` so the seat is prompted to replace it.
 *   - `password` supplied → set verbatim, subject to the strength policy.
 *
 * The generated password is the only time plaintext leaves this endpoint; it
 * is never stored and cannot be read back.
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { identifier, password } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'A user identifier is required' }, { status: 400 });
    }

    const user = findTradeUserByIdentifier(identifier);
    if (!user) {
      return NextResponse.json({ error: 'Trade user not found' }, { status: 404 });
    }

    const isGenerated = !password;
    const plaintext = isGenerated ? generateTemporaryPassword() : password;

    const problem = validatePasswordStrength(plaintext);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const passwordHash = await hashPassword(plaintext);
    const updated = await setTradeUserPasswordHash(user.id, passwordHash, { mustChange: isGenerated });

    return NextResponse.json({
      success: true,
      user: toPublicTradeUser(updated),
      // Returned once, for the admin to pass to the account holder.
      ...(isGenerated ? { temporaryPassword: plaintext } : {}),
    });
  } catch (error) {
    console.error('Trade password provisioning failed:', error.message);
    return NextResponse.json({ error: 'Could not set the password' }, { status: 500 });
  }
}

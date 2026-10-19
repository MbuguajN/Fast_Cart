import { NextResponse } from 'next/server';
import { verifyToken, AUDIENCE } from '@/lib/crypto-tokens.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token missing' }, { status: 400 });
  }

  const payload = await verifyToken(AUDIENCE.TRADE, token);
  if (!payload || payload.purpose !== 'pwd_reset' || !payload.userId) {
    return NextResponse.json({ valid: false, error: 'Token invalid or expired' });
  }

  return NextResponse.json({
    valid: true,
    email: payload.email || null,
  });
}


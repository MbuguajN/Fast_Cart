import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, email: user.email, name: user.name || 'Admin', avatar: user.avatar || null });
}

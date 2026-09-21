import { NextResponse } from 'next/server';
import { adminGuard, requireAdminOr401 } from '@/lib/api-guard';
import { getAllAdminStaff, createAdminStaff } from '@/lib/admin-store.js';

/**
 * Staff roster management. Owner-only — enforced centrally by
 * lib/api-guard.js's requiredScopeForPath, not here.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const staff = await getAllAdminStaff();
    return NextResponse.json({ success: true, staff });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load staff roster' }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, denied } = await requireAdminOr401(request);
  if (denied) return denied;

  try {
    const { email, name, role } = await request.json();
    const staff = await createAdminStaff({ email, name, role, createdBy: user.email });
    return NextResponse.json({ success: true, staff, message: `${staff.email} added as ${staff.role}` });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to add staff member' }, { status: 400 });
  }
}

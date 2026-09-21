import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { updateAdminStaff, deleteAdminStaff } from '@/lib/admin-store.js';

export async function PUT(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const { name, role, isActive } = await request.json();
    const staff = await updateAdminStaff(id, { name, role, isActive });
    return NextResponse.json({ success: true, staff, message: `${staff.email} updated` });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update staff member' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    await deleteAdminStaff(id);
    return NextResponse.json({ success: true, message: 'Staff member removed' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to remove staff member' }, { status: 400 });
  }
}

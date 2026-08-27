import { NextResponse } from 'next/server';
import { getTradeAccountById, upsertTradeAccount, updateTradeAccountStatus } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const account = getTradeAccountById(id);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, account });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const account = getTradeAccountById(id);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const updated = {
      ...account,
      ...body,
      id,
    };

    if (body.status && body.status !== account.status) {
      await updateTradeAccountStatus(id, body.status, body.statusNotes || '', 'Admin Reviewer');
    }

    const saved = await upsertTradeAccount(updated);
    return NextResponse.json({ success: true, account: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


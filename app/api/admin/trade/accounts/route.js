import { NextResponse } from 'next/server';
import { getTradeAccounts, buildTradeAccount, upsertTradeAccount, addTradeUser } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const accounts = getTradeAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch trade accounts' }, { status: 500 });
  }
}

/**
 * Manual account creation from the admin backend — the counterpart to the
 * public /api/trade/apply flow. An admin-created account is trusted (KYC
 * already happened offline), so it defaults to 'active' rather than
 * 'pending', and terms are not attributed to a click that never happened.
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const data = await request.json();

    if (!data.tradingName) {
      return NextResponse.json({ error: 'tradingName is required' }, { status: 400 });
    }

    let account;
    try {
      account = buildTradeAccount({ ...data, skipTerms: true }, { status: data.status || 'active' });
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const saved = await upsertTradeAccount(account);

    let user = null;
    if (data.contactName && data.email && data.phone) {
      user = {
        id: `usr_${Date.now()}`,
        accountId: saved.id,
        name: data.contactName,
        role: data.role || 'Business Owner',
        seatType: 'owner',
        email: String(data.email).toLowerCase().trim(),
        phone: String(data.phone).trim(),
      };
      await addTradeUser(user);
    }

    return NextResponse.json({ success: true, account: saved, user });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create trade account' }, { status: 500 });
  }
}


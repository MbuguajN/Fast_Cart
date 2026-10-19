import { NextResponse } from 'next/server';
import { getTradeAccountById, upsertTradeAccount, updateTradeAccountStatus, readTradeStore, setTradeUserPasswordHash } from '@/lib/trade/trade-store.js';
import { generateTemporaryPassword, hashPassword, hasPassword } from '@/lib/trade/trade-password.js';
import { sendTradeAccountApprovedEmail } from '@/lib/trade/trade-email.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const account = await getTradeAccountById(id);
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
    const account = await getTradeAccountById(id);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const updated = {
      ...account,
      ...body,
      id,
    };

    const isNewlyApproved = body.status === 'active' && account.status !== 'active';

    if (body.status && body.status !== account.status) {
      await updateTradeAccountStatus(id, body.status, body.statusNotes || '', 'Admin Reviewer');
    }

    const saved = await upsertTradeAccount(updated);

    if (isNewlyApproved) {
      try {
        let user = null;
        try {
          const { query } = await import('@/lib/trade/trade-pg.js');
          const userRes = await query('SELECT * FROM trade_users WHERE account_id = $1 LIMIT 1', [id]);
          if (userRes.rows.length > 0) {
            const r = userRes.rows[0];
            user = {
              id: r.id,
              accountId: r.account_id,
              name: r.name,
              email: r.email,
              phone: r.phone,
              passwordHash: r.password_hash,
            };
          }
        } catch (dbErr) {
          console.warn('[trade-approval] Direct PG user lookup skipped:', dbErr.message);
        }

        if (!user) {
          const store = readTradeStore();
          user = store.users?.find((u) => u.accountId === id);
        }

        let tempPassword = null;

        if (user && !hasPassword(user)) {
          tempPassword = generateTemporaryPassword();
          const hash = await hashPassword(tempPassword);
          await setTradeUserPasswordHash(user.id, hash, { mustChange: true });
        }

        const recipientEmail = user?.email || account.contactEmail || account.billingAddress?.email;
        if (recipientEmail) {
          await sendTradeAccountApprovedEmail({
            to: recipientEmail,
            account: saved,
            tempPassword,
            loginEmail: user?.email || recipientEmail,
          });
        }
      } catch (emailErr) {
        console.error('Account approval email delivery failed:', emailErr.message);
      }
    }

    return NextResponse.json({ success: true, account: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


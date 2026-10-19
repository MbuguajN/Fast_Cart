import { NextResponse } from 'next/server';
import {
  buildTradeAccount,
  upsertTradeAccount,
  addTradeUser,
  findTradeUserByIdentifier,
  getTradeAccountById,
} from '@/lib/trade/trade-store.js';
import { query } from '@/lib/trade/trade-pg.js';
import { sendTradeApplicationEmails } from '@/lib/trade/trade-email.js';
import { cleanApplication } from '@/lib/trade/trade-application.js';
import { rateLimitRequest } from '@/lib/rate-limit';

export async function POST(request) {
  // Public and each hit sends emails and creates a pending account.
  const rl = await rateLimitRequest(request, { maxRequests: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many applications. Please try again later.' }, { status: 429 });
  }

  try {
    let data;
    try {
      data = cleanApplication(await request.json());
    } catch (validationError) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }

    const email = (data.email || '').toLowerCase().trim();

    // Prevent duplicate accounts: check trade_users in Postgres / store
    const existingUser = await findTradeUserByIdentifier(email);
    if (existingUser) {
      const existingAccount = await getTradeAccountById(existingUser.accountId);
      if (existingAccount?.status === 'active') {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please log in to your business account, or reset your password if you need access.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'An application with this email address is already under review. Our compliance team will contact you shortly.' },
        { status: 400 }
      );
    }

    // Check trade_accounts table as well
    const existingAccountCheck = await query(
      'SELECT id, status FROM trade_accounts WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    ).catch(() => ({ rows: [] }));
    if (existingAccountCheck.rows.length > 0) {
      const acc = existingAccountCheck.rows[0];
      if (acc.status === 'active') {
        return NextResponse.json(
          { error: 'An account with this email address already exists. Please log in to your business account.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'An application with this email address has already been submitted and is currently being reviewed.' },
        { status: 400 }
      );
    }

    let newAccount;
    try {
      newAccount = buildTradeAccount(data, { status: 'pending' });
      if (data.licenceDocumentUrl) {
        newAccount.licenceDocumentUrl = data.licenceDocumentUrl;
      }
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const userId = `usr_${Date.now()}`;

    await upsertTradeAccount(newAccount);

    // Initial account seat
    await addTradeUser({
      id: userId,
      accountId: newAccount.id,
      name: data.contactName,
      role: data.role || 'Business Owner',
      seatType: 'owner',
      email,
      phone: data.phone.trim(),
    });

    // Send customer acknowledgement & admin review alerts
    try {
      await sendTradeApplicationEmails({
        application: {
          ...data,
          id: newAccount.id,
          licenceDocumentUrl: data.licenceDocumentUrl,
        },
      });
    } catch (emailErr) {
      console.error('[trade-apply] Notification email error:', emailErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Your business wholesale account application has been received and verified. Our compliance team will verify your credentials within 2 business hours.',
      account: newAccount,
    });
  } catch (error) {
    console.error('[trade-apply] Application submission error:', error.message);
    const isDuplicate = error.message?.includes('already exists') || error.code === '23505' || error.message?.includes('trade_users_email_key');
    const status = isDuplicate ? 400 : 500;
    const message = isDuplicate
      ? 'An account with this email address already exists. Please log in to your business account.'
      : (error.message || 'Application submission failed');
    return NextResponse.json({ error: message }, { status });
  }
}


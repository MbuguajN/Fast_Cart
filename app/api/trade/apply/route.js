import { NextResponse } from 'next/server';
import { buildTradeAccount, upsertTradeAccount, addTradeUser } from '@/lib/trade/trade-store.js';
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

    // No password is set here. Portal access is issued by an admin once the
    // account passes vetting (POST /api/admin/trade/users/password), so an
    // application alone never grants a session.
    // Initial account seat
    await addTradeUser({
      id: userId,
      accountId: newAccount.id,
      name: data.contactName,
      role: data.role || 'Business Owner',
      seatType: 'owner',
      email: data.email.toLowerCase().trim(),
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
      console.error('Application notification email error (application saved successfully):', emailErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Your B2B trade account application has been received. Our vetting team will verify your credentials within 2 business hours.',
      account: newAccount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Application submission failed' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { buildTradeAccount, upsertTradeAccount, addTradeUser } from '@/lib/trade/trade-store.js';
import { sendTradeApplicationEmails } from '@/lib/trade/trade-email.js';

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.tradingName || !data.contactName || !data.email || !data.phone) {
      return NextResponse.json({ error: 'Missing required business or contact fields' }, { status: 400 });
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


import { NextResponse } from 'next/server.js';
import {
  buildTradeAccount,
  upsertTradeAccount,
  addTradeUser,
  findTradeUserByIdentifier,
  findMatchingTradeAccount,
  getTradeAccountById,
} from '../../../../lib/trade/trade-store.js';
import { sendTradeApplicationEmails } from '../../../../lib/trade/trade-email.js';
import { cleanApplication } from '../../../../lib/trade/trade-application.js';
import { rateLimitRequest } from '../../../../lib/rate-limit.js';

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

    // Deduplicate commercial account: check if matching entity already exists by KRA PIN, licence, or trading name
    const existingAccount = await findMatchingTradeAccount({
      kraPin: data.kraPin,
      licenceNo: data.licenceNo,
      tradingName: data.tradingName,
    });

    if (existingAccount) {
      const userId = `usr_${Date.now()}`;
      await addTradeUser({
        id: userId,
        accountId: existingAccount.id,
        name: data.contactName,
        role: data.role || 'Staff Buyer',
        seatType: 'buyer', // always buyer, never owner
        email,
        phone: data.phone.trim(),
      });

      // Send customer acknowledgement & admin review alerts
      try {
        await sendTradeApplicationEmails({
          application: {
            ...data,
            id: existingAccount.id,
            licenceDocumentUrl: data.licenceDocumentUrl,
          },
        });
      } catch (emailErr) {
        console.error('[trade-apply] Notification email error:', emailErr.message);
      }

      return NextResponse.json({
        success: true,
        attachedToExisting: true,
        message: `You have been added as a purchasing seat to ${existingAccount.tradingName}. Our compliance team will confirm your access shortly.`,
        account: existingAccount,
      });
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
      attachedToExisting: false,
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


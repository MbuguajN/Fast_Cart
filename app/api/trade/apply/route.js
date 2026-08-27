import { NextResponse } from 'next/server';
import { upsertTradeAccount, addTradeUser } from '@/lib/trade/trade-store.js';

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.tradingName || !data.contactName || !data.email || !data.phone) {
      return NextResponse.json({ error: 'Missing required business or contact fields' }, { status: 400 });
    }

    if (data.kraPin) {
      const kraRegex = /^[A-Z]\d{9}[A-Z]$/i;
      if (!kraRegex.test(data.kraPin.trim())) {
        return NextResponse.json({ error: 'Invalid KRA PIN format. Expected format like P051123456Z' }, { status: 400 });
      }
    }

    const accountId = `acc_${Date.now()}`;
    const userId = `usr_${Date.now()}`;

    const newAccount = {
      id: accountId,
      tradingName: data.tradingName.trim(),
      legalName: data.legalName ? data.legalName.trim() : data.tradingName.trim(),
      segment: data.segment || 'horeca',
      status: 'pending',
      kraPin: data.kraPin ? data.kraPin.toUpperCase().trim() : '',
      licenceNo: data.licenceNo ? data.licenceNo.trim() : '',
      licenceExpiry: data.licenceExpiry || null,
      licenceDocUrl: data.licenceDocUrl || null,
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: false,
      creditLimit: 0,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 0,
      orderCeiling: null,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: `addr_${Date.now()}`,
          label: 'Primary Receiving Dock',
          contactName: data.contactName,
          phone: data.phone,
          addressLine: data.deliveryAddress || 'Nairobi',
          city: data.city || 'Nairobi',
          deliveryWindow: data.deliveryWindow || '09:00 - 17:00 EAT',
          isDefault: true,
        },
      ],
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    await upsertTradeAccount(newAccount);

    // No password is set here. Portal access is issued by an admin once the
    // account passes vetting (POST /api/admin/trade/users/password), so an
    // application alone never grants a session.
    await addTradeUser({
      id: userId,
      accountId,
      name: data.contactName,
      role: data.role || 'Business Owner',
      seatType: 'owner',
      email: data.email.toLowerCase().trim(),
      phone: data.phone.trim(),
    });

    return NextResponse.json({
      success: true,
      message: 'Your B2B trade account application has been received. Our vetting team will verify your credentials within 2 business hours.',
      account: newAccount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Application submission failed' }, { status: 500 });
  }
}


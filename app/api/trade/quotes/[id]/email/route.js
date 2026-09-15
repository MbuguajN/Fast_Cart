import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeQuoteById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeQuoteDocument } from '@/lib/trade/trade-documents.js';
import { sendTradeQuoteEmail } from '@/lib/trade/trade-email.js';
import { rateLimitRequest } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request, { params }) {
  let auth;
  try {
    auth = await requireTradeAuth(request);
  } catch {
    return NextResponse.json({ error: 'Trade authentication required' }, { status: 401 });
  }

  try {
    const rl = await rateLimitRequest(request, { scope: '/api/trade/quotes/email', maxRequests: 10, windowMs: 300000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many email attempts. Please wait.' }, { status: 429 });
    }

    const { id } = await params;
    const quoteRecord = await getTradeQuoteById(id);
    if (!quoteRecord) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quoteRecord.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this quote' }, { status: 403 });
    }

    const { recipientEmail, customNotes } = await request.json();
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      return NextResponse.json({ error: 'A valid recipient email address is required' }, { status: 400 });
    }

    const account = await getTradeAccountById(quoteRecord.accountId);
    const quoteDoc = generateTradeQuoteDocument(quoteRecord, account);

    await sendTradeQuoteEmail({
      to: recipientEmail,
      quote: quoteDoc,
      customNotes,
    });

    return NextResponse.json({ success: true, message: `Quotation emailed to ${recipientEmail}` });
  } catch (error) {
    console.error('Customer quote email error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to email quote' }, { status: 500 });
  }
}


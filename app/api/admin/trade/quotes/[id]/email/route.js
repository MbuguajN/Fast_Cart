import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { getTradeQuoteById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeQuoteDocument } from '@/lib/trade/trade-documents.js';
import { sendTradeQuoteEmail } from '@/lib/trade/trade-email.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const quoteRecord = await getTradeQuoteById(id);
    if (!quoteRecord) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const account = await getTradeAccountById(quoteRecord.accountId);
    const body = await request.json().catch(() => ({}));
    const recipientEmail = body.recipientEmail || account?.users?.[0]?.email;

    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      return NextResponse.json({ error: 'A valid recipient email address is required' }, { status: 400 });
    }

    const quoteDoc = generateTradeQuoteDocument(quoteRecord, account);

    await sendTradeQuoteEmail({
      to: recipientEmail,
      quote: quoteDoc,
      customNotes: body.customNotes || '',
    });

    return NextResponse.json({ success: true, message: `Quotation sent to ${recipientEmail}` });
  } catch (error) {
    console.error('Admin quote email error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to email quote' }, { status: 500 });
  }
}


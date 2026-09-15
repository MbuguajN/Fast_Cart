import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeQuoteById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeQuoteDocument } from '@/lib/trade/trade-documents.js';
import { renderQuotePdf } from '@/lib/trade/trade-pdf.js';

export async function GET(request, { params }) {
  let auth;
  try {
    auth = await requireTradeAuth(request);
  } catch {
    return NextResponse.json({ error: 'Trade authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const quoteRecord = await getTradeQuoteById(id);
    if (!quoteRecord) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quoteRecord.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this quote' }, { status: 403 });
    }

    const account = await getTradeAccountById(quoteRecord.accountId);
    const quoteDoc = generateTradeQuoteDocument(quoteRecord, account);
    const pdf = await renderQuotePdf(quoteDoc);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quoteDoc.quoteNumber}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Customer quote PDF generation error:', error.message);
    return NextResponse.json({ error: 'Failed to generate quote PDF' }, { status: 500 });
  }
}


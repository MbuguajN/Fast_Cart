import { NextResponse } from 'next/server';
import { getTradeQuoteById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeQuoteDocument } from '@/lib/trade/trade-documents.js';
import { renderQuotePdf } from '@/lib/trade/trade-pdf.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const quoteRecord = await getTradeQuoteById(id);
    if (!quoteRecord) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const account = await getTradeAccountById(quoteRecord.accountId);
    const quote = generateTradeQuoteDocument(quoteRecord, account);
    const pdf = await renderQuotePdf(quote);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Admin quote PDF generation failed:', error.message);
    return NextResponse.json({ error: 'Failed to generate quote PDF' }, { status: 500 });
  }
}

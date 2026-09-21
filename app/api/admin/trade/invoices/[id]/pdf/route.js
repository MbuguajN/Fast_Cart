import { NextResponse } from 'next/server';
import { getTradeOrderById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeInvoiceDocument } from '@/lib/trade/trade-documents.js';
import { renderInvoicePdf } from '@/lib/trade/trade-pdf.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const account = await getTradeAccountById(order.accountId);
    const invoice = generateTradeInvoiceDocument(order, account);
    const pdf = await renderInvoicePdf(invoice);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Admin invoice PDF generation failed:', error.message);
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 });
  }
}

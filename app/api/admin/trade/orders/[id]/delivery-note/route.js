import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { getTradeOrderById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';
import { renderDeliveryNotePdf } from '@/lib/trade/trade-pdf.js';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const account = await getTradeAccountById(order.accountId);
    const deliveryNote = generateTradeDeliveryNote(order, account);
    const pdf = await renderDeliveryNotePdf(deliveryNote);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${deliveryNote.deliveryNoteNumber || 'delivery-note'}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Admin order delivery note PDF generation failed:', error.message);
    return NextResponse.json({ error: 'Failed to generate delivery note PDF' }, { status: 500 });
  }
}


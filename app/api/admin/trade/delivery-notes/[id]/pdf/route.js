import { NextResponse } from 'next/server';
import { getTradeOrderById, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';
import { renderDeliveryNotePdf } from '@/lib/trade/trade-pdf.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }

    const account = getTradeAccountById(order.accountId);
    const deliveryNote = generateTradeDeliveryNote(order, account);
    const pdf = await renderDeliveryNotePdf(deliveryNote);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${deliveryNote.deliveryNoteNumber}.pdf"`,
        'Content-Length': String(pdf.length),
      },
    });
  } catch (error) {
    console.error('Admin delivery note PDF generation failed:', error.message);
    return NextResponse.json({ error: 'Failed to generate delivery note PDF' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';
import { renderDeliveryNotePdf } from '@/lib/trade/trade-pdf.js';

export async function GET(request, { params }) {
  let auth;
  try {
    auth = await requireTradeAuth(request);
  } catch {
    return NextResponse.json({ error: 'Trade authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }
    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this delivery note.' }, { status: 403 });
    }

    const deliveryNote = generateTradeDeliveryNote(order, auth.account);
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
    console.error('Trade delivery note PDF generation failed:', error.message);
    return NextResponse.json({ error: 'Failed to generate delivery note PDF' }, { status: 500 });
  }
}

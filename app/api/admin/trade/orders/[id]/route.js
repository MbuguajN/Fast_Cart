import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { getTradeOrderById, updateTradeOrderStatus, getTradeAccountById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';
import { sendTradeDeliveryNoteEmail } from '@/lib/trade/trade-email.js';

export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to get order' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, driverName, driverPhone, vehicleRegistration, sealNumber, notes } = body;

    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const meta = {};
    if (status === 'dispatched') {
      if (!driverName || !driverPhone || !vehicleRegistration || !sealNumber) {
        return NextResponse.json(
          { error: 'Driver name, phone, vehicle registration, and security seal number are all required for dispatch' },
          { status: 400 }
        );
      }

      meta.driverInfo = {
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        vehicleRegistration: vehicleRegistration.trim().toUpperCase(),
      };
      meta.sealNumber = sealNumber.trim();
      meta.deliveryNoteNumber = `DN-${(order.orderNumber || order.id).replace(/^FC-ORD-/, '')}`;
    }

    if (notes) {
      meta.notes = notes;
    }

    const updated = await updateTradeOrderStatus(id, status, meta);

    // Send dispatch notification email if newly dispatched
    if (status === 'dispatched') {
      try {
        const account = await getTradeAccountById(order.accountId);
        const recipientEmail = account?.users?.[0]?.email || account?.billingAddress?.email || order.shippingAddress?.email;
        if (recipientEmail) {
          const deliveryNoteDoc = generateTradeDeliveryNote(updated, account);
          await sendTradeDeliveryNoteEmail({
            to: recipientEmail,
            deliveryNote: deliveryNoteDoc,
          });
        }
      } catch (emailErr) {
        console.error('Dispatch email notification failed (order updated successfully):', emailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      order: updated,
      message: `Order ${order.orderNumber} updated to ${status}`,
    });
  } catch (error) {
    console.error('Admin update trade order error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update order' }, { status: 500 });
  }
}


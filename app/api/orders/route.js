import { NextResponse } from 'next/server';
import { wcFetch } from '@/lib/wc-config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer');
    const phone = searchParams.get('phone');
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    if (!customerId && !phone) {
      return NextResponse.json({ orders: [] });
    }

    let allRawOrders = [];

    // Query by customer ID
    if (customerId) {
      const params = { customer: customerId, per_page: '100', order: 'desc', orderby: 'date' };
      if (after) params.after = after;
      if (before) params.before = before;
      try {
        const { data } = await wcFetch('orders', params);
        if (Array.isArray(data)) allRawOrders.push(...data);
      } catch {
        // ignore
      }
    }

    // Query by phone if available
    if (phone) {
      const cleanPhone = phone.replace(/\s/g, '');
      const params = { search: cleanPhone, per_page: '100', order: 'desc', orderby: 'date' };
      if (after) params.after = after;
      if (before) params.before = before;
      try {
        const { data } = await wcFetch('orders', params);
        if (Array.isArray(data)) {
          const matchedByPhone = data.filter((o) => {
            const bPhone = (o.billing?.phone || '').replace(/\s/g, '');
            const sPhone = (o.shipping?.phone || '').replace(/\s/g, '');
            return bPhone === cleanPhone || sPhone === cleanPhone || bPhone.includes(cleanPhone);
          });
          allRawOrders.push(...matchedByPhone);
        }
      } catch {
        // ignore
      }
    }

    // Deduplicate orders by ID
    const uniqueOrdersMap = new Map();
    for (const o of allRawOrders) {
      if (o && o.id && !uniqueOrdersMap.has(o.id)) {
        uniqueOrdersMap.set(o.id, o);
      }
    }

    const sortedOrders = Array.from(uniqueOrdersMap.values()).sort(
      (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    const orders = sortedOrders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      date: o.date_created,
      total: o.total,
      currency: o.currency || 'KES',
      paymentMethod: o.payment_method_title || 'M-Pesa / Card',
      items: (o.line_items || [])
        .map((item) => ({
          productId: item.product_id,
          name: item.name,
          quantity: item.quantity,
          total: item.total,
          price: item.price,
          image: item.image?.src || null,
        }))
        .filter((item) => item.name),
      shipping: {
        address_1: o.shipping?.address_1 || o.billing?.address_1 || '',
        city: o.shipping?.city || o.billing?.city || '',
      },
    }));

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: error.message, orders: [] }, { status: 500 });
  }
}

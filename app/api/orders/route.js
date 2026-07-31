import { NextResponse } from 'next/server';
import { wcFetch } from '@/lib/wc-config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer');
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    if (!customerId) {
      return NextResponse.json({ orders: [] });
    }

    const params = {
      customer: customerId,
      per_page: '100',
      order: 'desc',
      orderby: 'date',
    };

    if (after) params.after = after;
    if (before) params.before = before;

    const { data } = await wcFetch('orders', params);

    const orders = data.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      date: o.date_created,
      total: o.total,
      currency: o.currency,
      paymentMethod: o.payment_method_title,
      items: o.line_items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        total: item.total,
        image: item.image?.src || null,
      })).filter((item) => item.name),
      shipping: {
        address_1: o.shipping?.address_1 || '',
        city: o.shipping?.city || '',
      },
    }));

    return NextResponse.json({ orders });
  } catch (error) {
    return NextResponse.json({ error: error.message, orders: [] }, { status: 500 });
  }
}

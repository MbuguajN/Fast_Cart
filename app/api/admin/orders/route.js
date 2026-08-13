import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { wcFetch, wcPut } from '@/lib/wc-config';

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const per_page = searchParams.get('per_page') || '20';
  const page = searchParams.get('page') || '1';
  const search = searchParams.get('search') || '';

  const params = { per_page, page, orderby: 'date', order: 'desc' };
  if (status && status !== 'any') params.status = status;
  if (search) params.search = search;

  try {
    const result = await wcFetch('orders', params);
    const orders = result.data || [];
    const total = result.headers?.['x-wp-total'] || orders.length;
    const totalPages = result.headers?.['x-wp-totalpages'] || 1;

    const simplified = orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      currency: o.currency,
      date_created: o.date_created,
      billing: {
        first_name: o.billing?.first_name || '',
        last_name: o.billing?.last_name || '',
        email: o.billing?.email || '',
        phone: o.billing?.phone || '',
      },
      shipping: {
        first_name: o.shipping?.first_name || '',
        last_name: o.shipping?.last_name || '',
        address_1: o.shipping?.address_1 || '',
        city: o.shipping?.city || '',
      },
      line_items: (o.line_items || []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        total: item.total,
        price: item.price,
        image: item.image?.src || '',
      })),
      payment_method_title: o.payment_method_title || '',
      customer_note: o.customer_note || '',
    }));

    return NextResponse.json({ orders: simplified, total: parseInt(total), totalPages: parseInt(totalPages) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { orderId, status } = await request.json();
    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status required' }, { status: 400 });
    }

    const result = await wcPut(`orders/${orderId}`, { status });
    return NextResponse.json({ success: true, order: result.data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

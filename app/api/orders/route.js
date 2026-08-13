import { NextResponse } from 'next/server';
import { wcFetch } from '@/lib/wc-config';
import { findCustomerByPhone } from '@/lib/customer';

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length >= 9) {
    return digits.slice(-9); // Return last 9 digits e.g. 712345678
  }
  return digits;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let customerId = searchParams.get('customer');
    const phoneParam = searchParams.get('phone');
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    if (!customerId && phoneParam) {
      const customer = await findCustomerByPhone(phoneParam);
      if (customer) {
        customerId = customer.id;
      }
    }

    let allRawOrders = [];

    // Query 1: Fetch orders by customer ID with status='any'
    if (customerId) {
      const params = { customer: customerId, per_page: '100', status: 'any', order: 'desc', orderby: 'date' };
      if (after) params.after = after;
      if (before) params.before = before;
      try {
        const { data } = await wcFetch('orders', params);
        if (Array.isArray(data)) allRawOrders.push(...data);
      } catch {
        // ignore error
      }
    }

    // Query 2: Fetch orders by phone search with status='any'
    if (phoneParam) {
      const clean9Digits = normalizePhone(phoneParam);
      const searchVariants = [phoneParam, `0${clean9Digits}`, `254${clean9Digits}`, `+254${clean9Digits}`, clean9Digits];

      for (const variant of searchVariants) {
        if (!variant) continue;
        const params = { search: variant, per_page: '100', status: 'any', order: 'desc', orderby: 'date' };
        if (after) params.after = after;
        if (before) params.before = before;
        try {
          const { data } = await wcFetch('orders', params);
          if (Array.isArray(data)) {
            const matched = data.filter((o) => {
              const bPhone = normalizePhone(o.billing?.phone);
              const sPhone = normalizePhone(o.shipping?.phone);
              return bPhone === clean9Digits || sPhone === clean9Digits || bPhone.includes(clean9Digits);
            });
            allRawOrders.push(...matched);
          }
        } catch {
          // ignore error
        }
      }
    }

    // Query 3: Fallback if no customer/phone specified (e.g. store orders view)
    if (!customerId && !phoneParam) {
      const params = { per_page: '100', status: 'any', order: 'desc', orderby: 'date' };
      if (after) params.after = after;
      if (before) params.before = before;
      try {
        const { data } = await wcFetch('orders', params);
        if (Array.isArray(data)) allRawOrders.push(...data);
      } catch {
        // ignore error
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
      number: o.number || o.id,
      status: o.status,
      date: o.date_created,
      total: o.total,
      currency: o.currency || 'KES',
      paymentMethod: o.payment_method_title || 'M-Pesa / Card',
      customerName: [o.billing?.first_name || o.shipping?.first_name, o.billing?.last_name || o.shipping?.last_name].filter(Boolean).join(' ') || 'Customer',
      customerPhone: o.billing?.phone || o.shipping?.phone || '',
      customerEmail: o.billing?.email || '',
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

    return NextResponse.json({ orders, count: orders.length });
  } catch (error) {
    return NextResponse.json({ error: error.message, orders: [] }, { status: 500 });
  }
}

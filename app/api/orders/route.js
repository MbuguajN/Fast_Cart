import { NextResponse } from 'next/server';
import { wcFetch } from '@/lib/wc-config';
import { findCustomerByPhone } from '@/lib/customer';
import { requireCustomerOr401 } from '@/lib/api-guard';
import { normalizePhone } from '@/lib/session';

/**
 * GET /api/orders — the signed-in customer's own order history.
 *
 * This route previously took `?customer=` and `?phone=` from the query string
 * with no session and no ownership check, and — with no parameters at all —
 * returned the 100 most recent orders across the entire store, complete with
 * names, phones, emails and delivery addresses.
 *
 * Both identifiers now come from the session cookie only. Query parameters
 * that name a customer are ignored entirely; the store-wide listing lives at
 * /api/admin/orders, behind the admin guard.
 */
export async function GET(request) {
  const { session, denied } = await requireCustomerOr401(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    // Identity comes from the cookie. Never from the request.
    const sessionPhone = normalizePhone(session.phone);
    let customerId = session.customerId;

    // A phone-verified customer with no WC record yet may have guest orders.
    if (!customerId && sessionPhone) {
      const customer = await findCustomerByPhone(sessionPhone);
      if (customer) customerId = customer.id;
    }

    const dateRange = {};
    if (isIsoDate(after)) dateRange.after = after;
    if (isIsoDate(before)) dateRange.before = before;

    const collected = [];

    if (customerId) {
      collected.push(...await fetchOrders({ customer: customerId, ...dateRange }));
    }

    // Guest orders placed with this number before the account existed.
    if (sessionPhone) {
      const byPhone = await fetchOrders({ search: sessionPhone, ...dateRange });
      collected.push(...byPhone);
    }

    // Belt and braces: whatever the queries returned, only emit orders that
    // actually belong to this session.
    const owned = collected.filter((o) => ownsOrder(o, customerId, sessionPhone));

    const unique = new Map();
    for (const o of owned) {
      if (o?.id && !unique.has(o.id)) unique.set(o.id, o);
    }

    const orders = Array.from(unique.values())
      .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
      .map(toClientOrder);

    return NextResponse.json({ orders, count: orders.length });
  } catch (error) {
    console.error('Order history error:', error.message);
    return NextResponse.json({ error: 'Could not load your orders', orders: [] }, { status: 500 });
  }
}

async function fetchOrders(params) {
  try {
    const { data } = await wcFetch('orders', {
      per_page: '100',
      status: 'any',
      order: 'desc',
      orderby: 'date',
      ...params,
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function ownsOrder(order, customerId, sessionPhone) {
  if (!order) return false;

  if (customerId && Number(order.customer_id) === Number(customerId)) return true;
  if (!sessionPhone) return false;

  return (
    normalizePhone(order.billing?.phone) === sessionPhone ||
    normalizePhone(order.shipping?.phone) === sessionPhone
  );
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function toClientOrder(o) {
  return {
    id: o.id,
    number: o.number || o.id,
    status: o.status,
    date: o.date_created,
    total: o.total,
    currency: o.currency || 'KES',
    paymentMethod: o.payment_method_title || 'M-Pesa / Card',
    customerName:
      [o.billing?.first_name || o.shipping?.first_name, o.billing?.last_name || o.shipping?.last_name]
        .filter(Boolean)
        .join(' ') || 'Customer',
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
  };
}

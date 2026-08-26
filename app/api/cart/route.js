import { NextResponse } from 'next/server';
import { cocartSessionFetch } from '@/lib/cocart';
import { cookies } from 'next/headers';

async function getCartKey() {
  try {
    const cookieStore = await cookies();
    const cartKeyCookie = cookieStore.get('cart_key');
    return cartKeyCookie?.value || '';
  } catch {
    return '';
  }
}

function setCartKey(response, cartKey) {
  if (cartKey) {
    try {
      response.cookies.set('cart_key', cartKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });
    } catch (e) {
      console.error('Failed to set cart_key cookie', e);
    }
  }
}

export async function GET() {
  try {
    const cartKey = await getCartKey();
    if (!cartKey) {
      return NextResponse.json({ items: [], itemCount: 0, ok: true });
    }

    const { ok, data } = await cocartSessionFetch('cart', cartKey);

    if (!ok) {
      return NextResponse.json({ items: [], itemCount: 0, ok: true });
    }

    // Format items as array if CoCart returned an object
    let rawItems = data?.items || [];
    if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
      rawItems = Object.values(rawItems);
    }

    const items = Array.isArray(rawItems) ? rawItems : [];

    const response = NextResponse.json({
      items,
      itemCount: items.length,
      totals: data?.totals || {},
      cart_key: data?.cart_key || cartKey || '',
      ok: true,
    });

    if (data?.cart_key) {
      setCartKey(response, data.cart_key);
    }
    return response;
  } catch (err) {
    console.error('GET /api/cart error:', err);
    return NextResponse.json({ items: [], itemCount: 0, ok: true }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const cartKey = await getCartKey();
    const bodyJson = await request.json().catch(() => ({}));
    const { id, quantity = 1, variation_id } = bodyJson;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const body = { id: String(id), quantity: String(quantity) };
    if (variation_id) body.variation_id = String(variation_id);

    const { ok, status, data } = await cocartSessionFetch('cart/add-item', cartKey, {
      method: 'POST',
      body,
    });

    const response = NextResponse.json(data || { success: true }, { status: 200 });
    if (data?.cart_key) {
      setCartKey(response, data.cart_key);
    }
    return response;
  } catch (err) {
    console.error('POST /api/cart error:', err);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function PUT(request) {
  try {
    const cartKey = await getCartKey();
    const bodyJson = await request.json().catch(() => ({}));
    const { item_key, quantity } = bodyJson;

    if (!item_key) {
      return NextResponse.json({ error: 'Item key is required' }, { status: 400 });
    }

    const { data } = await cocartSessionFetch(`cart/item/${item_key}`, cartKey, {
      method: 'POST',
      body: { quantity: String(quantity) },
    });

    return NextResponse.json(data || { success: true }, { status: 200 });
  } catch (err) {
    console.error('PUT /api/cart error:', err);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

export async function DELETE(request) {
  try {
    const cartKey = await getCartKey();
    let item_key;
    try {
      const body = await request.json();
      item_key = body?.item_key;
    } catch {
      // Body empty
    }

    if (item_key) {
      const { data } = await cocartSessionFetch(`cart/item/${item_key}`, cartKey, {
        method: 'DELETE',
      });
      return NextResponse.json(data || { success: true }, { status: 200 });
    } else {
      const { data } = await cocartSessionFetch('cart/clear', cartKey, {
        method: 'POST',
      });
      return NextResponse.json(data || { success: true }, { status: 200 });
    }
  } catch (err) {
    console.error('DELETE /api/cart error:', err);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

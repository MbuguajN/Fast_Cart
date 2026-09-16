import { NextResponse } from 'next/server';
import { getTradeAuthFromRequest } from '@/lib/trade/trade-auth.js';
import { getSegmentTemplates, upsertSegmentTemplate, deleteSegmentTemplate } from '@/lib/trade/trade-store.js';

export async function GET(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required.' }, { status: 401 });
    }

    const templates = getSegmentTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Trade templates GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, segment, description, items } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Template must contain at least one item.' }, { status: 400 });
    }

    const cleanItems = items
      .filter((it) => it && (it.sku || it.id) && parseInt(it.quantity, 10) > 0)
      .map((it) => ({
        sku: String(it.sku || it.id).trim(),
        name: String(it.name || it.sku || 'Product').trim(),
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        priceLine: it.priceLine === 'jaba' ? 'jaba' : 'spirits',
        prkCostIncVat: Number(it.prkCostIncVat) || 0,
      }));

    if (cleanItems.length === 0) {
      return NextResponse.json({ error: 'Template must contain at least one item with valid quantity.' }, { status: 400 });
    }

    const template = await upsertSegmentTemplate({
      name: name.trim(),
      segment: segment ? String(segment).trim().toLowerCase() : auth.account.segment || 'general',
      description: description ? String(description).trim() : '',
      items: cleanItems,
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Trade templates POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, segment, description, items } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Template ID is required for updates.' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Template must contain at least one item.' }, { status: 400 });
    }

    const cleanItems = items
      .filter((it) => it && (it.sku || it.id) && parseInt(it.quantity, 10) > 0)
      .map((it) => ({
        sku: String(it.sku || it.id).trim(),
        name: String(it.name || it.sku || 'Product').trim(),
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        priceLine: it.priceLine === 'jaba' ? 'jaba' : 'spirits',
        prkCostIncVat: Number(it.prkCostIncVat) || 0,
      }));

    if (cleanItems.length === 0) {
      return NextResponse.json({ error: 'Template must contain at least one item with valid quantity.' }, { status: 400 });
    }

    const template = await upsertSegmentTemplate({
      id,
      name: name.trim(),
      segment: segment ? String(segment).trim().toLowerCase() : 'general',
      description: description ? String(description).trim() : '',
      items: cleanItems,
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Trade templates PUT error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {
        // body might be empty
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
    }

    const success = await deleteSegmentTemplate(id);
    if (!success) {
      return NextResponse.json({ error: 'Template not found or could not be deleted.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Trade templates DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete template' }, { status: 500 });
  }
}

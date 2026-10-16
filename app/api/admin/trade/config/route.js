import { NextResponse } from 'next/server';
import { readTradeStore, updateTradeConfig } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';
import { sanitizeConfigPatch } from '@/lib/trade/trade-config.js';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const store = readTradeStore();
    return NextResponse.json({ success: true, config: store.config });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    let patch;
    try {
      patch = sanitizeConfigPatch(body, readTradeStore().config);
    } catch (validationError) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }
    const config = await updateTradeConfig(patch);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


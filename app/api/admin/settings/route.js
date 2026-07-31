import { NextResponse } from 'next/server';
import { readStore, writeStore } from '@/lib/data-store';

const DEFAULT_SETTINGS = {
  pollingInterval: 30,
  webhookSecret: '',
  autoSync: false,
  showOutOfStock: true,
};

export async function GET() {
  try {
    const store = readStore();
    return NextResponse.json(store.settings || DEFAULT_SETTINGS);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const store = readStore();
    store.settings = { ...DEFAULT_SETTINGS, ...store.settings, ...data };
    writeStore(store);
    return NextResponse.json(store.settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

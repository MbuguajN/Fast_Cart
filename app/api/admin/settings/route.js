import { NextResponse } from 'next/server';
import { readStore, mutateStore } from '@/lib/data-store';
import { adminGuard } from '@/lib/api-guard';

const DEFAULT_SETTINGS = {
  pollingInterval: 30,
  autoSync: false,
  showOutOfStock: true,
};

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const store = readStore();
    return NextResponse.json(store.settings || DEFAULT_SETTINGS);
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const data = await request.json();

    // Signing secrets are read from the environment only — never accept one
    // through the settings API, where it would be persisted to disk.
    delete data.webhookSecret;

    const settings = await mutateStore((store) => {
      store.settings = { ...DEFAULT_SETTINGS, ...store.settings, ...data };
      return store.settings;
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings update failed:', error.message);
    return NextResponse.json({ error: 'Could not save settings' }, { status: 500 });
  }
}

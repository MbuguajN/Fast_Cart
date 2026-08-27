import { NextResponse } from 'next/server';
import { getPrkCosts, importPrkCostsCsv } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const costs = getPrkCosts();
    return NextResponse.json({ success: true, costs });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { csvContent, isDryRun = true } = body;

    if (!csvContent) {
      return NextResponse.json({ error: 'csvContent is required' }, { status: 400 });
    }

    const result = importPrkCostsCsv(csvContent, isDryRun, 'Admin');

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


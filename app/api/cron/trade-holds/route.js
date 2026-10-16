import { NextResponse } from 'next/server';
import { isAuthorisedCron } from '@/lib/cron-auth';
import { expireUnpaidHolds } from '@/lib/trade/trade-hold.js';

/**
 * Cancels unpaid Paystack trade orders whose stock hold has run out and
 * releases their stock. Same auth as /api/cron/reconcile (`x-cron-secret`
 * header, `CRON_SECRET`); schedule it every minute.
 */
async function handle(request) {
  const provided = request.headers.get('x-cron-secret');
  if (!isAuthorisedCron(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { expired } = await expireUnpaidHolds();
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    console.error('Trade hold expiry failed:', error.message);
    return NextResponse.json({ error: 'Hold expiry failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

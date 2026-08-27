import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { readEvents, summarise, EVENT_KINDS } from '@/lib/event-log';
import { getSyncStatus, getProducts } from '@/lib/data-store';
import { isDistributed } from '@/lib/kv-store';
import { isPurchasable } from '@/lib/stock';

/**
 * GET /api/admin/health — operational state at a glance.
 *
 * Exists because the failures that hurt most are the quiet ones: a
 * firewalled REST API, a geocoder blocked by CSP, a webhook whose
 * signature never matches. None of those raise anything a customer or
 * an operator would notice.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const events = readEvents({ limit: 2000 });
  const sync = getSyncStatus();
  const cacheAgeMs = sync.lastSync ? Date.now() - new Date(sync.lastSync).getTime() : null;

  const products = getProducts();

  return NextResponse.json({
    sync: { ...sync, cacheAgeMs },
    catalogue: {
      total: products.length,
      sellable: products.filter(isPurchasable).length,
      outOfStock: products.filter((p) => p.stockStatus !== 'instock').length,
      hiddenByAdmin: products.filter((p) => p.overrides?.hidden).length,
    },
    configured: {
      woocommerce: Boolean(process.env.WOOCOMMERCE_STORE_URL && process.env.WOOCOMMERCE_CONSUMER_KEY),
      wcWebhookSecret: Boolean(process.env.WOOCOMMERCE_WEBHOOK_SECRET),
      paystackKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
      paystackWebhookSecret: Boolean(process.env.PAYSTACK_WEBHOOK_SECRET),
      customerSessionSecret: Boolean(process.env.CUSTOMER_SESSION_SECRET || process.env.SESSION_SECRET),
      tradeSessionSecret: Boolean(process.env.TRADE_JWT_SECRET || process.env.ADMIN_JWT_SECRET),
      sharedStateBackend: isDistributed ? 'redis' : 'in-process',
    },
    summary: summarise(events),
    recentFailures: readEvents({ limit: 25, outcome: 'fail' }),
    kinds: Object.values(EVENT_KINDS),
  });
}

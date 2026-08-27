import crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
}

export function paystackHeaders() {
  return {
    Authorization: `Bearer ${secretKey()}`,
    'Content-Type': 'application/json',
  };
}

export async function initializePayment({ email, amount, reference, metadata = {}, callback_url }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: paystackHeaders(),
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100),
      reference,
      currency: 'KES',
      metadata,
      callback_url,
    }),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Paystack initialization failed');
  }
  return data.data;
}

export async function verifyPayment(reference) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: paystackHeaders(),
    cache: 'no-store',
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Paystack verification failed');
  }
  return data.data;
}

/**
 * Payment reference for an order.
 *
 * The random component comes from the CSPRNG. It was previously
 * `Math.random().toString(36)`, which is drawn from a predictable PRNG — a
 * guessable reference is a weaker concern than a guessable OTP, but it is the
 * identifier the callback and webhook both key on.
 */
export function generateReference(orderId) {
  const random = crypto.randomBytes(9).toString('base64url');
  return `LD_${orderId}_${Date.now()}_${random}`;
}

export function paystackWebhookSecret() {
  return process.env.PAYSTACK_WEBHOOK_SECRET || '';
}

/**
 * Verify a Paystack webhook signature over the RAW request body.
 *
 * Paystack signs the exact bytes it sent. Hashing a re-serialised
 * `JSON.stringify(parsedBody)` — as this previously did — normalises
 * whitespace, unicode escapes and numeric formatting (`1.0` → `1`,
 * `1e3` → `1000`), so the recomputed digest frequently failed to match and
 * legitimate `charge.success` events were rejected.
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature || typeof rawBody !== 'string') return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
  const provided = String(signature).trim();

  // timingSafeEqual throws on a length mismatch — check first rather than
  // relying on a catch, so a genuine error is not swallowed as "invalid".
  if (expected.length !== provided.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
}

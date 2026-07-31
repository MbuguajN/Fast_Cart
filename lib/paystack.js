const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE = 'https://api.paystack.co';

export function paystackHeaders() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
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
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: paystackHeaders(),
  });

  const data = await res.json();
  if (!data.status) {
    throw new Error(data.message || 'Paystack verification failed');
  }
  return data.data;
}

export function generateReference(orderId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `LD_${orderId}_${timestamp}_${random}`;
}

export function paystackWebhookSecret() {
  return process.env.PAYSTACK_WEBHOOK_SECRET || '';
}

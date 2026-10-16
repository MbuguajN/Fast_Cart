/**
 * Which payment methods a trade buyer may use at checkout.
 *
 * One decision point shared by the checkout route and createTradeOrder so the
 * UI, the API and the order writer cannot drift apart. Unknown or missing
 * methods are rejected rather than defaulted — a silent fallback is how an
 * order ends up on a method nobody offered (the old default was M-Pesa paybill,
 * which does not exist).
 */

export const PAYMENT_METHODS = ['paystack', 'pay_on_account', 'bank_transfer'];

/**
 * @returns {string} the method, when allowed
 * @throws {Error} with a buyer-readable message when not
 */
export function assertPaymentMethodAllowed({ method, account, isGuest, config }) {
  if (!PAYMENT_METHODS.includes(method)) {
    throw new Error('Please choose a valid payment method.');
  }

  if (method === 'pay_on_account') {
    if (isGuest || !account?.creditEnabled) {
      throw new Error(
        'Pay-on-account is only available to approved business accounts. Sign in, or apply for a trade business account.'
      );
    }
  }

  if (method === 'bank_transfer' && config?.bankTransfer?.enabled !== true) {
    throw new Error('Bank transfer is not available right now. Please choose another payment method.');
  }

  return method;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_METHODS, assertPaymentMethodAllowed } from '../lib/trade/payment-methods.js';

const creditAccount = { creditEnabled: true };
const plainAccount = { creditEnabled: false };
const bankOn = { bankTransfer: { enabled: true } };

test('PAYMENT_METHODS lists exactly the supported methods', () => {
  assert.deepEqual(PAYMENT_METHODS, ['paystack', 'pay_on_account', 'bank_transfer']);
});

test('mpesa_paybill is rejected', () => {
  assert.throws(() => assertPaymentMethodAllowed({ method: 'mpesa_paybill', account: plainAccount, isGuest: false, config: {} }));
});

test('missing or unknown method is rejected, not defaulted', () => {
  assert.throws(() => assertPaymentMethodAllowed({ method: undefined, account: plainAccount, isGuest: false, config: {} }));
  assert.throws(() => assertPaymentMethodAllowed({ method: 'nirvana', account: creditAccount, isGuest: false, config: {} }));
});

test('guest cannot pay on account even if the guest account says creditEnabled', () => {
  assert.throws(
    () => assertPaymentMethodAllowed({ method: 'pay_on_account', account: creditAccount, isGuest: true, config: {} }),
    /approved business/i
  );
});

test('non-credit account cannot pay on account; credit account can', () => {
  assert.throws(() => assertPaymentMethodAllowed({ method: 'pay_on_account', account: plainAccount, isGuest: false, config: {} }));
  assert.equal(assertPaymentMethodAllowed({ method: 'pay_on_account', account: creditAccount, isGuest: false, config: {} }), 'pay_on_account');
});

test('bank_transfer needs the admin switch on', () => {
  assert.throws(() => assertPaymentMethodAllowed({ method: 'bank_transfer', account: plainAccount, isGuest: true, config: {} }));
  assert.throws(() => assertPaymentMethodAllowed({ method: 'bank_transfer', account: plainAccount, isGuest: true, config: { bankTransfer: { enabled: false } } }));
  assert.equal(assertPaymentMethodAllowed({ method: 'bank_transfer', account: plainAccount, isGuest: true, config: bankOn }), 'bank_transfer');
});

test('paystack is allowed for a guest', () => {
  assert.equal(assertPaymentMethodAllowed({ method: 'paystack', account: plainAccount, isGuest: true, config: {} }), 'paystack');
});

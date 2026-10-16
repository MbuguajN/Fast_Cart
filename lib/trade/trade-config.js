/**
 * Trade config: what an admin may change, and the slice the public checkout may see.
 *
 * `PUT /api/admin/trade/config` used to merge any JSON body straight into the
 * store config. Admin-only, but it meant a typo or a compromised session could
 * plant arbitrary keys. Everything now goes through `sanitizeConfigPatch`.
 */

export const CONFIG_ALLOW_LIST = [
  'priceBands',
  'minOrderBottles',
  'minOrderGoodsExVat',
  'nairobiFreeDeliveryThreshold',
  'nairobiDeliveryFee',
  'gmFloorPercent',
  'termsVersion',
  'deliveryCutoffHour',
  'referralBonusKes',
  'accountManager',
  'stockHoldMinutes',
  'bankTransfer',
];

export const DEFAULT_STOCK_HOLD_MINUTES = 15;

const BANK_FIELDS = ['bankName', 'accountName', 'accountNumber', 'branch'];

function cleanText(value, max = 64) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, max);
}

function sanitizeBankTransfer(patch, current) {
  const merged = { ...(current || {}) };
  for (const field of BANK_FIELDS) {
    if (patch?.[field] !== undefined) merged[field] = cleanText(patch[field]);
  }
  merged.enabled = patch?.enabled === undefined ? merged.enabled === true : patch.enabled === true;

  if (merged.enabled && !(merged.bankName && merged.accountName && merged.accountNumber)) {
    throw new Error('Bank transfer cannot be enabled until bank name, account name and account number are saved.');
  }
  return merged;
}

export function sanitizeConfigPatch(patch, currentConfig = {}) {
  const out = {};
  for (const key of Object.keys(patch || {})) {
    if (!CONFIG_ALLOW_LIST.includes(key)) continue;

    if (key === 'stockHoldMinutes') {
      const n = Number(patch[key]);
      if (patch[key] === null || patch[key] === '' || !Number.isInteger(n) || n < 1 || n > 1440) {
        throw new Error('stockHoldMinutes must be a whole number of minutes from 1 to 1440.');
      }
      out[key] = n;
    } else if (key === 'bankTransfer') {
      out[key] = sanitizeBankTransfer(patch[key], currentConfig.bankTransfer);
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}

/** The only config the unauthenticated checkout page may read. */
export function publicCheckoutOptions(config = {}) {
  const bank = config.bankTransfer;
  return {
    stockHoldMinutes: config.stockHoldMinutes || DEFAULT_STOCK_HOLD_MINUTES,
    bankTransfer:
      bank?.enabled === true
        ? {
            enabled: true,
            bankName: bank.bankName || '',
            accountName: bank.accountName || '',
            accountNumber: bank.accountNumber || '',
            ...(bank.branch ? { branch: bank.branch } : {}),
          }
        : { enabled: false },
  };
}

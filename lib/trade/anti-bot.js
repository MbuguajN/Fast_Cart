/**
 * Anti-bot validation for form submissions (checkout, quote requests, applications).
 *
 * 1. Honeypot check: Bots routinely fill all available inputs including hidden ones.
 * 2. Velocity check: Legitimate human checkout taking less than 1.5 seconds is impossible,
 *    indicating automated headless scripts.
 */

export const MIN_SUBMISSION_DURATION_MS = 1500;

export function validateBotProtection({ honeypot, submissionDurationMs } = {}) {
  // Honeypot field must remain empty
  if (honeypot && String(honeypot).trim() !== '') {
    return { ok: false, error: 'Automated submission rejected', reason: 'honeypot_triggered' };
  }

  // Velocity check
  if (typeof submissionDurationMs === 'number' && submissionDurationMs > 0 && submissionDurationMs < MIN_SUBMISSION_DURATION_MS) {
    return { ok: false, error: 'Please take a moment before submitting', reason: 'submission_too_fast' };
  }

  return { ok: true };
}


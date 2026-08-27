/**
 * Authentication for machine-triggered routes.
 *
 * Separate from the admin cookie because the caller is system cron, a Vercel
 * cron entry or an uptime pinger — none of which can hold a session.
 */

import { timingSafeEquals } from './crypto-tokens.js';

/**
 * An absent or empty configured secret refuses every request. Treating
 * "unconfigured" as "open" would leave the reconcile endpoint public, which
 * is the failure mode this whole module exists to avoid.
 */
export function isAuthorisedCron(provided, expected) {
  if (!expected || typeof expected !== 'string') return false;
  if (!provided || typeof provided !== 'string') return false;
  return timingSafeEquals(provided, expected);
}

/**
 * The `modified_after` value for the next pull.
 *
 * Deliberately overlaps the previous run by `overlapMs`: a product modified
 * during the last request would otherwise fall between two windows and never
 * be picked up. Re-applying an unchanged product is harmless.
 */
export function sinceParam(lastSyncIso, overlapMs = 120000) {
  const base = lastSyncIso ? new Date(lastSyncIso).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  return new Date(base - overlapMs).toISOString();
}

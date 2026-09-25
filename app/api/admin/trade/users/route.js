import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { query, ensureTradeDb } from '@/lib/trade/trade-pg.js';
import { rateLimitRequest } from '@/lib/rate-limit';

/**
 * Defined seat types and their access scopes — used for validation and UI labels.
 */
const SEAT_TYPES = {
  owner: { label: 'Owner / Director', scope: 'Full account control, credit, statements, all seats' },
  buyer: { label: 'Buyer', scope: 'Place orders, view catalogue, subject to ceiling' },
  viewer: { label: 'Viewer / Auditor', scope: 'Read-only: invoices, statements, order history' },
};

/**
 * Simple audit log — writes admin actions to trade_audit_log table.
 * Creates the table on first use.
 */
let auditTableChecked = false;
async function auditLog(adminEmail, action, targetId, details = {}) {
  try {
    if (!auditTableChecked) {
      await query(`
        CREATE TABLE IF NOT EXISTS trade_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_email VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_id VARCHAR(255),
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      auditTableChecked = true;
    }
    await query(
      'INSERT INTO trade_audit_log (admin_email, action, target_id, details) VALUES ($1, $2, $3, $4)',
      [adminEmail || 'unknown', action, targetId, JSON.stringify(details)]
    );
  } catch (e) {
    // Audit logging is best-effort — never block the action
    console.warn('Audit log write failed:', e.message);
  }
}

/** Extract admin email from the JWT in the request cookie for audit logging. */
async function getAdminEmail(request) {
  try {
    const { verifyToken, ADMIN_COOKIE } = await import('@/lib/auth.js');
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (token) {
      const payload = await verifyToken(token);
      return payload?.email || 'unknown';
    }
  } catch { /* non-critical */ }
  return 'unknown';
}

/**
 * GET /api/admin/trade/users
 *
 * Returns all trade users from Postgres with their account trading name.
 * This is the source of truth for user management.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    await ensureTradeDb();
    const res = await query(`
      SELECT
        u.id,
        u.account_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.seat_type,
        u.password_hash IS NOT NULL AND u.password_hash <> '' AS has_password,
        u.must_change_password,
        u.failed_attempts,
        u.locked_until,
        u.created_at,
        a.trading_name,
        a.status AS account_status
      FROM trade_users u
      LEFT JOIN trade_accounts a ON a.id = u.account_id
      ORDER BY a.trading_name ASC, u.seat_type ASC, u.name ASC
    `);

    const users = res.rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      role: r.role,
      seatType: r.seat_type,
      hasPassword: Boolean(r.has_password),
      mustChangePassword: Boolean(r.must_change_password),
      failedAttempts: r.failed_attempts || 0,
      isLocked: r.locked_until && new Date(r.locked_until) > new Date(),
      lockedUntil: r.locked_until,
      createdAt: r.created_at,
      tradingName: r.trading_name || 'Unknown Account',
      accountStatus: r.account_status || 'unknown',
    }));

    return NextResponse.json({ success: true, users, seatTypes: SEAT_TYPES });
  } catch (error) {
    console.error('Failed to fetch trade users:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch trade users' }, { status: 500 });
  }
}

/**
 * POST /api/admin/trade/users
 *
 * Create a new trade user (seat) for an existing account.
 * Also provisions a temporary password and returns it once.
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const data = await request.json();

    if (!data.accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    if (!data.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!data.email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

    const seatType = data.seatType || 'buyer';
    if (!SEAT_TYPES[seatType]) {
      return NextResponse.json({ error: `Invalid seat type. Must be one of: ${Object.keys(SEAT_TYPES).join(', ')}` }, { status: 400 });
    }

    await ensureTradeDb();

    // Verify account exists
    const accCheck = await query('SELECT id FROM trade_accounts WHERE id = $1', [data.accountId]);
    if (accCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Trade account not found' }, { status: 404 });
    }

    // Check for duplicate email
    const dupCheck = await query('SELECT id FROM trade_users WHERE LOWER(email) = LOWER($1)', [data.email.trim()]);
    if (dupCheck.rows.length > 0) {
      return NextResponse.json({ error: 'A trade user with this email already exists' }, { status: 409 });
    }

    // Collision-free user ID
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const { hashPassword, generateTemporaryPassword } = await import('@/lib/trade/trade-password.js');
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    await query(`
      INSERT INTO trade_users (id, account_id, name, email, phone, role, seat_type, password_hash, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
    `, [
      userId,
      data.accountId,
      data.name.trim(),
      data.email.trim().toLowerCase(),
      (data.phone || '').trim(),
      data.role || 'Staff',
      seatType,
      passwordHash,
    ]);

    // Also sync to the JSON store for any JSON-reading code paths
    const { addTradeUser } = await import('@/lib/trade/trade-store.js');
    try {
      await addTradeUser({
        id: userId,
        accountId: data.accountId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: (data.phone || '').trim(),
        role: data.role || 'Staff',
        seatType,
        passwordHash,
        mustChangePassword: true,
      });
    } catch (e) {
      console.warn('JSON store sync failed (non-fatal):', e.message);
    }

    const adminEmail = await getAdminEmail(request);
    await auditLog(adminEmail, 'create-user', userId, {
      email: data.email.trim().toLowerCase(),
      accountId: data.accountId,
      seatType,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        accountId: data.accountId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: (data.phone || '').trim(),
        role: data.role || 'Staff',
        seatType,
      },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('Failed to create trade user:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/trade/users
 *
 * Rate-limited to prevent brute-force temp password generation.
 * Actions: unlock, reset-password, update (fields).
 */
export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  // Rate limit password-sensitive mutations (10 per 5 minutes)
  const rl = await rateLimitRequest(request, {
    maxRequests: 10,
    windowMs: 300_000,
    prefix: 'admin-trade-user-put',
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  try {
    const { userId, action, ...updates } = await request.json();

    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    await ensureTradeDb();
    const adminEmail = await getAdminEmail(request);

    if (action === 'unlock') {
      await query(
        'UPDATE trade_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId]
      );
      await auditLog(adminEmail, 'unlock-user', userId);
      return NextResponse.json({ success: true, message: 'User unlocked' });
    }

    if (action === 'reset-password') {
      const { hashPassword, generateTemporaryPassword } = await import('@/lib/trade/trade-password.js');
      const tempPassword = generateTemporaryPassword();
      const hash = await hashPassword(tempPassword);
      await query(
        'UPDATE trade_users SET password_hash = $1, must_change_password = TRUE, failed_attempts = 0, locked_until = NULL WHERE id = $2',
        [hash, userId]
      );
      await auditLog(adminEmail, 'reset-password', userId);
      return NextResponse.json({ success: true, temporaryPassword: tempPassword });
    }

    // ── General field updates (name, role, seatType, phone, email) ────
    const fieldMap = {
      name: 'name',
      role: 'role',
      seatType: 'seat_type',
      phone: 'phone',
      email: 'email',
    };

    const sets = [];
    const vals = [];
    let idx = 1;
    const changedFields = {};

    for (const [jsKey, pgCol] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== undefined) {
        if (jsKey === 'seatType' && !SEAT_TYPES[updates[jsKey]]) {
          return NextResponse.json({ error: `Invalid seat type. Must be one of: ${Object.keys(SEAT_TYPES).join(', ')}` }, { status: 400 });
        }
        const val = jsKey === 'email' ? String(updates[jsKey]).trim().toLowerCase() : updates[jsKey];
        sets.push(`${pgCol} = $${idx}`);
        vals.push(val);
        changedFields[jsKey] = val;
        idx++;
      }
    }

    if (sets.length > 0) {
      vals.push(userId);
      await query(`UPDATE trade_users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
      await auditLog(adminEmail, 'update-user', userId, changedFields);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update trade user:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

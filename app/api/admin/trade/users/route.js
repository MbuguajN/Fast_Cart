import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { query, ensureTradeDb } from '@/lib/trade/trade-pg.js';

/**
 * Defined seat types and their access scopes — used for validation and UI labels.
 */
const SEAT_TYPES = {
  owner: { label: 'Owner / Director', scope: 'Full account control, credit, statements, all seats' },
  buyer: { label: 'Buyer', scope: 'Place orders, view catalogue, subject to ceiling' },
  viewer: { label: 'Viewer / Auditor', scope: 'Read-only: invoices, statements, order history' },
};

/**
 * GET /api/admin/trade/users
 *
 * Returns all trade users from Postgres with their account trading name and
 * account manager info. This is the source of truth for user management.
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
        a.status AS account_status,
        a.account_manager
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
      accountManager: r.account_manager || null,
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

    const userId = `usr_${Date.now()}`;
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
      // JSON sync is best-effort — Postgres is authoritative
      console.warn('JSON store sync failed (non-fatal):', e.message);
    }

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
 * Actions: unlock, reset-password, update (fields), set-account-manager.
 */
export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { userId, action, ...updates } = await request.json();

    await ensureTradeDb();

    // ── Set account manager from an existing user ────────────────────────
    if (action === 'set-account-manager') {
      const { accountId, name, phone, avatar, role } = updates;
      if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

      const manager = {
        id: userId || null,
        name: name || null,
        phone: phone || null,
        avatar: avatar || null,
        role: role || 'Account Manager',
      };

      // If userId provided, pull their email for the manager object
      if (userId) {
        const userRes = await query('SELECT email FROM trade_users WHERE id = $1', [userId]);
        if (userRes.rows.length > 0) {
          manager.email = userRes.rows[0].email;
        }
      }

      await query(
        'UPDATE trade_accounts SET account_manager = $1 WHERE id = $2',
        [JSON.stringify(manager), accountId]
      );

      // Also update JSON store
      try {
        const { upsertTradeAccount, getTradeAccountById } = await import('@/lib/trade/trade-store.js');
        const acc = await getTradeAccountById(accountId);
        if (acc) {
          await upsertTradeAccount({ ...acc, accountManager: manager });
        }
      } catch (e) {
        console.warn('JSON store sync failed (non-fatal):', e.message);
      }

      return NextResponse.json({ success: true, accountManager: manager });
    }

    // ── Per-user actions ─────────────────────────────────────────────────
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    if (action === 'unlock') {
      await query(
        'UPDATE trade_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
        [userId]
      );
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

    for (const [jsKey, pgCol] of Object.entries(fieldMap)) {
      if (updates[jsKey] !== undefined) {
        // Validate seat type
        if (jsKey === 'seatType' && !SEAT_TYPES[updates[jsKey]]) {
          return NextResponse.json({ error: `Invalid seat type. Must be one of: ${Object.keys(SEAT_TYPES).join(', ')}` }, { status: 400 });
        }
        // Normalize email
        const val = jsKey === 'email' ? String(updates[jsKey]).trim().toLowerCase() : updates[jsKey];
        sets.push(`${pgCol} = $${idx}`);
        vals.push(val);
        idx++;
      }
    }

    if (sets.length > 0) {
      vals.push(userId);
      await query(`UPDATE trade_users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update trade user:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

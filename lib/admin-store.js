/**
 * Admin staff roster — who besides the bootstrap .env owner can reach
 * /admin, and which area they're scoped to (retail vs trade vs owner).
 *
 * Backed by Postgres via lib/trade/trade-pg.js — the app's only real
 * database connection, even though this table isn't trade-specific (see the
 * comment on admin_staff in trade-pg.js's schema). ensureTradeDb() is safe
 * to call from here even though it's named for trade — it just creates
 * every table this connection owns, admin_staff included, and is a cheap
 * no-op after the first call in a process's lifetime.
 */

import { query, ensureTradeDb } from './trade/trade-pg.js';

const ROLES = ['owner', 'retail', 'trade'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toStaffRecord(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminStaffByEmail(email) {
  await ensureTradeDb();
  const res = await query('SELECT * FROM admin_staff WHERE email = $1', [normalizeEmail(email)]);
  return res.rows.length ? toStaffRecord(res.rows[0]) : null;
}

export async function getAllAdminStaff() {
  await ensureTradeDb();
  const res = await query('SELECT * FROM admin_staff ORDER BY created_at DESC');
  return res.rows.map(toStaffRecord);
}

export async function createAdminStaff({ email, name, role, createdBy }) {
  await ensureTradeDb();

  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('A valid email is required');
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);

  const existing = await query('SELECT id FROM admin_staff WHERE email = $1', [cleanEmail]);
  if (existing.rows.length > 0) throw new Error(`${cleanEmail} is already on the staff roster`);

  const id = `staff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await query(
    `INSERT INTO admin_staff (id, email, name, role, is_active, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, $5, NOW(), NOW())`,
    [id, cleanEmail, name || '', role, createdBy || null]
  );

  return getAdminStaffByEmail(cleanEmail);
}

export async function updateAdminStaff(id, patch) {
  await ensureTradeDb();

  const setClauses = [];
  const params = [];

  if (patch.name !== undefined) {
    params.push(patch.name);
    setClauses.push(`name = $${params.length}`);
  }
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
    params.push(patch.role);
    setClauses.push(`role = $${params.length}`);
  }
  if (patch.isActive !== undefined) {
    params.push(Boolean(patch.isActive));
    setClauses.push(`is_active = $${params.length}`);
  }

  if (setClauses.length === 0) throw new Error('Nothing to update');

  params.push(id);
  const res = await query(
    `UPDATE admin_staff SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (res.rows.length === 0) throw new Error('Staff member not found');
  return toStaffRecord(res.rows[0]);
}

export async function deleteAdminStaff(id) {
  await ensureTradeDb();
  const res = await query('DELETE FROM admin_staff WHERE id = $1', [id]);
  if (res.rowCount === 0) throw new Error('Staff member not found');
}

import { NextResponse } from 'next/server.js';
import { requireTradeOr401 } from '../../../../lib/api-guard.js';
import { query, ensureTradeDb } from '../../../../lib/trade/trade-pg.js';
import { toPublicTradeUser } from '../../../../lib/trade/trade-store.js';

const KRA_PIN_REGEX = /^[A-Z]\d{9}[A-Z]$/i;

function formatAccountRecord(acc) {
  if (!acc) return null;
  return {
    id: acc.id,
    tradingName: acc.trading_name,
    legalName: acc.legal_name || acc.trading_name,
    segment: acc.segment || 'horeca',
    status: acc.status || 'active',
    kraPin: acc.kra_pin || '',
    licenceNo: acc.licence_no || '',
    licenceDocUrl: acc.licence_doc_url || null,
    licenceExpiry: acc.licence_expiry
      ? (acc.licence_expiry instanceof Date
          ? acc.licence_expiry.toISOString().split('T')[0]
          : String(acc.licence_expiry).split('T')[0])
      : null,
    addresses: Array.isArray(acc.addresses) ? acc.addresses : (typeof acc.addresses === 'string' ? JSON.parse(acc.addresses) : []),
    defaultAddressId: acc.default_address_id || null,
    priceBook: acc.price_book || 'standard',
    tierOverride: acc.tier_override || null,
    creditEnabled: Boolean(acc.credit_enabled),
    creditLimit: Number(acc.credit_limit) || 0,
    creditTerms: Number(acc.credit_terms) || 14,
    creditUsed: Number(acc.credit_used) || 0,
    cleanOrders: Number(acc.clean_orders) || 0,
    points: Number(acc.points) || 0,
    referralCredit: Number(acc.referral_credit) || 0,
    accountManager: acc.account_manager || null,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  };
}

function formatUserRecord(usr) {
  if (!usr) return null;
  return {
    id: usr.id,
    accountId: usr.account_id,
    name: usr.name,
    email: usr.email,
    phone: usr.phone || '',
    role: usr.role || 'Business Owner',
    seatType: usr.seat_type || 'buyer',
    mustChangePassword: Boolean(usr.must_change_password),
    createdAt: usr.created_at,
  };
}

/**
 * GET /api/trade/profile
 *
 * Fetches user profile, associated account details, and (for owners)
 * the roster of registered team seats.
 */
export async function GET(request) {
  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    await ensureTradeDb();

    // Query user record
    const userRes = await query('SELECT * FROM trade_users WHERE id = $1', [auth.user.id]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    const user = formatUserRecord(userRes.rows[0]);

    // Query account record
    const accRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [auth.account.id]);
    if (accRes.rows.length === 0) {
      return NextResponse.json({ error: 'Associated trade account not found' }, { status: 404 });
    }
    const account = formatAccountRecord(accRes.rows[0]);

    const isOwner = user.seatType === 'owner';

    let seats;
    if (isOwner) {
      const seatsRes = await query(
        `SELECT
           id, name, email, phone, role, seat_type,
           password_hash IS NOT NULL AND password_hash <> '' AS has_password,
           must_change_password, locked_until, created_at
         FROM trade_users
         WHERE account_id = $1
         ORDER BY seat_type ASC, name ASC`,
        [auth.account.id]
      );

      seats = seatsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone || '',
        role: r.role,
        seatType: r.seat_type,
        hasPassword: Boolean(r.has_password),
        mustChangePassword: Boolean(r.must_change_password),
        isLocked: Boolean(r.locked_until && new Date(r.locked_until) > new Date()),
        lockedUntil: r.locked_until,
        createdAt: r.created_at,
      }));
    }

    return NextResponse.json({
      success: true,
      user: toPublicTradeUser(user),
      account,
      isOwner,
      ...(isOwner ? { seats } : {}),
    });
  } catch (error) {
    console.error('Failed to fetch trade profile:', error.message);
    return NextResponse.json({ error: 'Could not load profile settings' }, { status: 500 });
  }
}

/**
 * PUT /api/trade/profile
 *
 * Updates personal details (all seats) and/or business details (owners only).
 * Body: { personal?: { name, phone, role }, business?: { tradingName, legalName, kraPin, licenceNo, licenceExpiry, licenceDocUrl, primaryAddress } }
 */
export async function PUT(request) {
  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    await ensureTradeDb();
    const body = await request.json();

    if (!body || (typeof body !== 'object')) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { personal, business } = body;

    if (!personal && !business) {
      return NextResponse.json({ error: 'No update payload provided' }, { status: 400 });
    }

    // ── 1. Personal Profile Update (Any seat) ───────────────────────────
    if (personal) {
      if (personal.name !== undefined) {
        if (typeof personal.name !== 'string' || !personal.name.trim()) {
          return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
        }
      }

      const sets = [];
      const vals = [];
      let idx = 1;

      if (personal.name !== undefined) {
        sets.push(`name = $${idx++}`);
        vals.push(personal.name.trim());
      }
      if (personal.phone !== undefined) {
        sets.push(`phone = $${idx++}`);
        vals.push((personal.phone || '').trim());
      }
      if (personal.role !== undefined) {
        sets.push(`role = $${idx++}`);
        vals.push((personal.role || '').trim());
      }

      if (sets.length > 0) {
        vals.push(auth.user.id);
        await query(`UPDATE trade_users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
      }
    }

    // ── 2. Business Details Update (Owner Only) ─────────────────────────
    if (business) {
      if (auth.user.seatType !== 'owner') {
        return NextResponse.json(
          { error: 'Only account owners can modify business and tax details' },
          { status: 403 }
        );
      }

      if (business.tradingName !== undefined) {
        if (typeof business.tradingName !== 'string' || !business.tradingName.trim()) {
          return NextResponse.json({ error: 'Trading name cannot be empty' }, { status: 400 });
        }
      }

      let cleanKraPin;
      if (business.kraPin !== undefined && business.kraPin !== null && business.kraPin !== '') {
        cleanKraPin = String(business.kraPin).trim().toUpperCase();
        if (!KRA_PIN_REGEX.test(cleanKraPin)) {
          return NextResponse.json(
            { error: 'Invalid KRA PIN format. Expected format like P051234567Z' },
            { status: 400 }
          );
        }
      } else if (business.kraPin === '') {
        cleanKraPin = '';
      }

      // Fetch existing account to preserve addresses and other fields
      const currentAccRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [auth.account.id]);
      if (currentAccRes.rows.length === 0) {
        return NextResponse.json({ error: 'Trade account not found' }, { status: 404 });
      }
      const currentAcc = currentAccRes.rows[0];

      let addresses = Array.isArray(currentAcc.addresses)
        ? [...currentAcc.addresses]
        : (typeof currentAcc.addresses === 'string' ? JSON.parse(currentAcc.addresses) : []);
      let defaultAddressId = currentAcc.default_address_id;

      if (business.primaryAddress) {
        const addrInput = business.primaryAddress;
        let primaryIdx = addresses.findIndex((a) => a.id === defaultAddressId || a.isDefault);
        if (primaryIdx === -1 && addresses.length > 0) {
          primaryIdx = 0;
        }

        if (primaryIdx >= 0) {
          addresses[primaryIdx] = {
            ...addresses[primaryIdx],
            label: addrInput.label !== undefined ? addrInput.label.trim() : (addresses[primaryIdx].label || 'Primary Receiving Dock'),
            addressLine: addrInput.addressLine !== undefined ? addrInput.addressLine.trim() : addresses[primaryIdx].addressLine,
            city: addrInput.city !== undefined ? addrInput.city.trim() : (addresses[primaryIdx].city || 'Nairobi'),
            deliveryWindow: addrInput.deliveryWindow !== undefined ? addrInput.deliveryWindow.trim() : (addresses[primaryIdx].deliveryWindow || '08:00 - 17:00 EAT'),
            contactName: addrInput.contactName !== undefined ? addrInput.contactName.trim() : (addresses[primaryIdx].contactName || ''),
            phone: addrInput.phone !== undefined ? addrInput.phone.trim() : (addresses[primaryIdx].phone || ''),
            isDefault: true,
          };
          if (!defaultAddressId) {
            defaultAddressId = addresses[primaryIdx].id;
          }
        } else {
          const newId = `addr_${Date.now()}`;
          addresses.push({
            id: newId,
            label: (addrInput.label || 'Primary Receiving Dock').trim(),
            addressLine: (addrInput.addressLine || 'Nairobi').trim(),
            city: (addrInput.city || 'Nairobi').trim(),
            deliveryWindow: (addrInput.deliveryWindow || '08:00 - 17:00 EAT').trim(),
            contactName: (addrInput.contactName || '').trim(),
            phone: (addrInput.phone || '').trim(),
            isDefault: true,
          });
          defaultAddressId = newId;
        }
      }

      const accSets = [];
      const accVals = [];
      let aIdx = 1;

      if (business.tradingName !== undefined) {
        accSets.push(`trading_name = $${aIdx++}`);
        accVals.push(business.tradingName.trim());
      }
      if (business.legalName !== undefined) {
        accSets.push(`legal_name = $${aIdx++}`);
        accVals.push(business.legalName ? business.legalName.trim() : null);
      }
      if (cleanKraPin !== undefined) {
        accSets.push(`kra_pin = $${aIdx++}`);
        accVals.push(cleanKraPin);
      }
      if (business.licenceNo !== undefined) {
        accSets.push(`licence_no = $${aIdx++}`);
        accVals.push(business.licenceNo ? business.licenceNo.trim() : null);
      }
      if (business.licenceExpiry !== undefined) {
        accSets.push(`licence_expiry = $${aIdx++}`);
        accVals.push(business.licenceExpiry ? business.licenceExpiry : null);
      }
      if (business.licenceDocUrl !== undefined) {
        accSets.push(`licence_doc_url = $${aIdx++}`);
        accVals.push(business.licenceDocUrl || null);
      }
      if (business.primaryAddress !== undefined) {
        accSets.push(`addresses = $${aIdx++}`);
        accVals.push(JSON.stringify(addresses));
        accSets.push(`default_address_id = $${aIdx++}`);
        accVals.push(defaultAddressId);
      }

      accSets.push(`updated_at = NOW()`);

      accVals.push(auth.account.id);
      await query(`UPDATE trade_accounts SET ${accSets.join(', ')} WHERE id = $${aIdx}`, accVals);
    }

    // Re-fetch updated records from Postgres
    const freshUserRes = await query('SELECT * FROM trade_users WHERE id = $1', [auth.user.id]);
    const freshAccRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [auth.account.id]);

    const updatedUser = formatUserRecord(freshUserRes.rows[0]);
    const updatedAccount = formatAccountRecord(freshAccRes.rows[0]);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: toPublicTradeUser(updatedUser),
      account: updatedAccount,
    });
  } catch (error) {
    console.error('Trade profile update error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}

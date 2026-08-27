import { wcFetch, wcPost, wcPut } from './wc-config.js';

function extract9Digits(rawPhone) {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 200);
}

export async function findCustomerByPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;

  const clean9 = extract9Digits(phone);
  if (clean9.length < 9) return null;

  const searchVariants = [phone.replace(/\s/g, ''), `0${clean9}`, `254${clean9}`, clean9];

  // Strategy 1: Search WC customers by name/email/username (WC's search index)
  let match = null;
  for (const searchTerm of searchVariants) {
    if (!searchTerm) continue;
    try {
      const { data: customers } = await wcFetch('customers', { search: searchTerm, per_page: '20' });
      if (!Array.isArray(customers) || customers.length === 0) continue;

      match = customers.find((c) => {
        const b = extract9Digits(c.billing?.phone);
        const s = extract9Digits(c.shipping?.phone);
        const u = extract9Digits(c.username);
        return b === clean9 || s === clean9 || u === clean9;
      });

      if (match) return match;
    } catch (e) {
      // Ignore API errors
    }
  }

  // Strategy 2: WC customer search doesn't index billing phone.
  // Fall back to searching orders by phone, then fetch the customer by ID.
  for (const searchTerm of searchVariants) {
    if (!searchTerm) continue;
    try {
      const { data: orders } = await wcFetch('orders', { search: searchTerm, per_page: '5', status: 'any' });
      if (!Array.isArray(orders) || orders.length === 0) continue;

      const matchedOrder = orders.find((o) => {
        const bPhone = extract9Digits(o.billing?.phone);
        const sPhone = extract9Digits(o.shipping?.phone);
        return bPhone === clean9 || sPhone === clean9;
      });

      if (matchedOrder && matchedOrder.customer_id && matchedOrder.customer_id > 0) {
        try {
          const { data: customer } = await wcFetch(`customers/${matchedOrder.customer_id}`);
          if (customer && customer.id) return customer;
        } catch (e) {
          // Customer fetch failed, continue
        }
      }
    } catch (e) {
      // Ignore API errors
    }
  }

  return null;
}

export async function findOrCreateCustomer({ phone, name, email, landmark, zone }) {
  if (!phone) throw new Error('Phone is required');

  const existing = await findCustomerByPhone(phone);
  
  const formattedPhone = phone.replace(/\s/g, '');
  const sanitizedName = sanitize(name || 'Customer');
  const [firstName, ...lastParts] = sanitizedName.split(' ');
  const lastName = lastParts.join(' ').slice(0, 100);
  
  if (existing) {
    // Optionally update customer if name or location is provided but previously empty
    // To keep it safe and avoid overwriting with empty data:
    let needsUpdate = false;
    const updatePayload = {};
    
    if (name && (!existing.first_name || existing.first_name === 'Customer')) {
      updatePayload.first_name = firstName.slice(0, 100);
      updatePayload.last_name = lastName;
      updatePayload.billing = { ...existing.billing, first_name: firstName.slice(0, 100), last_name: lastName };
      updatePayload.shipping = { ...existing.shipping, first_name: firstName.slice(0, 100), last_name: lastName };
      needsUpdate = true;
    }
    
    if (landmark && (!existing.billing?.address_1)) {
      if (!updatePayload.billing) updatePayload.billing = { ...existing.billing };
      if (!updatePayload.shipping) updatePayload.shipping = { ...existing.shipping };
      updatePayload.billing.address_1 = sanitize(landmark).slice(0, 200);
      updatePayload.shipping.address_1 = sanitize(landmark).slice(0, 200);
      if (zone) {
        updatePayload.billing.city = sanitize(zone);
        updatePayload.shipping.city = sanitize(zone);
      }
      if (!updatePayload.meta_data) updatePayload.meta_data = [...(existing.meta_data || [])];
      updatePayload.meta_data.push({ key: 'landmark_hint', value: sanitize(landmark).slice(0, 200) });
      if (zone) updatePayload.meta_data.push({ key: 'delivery_zone', value: sanitize(zone).slice(0, 100) });
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      try {
        await wcPut(`customers/${existing.id}`, updatePayload);
      } catch (e) {
        // Non-fatal: the customer record exists, it just wasn't enriched.
        console.error('Failed to update existing customer:', e.message);
      }
    }

    return existing;
  }

  // Create new customer
  const customerEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : `liquor_${formattedPhone}@liquordash.local`;
  
  const customerPayload = {
    email: customerEmail,
    first_name: firstName.slice(0, 100),
    last_name: lastName,
    billing: {
      phone: formattedPhone,
      first_name: firstName.slice(0, 100),
      last_name: lastName,
      email: customerEmail,
      city: sanitize(zone || 'Nairobi'),
      address_1: sanitize(landmark || '').slice(0, 200),
    },
    shipping: {
      phone: formattedPhone,
      first_name: firstName.slice(0, 100),
      last_name: lastName,
      address_1: sanitize(landmark || '').slice(0, 200),
      city: sanitize(zone || 'Nairobi'),
    },
    meta_data: [
      { key: 'landmark_hint', value: sanitize(landmark || '').slice(0, 200) },
      { key: 'phone_normalized', value: formattedPhone },
      { key: 'delivery_zone', value: sanitize(zone || '').slice(0, 100) },
    ],
  };

  try {
    const customer = await wcPost('customers', customerPayload);
    return customer;
  } catch (error) {
    console.error('Failed to create customer', error);
    throw error;
  }
}

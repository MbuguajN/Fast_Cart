const EXPIRY = 8 * 60 * 60 * 1000; // 8 hours

// Simple HMAC-SHA256 using Web Crypto API (Edge-compatible)
async function hmacSign(secret, data) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded);
}

export async function signToken(payload) {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'liquordash-admin-secret-change-in-production';
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + EXPIRY }));
  const signature = await hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token) {
  if (!token) return null;
  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'liquordash-admin-secret-change-in-production';
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const expected = await hmacSign(secret, `${header}.${body}`);
    if (signature !== expected) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/admin_token=([^;]+)/);
  return match ? match[1] : null;
}

export async function getAuthFromRequest(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAdmin(request) {
  return getAuthFromRequest(request);
}

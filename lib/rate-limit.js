const hits = new Map();

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export function rateLimit(key, { maxRequests = 10, windowMs = 60000 } = {}) {
  const now = Date.now();
  const ip = key;
  const entry = hits.get(ip);

  if (!entry || now - entry.start > windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.start + windowMs - now) / 1000) };
  }
  return { allowed: true, remaining: maxRequests - entry.count };
}

export function rateLimitRequest(request, opts = {}) {
  const ip = getClientIp(request);
  return rateLimit(ip, opts);
}

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now - entry.start > 300000) hits.delete(key);
    }
  }, 300000);
}

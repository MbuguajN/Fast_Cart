import fs from 'fs';
import path from 'path';

const PAGES_FILE = path.join(process.cwd(), 'data', 'pages.json');

const WP_PAGE_MAP = {
  'refund-returns': 'https://myhappyhour.co.ke/refund_returns/',
  'refund-returns-policy': 'https://myhappyhour.co.ke/refund_returns/',
  'refund-and-returns-policy': 'https://myhappyhour.co.ke/refund_returns/',
  'terms': 'https://myhappyhour.co.ke/terms-conditions/',
  'terms-conditions': 'https://myhappyhour.co.ke/terms-conditions/',
  'terms-and-conditions': 'https://myhappyhour.co.ke/terms-conditions/',
  'privacy': 'https://myhappyhour.co.ke/privacy-policy/',
  'privacy-policy': 'https://myhappyhour.co.ke/privacy-policy/',
  'ugc': 'https://myhappyhour.co.ke/ugc-policy/',
  'ugc-policy': 'https://myhappyhour.co.ke/ugc-policy/',
  'contact': 'https://myhappyhour.co.ke/contact-us/',
  'contact-us': 'https://myhappyhour.co.ke/contact-us/',
};

export function getAllPages() {
  try {
    if (fs.existsSync(PAGES_FILE)) {
      const data = fs.readFileSync(PAGES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // fallback
  }
  return {};
}

export function getPageBySlug(slug) {
  const pages = getAllPages();
  const normalized = slug.toLowerCase().trim();

  // Direct match
  if (pages[normalized]) return pages[normalized];

  // Alias match
  for (const [key, page] of Object.entries(pages)) {
    if (key === normalized || key.replace(/-/g, '') === normalized.replace(/-/g, '')) {
      return page;
    }
  }

  // Alias mapping
  if (normalized.includes('refund') || normalized.includes('return')) {
    return pages['refund-returns-policy'] || null;
  }
  if (normalized.includes('term')) {
    return pages['terms-conditions'] || null;
  }
  if (normalized.includes('privac')) {
    return pages['privacy-policy'] || null;
  }
  if (normalized.includes('ugc')) {
    return pages['ugc-policy'] || null;
  }
  if (normalized.includes('contact')) {
    return pages['contact-us'] || null;
  }

  return null;
}

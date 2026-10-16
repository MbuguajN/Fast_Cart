/**
 * Brand name safe to show on public trade pages. The supplier relationship is
 * not public, and some products store the parent company here instead of the
 * consumer brand, so it is blanked rather than shown.
 */
export function publicBrandName(brandName, isJaba) {
  const brand = String(brandName || '').trim();
  if (/pernod/i.test(brand)) return '';
  return brand || (isJaba ? 'Jaba' : '');
}

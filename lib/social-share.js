export function getProductPath(product) {
  if (!product) return '/';
  const slug = product.slug || product.wcId || product.id;
  return `/product/${slug}`;
}

export function getAbsoluteProductUrl(product) {
  const path = getProductPath(product);
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  const defaultDomain = process.env.NEXT_PUBLIC_SITE_URL || 'https://myhappyhour.co.ke';
  return `${defaultDomain.replace(/\/$/, '')}${path}`;
}

export function getProductShareDetails(product) {
  const name = product?.name || 'Drink';
  const price = product?.price ? `KSh ${Number(product.price).toLocaleString()}` : '';
  const url = getAbsoluteProductUrl(product);
  const text = `Order ${name} ${price ? `(${price})` : ''} on Happy Hour — Fast 20-min delivery in Nairobi! 🍹⚡`;

  return {
    title: `${name} | Happy Hour Fast Drinks Delivery`,
    text,
    url,
  };
}

export async function shareProduct(product, { platform = 'native' } = {}) {
  const { title, text, url } = getProductShareDetails(product);

  if (platform === 'whatsapp') {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    return { success: true, method: 'whatsapp' };
  }

  if (platform === 'twitter' || platform === 'x') {
    const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twUrl, '_blank', 'noopener,noreferrer');
    return { success: true, method: 'twitter' };
  }

  if (platform === 'facebook') {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer');
    return { success: true, method: 'facebook' };
  }

  // Native share sheet if supported
  if (platform === 'native' && typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, aborted: true };
      }
      // Fallback to copy link below
    }
  }

  // Default fallback: Copy link to clipboard
  const copied = await copyLinkToClipboard(url);
  return { success: copied, method: 'clipboard' };
}

export async function copyLinkToClipboard(url) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy link:', err);
    return false;
  }
}


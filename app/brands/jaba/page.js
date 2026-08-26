import { getProducts, getSettings, isProductInStock } from '@/lib/data-store';
import JabaView from './JabaView';

export const metadata = {
  title: 'Jaba Juice - Pick Your Flavour. Pour Your Happy. | Happy Hour Nairobi',
  description: 'Explore authentic Happy Hour Jaba Juice flavours: Tropical, Sugarcane, Hibiscus, Tamarind, Watermelon, Pineapple, and Beetroot. Delivered chilled in 20 minutes.',
  openGraph: {
    title: 'Jaba Juice - Pick Your Flavour. Pour Your Happy.',
    description: 'Explore authentic Happy Hour Jaba Juice flavours delivered chilled in 20 minutes in Nairobi.',
    images: ['/uploads/jaba/Group-85-e1787314358232.webp'],
  },
};

const JABA_IMAGE_MAP = {
  tropical: '/uploads/jaba/Tropical.webp',
  sugarcane: '/uploads/jaba/Sugarcane.webp',
  hibiscus: '/uploads/jaba/Hibiscus.webp',
  tamarind: '/uploads/jaba/Tamarind.webp',
  watermelon: '/uploads/jaba/Watermelon.webp',
  pineapple: '/uploads/jaba/Pineapple_.webp',
  beetroot: '/uploads/jaba/Beetroot.webp',
};

const DEFAULT_JABA_LIST = [
  { wcId: 4759, slug: 'tropical', name: 'Tropical', price: 960 },
  { wcId: 4755, slug: 'sugarcane', name: 'Sugarcane', price: 960 },
  { wcId: 4751, slug: 'hibiscus', name: 'Hibiscus', price: 960 },
  { wcId: 4748, slug: 'tamarind', name: 'Tamarind', price: 960 },
  { wcId: 4744, slug: 'watermelon', name: 'Watermelon', price: 960 },
  { wcId: 4740, slug: 'pineapple', name: 'Pineapple', price: 960 },
  { wcId: 4737, slug: 'beetroot', name: 'Beetroot', price: 960 },
];

export default async function JabaBrandPage() {
  const allProducts = getProducts();
  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock !== false;

  const foundJaba = allProducts.filter((p) => {
    const isJaba = (p.brandName && p.brandName.toLowerCase() === 'jaba') ||
                   (p.categoryName && p.categoryName.toLowerCase() === 'jaba') ||
                   (p.brandId && String(p.brandId).includes('jaba'));
    if (!isJaba) return false;
    if (!showOutOfStock && !isProductInStock(p)) return false;
    return true;
  });

  const jabaProducts = (foundJaba.length > 0 ? foundJaba : DEFAULT_JABA_LIST).map((p) => {
    const slug = (p.slug || p.name || '').toLowerCase();
    const matchedImg = JABA_IMAGE_MAP[slug] || p.image || '/uploads/jaba/Tropical.webp';
    const inStock = p.stockStatus ? isProductInStock(p) : true;

    return {
      id: p.wcId || p.id,
      wcId: p.wcId || p.id,
      name: p.name,
      slug: p.slug || slug,
      type: p.type || 'simple',
      price: parseFloat(p.price) || 960,
      originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 960,
      image: matchedImg,
      images: [matchedImg],
      category: 'jaba',
      fast6: false,
      inStock,
      stockQty: p.stockQuantity ?? (inStock ? 99 : 0),
      brand: 'Jaba',
      brandName: 'Jaba',
      size: p.shortDescription?.replace(/<[^>]*>/g, '').trim() || '500ml',
      upsellIds: p.upsellIds || [],
      totalSales: p.totalSales || 0,
      attributes: p.attributes || [],
      variations: p.variations || [],
    };
  });

  // Query other non-Jaba products for Related Products section
  const nonJabaProducts = allProducts
    .filter((p) => {
      const isJaba = (p.brandName && p.brandName.toLowerCase() === 'jaba') ||
                     (p.categoryName && p.categoryName.toLowerCase() === 'jaba') ||
                     (p.brandId && String(p.brandId).includes('jaba'));
      if (isJaba) return false;
      if (!showOutOfStock && !isProductInStock(p)) return false;
      return true;
    })
    .slice(0, 12)
    .map((p) => {
      const inStock = isProductInStock(p);
      return {
        id: p.wcId || p.id,
        wcId: p.wcId || p.id,
        name: p.name,
        slug: p.slug,
        type: p.type || 'simple',
        price: parseFloat(p.price) || 0,
        originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
        image: p.image,
        images: p.images || [],
        category: p.categoryName || '',
        fast6: false,
        inStock,
        stockQty: p.stockQuantity ?? (inStock ? 99 : 0),
        brand: p.brandName || '',
        brandName: p.brandName || '',
        size: p.shortDescription?.replace(/<[^>]*>/g, '').trim() || '',
        upsellIds: p.upsellIds || [],
        totalSales: p.totalSales || 0,
        attributes: p.attributes || [],
        variations: p.variations || [],
      };
    });

  return <JabaView jabaProducts={jabaProducts} relatedProducts={nonJabaProducts} />;
}

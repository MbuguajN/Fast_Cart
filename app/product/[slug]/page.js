import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts, getBrands, getSettings, isProductInStock } from '@/lib/data-store';
import { getAbsoluteProductUrl } from '@/lib/social-share';
import ProductView from './ProductView';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: 'Product Not Found | Happy Hour',
      description: 'The requested drink could not be found on Happy Hour.',
    };
  }

  const priceFormatted = product.price ? `KSh ${Number(product.price).toLocaleString()}` : '';
  const title = `${product.name} ${priceFormatted ? `- ${priceFormatted} ` : ''}| Happy Hour Nairobi`;
  const description = `Order ${product.name} on Happy Hour! Fast 20-minute ice-cold drinks delivery in Nairobi. Order online now.`;
  const absoluteUrl = getAbsoluteProductUrl(product);

  const images = product.image
    ? [
        {
          url: product.image,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ]
    : [];

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl,
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl,
      siteName: 'Happy Hour Drinks Delivery',
      images,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.image ? [product.image] : [],
    },
  };
}

// Store records only ever carry `wcId` — the cart, checkout, and the rest of
// the client-side catalogue all key products by `id`. app/page.js normalizes
// this the same way when it loads /api/products; this page fetches straight
// from the store instead, so it has to normalize it too. Skipping this is
// exactly why the buttons below silently did nothing: addToCart(undefined)
// fails the `Number.isFinite` guard in lib/cart-storage.js#addLine and bails
// out with no error and no state change.
function withId(p) {
  return { ...p, id: p.wcId || p.id };
}

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const rawProduct = getProductBySlug(slug);

  if (!rawProduct) {
    notFound();
  }

  const product = withId(rawProduct);
  const allProducts = getProducts();
  const brands = getBrands();

  // Find matching brand info if available
  const brand = brands.find(
    (b) =>
      (product.brandId && (b.id === product.brandId || b.wcId === product.brandId)) ||
      (product.brandName && b.name.toLowerCase() === product.brandName.toLowerCase())
  ) || null;

  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock !== false;

  // Find related products (same category or same brand, max 6, respecting out of stock setting)
  const relatedProducts = allProducts
    .filter(
      (p) =>
        (p.id !== product.id && p.wcId !== product.wcId) &&
        (showOutOfStock || isProductInStock(p)) &&
        ((product.categoryId && p.categoryId === product.categoryId) ||
          (product.brandName && p.brandName && p.brandName.toLowerCase() === product.brandName.toLowerCase()))
    )
    .slice(0, 6)
    .map(withId);

  return (
    <ProductView
      product={product}
      brand={brand}
      relatedProducts={relatedProducts}
    />
  );
}

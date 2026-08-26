import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts, getBrands } from '@/lib/data-store';
import { PRODUCTS as FALLBACK_PRODUCTS } from '@/lib/products';
import { getAbsoluteProductUrl } from '@/lib/social-share';
import ProductView from './ProductView';

function resolveProduct(slug) {
  let product = getProductBySlug(slug);
  if (!product) {
    // Check fallback products
    const normalized = String(slug).toLowerCase().trim();
    product = FALLBACK_PRODUCTS.find(
      (p) =>
        (p.slug && p.slug.toLowerCase() === normalized) ||
        String(p.id) === normalized ||
        p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === normalized
    ) || null;
  }
  return product;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = resolveProduct(slug);

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

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const product = resolveProduct(slug);

  if (!product) {
    notFound();
  }

  const allProducts = getProducts();
  const brands = getBrands();

  // Find matching brand info if available
  const brand = brands.find(
    (b) =>
      (product.brandId && (b.id === product.brandId || b.wcId === product.brandId)) ||
      (product.brandName && b.name.toLowerCase() === product.brandName.toLowerCase())
  ) || null;

  // Find related products (same category or same brand, max 6)
  const relatedProducts = (allProducts.length > 0 ? allProducts : FALLBACK_PRODUCTS)
    .filter(
      (p) =>
        (p.id !== product.id && p.wcId !== product.wcId) &&
        ((product.categoryId && p.categoryId === product.categoryId) ||
          (product.brandName && p.brandName && p.brandName.toLowerCase() === product.brandName.toLowerCase()))
    )
    .slice(0, 6);

  return (
    <ProductView
      product={product}
      brand={brand}
      relatedProducts={relatedProducts}
    />
  );
}


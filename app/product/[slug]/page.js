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

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

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
    .slice(0, 6);

  return (
    <ProductView
      product={product}
      brand={brand}
      relatedProducts={relatedProducts}
    />
  );
}

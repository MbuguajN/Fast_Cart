import { notFound } from 'next/navigation';
import { getBrands, getProducts } from '@/lib/data-store';
import BrandView from './BrandView';

function mapProduct(p) {
  const catName = p.categoryName || '';
  const catSlug = catName.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
  return {
    id: p.wcId,
    name: p.name,
    slug: p.slug,
    type: p.type || 'simple',
    price: parseFloat(p.price) || 0,
    originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
    image: p.image,
    images: p.images || [],
    category: catSlug,
    fast6: false,
    inStock: p.stockStatus === 'instock',
    stockQty: p.stockQuantity ?? 99,
    brand: p.brandName || '',
    sku: p.sku || '',
    size: p.shortDescription?.replace(/<[^>]*>/g, '').trim() || '',
    upsellIds: p.upsellIds || [],
    totalSales: p.totalSales || 0,
    attributes: p.attributes || [],
    variations: p.variations || [],
  };
}

async function getBrandData(slug) {
  const brands = getBrands();
  const brand = brands.find(b => b.slug === slug || b.id === slug || String(b.wcId) === slug);
  if (!brand) return null;

  const rawProducts = getProducts();
  const bName = (brand.name || '').toLowerCase().trim();
  const bId = String(brand.wcId || brand.id || '');

  const brandProducts = rawProducts
    .filter(p => {
      const pBrand = (p.brandName || '').toLowerCase().trim();
      const pBrandId = String(p.brandId || '');
      return pBrand === bName || pBrandId === bId || (bName && pBrand.includes(bName));
    })
    .map(mapProduct);

  return { brand, products: brandProducts };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getBrandData(slug);
  if (!data) return { title: 'Brand Not Found | LiquorDash' };
  return { 
    title: `${data.brand.name} | LiquorDash`,
    description: data.brand.description || `Shop genuine ${data.brand.name} drinks delivered fast in minutes.`
  };
}

export default async function BrandPage({ params }) {
  const { slug } = await params;
  const data = await getBrandData(slug);

  if (!data) {
    notFound();
  }

  return <BrandView brand={data.brand} initialProducts={data.products} />;
}

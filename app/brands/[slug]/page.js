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
    id: p.wcId || p.id,
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
  const normalizedSlug = String(slug).toLowerCase().trim();
  const slugDashed = normalizedSlug.replace(/_/g, '-');
  const slugUnderscored = normalizedSlug.replace(/-/g, '_');

  const brand = brands.find(b => {
    const bSlug = String(b.slug || '').toLowerCase().trim();
    const bId = String(b.id || '').toLowerCase().trim();
    const bWcId = String(b.wcId || '').toLowerCase().trim();
    const bName = String(b.name || '').toLowerCase().trim();
    const bNameDashed = bName.replace(/[^a-z0-9]+/g, '-');
    const bNameUnderscored = bName.replace(/[^a-z0-9]+/g, '_');

    return (
      bSlug === normalizedSlug ||
      bSlug === slugDashed ||
      bSlug === slugUnderscored ||
      bId === normalizedSlug ||
      bId === `brand_${slugUnderscored}` ||
      bWcId === normalizedSlug ||
      bNameDashed === slugDashed ||
      bNameUnderscored === slugUnderscored
    );
  });

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

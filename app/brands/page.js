import Link from 'next/link';
import { getBrands, getProducts, getSettings, isProductInStock } from '@/lib/data-store';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: "All Brands | LiquorDash",
  description: "Happy Hour brings you Genuinely Sourced Products from Distinguished Brands. Each Bottle Packed with Character, Taste, and a Full Range of Flavor!",
};

export default async function BrandsPage() {
  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock !== false;
  const rawProducts = getProducts();

  const brands = getBrands().filter((b) => {
    if (b.visible === false) return false;
    if (!showOutOfStock) {
      const bName = (b.name || '').toLowerCase().trim();
      const bId = String(b.wcId || b.id || '');
      const hasInStock = rawProducts.some((p) => {
        const pBrand = (p.brandName || '').toLowerCase().trim();
        const pBrandId = String(p.brandId || '');
        const matches = pBrand === bName || pBrandId === bId || (bName && pBrand.includes(bName));
        return matches && isProductInStock(p);
      });
      return hasInStock;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      <Header />
      <main className="flex-1 px-4 md:px-8 max-w-7xl mx-auto space-y-6 pt-4 md:pt-6 w-full pb-16">
        <div className="text-center max-w-3xl mx-auto my-6 space-y-2">
          <h1 className="text-2xl md:text-4xl font-extrabold text-[#191c1d] tracking-tight uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Distinguished Brands
          </h1>
          <p className="text-xs md:text-sm text-[#5f5e5e] leading-relaxed" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Happy Hour brings you Genuinely Sourced Products from Distinguished Brands—Each Bottle Packed with Character, Taste, and a Full Range of Flavor! Enjoy the Masterful Work of Global Brands at Unbeatable Prices.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {brands.map((brand) => {
            const logoUrl = brand.logo || brand.image;
            
            return (
              <Link
                key={brand.id || brand.wcId}
                href={`/brands/${brand.slug || brand.id}`}
                className="group relative w-full aspect-square rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                style={{
                  border: '1.5px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                {/* Image fills the full card */}
                {logoUrl ? (
                  <img
                    alt={`${brand.name} logo`}
                    src={logoUrl}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : null}

                {/* Fallback for no image or image error */}
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-2"
                  style={{
                    backgroundColor: brand.color || '#840037',
                    display: logoUrl ? 'none' : 'flex'
                  }}
                >
                  <span className="text-white font-black text-3xl md:text-4xl uppercase tracking-wider">
                    {brand.name ? brand.name.substring(0, 2) : 'B'}
                  </span>
                </div>

                {/* Dark overlay with brand name at bottom */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 flex items-end">
                  <span className="text-white text-xs md:text-sm font-bold truncate w-full text-center drop-shadow-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {brand.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}

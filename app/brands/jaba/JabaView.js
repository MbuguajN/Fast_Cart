'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ProductCard from '@/components/ProductCard';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';

export default function JabaView({ jabaProducts = [], relatedProducts = [] }) {
  const { cart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity, products: allProducts, setProducts } = useCart();
  const { user, completeProfileAtCheckout, lookupPhone, updateProfile, updateEmail } = useAuth();
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    const combined = [...jabaProducts, ...relatedProducts];
    if (combined.length > 0 && setProducts) {
      setProducts((prev) => (prev && prev.length > 0 ? prev : combined));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveProducts = (allProducts && allProducts.length > 0) ? allProducts : [...jabaProducts, ...relatedProducts];

  const handleOrderSuccess = (order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    clearCart();
  };

  const scrollToShop = (e) => {
    e?.preventDefault();
    const el = document.getElementById('our-flavours');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const displayProducts = jabaProducts && jabaProducts.length > 0
    ? jabaProducts
    : effectiveProducts.filter((p) => (p.brandName || '').toLowerCase() === 'jaba');

  const displayRelated = relatedProducts && relatedProducts.length > 0
    ? relatedProducts
    : effectiveProducts.filter((p) => (p.brandName || '').toLowerCase() !== 'jaba').slice(0, 6);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <Header cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} onOpenCart={() => setShowCheckout(true)} user={user} />

      <main className="flex-1 w-full pt-[115px] md:pt-[80px] pb-16 space-y-12 md:space-y-16 overflow-x-hidden">
        {/* 1. HERO SECTION (Dark Nightlife Banner with Lineup Blown Out Past Seam) */}
        <section
          className="relative w-full bg-cover bg-center pt-8 sm:pt-12 md:pt-16 pb-12 sm:pb-16 md:pb-24 px-4 md:px-12"
          style={{
            backgroundImage: `url('/uploads/jaba/Group-106.webp')`,
            backgroundColor: '#2b001a',
          }}
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Hero Content */}
            <div className="lg:col-span-5 text-center lg:text-left space-y-5">
              <h1
                className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.08] tracking-tight drop-shadow-md"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Pick Your<br />
                Flavour.<br />
                Pour Your<br />
                Happy.
              </h1>

              {/* Price Splash Badge */}
              <div className="flex justify-center lg:justify-start">
                <img
                  src="/uploads/jaba/Group-84-1.webp"
                  alt="KSh 960"
                  className="h-14 sm:h-16 md:h-20 w-auto object-contain drop-shadow-lg"
                />
              </div>

              {/* Yellow SHOP NOW Button */}
              <div className="pt-2 flex justify-center lg:justify-start">
                <button
                  onClick={scrollToShop}
                  className="px-8 py-3 rounded-2xl bg-[#FFCC00] hover:bg-[#e6b800] text-[#840037] font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  SHOP NOW
                </button>
              </div>
            </div>

            {/* Right Hero Bottle Lineup (Enlarged & Floating Down Past Screen Seam) */}
            <div className="lg:col-span-7 flex justify-center items-center relative lg:-mb-36 md:-mb-28 -mb-16 z-20 pointer-events-none">
              <img
                src="/uploads/jaba/Group-85-e1787314358232.webp"
                alt="Jaba Juice Full Lineup"
                className="w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl h-auto object-contain drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)] scale-105 sm:scale-110 lg:scale-115 transition-transform duration-500"
              />
            </div>
          </div>
        </section>

        {/* 2. THE PARTY STARTS HERE (Scattered Fruit White Background) */}
        <section
          className="relative max-w-6xl mx-auto px-4 md:px-8 pt-20 sm:pt-28 md:pt-36 pb-8 bg-contain bg-center bg-no-repeat text-center"
          style={{
            backgroundImage: `url('/uploads/jaba/Group-90.webp')`,
          }}
        >
          <div className="max-w-2xl mx-auto space-y-4 relative z-10 py-4">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-black text-[#840037] tracking-tight leading-tight"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              The party<br />
              Starts Here!
            </h2>

            <p className="text-gray-600 text-xs sm:text-sm md:text-base leading-relaxed px-2">
              Happy Hour Jaba is a vibrant, fusion-inspired beverage designed to keep the energy high and the good times flowing. Combining crisp, natural ingredients with a lively kick, it’s the drink of choice for those who define the party.
            </p>

            {/* "Our Flavours" Brush Banner */}
            <div id="our-flavours" className="pt-6 flex justify-center scroll-mt-28">
              <img
                src="/uploads/jaba/Group-89.webp"
                alt="Our Flavours"
                className="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-sm"
              />
            </div>
          </div>
        </section>

        {/* 3. OUR FLAVOURS PRODUCT GRID (Site-Standard Left-Aligned Card Grid) */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-5"
            style={{ gridAutoRows: '1fr' }}
          >
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={getQuantity(product.id)}
                onAdd={(variantId) => addToCart(product.id, variantId)}
                onIncrement={() => incrementItem(product.id)}
                onDecrement={() => decrementItem(product.id)}
              />
            ))}
          </div>
        </section>

        {/* 4. FULL-WIDTH END-TO-END VIMEO BACKGROUND VIDEO SECTION */}
        <section className="relative w-full overflow-hidden aspect-[16/9] sm:aspect-[21/9] min-h-[300px] sm:min-h-[420px] md:min-h-[520px] bg-black flex items-center justify-center shadow-2xl">
          {/* Vimeo Background Video Iframe */}
          <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden flex items-center justify-center">
            <iframe
              src="https://player.vimeo.com/video/1220167551?autoplay=1&loop=1&muted=1&background=1&autopause=0&controls=0&playsinline=1&transparent=0"
              className="w-full h-full object-cover scale-[1.03]"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100vw',
                height: '56.25vw',
                minHeight: '100%',
                minWidth: '177.77vh',
                border: 0,
              }}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title="HAPPY HOUR JABA"
            />
          </div>

          {/* Dark Scrim / Overlay */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />

          {/* Overlay Content with #myhappyhour254 Badge */}
          <div className="relative z-10 text-center px-4 space-y-3 pointer-events-none">
            <div className="flex justify-center items-center">
              <div className="inline-flex items-center gap-2 bg-[#840037]/85 backdrop-blur-md border border-white/25 px-6 sm:px-8 py-2.5 rounded-full shadow-[0_6px_30px_rgba(0,0,0,0.8)]">
                <span className="text-white text-lg sm:text-2xl md:text-3xl font-black tracking-tight uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  #myhappyhour254
                </span>
              </div>
            </div>
            <p className="text-white text-xs sm:text-sm md:text-base font-bold uppercase tracking-widest drop-shadow-md">
              Share Your Energy • Tag @my.happyhour
            </p>
          </div>
        </section>

        {/* 5. RELATED PRODUCTS SECTION (Non-Jaba Site Products) */}
        <section className="max-w-7xl mx-auto px-4 md:px-8 space-y-5 pt-2">
          <h2
            className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Related products
          </h2>

          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-5"
            style={{ gridAutoRows: '1fr' }}
          >
            {displayRelated.map((product) => (
              <ProductCard
                key={`rel_${product.id}`}
                product={product}
                quantity={getQuantity(product.id)}
                onAdd={(variantId) => addToCart(product.id, variantId)}
                onIncrement={() => incrementItem(product.id)}
                onDecrement={() => decrementItem(product.id)}
              />
            ))}
          </div>
        </section>
      </main>

      <Footer />
      <BottomNav cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} onOpenCart={() => setShowCheckout(true)} />
      
      <FloatingCheckout cart={cart} products={effectiveProducts} onCheckout={() => setShowCheckout(true)} hidden={showCheckout} />
      
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          products={effectiveProducts}
          user={user}
          locationData={{ text: user?.landmark || 'Nairobi' }}
          onClose={() => setShowCheckout(false)}
          onOrderSuccess={handleOrderSuccess}
          onRemoveItem={removeItem}
          onCompleteProfile={completeProfileAtCheckout}
          onLookupPhone={lookupPhone}
          onUpdateLocation={async (updates) => {
            await updateProfile(updates);
          }}
        />
      )}
      
      {orderSuccess && <OrderSuccess order={orderSuccess} onNewOrder={() => setOrderSuccess(null)} onUpdateEmail={updateEmail} />}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ProductCard from '@/components/ProductCard';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';

export default function BrandView({ brand, initialProducts = [] }) {
  const { cart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity, products: allProducts, setProducts } = useCart();
  const { user, completeProfileAtCheckout, lookupPhone, updateProfile, updateEmail } = useAuth();
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0 && setProducts) {
      setProducts((prev) => (prev && prev.length > 0 ? prev : initialProducts));
    }
  }, [initialProducts, setProducts]);

  const effectiveProducts = (allProducts && allProducts.length > 0) ? allProducts : initialProducts;

  const handleOrderSuccess = (order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    clearCart();
  };

  const brandBanner = brand?.banner || null;
  const brandLogo = brand?.image || brand?.logo || null;

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <Header cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} onOpenCart={() => setShowCheckout(true)} user={user} />
      
      <main className="flex-1 px-4 md:px-8 max-w-7xl mx-auto space-y-6 pt-[115px] md:pt-[84px] w-full pb-12">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center gap-4">
          <Link href="/brands" className="text-[#840037] text-xs md:text-sm hover:underline font-bold flex items-center gap-1.5 transition-colors">
            <span>←</span> Back to All Brands
          </Link>
        </div>
        
        {/* Featured Brand Hero Banner with Image Overlay */}
        <div className="relative w-full rounded-3xl overflow-hidden shadow-lg mb-8 border border-gray-200/80 bg-gray-950 group min-h-[200px] sm:min-h-[240px] md:min-h-[280px] flex items-end">
          {brandBanner ? (
            <>
              <img
                src={brandBanner}
                alt={`${brand.name} banner`}
                className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.88] group-hover:scale-105 transition-transform duration-700"
              />
              {/* Dual Dark Gradient Overlay for Maximum Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${brand.color || '#840037'} 0%, #300010 50%, #191c1d 100%)`
              }}
            />
          )}

          {/* Brand Identity Overlay inside Banner */}
          <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col sm:flex-row sm:items-end gap-4 md:gap-6 w-full">
            {/* Brand Logo Avatar Badge */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden border-2 border-white/60 shadow-2xl bg-white p-1.5">
              {brandLogo ? (
                <img src={brandLogo} alt={brand.name} className="w-full h-full object-contain" />
              ) : (
                <span
                  className="text-white font-black text-2xl md:text-3xl uppercase tracking-wider w-full h-full flex items-center justify-center rounded-xl"
                  style={{ backgroundColor: brand.color || '#840037' }}
                >
                  {brand.name ? brand.name.substring(0, 2) : 'B'}
                </span>
              )}
            </div>

            {/* Brand Title & Story */}
            <div className="text-white space-y-1 sm:space-y-1.5 flex-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white/90 border border-white/20">
                Official Brand Collection
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-md text-white">
                {brand.name}
              </h1>
              {brand.description ? (
                <p className="text-xs sm:text-sm text-gray-200 max-w-2xl line-clamp-2 leading-relaxed drop-shadow">
                  {brand.description}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-gray-300 drop-shadow">
                  Explore authentic {brand.name} drinks. Chilled and delivered to your doorstep in 20 minutes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-5" style={{ gridAutoRows: '1fr' }}>
          {initialProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getQuantity(product.id)}
              onAdd={(variantId) => addToCart(product.id, variantId)}
              onIncrement={() => incrementItem(product.id)}
              onDecrement={() => decrementItem(product.id)}
            />
          ))}
          {initialProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-500 text-sm bg-gray-50 rounded-2xl border border-gray-100">
              No active products found for this brand.
            </div>
          )}
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

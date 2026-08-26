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

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      <Header cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} onOpenCart={() => setShowCheckout(true)} user={user} />
      
      <main className="flex-1 px-4 md:px-8 max-w-7xl mx-auto space-y-6 pt-[115px] md:pt-[84px] w-full pb-12">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/brands" className="text-[#840037] text-sm hover:underline font-semibold flex items-center gap-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <span>←</span> All Brands
          </Link>
        </div>
        
        <div className="flex items-center gap-4 mb-8 p-4 rounded-xl shadow-sm border" style={{ borderColor: '#E9ECEF', backgroundColor: '#F1F3F5' }}>
          <div className="w-20 h-20 rounded-full flex flex-shrink-0 items-center justify-center shadow-inner overflow-hidden border bg-white" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
            {brand.image ? (
              <img src={brand.image} alt={brand.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-2xl uppercase" style={{ backgroundColor: brand.color || '#840037' }}>
                {brand.name ? brand.name.substring(0, 2) : 'B'}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#191c1d]" style={{ fontFamily: 'Montserrat, sans-serif' }}>{brand.name}</h1>
            {brand.description && <p className="text-xs text-[#5f5e5e] mt-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>{brand.description}</p>}
          </div>
        </div>

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
            <div className="col-span-full py-12 text-center text-gray-500 text-sm">
              No products found for this brand.
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

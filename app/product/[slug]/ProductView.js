'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { haptic } from '@/lib/haptic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import ShareButton from '@/components/ShareButton';
import ProductCard from '@/components/ProductCard';

export default function ProductView({ product, brand, relatedProducts = [] }) {
  const { cart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity, products: allProducts } = useCart();
  const { user, completeProfileAtCheckout, lookupPhone, updateProfile, updateEmail } = useAuth();

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const isVariable = product.type === 'variable' && product.variations?.length > 0;
  const effectivePrice = selectedVariant ? parseFloat(selectedVariant.price) || product.price : product.price;
  const outOfStock = isVariable
    ? (selectedVariant ? selectedVariant.stockStatus !== 'instock' : product.stockStatus === 'outofstock' || product.inStock === false)
    : (product.stockStatus === 'outofstock' || product.inStock === false || product.stockQty === 0);

  const currentQty = getQuantity(product.id);

  // Group variations by attribute name
  const variantGroups = {};
  if (isVariable) {
    for (const v of product.variations) {
      for (const attr of v.attributes) {
        if (!variantGroups[attr.name]) variantGroups[attr.name] = [];
        if (!variantGroups[attr.name].find((o) => o.value === attr.value)) {
          variantGroups[attr.name].push({ value: attr.value, variant: v });
        }
      }
    }
  }

  const handleVariantSelect = (variant) => {
    haptic('light');
    setSelectedVariant(variant);
  };

  const handleAddToCart = () => {
    if (outOfStock) return;
    haptic('medium');
    if (isVariable && !selectedVariant) return;
    addToCart(product.id, selectedVariant?.wcId || null);
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    haptic('medium');
    if (isVariable && !selectedVariant) return;
    if (currentQty === 0) {
      addToCart(product.id, selectedVariant?.wcId || null);
    }
    setShowCheckout(true);
  };

  const handleOrderSuccess = (order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    clearCart();
  };

  const effectiveProducts = (allProducts && allProducts.length > 0) ? allProducts : [product, ...relatedProducts];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <Header
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenCart={() => setShowCheckout(true)}
        user={user}
      />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 md:px-8 pt-4 md:pt-6 pb-16">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6 flex-wrap">
          <Link href="/" className="hover:text-[#840037] font-semibold transition-colors">
            Store
          </Link>
          <span>/</span>
          {brand && (
            <>
              <Link href={`/brands/${brand.slug || brand.id}`} className="hover:text-[#840037] font-semibold transition-colors">
                {brand.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 font-bold truncate max-w-[200px] sm:max-w-none">
            {product.name}
          </span>
        </div>

        {/* Main Product Showcase Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
          {/* Left: Product Image Showcase */}
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center">
            {product.image ? (
              <Image
                src={selectedVariant?.image || product.image}
                alt={product.name}
                fill
                priority
                className={`object-contain p-4 sm:p-6 transition-all duration-300 ${outOfStock ? 'grayscale opacity-60' : ''}`}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="text-6xl">🍹</div>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              {product.fast6 && (
                <span className="bg-[#840037] text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow-md tracking-wider uppercase">
                  ⚡ FAST 6
                </span>
              )}
              {outOfStock && (
                <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                  OUT OF STOCK
                </span>
              )}
            </div>
          </div>

          {/* Right: Product Details & Purchase Actions */}
          <div className="flex flex-col h-full space-y-6">
            <div>
              {brand && (
                <Link
                  href={`/brands/${brand.slug || brand.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-[#840037] bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-full mb-3 transition-colors"
                >
                  <span>Brand:</span>
                  <span className="underline">{brand.name}</span>
                </Link>
              )}

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
                {product.name}
              </h1>

              {product.shortDescription && (
                <div
                  className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: product.shortDescription }}
                />
              )}
            </div>

            {/* Price Tag & Delivery Guarantee */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-xs text-gray-500 font-semibold block">Price</span>
                <span className="text-2xl sm:text-3xl font-black text-[#840037]">
                  KSh {Number(effectivePrice).toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {outOfStock ? 'Restocking Soon' : 'In Stock & Ready'}
                </span>
                <span className="text-[11px] text-gray-400 block mt-1">20-min Nairobi Delivery</span>
              </div>
            </div>

            {/* Variable Attribute Selectors */}
            {isVariable && Object.entries(variantGroups).map(([attrName, options]) => (
              <div key={attrName} className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Select {attrName}
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => {
                    const isActive = selectedVariant?.attributes?.some(
                      (a) => a.name === attrName && a.value === opt.value
                    );
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleVariantSelect(opt.variant)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          isActive
                            ? 'bg-[#840037] text-white border-[#840037] shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opt.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Add to Cart / Buy Now CTAs */}
            <div className="space-y-3 pt-2">
              {outOfStock ? (
                <div className="w-full py-4 rounded-2xl bg-gray-100 text-gray-400 font-bold text-center text-sm">
                  Currently Out of Stock
                </div>
              ) : currentQty === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={isVariable && !selectedVariant}
                    className="w-full py-3.5 px-6 rounded-2xl border-2 border-[#840037] text-[#840037] font-bold text-sm hover:bg-[#840037] hover:text-white active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isVariable && !selectedVariant ? 'Select Option First' : 'Add to Cart'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={isVariable && !selectedVariant}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#840037] hover:bg-[#5b0024] text-white font-bold text-sm active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Instant Checkout</span>
                    <span>→</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 rounded-2xl bg-[#840037] text-white">
                    <button
                      onClick={() => decrementItem(product.id)}
                      className="w-12 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <div className="text-center font-bold">
                      <span className="text-xs uppercase tracking-wider block opacity-80">In Cart</span>
                      <span className="text-lg">{currentQty}</span>
                    </div>
                    <button
                      onClick={() => incrementItem(product.id)}
                      className="w-12 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xl font-bold flex items-center justify-center active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#191c1d] hover:bg-black text-white font-bold text-sm active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Checkout</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Social Share Bar */}
            <div className="pt-4 border-t border-gray-100">
              <ShareButton product={product} variant="bar" />
            </div>
          </div>
        </div>

        {/* Product Full Description (if available) */}
        {product.description && (
          <div className="mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-sm">
            <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-wider mb-3">
              About This Drink
            </h2>
            <div
              className="prose prose-sm max-w-none text-gray-600 leading-relaxed wp-content-rendered"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        )}

        {/* Related / More from Brand Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 uppercase tracking-tight">
                You May Also Like
              </h2>
              {brand && (
                <Link
                  href={`/brands/${brand.slug || brand.id}`}
                  className="text-xs font-bold text-[#840037] hover:underline"
                >
                  View all {brand.name} →
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {relatedProducts.map((relProduct) => (
                <ProductCard
                  key={relProduct.id}
                  product={relProduct}
                  quantity={getQuantity(relProduct.id)}
                  onAdd={(variantId) => addToCart(relProduct.id, variantId)}
                  onIncrement={() => incrementItem(relProduct.id)}
                  onDecrement={() => decrementItem(relProduct.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
      <BottomNav
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenCart={() => setShowCheckout(true)}
      />

      <FloatingCheckout
        cart={cart}
        products={effectiveProducts}
        onCheckout={() => setShowCheckout(true)}
        hidden={showCheckout}
      />

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

      {orderSuccess && (
        <OrderSuccess
          order={orderSuccess}
          onNewOrder={() => setOrderSuccess(null)}
          onUpdateEmail={updateEmail}
        />
      )}
    </div>
  );
}


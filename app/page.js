'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import Header from '@/components/Header';
import CategoryDock from '@/components/CategoryDock';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import BrandsBar from '@/components/BrandsBar';
import { PRODUCTS as FALLBACK_PRODUCTS, BRANDS as FALLBACK_BRANDS } from '@/lib/products';

function AppShell() {
  const { user, phase, phone, lookupPhone, completeProfileAtCheckout, updateProfile, updateEmail } = useAuth();
  const [location, setLocation] = useState(null);
  const [activeCategory, setActiveCategory] = useState('fast6');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [syncedProducts, setSyncedProducts] = useState([]);
  const [syncedBrands, setSyncedBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [upsellPopup, setUpsellPopup] = useState(null);
  const [appLoaded, setAppLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('order');
    if (paymentStatus === 'success' && orderId) {
      setOrderSuccess({ id: orderId, status: 'processing' });
      setCart([]);
      window.history.replaceState({}, '', '/');
    } else if (paymentStatus === 'failed') {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.products && data.products.length > 0) {
          setSyncedProducts(data.products.map((p) => {
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
          }));
          if (data.brands && data.brands.length > 0) {
            setSyncedBrands(data.brands.map((b) => ({
              id: b.wcId || b.id,
              name: b.name,
              logo: b.image || null,
              color: b.color || '#840037',
              visible: b.visible !== false,
            })));
          }
        }
      })
      .catch(() => {})
      .finally(() => setAppLoaded(true));
  }, []);

  useEffect(() => {
    if (phase === 'authenticated' && user?.zone) {
      setShowLocationPrompt(true);
    }
  }, [phase, user?.zone]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        queueMicrotask(() => {
          setShowOutOfStock(data.showOutOfStock !== false);
        });
      })
      .catch(() => {});
  }, []);

  const PRODUCTS = syncedProducts.length > 0 ? syncedProducts : FALLBACK_PRODUCTS;
  const BRANDS = (syncedBrands.length > 0 ? syncedBrands : FALLBACK_BRANDS).filter((b) => b.visible !== false);

  const displayedProducts = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      let filtered = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
      if (!showOutOfStock) {
        filtered = filtered.filter((p) => p.inStock !== false);
      }
      return filtered;
    }

    let filtered = PRODUCTS;

    if (selectedBrand) {
      filtered = filtered.filter((p) => p.brand === selectedBrand);
    } else if (activeCategory === 'fast6') {
      filtered = filtered.filter((p) => p.inStock !== false)
        .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
        .slice(0, 6);
    } else {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }

    if (!showOutOfStock) {
      filtered = filtered.filter((p) => p.inStock !== false);
    }

    return filtered;
  }, [activeCategory, selectedBrand, showOutOfStock, searchQuery, PRODUCTS]);

  const addToCart = useCallback((productId, variantId = null) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const exists = prev.find((i) => i.id === productId);
      if (exists) return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1, variantId: variantId || i.variantId } : i);
      return [...prev, { id: productId, variantId, quantity: 1 }];
    });

    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product?.upsellIds?.length) return;

    const upsellProducts = product.upsellIds
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p) => p && p.inStock !== false);

    if (upsellProducts.length > 0) {
      setTimeout(() => {
        queueMicrotask(() => setUpsellPopup({ product, upsellProducts }));
      }, 300);
    }
  }, [PRODUCTS]);

  const incrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i));
  }, []);

  const decrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
  }, []);

  const removeItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => prev.filter((i) => i.id !== productId));

    if (typeof window !== 'undefined') {
      const shown = JSON.parse(localStorage.getItem('upsells_shown') || '[]');
      const updated = shown.filter((id) => id !== productId);
      localStorage.setItem('upsells_shown', JSON.stringify(updated));
    }
  }, []);

  const getQuantity = useCallback((productId) => cart.find((i) => i.id === productId)?.quantity || 0, [cart]);

  const handleOrderSuccess = useCallback((order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    setCart([]);
  }, []);

  const handleNewOrder = useCallback(() => {
    setOrderSuccess(null);
    setActiveCategory('fast6');
  }, []);

  const effectiveLocation = location || (user?.landmark ? { text: user.landmark, lat: null, lng: null } : null);

  if (phase === 'loading' || !appLoaded) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <Header
        location={effectiveLocation}
        onLocationSet={setLocation}
        onSearch={setSearchQuery}
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenCart={() => setShowCheckout(true)}
      />
      <main className="px-4 md:px-8 max-w-7xl mx-auto space-y-3 pt-[115px] md:pt-[84px]">
        {/* Featured Slides Carousel */}
        <FeaturedCarousel products={PRODUCTS} onAddToCart={(id) => addToCart(id)} />

        {/* Popular Brands */}
        <BrandsBar
          brands={BRANDS}
          selectedBrand={selectedBrand}
          onSelectBrand={(name) => {
            if (selectedBrand === name) {
              setSelectedBrand(null);
            } else {
              setSelectedBrand(name);
              setActiveCategory('fast6');
            }
          }}
          onClearBrand={() => setSelectedBrand(null)}
        />

        {/* Categories */}
        <CategoryDock
          activeCategory={activeCategory}
          onCategoryChange={(cat) => { setActiveCategory(cat); setSelectedBrand(null); }}
          products={PRODUCTS}
        />

        {/* Product Grid */}
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 lg:gap-5 pb-12" style={{ gridAutoRows: '1fr' }}>
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getQuantity(product.id)}
              onAdd={(variantId) => addToCart(product.id, variantId)}
              onIncrement={() => incrementItem(product.id)}
              onDecrement={() => decrementItem(product.id)}
            />
          ))}
        </section>
        {displayedProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>No products in this category</p>
          </div>
        )}
      </main>

      {/* Floating Checkout Pill */}
      <FloatingCheckout cart={cart} products={PRODUCTS} onCheckout={() => setShowCheckout(true)} hidden={showCheckout} />

      {/* Bottom Navigation */}
      <BottomNav cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} onOpenCart={() => setShowCheckout(true)} />

      {/* Modals */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          products={PRODUCTS}
          user={user}
          locationData={effectiveLocation || { text: 'Nairobi', lat: null, lng: null }}
          onClose={() => setShowCheckout(false)}
          onOrderSuccess={handleOrderSuccess}
          onRemoveItem={removeItem}
          onCompleteProfile={completeProfileAtCheckout}
          onLookupPhone={lookupPhone}
          onUpdateLocation={async (updates) => {
            await updateProfile(updates);
            setLocation({ text: updates.landmark, lat: null, lng: null });
          }}
        />
      )}
      {orderSuccess && <OrderSuccess order={orderSuccess} onNewOrder={handleNewOrder} onUpdateEmail={updateEmail} />}
      {upsellPopup && (
        <UpsellPopup
          product={upsellPopup.product}
          upsellProducts={upsellPopup.upsellProducts}
          onAddToCart={addToCart}
          onDismiss={() => {
            queueMicrotask(() => setUpsellPopup(null));
          }}
        />
      )}
      {showLocationPrompt && (
        <LocationPrompt
          onDismiss={() => setShowLocationPrompt(false)}
          onUpdate={async (updates) => {
            await updateProfile(updates);
            setLocation({ text: updates.landmark, lat: null, lng: null });
          }}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

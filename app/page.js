'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import PhoneEntry from '@/components/PhoneEntry';
import ProfileSetup from '@/components/ProfileSetup';
import Header from '@/components/Header';
import CategoryDock from '@/components/CategoryDock';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import UpsellPopup from '@/components/UpsellPopup';
import LocationPrompt from '@/components/LocationPrompt';
import { PRODUCTS as FALLBACK_PRODUCTS, BRANDS as FALLBACK_BRANDS } from '@/lib/products';

function AppShell() {
  const { user, phase, phone, submitPhone, completeProfile, resetToEntry, updateProfile } = useAuth();
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
              price: parseFloat(p.price) || 0,
              originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
              image: p.image,
              category: catSlug,
              fast6: false,
              inStock: p.stockStatus === 'instock',
              stockQty: p.stockQuantity ?? 99,
              brand: p.brandName || '',
              sku: p.sku || '',
              size: p.shortDescription?.replace(/<[^>]*>/g, '').trim() || '',
              upsellIds: p.upsellIds || [],
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
      filtered = filtered.filter((p) => p.inStock !== false).slice(0, 6);
    } else {
      filtered = filtered.filter((p) => p.category === activeCategory);
    }

    if (!showOutOfStock) {
      filtered = filtered.filter((p) => p.inStock !== false);
    }

    return filtered;
  }, [activeCategory, selectedBrand, showOutOfStock, searchQuery, PRODUCTS]);

  const addToCart = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const exists = prev.find((i) => i.id === productId);
      if (exists) return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: productId, quantity: 1 }];
    });

    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product?.upsellIds?.length) return;

    if (typeof window !== 'undefined') {
      const shown = JSON.parse(localStorage.getItem('upsells_shown') || '[]');
      if (shown.includes(productId)) return;

      const upsellProducts = product.upsellIds
        .map((id) => PRODUCTS.find((p) => p.id === id))
        .filter((p) => p && p.inStock !== false);

      if (upsellProducts.length > 0) {
        setTimeout(() => {
          queueMicrotask(() => setUpsellPopup({ product, upsellProducts }));
        }, 300);
      }
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
        <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(132,0,55,0.1)' }}>
          <svg className="w-8 h-8" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 2l.01 4.5c0 1.1.89 2 2 2h1v11c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V8.5h1c1.1 0 2-.9 2-2V2H6zm2.5 2h7v2.5h-7V4zM8 17v-5h8v5H8zm8-7H8V8h8v2z"/>
          </svg>
        </div>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
      </div>
    );
  }

  if (phase === 'entry') {
    return <PhoneEntry onSubmit={submitPhone} />;
  }

  if (phase === 'profile_setup') {
    return <ProfileSetup phone={phone} onSubmit={completeProfile} onBack={resetToEntry} />;
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      <Header location={effectiveLocation} onLocationSet={setLocation} onSearch={setSearchQuery} />
      <main className="px-4 max-w-7xl mx-auto space-y-1 pt-[110px]">
        {/* Popular Brands */}
        <section className="space-y-1 bg-gray-50 border border-gray-100" style={{ padding: '8px 12px', borderRadius: '0.75rem' }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { setSelectedBrand(null); setActiveCategory('fast6'); }} className="text-[11px] tracking-widest uppercase font-bold hover:opacity-70 transition-opacity" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
              {selectedBrand ? `Filtering: ${selectedBrand}` : 'Popular Brands'}
            </button>
            {selectedBrand && (
              <button onClick={() => setSelectedBrand(null)} className="text-[10px] font-semibold underline" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                Clear
              </button>
            )}
            <div className="h-[1px] flex-grow ml-4" style={{ backgroundColor: '#840037', opacity: 0.2 }} />
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar py-1">
            {BRANDS.map((brand) => {
              const isSelected = selectedBrand === brand.name;
              return (
                <button
                  key={brand.id}
                  onClick={() => {
                    if (selectedBrand === brand.name) {
                      setSelectedBrand(null);
                    } else {
                      setSelectedBrand(brand.name);
                      setActiveCategory('fast6');
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 min-w-[64px] transition-all active:scale-95"
                >
                  <div
                    className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center transition-all overflow-hidden p-1"
                    style={{ border: isSelected ? '2.5px solid #840037' : '1px solid #e5e7eb' }}
                  >
                    {brand.logo ? (
                      <img alt={`${brand.name} Logo`} className="w-full h-full object-contain" src={brand.logo} />
                    ) : (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: brand.color || '#840037', fontFamily: 'Montserrat, sans-serif' }}
                      >
                        {brand.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: isSelected ? 700 : 500 }}>{brand.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        <CategoryDock
          activeCategory={activeCategory}
          onCategoryChange={(cat) => { setActiveCategory(cat); setSelectedBrand(null); }}
          products={PRODUCTS}
          className="-mt-1"
        />

        {/* Product Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-8" style={{ gridAutoRows: '1fr' }}>
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getQuantity(product.id)}
              onAdd={() => addToCart(product.id)}
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
      <BottomNav cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)} />

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
        />
      )}
      {orderSuccess && <OrderSuccess order={orderSuccess} onNewOrder={handleNewOrder} />}
      {upsellPopup && (
        <UpsellPopup
          product={upsellPopup.product}
          upsellProducts={upsellPopup.upsellProducts}
          onAddToCart={addToCart}
          onDismiss={() => {
            if (typeof window !== 'undefined') {
              const shown = JSON.parse(localStorage.getItem('upsells_shown') || '[]');
              shown.push(upsellPopup.product.id);
              localStorage.setItem('upsells_shown', JSON.stringify(shown));
            }
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

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import PhoneEntry from '@/components/PhoneEntry';
import ProfileSetup from '@/components/ProfileSetup';
import Header from '@/components/Header';
import CategoryDock from '@/components/CategoryDock';
import ProductCard from '@/components/ProductCard';
import ActionBar from '@/components/ActionBar';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import { PRODUCTS as FALLBACK_PRODUCTS, BRANDS as FALLBACK_BRANDS } from '@/lib/products';

function AppShell() {
  const { user, phase, phone, submitPhone, completeProfile } = useAuth();
  const [location, setLocation] = useState(null);
  const [activeCategory, setActiveCategory] = useState('fast6');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [syncedProducts, setSyncedProducts] = useState([]);
  const [syncedBrands, setSyncedBrands] = useState([]);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.products && data.products.length > 0) {
          setSyncedProducts(data.products.map((p) => ({
            id: p.wcId,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price) || 0,
            originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
            image: p.image,
            category: p.categoryName?.toLowerCase().replace(/\s+/g, '') || '',
            fast6: p.categoryName?.toLowerCase().includes('fast') || false,
            inStock: p.stockStatus === 'instock',
            stockQty: p.stockQuantity ?? 99,
            brand: p.brandName || '',
            sku: p.sku || '',
          })));
          if (data.brands && data.brands.length > 0) {
            setSyncedBrands(data.brands.map((b) => ({
              id: b.wcId || b.id,
              name: b.name,
              logo: b.image || '/brands/default.png',
            })));
          }
        }
      })
      .catch(() => {});
  }, []);

  const PRODUCTS = syncedProducts.length > 0 ? syncedProducts : FALLBACK_PRODUCTS;
  const BRANDS = syncedBrands.length > 0 ? syncedBrands : FALLBACK_BRANDS;

  const displayedProducts = useMemo(() =>
    PRODUCTS.filter((p) => activeCategory === 'fast6' ? p.fast6 : p.category === activeCategory),
    [activeCategory, PRODUCTS]
  );

  const addToCart = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const exists = prev.find((i) => i.id === productId);
      if (exists) return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: productId, quantity: 1 }];
    });
  }, []);

  const incrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i));
  }, []);

  const decrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0));
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

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#f5f5dc' }}>
        <div className="text-5xl">🍹</div>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
      </div>
    );
  }

  if (phase === 'entry') {
    return <PhoneEntry onSubmit={submitPhone} />;
  }

  if (phase === 'profile_setup') {
    return <ProfileSetup phone={phone} onSubmit={completeProfile} onBack={() => submitPhone(phone)} />;
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: '#f5f5dc' }}>
      <Header location={effectiveLocation} onLocationSet={setLocation} />
      <main className="px-4 max-w-7xl mx-auto space-y-3 pt-[104px]">
        <section className="space-y-1 mt-4" style={{ backgroundColor: 'rgba(132, 0, 55, 0.06)', padding: '8px 12px', borderRadius: '0.75rem' }}>
          <h2 className="text-[11px] tracking-widest uppercase" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Popular Brands</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar py-1">
            {BRANDS.map((brand) => (
              <div key={brand.id} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                <div className="w-14 h-14 rounded-full border flex items-center justify-center ambient-shadow transition-transform hover:scale-105 overflow-hidden p-1" style={{ backgroundColor: '#f5f5dc', borderColor: '#E9ECEF' }}>
                  <img alt={`${brand.name} Logo`} className="w-full h-full object-contain" src={brand.logo} />
                </div>
                <span className="text-[10px]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>{brand.name}</span>
              </div>
            ))}
          </div>
        </section>
        <CategoryDock activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-8">
          {displayedProducts.map((product) => (
            <ProductCard key={product.id} product={product} quantity={getQuantity(product.id)} onAdd={() => addToCart(product.id)} onIncrement={() => incrementItem(product.id)} onDecrement={() => decrementItem(product.id)} />
          ))}
        </section>
        {displayedProducts.length === 0 && <div className="text-center py-16"><p className="text-sm" style={{ color: '#5f5e5e' }}>No products in this category</p></div>}
      </main>
      <ActionBar cart={cart} products={PRODUCTS} onCheckout={() => setShowCheckout(true)} />
      {showCheckout && <CheckoutModal cart={cart} products={PRODUCTS} user={user} locationData={effectiveLocation || { text: 'Nairobi', lat: null, lng: null }} onClose={() => setShowCheckout(false)} onOrderSuccess={handleOrderSuccess} />}
      {orderSuccess && <OrderSuccess order={orderSuccess} onNewOrder={handleNewOrder} />}
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

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import Header from '@/components/Header';
import CategoryDock from '@/components/CategoryDock';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import FloatingCheckout from '@/components/FloatingCheckout';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import BrandsBar from '@/components/BrandsBar';
import AccountModal from '@/components/AccountModal';
import LocationModal from '@/components/LocationModal';
import LocationPrompt from '@/components/LocationPrompt';
import UpsellPopup from '@/components/UpsellPopup';
import Footer from '@/components/Footer';

function AppShell() {
  const { user, phase, lookupPhone, completeProfileAtCheckout, updateProfile, updateEmail } = useAuth();
  const [location, setLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('fast6');
  const { cart, setCart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity, setProducts, upsellPopup, setUpsellPopup } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [syncedProducts, setSyncedProducts] = useState([]);
  const [syncedBrands, setSyncedBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
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
  }, [setCart]);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.showOutOfStock !== undefined) {
          setShowOutOfStock(data.showOutOfStock !== false);
        }
        if (data.products && data.products.length > 0) {
          setSyncedProducts(data.products.map((p) => {
            const catName = p.categoryName || '';
            const catSlug = catName.toLowerCase()
              .replace(/['']/g, '')
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '')
              .replace(/-+/g, '-');
            
            const isInstock = p.stockStatus === 'instock' && (
              p.stockQuantity === null ||
              p.stockQuantity === undefined ||
              p.stockQuantity === '' ||
              Number(p.stockQuantity) > 0 ||
              p.type === 'variable'
            );

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
              inStock: isInstock,
              stockQty: p.stockQuantity ?? (isInstock ? 99 : 0),
              brand: p.brandName || '',
              brandId: p.brandId || null,
              sku: p.sku || '',
              size: p.shortDescription?.replace(/<[^>]*>/g, '').trim() || '',
              upsellIds: p.upsellIds || [],
              totalSales: p.totalSales || 0,
              attributes: p.attributes || [],
              variations: p.variations || [],
            };
          }));
        }
        if (data.brands && data.brands.length > 0) {
          setSyncedBrands(data.brands.map((b) => ({
            id: b.wcId || b.id,
            name: b.name,
            logo: b.image || b.logo || null,
            banner: b.banner || null,
            color: b.color || '#840037',
            visible: b.visible !== false,
          })));
        }
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
      })
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
          if (data.showOutOfStock !== undefined) {
            setShowOutOfStock(data.showOutOfStock !== false);
          }
        });
      })
      .catch(() => {});
  }, []);

  const PRODUCTS = syncedProducts;

  useEffect(() => {
    setProducts(PRODUCTS);
  }, [PRODUCTS, setProducts]);

  const BRANDS = useMemo(() => {
    const raw = syncedBrands.filter((b) => b.visible !== false);
    return raw
      .map((b) => {
        const bName = (b.name || '').toLowerCase().trim();
        const bId = String(b.id || b.wcId || '');
        const matchingProduct = PRODUCTS.find((p) => {
          if (!showOutOfStock && p.inStock === false) return false;
          const pBrand = (p.brand || '').toLowerCase().trim();
          const pBrandId = String(p.brandId || '');
          return pBrand === bName || pBrandId === bId || (bName && pBrand.includes(bName));
        });

        const logo = b.logo || b.image || matchingProduct?.image || null;

        return {
          ...b,
          logo,
          hasProduct: !!matchingProduct,
        };
      })
      .filter((b) => b.hasProduct);
  }, [syncedBrands, PRODUCTS, showOutOfStock]);

  const displayedProducts = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      let filtered = PRODUCTS.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));
      if (!showOutOfStock) {
        filtered = filtered.filter((p) => p.inStock !== false);
      }
      return filtered;
    }

    let filtered = PRODUCTS;

    if (selectedBrand) {
      const bName = selectedBrand.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const pBrand = (p.brand || '').toLowerCase().trim();
        return pBrand === bName || pBrand.includes(bName);
      });
    } else if (activeCategory === 'fast6') {
      filtered = filtered.filter((p) => p.inStock !== false)
        .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
        .slice(0, 6);
    } else {
      const catKey = activeCategory.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const pCat = (p.category || '').toLowerCase().trim();
        const pCatName = (p.categoryName || '').toLowerCase().trim();
        return pCat === catKey || pCatName === catKey || (pCat && catKey && (pCat.includes(catKey) || catKey.includes(pCat)));
      });
    }

    if (!showOutOfStock) {
      filtered = filtered.filter((p) => p.inStock !== false);
    }

    return filtered;
  }, [activeCategory, selectedBrand, showOutOfStock, searchQuery, PRODUCTS]);

  const handleOrderSuccess = useCallback((order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    clearCart();
  }, [clearCart]);

  const handleReorder = useCallback((items) => {
    if (!items || !Array.isArray(items)) return;
    for (const item of items) {
      const prod = PRODUCTS.find(
        (p) => String(p.id) === String(item.productId) || String(p.wcId) === String(item.productId) || p.name.toLowerCase() === (item.name || '').toLowerCase()
      );
      if (prod) {
        const quantity = item.quantity || 1;
        for (let i = 0; i < quantity; i++) {
          addToCart(prod.id);
        }
      }
    }
    setShowAccountModal(false);
    setShowCheckout(true);
  }, [PRODUCTS, addToCart]);

  const effectiveLocation = location || (user?.landmark ? { text: user.landmark, lat: null, lng: null } : null);

  if (phase === 'loading' || !appLoaded) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      <Header
        location={effectiveLocation}
        onLocationSet={() => setShowLocationModal(true)}
        onSearch={setSearchQuery}
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenCart={() => setShowCheckout(true)}
        onOpenAccount={() => setShowAccountModal(true)}
        user={user}
      />
      <main className="flex-1 px-4 md:px-8 max-w-7xl mx-auto space-y-3 pt-[115px] md:pt-[84px] w-full">
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
          showOutOfStock={showOutOfStock}
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

      {/* Desktop & Mobile Footer */}
      <Footer />

      {/* Floating Checkout Pill */}
      <FloatingCheckout cart={cart} products={PRODUCTS} onCheckout={() => setShowCheckout(true)} hidden={showCheckout} />

      {/* Bottom Navigation */}
      <BottomNav
        cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
        onOpenCart={() => setShowCheckout(true)}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      {/* Modals */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onReorder={handleReorder}
      />

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
      {orderSuccess && <OrderSuccess order={orderSuccess} onNewOrder={() => setOrderSuccess(null)} onUpdateEmail={updateEmail} />}
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
      {showLocationModal && (
        <LocationModal
          currentLocation={effectiveLocation}
          onConfirm={async (newLoc) => {
            setLocation(newLoc);
            if (user) {
              await updateProfile({ landmark: newLoc.text });
            }
          }}
          onClose={() => setShowLocationModal(false)}
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
  return <AppShell />;
}

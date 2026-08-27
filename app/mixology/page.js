'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import FloatingCheckout from '@/components/FloatingCheckout';
import MixologyModal from '@/components/MixologyModal';
import CheckoutModal from '@/components/CheckoutModal';
import OrderSuccess from '@/components/OrderSuccess';
import AccountModal from '@/components/AccountModal';
import AIBartenderModal from '@/components/AIBartenderModal';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

function MixologyContent() {
  const searchParams = useSearchParams();
  const { user, completeProfileAtCheckout, lookupPhone, updateProfile, updateEmail } = useAuth();
  const {
    cart,
    setCart,
    addToCart,
    removeItem,
    clearCart,
    products: cartProducts,
    setProducts: setCartProducts,
  } = useCart();

  const [recipes, setRecipes] = useState([]);
  const [syncedProducts, setSyncedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSpirit, setSelectedSpirit] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  // Modal & Checkout State
  const [selectedRecipeSlug, setSelectedRecipeSlug] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAIBartender, setShowAIBartender] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const urlRecipeSlug = searchParams.get('recipe');
  const activeRecipe = useMemo(() => {
    const slug = selectedRecipeSlug ?? urlRecipeSlug;
    if (!slug) return null;
    return recipes.find((r) => r.slug === slug || r.id === slug) || null;
  }, [selectedRecipeSlug, urlRecipeSlug, recipes]);

  // Load recipes and products
  useEffect(() => {
    Promise.all([
      fetch('/api/mixology').then((r) => r.json()),
      fetch('/api/products').then((r) => r.json()).catch(() => ({ products: [] })),
    ])
      .then(([mixData, prodData]) => {
        if (mixData.success) {
          setRecipes(mixData.recipes || []);
        }
        if (prodData.products && prodData.products.length > 0) {
          const normalized = prodData.products.map((p) => {
            const isInstock = p.stockStatus === 'instock' && (
              p.stockQuantity === null ||
              p.stockQuantity === undefined ||
              p.stockQuantity === '' ||
              Number(p.stockQuantity) > 0 ||
              p.type === 'variable'
            );
            return {
              id: Number(p.wcId || p.id),
              name: p.name,
              slug: p.slug,
              type: p.type || 'simple',
              price: parseFloat(p.price) || 0,
              originalPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
              image: p.image,
              images: p.images || [],
              brand: p.brandName || '',
              brandId: p.brandId || null,
              category: p.categoryName || '',
              inStock: isInstock,
              stockQty: p.stockQuantity ?? (isInstock ? 99 : 0),
              sku: p.sku || '',
              upsellIds: p.upsellIds || [],
            };
          });

          setSyncedProducts(normalized);
          if (setCartProducts) {
            setCartProducts(normalized);
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [setCartProducts]);

  const effectiveProducts = (cartProducts && cartProducts.length > 0) ? cartProducts : syncedProducts;

  // Distinct Brand Options with Counts
  const brandOptions = useMemo(() => {
    const counts = { all: recipes.length };
    recipes.forEach((r) => {
      const b = r.brand || 'Signature';
      counts[b] = (counts[b] || 0) + 1;
    });
    const list = ['all', ...new Set(recipes.map((r) => r.brand).filter(Boolean))];
    return { list, counts };
  }, [recipes]);

  // Distinct Spirit Base Options
  const spiritOptions = useMemo(() => {
    const counts = { all: recipes.length };
    recipes.forEach((r) => {
      const s = r.spiritType || 'Other';
      counts[s] = (counts[s] || 0) + 1;
    });
    const list = ['all', ...new Set(recipes.map((r) => r.spiritType).filter(Boolean))];
    return { list, counts };
  }, [recipes]);

  // Distinct Style Options
  const styleOptions = useMemo(() => {
    return ['all', ...new Set(recipes.map((r) => r.drinkStyle).filter(Boolean))];
  }, [recipes]);

  // Filtered List
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (selectedBrand !== 'all' && r.brand?.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      if (selectedSpirit !== 'all' && r.spiritType?.toLowerCase() !== selectedSpirit.toLowerCase()) return false;
      if (selectedStyle !== 'all' && r.drinkStyle?.toLowerCase() !== selectedStyle.toLowerCase()) return false;
      if (selectedDifficulty !== 'all' && r.difficulty?.toLowerCase() !== selectedDifficulty.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${r.title} ${r.description} ${r.brand} ${r.spiritType} ${r.drinkStyle} ${r.ingredients?.join(' ')}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [recipes, selectedBrand, selectedSpirit, selectedStyle, selectedDifficulty, searchQuery]);

  const openRecipeModal = (recipe) => {
    setSelectedRecipeSlug(recipe.slug);
    const url = new URL(window.location.href);
    url.searchParams.set('recipe', recipe.slug);
    window.history.pushState({}, '', url.toString());
  };

  const closeRecipeModal = () => {
    setSelectedRecipeSlug(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    window.history.pushState({}, '', url.toString());
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBrand('all');
    setSelectedSpirit('all');
    setSelectedStyle('all');
    setSelectedDifficulty('all');
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedBrand !== 'all' || selectedSpirit !== 'all' || selectedStyle !== 'all' || selectedDifficulty !== 'all'
  );

  const handleOrderSuccess = (order) => {
    setShowCheckout(false);
    setOrderSuccess(order);
    clearCart();
  };

  const cartTotalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const difficultyBadge = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'expert':
      case 'advanced':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200/80';
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans text-gray-900 pb-20 md:pb-0">
      <Header
        cartCount={cartTotalItems}
        onOpenCart={() => setShowCheckout(true)}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 animate-page-enter">
        {/* Hero Header Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#4a001e] via-[#840037] to-[#1c1917] p-6 sm:p-10 text-white shadow-xl animate-card-rise">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm border border-white/20">
                🍹 Happy Hour Mixology Hub
              </span>
              <span className="text-xs text-pink-200 font-medium">
                {recipes.length} Curated Cocktails
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
              Elevate Your Glass From Ordinary to Iconic
            </h1>
            <p className="text-xs sm:text-sm text-pink-100/80 max-w-lg leading-relaxed">
              Explore step-by-step master cocktail recipes with precise measurements, barware specs, and single-click spirit purchasing.
            </p>

            {/* AI Mixologist CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAIBartender(true)}
                className="px-4 py-2.5 rounded-2xl bg-white text-[#840038] hover:bg-pink-50 font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg flex items-center gap-2"
              >
                <span>✨</span>
                <span>Ask Tipsy (AI Bartender &amp; Sommelier)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            </div>
          </div>

          {/* Decorative ambient gradients */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-60 h-60 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
        </div>

        {/* Optimized Multi-Tier Filter & Search Suite */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-200/90 shadow-xs space-y-4 transition-all duration-300">
          {/* Row 1: Search Bar & Dropdown Selectors */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#840038] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by cocktail name, spirit, ingredient (lime, tonic, bitters)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-[#840038]/20 focus:border-[#840038] bg-gray-50/60 hover:bg-white focus:bg-white transition-all duration-200 placeholder:text-gray-400 outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Spirit Base Selector */}
              <select
                value={selectedSpirit}
                onChange={(e) => setSelectedSpirit(e.target.value)}
                className="px-3 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#840038]/20 focus:border-[#840038] focus:outline-hidden cursor-pointer transition-all duration-200"
              >
                <option value="all">All Spirit Bases</option>
                {spiritOptions.list.filter((s) => s !== 'all').map((sp) => (
                  <option key={sp} value={sp}>Base: {sp}</option>
                ))}
              </select>

              {/* Drink Style Selector */}
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="px-3 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#840038]/20 focus:border-[#840038] focus:outline-hidden cursor-pointer transition-all duration-200"
              >
                <option value="all">All Drink Styles</option>
                {styleOptions.filter((s) => s !== 'all').map((st) => (
                  <option key={st} value={st}>Style: {st}</option>
                ))}
              </select>

              {/* Difficulty Selector */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="px-3 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-[#840038]/20 focus:border-[#840038] focus:outline-hidden cursor-pointer transition-all duration-200"
              >
                <option value="all">All Difficulties</option>
                <option value="Easy">Easy (Beginner)</option>
                <option value="Medium">Medium</option>
                <option value="Expert">Expert (Pro)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Drink Brand / House Pills (Jameson, Beefeater, Malfy, Olmeca, etc.) */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold px-0.5">
              <span className="uppercase tracking-wider font-bold text-gray-400">Filter by Brand / Spirit House</span>
              <span>Showing <strong>{filteredRecipes.length}</strong> of {recipes.length} cocktails</span>
            </div>

            {/* Wrapped Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {brandOptions.list.map((brand) => {
                const isSelected = selectedBrand.toLowerCase() === brand.toLowerCase();
                const count = brandOptions.counts[brand] || 0;

                return (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#840038] text-white shadow-xs font-bold'
                        : 'bg-gray-100/90 hover:bg-gray-200/90 text-gray-700'
                    }`}
                  >
                    <span>{brand === 'all' ? 'All Brands' : brand}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : 'text-gray-500 bg-gray-200/80'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filter Chips & Clear Bar */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active:</span>

              {selectedBrand !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200 text-[#840038] text-[11px] font-bold">
                  Brand: {selectedBrand}
                  <button onClick={() => setSelectedBrand('all')} className="hover:text-red-700 ml-0.5">✕</button>
                </span>
              )}

              {selectedSpirit !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                  Base: {selectedSpirit}
                  <button onClick={() => setSelectedSpirit('all')} className="hover:text-red-700 ml-0.5">✕</button>
                </span>
              )}

              {selectedStyle !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold">
                  Style: {selectedStyle}
                  <button onClick={() => setSelectedStyle('all')} className="hover:text-red-700 ml-0.5">✕</button>
                </span>
              )}

              {selectedDifficulty !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                  Difficulty: {selectedDifficulty}
                  <button onClick={() => setSelectedDifficulty('all')} className="hover:text-red-700 ml-0.5">✕</button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 text-[11px] font-bold">
                  &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-700 ml-0.5">✕</button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-[#840038] hover:underline whitespace-nowrap ml-auto px-2 py-1 transition-all active:scale-95"
              >
                Clear All Filters ✕
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div className="w-8 h-8 border-3 border-[#840038] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Mixology Catalog...</span>
          </div>
        ) : filteredRecipes.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs space-y-3 animate-card-rise">
            <div className="text-4xl">🍸</div>
            <h3 className="text-base font-bold text-gray-900">No cocktails matched your filters</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Try adjusting your brand, spirit base, or search query.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Recipe Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredRecipes.map((recipe, idx) => (
              <div
                key={recipe.id}
                onClick={() => openRecipeModal(recipe)}
                style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}
                className="group bg-white rounded-3xl border border-gray-200/90 overflow-hidden shadow-xs hover:shadow-xl hover:border-[#840038]/40 transition-all duration-300 flex flex-col cursor-pointer transform hover:-translate-y-1.5 animate-card-rise"
              >
                {/* Card Thumbnail */}
                <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
                  <img
                    src={recipe.image || recipe.originalImageUrl}
                    alt={recipe.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-108"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Brand Badge (Clean text, no icon) */}
                  <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-[#840038] text-white shadow-xs">
                    {recipe.brand}
                  </span>

                  {/* Difficulty Pill */}
                  <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border backdrop-blur-xs shadow-2xs ${difficultyBadge(recipe.difficulty)}`}>
                    {recipe.difficulty}
                  </span>

                  {/* Prep Time & Glass */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-[11px] font-medium drop-shadow-sm">
                    <span>⏱️ {recipe.prepTime}</span>
                    <span className="truncate max-w-[120px]">{recipe.glassware}</span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#840038] transition-colors leading-snug line-clamp-1">
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {recipe.description}
                    </p>
                  </div>

                  {/* Ingredients Preview Tags */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#840038]" />
                      <span>{recipe.ingredients?.length || 0} ingredients</span>
                    </div>

                    <span className="text-xs font-bold text-[#840038] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Recipe →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Floating Checkout Pill */}
      <FloatingCheckout
        cart={cart}
        products={effectiveProducts}
        onCheckout={() => setShowCheckout(true)}
        hidden={showCheckout}
      />

      {/* Bottom Navigation */}
      <BottomNav
        cartCount={cartTotalItems}
        onOpenCart={() => setShowCheckout(true)}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      {/* Interactive Mixology Modal */}
      {activeRecipe && (
        <MixologyModal
          recipe={activeRecipe}
          onClose={closeRecipeModal}
          products={effectiveProducts}
          onAddToCart={(productId) => {
            addToCart(Number(productId));
          }}
        />
      )}

      {/* Checkout Modal */}
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

      {/* Order Success Popup */}
      {orderSuccess && (
        <OrderSuccess
          order={orderSuccess}
          onNewOrder={() => setOrderSuccess(null)}
          onUpdateEmail={updateEmail}
        />
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      {/* Floating AI Bartender Trigger Button */}
      <button
        type="button"
        onClick={() => setShowAIBartender(true)}
        className="fixed bottom-20 md:bottom-8 left-5 z-40 bg-gradient-to-r from-[#840038] to-[#4a001e] hover:from-[#6b002c] hover:to-[#380016] text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs hover:scale-105 active:scale-95 transition-all border border-pink-400/30 backdrop-blur-md cursor-pointer"
        title="Ask Tipsy AI Bartender"
      >
        <span className="text-base">🍸</span>
        <span className="hidden sm:inline">Ask AI Bartender</span>
        <span className="sm:hidden">Tipsy AI</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {/* AI Bartender Modal */}
      <AIBartenderModal
        isOpen={showAIBartender}
        onClose={() => setShowAIBartender(false)}
        onOpenRecipe={(recipe) => openRecipeModal(recipe)}
        onAddToCart={(productId) => addToCart(Number(productId))}
      />
    </div>
  );
}

export default function MixologyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="w-8 h-8 border-3 border-[#840038] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MixologyContent />
    </Suspense>
  );
}

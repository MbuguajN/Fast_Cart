'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeCatalogPage() {
  const router = useRouter();
  const { catalog, addToCart, user, account, loading } = useTrade();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [quantities, setQuantities] = useState({});

  // Category counts and distinct list
  const categoryStats = useMemo(() => {
    const counts = { all: catalog.length };
    catalog.forEach((p) => {
      const cat = p.categoryName || 'Spirits';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [catalog]);

  const categories = useMemo(() => {
    const distinct = Array.from(new Set(catalog.map((p) => p.categoryName || 'Spirits')));
    return ['all', ...distinct];
  }, [catalog]);

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    let result = catalog.filter((p) => {
      if (!p) return false;
      const matchCat = selectedCategory === 'all' || (p.categoryName || 'Spirits') === selectedCategory;
      const q = (searchQuery || '').trim().toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const matchQuery = !q || pName.includes(q) || pSku.includes(q);
      return matchCat && matchQuery;
    });

    if (sortBy === 'price_asc') {
      result = [...result].sort((a, b) => {
        const pA = a.tierPrices?.T1?.unitPriceIncVat || 0;
        const pB = b.tierPrices?.T1?.unitPriceIncVat || 0;
        return pA - pB;
      });
    } else if (sortBy === 'price_desc') {
      result = [...result].sort((a, b) => {
        const pA = a.tierPrices?.T1?.unitPriceIncVat || 0;
        const pB = b.tierPrices?.T1?.unitPriceIncVat || 0;
        return pB - pA;
      });
    } else if (sortBy === 'name_asc') {
      result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
  }, [catalog, selectedCategory, searchQuery, sortBy]);

  const handleAdd = (product) => {
    const qty = quantities[product.sku] || (product.priceLine === 'jaba' ? 11 : 6);
    addToCart(product, qty);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSortBy('default');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Wholesale Catalog...</span>
        </div>
      </div>
    );
  }

  if (!user || !account) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-[#231F20]">
        <h1 className="text-xl font-bold uppercase">Wholesale Catalog is Confidential</h1>
        <p className="text-xs text-gray-500">Please sign in with your verified trade account credentials to view distributor pricing ladders.</p>
        <Link href="/trade/login" className="text-xs font-bold text-[#840038] hover:underline">
          Sign In to Trade Portal →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-[#231F20]">
      {/* Header & Order Pad Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Confidential Wholesale Trade Pricing
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-1">
            Pernod Ricard &amp; Craft Spirits Catalog
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Tier-discounted pricing automatically calculated based on bottle volumes per order.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/trade/order-pad"
            className="px-5 py-3 bg-[#1c1917] hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center gap-2"
          >
            <span>⚡ Rapid Order Pad</span>
          </Link>
        </div>
      </div>

      {/* Streamlined Search & Category Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search bottles (Jameson, Glenlivet, Jaba) or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:ring-1 focus:ring-[#840038] focus:border-[#840038] bg-gray-50/50 hover:bg-white transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort & Count */}
          <div className="flex items-center gap-2.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-hidden cursor-pointer"
            >
              <option value="default">Featured</option>
              <option value="name_asc">Name (A — Z)</option>
              <option value="price_asc">Price (Low → High)</option>
              <option value="price_desc">Price (High → Low)</option>
            </select>

            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
              <strong>{filteredProducts.length}</strong> items
            </span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = categoryStats[cat] || 0;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#840038] text-white shadow-2xs'
                    : 'bg-gray-100/80 hover:bg-gray-200/80 text-gray-700'
                }`}
              >
                <span>{cat === 'all' ? 'All' : cat}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {(searchQuery || selectedCategory !== 'all' || sortBy !== 'default') && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-[#840038] hover:underline whitespace-nowrap ml-2 px-1 py-1"
            >
              Reset ✕
            </button>
          )}
        </div>
      </div>

      {/* Empty Search Results State */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 shadow-sm text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-pink-50 text-[#840038] flex items-center justify-center mx-auto text-xl font-bold">
            🔍
          </div>
          <h3 className="text-base font-bold uppercase text-gray-900">No matching wholesale products found</h3>
          <p className="text-xs text-gray-500">
            We couldn&apos;t find any products matching &quot;<strong className="text-gray-800">{searchQuery}</strong>&quot; in the selected category.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-5 py-2.5 bg-[#840038] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow hover:bg-[#6b002c] transition-all inline-block"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        /* Product Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => {
            const qty = quantities[p.sku] || (p.priceLine === 'jaba' ? 11 : 6);
            const isJaba = p.priceLine === 'jaba';

            return (
              <div
                key={p.sku || p.id}
                className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex gap-4 items-start">
                    <img
                      src={p.image || '/images/bottle-placeholder.png'}
                      alt={p.name}
                      className="w-16 h-20 object-contain bg-gray-50 rounded-2xl p-1 border border-gray-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase text-[#840038] tracking-widest block truncate">
                        {p.categoryName || 'Spirits'}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">{p.name}</h3>
                      <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{p.sku}</span>
                    </div>
                  </div>

                  {/* Tier Ladder Matrix */}
                  <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 border-b border-gray-200 pb-1">
                      <span>Volume Band</span>
                      <span>Unit Price (Inc-VAT)</span>
                    </div>
                    {p.tierPrices && Object.entries(p.tierPrices).map(([tierKey, data]) => (
                      <div key={tierKey} className="flex justify-between items-center py-0.5">
                        <span className="font-semibold text-gray-700">
                          {tierKey} ({data.band})
                        </span>
                        <span className="font-mono font-bold text-gray-900">
                          KES {data.unitPriceIncVat?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add to Cart Bar */}
                <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setQuantities({ ...quantities, [p.sku]: Math.max(1, qty - (isJaba ? 10 : 6)) })}
                      className="px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQuantities({ ...quantities, [p.sku]: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-12 text-center text-xs font-bold bg-transparent border-none focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantities({ ...quantities, [p.sku]: qty + (isJaba ? 10 : 6) })}
                      className="px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    className="flex-1 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
                  >
                    Add {qty} btls
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

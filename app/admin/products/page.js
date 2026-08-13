'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      queueMicrotask(() => { setProducts(Array.isArray(data) ? data : []); setLoading(false); });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.brandName?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') list = list.filter((p) => p.categoryName === categoryFilter);
    if (stockFilter === 'instock') list = list.filter((p) => p.stockStatus === 'instock');
    else if (stockFilter === 'outofstock') list = list.filter((p) => p.stockStatus === 'outofstock');
    return list;
  }, [search, categoryFilter, stockFilter, products]);

  const categories = [...new Set(products.map((p) => p.categoryName).filter(Boolean))].sort();

  const startEdit = (product) => {
    setEditingId(product.wcId);
    setEditForm({ price: product.price || '', stockStatus: product.stockStatus || 'instock', stockQuantity: product.stockQuantity ?? '' });
  };

  const saveEdit = async (wcId) => {
    try {
      await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wcId, price: editForm.price, stockStatus: editForm.stockStatus, stockQuantity: editForm.stockQuantity === '' ? null : parseInt(editForm.stockQuantity) }),
      });
      setEditingId(null);
      loadProducts();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} of {products.length} products</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search products, SKU, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 outline-none focus:border-[#840037]/40 transition-all"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 outline-none cursor-pointer"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 outline-none cursor-pointer"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <option value="all">All Stock</option>
          <option value="instock">In Stock</option>
          <option value="outofstock">Out of Stock</option>
        </select>
      </div>

      {/* Products table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (<div key={i} className="h-16 rounded-xl animate-pulse bg-gray-100" />))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/80">
          <p className="text-sm font-semibold text-gray-400">No products match your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid md:grid-cols-[1fr_120px_120px_100px_80px] gap-4 px-5 py-3 bg-gray-50/80 border-b border-gray-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Product</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 text-right">Price</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 text-center">Stock</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 text-center">Qty</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 text-center">Action</span>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <div key={p.wcId} className="md:grid md:grid-cols-[1fr_120px_120px_100px_80px] gap-4 px-5 py-3 items-center hover:bg-gray-50/30 transition-colors">
                {/* Product info */}
                <div className="flex items-center gap-3">
                  {p.image ? (
                    <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {p.categoryName}{p.brandName ? ` · ${p.brandName}` : ''}{p.sku ? ` · ${p.sku}` : ''}
                    </p>
                  </div>
                </div>

                {editingId === p.wcId ? (
                  <>
                    <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 text-right outline-none" placeholder="Price" />
                    <select value={editForm.stockStatus} onChange={(e) => setEditForm({ ...editForm, stockStatus: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 outline-none">
                      <option value="instock">In Stock</option>
                      <option value="outofstock">Out of Stock</option>
                      <option value="onbackorder">Backorder</option>
                    </select>
                    <input type="number" value={editForm.stockQuantity} onChange={(e) => setEditForm({ ...editForm, stockQuantity: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs border border-gray-200 text-right outline-none" placeholder="Qty" />
                    <div className="flex items-center gap-1">
                      <button onClick={() => saveEdit(p.wcId)} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: '#840037' }}>Save</button>
                      <button onClick={() => setEditingId(null)} className="py-1.5 px-2 rounded-lg text-[10px] text-gray-500 hover:bg-gray-100">✕</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-right" style={{ color: '#840037' }}>KSh {parseFloat(p.price || 0).toLocaleString()}</p>
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        p.stockStatus === 'instock' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.stockStatus === 'instock' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {p.stockStatus === 'instock' ? 'In Stock' : 'Out'}
                      </span>
                    </div>
                    <p className="text-xs text-center text-gray-600">{p.stockQuantity ?? '—'}</p>
                    <div className="flex justify-center">
                      <button onClick={() => startEdit(p)} className="text-[10px] font-semibold px-3 py-1.5 rounded-lg text-[#840037] bg-pink-50 hover:bg-pink-100 transition-colors">
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

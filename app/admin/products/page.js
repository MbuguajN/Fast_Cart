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
      const list = Array.isArray(data) ? data : [];
      queueMicrotask(() => {
        setProducts(list);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brandName?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.categoryName === categoryFilter);
    }
    if (stockFilter === 'instock') {
      list = list.filter((p) => p.stockStatus === 'instock');
    } else if (stockFilter === 'outofstock') {
      list = list.filter((p) => p.stockStatus === 'outofstock');
    }
    return list;
  }, [search, categoryFilter, stockFilter, products]);

  const categories = [...new Set(products.map((p) => p.categoryName).filter(Boolean))].sort();

  const startEdit = (product) => {
    setEditingId(product.wcId);
    setEditForm({
      price: product.price || '',
      stockStatus: product.stockStatus || 'instock',
      stockQuantity: product.stockQuantity ?? '',
    });
  };

  const saveEdit = async (wcId) => {
    try {
      await fetch('/api/admin/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wcId,
          price: editForm.price,
          stockStatus: editForm.stockStatus,
          stockQuantity: editForm.stockQuantity === '' ? null : parseInt(editForm.stockQuantity),
        }),
      });
      setEditingId(null);
      loadProducts();
    } catch {
      // silent
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div>
      <h1
        className="text-xl font-bold mb-4"
        style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
      >
        Products
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
        >
          <option value="all">All Stock</option>
          <option value="instock">In Stock</option>
          <option value="outofstock">Out of Stock</option>
        </select>
      </div>

      <p className="text-xs mb-3" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
        {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#E9ECEF' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            No products found
          </p>
          <p className="text-xs mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            Try syncing with WooCommerce first
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.wcId}
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
            >
              {p.image && (
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {p.name}
                </p>
                <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                  {p.categoryName} {p.brandName ? `· ${p.brandName}` : ''} {p.sku ? `· SKU: ${p.sku}` : ''}
                </p>
              </div>

              {editingId === p.wcId ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-20 px-2 py-1 rounded text-xs border text-right"
                    style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
                    placeholder="Price"
                  />
                  <select
                    value={editForm.stockStatus}
                    onChange={(e) => setEditForm({ ...editForm, stockStatus: e.target.value })}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    <option value="instock">In Stock</option>
                    <option value="outofstock">Out of Stock</option>
                    <option value="onbackorder">Backorder</option>
                  </select>
                  <input
                    type="number"
                    value={editForm.stockQuantity}
                    onChange={(e) => setEditForm({ ...editForm, stockQuantity: e.target.value })}
                    className="w-16 px-2 py-1 rounded text-xs border text-right"
                    style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
                    placeholder="Qty"
                  />
                  <button
                    onClick={() => saveEdit(p.wcId)}
                    className="px-2 py-1 rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-2 py-1 rounded text-xs font-semibold"
                    style={{ backgroundColor: '#E9ECEF', color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                      KSh {parseFloat(p.price || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px]" style={{
                      color: p.stockStatus === 'instock' ? '#28a745' : '#dc3545',
                      fontFamily: 'Montserrat, sans-serif',
                    }}>
                      {p.stockStatus === 'instock' ? `In Stock (${p.stockQuantity ?? '?'})` : p.stockStatus === 'outofstock' ? 'Out of Stock' : p.stockStatus}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

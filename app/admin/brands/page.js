'use client';

import { useState, useEffect, useCallback } from 'react';

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/brands');
      const data = await res.json();
      queueMicrotask(() => { setBrands(Array.isArray(data) ? data : []); setLoading(false); });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  const startEdit = (brand) => {
    setEditingId(brand.id || brand.wcId);
    setEditForm({ name: brand.name || '', description: brand.description || '', image: brand.image || '' });
  };

  const saveEdit = async (id) => {
    try {
      await fetch('/api/admin/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      setEditingId(null);
      loadBrands();
    } catch { /* silent */ }
  };

  const toggleVisibility = async (brand) => {
    const id = brand.id || brand.wcId;
    const updated = brand.visible === false ? true : false;
    setBrands((prev) => prev.map((b) => (b.id === id || b.wcId === id) ? { ...b, visible: updated } : b));
    try {
      await fetch('/api/admin/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visible: updated }),
      });
    } catch { /* silent */ }
  };

  const handleLogoUpload = async (e, brandId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', brandId);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setEditForm((prev) => ({ ...prev, image: data.url }));
    } catch { /* silent */ }
  };

  const visibleCount = brands.filter((b) => b.visible !== false).length;
  const hiddenCount = brands.filter((b) => b.visible === false).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Brands</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {brands.length} brands · {visibleCount} visible · {hiddenCount} hidden
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (<div key={i} className="h-40 rounded-2xl animate-pulse bg-gray-100" />))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/80">
          <p className="text-sm font-semibold text-gray-400">No brands synced yet</p>
          <p className="text-xs text-gray-400 mt-1">Sync WooCommerce to pull brands from product attributes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {brands.map((b) => {
            const id = b.id || b.wcId;
            const isEditing = editingId === id;
            const isHidden = b.visible === false;

            return (
              <div
                key={id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all group ${isHidden ? 'opacity-50' : 'hover:shadow-md'}`}
                style={{ borderColor: isEditing ? '#840037' : '#e5e7eb' }}
              >
                {isEditing ? (
                  /* Edit mode */
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex-shrink-0">
                        {editForm.image ? (
                          <img src={editForm.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold" style={{ color: '#840037' }}>{b.name?.charAt(0)}</span>
                        )}
                      </div>
                      <label className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors text-gray-600">
                        Upload Logo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, id)} />
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 font-semibold outline-none focus:border-[#840037]/40"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(id)} className="flex-1 py-2 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: '#840037' }}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div className="p-5 flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden mb-3"
                        style={{ backgroundColor: b.image ? 'transparent' : (b.color || '#840037') + '15' }}>
                        {b.image ? (
                          <img src={b.image} alt={b.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl font-bold" style={{ color: b.color || '#840037' }}>
                            {b.name?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 truncate w-full" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {b.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {b.productCount || 0} product{(b.productCount || 0) !== 1 ? 's' : ''}
                      </p>
                      {!b.image && (
                        <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2 font-medium">
                          No logo
                        </span>
                      )}
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => toggleVisibility(b)}
                        className="flex-1 py-2.5 text-[10px] font-semibold text-center transition-colors hover:bg-gray-50"
                        style={{ color: isHidden ? '#dc2626' : '#10b981' }}
                      >
                        {isHidden ? 'Hidden' : 'Visible'}
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button
                        onClick={() => startEdit(b)}
                        className="flex-1 py-2.5 text-[10px] font-semibold text-center text-gray-500 hover:text-[#840037] hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      queueMicrotask(() => {
        setBrands(Array.isArray(data) ? data : []);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadBrands(); }, [loadBrands]);

  const startEdit = (brand) => {
    setEditingId(brand.id || brand.wcId);
    setEditForm({
      name: brand.name || '',
      description: brand.description || '',
      image: brand.image || '',
    });
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
    } catch {
      // silent
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleLogoUpload = async (e, brandId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', brandId);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setEditForm((prev) => ({ ...prev, image: data.url }));
      }
    } catch {
      // silent
    }
  };

  return (
    <div>
      <h1
        className="text-xl font-bold mb-4"
        style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
      >
        Brands
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#E9ECEF' }} />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            No brands synced yet
          </p>
          <p className="text-xs mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            Sync WooCommerce to pull brands from product attributes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map((b) => {
            const id = b.id || b.wcId;
            const isEditing = editingId === id;
            return (
              <div
                key={id}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
              >
                {/* Logo */}
                <div className="flex-shrink-0">
                  {isEditing && editForm.image ? (
                    <img src={editForm.image} alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                  ) : b.image ? (
                    <img src={b.image} alt={b.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: 'rgba(132,0,55,0.1)', color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {b.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm border font-semibold"
                      style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
                    />
                  ) : (
                    <p className="text-sm font-semibold truncate" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                      {b.name}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                    {b.slug || b.wcId}
                  </p>
                </div>

                {/* Actions */}
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ backgroundColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e, id)}
                      />
                    </label>
                    <button
                      onClick={() => saveEdit(id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: '#E9ECEF', color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={async () => {
                        const updated = b.visible === false ? true : false;
                        setBrands((prev) => prev.map((br) => (br.id === id || br.wcId === id) ? { ...br, visible: updated } : br));
                        try {
                          await fetch('/api/admin/brands', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id, visible: updated }),
                          });
                        } catch {}
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: b.visible === false ? '#E9ECEF' : '#840037',
                        color: b.visible === false ? '#5f5e5e' : '#ffffff',
                        fontFamily: 'Montserrat, sans-serif',
                      }}
                    >
                      {b.visible === false ? 'Hidden' : 'Visible'}
                    </button>
                    <button
                      onClick={() => startEdit(b)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

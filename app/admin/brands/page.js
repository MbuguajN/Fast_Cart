'use client';

import { useState, useEffect, useCallback } from 'react';

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBrand, setEditingBrand] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    image: '',
    banner: '',
    color: '#840037',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

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

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setEditForm({
      name: brand.name || '',
      description: brand.description || '',
      image: brand.image || brand.logo || '',
      banner: brand.banner || '',
      color: brand.color || '#840037',
    });
  };

  const closeEditModal = () => {
    setEditingBrand(null);
  };

  const handleSaveBrand = async (e) => {
    e?.preventDefault();
    if (!editingBrand) return;
    setSaving(true);
    const id = editingBrand.id || editingBrand.wcId;

    try {
      await fetch('/api/admin/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editForm }),
      });
      await loadBrands();
      setEditingBrand(null);
    } catch (err) {
      console.error('Failed to save brand:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (brand) => {
    const id = brand.id || brand.wcId;
    const updated = brand.visible === false ? true : false;
    setBrands((prev) =>
      prev.map((b) => ((b.id === id || b.wcId === id) ? { ...b, visible: updated } : b))
    );
    try {
      await fetch('/api/admin/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, visible: updated }),
      });
    } catch {
      /* silent */
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingBrand) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', editingBrand.id || editingBrand.wcId);

    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setEditForm((prev) => ({ ...prev, image: data.url }));
      }
    } catch (err) {
      console.error('Logo upload failed:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingBrand) return;
    setUploadingBanner(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brandId', editingBrand.id || editingBrand.wcId);

    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setEditForm((prev) => ({ ...prev, banner: data.url }));
      }
    } catch (err) {
      console.error('Banner upload failed:', err);
    } finally {
      setUploadingBanner(false);
    }
  };

  const visibleCount = brands.filter((b) => b.visible !== false).length;
  const hiddenCount = brands.filter((b) => b.visible === false).length;
  const withBannerCount = brands.filter((b) => Boolean(b.banner)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            Brand & Banner Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage brand logos, descriptions, and featured hero banners shown on customer brand pages.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="px-3 py-1 rounded-full bg-pink-50 text-[#840037] border border-pink-100">
            {brands.length} Total Brands
          </span>
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            {withBannerCount} Banners Active
          </span>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">
            {visibleCount} Visible
          </span>
        </div>
      </div>

      {/* Brands Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-56 rounded-2xl animate-pulse bg-gray-100 border border-gray-200" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/80">
          <p className="text-sm font-semibold text-gray-400">No brands found</p>
          <p className="text-xs text-gray-400 mt-1">Sync WooCommerce from the Sync tab to pull brands.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {brands.map((b) => {
            const id = b.id || b.wcId;
            const isHidden = b.visible === false;

            return (
              <div
                key={id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${
                  isHidden ? 'opacity-55' : ''
                }`}
                style={{ borderColor: '#e5e7eb' }}
              >
                {/* Brand Banner Hero Preview */}
                <div className="h-24 w-full relative overflow-hidden bg-gray-900 flex items-center justify-center">
                  {b.banner ? (
                    <>
                      <img src={b.banner} alt={`${b.name} banner`} className="w-full h-full object-cover brightness-90" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20">
                        Banner Active
                      </span>
                    </>
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${b.color || '#840037'}, #191c1d)` }}
                    >
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                        Default Gradient
                      </span>
                    </div>
                  )}
                </div>

                {/* Brand Info */}
                <div className="p-4 flex-1 flex flex-col items-center text-center">
                  {/* Brand Avatar Floating on Banner */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden -mt-10 border-2 border-white shadow-md bg-white p-1 mb-2"
                  >
                    {b.image || b.logo ? (
                      <img src={b.image || b.logo} alt={b.name} className="w-full h-full object-contain" />
                    ) : (
                      <span
                        className="text-lg font-black text-white w-full h-full flex items-center justify-center rounded-xl"
                        style={{ backgroundColor: b.color || '#840037' }}
                      >
                        {b.name?.charAt(0) || 'B'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 truncate w-full" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {b.name}
                  </h3>

                  <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                    {b.productCount || 0} product{(b.productCount || 0) !== 1 ? 's' : ''}
                  </p>

                  {b.description && (
                    <p className="text-[11px] text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                      {b.description}
                    </p>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="flex border-t border-gray-100 bg-gray-50/50">
                  <button
                    onClick={() => toggleVisibility(b)}
                    className="flex-1 py-2.5 text-xs font-bold text-center transition-colors hover:bg-gray-100"
                    style={{ color: isHidden ? '#dc2626' : '#10b981' }}
                  >
                    {isHidden ? 'Hidden' : 'Visible'}
                  </button>
                  <div className="w-px bg-gray-200" />
                  <button
                    onClick={() => openEditModal(b)}
                    className="flex-1 py-2.5 text-xs font-bold text-center text-[#840037] hover:bg-pink-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit Banner & Info</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Brand & Banner Modal */}
      {editingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Edit Brand: {editingBrand.name}
                </h2>
                <p className="text-xs text-gray-500">Update logo, hero banner artwork, and brand description.</p>
              </div>
              <button
                onClick={closeEditModal}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBrand} className="space-y-4">
              {/* Brand Hero Banner Preview & Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Featured Hero Banner
                </label>
                <div className="relative w-full h-32 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center group">
                  {editForm.banner ? (
                    <>
                      <img src={editForm.banner} alt="Banner Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="px-3 py-1.5 rounded-xl bg-white text-xs font-bold text-gray-800 shadow-md cursor-pointer hover:bg-gray-100">
                          {uploadingBanner ? 'Uploading...' : 'Change Banner'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, banner: '' }))}
                          className="px-3 py-1.5 rounded-xl bg-red-600 text-xs font-bold text-white shadow-md hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-gray-100 transition-colors w-full h-full">
                      <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-bold text-gray-600">
                        {uploadingBanner ? 'Uploading...' : 'Click to Upload Hero Banner'}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">Recommended: 1200 x 400 WebP or PNG</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                    </label>
                  )}
                </div>
                {/* Direct Banner URL input */}
                <input
                  type="text"
                  value={editForm.banner}
                  onChange={(e) => setEditForm({ ...editForm, banner: e.target.value })}
                  placeholder="Or paste external banner image URL"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:border-[#840037]"
                />
              </div>

              {/* Brand Logo Upload & Preview */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Brand Logo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center flex-shrink-0 p-1">
                    {editForm.image ? (
                      <img src={editForm.image} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs font-bold text-gray-400">No Logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-block px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 cursor-pointer transition-colors">
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo Image'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                    <input
                      type="text"
                      value={editForm.image}
                      onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                      placeholder="Or paste logo URL"
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 outline-none focus:border-[#840037]"
                    />
                  </div>
                </div>
              </div>

              {/* Brand Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 outline-none focus:border-[#840037]"
                  required
                />
              </div>

              {/* Brand Description / Story */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Brand Story / Description (Shown on Hero Banner)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="e.g. Masterful blend of malt and grain whiskies known for smooth taste..."
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 outline-none focus:border-[#840037] leading-relaxed"
                />
              </div>

              {/* Brand Accent Color */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="color"
                  value={editForm.color || '#840037'}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-gray-700 block">Brand Color Theme</span>
                  <span className="text-[11px] text-gray-400">{editForm.color || '#840037'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 px-4 rounded-2xl bg-[#840037] hover:bg-[#5b0024] text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Saving Changes...' : 'Save Brand Settings'}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="py-3 px-5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

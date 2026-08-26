'use client';

import { useState, useEffect, useCallback } from 'react';

const PRESET_SLIDES = [
  '/uploads/slides/jameson-banner-hero.png',
  '/uploads/slides/Jaba-Home-page.webp',
  '/uploads/slides/Ballantines-Slide.webp',
  '/uploads/slides/Luc-Belaire-Slide.webp',
  '/uploads/slides/HH-Beetroot-Slide-copy.webp',
  '/uploads/slides/1-Happy-Hour-Jaba-Beetroot-banners-12-8-26.jpg',
  '/uploads/slides/2-Happy-Hour-Jaba-Pineapple-banners-12-8-26.jpg',
  '/uploads/slides/3-Happy-Hour-Jaba-Watermelon-banners-12-8-26.jpg',
  '/uploads/slides/4-Happy-Hour-Jaba-Tamarind-banners-12-8-26.jpg',
  '/uploads/slides/5-Happy-Hour-Jaba-Tropical-banners-12-8-26.jpg',
  '/uploads/slides/6-Happy-Hour-Jaba-Hibiscus-banners-12-8-26.jpg',
];

export default function AdminSlidesPage() {
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [form, setForm] = useState({
    id: '',
    title: '',
    subtitle: '',
    image: '',
    backgroundImage: '',
    overlayImage: '',
    badge: 'FEATURED',
    buttonText: 'BUY NOW',
    link: '',
    targetUrl: '',
    active: true,
    order: 1,
    productId: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [slidesRes, prodsRes] = await Promise.all([
        fetch('/api/admin/slides'),
        fetch('/api/products'),
      ]);
      const slidesData = await slidesRes.json();
      const prodsData = await prodsRes.json();

      queueMicrotask(() => {
        setSlides(Array.isArray(slidesData) ? slidesData : []);
        setProducts(prodsData?.products || []);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openNewSlideModal = () => {
    setEditingSlide({ isNew: true });
    setForm({
      id: '',
      title: '',
      subtitle: '',
      image: PRESET_SLIDES[0],
      backgroundImage: PRESET_SLIDES[0],
      overlayImage: PRESET_SLIDES[0],
      badge: 'FEATURED',
      buttonText: 'BUY NOW',
      link: '',
      targetUrl: '',
      active: true,
      order: slides.length + 1,
      productId: '',
    });
  };

  const openEditModal = (slide) => {
    setEditingSlide(slide);
    setForm({
      id: slide.id,
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      image: slide.image || slide.backgroundImage || '',
      backgroundImage: slide.backgroundImage || slide.image || '',
      overlayImage: slide.overlayImage || slide.image || '',
      badge: slide.badge || 'FEATURED',
      buttonText: slide.buttonText || 'BUY NOW',
      link: slide.link || slide.targetUrl || '',
      targetUrl: slide.targetUrl || slide.link || '',
      active: slide.active !== false,
      order: slide.order || 1,
      productId: slide.productId ? String(slide.productId) : '',
    });
  };

  const closeModal = () => {
    setEditingSlide(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const method = editingSlide.isNew ? 'POST' : 'PUT';
      const body = {
        ...form,
        image: form.backgroundImage || form.image,
        backgroundImage: form.backgroundImage || form.image,
        overlayImage: form.overlayImage || form.image,
        link: form.link || form.targetUrl,
        targetUrl: form.targetUrl || form.link,
      };

      const res = await fetch('/api/admin/slides', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      closeModal();
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to save banner slide');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this banner slide?')) return;
    try {
      const res = await fetch(`/api/admin/slides?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      loadData();
    } catch {
      alert('Failed to delete slide');
    }
  };

  const toggleActive = async (slide) => {
    try {
      await fetch('/api/admin/slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slide, active: !slide.active }),
      });
      loadData();
    } catch {
      // silent
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBg(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      if (data.url) {
        setForm((prev) => ({
          ...prev,
          backgroundImage: data.url,
          image: data.url,
          overlayImage: prev.overlayImage || data.url,
        }));
      }
    } catch (err) {
      alert(`Background image upload failed: ${err.message}`);
    } finally {
      setUploadingBg(false);
      e.target.value = '';
    }
  };

  const handleOverlayUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOverlay(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      if (data.url) {
        setForm((prev) => ({
          ...prev,
          overlayImage: data.url,
        }));
      }
    } catch (err) {
      alert(`Overlay image upload failed: ${err.message}`);
    } finally {
      setUploadingOverlay(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Homepage Banner Slides
          </h1>
          <p className="text-xs text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Reworked banner format: Background Image + Centered Overlay (with bottle, title, price, and CTA button) + Whole-Banner Link.
          </p>
        </div>
        <button
          onClick={openNewSlideModal}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:bg-[#6b002c] transition-all flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          <span>+ Add New Banner</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl animate-pulse bg-gray-200" />
          ))}
        </div>
      ) : slides.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            No banner slides configured
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {slides.map((slide) => {
            const linkedProd = slide.productId
              ? products.find((p) => String(p.wcId) === String(slide.productId) || String(p.id) === String(slide.productId))
              : null;

            const targetUrl = slide.link || slide.targetUrl || (linkedProd ? `/product/${linkedProd.slug}` : '/brands');
            const bgImg = slide.backgroundImage || slide.image;
            const overlayImg = slide.overlayImage || slide.image;

            return (
              <div
                key={slide.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-md"
              >
                {/* Live Banner Preview (Background + Centered Overlay) */}
                <div className="relative w-full aspect-[21/9] bg-gray-950 overflow-hidden group">
                  {bgImg && (
                    <img
                      src={bgImg}
                      alt="Background"
                      className="w-full h-full object-cover brightness-[0.88]"
                    />
                  )}

                  {/* Centered Overlay */}
                  {overlayImg && (
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <img
                        src={overlayImg}
                        alt="Overlay"
                        className="w-full h-full max-h-full max-w-full object-contain drop-shadow-xl"
                      />
                    </div>
                  )}

                  {/* Active status pill */}
                  <button
                    onClick={() => toggleActive(slide)}
                    className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded-full transition-all shadow-xs cursor-pointer z-30 ${
                      slide.active !== false ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-white'
                    }`}
                  >
                    {slide.active !== false ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* Info & Target Link */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {slide.title || 'Untitled Banner'}
                    </h3>
                    {slide.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{slide.subtitle}</p>
                    )}
                    <div className="mt-2 text-[11px] font-mono text-gray-600 bg-gray-50 p-2 rounded-lg truncate border border-gray-100 flex items-center gap-1.5">
                      <span>🔗</span>
                      <span className="truncate">{targetUrl}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400">
                      Order: #{slide.order || 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(slide)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(slide.id)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / New Modal */}
      {editingSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {editingSlide.isNew ? 'Create New Banner' : 'Edit Banner'}
              </h2>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer">
                ✕
              </button>
            </div>

            {/* Live Combined Preview */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Live Preview:</span>
              <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-gray-950 border border-gray-200 shadow-inner">
                {form.backgroundImage && (
                  <img src={form.backgroundImage} alt="Bg Preview" className="w-full h-full object-cover brightness-[0.88]" />
                )}
                {form.overlayImage && (
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <img src={form.overlayImage} alt="Overlay Preview" className="max-h-full max-w-full object-contain drop-shadow-xl" />
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* 1. Background Image */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  1. Background Image (Full Bleed)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.backgroundImage}
                      onChange={(e) => setForm({ ...form, backgroundImage: e.target.value, image: e.target.value })}
                      placeholder="/uploads/slides/... or https://..."
                      className="flex-1 px-3 py-2 border rounded-xl text-xs font-mono"
                    />
                    <label className={`px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                      uploadingBg ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}>
                      {uploadingBg ? 'Uploading...' : 'Upload'}
                      <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" disabled={uploadingBg} />
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. Centered Overlay Image */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  2. Centered Overlay Image (Bottle, Title, Price &amp; CTA)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.overlayImage}
                      onChange={(e) => setForm({ ...form, overlayImage: e.target.value })}
                      placeholder="/uploads/slides/... or https://..."
                      className="flex-1 px-3 py-2 border rounded-xl text-xs font-mono"
                    />
                    <label className={`px-3.5 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                      uploadingOverlay ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                    }`}>
                      {uploadingOverlay ? 'Uploading...' : 'Upload'}
                      <input type="file" accept="image/*" onChange={handleOverlayUpload} className="hidden" disabled={uploadingOverlay} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Presets Picker */}
              <div>
                <span className="text-[10px] text-gray-500 font-semibold block mb-1">Select from preset library:</span>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                  {PRESET_SLIDES.map((preset, i) => (
                    <img
                      key={i}
                      src={preset}
                      alt="Preset"
                      onClick={() => setForm({ ...form, backgroundImage: preset, overlayImage: preset, image: preset })}
                      className={`w-14 h-9 object-cover rounded-md cursor-pointer border-2 transition-all ${
                        form.backgroundImage === preset ? 'border-[#840037] scale-105 shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* 3. Target Link / Product */}
              <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2.5">
                <label className="block text-xs font-bold text-[#840037]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  🎯 Target Link / Product (Whole Banner is Clickable)
                </label>
                
                <div>
                  <span className="text-[10px] text-gray-600 block mb-1">Link to Catalog Product:</span>
                  <select
                    value={form.productId}
                    onChange={(e) => {
                      const prodId = e.target.value;
                      const selected = products.find((p) => String(p.id) === String(prodId) || String(p.wcId) === String(prodId));
                      setForm({
                        ...form,
                        productId: prodId,
                        link: selected ? `/product/${selected.slug}` : form.link,
                        targetUrl: selected ? `/product/${selected.slug}` : form.targetUrl,
                      });
                    }}
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl text-xs bg-white"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    <option value="">-- Custom URL or Brand Page --</option>
                    {products.map((p, idx) => (
                      <option key={`prod_${p.id || p.wcId || idx}_${idx}`} value={p.id || p.wcId}>
                        {p.name} — KSh {parseFloat(p.price || 0).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] text-gray-600 block mb-1">Or Custom Target URL (e.g. /brands/jaba, /brands/jameson_irish_whiskey):</span>
                  <input
                    type="text"
                    value={form.link}
                    onChange={(e) => setForm({ ...form, link: e.target.value, targetUrl: e.target.value })}
                    placeholder="/brands/jameson_irish_whiskey"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono bg-white"
                  />
                </div>
              </div>

              {/* Title & Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Banner Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Must Be A Jameson"
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="slideActive"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded text-[#840037] focus:ring-[#840037]"
                />
                <label htmlFor="slideActive" className="text-xs font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Active (Visible on Homepage Carousel)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] shadow-sm cursor-pointer"
                >
                  Save Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

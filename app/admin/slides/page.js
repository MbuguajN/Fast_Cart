'use client';

import { useState, useEffect, useCallback } from 'react';

const PRESET_SLIDES = [
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
  const [editingSlide, setEditingSlide] = useState(null);
  const [form, setForm] = useState({
    id: '',
    title: '',
    subtitle: '',
    image: '',
    badge: 'HAPPY HOUR',
    buttonText: 'Order Now',
    active: true,
    order: 1,
    productId: '',
    customPrice: '',
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
      badge: 'HAPPY HOUR',
      buttonText: 'Order Now',
      active: true,
      order: slides.length + 1,
      productId: '',
      customPrice: '',
    });
  };

  const openEditModal = (slide) => {
    setEditingSlide(slide);
    setForm({
      id: slide.id,
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      image: slide.image || '',
      badge: slide.badge || 'SPECIAL OFFER',
      buttonText: slide.buttonText || 'Order Now',
      active: slide.active !== false,
      order: slide.order || 1,
      productId: slide.productId ? String(slide.productId) : '',
      customPrice: slide.customPrice ? String(slide.customPrice) : '',
    });
  };

  const closeModal = () => {
    setEditingSlide(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const method = editingSlide?.isNew ? 'POST' : 'PUT';
      await fetch('/api/admin/slides', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      closeModal();
      loadData();
    } catch (err) {
      alert('Failed to save slide');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this banner slide?')) return;
    try {
      await fetch(`/api/admin/slides?id=${id}`, { method: 'DELETE' });
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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setForm((prev) => ({ ...prev, image: data.url }));
      }
    } catch {
      alert('Image upload failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            Featured Banner Slides
          </h1>
          <p className="text-xs text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Manage homepage hero slides, set titles, upload images, and link live product prices.
          </p>
        </div>
        <button
          onClick={openNewSlideModal}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:bg-[#6b002c] transition-all flex items-center gap-1.5"
          style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          <span>+ Add New Slide</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse bg-gray-200" />
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

            return (
              <div
                key={slide.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col transition-all hover:shadow-md"
              >
                {/* Banner Image Preview */}
                <div className="relative w-full h-36 bg-gray-900 overflow-hidden">
                  {slide.image ? (
                    <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#840037] to-pink-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Badge */}
                  {slide.badge && (
                    <span className="absolute top-3 left-3 bg-[#840037] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {slide.badge}
                    </span>
                  )}

                  {/* Active status pill */}
                  <button
                    onClick={() => toggleActive(slide)}
                    className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-all ${
                      slide.active !== false ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                    }`}
                  >
                    {slide.active !== false ? 'Active' : 'Inactive'}
                  </button>

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="text-sm font-extrabold truncate">{slide.title || 'Untitled Banner'}</h3>
                    {slide.subtitle && <p className="text-[11px] text-gray-200 truncate">{slide.subtitle}</p>}
                  </div>
                </div>

                {/* Banner Info & Linked Product */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5 text-xs text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {linkedProd ? (
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center justify-between">
                        <span className="font-semibold text-amber-900 truncate max-w-[170px]">🔗 {linkedProd.name}</span>
                        <span className="font-extrabold text-[#840037]">KSh {parseFloat(linkedProd.price).toLocaleString()}</span>
                      </div>
                    ) : slide.customPrice ? (
                      <div className="p-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                        <span className="text-gray-500">Custom Price</span>
                        <span className="font-extrabold text-[#840037]">KSh {parseFloat(slide.customPrice).toLocaleString()}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">No catalog product linked</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button
                      onClick={() => openEditModal(slide)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[#840037] bg-pink-50 hover:bg-pink-100 transition-colors"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Edit Banner
                    </button>
                    <button
                      onClick={() => handleDelete(slide.id)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Delete
                    </button>
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
              <h2 className="text-lg font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                {editingSlide.isNew ? 'Create New Banner Slide' : 'Edit Banner Slide'}
              </h2>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Banner Image
                </label>
                <div className="space-y-2">
                  {form.image && (
                    <div className="w-full h-32 rounded-xl overflow-hidden relative border">
                      <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.image}
                      onChange={(e) => setForm({ ...form, image: e.target.value })}
                      placeholder="/uploads/slides/..."
                      className="flex-1 px-3 py-2 border rounded-xl text-xs font-mono"
                    />
                    <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-xl cursor-pointer">
                      Upload
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-semibold block mb-1">Or select preset banner:</span>
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                      {PRESET_SLIDES.map((preset, i) => (
                        <img
                          key={i}
                          src={preset}
                          alt="Preset"
                          onClick={() => setForm({ ...form, image: preset })}
                          className={`w-12 h-8 object-cover rounded-md cursor-pointer border-2 transition-all ${
                            form.image === preset ? 'border-[#840037] scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Banner Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Happy Hour Jaba Beetroot"
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Subtitle / Description
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="e.g. Chilled & refreshing organic blend"
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Badge Text
                  </label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="e.g. SPECIAL OFFER"
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
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  />
                </div>
              </div>

              {/* Product Pairing */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                <label className="block text-xs font-bold text-amber-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  🔗 Link to Catalog Product (Dynamic Pricing & Quick Add)
                </label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs bg-white"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  <option value="">-- No Product Linked (Custom Action) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — KSh {parseFloat(p.price).toLocaleString()} ({p.inStock !== false ? 'In Stock' : 'Out of Stock'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-amber-800">
                  When linked, the slide automatically fetches live catalog prices and adds a <strong>QUICK ADD</strong> button to the banner!
                </p>
              </div>

              {!form.productId && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Custom Price Override (Optional)
                  </label>
                  <input
                    type="number"
                    value={form.customPrice}
                    onChange={(e) => setForm({ ...form, customPrice: e.target.value })}
                    placeholder="e.g. 1200"
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="slideActive"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded text-[#840037] focus:ring-[#840037]"
                />
                <label htmlFor="slideActive" className="text-xs font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Active (Visible on Storefront)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] shadow-sm"
                >
                  Save Slide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

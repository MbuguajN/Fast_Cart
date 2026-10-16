'use client';

import { useCallback, useEffect, useState } from 'react';

const EMPTY = { id: '', image: '', title: '', subtitle: '', badge: '', buttonText: '', link: '', order: 1, active: true };

export default function TradeHeroSlidesPage() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = closed
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const flash = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/trade/hero-slides');
      const data = await res.json();
      setSlides(Array.isArray(data.slides) ? data.slides : []);
    } catch {
      flash('Could not load slides', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const save = async (slide) => {
    const res = await fetch('/api/admin/trade/hero-slides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(slide),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    return data.slide;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save(form);
      setForm(null);
      flash('Slide saved');
      await load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (slide) => {
    try { await save({ ...slide, active: !slide.active }); await load(); } catch (err) { flash(err.message, 'error'); }
  };

  const remove = async (slide) => {
    if (!window.confirm(`Delete slide "${slide.title || 'untitled'}"?`)) return;
    await fetch(`/api/admin/trade/hero-slides?id=${encodeURIComponent(slide.id)}`, { method: 'DELETE' });
    flash('Slide deleted');
    await load();
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((f) => ({ ...f, image: data.url }));
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const liveCount = slides.filter((s) => s.active).length;
  const field = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-xs';
  const label = 'block text-[10px] font-bold uppercase text-gray-600 mb-1';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trade Hero Slides</h1>
          <p className="text-xs text-gray-500 mt-1">
            Promotions shown at the top of the trade landing page. With no live slides, the standard hero is shown.
            Up to 8 live slides rotate; the &quot;100% original · fast delivery&quot; message strip always stays underneath.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY, order: slides.length + 1 })}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#840038] text-white hover:bg-[#6b002c]"
        >
          + New slide
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {message.text}
        </div>
      )}

      <p className="text-[11px] font-bold text-gray-600">{liveCount} live · {slides.length} total</p>

      {loading ? (
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      ) : slides.length === 0 ? (
        <div className="p-10 text-center text-xs text-gray-500 bg-white rounded-2xl border border-gray-200">
          No slides yet. The trade landing page shows the standard hero.
        </div>
      ) : (
        <ul className="space-y-3">
          {slides.map((s) => (
            <li key={s.id} className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-white rounded-2xl border border-gray-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt="" className="w-40 h-16 object-cover rounded-xl bg-gray-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{s.title || '(image only)'}</p>
                <p className="text-[11px] text-gray-500 truncate">{s.subtitle || s.link || 'No link'}</p>
                <p className="text-[10px] text-gray-400">Order {s.order}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={s.active}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}
              >
                {s.active ? 'Live' : 'Off'}
              </button>
              <button type="button" onClick={() => setForm({ ...s })} className="text-xs font-bold text-[#840038] hover:underline">Edit</button>
              <button type="button" onClick={() => remove(s)} className="text-xs font-bold text-red-600 hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-bold text-gray-900">{form.id ? 'Edit slide' : 'New slide'}</h2>

            <div>
              <label className={label}>Banner image * <span className="font-normal normal-case text-gray-400">(wide, about 1600×600)</span></label>
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="w-full h-32 object-cover rounded-xl mb-2 bg-gray-100" />
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => upload(e.target.files?.[0])} className="text-xs" />
              {uploading && <p className="text-[11px] text-gray-500 mt-1">Uploading…</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={label}>Headline (optional) <span className="font-normal normal-case text-gray-400">— leave blank if the banner image already has text</span></label>
                <input className={field} maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Subtitle (optional)</label>
                <input className={field} maxLength={200} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              <div>
                <label className={label}>Badge</label>
                <input className={field} maxLength={30} placeholder="PROMO" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              </div>
              <div>
                <label className={label}>Button text</label>
                <input className={field} maxLength={30} placeholder="Shop the offer" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Link (a page like /trade/catalog, or an https address)</label>
                <input className={field} value={form.link} placeholder="/trade/catalog" onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>
              <div>
                <label className={label}>Order</label>
                <input type="number" className={field} value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Live on the landing page
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-700">Cancel</button>
              <button type="submit" disabled={saving || uploading || !form.image} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#840038] text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save slide'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

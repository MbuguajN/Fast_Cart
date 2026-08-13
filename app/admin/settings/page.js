'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    pollingInterval: 30,
    webhookSecret: '',
    autoSync: false,
    showOutOfStock: true,
    logo: null,
    background: null,
  });
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef(null);
  const bgInputRef = useRef(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      queueMicrotask(() => setSettings(data));
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async (updates = {}) => {
    const toSave = { ...settings, ...updates };
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        const updates = { [type]: data.url };
        setSettings(prev => ({ ...prev, ...updates }));
        await saveSettings(updates);
      }
    } catch { /* silent */ }
    setUploading(false);
  };

  const handleRemove = async (type) => {
    const updates = { [type]: null };
    setSettings(prev => ({ ...prev, ...updates }));
    await saveSettings(updates);
  };

  const Section = ({ title, desc, children }) => (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>{title}</h3>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );

  const Toggle = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ backgroundColor: value ? '#840037' : '#e5e7eb' }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ left: value ? '22px' : '2px' }}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your storefront and sync preferences</p>
      </div>

      {/* Branding */}
      <Section title="Branding" desc="Customize your storefront appearance">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">App Logo</p>
            <p className="text-[10px] text-gray-400">Recommended: 200×200px PNG with transparent background</p>
            <div className="flex gap-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0], 'logo')} />
              <button onClick={() => logoInputRef.current?.click()} disabled={uploading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all" style={{ backgroundColor: '#840037' }}>
                {uploading ? 'Uploading...' : settings.logo ? 'Change' : 'Upload'}
              </button>
              {settings.logo && (
                <button onClick={() => handleRemove('logo')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4" />

        {/* Background */}
        <div className="flex items-center gap-4">
          <div className="w-32 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
            {settings.background ? (
              <img src={settings.background} alt="Background" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Sign-in Background</p>
            <p className="text-[10px] text-gray-400">Recommended: 800×600px. A burgundy overlay will be applied.</p>
            <div className="flex gap-2">
              <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0], 'background')} />
              <button onClick={() => bgInputRef.current?.click()} disabled={uploading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all" style={{ backgroundColor: '#840037' }}>
                {uploading ? 'Uploading...' : settings.background ? 'Change' : 'Upload'}
              </button>
              {settings.background && (
                <button onClick={() => handleRemove('background')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Sync */}
      <Section title="Synchronization" desc="Control how data syncs with WooCommerce">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Auto-sync polling interval (seconds)</label>
          <input
            type="number"
            min={0} max={300}
            value={settings.pollingInterval}
            onChange={(e) => setSettings({ ...settings, pollingInterval: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 outline-none focus:border-[#840037]/40"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
          <p className="text-[10px] text-gray-400 mt-1">How often to check WooCommerce for changes. Set to 0 to disable.</p>
        </div>

        <div className="border-t border-gray-100 pt-4" />

        <Toggle
          label="Auto-sync on page load"
          desc="Automatically sync when admin panel is opened"
          value={settings.autoSync}
          onChange={(v) => { setSettings({ ...settings, autoSync: v }); saveSettings({ autoSync: v }); }}
        />
      </Section>

      {/* Display */}
      <Section title="Display" desc="Control what customers see">
        <Toggle
          label="Show out of stock items"
          desc={settings.showOutOfStock ? 'Showing out of stock products on storefront' : 'Hiding out of stock products from storefront'}
          value={settings.showOutOfStock}
          onChange={(v) => { setSettings({ ...settings, showOutOfStock: v }); saveSettings({ showOutOfStock: v }); }}
        />
      </Section>

      {/* Webhooks */}
      <Section title="Webhooks" desc="Configure WooCommerce webhook integration">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Webhook Secret</label>
          <input
            type="password"
            value={settings.webhookSecret}
            onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-200 outline-none focus:border-[#840037]/40"
            style={{ fontFamily: 'Inter, sans-serif' }}
            placeholder="Optional webhook secret for signature verification"
          />
        </div>
      </Section>

      {/* Save */}
      <button
        onClick={() => saveSettings()}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md"
        style={{ background: saved ? '#10b981' : 'linear-gradient(135deg, #840037, #b8004f)', fontFamily: 'Inter, sans-serif' }}
      >
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

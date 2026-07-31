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
    } catch {
      // use defaults
    }
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
    } catch {
      // silent
    }
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
    } catch {
      // silent
    }
    setUploading(false);
  };

  const handleRemove = async (type) => {
    const updates = { [type]: null };
    setSettings(prev => ({ ...prev, ...updates }));
    await saveSettings(updates);
  };

  return (
    <div>
      <h1
        className="text-xl font-bold mb-4"
        style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
      >
        Settings
      </h1>

      <div className="space-y-4 max-w-lg">
        {/* Logo Upload */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <label className="block text-sm font-semibold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            App Logo
          </label>
          <p className="text-xs mb-3" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            Logo displayed on the sign-in screen. Recommended: 200×200px PNG with transparent background.
          </p>
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
              style={{ borderColor: '#debfc3', backgroundColor: '#f8f9fa' }}
            >
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'logo')}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
              >
                {uploading ? 'Uploading...' : settings.logo ? 'Change Logo' : 'Upload Logo'}
              </button>
              {settings.logo && (
                <button
                  onClick={() => handleRemove('logo')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Background Upload */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <label className="block text-sm font-semibold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            Sign-in Background
          </label>
          <p className="text-xs mb-3" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            Background image for the sign-in screen header. Recommended: 800×600px. A burgundy overlay will be applied.
          </p>
          <div className="flex items-center gap-4">
            <div
              className="w-32 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
              style={{ borderColor: '#debfc3', backgroundColor: '#f8f9fa' }}
            >
              {settings.background ? (
                <img src={settings.background} alt="Background" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], 'background')}
              />
              <button
                onClick={() => bgInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
              >
                {uploading ? 'Uploading...' : settings.background ? 'Change Background' : 'Upload Background'}
              </button>
              {settings.background && (
                <button
                  onClick={() => handleRemove('background')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                  style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Polling */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <label className="block text-sm font-semibold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            Auto-sync polling interval (seconds)
          </label>
          <p className="text-xs mb-3" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            How often to check WooCommerce for inventory changes. Set to 0 to disable.
          </p>
          <input
            type="number"
            min={0}
            max={300}
            value={settings.pollingInterval}
            onChange={(e) => setSettings({ ...settings, pollingInterval: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
          />
        </div>

        {/* Auto sync toggle */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Auto-sync on page load
              </p>
              <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                Automatically sync when admin panel is opened
              </p>
            </div>
            <button
              onClick={() => {
                const updated = !settings.autoSync;
                setSettings({ ...settings, autoSync: updated });
                saveSettings({ autoSync: updated });
              }}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ backgroundColor: settings.autoSync ? '#840037' : '#E9ECEF' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ left: settings.autoSync ? '22px' : '2px' }}
              />
            </button>
          </div>
        </div>

        {/* Show out of stock toggle */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Out of stock items
              </p>
              <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                {settings.showOutOfStock ? 'Showing out of stock products' : 'Hiding out of stock products'}
              </p>
            </div>
            <button
              onClick={() => {
                const updated = !settings.showOutOfStock;
                setSettings({ ...settings, showOutOfStock: updated });
                saveSettings({ showOutOfStock: updated });
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: settings.showOutOfStock ? '#840037' : '#E9ECEF',
                color: settings.showOutOfStock ? '#ffffff' : '#5f5e5e',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {settings.showOutOfStock ? 'Showing' : 'Hidden'}
            </button>
          </div>
        </div>

        {/* Webhook secret */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <label className="block text-sm font-semibold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            Webhook secret
          </label>
          <p className="text-xs mb-3" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            Configure the same secret in WooCommerce webhook settings for signature verification.
          </p>
          <input
            type="password"
            value={settings.webhookSecret}
            onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm border"
            style={{ borderColor: '#E9ECEF', fontFamily: 'Montserrat, sans-serif' }}
            placeholder="Optional webhook secret"
          />
        </div>

        {/* Save */}
        <button
          onClick={() => saveSettings()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

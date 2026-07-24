'use client';

import { useState, useEffect, useCallback } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    pollingInterval: 30,
    webhookSecret: '',
    autoSync: false,
  });
  const [saved, setSaved] = useState(false);

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

  const saveSettings = async () => {
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
        Settings
      </h1>

      <div className="space-y-4 max-w-lg">
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
              onClick={() => setSettings({ ...settings, autoSync: !settings.autoSync })}
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
          onClick={saveSettings}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

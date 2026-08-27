'use client';

import { useState } from 'react';
import { NEIGHBORHOODS } from '@/lib/products';

export default function LocationModal({ currentLocation, onConfirm, onClose }) {
  const [text, setText] = useState(currentLocation?.text || '');
  const [selected, setSelected] = useState(null);

  const handleSelect = (hood) => {
    setSelected(hood);
    setText(hood);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onConfirm({ text: text.trim(), lat: null, lng: null });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pink-50 text-[#840037] flex items-center justify-center shadow-xs">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                Delivery Location
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Set your delivery address in advance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center font-bold text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              Specific Address or Landmark
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSelected(null);
              }}
              placeholder="e.g. Kilimani, Rose Ave, Yaya Court Apt 4B"
              className="w-full rounded-2xl px-4 py-3.5 text-sm border border-gray-200 focus:border-[#840037] focus:ring-2 focus:ring-[#840037]/10 focus:outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
              Quick Pick Neighborhood
            </label>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {NEIGHBORHOODS.map((hood) => (
                <button
                  key={hood}
                  type="button"
                  onClick={() => handleSelect(hood)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selected === hood || text === hood
                      ? 'bg-[#840037] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {hood}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex-1 rounded-2xl py-3 text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              Save Address
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

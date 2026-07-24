'use client';

import { useState } from 'react';
import { NEIGHBORHOODS } from '@/lib/products';

export default function LocationModal({ onConfirm, onClose }) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState(null);

  const handleSelect = (hood) => {
    setSelected(hood);
    setText(hood);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onConfirm({ text: text.trim(), lat: null, lng: null });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#f5f5dc', border: '1px solid #E9ECEF' }}
      >
        <div className="text-center mb-6">
          <svg
            className="w-12 h-12 mx-auto mb-3"
            style={{ color: '#840037' }}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
          >
            Where are you?
          </h2>
          <p
            className="text-sm"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            Type your location or pick a neighborhood below
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSelected(null);
            }}
            placeholder="e.g. Kilimani, Rose Ave near Yaya, Gate 4B"
            className="w-full min-w-0 rounded-xl px-4 py-4 text-lg border focus:outline-none mb-4 box-border"
            style={{
              backgroundColor: '#F1F3F5',
              borderColor: '#E9ECEF',
              color: '#191c1d',
              fontFamily: 'Montserrat, sans-serif',
            }}
            autoFocus
          />

          <div className="flex flex-wrap gap-2 mb-6">
            {NEIGHBORHOODS.map((hood) => (
              <button
                key={hood}
                type="button"
                onClick={() => handleSelect(hood)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={{
                  backgroundColor: selected === hood ? '#840037' : '#F1F3F5',
                  color: selected === hood ? '#ffffff' : '#191c1d',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {hood}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-4 text-lg font-bold transition-colors"
              style={{
                backgroundColor: '#F1F3F5',
                color: '#5f5e5e',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex-1 rounded-xl py-4 text-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#840037',
                color: '#ffffff',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              Set Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

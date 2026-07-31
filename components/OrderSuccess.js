'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderSuccess({ order, onNewOrder }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleAddNote = async () => {
    if (!note.trim() || !order?.id) return;
    setSending(true);
    try {
      await fetch(`/api/orders/${order.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      setNoteSent(true);
    } catch {}
    setSending(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center"
        style={{ backgroundColor: '#f5f5dc', border: '1px solid #E9ECEF' }}
      >
        <svg
          className="w-16 h-16 mx-auto mb-4"
          style={{ color: '#840037' }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
        >
          Order Placed!
        </h2>
        <p
          className="mb-4"
          style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
        >
          Your order #{order.id} is being prepared
        </p>
        <div
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: '#F1F3F5' }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            Estimated delivery
          </div>
          <div
            className="font-bold text-lg"
            style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
          >
            30-45 minutes
          </div>
        </div>

        {/* Add Note */}
        {!noteSent ? (
          <div className="mb-4 text-left">
            <label
              className="block text-[10px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
            >
              Add a note to your order (optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="e.g. Ring the doorbell"
                className="flex-1 bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-sm"
                style={{
                  borderRadius: '12px',
                  border: '2px solid #debfc3',
                  padding: '8px 12px',
                  boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: 'pulse-border 2s ease-in-out infinite',
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#191c1d',
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!note.trim() || sending}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
              >
                {sending ? '...' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(132,0,55,0.08)', color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
            Note added to your order
          </div>
        )}

        <button
          onClick={() => router.push('/orders')}
          className="w-full rounded-xl py-3 text-sm font-bold transition-colors mb-2"
          style={{
            backgroundColor: '#840037',
            color: '#ffffff',
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          View My Orders
        </button>
        <button
          onClick={onNewOrder}
          className="w-full rounded-xl py-3 text-sm font-bold transition-colors"
          style={{
            backgroundColor: 'transparent',
            color: '#840037',
            border: '1px solid #840037',
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          Order More Drinks
        </button>
      </div>
    </div>
  );
}

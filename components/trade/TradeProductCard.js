'use client';

import React, { useState } from 'react';
import { useTrade } from '@/lib/trade/trade-context.js';

/**
 * The wholesale product card: image, tier ladder and add-to-order bar.
 * Shared by the catalogue and the trade landing page so they look and
 * behave the same.
 */
export default function TradeProductCard({ product: p, index = 0 }) {
  const { addToCart } = useTrade();
  const isJaba = p.priceLine === 'jaba';
  const step = isJaba ? 10 : 6;
  const [qty, setQty] = useState(isJaba ? 11 : 6);

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}
      className="group bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-[#840038]/30 hover:-translate-y-1 animate-card-rise"
    >
      {/* Full-width, prominent product image — same image-forward
          treatment as the retail ProductCard. */}
      <div className="relative h-44 sm:h-52 bg-white border-b border-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image || '/images/bottle-placeholder.png'}
          alt={p.name}
          className="absolute inset-0 w-full h-full object-contain p-5 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <div>
          <span className="text-[10px] font-bold uppercase text-[#840038] tracking-widest block truncate">
            {p.categoryName || 'Spirits'}
          </span>
          <h3 className="text-sm font-bold text-gray-900 leading-snug">{p.name}</h3>
          <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{p.sku}</span>
        </div>

        {/* Tier Ladder Matrix — inc-VAT for every price line, including Jaba,
            so there is one convention across the whole catalogue. */}
        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-1.5 text-xs">
          <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 border-b border-gray-200 pb-1">
            <span>Volume Band</span>
            <span>Unit Price (Inc-VAT)</span>
          </div>
          {p.tierPrices && Object.entries(p.tierPrices).map(([tierKey, data]) => (
            <div key={tierKey} className="flex justify-between items-center py-0.5">
              <span className="font-semibold text-gray-700">
                {tierKey} ({data.band})
              </span>
              <span className="font-mono font-bold text-gray-900">
                KES {data.unitPriceIncVat?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Add to Cart Bar */}
        <div className="pt-2 mt-auto border-t border-gray-100 flex items-center gap-2">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - step))}
              className="px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
            >
              -
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-12 text-center text-xs font-bold bg-transparent border-none focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => setQty(qty + step)}
              className="px-2.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={() => addToCart(p, qty)}
            className="flex-1 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
          >
            Add {qty} btls
          </button>
        </div>
      </div>
    </div>
  );
}

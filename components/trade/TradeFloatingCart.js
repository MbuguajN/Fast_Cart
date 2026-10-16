'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

/** Pages that already show the order, or are part of paying for it. */
const HIDDEN_ON = ['/trade/cart', '/trade/checkout', '/trade/order-pad'];

/**
 * Floating "view cart" pill for the trade side, the counterpart of the retail
 * FloatingCheckout. Shown only while the cart has bottles in it.
 */
export default function TradeFloatingCart() {
  const pathname = usePathname();
  const { cart, cartPricing } = useTrade();

  const bottles = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  if (bottles === 0 || HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null;

  const total = cartPricing?.grandTotal || 0;

  return (
    <div className="fixed bottom-6 left-0 sm:left-auto sm:right-6 w-full sm:w-auto z-40 px-4 sm:px-0 pointer-events-none flex justify-center sm:justify-end">
      <Link
        href="/trade/cart"
        aria-label={`View cart, ${bottles} bottles`}
        className="bg-[#840038] hover:bg-[#6b002c] text-white rounded-full px-6 py-3.5 flex items-center justify-between gap-6 w-full max-w-sm sm:w-auto pointer-events-auto active:scale-[0.98] hover:scale-105 transition-all duration-300 shadow-xl"
        style={{ boxShadow: '0 8px 24px rgba(132,0,56,0.35)' }}
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
            {bottles} bottle{bottles !== 1 ? 's' : ''}
          </span>
          <span className="text-base font-bold leading-none mt-0.5">
            KES {total.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold uppercase">View Cart</span>
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </div>
      </Link>
    </div>
  );
}

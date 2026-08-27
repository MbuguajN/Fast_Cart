'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeCartPage() {
  const router = useRouter();
  const { cart, updateQuantity, removeItem, clearCart, cartPricing, user, account } = useTrade();

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-[#231F20]">
        <div className="text-4xl">🛒</div>
        <h1 className="text-xl font-bold uppercase">Wholesale Order Cart is Empty</h1>
        <p className="text-xs text-gray-500">Add minimum 12 bottles / KES 10,000 goods value using the rapid Bulk Order Pad.</p>
        <Link
          href="/trade/order-pad"
          className="inline-block px-6 py-3 bg-[#840038] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow hover:bg-[#6b002c]"
        >
          Open Bulk Order Pad →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Order Review &amp; Tier Footing
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Wholesale Trade Cart
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/trade/order-pad"
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-700 hover:bg-gray-50"
          >
            + Add More Lines
          </Link>
          <button
            type="button"
            onClick={clearCart}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold uppercase hover:bg-red-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Cart Items Table & Order Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Items List (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 uppercase text-[10px] text-gray-500">
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-3 text-center">Tier</th>
                  <th className="py-3 px-3 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Line Total</th>
                  <th className="py-3 px-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {cartPricing.items.map((item) => (
                  <tr key={item.sku || item.id} className="hover:bg-gray-50/60">
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <span className="text-[10px] font-mono text-gray-400">{item.sku}</span>
                      {item.upgradeNudge && (
                        <div className="text-[10px] font-bold text-amber-700 mt-1">
                          ⚡ {item.upgradeNudge.message}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-pink-100 text-[#840038]">
                        {item.tierKey || 'Base'}
                      </span>
                    </td>

                    <td className="py-4 px-3 text-center">
                      <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                          className="px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.sku, parseInt(e.target.value, 10) || 0)}
                          className="w-12 text-center text-xs font-bold py-1 bg-transparent border-none focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                          className="px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-gray-800">
                      KES {item.unitPriceIncVat.toLocaleString()}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-black text-[#840038]">
                      KES {item.lineTotalIncVat.toLocaleString()}
                    </td>

                    <td className="py-4 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Footing Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
            Financial Footing
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Volume</span>
              <span className="font-bold text-gray-900">{cartPricing.totalBottles} bottles</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Goods Subtotal (Ex-VAT)</span>
              <span className="font-mono font-bold text-gray-900">
                KES {cartPricing.subtotalExVat.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>16% Kenya Standard VAT</span>
              <span className="font-mono font-bold text-gray-900">
                KES {cartPricing.vatTotal.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Delivery &amp; Handling</span>
              <span className="font-mono font-bold text-emerald-600">
                {cartPricing.delivery.isFreeDelivery ? 'FREE (Nairobi Metro)' : `KES ${cartPricing.deliveryFee.toLocaleString()}`}
              </span>
            </div>

            {cartPricing.referralCredit > 0 && (
              <div className="flex justify-between text-[#840038]">
                <span>Referral Credit</span>
                <span className="font-mono font-bold">- KES {cartPricing.referralCredit.toLocaleString()}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-bold uppercase text-gray-900">Grand Total</span>
              <span className="text-2xl font-black text-[#840038] font-sans">
                KES {cartPricing.grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Minimum Order Check Alert */}
          {!cartPricing.minOrderCheck.passed ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold space-y-1">
              <span className="font-bold block">⚠️ Minimum Order Rule</span>
              <p>{cartPricing.minOrderCheck.message}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/trade/checkout')}
              className="w-full py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
            >
              Proceed to Dispatch &amp; Terms →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


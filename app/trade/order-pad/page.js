'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';
import { resolveLineTier, calculateUpgradeNudge } from '@/lib/trade/pricing-engine.js';

export default function BulkOrderPadPage() {
  const router = useRouter();
  const { catalog, templates, cart, updateQuantity, clearCart, cartPricing, loadTemplateIntoCart, showNotification } = useTrade();
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Handle spreadsheet paste (e.g. "jameson-original-750ml, 24" or "Jameson 24")
  const handleParsePaste = () => {
    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let matchedCount = 0;

    lines.forEach((line) => {
      const parts = line.split(/[,\t]+/).map((p) => p.trim());
      if (parts.length >= 2) {
        const query = parts[0].toLowerCase();
        const qty = parseInt(parts[1], 10);
        if (!isNaN(qty) && qty > 0) {
          const product = catalog.find((p) => {
            if (!p) return false;
            const pSku = (p.sku || '').toLowerCase();
            const pName = (p.name || '').toLowerCase();
            return pSku.includes(query) || pName.includes(query);
          });
          if (product) {
            updateQuantity(product.sku, qty);
            matchedCount++;
          }
        }
      }
    });

    setPasteModalOpen(false);
    setPasteText('');
    showNotification(`Imported ${matchedCount} lines from spreadsheet paste!`, 'success');
  };

  const getQuantityForSku = (sku) => {
    const item = cart.find((i) => i.sku === sku);
    return item ? item.quantity : 0;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-36 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            High-Density Procurement
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Rapid Bulk Order Pad
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPasteModalOpen(true)}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5"
          >
            <span>📋 Paste from Excel</span>
          </button>
          <button
            type="button"
            onClick={clearCart}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold uppercase hover:bg-red-50 transition-all"
          >
            Clear Grid
          </button>
        </div>
      </div>

      {/* Segment Starter Quick-Load Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
          Quick Templates:
        </span>
        {templates?.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => loadTemplateIntoCart(tpl.items)}
            className="px-3 py-1.5 bg-white hover:bg-pink-50 border border-gray-200 hover:border-[#840038] text-[#840038] rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all whitespace-nowrap"
          >
            + {tpl.name}
          </button>
        ))}
      </div>

      {/* High-Density Order Grid */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c1917] text-white uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 font-bold">SKU / Product Name</th>
                <th className="py-3.5 px-3 font-bold text-center">Category</th>
                <th className="py-3.5 px-3 font-bold text-center">Order Qty</th>
                <th className="py-3.5 px-3 font-bold text-center">Qualified Tier</th>
                <th className="py-3.5 px-4 font-bold text-right">Unit Price (Inc-VAT)</th>
                <th className="py-3.5 px-4 font-bold text-right">Line Total</th>
                <th className="py-3.5 px-4 font-bold text-center">Upgrade Nudge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {catalog.map((product) => {
                const qty = getQuantityForSku(product.sku);
                const isSelected = qty > 0;
                const isJaba = product.priceLine === 'jaba';

                const tierRes = resolveLineTier({
                  sku: product.sku,
                  priceLine: product.priceLine,
                  prkCostIncVat: product.prkCostIncVat,
                  quantity: qty || (isJaba ? 11 : 6),
                });

                const upgradeNudge = calculateUpgradeNudge({
                  priceLine: product.priceLine,
                  prkCostIncVat: product.prkCostIncVat,
                  quantity: qty,
                });

                const lineTotal = qty * tierRes.unitPriceIncVat;

                return (
                  <tr
                    key={product.sku}
                    className={`transition-colors ${
                      isSelected ? 'bg-pink-50/40 hover:bg-pink-50/60' : 'hover:bg-gray-50/60'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{product.name}</div>
                      <span className="text-[10px] font-mono text-gray-400">{product.sku}</span>
                    </td>

                    <td className="py-3 px-3 text-center uppercase font-bold text-[10px] text-gray-500">
                      {product.categoryName}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, Math.max(0, qty - (isJaba ? 10 : 6)))}
                          className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty || ''}
                          placeholder="0"
                          onChange={(e) => updateQuantity(product.sku, Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-14 text-center text-xs font-bold py-1 bg-transparent border-none focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, qty + (isJaba ? 10 : 6))}
                          className="px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isSelected
                            ? 'bg-[#840038] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {tierRes.tierKey || (isJaba ? 'T0' : 'T1')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                      KES {tierRes.unitPriceIncVat.toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-[#840038]">
                      {isSelected ? `KES ${lineTotal.toLocaleString()}` : '—'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {upgradeNudge ? (
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.sku, upgradeNudge.nextBandMin)}
                          className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-all"
                        >
                          +{upgradeNudge.neededQuantity} btls to {upgradeNudge.targetTier} (Save KES {upgradeNudge.savingsPerBottle}/btl)
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold">Max Tier Qualified ✓</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-2xl p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-gray-400 block uppercase font-bold text-[10px]">Total Volume</span>
              <span className="text-lg font-bold text-gray-900">{cartPricing.totalBottles} bottles</span>
            </div>

            <div>
              <span className="text-gray-400 block uppercase font-bold text-[10px]">Goods Ex-VAT</span>
              <span className="text-lg font-mono font-bold text-gray-900">
                KES {cartPricing.subtotalExVat.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block uppercase font-bold text-[10px]">16% VAT</span>
              <span className="text-lg font-mono font-bold text-gray-900">
                KES {cartPricing.vatTotal.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block uppercase font-bold text-[10px]">Total Payable</span>
              <span className="text-2xl font-black text-[#840038]">
                KES {cartPricing.grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {!cartPricing.minOrderCheck.passed ? (
              <div className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                {cartPricing.minOrderCheck.message}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/trade/cart')}
                className="w-full md:w-auto px-8 py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
              >
                Proceed to Wholesale Cart &amp; Checkout →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Paste Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold uppercase text-gray-900">Paste Lines from Excel / CSV</h3>
              <button onClick={() => setPasteModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-xs text-gray-500">
              Format: <code>SKU or Product Name, Quantity</code> (one per line).
            </p>
            <textarea
              rows={6}
              placeholder="jameson-original-750ml, 24&#10;beefeater-london-dry-gin-750ml, 12&#10;jaba-beetroot-500ml, 50"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#840038]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParsePaste}
                className="px-5 py-2 bg-[#840038] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow hover:bg-[#6b002c]"
              >
                Import Lines →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


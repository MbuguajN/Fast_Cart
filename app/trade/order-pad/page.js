'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';
import { resolveLineTier, calculateUpgradeNudge } from '@/lib/trade/pricing-engine.js';
import {
  IconSearch,
  IconClipboard,
  IconSave,
  IconPlus,
  IconMinus,
  IconFilter,
  IconClose,
  IconCheck,
} from '@/components/trade/TradeIcons.js';

export default function BulkOrderPadPage() {
  const router = useRouter();
  const {
    catalog,
    templates,
    cart,
    updateQuantity,
    clearCart,
    cartPricing,
    loadTemplateIntoCart,
    saveTemplate,
    showNotification,
  } = useTrade();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyInOrder, setOnlyInOrder] = useState(false);

  // Modals State
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSegment, setTemplateSegment] = useState('horeca');
  const [templateDesc, setTemplateDesc] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Derive unique categories from catalog
  const categories = useMemo(() => {
    const set = new Set();
    catalog.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [catalog]);

  const getQuantityForSku = (sku) => {
    const item = cart.find((i) => i.sku === sku);
    return item ? item.quantity : 0;
  };

  const totalLinesInCart = cart.length;

  // Filter products by category, in-cart toggle, and search
  const filteredCatalog = useMemo(() => {
    let list = catalog || [];

    if (onlyInOrder) {
      list = list.filter((p) => cart.some((i) => i.sku === p.sku && i.quantity > 0));
    } else if (selectedCategory !== 'all') {
      list = list.filter((p) => p.categoryName === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const cat = (p.categoryName || '').toLowerCase();
        const brand = (p.brandName || '').toLowerCase();
        return name.includes(q) || sku.includes(q) || cat.includes(q) || brand.includes(q);
      });
    }

    return list;
  }, [catalog, onlyInOrder, selectedCategory, searchQuery, cart]);

  // Spreadsheet paste handler
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
            updateQuantity(product.sku, qty, product);
            matchedCount++;
          }
        }
      }
    });

    setPasteModalOpen(false);
    setPasteText('');
    showNotification(`Imported ${matchedCount} lines from spreadsheet paste!`, 'success');
  };

  // Save current order pad items as reusable starter template
  const handleSaveAsTemplate = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      showNotification('Please enter a template name', 'error');
      return;
    }
    if (cart.length === 0) {
      showNotification('Your order pad is empty. Add products first.', 'error');
      return;
    }

    try {
      setSavingTemplate(true);
      const itemsToSave = cart.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        priceLine: i.priceLine || 'spirits',
        prkCostIncVat: i.prkCostIncVat || 0,
      }));

      await saveTemplate({
        name: templateName.trim(),
        segment: templateSegment,
        description: templateDesc.trim() || `Saved order bundle with ${cart.length} lines.`,
        items: itemsToSave,
      });

      setSaveTemplateOpen(false);
      setTemplateName('');
      setTemplateDesc('');
    } catch {
      // notification handled in context
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-40 space-y-6 text-[#231F20] animate-page-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            High-Density Procurement
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Rapid Bulk Order Pad
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Wholesale quick-entry table with live volume tiers, case shortcuts, and instant search.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTemplateName(`Custom Order (${new Date().toLocaleDateString('en-GB')})`);
                setSaveTemplateOpen(true);
              }}
              className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-[#840038] border border-pink-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
              title="Save current lines as reusable starter bundle"
            >
              <IconSave className="w-4 h-4" />
              <span>Save as Template</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPasteModalOpen(true)}
            className="px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <IconClipboard className="w-4 h-4 text-gray-500" />
            <span>Paste from Excel</span>
          </button>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all quantities from the current order pad?')) {
                  clearCart();
                }
              }}
              className="px-3.5 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold uppercase hover:bg-red-50 transition-all shadow-xs"
            >
              Clear Grid
            </button>
          )}
        </div>
      </div>

      {/* Starter Templates Quick-Load Strip */}
      {templates?.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
            Quick Bundles:
          </span>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => loadTemplateIntoCart(tpl.items)}
              className="px-3 py-1.5 bg-white hover:bg-pink-50 border border-gray-200 hover:border-[#840038] text-[#840038] rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition-all whitespace-nowrap flex items-center gap-1"
            >
              <IconPlus className="w-3 h-3" />
              <span>{tpl.name}</span>
            </button>
          ))}
          <Link
            href="/trade/templates"
            className="px-2.5 py-1.5 text-gray-400 hover:text-[#840038] text-[11px] font-bold uppercase whitespace-nowrap transition-colors"
          >
            Manage Templates →
          </Link>
        </div>
      )}

      {/* Search & Category Filter Navigation Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search product name, SKU, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] transition-all"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <IconSearch className="w-4 h-4" />
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Counter / Toggle Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOnlyInOrder(!onlyInOrder);
                if (!onlyInOrder) setSelectedCategory('all');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shadow-xs ${
                onlyInOrder
                  ? 'bg-[#840038] text-white ring-2 ring-[#840038]/30'
                  : 'bg-pink-50 text-[#840038] border border-pink-200 hover:bg-pink-100'
              }`}
            >
              <IconFilter className="w-3.5 h-3.5" />
              <span>In My Order ({totalLinesInCart})</span>
            </button>

            <span className="text-xs font-medium text-gray-400 hidden sm:inline">
              Showing {filteredCatalog.length} of {catalog.length} lines
            </span>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setOnlyInOrder(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              selectedCategory === 'all' && !onlyInOrder
                ? 'bg-[#1c1917] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setOnlyInOrder(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                selectedCategory === cat && !onlyInOrder
                  ? 'bg-[#840038] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Order Grid */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c1917] text-white uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 font-bold">Product / SKU</th>
                <th className="py-3.5 px-3 font-bold text-center">Category</th>
                <th className="py-3.5 px-3 font-bold text-center">Order Quantity</th>
                <th className="py-3.5 px-3 font-bold text-center">Case Presets</th>
                <th className="py-3.5 px-3 font-bold text-center">Qualified Tier</th>
                <th className="py-3.5 px-4 font-bold text-right">Unit Price (Inc-VAT)</th>
                <th className="py-3.5 px-4 font-bold text-right">Line Total</th>
                <th className="py-3.5 px-4 font-bold text-center">Tier Optimization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredCatalog.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 space-y-2">
                    <p className="text-sm font-semibold">No products found matching your search or filters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                        setOnlyInOrder(false);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Reset Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredCatalog.map((product) => {
                  const qty = getQuantityForSku(product.sku);
                  const isSelected = qty > 0;
                  const isJaba = product.priceLine === 'jaba';

                  // Band matching (tierKey/eligible) doesn't depend on cost,
                  // only the price fields do — so those are read straight
                  // from the catalogue's public, override-corrected
                  // tierPrices ladder instead, same as the catalog page.
                  const rawTierRes = resolveLineTier({
                    sku: product.sku,
                    priceLine: product.priceLine,
                    quantity: qty || (isJaba ? 11 : 6),
                  });
                  const tierRes = {
                    ...rawTierRes,
                    unitPriceIncVat: product.tierPrices?.[rawTierRes.tierKey]?.unitPriceIncVat ?? 0,
                  };
                  // Standardized to inc-VAT for every price line, including
                  // Jaba — same convention as the catalog page.
                  const displayUnitPrice = tierRes.unitPriceIncVat;

                  const rawUpgradeNudge = calculateUpgradeNudge({
                    priceLine: product.priceLine,
                    quantity: qty,
                  });
                  const upgradeNudge = rawUpgradeNudge && (() => {
                    const nextTier = product.tierPrices?.[rawUpgradeNudge.targetTier];
                    const nextPrice = nextTier?.unitPriceIncVat ?? displayUnitPrice;
                    return { ...rawUpgradeNudge, savingsPerBottle: displayUnitPrice - nextPrice };
                  })();

                  const lineTotal = qty * displayUnitPrice;

                  return (
                    <tr
                      key={product.sku}
                      className={`transition-colors ${
                        isSelected ? 'bg-pink-50/50 hover:bg-pink-50/70' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 text-[13px]">{product.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-gray-400">{product.sku}</span>
                          {product.brandName && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-gray-100 text-gray-500">
                              {product.brandName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-center uppercase font-bold text-[10px] text-gray-500 whitespace-nowrap">
                        {product.categoryName}
                      </td>

                      {/* Precision Quantity Stepper */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.sku, Math.max(0, qty - 1), product)}
                            className="px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            title="Decrease quantity by 1"
                          >
                            <IconMinus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={qty || ''}
                            placeholder="0"
                            onChange={(e) =>
                              updateQuantity(
                                product.sku,
                                Math.max(0, parseInt(e.target.value, 10) || 0),
                                product
                              )
                            }
                            className="w-14 text-center text-xs font-bold py-1 bg-transparent border-none focus:outline-none focus:bg-pink-50/50"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.sku, qty + 1, product)}
                            className="px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-[#840038] transition-colors"
                            title="Increase quantity by 1"
                          >
                            <IconPlus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Wholesale Case Shortcut Buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {isJaba ? (
                            <>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 10, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 10 bottles"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 25, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 25 bottles"
                              >
                                +25
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 50, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 50 bottles"
                              >
                                +50
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 6, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 1 Case (6 bottles)"
                              >
                                +6
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 12, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 2 Cases (12 bottles)"
                              >
                                +12
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.sku, qty + 24, product)}
                                className="px-1.5 py-0.5 bg-gray-100 hover:bg-pink-100 hover:text-[#840038] text-gray-700 rounded text-[10px] font-bold transition-all"
                                title="Add 4 Cases (24 bottles)"
                              >
                                +24
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Qualified Tier */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-2xs ${
                            isSelected
                              ? 'bg-[#840038] text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {tierRes.tierKey || (isJaba ? 'T0' : 'T1')}
                        </span>
                      </td>

                      {/* Unit Price — inc-VAT for every price line. */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                        KES {displayUnitPrice.toLocaleString()}
                      </td>

                      {/* Line Total */}
                      <td className="py-3 px-4 text-right font-mono font-black text-[#840038]">
                        {isSelected ? `KES ${lineTotal.toLocaleString()}` : '—'}
                      </td>

                      {/* Tier Optimization Nudge */}
                      <td className="py-3 px-4 text-center">
                        {upgradeNudge ? (
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.sku, upgradeNudge.nextBandMin, product)}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-all shadow-2xs whitespace-nowrap"
                          >
                            +{upgradeNudge.neededQuantity} btls to {upgradeNudge.targetTier} (Save KES {upgradeNudge.savingsPerBottle}/btl)
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold flex items-center justify-center gap-1">
                            <IconCheck className="w-3 h-3 text-emerald-600" />
                            <span>Max Tier</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Dock */}
      <div className="fixed bottom-0 left-0 lg:left-72 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-2xl py-4 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
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
            {cartPricing.minOrderCheck && !cartPricing.minOrderCheck.passed ? (
              <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl text-center">
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
              <div className="flex items-center gap-2">
                <IconClipboard className="w-5 h-5 text-[#840038]" />
                <h3 className="text-base font-bold uppercase text-gray-900">Paste Lines from Excel / CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Format: <code>SKU or Product Name, Quantity</code> (one per line). Tab-delimited cells copied from Microsoft Excel or Google Sheets work automatically.
            </p>
            <textarea
              rows={6}
              placeholder="jameson-original-750ml, 24&#10;beefeater-london-dry-gin-750ml, 12&#10;jaba-beetroot-500ml, 50"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#840038]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase hover:bg-gray-50"
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

      {/* Save Order as Template Modal */}
      {saveTemplateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAsTemplate}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <IconSave className="w-5 h-5 text-[#840038]" />
                <h3 className="text-base font-bold uppercase text-gray-900">Save as Starter Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Save your current order pad configuration ({cart.length} lines, {cartPricing.totalBottles} bottles) as a reusable starter bundle for fast 1-click replenishment.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Weekly VIP Lounge Restock"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Sector / Segment
                </label>
                <select
                  value={templateSegment}
                  onChange={(e) => setTemplateSegment(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                >
                  <option value="horeca">HORECA (Hotels, Bars &amp; Restaurants)</option>
                  <option value="corporate">Corporate &amp; Offices</option>
                  <option value="events">Events &amp; Caterers</option>
                  <option value="general">General Wholesale</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Brief description of this stock replenishment pack..."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                />
              </div>
            </div>

            {/* Included Items Preview */}
            <div className="bg-gray-50 p-3 rounded-xl max-h-36 overflow-y-auto space-y-1 text-xs text-gray-700 font-medium">
              <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Items to be saved:</span>
              {cart.map((item) => (
                <div key={item.sku} className="flex justify-between items-center text-[11px]">
                  <span className="truncate max-w-[280px]">{item.name}</span>
                  <span className="font-bold text-[#840038] font-mono">{item.quantity} btls</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTemplate}
                className="px-5 py-2 bg-[#840038] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow hover:bg-[#6b002c] disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

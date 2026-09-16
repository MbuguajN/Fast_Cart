'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconClose,
  IconSearch,
  IconMinus,
} from '@/components/trade/TradeIcons.js';

export default function TradeTemplatesPage() {
  const router = useRouter();
  const {
    templates,
    catalog,
    loadTemplateIntoCart,
    saveTemplate,
    deleteTemplate,
    showNotification,
  } = useTrade();

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSegment, setTemplateSegment] = useState('horeca');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateItems, setTemplateItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Catalog picker search within modal
  const [catalogSearch, setCatalogSearch] = useState('');

  // Filter wholesale catalog for items to add to the template
  const availableProducts = useMemo(() => {
    if (!catalogSearch.trim()) return [];
    const q = catalogSearch.toLowerCase().trim();
    return (catalog || [])
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .slice(0, 8);
  }, [catalog, catalogSearch]);

  const handleApplyTemplate = (tpl) => {
    loadTemplateIntoCart(tpl.items);
    router.push('/trade/order-pad');
  };

  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSegment('horeca');
    setTemplateDesc('');
    setTemplateItems([]);
    setCatalogSearch('');
    setModalOpen(true);
  };

  const handleOpenEdit = (tpl) => {
    setEditingTemplateId(tpl.id);
    setTemplateName(tpl.name || '');
    setTemplateSegment(tpl.segment || 'horeca');
    setTemplateDesc(tpl.description || '');
    setTemplateItems(
      (tpl.items || []).map((it) => ({
        sku: it.sku,
        name: it.name,
        quantity: it.quantity || 1,
        priceLine: it.priceLine || 'spirits',
        prkCostIncVat: it.prkCostIncVat || 0,
      }))
    );
    setCatalogSearch('');
    setModalOpen(true);
  };

  const handleDelete = async (tpl) => {
    if (window.confirm(`Are you sure you want to delete the template "${tpl.name}"?`)) {
      try {
        await deleteTemplate(tpl.id);
      } catch {
        // notification handled in context
      }
    }
  };

  const handleAddItemToTemplate = (prod) => {
    const existingIdx = templateItems.findIndex((it) => it.sku === prod.sku);
    if (existingIdx >= 0) {
      const updated = [...templateItems];
      updated[existingIdx].quantity += prod.priceLine === 'jaba' ? 10 : 6;
      setTemplateItems(updated);
    } else {
      setTemplateItems([
        ...templateItems,
        {
          sku: prod.sku,
          name: prod.name,
          quantity: prod.priceLine === 'jaba' ? 10 : 6,
          priceLine: prod.priceLine || 'spirits',
          prkCostIncVat: prod.prkCostIncVat || 0,
        },
      ]);
    }
    setCatalogSearch('');
  };

  const handleUpdateItemQty = (sku, newQty) => {
    const qty = Math.max(0, parseInt(newQty, 10) || 0);
    if (qty === 0) {
      setTemplateItems((prev) => prev.filter((it) => it.sku !== sku));
    } else {
      setTemplateItems((prev) =>
        prev.map((it) => (it.sku === sku ? { ...it, quantity: qty } : it))
      );
    }
  };

  const handleRemoveItem = (sku) => {
    setTemplateItems((prev) => prev.filter((it) => it.sku !== sku));
  };

  const handleSubmitTemplate = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) {
      showNotification('Template name is required', 'error');
      return;
    }

    if (templateItems.length === 0) {
      showNotification('Please add at least one product to the template', 'error');
      return;
    }

    try {
      setSaving(true);
      await saveTemplate({
        id: editingTemplateId || undefined,
        name: templateName.trim(),
        segment: templateSegment,
        description: templateDesc.trim(),
        items: templateItems,
      });
      setModalOpen(false);
    } catch {
      // notification handled in context
    } finally {
      setSaving(false);
    }
  };

  const modalTotalBottles = templateItems.reduce((sum, it) => sum + (it.quantity || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Curated Bundles &amp; Recurring Stock
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Segment Starter Templates
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Preconfigured bundles designed for fast recurring stock replenishment by trade sector.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5"
          >
            <IconPlus className="w-4 h-4" />
            <span>+ Create New Template</span>
          </button>

          <Link
            href="/trade/order-pad"
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
          >
            Open Order Pad →
          </Link>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {templates?.map((tpl) => {
          const totalBottles = tpl.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
          return (
            <div
              key={tpl.id}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow relative group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-pink-100 text-[#840038]">
                    {tpl.segment?.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-500">{totalBottles} bottles</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(tpl)}
                      className="p-1.5 text-gray-400 hover:text-[#840038] hover:bg-pink-50 rounded-lg transition-all"
                      title="Edit this template"
                    >
                      <IconPencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete this template"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 uppercase">{tpl.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">{tpl.description}</p>
                </div>

                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <span>Included Lines</span>
                    <span>{tpl.items?.length || 0} SKUs</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-700 font-medium max-h-48 overflow-y-auto pr-1">
                    {tpl.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-0.5 border-b border-gray-50 last:border-none">
                        <span className="truncate max-w-[200px]">{item.name}</span>
                        <span className="font-bold text-[#840038] font-mono">{item.quantity} btls</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="w-full py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
                >
                  Load Template into Order Pad →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Create / Edit Template Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitTemplate}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">
                  {editingTemplateId ? 'Edit Starter Template' : 'Create New Starter Template'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure recurring stock packages for 1-click loading into the wholesale order pad.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Name & Segment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g. High-Volume Bar Weekend Pack"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                  >
                    <option value="horeca">HORECA</option>
                    <option value="corporate">Corporate</option>
                    <option value="events">Events</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  placeholder="Summary of products and intended replenishment frequency..."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                />
              </div>

              {/* Product Picker Search */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Add Products from Wholesale Catalog
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search wholesale catalog by product or SKU..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840038]"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    <IconSearch className="w-4 h-4" />
                  </div>
                </div>

                {/* Available Products Quick Dropdown */}
                {availableProducts.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                    {availableProducts.map((prod) => (
                      <div
                        key={prod.sku}
                        className="flex justify-between items-center p-2 hover:bg-pink-50 rounded-xl cursor-pointer transition-colors"
                        onClick={() => handleAddItemToTemplate(prod)}
                      >
                        <div>
                          <div className="font-bold text-xs text-gray-900">{prod.name}</div>
                          <div className="text-[10px] font-mono text-gray-400">{prod.sku}</div>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 bg-[#840038] text-white text-[10px] font-bold uppercase rounded-lg shadow-xs"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Template Items Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    Template Lines ({templateItems.length} SKUs, {modalTotalBottles} Bottles)
                  </span>
                </div>

                {templateItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-xs font-semibold">No products added yet.</p>
                    <p className="text-[11px] mt-0.5">Use the search box above to add lines to this bundle.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                    {templateItems.map((it) => (
                      <div key={it.sku} className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-gray-50/60">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-gray-900 truncate">{it.name}</div>
                          <div className="text-[10px] font-mono text-gray-400">{it.sku}</div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.sku, it.quantity - 1)}
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                            >
                              <IconMinus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleUpdateItemQty(it.sku, e.target.value)}
                              className="w-12 text-center text-xs font-bold py-1 border-none focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.sku, it.quantity + 1)}
                              className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                            >
                              <IconPlus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.sku)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove from template"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || templateItems.length === 0}
                className="px-6 py-2 bg-[#840038] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow hover:bg-[#6b002c] disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTemplateId ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

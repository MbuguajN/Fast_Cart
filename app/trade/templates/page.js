'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeTemplatesPage() {
  const router = useRouter();
  const { templates, loadTemplateIntoCart } = useTrade();

  const handleApplyTemplate = (tpl) => {
    loadTemplateIntoCart(tpl.items);
    router.push('/trade/order-pad');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Curated Bundles
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Segment Starter Templates
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Preconfigured bundles designed for fast recurring stock replenishment by trade sector.
          </p>
        </div>

        <Link
          href="/trade/order-pad"
          className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
        >
          Open Bulk Order Pad →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {templates?.map((tpl) => {
          const totalBottles = tpl.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
          return (
            <div
              key={tpl.id}
              className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-pink-100 text-[#840038]">
                    {tpl.segment?.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-500">{totalBottles} bottles</span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 uppercase">{tpl.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">{tpl.description}</p>
                </div>

                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Included Lines</span>
                  <div className="space-y-1.5 text-xs text-gray-700 font-medium">
                    {tpl.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="truncate max-w-[200px]">{item.name}</span>
                        <span className="font-bold text-[#840038]">{item.quantity} btls</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="w-full py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
              >
                Load Template into Order Pad →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


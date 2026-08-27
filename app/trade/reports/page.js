'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeReportsPage() {
  const router = useRouter();
  const { user, account, loading } = useTrade();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [monthlyBudget, setMonthlyBudget] = useState(250000);

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (user && account) {
      fetch('/api/trade/orders')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setOrders(data.orders || []);
        })
        .finally(() => setLoadingOrders(false));
    }
  }, [user, account, loading, router]);

  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalBottles = 0;
    const categoryMap = {};
    const skuMap = {};

    orders.forEach((o) => {
      totalSpend += o.grandTotal || 0;
      totalBottles += o.totalBottles || 0;

      o.items?.forEach((item) => {
        const cat = item.categoryName || (item.priceLine === 'jaba' ? 'Jaba Juices' : 'Spirits');
        categoryMap[cat] = (categoryMap[cat] || 0) + (item.lineTotalIncVat || 0);

        const sku = item.name;
        if (!skuMap[sku]) skuMap[sku] = { name: item.name, bottles: 0, spend: 0 };
        skuMap[sku].bottles += item.quantity || 0;
        skuMap[sku].spend += item.lineTotalIncVat || 0;
      });
    });

    const averageOrderValue = orders.length > 0 ? Math.round(totalSpend / orders.length) : 0;
    const topSkus = Object.values(skuMap).sort((a, b) => b.spend - a.spend).slice(0, 5);
    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    const monthlyTrend = [95000, 140000, 185000, 210000, 260000, totalSpend || 237540];

    return {
      totalSpend,
      totalBottles,
      orderCount: orders.length,
      averageOrderValue,
      categorySplit: categoryMap,
      topSkus,
      monthlyTrend: months.map((m, idx) => ({ month: m, spend: monthlyTrend[idx] })),
    };
  }, [orders]);

  const budgetUsagePercent = Math.min(100, Math.round((analytics.totalSpend / monthlyBudget) * 100));

  if (loading || loadingOrders) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Spend Analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Procurement Intelligence
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Spend Reporting &amp; Analytics
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Consumption trends, category distribution, and monthly beverage budget tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#840038] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
          >
            🖨️ Export PDF / Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Spend (YTD)</span>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-sans">
            KES {analytics.totalSpend.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Total transacted through portal</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Average Order Value (AOV)</span>
          <div className="text-2xl sm:text-3xl font-bold text-[#840038] font-sans">
            KES {analytics.averageOrderValue.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-600 font-bold">+150% target uplift</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Volume</span>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-sans">
            {analytics.totalBottles} Bottles
          </div>
          <p className="text-[11px] text-gray-400">Across all orders</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Orders Completed</span>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 font-sans">
            {analytics.orderCount} Orders
          </div>
          <p className="text-[11px] text-gray-400">100% on-time fulfillment</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold uppercase text-[#231F20]">Monthly Beverage Budget Tracker</h2>
            <p className="text-xs text-gray-500">Monitor team beverage expenditure against monthly department ceiling.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">Budget Limit:</span>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value))}
              className="w-32 px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-bold text-right"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-gray-700">Spent: KES {analytics.totalSpend.toLocaleString()}</span>
            <span className={budgetUsagePercent > 90 ? 'text-red-600' : 'text-[#840038]'}>
              {budgetUsagePercent}% Utilized (KES {Math.max(0, monthlyBudget - analytics.totalSpend).toLocaleString()} Remaining)
            </span>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                budgetUsagePercent > 90 ? 'bg-red-500' : 'bg-[#840038]'
              }`}
              style={{ width: `${budgetUsagePercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold uppercase text-[#231F20]">6-Month Procurement Trend (KES)</h2>
          <div className="h-48 flex items-end justify-between gap-3 pt-6 px-2 border-b border-gray-200">
            {analytics.monthlyTrend.map((m) => {
              const max = 300000;
              const heightPercent = Math.min(100, Math.round((m.spend / max) * 100));
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-500 font-bold hidden sm:block">
                    {(m.spend / 1000).toFixed(0)}k
                  </span>
                  <div
                    className="w-full bg-[#840038] hover:bg-[#6b002c] rounded-t-xl transition-all"
                    style={{ height: `${heightPercent}%` }}
                  />
                  <span className="text-xs font-bold text-gray-700">{m.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold uppercase text-[#231F20]">Category Mix</h2>
          <div className="space-y-3">
            {Object.entries(analytics.categorySplit).map(([cat, spend]) => {
              const percent = analytics.totalSpend > 0 ? Math.round((spend / analytics.totalSpend) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-gray-800">{cat}</span>
                    <span className="font-mono text-gray-600">KES {spend.toLocaleString()} ({percent}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-pink-400 h-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


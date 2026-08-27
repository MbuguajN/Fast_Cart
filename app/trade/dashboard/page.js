'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeDashboardPage() {
  const router = useRouter();
  const { user, account, loading, loadTemplateIntoCart } = useTrade();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

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

  if (loading || !account || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Trade Portal...</span>
        </div>
      </div>
    );
  }

  // Calculate MTD spend
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const mtdSpend = orders
    .filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  const openOrdersCount = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const creditHeadroom = account.creditEnabled ? Math.max(0, (account.creditLimit || 0) - (account.creditUsed || 0)) : 0;
  const recentOrder = orders[0];

  const handleQuickReorder = (order) => {
    if (!order?.items) return;
    loadTemplateIntoCart(order.items);
    router.push('/trade/order-pad');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-pink-100 text-[#840038]">
              {account.segment?.toUpperCase()} PORTAL
            </span>
            {account.tierOverride && (
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                Key Account ({account.tierOverride} Override)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#231F20] mt-1">
            {account.tradingName}
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Active User: <strong className="text-gray-800">{user.name}</strong> ({user.role}) · Seat: <strong className="text-[#840038] uppercase">{user.seatType}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/trade/order-pad"
            className="px-6 py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span>+ Open Bulk Order Pad</span>
          </Link>
        </div>
      </div>

      {/* 4 Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Tile 1: Spend MTD */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Spend (Month to Date)
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-gray-900">
            KES {mtdSpend.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-500">Across {orders.length} total orders</p>
        </div>

        {/* Tile 2: Open Orders */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Open Orders
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-[#840038]">
            {openOrdersCount} Orders
          </div>
          <p className="text-[11px] text-emerald-600 font-bold">100% on-time dispatch</p>
        </div>

        {/* Tile 3: Credit Available */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Credit Available (Net 14)
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-gray-900">
            {account.creditEnabled ? `KES ${creditHeadroom.toLocaleString()}` : 'Prepayment'}
          </div>
          <p className="text-[11px] text-gray-500">
            {account.creditEnabled ? `Limit: KES ${account.creditLimit?.toLocaleString()}` : '3 paid orders to unlock credit'}
          </p>
        </div>

        {/* Tile 4: Delivery Dock */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Receiving Dock
          </span>
          <div className="text-sm font-bold text-gray-900 truncate">
            {account.addresses?.[0]?.label || 'Main Store'}
          </div>
          <p className="text-[11px] text-gray-500 truncate">
            {account.addresses?.[0]?.addressLine || 'Nairobi'}
          </p>
        </div>
      </div>

      {/* Main Grid: Quick Reorder & Account Manager Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Quick Reorder (8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
                Fast Replenishment
              </span>
              <h2 className="text-lg font-bold uppercase text-[#231F20]">1-Click Quick Reorder</h2>
            </div>
            {recentOrder && (
              <button
                onClick={() => handleQuickReorder(recentOrder)}
                className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow transition-all active:scale-95"
              >
                Reorder Last Basket ({recentOrder.orderNumber}) →
              </button>
            )}
          </div>

          {recentOrder ? (
            <div className="space-y-3">
              <span className="text-xs text-gray-500 font-medium">
                Last ordered on {new Date(recentOrder.createdAt).toLocaleDateString()} · {recentOrder.totalBottles} bottles · KES {recentOrder.grandTotal.toLocaleString()}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {recentOrder.items?.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-gray-900 block truncate max-w-[200px]">{item.name}</span>
                      <span className="text-[10px] font-mono text-gray-500">{item.sku} · Tier {item.tierKey}</span>
                    </div>
                    <span className="font-bold text-[#840038]">{item.quantity} btls</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-gray-500">
              No previous orders found. Start your first order using the Bulk Order Pad.
            </div>
          )}
        </div>

        {/* Right Column: Dedicated Account Specialist (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038] block">
            Dedicated Account Support
          </span>

          <div className="flex items-center gap-4">
            <img
              src={account.accountManager?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'}
              alt="Account Manager"
              className="w-14 h-14 rounded-2xl object-cover border-2 border-pink-200 shadow"
            />
            <div>
              <h3 className="text-sm font-bold uppercase text-gray-900">{account.accountManager?.name}</h3>
              <p className="text-xs text-gray-500">{account.accountManager?.role}</p>
              <span className="text-[10px] text-emerald-600 font-bold">● Available Online (EAT)</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <a
              href={`https://wa.me/${account.accountManager?.phone?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow transition-all"
            >
              <span>💬 1-Tap WhatsApp Direct</span>
            </a>
            <a
              href={`tel:${account.accountManager?.phone}`}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
            >
              <span>📞 Call {account.accountManager?.phone}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}


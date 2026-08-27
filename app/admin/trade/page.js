'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function AdminTradePage() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [marginReport, setMarginReport] = useState(null);
  const [config, setConfig] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Accounts Filters
  const [accountSearch, setAccountSearch] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [accountSegmentFilter, setAccountSegmentFilter] = useState('all');

  // Margins Filters
  const [marginSearch, setMarginSearch] = useState('');
  const [marginFloorOnly, setMarginFloorOnly] = useState(false);

  // Quotes Filters
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('all');
  const [selectedQuote, setSelectedQuote] = useState(null);

  // Account Vetting Modal
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [vettingNotes, setVettingNotes] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState(0);
  const [tierOverrideInput, setTierOverrideInput] = useState('');

  // Cost Importer State
  const [csvText, setCsvText] = useState(`jameson-original-750ml,2900\nchivas-regal-12yo-750ml,3700\nthe-glenlivet-12yo-750ml,5500\nbeefeater-london-dry-gin-750ml,2000`);
  const [diffResult, setDiffResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAllAdminData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/trade/accounts').then((r) => r.json()),
      fetch('/api/admin/trade/margin-report').then((r) => r.json()),
      fetch('/api/admin/trade/config').then((r) => r.json()),
      fetch('/api/admin/trade/quotes').then((r) => r.json()),
    ])
      .then(([accRes, margRes, cfgRes, qRes]) => {
        if (accRes.success) setAccounts(accRes.accounts || []);
        if (margRes.success) setMarginReport(margRes.report);
        if (cfgRes.success) setConfig(cfgRes.config);
        if (qRes.success) setQuotes(qRes.quotes || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const handleUpdateStatus = async (accountId, status) => {
    try {
      const res = await fetch(`/api/admin/trade/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          statusNotes: vettingNotes,
          creditLimit: creditLimitInput,
          creditEnabled: creditLimitInput > 0,
          tierOverride: tierOverrideInput || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      showToast(`Account status updated to ${status}!`);
      setSelectedAccount(null);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCostImport = async (isDryRun) => {
    try {
      setImporting(true);
      const res = await fetch('/api/admin/trade/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText, isDryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setDiffResult(data.result);
      if (!isDryRun) {
        showToast(`Successfully applied ${data.result.totalParsed} PRK cost updates!`);
        loadAllAdminData();
      } else {
        showToast('Dry-run diff calculated! Review tier impacts below.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const q = accountSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (acc.tradingName || '').toLowerCase().includes(q) ||
        (acc.legalName || '').toLowerCase().includes(q) ||
        (acc.kraPin || '').toLowerCase().includes(q) ||
        (acc.licenceNo || '').toLowerCase().includes(q);

      const matchStatus = accountStatusFilter === 'all' || acc.status === accountStatusFilter;
      const matchSegment = accountSegmentFilter === 'all' || acc.segment === accountSegmentFilter;

      return matchSearch && matchStatus && matchSegment;
    });
  }, [accounts, accountSearch, accountStatusFilter, accountSegmentFilter]);

  const pendingAccountsCount = useMemo(
    () => accounts.filter((a) => a.status === 'pending').length,
    [accounts]
  );

  // Filtered Margins
  const filteredOrders = useMemo(() => {
    if (!marginReport?.orders) return [];
    return marginReport.orders.filter((o) => {
      const q = marginSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.invoiceNumber || '').toLowerCase().includes(q) ||
        (o.accountName || '').toLowerCase().includes(q);

      const matchFloor = !marginFloorOnly || o.isSubMarginFloor;
      return matchSearch && matchFloor;
    });
  }, [marginReport, marginSearch, marginFloorOnly]);

  const subFloorCount = useMemo(
    () => marginReport?.orders?.filter((o) => o.isSubMarginFloor).length || 0,
    [marginReport]
  );

  // Filtered Quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter((qItem) => {
      const q = quoteSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (qItem.quoteNumber || '').toLowerCase().includes(q) ||
        (qItem.accountName || '').toLowerCase().includes(q) ||
        (qItem.notes || '').toLowerCase().includes(q);

      const matchStatus = quoteStatusFilter === 'all' || qItem.status === quoteStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotes, quoteSearch, quoteStatusFilter]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading B2B Trade Hub...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto pb-20 font-sans">
      {/* Header & Tabs */}
      <div className="bg-white px-6 py-5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#840038] text-white">
              B2B Trade Hub
            </span>
            <span className="text-xs text-gray-500 font-medium">Wholesale Pricing &amp; Account Vetting</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mt-1">
            Trade Management &amp; Margins
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto bg-gray-100 p-1 rounded-xl">
          {[
            { id: 'accounts', label: 'Accounts', badge: pendingAccountsCount > 0 ? pendingAccountsCount : null, badgeColor: 'bg-amber-500 text-white' },
            { id: 'quotes', label: 'Quotes', count: quotes.length },
            { id: 'margins', label: 'Margin Audit', badge: subFloorCount > 0 ? `${subFloorCount} Alert` : null, badgeColor: 'bg-red-500 text-white' },
            { id: 'costs', label: 'PRK Costs' },
            { id: 'config', label: 'Tiers &amp; Rules' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white text-[#840038] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span dangerouslySetInnerHTML={{ __html: tab.label }} />
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && !tab.badge && (
                <span className="text-[10px] text-gray-400 font-mono">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
          notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* TAB 1: ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Streamlined Filter Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search trading name, legal name, KRA PIN, licence..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden focus:border-[#840038] focus:ring-1 focus:ring-[#840038] transition-all"
                />
                {accountSearch && (
                  <button
                    onClick={() => setAccountSearch('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-700 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Segment Dropdown */}
              <select
                value={accountSegmentFilter}
                onChange={(e) => setAccountSegmentFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden cursor-pointer text-gray-700 font-medium"
              >
                <option value="all">All Segments</option>
                <option value="horeca">HORECA (Hotels / Bars)</option>
                <option value="corporate">Corporate Accounts</option>
                <option value="events">Events &amp; Caterers</option>
                <option value="retail">Retail Stockists</option>
                <option value="residences">Residences</option>
              </select>

              {/* Status Segmented Buttons */}
              <div className="flex items-center bg-gray-200/70 p-0.5 rounded-xl text-xs">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Pending', count: pendingAccountsCount },
                  { id: 'active', label: 'Active' },
                  { id: 'suspended', label: 'Suspended' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setAccountStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      accountStatusFilter === st.id
                        ? 'bg-white text-gray-900 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>{st.label}</span>
                    {st.count > 0 && (
                      <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                        {st.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Clear Filters Reset */}
              {(accountSearch || accountStatusFilter !== 'all' || accountSegmentFilter !== 'all') && (
                <button
                  onClick={() => {
                    setAccountSearch('');
                    setAccountStatusFilter('all');
                    setAccountSegmentFilter('all');
                  }}
                  className="text-xs text-[#840038] hover:underline font-semibold px-2 py-1 flex items-center gap-1"
                >
                  <span>Reset</span>
                  <span>✕</span>
                </button>
              )}
            </div>

            <span className="text-xs text-gray-500 font-medium shrink-0">
              Showing <strong>{filteredAccounts.length}</strong> of {accounts.length} accounts
            </span>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto">
            {filteredAccounts.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-2">
                <p className="text-sm font-semibold">No trade accounts match your filter criteria.</p>
                <button
                  onClick={() => {
                    setAccountSearch('');
                    setAccountStatusFilter('all');
                    setAccountSegmentFilter('all');
                  }}
                  className="text-xs font-bold text-[#840038] hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Account / Legal Name</th>
                    <th className="py-3 px-3">Segment</th>
                    <th className="py-3 px-3">KRA PIN</th>
                    <th className="py-3 px-3">Licence Status</th>
                    <th className="py-3 px-3">Credit Terms</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredAccounts.map((acc) => {
                    const isPending = acc.status === 'pending';
                    return (
                      <tr key={acc.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900 text-sm">{acc.tradingName}</div>
                          <div className="text-[11px] text-gray-400 font-normal">{acc.legalName}</div>
                        </td>
                        <td className="py-3.5 px-3 uppercase font-bold text-[10px] text-[#840038]">
                          <span className="bg-pink-50 text-[#840038] px-2 py-0.5 rounded-md">
                            {acc.segment}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-gray-700">
                          {acc.kraPin || '—'}
                        </td>
                        <td className="py-3.5 px-3">
                          {acc.licenceNo ? (
                            <div>
                              <span className="font-mono text-gray-800 block">{acc.licenceNo}</span>
                              <span className="text-[10px] text-gray-400 font-normal">Exp: {acc.licenceExpiry || 'N/A'}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">No Licence</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {acc.creditEnabled ? (
                            <div>
                              <span className="font-bold text-emerald-700 block">KES {acc.creditLimit?.toLocaleString()}</span>
                              <span className="text-[10px] text-gray-400 font-normal">Used: KES {acc.creditUsed?.toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">Prepayment (Cash)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                            acc.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60 animate-pulse'
                              : 'bg-red-50 text-red-700 border border-red-200/60'
                          }`}>
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(acc);
                              setCreditLimitInput(acc.creditLimit || 0);
                              setTierOverrideInput(acc.tierOverride || '');
                              setVettingNotes(acc.statusNotes || '');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                              isPending
                                ? 'bg-[#840038] hover:bg-[#6b002c] text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            }`}
                          >
                            {isPending ? 'Review Vetting →' : 'Edit Account'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: QUOTES */}
      {activeTab === 'quotes' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {/* Quotes Filter Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search quote number, account name, notes..."
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="w-full pl-8.5 pr-8 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden focus:border-[#840038] focus:ring-1 focus:ring-[#840038] transition-all"
                />
                {quoteSearch && (
                  <button
                    onClick={() => setQuoteSearch('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-700 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center bg-gray-200/70 p-0.5 rounded-xl text-xs">
                {['all', 'sent', 'accepted', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setQuoteStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                      quoteStatusFilter === st
                        ? 'bg-white text-gray-900 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {st === 'sent' ? 'Pending Review' : st}
                  </button>
                ))}
              </div>

              {(quoteSearch || quoteStatusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQuoteSearch('');
                    setQuoteStatusFilter('all');
                  }}
                  className="text-xs text-[#840038] hover:underline font-semibold px-2 py-1"
                >
                  Reset ✕
                </button>
              )}
            </div>

            <span className="text-xs text-gray-500 font-medium">
              Showing <strong>{filteredQuotes.length}</strong> quotes
            </span>
          </div>

          {/* Quotes Table */}
          <div className="overflow-x-auto">
            {filteredQuotes.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p className="text-sm font-semibold">No trade quotes found.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Quote #</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-3">Items / Bottles</th>
                    <th className="py-3 px-3 text-right">Value (Inc-VAT)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredQuotes.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">{q.quoteNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {q.accountName}
                        {q.notes && <div className="text-[11px] text-gray-400 font-normal truncate max-w-xs">{q.notes}</div>}
                      </td>
                      <td className="py-3.5 px-3 text-gray-600">
                        {q.items?.length || 0} lines ({q.totalBottles || 0} btls)
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-gray-900 font-mono">
                        KES {q.grandTotal?.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          q.status === 'accepted'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : q.status === 'sent'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedQuote(q)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold"
                        >
                          View Lines →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MARGIN REPORT */}
      {activeTab === 'margins' && marginReport && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total B2B Revenue</span>
              <div className="text-xl font-bold text-gray-900 mt-1">KES {marginReport.totalRevenue?.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Input PRK Cost</span>
              <div className="text-xl font-bold text-gray-900 mt-1">KES {marginReport.totalCost?.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Gross Profit</span>
              <div className="text-xl font-bold text-emerald-600 mt-1">KES {marginReport.totalGrossProfit?.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400">Overall Gross Margin</span>
              <div className="text-xl font-bold text-[#840038] mt-1">{marginReport.overallGrossMarginPercent}%</div>
            </div>
          </div>

          {/* Margins Table & Filter */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
              <div className="flex flex-1 items-center gap-2.5">
                <div className="relative flex-1 max-w-sm">
                  <input
                    type="text"
                    placeholder="Search order #, invoice #, account name..."
                    value={marginSearch}
                    onChange={(e) => setMarginSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden focus:border-[#840038]"
                  />
                  {marginSearch && (
                    <button onClick={() => setMarginSearch('')} className="absolute inset-y-0 right-0 pr-2.5 text-gray-400 text-xs">✕</button>
                  )}
                </div>

                <button
                  onClick={() => setMarginFloorOnly(!marginFloorOnly)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    marginFloorOnly
                      ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs font-bold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  ⚠️ Sub-Floor Alerts Only ({subFloorCount})
                </button>
              </div>

              <span className="text-xs text-gray-500 font-medium">
                Floor Threshold: &ge; <strong>{marginReport.gmFloorPercent}%</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Order / Invoice</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-3 text-right">Revenue (KES)</th>
                    <th className="py-3 px-3 text-right">Cost (KES)</th>
                    <th className="py-3 px-3 text-right">Gross Profit</th>
                    <th className="py-3 px-3 text-center">GM %</th>
                    <th className="py-3 px-3 text-center">Floor Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium font-mono">
                  {filteredOrders.map((o) => (
                    <tr key={o.orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-800">{o.orderNumber} ({o.invoiceNumber})</td>
                      <td className="py-3 px-4 font-sans font-bold text-gray-900">{o.accountName}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{o.revenue.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-gray-500">{o.cost.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-bold">{o.grossProfit.toLocaleString()}</td>
                      <td className="py-3 px-3 text-center font-bold text-gray-900 font-sans">{o.grossMarginPercent}%</td>
                      <td className="py-3 px-3 text-center font-sans">
                        {o.isSubMarginFloor ? (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                            ⚠️ SUB-FLOOR
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            HEALTHY
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRK COST IMPORTER */}
      {activeTab === 'costs' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">PRK CSV Cost Importer &amp; Tier Engine Diff</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live input cost changes automatically update Tier 1 (+10%), Tier 2 (+7%), and Tier 3 (+4%) wholesale prices.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              <label className="block text-xs font-bold text-gray-700">
                Paste CSV Lines (SKU, Cost Inc-VAT)
              </label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:ring-1 focus:ring-[#840038] outline-hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => handleCostImport(true)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
                >
                  🔍 Preview Dry-Run Diff
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => handleCostImport(false)}
                  className="flex-1 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold shadow-2xs"
                >
                  ✓ Commit Cost Update
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 bg-gray-50 p-4 rounded-2xl border border-gray-200 overflow-x-auto">
              <span className="text-[10px] font-bold uppercase text-gray-500 block mb-2">
                {diffResult ? `${diffResult.totalParsed} SKUs in Diff Preview` : 'Click "Preview Dry-Run Diff" to evaluate tier price impacts'}
              </span>

              {diffResult?.diffs && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-gray-500 border-b border-gray-200">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2 text-right">Old Cost</th>
                      <th className="pb-2 text-right">New Cost</th>
                      <th className="pb-2 text-center">New T1 / T2 / T3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-mono">
                    {diffResult.diffs.map((d, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-bold text-gray-800">{d.sku}</td>
                        <td className="py-2 text-right text-gray-500">KES {d.oldCost}</td>
                        <td className="py-2 text-right font-bold text-[#840038]">KES {d.newCost}</td>
                        <td className="py-2 text-center text-gray-900 font-sans text-[11px]">
                          T1: <strong>KES {d.newTierPrices.T1}</strong> · T2: <strong>KES {d.newTierPrices.T2}</strong> · T3: <strong>KES {d.newTierPrices.T3}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TIER & RULES CONFIG */}
      {activeTab === 'config' && config && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-6">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
            Pricing Engine Band &amp; Commerce Rules Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold uppercase text-[#840038]">Spirits Markups on PRK Cost (Inc-VAT)</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Tier 1 (6–24 bottles)</span>
                  <span className="font-bold font-mono">+10.0% markup</span>
                </div>
                <div className="flex justify-between">
                  <span>Tier 2 (25–72 bottles)</span>
                  <span className="font-bold font-mono">+7.0% markup</span>
                </div>
                <div className="flex justify-between">
                  <span>Tier 3 (73+ bottles)</span>
                  <span className="font-bold font-mono">+4.0% markup</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold uppercase text-[#840038]">Jaba Artisan Elixirs Band Prices (Ex-VAT)</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>T0 (1–10 bottles)</span>
                  <span className="font-bold font-mono">KES 800 ex-VAT</span>
                </div>
                <div className="flex justify-between">
                  <span>T1 (11–50 bottles)</span>
                  <span className="font-bold font-mono">KES 750 ex-VAT</span>
                </div>
                <div className="flex justify-between">
                  <span>T2 (51–100 bottles)</span>
                  <span className="font-bold font-mono">KES 700 ex-VAT</span>
                </div>
                <div className="flex justify-between">
                  <span>T3 (101–200 bottles)</span>
                  <span className="font-bold font-mono">KES 650 ex-VAT</span>
                </div>
                <div className="flex justify-between">
                  <span>T4 (201+ bottles)</span>
                  <span className="font-bold font-mono">KES 600 ex-VAT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Vetting Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl text-gray-900 animate-slide-up">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase">{selectedAccount.tradingName}</h3>
                <p className="text-xs text-gray-500">Legal: {selectedAccount.legalName}</p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">
                <div>KRA PIN: <strong className="font-mono">{selectedAccount.kraPin || 'N/A'}</strong></div>
                <div>Licence: <strong className="font-mono">{selectedAccount.licenceNo || 'N/A'}</strong></div>
                <div>Expiry: <strong>{selectedAccount.licenceExpiry || 'N/A'}</strong></div>
                <div>Segment: <strong className="uppercase">{selectedAccount.segment}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Credit Limit (KES)
                </label>
                <input
                  type="number"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Contracted Tier Override (Admin Pin)
                </label>
                <select
                  value={tierOverrideInput}
                  onChange={(e) => setTierOverrideInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium bg-white text-xs"
                >
                  <option value="">No Override (Dynamic Quantity Bands)</option>
                  <option value="T1">Pin to Tier 1</option>
                  <option value="T2">Pin to Tier 2 (Key Account)</option>
                  <option value="T3">Pin to Tier 3 (Distributor Level)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reviewer Vetting Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified KRA PIN &amp; Liquor Board licence on 26/08."
                  value={vettingNotes}
                  onChange={(e) => setVettingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedAccount.id, 'suspended')}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-xl text-xs font-bold hover:bg-red-50"
              >
                Suspend Account
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedAccount.id, 'active')}
                className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Approve &amp; Activate Account →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-4 shadow-2xl text-gray-900 animate-slide-up">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold font-mono">{selectedQuote.quoteNumber}</h3>
                <p className="text-xs text-gray-500">Account: <strong>{selectedQuote.accountName}</strong></p>
              </div>
              <button onClick={() => setSelectedQuote(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500">
                    <tr>
                      <th className="p-2.5">Item</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Ex-VAT</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedQuote.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium">{item.name}</td>
                        <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                        <td className="p-2.5 text-right font-mono">KES {item.unitPriceExVat}</td>
                        <td className="p-2.5 text-right font-mono font-bold">KES {item.lineTotalExVat?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-right">
                <div className="text-xs text-gray-500">Subtotal Ex-VAT: <strong>KES {selectedQuote.subtotalExVat?.toLocaleString()}</strong></div>
                <div className="text-xs text-gray-500">VAT Total: <strong>KES {selectedQuote.vatTotal?.toLocaleString()}</strong></div>
                <div className="text-sm font-bold text-[#840038]">Grand Total: KES {selectedQuote.grandTotal?.toLocaleString()}</div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



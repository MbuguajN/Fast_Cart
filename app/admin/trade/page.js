'use client';

import React, { useState, useEffect } from 'react';

export default function AdminTradePage() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [marginReport, setMarginReport] = useState(null);
  const [config, setConfig] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [vettingNotes, setVettingNotes] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState(0);
  const [tierOverrideInput, setTierOverrideInput] = useState('');

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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-20">
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#840038] text-white">
              B2B TRADE HUB
            </span>
            <span className="text-[10px] font-bold text-gray-500 font-mono">Module v1.0</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black uppercase text-gray-900 tracking-tight mt-1">
            Trade Accounts, Pricing &amp; Margin Control
          </h1>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto bg-gray-100 p-1.5 rounded-xl">
          {[
            { id: 'accounts', label: `Accounts (${accounts.length})` },
            { id: 'costs', label: 'PRK Cost Importer' },
            { id: 'margins', label: 'Margin Report' },
            { id: 'config', label: 'Tier & Rules Config' },
            { id: 'quotes', label: `Quotes (${quotes.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-[#840038] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl text-xs font-bold text-white shadow-lg ${
          notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {notification.msg}
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold uppercase text-gray-900">Trade Accounts &amp; Vetting Worklist</h2>
            <span className="text-xs text-gray-500">
              {accounts.filter((a) => a.status === 'pending').length} Pending Applications
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 uppercase text-[10px] text-gray-500 font-bold">
                  <th className="py-3 px-4">Account / Legal Name</th>
                  <th className="py-3 px-3">Segment</th>
                  <th className="py-3 px-3">KRA PIN</th>
                  <th className="py-3 px-3">Licence Status</th>
                  <th className="py-3 px-3">Credit Terms</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {accounts.map((acc) => {
                  const isPending = acc.status === 'pending';
                  return (
                    <tr key={acc.id} className="hover:bg-gray-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{acc.tradingName}</div>
                        <div className="text-[11px] text-gray-400">{acc.legalName}</div>
                      </td>
                      <td className="py-3 px-3 uppercase font-bold text-[10px] text-[#840038]">
                        {acc.segment}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-gray-700">
                        {acc.kraPin || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {acc.licenceNo ? (
                          <div>
                            <span className="font-mono font-bold text-gray-800 block">{acc.licenceNo}</span>
                            <span className="text-[10px] text-gray-400">Exp: {acc.licenceExpiry || 'N/A'}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">No Licence</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {acc.creditEnabled ? (
                          <div>
                            <span className="font-bold text-emerald-700 block">KES {acc.creditLimit?.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400">Used: KES {acc.creditUsed?.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Prepayment (Cash)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          acc.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {acc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccount(acc);
                            setCreditLimitInput(acc.creditLimit || 0);
                            setTierOverrideInput(acc.tierOverride || '');
                          }}
                          className="px-3 py-1.5 bg-[#840038] hover:bg-[#6b002c] text-white rounded-lg text-[11px] font-bold shadow transition-all"
                        >
                          {isPending ? 'Review Application →' : 'Edit Account'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold uppercase text-gray-900">PRK CSV Cost Importer &amp; Tier Engine Diff</h2>
            <p className="text-xs text-gray-500">
              Input cost changes update T1 (+10%), T2 (+7%), and T3 (+4%) pricing live.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              <label className="block text-xs font-bold uppercase text-gray-700">
                Paste CSV Lines (SKU, Cost Inc-VAT)
              </label>
              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#840038]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => handleCostImport(true)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  🔍 Preview Dry-Run Diff
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => handleCostImport(false)}
                  className="flex-1 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
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

      {activeTab === 'margins' && marginReport && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-bold uppercase text-gray-900">Real-Time Gross Margin &amp; Floor Monitoring</h2>
              <p className="text-xs text-gray-500">Alerts finance immediately to any sub-target-margin (&lt; {marginReport.gmFloorPercent}%) orders.</p>
            </div>
            <span className="text-sm font-black text-[#840038]">
              Overall Gross Margin: {marginReport.overallGrossMarginPercent}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total B2B Revenue</span>
              <div className="text-xl font-black text-gray-900 font-sans">KES {marginReport.totalRevenue.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Input PRK Cost</span>
              <div className="text-xl font-black text-gray-900 font-sans">KES {marginReport.totalCost.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400">Total Gross Profit</span>
              <div className="text-xl font-black text-emerald-600 font-sans">KES {marginReport.totalGrossProfit.toLocaleString()}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 uppercase text-[10px] text-gray-500">
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
                {marginReport.orders.map((o) => (
                  <tr key={o.orderId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-800">{o.orderNumber} ({o.invoiceNumber})</td>
                    <td className="py-3 px-4 font-sans font-bold text-gray-900">{o.accountName}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{o.revenue.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-gray-500">{o.cost.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-emerald-600 font-bold">{o.grossProfit.toLocaleString()}</td>
                    <td className="py-3 px-3 text-center font-bold text-gray-900 font-sans">{o.grossMarginPercent}%</td>
                    <td className="py-3 px-3 text-center font-sans">
                      {o.isSubMarginFloor ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-800">
                          ⚠️ SUB-FLOOR
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
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
      )}

      {activeTab === 'config' && config && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-bold uppercase text-gray-900 border-b border-gray-100 pb-3">
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

      {selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl text-gray-900">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase">{selectedAccount.tradingName}</h3>
                <p className="text-xs text-gray-500">Legal: {selectedAccount.legalName}</p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl">
                <div>KRA PIN: <strong className="font-mono">{selectedAccount.kraPin || 'N/A'}</strong></div>
                <div>Licence: <strong className="font-mono">{selectedAccount.licenceNo || 'N/A'}</strong></div>
                <div>Expiry: <strong>{selectedAccount.licenceExpiry || 'N/A'}</strong></div>
                <div>Segment: <strong className="uppercase">{selectedAccount.segment}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Credit Limit (KES)
                </label>
                <input
                  type="number"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Contracted Tier Override (Admin Pin)
                </label>
                <select
                  value={tierOverrideInput}
                  onChange={(e) => setTierOverrideInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium bg-white"
                >
                  <option value="">No Override (Dynamic Quantity Bands)</option>
                  <option value="T1">Pin to Tier 1</option>
                  <option value="T2">Pin to Tier 2 (Key Account)</option>
                  <option value="T3">Pin to Tier 3 (Distributor Level)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Reviewer Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified KRA PIN &amp; Liquor Board licence on 26/08."
                  value={vettingNotes}
                  onChange={(e) => setVettingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedAccount.id, 'suspended')}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-xl text-xs font-bold uppercase hover:bg-red-50"
              >
                Suspend Account
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedAccount.id, 'active')}
                className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow"
              >
                Approve &amp; Activate Account →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


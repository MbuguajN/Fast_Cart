'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { IconDoc, IconTruck, IconDownload, IconMail, IconFolder, IconPencil, IconTrash, IconClock, IconRestore } from '@/components/trade/TradeIcons.js';

/**
 * Icon-only actions for a catalogue row — swapped in for the old text
 * buttons (Edit / History / Remove) specifically because the text labels
 * were widening the Actions column enough to force the products table into
 * horizontal scroll.
 */
function ProductActionIcons({ product, onEdit, onHistory, onToggleActive }) {
  const isRemoved = product.isActive === false;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        title="Edit name, category, brand or image"
      >
        <IconPencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onHistory(product)}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
        title="View inventory audit trail"
      >
        <IconClock className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onToggleActive(product)}
        className={`w-7 h-7 flex items-center justify-center rounded-lg ${isRemoved ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' : 'bg-red-50 hover:bg-red-100 text-red-700'}`}
        title={isRemoved ? 'Restore to the live trade catalogue' : 'Remove from the live trade catalogue'}
      >
        {isRemoved ? <IconRestore className="w-3.5 h-3.5" /> : <IconTrash className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

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

  // New Account Modal
  const emptyNewAccount = {
    tradingName: '',
    legalName: '',
    segment: 'horeca',
    kraPin: '',
    licenceNo: '',
    licenceExpiry: '',
    contactName: '',
    email: '',
    phone: '',
    status: 'active',
    creditEnabled: false,
    creditLimit: 0,
    creditTerms: 14,
  };
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState(emptyNewAccount);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Stock Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '', lines: [] });

  // Bulk Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importMeta, setImportMeta] = useState({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '' });
  const [importPreview, setImportPreview] = useState(null); // dry-run result
  const [importError, setImportError] = useState(null);
  const [importing, setImporting] = useState(false);

  // Products / Trade Catalogue & Live Stock
  const [products, setProducts] = useState([]);
  const [productCounts, setProductCounts] = useState({ total: 0, spirits: 0, jaba: 0, missingCost: 0, lowStock: 0, outOfStock: 0 });
  const [productSearch, setProductSearch] = useState('');
  const [productLineFilter, setProductLineFilter] = useState('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [missingCostOnly, setMissingCostOnly] = useState(false);
  const [showInactiveProducts, setShowInactiveProducts] = useState(false);


  // Live Inventory Stock Editing & Logs
  const [editingStockSku, setEditingStockSku] = useState(null);
  const [editingStockValue, setEditingStockValue] = useState('');
  const [savingStock, setSavingStock] = useState(false);
  const [historyModalProduct, setHistoryModalProduct] = useState(null);
  const [productLogs, setProductLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Trade Catalogue Product Editor (add new / edit metadata & image) — the
  // B2B catalogue is managed independently of retail here; the only tie to
  // retail is an optional "borrow this image" search.
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = create mode
  const [productForm, setProductForm] = useState({
    sku: '', name: '', priceLine: 'spirits', categoryName: '', brand: '',
    imageUrl: '', prkCostIncVat: '', stockQuantity: '', caseSize: '12',
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [retailSearchQuery, setRetailSearchQuery] = useState('');
  const [retailSearchResults, setRetailSearchResults] = useState([]);
  const [searchingRetail, setSearchingRetail] = useState(false);

  // Live Orders & Dispatch
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [dispatchModalOrder, setDispatchModalOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({ driverName: '', driverPhone: '', vehicleRegistration: '', sealNumber: '' });
  const [dispatching, setDispatching] = useState(false);

  // Admin New Quote Modal
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [newQuoteAccount, setNewQuoteAccount] = useState('');
  const [newQuoteItems, setNewQuoteItems] = useState([{ sku: '', quantity: 12 }]);
  const [newQuoteValidDays, setNewQuoteValidDays] = useState(14);
  const [newQuoteNotes, setNewQuoteNotes] = useState('');
  const [savingQuote, setSavingQuote] = useState(false);

  // Admin Email Quote Modal
  const [emailQuoteModal, setEmailQuoteModal] = useState(null);
  const [emailQuoteRecipient, setEmailQuoteRecipient] = useState('');
  const [emailQuoteNotes, setEmailQuoteNotes] = useState('');
  const [sendingQuoteEmail, setSendingQuoteEmail] = useState(false);

  // Trade User Management
  const [tradeUsers, setTradeUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userAccountFilter, setUserAccountFilter] = useState('all');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ accountId: '', name: '', email: '', phone: '', role: 'Business Owner', seatType: 'buyer' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [tempPasswordDisplay, setTempPasswordDisplay] = useState(null);
  const [resettingUserId, setResettingUserId] = useState(null);

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
      fetch('/api/admin/trade/products').then((r) => r.json()),
      fetch('/api/admin/trade/orders').then((r) => r.json()),
      fetch('/api/admin/trade/users').then((r) => r.json()),
    ])
      .then(([accRes, margRes, cfgRes, qRes, prodRes, ordRes, usrRes]) => {
        if (accRes.success) setAccounts(accRes.accounts || []);
        if (margRes.success) setMarginReport(margRes.report);
        if (cfgRes.success) setConfig(cfgRes.config);
        if (qRes.success) setQuotes(qRes.quotes || []);
        if (prodRes.success) {
          setProducts(prodRes.products || []);
          setProductCounts(prodRes.counts || { total: 0, spirits: 0, jaba: 0, missingCost: 0, lowStock: 0, outOfStock: 0 });
        }
        if (ordRes?.success) setOrders(ordRes.orders || []);
        if (usrRes?.success) setTradeUsers(usrRes.users || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadAllAdminData();
    });
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

  const handleCreateAccount = async () => {
    try {
      setCreatingAccount(true);
      const res = await fetch('/api/admin/trade/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccountForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      showToast(`Trade account "${data.account.tradingName}" created!`);
      setShowNewAccountModal(false);
      setNewAccountForm(emptyNewAccount);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handlePriceOverride = async (sku, tierKey, price) => {
    try {
      const res = await fetch('/api/admin/trade/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, priceOverride: { tierKey, price } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save override');
      showToast(price === null ? `Override cleared for ${sku} ${tierKey}` : `Price override saved for ${sku} ${tierKey}`);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExport = (priceLine = 'all') => {
    const qs = priceLine !== 'all' ? `?priceLine=${priceLine}` : '';
    window.open(`/api/admin/trade/stock/export${qs}`, '_blank');
  };

  const handleImportPreview = async () => {
    if (!importFile) { setImportError('Please select a CSV file'); return; }
    setImportError(null);
    setImportPreview(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('dryRun', 'true');
      Object.entries(importMeta).forEach(([k, v]) => fd.append(k, String(v)));
      const res = await fetch('/api/admin/trade/stock/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setImportPreview(data);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleImportCommit = async () => {
    if (!importFile || !importPreview) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('dryRun', 'false');
      Object.entries(importMeta).forEach(([k, v]) => fd.append(k, String(v)));
      const res = await fetch('/api/admin/trade/stock/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      showToast(`Receipt ${data.receipt.receiptNumber} created — ${data.receipt.lines.length} products updated!`);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      setImportMeta({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '' });
      loadAllAdminData();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSaveStock = async (sku) => {
    const qty = parseInt(editingStockValue, 10);
    if (isNaN(qty) || qty < 0) {
      showToast('Enter a valid non-negative stock quantity', 'error');
      return;
    }
    try {
      setSavingStock(true);
      const res = await fetch('/api/admin/trade/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, stockQuantity: qty, reason: 'Manual admin stock count adjustment' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');
      showToast(`Stock updated for ${sku}!`);
      setEditingStockSku(null);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingStock(false);
    }
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({ sku: '', name: '', priceLine: 'spirits', categoryName: '', brand: '', imageUrl: '', prkCostIncVat: '', stockQuantity: '0', caseSize: '12' });
    setRetailSearchQuery('');
    setRetailSearchResults([]);
    setShowProductModal(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      sku: product.sku,
      name: product.name,
      priceLine: product.priceLine,
      categoryName: product.categoryName || '',
      brand: product.brandName || '',
      imageUrl: product.image || '',
      prkCostIncVat: '', // not editable here — cost comes from receipts
      stockQuantity: String(product.stockQuantity ?? 0),
      caseSize: String(product.caseSize ?? 12),
    });
    setRetailSearchQuery('');
    setRetailSearchResults([]);
    setShowProductModal(true);
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductImage(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setProductForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingProductImage(false);
    }
  };

  const handleSearchRetailProducts = async (q) => {
    setRetailSearchQuery(q);
    if (q.trim().length < 2) {
      setRetailSearchResults([]);
      return;
    }
    setSearchingRetail(true);
    try {
      const res = await fetch('/api/admin/products');
      const all = await res.json();
      const needle = q.trim().toLowerCase();
      const matches = (Array.isArray(all) ? all : []).filter((p) =>
        (p.name || '').toLowerCase().includes(needle) || (p.sku || '').toLowerCase().includes(needle)
      ).slice(0, 12);
      setRetailSearchResults(matches);
    } catch (err) {
      console.error('Retail product search failed:', err);
    } finally {
      setSearchingRetail(false);
    }
  };

  const handleBorrowRetailImage = (retailProduct) => {
    const image = retailProduct.image || retailProduct.images?.[0];
    if (!image) {
      showToast('That retail product has no image to borrow', 'error');
      return;
    }
    setProductForm((prev) => ({ ...prev, imageUrl: image }));
    setRetailSearchResults([]);
    setRetailSearchQuery('');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.sku.trim() || !productForm.name.trim()) {
      showToast('SKU and name are required', 'error');
      return;
    }
    setSavingProduct(true);
    try {
      if (editingProduct) {
        const res = await fetch('/api/admin/trade/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: productForm.sku,
            name: productForm.name,
            categoryName: productForm.categoryName,
            brand: productForm.brand,
            imageUrl: productForm.imageUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update product');
        showToast(`${productForm.name} updated`);
      } else {
        const res = await fetch('/api/admin/trade/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: productForm.sku.trim(),
            name: productForm.name.trim(),
            priceLine: productForm.priceLine,
            categoryName: productForm.categoryName,
            brand: productForm.brand,
            imageUrl: productForm.imageUrl,
            prkCostIncVat: productForm.prkCostIncVat,
            stockQuantity: productForm.stockQuantity,
            caseSize: productForm.caseSize,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create product');
        showToast(`${productForm.name} added to the trade catalogue`);
      }
      setShowProductModal(false);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductActive = async (product) => {
    try {
      const res = await fetch('/api/admin/trade/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: product.sku, isActive: !product.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');
      showToast(product.isActive ? `${product.name} removed from the trade catalogue` : `${product.name} restored to the trade catalogue`);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleViewStockLogs = async (product) => {
    setHistoryModalProduct(product);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/admin/trade/products?sku=${encodeURIComponent(product.sku)}&logs=true`);
      const data = await res.json();
      if (data.success) {
        setProductLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleDispatchOrder = async (e) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;
    try {
      setDispatching(true);
      const res = await fetch(`/api/admin/trade/orders/${dispatchModalOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'dispatched',
          ...dispatchForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch order');
      showToast(`Order ${dispatchModalOrder.orderNumber} dispatched! Delivery note generated & emailed.`);
      setDispatchModalOrder(null);
      setDispatchForm({ driverName: '', driverPhone: '', vehicleRegistration: '', sealNumber: '' });
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/admin/trade/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status');
      showToast(`Order status updated to ${newStatus}!`);
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateAdminQuote = async (e) => {
    e.preventDefault();
    if (!newQuoteAccount) {
      showToast('Select an account for the quote', 'error');
      return;
    }
    const validItems = newQuoteItems.filter((i) => i.sku && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      showToast('Add at least one item to quote', 'error');
      return;
    }
    try {
      setSavingQuote(true);
      const targetAcc = accounts.find((a) => a.id === newQuoteAccount);
      const res = await fetch('/api/admin/trade/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: newQuoteAccount,
          accountName: targetAcc?.tradingName || 'Trade Client',
          items: validItems,
          validDays: parseInt(newQuoteValidDays, 10) || 14,
          notes: newQuoteNotes,
          tierOverride: targetAcc?.tierOverride || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quote');
      showToast(`Quote ${data.quote?.quoteNumber || ''} created successfully!`);
      setShowNewQuoteModal(false);
      setNewQuoteAccount('');
      setNewQuoteItems([{ sku: '', quantity: 12 }]);
      setNewQuoteNotes('');
      loadAllAdminData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingQuote(false);
    }
  };

  const handleSendQuoteEmail = async (e) => {
    e.preventDefault();
    if (!emailQuoteModal || !emailQuoteRecipient) return;
    try {
      setSendingQuoteEmail(true);
      const res = await fetch(`/api/admin/trade/quotes/${emailQuoteModal.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: emailQuoteRecipient,
          customNotes: emailQuoteNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send quote email');
      showToast(`Quote PDF emailed to ${emailQuoteRecipient}!`);
      setEmailQuoteModal(null);
      setEmailQuoteNotes('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingQuoteEmail(false);
    }
  };

  // Filtered Orders List
  const filteredOrdersList = useMemo(() => {
    return orders.filter((o) => {
      const q = orderSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.invoiceNumber || '').toLowerCase().includes(q) ||
        (o.accountName || '').toLowerCase().includes(q) ||
        (o.driverInfo?.driverName || '').toLowerCase().includes(q);

      const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Filtered Products
  const productCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.categoryName).filter(Boolean))).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = productSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.categoryName || '').toLowerCase().includes(q);
      const matchLine = productLineFilter === 'all' || p.priceLine === productLineFilter;
      const matchCategory = productCategoryFilter === 'all' || p.categoryName === productCategoryFilter;
      const matchMissing = !missingCostOnly || p.hasExplicitCost === false;
      const matchActive = showInactiveProducts || p.isActive !== false;
      return matchSearch && matchLine && matchCategory && matchMissing && matchActive;
    });
  }, [products, productSearch, productLineFilter, productCategoryFilter, missingCostOnly, showInactiveProducts]);

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

  // Analytics Calculations
  const analytics = useMemo(() => {
    if (!orders.length) return null;
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    const revenueByDay = last7Days.reduce((acc, date) => ({ ...acc, [date]: 0 }), {});
    const productSales = {};

    orders.forEach(o => {
      const date = new Date(o.createdAt || new Date()).toISOString().split('T')[0];
      if (revenueByDay[date] !== undefined) revenueByDay[date] += Number(o.grandTotal || 0);
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (!productSales[item.name]) productSales[item.name] = 0;
          productSales[item.name] += Number(item.quantity || 1);
        });
      }
    });

    const maxDailyRevenue = Math.max(...Object.values(revenueByDay), 1);
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxProductVolume = topProducts.length ? topProducts[0][1] : 1;

    return {
      revenueByDay: Object.entries(revenueByDay).map(([date, val]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        val, height: `${(val / maxDailyRevenue) * 100}%`
      })),
      topProducts: topProducts.map(([name, qty]) => ({ name, qty, width: `${(qty / maxProductVolume) * 100}%` }))
    };
  }, [orders]);

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
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto pb-20 font-sans">
      
      {/* Vertical Navigation Sidebar */}
      <div className="w-full lg:w-64 shrink-0 space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#840038] text-white">
              B2B Trade Hub
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1 leading-tight">
            Trade Management &amp; Margins
          </h1>
          <p className="text-[10px] text-gray-500 font-medium mt-1">Wholesale Pricing &amp; Account Vetting</p>
        </div>

        <nav className="bg-white p-2 rounded-2xl border border-gray-200/80 shadow-xs space-y-1">
          {[
            { id: 'orders', label: 'Orders &amp; Logistics', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>, count: orders.length },
            { id: 'analytics', label: 'Analytics Insights', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
            { id: 'accounts', label: 'Accounts', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>, badge: pendingAccountsCount > 0 ? pendingAccountsCount : null, badgeColor: 'bg-amber-500 text-white' },
            { id: 'quotes', label: 'Quotes', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, count: quotes.length },
            { id: 'products', label: 'Stock &amp; Costing', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>, badge: productCounts.outOfStock > 0 ? `${productCounts.outOfStock} OOS` : (productCounts.lowStock > 0 ? `${productCounts.lowStock} Low` : null), badgeColor: 'bg-amber-500 text-white' },
            { id: 'users', label: 'Users &amp; Seats', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, count: tradeUsers.length, badge: tradeUsers.filter(u => u.isLocked).length > 0 ? `${tradeUsers.filter(u => u.isLocked).length} Locked` : null, badgeColor: 'bg-red-500 text-white' },
            { id: 'margins', label: 'Margin Audit', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, badge: subFloorCount > 0 ? `${subFloorCount} Alert` : null, badgeColor: 'bg-red-500 text-white' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#840038] text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {tab.icon}
                </span>
                <span dangerouslySetInnerHTML={{ __html: tab.label }} />
              </div>
              {tab.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && !tab.badge && (
                <span className={`text-[10px] font-mono ${activeTab === tab.id ? 'text-pink-200' : 'text-gray-400'}`}>({tab.count})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-5">

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
          notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {notification.msg}
        </div>
      )}

      {/* TAB: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
            <div>
              <h2 className="text-base font-black text-gray-900">Performance Analytics</h2>
              <p className="text-xs text-gray-500 mt-1">Revenue and volume insights based on recent trade orders.</p>
            </div>
            {!analytics ? (
              <div className="py-20 text-center text-sm text-gray-400 font-medium">Not enough data to generate analytics.</div>
            ) : (
              <div className="mt-8 space-y-10">
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#840038]"></span>
                    7-Day Revenue Trend
                  </h3>
                  <div className="h-48 flex items-end gap-2 sm:gap-4 mt-6">
                    {analytics.revenueByDay.map((day, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-10">
                          KES {day.val.toLocaleString()}
                        </div>
                        <div className="w-full bg-pink-50 rounded-t-lg relative overflow-hidden flex items-end justify-center h-full">
                          <div className="w-full bg-[#840038] rounded-t-lg transition-all duration-700 ease-out" style={{ height: day.height, minHeight: day.val > 0 ? '4px' : '0' }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-500">{day.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Top Selling Products (Volume)
                  </h3>
                  <div className="space-y-4">
                    {analytics.topProducts.map((prod, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-6 text-xs font-black text-gray-400 text-right">#{i + 1}</div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-bold text-gray-800">{prod.name}</span>
                            <span className="font-bold text-[#840038]">{prod.qty} units</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: prod.width }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ORDERS & LOGISTICS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <input
                type="text"
                placeholder="Search order #, invoice #, client name, driver..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden focus:border-[#840038]"
              />
              <div className="flex items-center bg-gray-200/70 p-0.5 rounded-xl text-xs">
                {['all', 'confirmed', 'dispatched', 'delivered', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                      orderStatusFilter === st
                        ? 'bg-white text-gray-900 shadow-2xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              {(orderSearch || orderStatusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setOrderSearch('');
                    setOrderStatusFilter('all');
                  }}
                  className="text-xs text-[#840038] hover:underline font-semibold px-2 py-1"
                >
                  Reset ✕
                </button>
              )}
            </div>
            <span className="text-xs text-gray-500 font-medium shrink-0">
              Showing <strong>{filteredOrdersList.length}</strong> of {orders.length} orders
            </span>
          </div>

          <div className="overflow-x-auto">
            {filteredOrdersList.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p className="text-sm font-semibold">No trade orders match your filters.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                    <th className="py-3 px-4">Order / Invoice #</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-3">Bottles / Lines</th>
                    <th className="py-3 px-3 text-right">Value (KES)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3">Logistics &amp; Driver</th>
                    <th className="py-3 px-4 text-right">Documents &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredOrdersList.map((o) => {
                    const isDispatched = o.status === 'dispatched';
                    const isDelivered = o.status === 'delivered';
                    const isCancelled = o.status === 'cancelled';
                    const canDispatch = o.status === 'confirmed' || o.status === 'pending';

                    return (
                      <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          <div>{o.orderNumber || o.id}</div>
                          <div className="text-[10px] text-gray-400 font-normal">
                            {o.invoiceNumber || 'Pending Inv'} · {new Date(o.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">
                          <div>{o.accountName || 'Trade Client'}</div>
                          <div className="text-[10px] text-gray-500 font-normal truncate max-w-xs">
                            {o.shippingAddress?.street || o.shippingAddress?.city || ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700">
                          {o.totalBottles || 0} btls ({o.items?.length || 0} lines)
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                          <div>KES {Number(o.grandTotal || 0).toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400 font-sans font-normal uppercase">
                            {o.paymentMethod === 'pay_on_account' ? 'On Account' : 'Prepaid'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                              isDelivered
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isDispatched
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isCancelled
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {o.driverInfo?.driverName ? (
                            <div>
                              <div className="font-bold text-gray-800">
                                🚚 {o.driverInfo.driverName} ({o.driverInfo.vehicleRegistration})
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                Seal: <strong>{o.sealNumber || 'N/A'}</strong> · {o.driverInfo.driverPhone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          {/* Invoice PDF */}
                          <a
                            href={`/api/admin/trade/orders/${o.id}/invoice`}
                            download
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded-md inline-flex items-center gap-1"
                            title="Download Tax Invoice PDF"
                          >
                            <IconDoc className="w-3.5 h-3.5" />
                            <span>Inv</span>
                          </a>

                          {/* Delivery Note PDF */}
                          {(isDispatched || isDelivered) && (
                            <a
                              href={`/api/admin/trade/orders/${o.id}/delivery-note`}
                              download
                              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded-md inline-flex items-center gap-1"
                              title="Download Goods Received Note (GRN) / Delivery Note PDF"
                            >
                              <IconTruck className="w-3.5 h-3.5" />
                              <span>GRN</span>
                            </a>
                          )}

                          {/* Dispatch Trigger */}
                          {canDispatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchModalOrder(o);
                                setDispatchForm({
                                  driverName: '',
                                  driverPhone: '',
                                  vehicleRegistration: '',
                                  sealNumber: `SL-${Math.floor(100000 + Math.random() * 900000)}`,
                                });
                              }}
                              className="px-2.5 py-1 bg-[#840038] hover:bg-[#6b002c] text-white text-[11px] font-bold rounded-md"
                            >
                              Dispatch →
                            </button>
                          )}

                          {/* Mark Delivered */}
                          {isDispatched && (
                            <button
                              type="button"
                              onClick={() => handleUpdateOrderStatus(o.id, 'delivered')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md"
                            >
                              ✓ Delivered
                            </button>
                          )}

                          {/* Cancel Order */}
                          {!isDelivered && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Cancel order ${o.orderNumber}? Stock will be automatically restored to the warehouse.`)) {
                                  handleUpdateOrderStatus(o.id, 'cancelled');
                                }
                              }}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-md"
                            >
                              Cancel
                            </button>
                          )}
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

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                Showing <strong>{filteredAccounts.length}</strong> of {accounts.length} accounts
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewAccountForm(emptyNewAccount);
                  setShowNewAccountModal(true);
                }}
                className="px-3 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <span>+</span>
                <span>New Account</span>
              </button>
            </div>
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
                          <Link href={`/admin/trade/accounts/${acc.id}`} className="font-bold text-gray-900 text-sm hover:text-[#840038] hover:underline">
                            {acc.tradingName}
                          </Link>
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
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/trade/accounts/${acc.id}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs bg-gray-100 hover:bg-gray-200 text-gray-800 mr-2 inline-block"
                          >
                            View Details
                          </Link>
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
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                Showing <strong>{filteredQuotes.length}</strong> quotes
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewQuoteAccount(accounts[0]?.id || '');
                  setNewQuoteItems([{ sku: products[0]?.sku || '', quantity: 12 }]);
                  setShowNewQuoteModal(true);
                }}
                className="px-3 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Create New Quote</span>
              </button>
            </div>
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
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <a
                          href={`/api/admin/trade/quotes/${q.id}/pdf`}
                          download
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          title="Download Quote PDF"
                        >
                          <IconDownload className="w-3.5 h-3.5 text-gray-600" />
                          <span>PDF</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const acc = accounts.find((a) => a.id === q.accountId);
                            setEmailQuoteRecipient(acc?.users?.[0]?.email || acc?.billingAddress?.email || '');
                            setEmailQuoteModal(q);
                          }}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          title="Email Quote PDF to customer"
                        >
                          <IconMail className="w-3.5 h-3.5 text-[#840038]" />
                          <span>Email</span>
                        </button>
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

      {/* TAB: TRADE PRODUCT CATALOGUE */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <input
                type="text"
                placeholder="Search name, SKU, category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden focus:border-[#840038] focus:ring-1 focus:ring-[#840038]"
              />
              <select
                value={productLineFilter}
                onChange={(e) => setProductLineFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden cursor-pointer text-gray-700 font-medium"
              >
                <option value="all">All Price Lines</option>
                <option value="spirits">Spirits (PRK)</option>
                <option value="jaba">Jaba (Flat Tier)</option>
              </select>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white border border-gray-200 outline-hidden cursor-pointer text-gray-700 font-medium"
              >
                <option value="all">All Categories</option>
                {productCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 px-2">
                <input type="checkbox" checked={missingCostOnly} onChange={(e) => setMissingCostOnly(e.target.checked)} />
                Missing cost only
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 px-2">
                <input type="checkbox" checked={showInactiveProducts} onChange={(e) => setShowInactiveProducts(e.target.checked)} />
                Show removed
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative group">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1.5"
                  >
                    ↓ Export CSV
                    <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8L6 8z"/></svg>
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[150px] hidden group-hover:block">
                    <button type="button" onClick={() => handleExport('all')} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-medium text-gray-700">All products</button>
                    <button type="button" onClick={() => handleExport('spirits')} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-medium text-pink-700">Spirits only</button>
                    <button type="button" onClick={() => handleExport('jaba')} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-medium text-blue-700">Jaba only</button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowImportModal(true); setImportPreview(null); setImportError(null); setImportFile(null); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  ↑ Import CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  + Receive Stock
                </button>
                <button
                  type="button"
                  onClick={openCreateProductModal}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#840038] hover:bg-[#6b002c] text-white shadow-xs"
                >
                  + Add Product
                </button>
              </div>
            </div>
            <span className="text-xs text-gray-500 font-medium shrink-0">
              Showing <strong>{filteredProducts.length}</strong> of {productCounts.total} · {productCounts.missingCost} spirits without a cost on file
            </span>
          </div>

          {productCounts.missingCost > 0 && !missingCostOnly && (
            <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl">
              ⚠️ {productCounts.missingCost} spirits products have no cost on file — their tier prices are estimated from 75% of retail price until a real cost is entered.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">Price Line</th>
                  <th className="py-3 px-3 text-center">Live Stock</th>
                  <th className="py-3 px-3 text-right">Cost (Inc-VAT)</th>
                  <th className="py-3 px-3 text-right">Tier Prices</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredProducts.map((p) => (
                  <tr key={p.sku} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-gray-300 text-sm">🍾</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span className="truncate">{p.name}</span>
                            {p.isActive === false && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 bg-gray-200 text-gray-600 rounded shrink-0">Removed</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{p.sku} · {p.categoryName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${p.priceLine === 'spirits' ? 'bg-pink-50 text-[#840038]' : 'bg-blue-50 text-blue-700'}`}>
                        {p.priceLine}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {editingStockSku === p.sku ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            autoFocus
                            value={editingStockValue}
                            onChange={(e) => setEditingStockValue(e.target.value)}
                            className="w-16 px-1.5 py-1 border border-gray-300 rounded-lg text-center font-mono text-xs"
                          />
                          <button
                            type="button"
                            disabled={savingStock}
                            onClick={() => handleSaveStock(p.sku)}
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-[#840038] text-white"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStockSku(null)}
                            className="px-1.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className={`font-mono font-bold text-xs ${
                              p.stockQuantity <= 0
                                ? 'text-red-600'
                                : p.stockQuantity <= 10
                                ? 'text-amber-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {p.stockQuantity ?? 0}
                          </span>
                          <span className="text-[10px] text-gray-400">btls</span>
                          {p.stockQuantity <= 0 ? (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.2 bg-red-100 text-red-700 rounded">
                              OOS
                            </span>
                          ) : p.stockQuantity <= 10 ? (
                            <span className="text-[9px] font-bold uppercase px-1 py-0.2 bg-amber-100 text-amber-800 rounded">
                              Low
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStockSku(p.sku);
                              setEditingStockValue(String(p.stockQuantity ?? 0));
                            }}
                            className="ml-1 text-[11px] text-gray-400 hover:text-[#840038]"
                            title="Edit Stock Quantity"
                          >
                            ✎
                          </button>
                        </div>
                      )}
                    </td>
                    {p.priceLine === 'spirits' ? (
                      <>
                        <td className="py-3 px-3 text-right">
                          {p.hasExplicitCost ? (
                            <div>
                              <div className="font-bold text-gray-900">KES {p.prkCostIncVat?.toLocaleString()}</div>
                              {p.productCostIncVat !== null && (
                                <div className="text-[10px] text-gray-400">
                                  {p.productCostIncVat?.toLocaleString()} + {p.logisticsCostIncVat?.toLocaleString() || 0} lgx
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold uppercase text-amber-600">No cost — receive stock</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {p.tierPrices && Object.entries(p.tierPrices).map(([tierKey, t]) => (
                            <div key={tierKey} className="flex items-center justify-end gap-1.5 mb-0.5">
                              <span className="text-[10px] text-gray-400 w-6">{tierKey}</span>
                              <input
                                type="number"
                                defaultValue={t.actual}
                                onBlur={(e) => {
                                  const value = Number(e.target.value);
                                  if (value === t.suggested && t.overrideApplied) {
                                    handlePriceOverride(p.sku, tierKey, null);
                                  } else if (value !== t.actual) {
                                    handlePriceOverride(p.sku, tierKey, value);
                                  }
                                }}
                                className={`w-24 px-1.5 py-0.5 text-right text-[11px] rounded-md border ${
                                  t.status === 'blocked' ? 'border-red-400 bg-red-50' :
                                  t.status === 'flagged' ? 'border-amber-400 bg-amber-50' :
                                  t.overrideApplied ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                                }`}
                              />
                              {t.overrideApplied && <span className="text-[9px] text-blue-400" title={`Suggested: ${t.suggested}`}>✎</span>}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <ProductActionIcons
                            product={p}
                            onEdit={openEditProductModal}
                            onHistory={handleViewStockLogs}
                            onToggleActive={handleToggleProductActive}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right">
                          <div className="font-bold text-gray-900">KES {p.prkCostIncVat?.toLocaleString() ?? 0}</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {p.tierPrices && Object.entries(p.tierPrices).map(([tierKey, t]) => (
                            <div key={tierKey} className="flex items-center justify-end gap-1.5 mb-0.5">
                              <span className="text-[10px] text-gray-400 w-6">{tierKey}</span>
                              <input
                                type="number"
                                defaultValue={t.actual}
                                onBlur={(e) => {
                                  const value = Number(e.target.value);
                                  if (value === t.suggested && t.overrideApplied) {
                                    handlePriceOverride(p.sku, tierKey, null);
                                  } else if (value !== t.actual) {
                                    handlePriceOverride(p.sku, tierKey, value);
                                  }
                                }}
                                className={`w-24 px-1.5 py-0.5 text-right text-[11px] rounded-md border ${
                                  t.status === 'blocked' ? 'border-red-400 bg-red-50' :
                                  t.status === 'flagged' ? 'border-amber-400 bg-amber-50' :
                                  t.overrideApplied ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                                }`}
                              />
                              {t.overrideApplied && <span className="text-[9px] text-blue-400" title={`Suggested: ${t.suggested}`}>✎</span>}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <ProductActionIcons
                            product={p}
                            onEdit={openEditProductModal}
                            onHistory={handleViewStockLogs}
                            onToggleActive={handleToggleProductActive}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-8">No products match your filters.</p>
            )}
          </div>
        </div>
      )}


      {/* Pricing Engine Reference */}
      {activeTab === 'products' && (
        <details className="group bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none text-xs font-bold text-gray-600 hover:bg-gray-50 list-none">
            <span>ℹ Pricing Engine Reference — Spirits markups &amp; Jaba band prices</span>
            <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-gray-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 10.586L3.707 6.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0l5-5a1 1 0 00-1.414-1.414L8 10.586z"/></svg>
          </summary>
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-[#840038] tracking-wide">Spirits — PRK Landed Cost Markup</p>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-100"><span>Tier 1 &nbsp;·&nbsp; 6–24 bottles</span><span className="font-mono font-bold">+10.0%</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span>Tier 2 &nbsp;·&nbsp; 25–72 bottles</span><span className="font-mono font-bold">+7.0%</span></div>
                <div className="flex justify-between py-1"><span>Tier 3 &nbsp;·&nbsp; 73+ bottles</span><span className="font-mono font-bold">+4.0%</span></div>
              </div>
              <p className="text-[10px] text-gray-400">Inline tier inputs above override the suggested price. Red = below margin floor, amber = flagged, blue = manually overridden.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-blue-700 tracking-wide">Jaba Artisan Elixirs — Flat Band Prices (ex-VAT)</p>
              <div className="space-y-1 text-xs text-gray-700">
                <div className="flex justify-between py-1 border-b border-gray-100"><span>T0 &nbsp;·&nbsp; 1–10 bottles</span><span className="font-mono font-bold">KES 800</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span>T1 &nbsp;·&nbsp; 11–50 bottles</span><span className="font-mono font-bold">KES 750</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span>T2 &nbsp;·&nbsp; 51–100 bottles</span><span className="font-mono font-bold">KES 700</span></div>
                <div className="flex justify-between py-1 border-b border-gray-100"><span>T3 &nbsp;·&nbsp; 101–200 bottles</span><span className="font-mono font-bold">KES 650</span></div>
                <div className="flex justify-between py-1"><span>T4 &nbsp;·&nbsp; 201+ bottles</span><span className="font-mono font-bold">KES 600</span></div>
              </div>
              <p className="text-[10px] text-gray-400">Jaba pricing is quantity-band driven; landed cost does not apply.</p>
            </div>
          </div>
        </details>
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

      {/* New Account Modal */}
      {showNewAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl text-gray-900 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase">New Trade Account</h3>
                <p className="text-xs text-gray-500">Manually onboard an account that was vetted offline.</p>
              </div>
              <button onClick={() => setShowNewAccountModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Trading Name *</label>
                  <input
                    type="text"
                    value={newAccountForm.tradingName}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, tradingName: e.target.value })}
                    placeholder="e.g. Nairobi Serena Hotel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Legal Name</label>
                  <input
                    type="text"
                    value={newAccountForm.legalName}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, legalName: e.target.value })}
                    placeholder="Defaults to trading name if left blank"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Segment</label>
                  <select
                    value={newAccountForm.segment}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, segment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-xs"
                  >
                    <option value="horeca">HORECA (Hotels / Bars)</option>
                    <option value="corporate">Corporate Accounts</option>
                    <option value="events">Events &amp; Caterers</option>
                    <option value="retail">Retail Stockists</option>
                    <option value="residences">Residences</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Initial Status</label>
                  <select
                    value={newAccountForm.status}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">KRA PIN</label>
                  <input
                    type="text"
                    value={newAccountForm.kraPin}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, kraPin: e.target.value })}
                    placeholder="P051123456Z"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Liquor Licence No.</label>
                  <input
                    type="text"
                    value={newAccountForm.licenceNo}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, licenceNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="col-span-2 border-t border-gray-100 pt-3">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Primary Contact (optional — grants a portal seat)</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newAccountForm.contactName}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, contactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newAccountForm.email}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newAccountForm.phone}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, phone: e.target.value })}
                    placeholder="+2547..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs"
                  />
                </div>

                <div className="col-span-2 border-t border-gray-100 pt-3 flex items-center gap-2">
                  <input
                    id="creditEnabled"
                    type="checkbox"
                    checked={newAccountForm.creditEnabled}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, creditEnabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="creditEnabled" className="text-xs font-bold text-gray-700">Enable credit terms</label>
                </div>
                {newAccountForm.creditEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Credit Limit (KES)</label>
                      <input
                        type="number"
                        value={newAccountForm.creditLimit}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, creditLimit: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Terms (days)</label>
                      <input
                        type="number"
                        value={newAccountForm.creditTerms}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, creditTerms: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowNewAccountModal(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingAccount || !newAccountForm.tradingName.trim()}
                onClick={handleCreateAccount}
                className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {creatingAccount ? 'Creating…' : 'Create Account →'}
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

      {/* MODAL: CREATE NEW QUOTE (ADMIN) */}
      {showNewQuoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-4 my-8 text-gray-900">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-900">Issue Bespoke Volume Quotation</h3>
                <p className="text-xs text-gray-500">Calculate wholesale tier prices and issue official proposal</p>
              </div>
              <button onClick={() => setShowNewQuoteModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdminQuote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Trade Client Account *</label>
                <select
                  required
                  value={newQuoteAccount}
                  onChange={(e) => setNewQuoteAccount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:border-[#840038]"
                >
                  <option value="">Select an Account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tradingName} ({a.segment} · Tier {a.tierOverride || 'Auto'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase text-gray-700">Quotation Line Items</label>
                  <button
                    type="button"
                    onClick={() => setNewQuoteItems([...newQuoteItems, { sku: products[0]?.sku || '', quantity: 12 }])}
                    className="text-xs font-bold text-[#840038] hover:underline"
                  >
                    + Add Product Line
                  </button>
                </div>

                {newQuoteItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <select
                      value={item.sku}
                      onChange={(e) => {
                        const updated = [...newQuoteItems];
                        updated[idx].sku = e.target.value;
                        setNewQuoteItems(updated);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg"
                    >
                      {products.map((p) => (
                        <option key={p.sku} value={p.sku}>
                          {p.name} ({p.sku}) · Stock: {p.stockQuantity ?? 0}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...newQuoteItems];
                        updated[idx].quantity = e.target.value;
                        setNewQuoteItems(updated);
                      }}
                      className="w-20 px-2 py-1.5 text-xs text-center bg-white border border-gray-200 rounded-lg font-mono"
                      placeholder="Qty"
                    />

                    {newQuoteItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewQuoteItems(newQuoteItems.filter((_, i) => i !== idx))}
                        className="text-red-500 font-bold px-2 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Validity Period (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newQuoteValidDays}
                    onChange={(e) => setNewQuoteValidDays(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Special Notes / Conditions</label>
                  <input
                    type="text"
                    value={newQuoteNotes}
                    onChange={(e) => setNewQuoteNotes(e.target.value)}
                    placeholder="E.g. Includes delivery to Naivasha venue"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewQuoteModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuote}
                  className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {savingQuote ? 'Creating...' : 'Issue Quote →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL QUOTE TO CUSTOMER */}
      {emailQuoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 text-gray-900">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase">Email Quote PDF</h3>
                <p className="text-xs text-gray-500 font-mono">{emailQuoteModal.quoteNumber}</p>
              </div>
              <button onClick={() => setEmailQuoteModal(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSendQuoteEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Client Email Address *</label>
                <input
                  type="email"
                  required
                  value={emailQuoteRecipient}
                  onChange={(e) => setEmailQuoteRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  placeholder="client@hotel.co.ke"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Accompanying Message</label>
                <textarea
                  rows={3}
                  value={emailQuoteNotes}
                  onChange={(e) => setEmailQuoteNotes(e.target.value)}
                  placeholder="Attached please find your official quotation for review and sign-off..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEmailQuoteModal(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingQuoteEmail}
                  className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {sendingQuoteEmail ? 'Sending...' : 'Send Quotation Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISPATCH ORDER */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 text-gray-900">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-900">Dispatch Order &amp; Issue GRN</h3>
                <p className="text-xs text-gray-500">
                  {dispatchModalOrder.orderNumber} · {dispatchModalOrder.accountName}
                </p>
              </div>
              <button onClick={() => setDispatchModalOrder(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Driver Full Name *</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.driverName}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
                  placeholder="e.g. Peter Mwangi"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Driver Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  value={dispatchForm.driverPhone}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, driverPhone: e.target.value })}
                  placeholder="e.g. +254 722 000 111"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Vehicle Registration *</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.vehicleRegistration}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleRegistration: e.target.value })}
                  placeholder="e.g. KDF 452X"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Tamper-Evident Seal Number *</label>
                <input
                  type="text"
                  required
                  value={dispatchForm.sealNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, sealNumber: e.target.value })}
                  placeholder="e.g. SL-881922"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">This seal number prints on the Goods Received Note (GRN).</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setDispatchModalOrder(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {dispatching ? 'Dispatching...' : 'Confirm Dispatch & Generate GRN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVENTORY AUDIT TRAIL / LOGS */}
      {historyModalProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-4 text-gray-900 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-900">Inventory Stock Audit Trail</h3>
                <p className="text-xs text-gray-500 font-mono">
                  {historyModalProduct.name} ({historyModalProduct.sku}) · Live Balance: <strong>{historyModalProduct.stockQuantity ?? 0} btls</strong>
                </p>
              </div>
              <button onClick={() => setHistoryModalProduct(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 text-xs">
              {loadingLogs ? (
                <div className="p-8 text-center text-gray-400 font-bold animate-pulse">Loading stock history...</div>
              ) : productLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic">No inventory movements recorded yet.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-100">
                      <th className="p-2.5">Date &amp; Time</th>
                      <th className="p-2.5">Movement</th>
                      <th className="p-2.5 text-center">Change</th>
                      <th className="p-2.5 text-right">Balance</th>
                      <th className="p-2.5">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-xs">
                    {productLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="p-2.5 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-2.5 font-sans font-bold capitalize text-gray-800">
                          {log.reason?.replace(/_/g, ' ')}
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          <span className={log.change_qty > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-gray-900">{log.balance_after}</td>
                        <td className="p-2.5 text-gray-500 truncate max-w-[120px] font-sans">{log.reference_id || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryModalProduct(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 text-gray-900 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold uppercase text-gray-900">
                {editingProduct ? 'Edit Trade Product' : 'Add Trade Product'}
              </h3>
              <button type="button" onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">SKU</label>
                <input
                  type="text"
                  required
                  disabled={!!editingProduct}
                  value={productForm.sku}
                  onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Price Line</label>
                <select
                  disabled={!!editingProduct}
                  value={productForm.priceLine}
                  onChange={(e) => setProductForm((p) => ({ ...p, priceLine: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="spirits">Spirits (PRK tiers)</option>
                  <option value="jaba">Jaba (flat tiers)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Category</label>
                <input
                  type="text"
                  value={productForm.categoryName}
                  onChange={(e) => setProductForm((p) => ({ ...p, categoryName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Brand</label>
                <input
                  type="text"
                  value={productForm.brand}
                  onChange={(e) => setProductForm((p) => ({ ...p, brand: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                />
              </div>
            </div>

            {!editingProduct && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Opening Cost (Inc-VAT)</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.prkCostIncVat}
                    onChange={(e) => setProductForm((p) => ({ ...p, prkCostIncVat: e.target.value }))}
                    placeholder="e.g. 2000"
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm((p) => ({ ...p, stockQuantity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Case Size</label>
                  <input
                    type="number"
                    min="1"
                    value={productForm.caseSize}
                    onChange={(e) => setProductForm((p) => ({ ...p, caseSize: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3 space-y-2.5">
              <label className="block text-[10px] font-bold uppercase text-gray-500">Product Image</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {productForm.imageUrl ? (
                    <img src={productForm.imageUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-300 text-xl">🍾</span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <input
                    type="text"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="Image URL"
                    className="w-full px-3 py-1.5 rounded-lg text-[11px] border border-gray-200 font-mono"
                  />
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#840038] cursor-pointer">
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleProductImageUpload} />
                    {uploadingProductImage ? 'Uploading…' : '↑ Upload new image'}
                  </label>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={retailSearchQuery}
                  onChange={(e) => handleSearchRetailProducts(e.target.value)}
                  placeholder="Or borrow an image — search the retail catalog by name or SKU..."
                  className="w-full px-3 py-2 rounded-xl text-xs border border-gray-200"
                />
                {(searchingRetail || retailSearchResults.length > 0) && retailSearchQuery && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {searchingRetail ? (
                      <div className="p-3 text-[11px] text-gray-400 text-center">Searching…</div>
                    ) : (
                      retailSearchResults.map((rp) => (
                        <button
                          type="button"
                          key={rp.id || rp.wcId || rp.sku}
                          onClick={() => handleBorrowRetailImage(rp)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {(rp.image || rp.images?.[0]) ? (
                              <img src={rp.image || rp.images[0]} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-gray-300 text-xs">🍾</span>
                            )}
                          </div>
                          <span className="text-[11px] font-semibold text-gray-800 truncate">{rp.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {savingProduct ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Bulk Stock Import</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a CSV to record a goods-received batch. Required columns: <code className="bg-gray-100 px-1 rounded">sku</code>, <code className="bg-gray-100 px-1 rounded">cases</code>, <code className="bg-gray-100 px-1 rounded">unit_product_cost_inc_vat</code>.
                  Extra columns (e.g. from the export) are ignored.{' '}
                  <a href="/api/admin/trade/stock/import/template" className="text-[#840038] font-semibold underline" target="_blank" rel="noreferrer">
                    Download blank template ↓
                  </a>
                </p>
              </div>
              <button type="button" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportError(null); }} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4">✕</button>
            </div>

            {/* File Drop Zone */}
            <label className={`block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${importFile ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-[#840038] bg-gray-50'}`}>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImportFile(f);
                setImportPreview(null);
                setImportError(null);
              }} />
              {importFile ? (
                <div className="flex flex-col items-center">
                  <div className="mb-1 text-emerald-700"><IconDoc className="w-8 h-8 mx-auto" /></div>
                  <div className="text-xs font-bold text-emerald-700">{importFile.name}</div>
                  <div className="text-[10px] text-gray-400">{(importFile.size / 1024).toFixed(1)} KB — click to change</div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="mb-1 text-gray-400"><IconFolder className="w-8 h-8 mx-auto" /></div>
                  <div className="text-xs font-semibold text-gray-600">Click to select CSV file</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">or drag &amp; drop — .csv files only</div>
                </div>
              )}
            </label>

            {/* Logistics metadata */}
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Supplier name" value={importMeta.supplierName}
                onChange={(e) => setImportMeta({ ...importMeta, supplierName: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input placeholder="Reference / invoice #" value={importMeta.reference}
                onChange={(e) => setImportMeta({ ...importMeta, reference: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" min="0" placeholder="Freight (KES)" value={importMeta.freightCost || ''}
                onChange={(e) => setImportMeta({ ...importMeta, freightCost: Number(e.target.value) })}
                className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" min="0" placeholder="Clearing (KES)" value={importMeta.clearingCost || ''}
                onChange={(e) => setImportMeta({ ...importMeta, clearingCost: Number(e.target.value) })}
                className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" min="0" placeholder="Handling (KES)" value={importMeta.handlingCost || ''}
                onChange={(e) => setImportMeta({ ...importMeta, handlingCost: Number(e.target.value) })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
            </div>

            {/* Error */}
            {importError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl">
                ⚠ {importError}
              </div>
            )}

            {/* Dry-run preview */}
            {importPreview && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Preview — {importPreview.rowCount} product(s) · {importPreview.totalBottles} bottles</span>
                  {importPreview.totalLogistics > 0 && (
                    <span className="text-[10px] text-gray-500 font-medium">Logistics: KES {importPreview.totalLogistics.toLocaleString()} to allocate</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-gray-500 border-b border-gray-200">
                        <th className="pb-2">SKU</th>
                        <th className="pb-2 text-right">Cases</th>
                        <th className="pb-2 text-right">Bottles</th>
                        <th className="pb-2 text-right">Cost/btl</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {importPreview.parsed.map((row, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-bold text-gray-800 font-sans">{row.sku}</td>
                          <td className="py-1.5 text-right">{row.cases}</td>
                          <td className="py-1.5 text-right">{row.bottles}</td>
                          <td className="py-1.5 text-right">KES {row.unitProductCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400">✓ Validated — all SKUs found. Click &quot;Commit Import&quot; to record the receipt and update landed costs.</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportError(null); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700">
                Cancel
              </button>
              {!importPreview ? (
                <button type="button" onClick={handleImportPreview} disabled={importing || !importFile}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-800 hover:bg-gray-900 text-white disabled:opacity-50">
                  {importing ? 'Validating…' : '🔍 Preview & Validate'}
                </button>
              ) : (
                <button type="button" onClick={handleImportCommit} disabled={importing}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#840038] hover:bg-[#6b002c] text-white disabled:opacity-50">
                  {importing ? 'Recording…' : '✓ Commit Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Receive Stock</h3>
            <p className="text-xs text-gray-500">Record a goods-received batch. Landed cost is computed from product cost + your share of freight, clearing &amp; handling.</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Supplier name" value={receiptForm.supplierName}
                onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input placeholder="Reference / invoice #" value={receiptForm.reference}
                onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" placeholder="Freight cost (KES)" value={receiptForm.freightCost}
                onChange={(e) => setReceiptForm({ ...receiptForm, freightCost: Number(e.target.value) })}
                className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" placeholder="Clearing cost (KES)" value={receiptForm.clearingCost}
                onChange={(e) => setReceiptForm({ ...receiptForm, clearingCost: Number(e.target.value) })}
                className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
              <input type="number" placeholder="Handling cost (KES)" value={receiptForm.handlingCost}
                onChange={(e) => setReceiptForm({ ...receiptForm, handlingCost: Number(e.target.value) })}
                className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Lines</span>
                <button type="button" onClick={() => setReceiptForm({ ...receiptForm, lines: [...receiptForm.lines, { sku: '', cases: 1, unitProductCost: 0 }] })}
                  className="text-xs font-bold text-[#840038]">+ Add line</button>
              </div>
              {receiptForm.lines.length === 0 && (
                <p className="text-xs text-gray-400 italic">Click &quot;+ Add line&quot; to add products to this receipt.</p>
              )}
              {receiptForm.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
                  <select value={line.sku} onChange={(e) => {
                    const lines = [...receiptForm.lines]; lines[idx] = { ...line, sku: e.target.value };
                    setReceiptForm({ ...receiptForm, lines });
                  }} className="col-span-2 px-2 py-1.5 rounded-lg text-xs border border-gray-200">
                    <option value="">Select product...</option>
                    {filteredProducts.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Cases" value={line.cases} onChange={(e) => {
                    const lines = [...receiptForm.lines]; lines[idx] = { ...line, cases: Number(e.target.value) };
                    setReceiptForm({ ...receiptForm, lines });
                  }} className="px-2 py-1.5 rounded-lg text-xs border border-gray-200" />
                  <input type="number" placeholder="Cost/bottle" value={line.unitProductCost} onChange={(e) => {
                    const lines = [...receiptForm.lines]; lines[idx] = { ...line, unitProductCost: Number(e.target.value) };
                    setReceiptForm({ ...receiptForm, lines });
                  }} className="px-2 py-1.5 rounded-lg text-xs border border-gray-200" />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setShowReceiptModal(false); setReceiptForm({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '', lines: [] }); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700">Cancel</button>
              <button type="button" onClick={async () => {
                try {
                  if (receiptForm.lines.length === 0 || receiptForm.lines.some((l) => !l.sku)) {
                    showToast('Please add at least one line with a product selected.', 'error'); return;
                  }
                  const res = await fetch('/api/admin/trade/stock-receipts', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(receiptForm),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to record receipt');
                  showToast(`Receipt ${data.receipt.receiptNumber} recorded — ${data.receipt.lines.length} line(s) updated.`);
                  setShowReceiptModal(false);
                  setReceiptForm({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '', lines: [] });
                  loadAllAdminData();
                } catch (err) {
                  showToast(err.message, 'error');
                }
              }} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#840038] text-white">Record Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ USERS & SEATS TAB ═══════ */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Trade Users & Seats</h2>
              <p className="text-xs text-gray-500">Manage login credentials, unlock accounts, and provision new seats.</p>
            </div>
            <button
              type="button"
              onClick={() => { setShowNewUserModal(true); setNewUserForm({ accountId: '', name: '', email: '', phone: '', role: 'Business Owner', seatType: 'buyer' }); }}
              className="px-4 py-2.5 bg-[#840038] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:bg-[#6b002c] transition-all active:scale-95"
            >
              + New User Seat
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-gray-200 text-xs"
            />
            <select
              value={userAccountFilter}
              onChange={(e) => setUserAccountFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs"
            >
              <option value="all">All Accounts</option>
              {[...new Set(tradeUsers.map((u) => u.tradingName))].sort().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Temp Password Display */}
          {tempPasswordDisplay && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">🔑 Temporary Password Generated</span>
                <button type="button" onClick={() => setTempPasswordDisplay(null)} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              <div className="font-mono text-lg font-bold text-emerald-800 bg-white px-4 py-2 rounded-lg border border-emerald-200 select-all">
                {tempPasswordDisplay.password}
              </div>
              <p className="text-emerald-700">
                For <strong>{tempPasswordDisplay.name}</strong> ({tempPasswordDisplay.email}). Copy and share securely — this is shown only once.
              </p>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(tempPasswordDisplay.password); showToast('Password copied to clipboard'); }}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs"
              >
                Copy to Clipboard
              </button>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Account</th>
                    <th className="text-left px-4 py-3">Seat</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeUsers
                    .filter((u) => {
                      const q = userSearch.trim().toLowerCase();
                      const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q) || u.id?.toLowerCase().includes(q);
                      const matchAccount = userAccountFilter === 'all' || u.tradingName === userAccountFilter;
                      return matchSearch && matchAccount;
                    })
                    .map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{u.name}</div>
                          <div className="text-[10px] text-gray-500">{u.email}</div>
                          {u.phone && <div className="text-[10px] text-gray-400">{u.phone}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{u.tradingName}</div>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            u.accountStatus === 'active' ? 'bg-emerald-100 text-emerald-700'
                            : u.accountStatus === 'suspended' ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>{u.accountStatus}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{u.role}</div>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            u.seatType === 'owner' ? 'bg-purple-100 text-purple-700'
                            : u.seatType === 'buyer' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>{u.seatType}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {u.hasPassword ? (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Password Set</span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">No Password</span>
                            )}
                            {u.isLocked && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 block w-fit">🔒 Locked</span>
                            )}
                            {u.mustChangePassword && u.hasPassword && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 block w-fit">Temp Password</span>
                            )}
                            {u.failedAttempts > 0 && (
                              <span className="text-[9px] text-gray-500">{u.failedAttempts} failed attempt{u.failedAttempts !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={resettingUserId === u.id}
                              onClick={async () => {
                                setResettingUserId(u.id);
                                try {
                                  const res = await fetch('/api/admin/trade/users', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: u.id, action: 'reset-password' }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error);
                                  setTempPasswordDisplay({ password: data.temporaryPassword, name: u.name, email: u.email });
                                  showToast(`Password reset for ${u.name}`);
                                  loadAllAdminData();
                                } catch (err) {
                                  showToast(err.message, 'error');
                                } finally {
                                  setResettingUserId(null);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all"
                              title="Generate a new temporary password"
                            >
                              {resettingUserId === u.id ? '...' : '🔑 Reset'}
                            </button>
                            {u.isLocked && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/admin/trade/users', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: u.id, action: 'unlock' }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error);
                                    showToast(`${u.name} unlocked`);
                                    loadAllAdminData();
                                  } catch (err) {
                                    showToast(err.message, 'error');
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all"
                              >
                                🔓 Unlock
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {tradeUsers.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-xs">No trade users found.</div>
            )}
          </div>

          {/* New User Modal */}
          {showNewUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="text-sm font-bold text-gray-900">Create Trade User Seat</h3>
                <p className="text-[10px] text-gray-500">A temporary password will be generated. Share it securely with the user.</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Trade Account *</label>
                    <select
                      value={newUserForm.accountId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, accountId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                    >
                      <option value="">Select an account...</option>
                      {accounts.filter((a) => a.status === 'active').map((a) => (
                        <option key={a.id} value={a.id}>{a.tradingName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Full Name *</label>
                    <input type="text" value={newUserForm.name} onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs" placeholder="e.g. David Kimani" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Email *</label>
                    <input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs" placeholder="user@company.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Phone</label>
                    <input type="tel" value={newUserForm.phone} onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs" placeholder="+254 7..." />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Role</label>
                      <input type="text" value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Seat Type</label>
                      <select value={newUserForm.seatType} onChange={(e) => setNewUserForm({ ...newUserForm, seatType: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs">
                        <option value="owner">Owner</option>
                        <option value="buyer">Buyer</option>
                        <option value="viewer">Viewer / Auditor</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowNewUserModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700">Cancel</button>
                  <button
                    type="button"
                    disabled={creatingUser || !newUserForm.accountId || !newUserForm.name || !newUserForm.email}
                    onClick={async () => {
                      setCreatingUser(true);
                      try {
                        const res = await fetch('/api/admin/trade/users', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newUserForm),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setTempPasswordDisplay({ password: data.temporaryPassword, name: data.user.name, email: data.user.email });
                        showToast(`User ${data.user.name} created successfully`);
                        setShowNewUserModal(false);
                        loadAllAdminData();
                      } catch (err) {
                        showToast(err.message, 'error');
                      } finally {
                        setCreatingUser(false);
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#840038] text-white disabled:opacity-50"
                  >
                    {creatingUser ? 'Creating...' : 'Create & Generate Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}



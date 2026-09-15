import { roundCent, roundKes } from './pricing-engine.js';

export const SUPPLIER_INFO = {
  companyName: 'Happy Hour Wholesale Distribution Kenya Ltd',
  tradingName: 'Happy Hour B2B Trade Division',
  legalName: 'LiquorDash Commerce Limited',
  kraPin: 'P051987654Z',
  vatNumber: 'VAT-KE-0091244',
  physicalAddress: 'Happy Hour Central Hub, Commercial Street, Industrial Area, Nairobi, Kenya',
  email: 'trade@myhappyhour.co.ke',
  financeEmail: 'billing@myhappyhour.co.ke',
  phone: '+254 711 000 999',
  supportPhone: '+254 711 234 567',
  website: 'https://myhappyhour.co.ke/trade',
  paybill: '400200',
  accountNumber: 'HH-TRADE',
  bankDetails: {
    bank: 'Standard Chartered Bank Kenya',
    branch: 'Kenyatta Avenue Branch, Nairobi',
    accountName: 'LiquorDash Commerce Limited - Trade Collections',
    accountNumber: '0108099887700',
    swiftCode: 'SCBLKENX',
  },
};

/**
 * Generate a complete KRA ETR-compliant VAT Tax Invoice document payload
 */
export function generateTradeInvoiceDocument(order, account) {
  if (!order) return null;

  const issueDate = order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
  const dueDate = order.dueDate || (() => {
    const d = new Date(order.createdAt || Date.now());
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  })();

  const invoiceNumber = order.invoiceNumber || `HH-INV-2026-${order.id?.slice(-4) || '1001'}`;
  const etrControlNumber = `ETR-KRA-${order.id?.slice(-6).toUpperCase() || 'KE9912'}-2026`;

  return {
    documentType: 'TAX INVOICE',
    invoiceNumber,
    orderNumber: order.orderNumber,
    etrControlNumber,
    issueDate,
    dueDate,
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentTerms: order.paymentTerms === 'credit_14' ? 'Net 14 Days Credit' : 'Prepayment / Cash on Delivery',
    poReference: order.poReference || 'N/A',
    supplier: SUPPLIER_INFO,
    customer: {
      accountId: account?.id || order.accountId,
      tradingName: account?.tradingName || order.accountName,
      legalName: account?.legalName || order.accountName,
      kraPin: account?.kraPin || 'PIN-NOT-PROVIDED',
      licenceNo: account?.licenceNo || 'N/A',
      email: order.orderedBy?.email || account?.users?.[0]?.email || 'finance@customer.co.ke',
      phone: order.orderedBy?.phone || account?.users?.[0]?.phone || '',
      deliveryAddress: order.deliveryAddress || account?.addresses?.[0] || {
        label: 'Main Receiving Dock',
        addressLine: 'Nairobi Metro, Kenya',
        city: 'Nairobi',
      },
    },
    items: order.items || [],
    totalBottles: order.totalBottles || 0,
    subtotalExVat: roundCent(order.subtotalExVat || 0),
    vatTotal: roundCent(order.vatTotal || 0),
    subtotalIncVat: roundKes(order.subtotalIncVat || 0),
    deliveryFee: order.deliveryFee || 0,
    referralCredit: order.referralCredit || 0,
    grandTotal: roundKes(order.grandTotal || 0),
    paymentInstructions: {
      paybill: SUPPLIER_INFO.paybill,
      accountRef: `${invoiceNumber}`,
      bankName: SUPPLIER_INFO.bankDetails.bank,
      accountNumber: SUPPLIER_INFO.bankDetails.accountNumber,
      accountName: SUPPLIER_INFO.bankDetails.accountName,
      swiftCode: SUPPLIER_INFO.bankDetails.swiftCode,
    },
  };
}

/**
 * Generate a complete Warehouse Dispatch & Delivery Note / Goods Received Note (GRN) payload
 */
export function generateTradeDeliveryNote(order, account) {
  if (!order) return null;

  const dispatchDate = order.createdAt ? order.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
  const deliveryNoteNumber = order.deliveryNoteNumber || `HH-DN-2026-${order.orderNumber?.replace('HH-TR-', '') || order.id?.slice(-4) || '1001'}`;
  const sealNumber = `SL-${Math.floor(100000 + Math.random() * 900000)}`;

  const driver = order.driverInfo || {
    name: 'Boniface Ochieng',
    phone: '+254 712 003 344',
    vehicle: 'KDF 412X (Happy Hour Van 04)',
    temperatureLog: '14.2°C (Temperature-Controlled Van)',
  };

  return {
    documentType: 'DELIVERY NOTE & GOODS RECEIVED NOTE (GRN)',
    deliveryNoteNumber,
    invoiceNumber: order.invoiceNumber,
    orderNumber: order.orderNumber,
    dispatchDate,
    sealNumber,
    status: order.status || 'dispatched',
    poReference: order.poReference || 'N/A',
    supplier: SUPPLIER_INFO,
    customer: {
      accountId: account?.id || order.accountId,
      tradingName: account?.tradingName || order.accountName,
      legalName: account?.legalName || order.accountName,
      kraPin: account?.kraPin || 'N/A',
      deliveryAddress: order.deliveryAddress || account?.addresses?.[0] || {
        label: 'Central Receiving Bay',
        addressLine: 'Kenyatta Avenue, Nairobi',
        city: 'Nairobi',
        deliveryWindow: '08:00 - 12:00 EAT',
      },
    },
    logistics: {
      driverName: driver.name,
      driverPhone: driver.phone,
      vehicleRegistration: driver.vehicle,
      dispatchHub: 'Happy Hour Central Hub - Bay 02',
      temperatureLog: driver.temperatureLog || '14.5°C Verified',
    },
    items: (order.items || []).map((item) => ({
      sku: item.sku,
      name: item.name,
      orderedQuantity: item.quantity,
      dispatchedQuantity: item.quantity,
      receivedQuantity: item.quantity,
      unitSize: item.sku?.includes('750ml') ? '750ml' : item.sku?.includes('500ml') ? '500ml' : item.sku?.includes('350ml') ? '350ml' : 'Bottle',
    })),
    totalBottles: order.totalBottles || 0,
    notes: 'All cases sealed with Happy Hour tamper-evident security tape. Inspect upon arrival before signing.',
  };
}

/**
 * Generate a quotation document payload from a trade quote record.
 * Shares the items/customer shape with generateTradeInvoiceDocument (both
 * ultimately come from calculateTradeOrderPricing), so the same PDF table
 * layout renders either document.
 */
export function generateTradeQuoteDocument(quote, account) {
  if (!quote) return null;

  return {
    documentType: 'QUOTATION',
    quoteNumber: quote.quoteNumber,
    issueDate: quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
    validUntil: quote.validUntil ? quote.validUntil.split('T')[0] : null,
    status: quote.status,
    notes: quote.notes || '',
    supplier: SUPPLIER_INFO,
    customer: {
      accountId: account?.id || quote.accountId,
      tradingName: account?.tradingName || quote.accountName,
      legalName: account?.legalName || quote.accountName,
      kraPin: account?.kraPin || 'N/A',
      licenceNo: account?.licenceNo || 'N/A',
    },
    items: quote.items || [],
    totalBottles: quote.totalBottles || 0,
    subtotalExVat: roundCent(quote.subtotalExVat || 0),
    vatTotal: roundCent(quote.vatTotal || 0),
    deliveryFee: quote.deliveryFee || 0,
    grandTotal: roundKes(quote.grandTotal || 0),
  };
}

/**
 * Generate a responsive, branded HTML email for Invoice Delivery
 */
export function generateInvoiceEmailHtml(invoiceData, customNotes = '') {
  const { invoiceNumber, orderNumber, dueDate, grandTotal, customer, items, subtotalExVat, vatTotal, deliveryFee } = invoiceData;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9f6f4; color: #231F20; }
    .container { max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eae5e3; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: #1c1917; padding: 28px 32px; color: #ffffff; border-bottom: 3px solid #840038; }
    .badge { background: #840038; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; display: inline-block; letter-spacing: 1px; }
    .content { padding: 32px; }
    .inv-card { background: #fdf2f4; border: 1px solid #fbcfe8; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    .items-table th { background: #f5f5f4; text-align: left; padding: 10px; font-weight: 700; color: #57534e; text-transform: uppercase; font-size: 10px; }
    .items-table td { padding: 12px 10px; border-bottom: 1px solid #f5f5f4; }
    .total-row td { font-weight: 800; font-size: 14px; border-top: 2px solid #840038; color: #840038; padding-top: 14px; }
    .payment-box { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px; margin-top: 24px; font-size: 12px; }
    .btn { display: inline-block; background: #840038; color: #ffffff !important; font-weight: 800; font-size: 12px; text-decoration: none; padding: 12px 24px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 16px; }
    .footer { background: #1c1917; color: #a8a29e; font-size: 11px; padding: 24px 32px; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table style="width:100%;">
        <tr>
          <td>
            <div style="font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #ffffff;">HAPPY HOUR!</div>
            <div style="font-size: 11px; color: #d6d3d1; margin-top: 2px;">B2B WHOLESALE TRADE PORTAL</div>
          </td>
          <td style="text-align: right;">
            <span class="badge">Official KRA VAT Invoice</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <div class="inv-card">
        <table style="width:100%;">
          <tr>
            <td>
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #840038;">Invoice Reference</div>
              <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #1c1917;">${invoiceNumber}</div>
              <div style="font-size: 11px; color: #78716c; margin-top: 2px;">Order: <strong>${orderNumber}</strong></div>
            </td>
            <td style="text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #78716c;">Amount Due</div>
              <div style="font-size: 22px; font-weight: 900; color: #840038;">KES ${grandTotal.toLocaleString()}</div>
              <div style="font-size: 11px; color: #dc2626; font-weight: 700;">Due: ${dueDate}</div>
            </td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #44403c; margin: 0 0 16px;">
        Dear <strong>${customer.tradingName}</strong> Finance Team,
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #57534e; margin: 0 0 16px;">
        Please find attached the official Kenya VAT Tax Invoice for your wholesale beverage procurement on order <strong>${orderNumber}</strong>.
      </p>

      ${customNotes ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px; font-size: 11px; color: #92400e; margin-bottom: 16px;"><strong>Note from Account Manager:</strong> ${customNotes}</div>` : ''}

      <table class="items-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit (Inc-VAT)</th>
            <th style="text-align: right;">Total (KES)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>
                <div style="font-weight: 700; color: #1c1917;">${item.name}</div>
                <div style="font-size: 10px; color: #a8a29e; font-family: monospace;">${item.sku} · Tier ${item.tierKey || 'T1'}</div>
              </td>
              <td style="text-align: center; font-weight: 700;">${item.quantity}</td>
              <td style="text-align: right; font-family: monospace;">KES ${item.unitPriceIncVat?.toLocaleString()}</td>
              <td style="text-align: right; font-weight: 700; font-family: monospace;">KES ${item.lineTotalIncVat?.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Goods Subtotal (Ex-VAT)</td>
            <td style="text-align: right; font-family: monospace;">KES ${subtotalExVat?.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Kenya Standard VAT (16%)</td>
            <td style="text-align: right; font-family: monospace;">KES ${vatTotal?.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Delivery & Handling (Nairobi Metro)</td>
            <td style="text-align: right; font-family: monospace;">${deliveryFee === 0 ? 'FREE' : `KES ${deliveryFee.toLocaleString()}`}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">TOTAL AMOUNT DUE</td>
            <td style="text-align: right; font-family: monospace;">KES ${grandTotal.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div class="payment-box">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #1c1917; margin-bottom: 8px;">
          Settlement Instructions (Net 14)
        </div>
        <table style="width: 100%; font-size: 11px; color: #57534e;">
          <tr>
            <td style="padding: 2px 0;"><strong>M-Pesa Corporate Paybill:</strong></td>
            <td style="font-family: monospace; font-weight: 700; color: #1c1917;">${SUPPLIER_INFO.paybill}</td>
            <td style="padding: 2px 0;"><strong>Account Ref:</strong></td>
            <td style="font-family: monospace; font-weight: 700; color: #1c1917;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 2px 0;"><strong>Bank:</strong></td>
            <td>${SUPPLIER_INFO.bankDetails.bank}</td>
            <td style="padding: 2px 0;"><strong>Account No:</strong></td>
            <td style="font-family: monospace; font-weight: 700; color: #1c1917;">${SUPPLIER_INFO.bankDetails.accountNumber}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${SUPPLIER_INFO.website}/invoices/${orderNumber?.toLowerCase() || 'view'}" class="btn">
          View &amp; Print Official Tax Invoice →
        </a>
      </div>
    </div>

    <div class="footer">
      <strong>Happy Hour B2B Wholesale Distribution Kenya</strong><br>
      KRA PIN: ${SUPPLIER_INFO.kraPin} · VAT No: ${SUPPLIER_INFO.vatNumber}<br>
      Industrial Area, Commercial Street, Nairobi, Kenya · Tel: ${SUPPLIER_INFO.phone}<br>
      <em>This is an official commercial tax communication from Happy Hour B2B Trade.</em>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate a responsive, branded HTML email for Delivery Note Manifest
 */
export function generateDeliveryNoteEmailHtml(deliveryData) {
  const { deliveryNoteNumber, orderNumber, customer, items, logistics, sealNumber } = deliveryData;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9f6f4; color: #231F20; }
    .container { max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eae5e3; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: #1c1917; padding: 24px 32px; color: #ffffff; border-bottom: 3px solid #059669; }
    .content { padding: 32px; }
    .dn-card { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    .items-table th { background: #f5f5f4; text-align: left; padding: 10px; font-weight: 700; color: #57534e; text-transform: uppercase; font-size: 10px; }
    .items-table td { padding: 10px; border-bottom: 1px solid #f5f5f4; }
    .footer { background: #1c1917; color: #a8a29e; font-size: 11px; padding: 20px 32px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 18px; font-weight: 900; color: #ffffff;">HAPPY HOUR B2B LOGISTICS</div>
      <div style="font-size: 11px; color: #a7f3d0; margin-top: 2px;">DELIVERY NOTE &amp; DISPATCH MANIFEST</div>
    </div>
    <div class="content">
      <div class="dn-card">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #059669;">Dispatch Manifest #</div>
        <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #065f46;">${deliveryNoteNumber}</div>
        <div style="font-size: 11px; color: #047857; margin-top: 4px;">
          Security Seal: <strong>${sealNumber}</strong> · Driver: <strong>${logistics.driverName}</strong> (${logistics.vehicleRegistration})
        </div>
      </div>

      <p style="font-size: 12px; color: #44403c;">
        Attention Receiving Officer at <strong>${customer.tradingName} (${customer.deliveryAddress?.label || 'Receiving Dock'})</strong>,
      </p>
      <p style="font-size: 12px; color: #57534e;">
        Your wholesale order <strong>${orderNumber}</strong> has been dispatched from our central temperature-controlled hub.
      </p>

      <table class="items-table">
        <thead>
          <tr>
            <th>SKU / Product</th>
            <th style="text-align: center;">Dispatched Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td><strong>${item.name}</strong> <span style="font-size:10px; color:#888; font-family:monospace;">(${item.sku})</span></td>
              <td style="text-align: center; font-weight: 800; color: #059669;">${item.dispatchedQuantity} Bottles</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="footer">
      Happy Hour Logistics · Support: ${SUPPLIER_INFO.supportPhone}
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate a responsive, branded HTML email for Quotation Delivery
 */
export function generateQuoteEmailHtml(quoteData, customNotes = '') {
  const { quoteNumber, validUntil, grandTotal, customer, items, subtotalExVat, vatTotal, deliveryFee } = quoteData;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9f6f4; color: #231F20; }
    .container { max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #eae5e3; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: #1c1917; padding: 28px 32px; color: #ffffff; border-bottom: 3px solid #2563eb; }
    .badge { background: #2563eb; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; display: inline-block; letter-spacing: 1px; }
    .content { padding: 32px; }
    .quote-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    .items-table th { background: #f5f5f4; text-align: left; padding: 10px; font-weight: 700; color: #57534e; text-transform: uppercase; font-size: 10px; }
    .items-table td { padding: 12px 10px; border-bottom: 1px solid #f5f5f4; }
    .total-row td { font-weight: 800; font-size: 14px; border-top: 2px solid #2563eb; color: #2563eb; padding-top: 14px; }
    .btn { display: inline-block; background: #840038; color: #ffffff !important; font-weight: 800; font-size: 12px; text-decoration: none; padding: 12px 24px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 16px; }
    .footer { background: #1c1917; color: #a8a29e; font-size: 11px; padding: 24px 32px; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table style="width:100%;">
        <tr>
          <td>
            <div style="font-size: 20px; font-weight: 900; letter-spacing: 1px; color: #ffffff;">HAPPY HOUR!</div>
            <div style="font-size: 11px; color: #d6d3d1; margin-top: 2px;">B2B WHOLESALE TRADE PORTAL</div>
          </td>
          <td style="text-align: right;">
            <span class="badge">Official Volume Quotation</span>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <div class="quote-card">
        <table style="width:100%;">
          <tr>
            <td>
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #2563eb;">Quotation Reference</div>
              <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #1c1917;">${quoteNumber}</div>
              <div style="font-size: 11px; color: #78716c; margin-top: 2px;">Customer: <strong>${customer?.tradingName || 'Wholesale Client'}</strong></div>
            </td>
            <td style="text-align: right;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #78716c;">Estimated Total</div>
              <div style="font-size: 22px; font-weight: 900; color: #2563eb;">KES ${grandTotal?.toLocaleString()}</div>
              <div style="font-size: 11px; color: #d97706; font-weight: 700;">Valid Until: ${validUntil || '14 Days'}</div>
            </td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #44403c; margin: 0 0 16px;">
        Dear <strong>${customer?.tradingName || 'Client'}</strong> Procurement Team,
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #57534e; margin: 0 0 16px;">
        Please find attached your bespoke volume quotation from Happy Hour B2B Trade. You can review the attached PDF or log in to your trade portal to accept this quote with 1-click order conversion.
      </p>

      ${customNotes ? `<div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px; font-size: 11px; color: #92400e; margin-bottom: 16px;"><strong>Note from Specialist:</strong> ${customNotes}</div>` : ''}

      <table class="items-table">
        <thead>
          <tr>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit (Inc-VAT)</th>
            <th style="text-align: right;">Total (KES)</th>
          </tr>
        </thead>
        <tbody>
          ${(items || []).map(item => `
            <tr>
              <td>
                <div style="font-weight: 700; color: #1c1917;">${item.name}</div>
                <div style="font-size: 10px; color: #a8a29e; font-family: monospace;">${item.sku} · Tier ${item.tierKey || 'T1'}</div>
              </td>
              <td style="text-align: center; font-weight: 700;">${item.quantity}</td>
              <td style="text-align: right; font-family: monospace;">KES ${item.unitPriceIncVat?.toLocaleString()}</td>
              <td style="text-align: right; font-weight: 700; font-family: monospace;">KES ${item.lineTotalIncVat?.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Goods Subtotal (Ex-VAT)</td>
            <td style="text-align: right; font-family: monospace;">KES ${subtotalExVat?.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Kenya VAT (16%)</td>
            <td style="text-align: right; font-family: monospace;">KES ${vatTotal?.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="text-align: right; color: #78716c;">Delivery & Handling</td>
            <td style="text-align: right; font-family: monospace;">${deliveryFee === 0 ? 'FREE' : `KES ${deliveryFee?.toLocaleString()}`}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" style="text-align: right;">ESTIMATED TOTAL DUE</td>
            <td style="text-align: right; font-family: monospace;">KES ${grandTotal?.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${SUPPLIER_INFO.website}/quotes" class="btn">
          Review &amp; Accept Quote Online →
        </a>
      </div>
    </div>

    <div class="footer">
      <strong>Happy Hour B2B Wholesale Distribution Kenya</strong><br>
      KRA PIN: ${SUPPLIER_INFO.kraPin} · VAT No: ${SUPPLIER_INFO.vatNumber}<br>
      Industrial Area, Commercial Street, Nairobi, Kenya · Tel: ${SUPPLIER_INFO.phone}<br>
      <em>This is an estimate only and does not constitute a tax invoice. Prices locked until validity expiry.</em>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * HTML email sent to applicant confirming submission
 */
export function generateApplicationReceivedEmailHtml(application) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Montserrat', sans-serif; background: #f9f6f4; color: #231F20; margin: 0; padding: 20px; }
  .box { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #eae5e3; overflow: hidden; }
  .head { background: #1c1917; padding: 24px; color: #fff; border-bottom: 3px solid #840038; }
  .body { padding: 28px; font-size: 13px; line-height: 1.6; }
  .detail { background: #fdf2f4; border: 1px solid #fbcfe8; padding: 16px; border-radius: 12px; margin: 20px 0; }
  .foot { background: #1c1917; color: #a8a29e; font-size: 11px; padding: 20px; text-align: center; }
</style>
</head>
<body>
  <div class="box">
    <div class="head">
      <div style="font-size: 18px; font-weight: 900;">HAPPY HOUR B2B TRADE HUB</div>
      <div style="font-size: 11px; color: #d6d3d1;">Account Application Received</div>
    </div>
    <div class="body">
      <p>Dear <strong>${application.contactName}</strong>,</p>
      <p>Thank you for submitting a wholesale procurement application for <strong>${application.tradingName}</strong>.</p>
      <div class="detail">
        <strong>Trading Entity:</strong> ${application.tradingName}<br>
        <strong>Segment:</strong> ${application.segment?.toUpperCase()}<br>
        <strong>KRA PIN:</strong> ${application.kraPin || 'N/A'}<br>
        <strong>Liquor Licence:</strong> ${application.licenceNo || 'N/A (Jaba lines only)'}<br>
        <strong>Review Status:</strong> Under Compliance Vetting (Estimated SLA: 2 hours)
      </div>
      <p>Our trade compliance desk is currently reviewing your business registration and tax credentials. Once verified, you will receive an activation email with your portal login credentials to access distributor tier pricing.</p>
    </div>
    <div class="foot">Happy Hour B2B Trade Division · Support: ${SUPPLIER_INFO.phone}</div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * HTML email sent to admin notifying of a new application
 */
export function generateApplicationAdminNoticeHtml(application) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: sans-serif; background: #f4f4f5; color: #18181b; padding: 20px; }
  .box { max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7; }
  .btn { display: inline-block; background: #840038; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px; }
</style>
</head>
<body>
  <div class="box">
    <h2 style="margin-top: 0; color: #840038;">🔔 New B2B Trade Application</h2>
    <p>A new wholesale account application has been submitted:</p>
    <ul>
      <li><strong>Trading Name:</strong> ${application.tradingName}</li>
      <li><strong>Legal Name:</strong> ${application.legalName || 'Same'}</li>
      <li><strong>Segment:</strong> ${application.segment}</li>
      <li><strong>Contact:</strong> ${application.contactName} (${application.role || 'Owner'})</li>
      <li><strong>Email:</strong> ${application.email}</li>
      <li><strong>Phone:</strong> ${application.phone}</li>
      <li><strong>KRA PIN:</strong> ${application.kraPin || 'Not provided'}</li>
      <li><strong>Licence No:</strong> ${application.licenceNo || 'None'}</li>
    </ul>
    <p><a href="${SUPPLIER_INFO.website.replace('/trade', '')}/admin/trade" class="btn">Open Admin Trade Hub to Review &rarr;</a></p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * HTML email sent to applicant when account is approved with credentials
 */
export function generateAccountApprovedEmailHtml(account, tempPassword, loginEmail) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Montserrat', sans-serif; background: #f9f6f4; color: #231F20; margin: 0; padding: 20px; }
  .box { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #eae5e3; overflow: hidden; }
  .head { background: #1c1917; padding: 24px; color: #fff; border-bottom: 3px solid #059669; }
  .body { padding: 28px; font-size: 13px; line-height: 1.6; }
  .cred-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 12px; margin: 20px 0; }
  .btn { display: inline-block; background: #840038; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
  .foot { background: #1c1917; color: #a8a29e; font-size: 11px; padding: 20px; text-align: center; }
</style>
</head>
<body>
  <div class="box">
    <div class="head">
      <div style="font-size: 18px; font-weight: 900;">HAPPY HOUR B2B TRADE HUB</div>
      <div style="font-size: 11px; color: #a7f3d0;">Trade Account Activated</div>
    </div>
    <div class="body">
      <p>Congratulations <strong>${account.tradingName}</strong>,</p>
      <p>Your Happy Hour B2B Wholesale Trade Account has been approved and activated! You now have direct access to distributor volume pricing and commercial terms.</p>
      
      <div class="cred-box">
        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #065f46; margin-bottom: 8px;">Your Portal Login Credentials</div>
        <div><strong>Login Email:</strong> ${loginEmail || account.users?.[0]?.email || 'Your Registered Email'}</div>
        ${tempPassword ? `<div><strong>Temporary Password:</strong> <code style="background:#fff; padding:2px 6px; border-radius:4px; font-weight:bold; color:#840038;">${tempPassword}</code></div>` : ''}
        <div style="margin-top: 8px; font-size: 11px; color: #047857;">
          Credit Facility: <strong>${account.creditEnabled ? `KES ${Number(account.creditLimit).toLocaleString()} (Net ${account.creditTerms || 14} Days)` : 'Prepayment / M-Pesa on Delivery'}</strong>
        </div>
      </div>

      <p>You can now log in, build bulk orders using the fast Order Pad, request bespoke event quotes, and download KRA VAT invoices.</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${SUPPLIER_INFO.website}/login" class="btn">Log In to B2B Trade Portal &rarr;</a>
      </div>
    </div>
    <div class="foot">Happy Hour B2B Trade Division · Support: ${SUPPLIER_INFO.phone}</div>
  </div>
</body>
</html>
  `.trim();
}



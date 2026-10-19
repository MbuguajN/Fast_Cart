import nodemailer from 'nodemailer';
import {
  generateInvoiceEmailHtml,
  generateDeliveryNoteEmailHtml,
  generateQuoteEmailHtml,
  generateApplicationReceivedEmailHtml,
  generateApplicationAdminNoticeHtml,
  generateAccountApprovedEmailHtml,
  generateOrderCancelledStaffAlertHtml,
  generateOrderCancelledBuyerNoticeHtml,
  generatePaymentWarningStaffAlertHtml,
  generateOrderConfirmedEmailHtml,
  generatePasswordResetEmailHtml,
} from './trade-documents.js';
import {
  renderInvoicePdf,
  renderDeliveryNotePdf,
  renderQuotePdf,
} from './trade-pdf.js';

/**
 * Email delivery for B2B trade documents (invoices, delivery notes).
 *
 * Separate from lib/email.js (customer OTP mail) on purpose: trade documents
 * are commercial/legal correspondence with a different sender identity and
 * failure mode — an OTP send can fail silently and get retried by the user
 * requesting a new code, but a "your invoice was emailed" confirmation must
 * only fire once the send actually succeeds.
 * Email delivery for B2B trade documents (invoices, delivery notes, quotations, onboarding).
 * Connected via Brevo SMTP credentials in .env.local.
 */
const mailPort = parseInt(process.env.MAIL_PORT || '587', 10);
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp-relay.brevo.com',
  port: mailPort,
  secure: mailPort === 465,
  auth: {
    user: process.env.MAIL_USERNAME || '',
    pass: process.env.MAIL_PASSWORD || '',
  },
});

function fromAddress(name) {
  const address = (
    process.env.MAIL_FROM_ADDRESS ||
    process.env.ORDERS_NOTIFICATION_EMAIL ||
    'orders@myhappyhour.co.ke'
  ).replace(/"/g, '').trim();
  return `"${name}" <${address}>`;
}

/** Email a VAT tax invoice to a trade account's finance contact. */
/** Email a VAT tax invoice with PDF attachment to a trade account's finance contact. */
export async function sendTradeInvoiceEmail({ to, invoice, customNotes = '' }) {
  if (!to) throw new Error('Recipient email is required');
  if (!invoice) throw new Error('Invoice data is required');

  const html = generateInvoiceEmailHtml(invoice, customNotes);
  const pdfBuffer = await renderInvoicePdf(invoice);

  return transporter.sendMail({
    from: fromAddress('Happy Hour B2B Trade'),
    to,
    subject: `Tax Invoice ${invoice.invoiceNumber} — Order ${invoice.orderNumber}`,
    html,
    text: `Tax Invoice ${invoice.invoiceNumber} for order ${invoice.orderNumber}. Amount due: KES ${invoice.grandTotal?.toLocaleString()} by ${invoice.dueDate}.`,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/** Email a delivery note / dispatch manifest to a trade account's receiving contact. */
/** Email a delivery note / dispatch manifest with PDF attachment to a trade account's receiving contact. */
export async function sendTradeDeliveryNoteEmail({ to, deliveryNote }) {
  if (!to) throw new Error('Recipient email is required');
  if (!deliveryNote) throw new Error('Delivery note data is required');

  const html = generateDeliveryNoteEmailHtml(deliveryNote);
  const pdfBuffer = await renderDeliveryNotePdf(deliveryNote);

  return transporter.sendMail({
    from: fromAddress('Happy Hour Logistics'),
    to,
    subject: `Delivery Note ${deliveryNote.deliveryNoteNumber} — Order ${deliveryNote.orderNumber}`,
    html,
    text: `Delivery note ${deliveryNote.deliveryNoteNumber} for order ${deliveryNote.orderNumber} has been dispatched. Security seal: ${deliveryNote.sealNumber}.`,
    attachments: [
      {
        filename: `${deliveryNote.deliveryNoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/** Email a volume quotation with branded PDF attachment to client. */
export async function sendTradeQuoteEmail({ to, quote, customNotes = '' }) {
  if (!to) throw new Error('Recipient email is required');
  if (!quote) throw new Error('Quote data is required');

  const html = generateQuoteEmailHtml(quote, customNotes);
  const pdfBuffer = await renderQuotePdf(quote);

  return transporter.sendMail({
    from: fromAddress('Happy Hour B2B Trade'),
    to,
    subject: `Quotation ${quote.quoteNumber} — Happy Hour B2B Trade`,
    html,
    text: `Quotation ${quote.quoteNumber} from Happy Hour B2B Trade. Total estimated: KES ${quote.grandTotal?.toLocaleString()}. Valid until: ${quote.validUntil}.`,
    attachments: [
      {
        filename: `${quote.quoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

/** Send confirmation & verification to applicant and notification to admin on new business account application. */
export async function sendTradeApplicationEmails({ application }) {
  if (!application) return;

  const adminEmail = process.env.ADMIN_EMAIL || process.env.ORDERS_NOTIFICATION_EMAIL || 'orders@myhappyhour.co.ke';

  // 1. Send confirmation & verification to applicant
  if (application.email) {
    try {
      console.log(`[trade-email] Sending business application confirmation to ${application.email}...`);
      const info = await transporter.sendMail({
        from: fromAddress('Happy Hour B2B Portal'),
        to: application.email,
        subject: `Application Received & Verified — ${application.tradingName} (Happy Hour B2B Portal)`,
        html: generateApplicationReceivedEmailHtml(application),
        text: `Thank you for applying for a Happy Hour B2B Business Account for ${application.tradingName}. We have verified receipt of your application (${application.email}). Our compliance team is reviewing your details.`,
      });
      console.log(`[trade-email] Applicant confirmation sent to ${application.email}, messageId: ${info?.messageId || 'ok'}`);
    } catch (err) {
      console.error(`[trade-email] Failed to send applicant confirmation email to ${application.email}:`, err.message);
    }
  }

  // 2. Send notification to admin / operations team
  try {
    const info = await transporter.sendMail({
      from: fromAddress('Happy Hour B2B Portal'),
      to: adminEmail,
      subject: `🔔 New B2B Business Account Application: ${application.tradingName} (${application.segment})`,
      html: generateApplicationAdminNoticeHtml(application),
      text: `New B2B application received: ${application.tradingName} (${application.contactName}, ${application.email}, ${application.phone}). Log in to admin to review.`,
    });
    console.log(`[trade-email] Admin application alert sent to ${adminEmail}, messageId: ${info?.messageId || 'ok'}`);
  } catch (err) {
    console.error('[trade-email] Failed to send admin application alert email:', err.message);
  }
}

/** Send account activation email with credentials to applicant. */
export async function sendTradeAccountApprovedEmail({ to, account, tempPassword, loginEmail }) {
  if (!to) return;

  const html = generateAccountApprovedEmailHtml(account, tempPassword, loginEmail || to);

  return transporter.sendMail({
    from: fromAddress('Happy Hour B2B Trade Division'),
    to,
    subject: `Trade Account Activated: Welcome to Happy Hour B2B — ${account.tradingName}`,
    html,
    text: `Your Happy Hour B2B Trade account for ${account.tradingName} is now active. Login Email: ${loginEmail || to}. Temporary Password: ${tempPassword || '(Use your existing password)'}.`,
  });
}

const OPS_EMAIL = process.env.ORDERS_NOTIFICATION_EMAIL || 'orders@myhappyhour.co.ke';

/**
 * Send Order Cancelled alerts:
 * 1. Alert to operations team (orders@myhappyhour.co.ke) with buyer details and phone for swift recovery.
 * 2. Notice to the buyer with explanation and 1-click cart resume link.
 */
export async function sendTradeOrderCancelledAlert({ order, reason = 'Payment was not completed / hold expired' }) {
  if (!order) return;
  const orderNum = order.orderNumber || order.order_number || order.id;

  // 1. Staff operational alert
  try {
    const staffHtml = generateOrderCancelledStaffAlertHtml({ order, reason });
    await transporter.sendMail({
      from: fromAddress('Happy Hour Order Alerts'),
      to: OPS_EMAIL,
      subject: `⚠️ ORDER CANCELLED: Order #${orderNum} — KES ${Number(order.grandTotal || order.grand_total || 0).toLocaleString()}`,
      html: staffHtml,
      text: `Order #${orderNum} was cancelled. Reason: ${reason}. Total: KES ${Number(order.grandTotal || order.grand_total || 0).toLocaleString()}. Please check staff inbox for details.`,
    });
  } catch (err) {
    console.error(`[trade-email] Failed to send staff cancellation alert for ${orderNum}:`, err.message);
  }

  // 2. Buyer cancellation notice (if email available)
  const buyerEmail = order.deliveryAddress?.contactEmail || order.orderedBy?.email || order.buyerEmail || (typeof order.ordered_by === 'object' ? order.ordered_by?.email : null);
  if (buyerEmail && typeof buyerEmail === 'string' && buyerEmail.includes('@')) {
    try {
      const buyerHtml = generateOrderCancelledBuyerNoticeHtml({ order, reason });
      await transporter.sendMail({
        from: fromAddress('Happy Hour B2B Trade'),
        to: buyerEmail,
        subject: `Your Happy Hour Order #${orderNum} was cancelled`,
        html: buyerHtml,
        text: `Your order #${orderNum} was cancelled (${reason}). Your stock reservation has been released and nothing was charged. Return to https://app.myhappyhour.co.ke/trade/cart to complete your order.`,
      });
    } catch (err) {
      console.error(`[trade-email] Failed to send buyer cancellation notice for ${orderNum}:`, err.message);
    }
  }
}

/**
 * Send Payment Warning Alert to operations team (underpayment or paid after expiry).
 */
export async function sendTradePaymentWarningAlert({ order, reason, paystackData }) {
  if (!order) return;
  const orderNum = order.orderNumber || order.order_number || order.id;
  try {
    const html = generatePaymentWarningStaffAlertHtml({ order, reason, paystackData });
    await transporter.sendMail({
      from: fromAddress('Happy Hour Payment Alerts'),
      to: OPS_EMAIL,
      subject: `🚨 PAYMENT EXCEPTION: Order #${orderNum} (${reason})`,
      html,
      text: `Payment exception on Order #${orderNum}: ${reason}. Paystack Ref: ${paystackData?.reference || 'N/A'}. Review immediately.`,
    });
  } catch (err) {
    console.error(`[trade-email] Failed to send payment warning for ${orderNum}:`, err.message);
  }
}

/**
 * Send Order Confirmed & Paid notifications:
 * 1. Alert to operations/warehouse team (orders@myhappyhour.co.ke) for immediate picking & dispatch.
 * 2. Confirmation & receipt email to buyer.
 */
export async function sendTradeOrderConfirmedAlert({ order }) {
  if (!order) return;
  const orderNum = order.orderNumber || order.order_number || order.id;

  // 1. Staff new order alert
  try {
    const staffHtml = generateOrderConfirmedEmailHtml({ order, isStaff: true });
    await transporter.sendMail({
      from: fromAddress('Happy Hour Orders'),
      to: OPS_EMAIL,
      subject: `🎉 NEW ORDER PAID: #${orderNum} — KES ${Number(order.grandTotal || order.grand_total || 0).toLocaleString()}`,
      html: staffHtml,
      text: `New trade order #${orderNum} has been paid and confirmed. Total: KES ${Number(order.grandTotal || order.grand_total || 0).toLocaleString()}. Ready for dispatch.`,
    });
  } catch (err) {
    console.error(`[trade-email] Failed to send staff new order alert for ${orderNum}:`, err.message);
  }

  // 2. Buyer receipt and confirmation
  const buyerEmail = order.deliveryAddress?.contactEmail || order.orderedBy?.email || order.buyerEmail || (typeof order.ordered_by === 'object' ? order.ordered_by?.email : null);
  if (buyerEmail && typeof buyerEmail === 'string' && buyerEmail.includes('@')) {
    try {
      const buyerHtml = generateOrderConfirmedEmailHtml({ order, isStaff: false });
      await transporter.sendMail({
        from: fromAddress('Happy Hour B2B Trade'),
        to: buyerEmail,
        subject: `Order Confirmed: #${orderNum} — Happy Hour B2B Trade`,
        html: buyerHtml,
        text: `Thank you! Your order #${orderNum} has been received and confirmed. Total paid: KES ${Number(order.grandTotal || order.grand_total || 0).toLocaleString()}.`,
      });
    } catch (err) {
      console.error(`[trade-email] Failed to send buyer confirmation for ${orderNum}:`, err.message);
    }
  }
}

/**
 * Send password reset email to a business portal user.
 */
export async function sendTradePasswordResetEmail({ user, resetUrl, expiresInMinutes = 30 }) {
  if (!user || !user.email) return;

  const html = generatePasswordResetEmailHtml({ user, resetUrl, expiresInMinutes });

  console.log(`[trade-email] Sending password reset email to ${user.email}...`);
  return transporter.sendMail({
    from: fromAddress('Happy Hour B2B Portal'),
    to: user.email,
    subject: 'Reset Your Happy Hour B2B Portal Password',
    html,
    text: `We received a request to reset your Happy Hour B2B Portal password. Visit this link within ${expiresInMinutes} minutes to set a new password: ${resetUrl}`,
  });
}



import nodemailer from 'nodemailer';
import {
  generateInvoiceEmailHtml,
  generateDeliveryNoteEmailHtml,
  generateQuoteEmailHtml,
  generateApplicationReceivedEmailHtml,
  generateApplicationAdminNoticeHtml,
  generateAccountApprovedEmailHtml,
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
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME || '',
    pass: process.env.MAIL_PASSWORD || '',
  },
});

function fromAddress(name) {
  const address = (process.env.MAIL_FROM_ADDRESS || 'trade@myhappyhour.co.ke').replace(/"/g, '');
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

/** Send confirmation to applicant and notification to admin on new trade application. */
export async function sendTradeApplicationEmails({ application }) {
  if (!application) return;

  const adminEmail = process.env.ADMIN_EMAIL || 'orders@myhappyhour.co.ke';

  // 1. Send confirmation to applicant
  if (application.email) {
    try {
      await transporter.sendMail({
        from: fromAddress('Happy Hour B2B Trade Onboarding'),
        to: application.email,
        subject: `Application Received — ${application.tradingName} (Happy Hour B2B)`,
        html: generateApplicationReceivedEmailHtml(application),
        text: `Thank you for applying for a Happy Hour B2B Trade Account for ${application.tradingName}. Our vetting desk is reviewing your details.`,
      });
    } catch (err) {
      console.error('Failed to send applicant confirmation email:', err.message);
    }
  }

  // 2. Send notification to admin
  try {
    await transporter.sendMail({
      from: fromAddress('Happy Hour Trade System'),
      to: adminEmail,
      subject: `🔔 New B2B Trade Application: ${application.tradingName} (${application.segment})`,
      html: generateApplicationAdminNoticeHtml(application),
      text: `New B2B application received: ${application.tradingName} (${application.contactName}, ${application.email}, ${application.phone}). Log in to admin to review.`,
    });
  } catch (err) {
    console.error('Failed to send admin application alert email:', err.message);
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

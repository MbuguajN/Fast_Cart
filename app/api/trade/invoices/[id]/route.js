import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById } from '@/lib/trade/trade-store.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;
    const order = getTradeOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this invoice.' }, { status: 403 });
    }

    const invoice = {
      invoiceNumber: order.invoiceNumber,
      orderNumber: order.orderNumber,
      issueDate: order.createdAt.split('T')[0],
      dueDate: order.dueDate,
      status: order.paymentStatus,
      paymentTerms: order.paymentTerms,
      poReference: order.poReference,
      supplier: {
        companyName: 'Happy Hour / Nordic Drinks Kenya Ltd',
        kraPin: 'P051982734K',
        vatNumber: '02381944M',
        physicalAddress: 'Enterprise Road Industrial Area, Gate 4, Nairobi, Kenya',
        email: 'accounts@myhappyhour.co.ke',
        phone: '+254 700 000 000',
        paybill: '400200',
        accountNumber: 'HAPPYHOUR',
        bankDetails: {
          bank: 'Standard Chartered Bank Kenya',
          branch: 'Kenyatta Avenue Branch',
          accountName: 'Nordic Drinks Kenya Ltd - Trading as Happy Hour',
          accountNumber: '0108099221100',
          swiftCode: 'SCBLKENX',
        },
      },
      customer: {
        tradingName: auth.account.tradingName,
        legalName: auth.account.legalName,
        kraPin: auth.account.kraPin,
        licenceNo: auth.account.licenceNo,
        deliveryAddress: order.deliveryAddress,
      },
      lines: order.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        priceLine: i.priceLine,
        tierKey: i.tierKey,
        quantity: i.quantity,
        unitPriceExVat: i.unitPriceExVat,
        unitPriceIncVat: i.unitPriceIncVat,
        vatAmountPerUnit: i.vatAmountPerUnit,
        lineTotalExVat: i.lineTotalExVat,
        lineTotalIncVat: i.lineTotalIncVat,
      })),
      totalBottles: order.totalBottles,
      subtotalExVat: order.subtotalExVat,
      vatTotal: order.vatTotal,
      deliveryFee: order.deliveryFee,
      referralCredit: order.referralCredit,
      grandTotal: order.grandTotal,
      footing: order.footing,
    };

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}


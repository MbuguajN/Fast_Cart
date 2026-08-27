import fs from 'fs';
import path from 'path';
import { writeJsonAtomic, mutateJson } from '../atomic-json.js';
import {
  DEFAULT_PRICE_BANDS,
  calculateTradeOrderPricing,
  evaluateMinimumOrderRule,
  assertInvoiceFooting,
  roundCent,
  roundKes,
} from './pricing-engine.js';

const TRADE_STORE_PATH = path.join(process.cwd(), 'data', 'trade-store.json');

const INITIAL_TRADE_DATA = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  invoiceSequence: 1042,
  quoteSequence: 108,
  config: {
    priceBands: DEFAULT_PRICE_BANDS,
    minOrderBottles: 12,
    minOrderGoodsExVat: 10000,
    nairobiFreeDeliveryThreshold: 25000,
    nairobiDeliveryFee: 500,
    gmFloorPercent: 4.0,
    termsVersion: '2026.1-B2B',
    deliveryCutoffHour: 12,
    referralBonusKes: 5000,
  },
  accounts: [
    {
      id: 'acc_serena_01',
      tradingName: 'Nairobi Serena Hotel',
      legalName: 'Tourism Promotion Services (TPS) Serena Kenya PLC',
      segment: 'horeca',
      status: 'active',
      kraPin: 'P051123456Z',
      licenceNo: 'LQ-NRB-2025-8841',
      licenceDocUrl: '/docs/licences/serena-liquor-licence-2026.pdf',
      licenceExpiry: '2026-12-31',
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: true,
      creditLimit: 500000,
      creditTerms: 14,
      creditUsed: 145000,
      cleanOrders: 8,
      orderCeiling: 250000,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_serena_main',
          label: 'Central Receiving Dock',
          contactName: 'Main Bar Receiving (Attn: David)',
          phone: '+254722111222',
          addressLine: 'Kenyatta Avenue / Processional Way, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '08:00 - 12:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_serena_main',
      points: 1240,
      referralCredit: 5000,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-01-10T09:00:00.000Z',
      },
      createdAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'acc_acme_corp',
      tradingName: 'Acme Advisory Kenya',
      legalName: 'Acme Advisory Services East Africa Ltd',
      segment: 'corporate',
      status: 'active',
      kraPin: 'P059876543A',
      licenceNo: '',
      licenceDocUrl: null,
      licenceExpiry: null,
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: true,
      creditLimit: 150000,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 3,
      orderCeiling: null,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_acme_hq',
          label: 'Riverside Headquarters',
          contactName: 'Office Admin (Attn: Faith)',
          phone: '+254733444555',
          addressLine: 'Delta Corner Tower A, 7th Floor, Westlands, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '09:00 - 17:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_acme_hq',
      points: 450,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-02-01T11:00:00.000Z',
      },
      createdAt: '2026-02-01T11:00:00.000Z',
    },
    {
      id: 'acc_westlands_lounge',
      tradingName: 'The Alchemist Westlands',
      legalName: 'Urban Oasis Entertainment Ltd',
      segment: 'horeca',
      status: 'active',
      kraPin: 'P054433221C',
      licenceNo: 'LQ-NRB-2025-4102',
      licenceDocUrl: '/docs/licences/alchemist-licence.pdf',
      licenceExpiry: '2026-09-05',
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: false,
      creditLimit: 0,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 2,
      orderCeiling: null,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_alchemist_bar',
          label: 'Main Bar Store',
          contactName: 'Head Bartender Eric',
          phone: '+254701234999',
          addressLine: 'Parklands Road, Westlands, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '14:00 - 18:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_alchemist_bar',
      points: 800,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-03-15T14:30:00.000Z',
      },
      createdAt: '2026-03-15T14:30:00.000Z',
    },
    {
      id: 'acc_sankara_vip',
      tradingName: 'Sankara Hotel Bar & Grill',
      legalName: 'Westlands Hospitality Group PLC',
      segment: 'horeca',
      status: 'active',
      kraPin: 'P057788990D',
      licenceNo: 'LQ-NRB-2025-9922',
      licenceDocUrl: '/docs/licences/sankara-licence.pdf',
      licenceExpiry: '2027-01-30',
      priceBook: 'standard',
      tierOverride: 'T2',
      creditEnabled: true,
      creditLimit: 1000000,
      creditTerms: 14,
      creditUsed: 320000,
      cleanOrders: 14,
      orderCeiling: 400000,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_sankara_dock',
          label: 'Woodvale Receiving',
          contactName: 'Beverage Manager (Attn: Kelvin)',
          phone: '+254711889900',
          addressLine: '05 Woodvale Grove, Westlands, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '08:00 - 12:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_sankara_dock',
      points: 3400,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-01-05T08:00:00.000Z',
      },
      createdAt: '2026-01-05T08:00:00.000Z',
    },
    {
      id: 'acc_capital_club',
      tradingName: 'Capital Club East Africa',
      legalName: 'Imperial Club Operations Ltd',
      segment: 'residence',
      status: 'active',
      kraPin: 'P056677889E',
      licenceNo: 'LQ-NRB-2025-7731',
      licenceDocUrl: '/docs/licences/capital-club.pdf',
      licenceExpiry: '2026-12-15',
      priceBook: 'standard',
      tierOverride: 'T2',
      creditEnabled: true,
      creditLimit: 750000,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 8,
      orderCeiling: 300000,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_capital_dock',
          label: 'Imperial Tower Level 4 Dock',
          contactName: 'F&B Director Michael',
          phone: '+254722556677',
          addressLine: 'Imperial Tower, Westlands, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '08:00 - 12:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_capital_dock',
      points: 2100,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-02-10T10:00:00.000Z',
      },
      createdAt: '2026-02-10T10:00:00.000Z',
    },
    {
      id: 'acc_artcaffe_grand',
      tradingName: 'Artcaffé Grand Oval',
      legalName: 'Artcaffe Coffee & Bakery Ltd',
      segment: 'horeca',
      status: 'active',
      kraPin: 'P053344556F',
      licenceNo: 'LQ-NRB-2025-5522',
      licenceDocUrl: '/docs/licences/artcaffe.pdf',
      licenceExpiry: '2026-11-20',
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: true,
      creditLimit: 300000,
      creditTerms: 14,
      creditUsed: 94500,
      cleanOrders: 6,
      orderCeiling: 150000,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_artcaffe_oval',
          label: 'The Oval Ground Floor Service Bay',
          contactName: 'Beverage Manager Sarah',
          phone: '+254711334455',
          addressLine: 'Ring Road Parklands, The Oval, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '06:00 - 10:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_artcaffe_oval',
      points: 980,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-03-01T08:00:00.000Z',
      },
      createdAt: '2026-03-01T08:00:00.000Z',
    },
    {
      id: 'acc_pending_kikuyu',
      tradingName: 'Kikuyu County Club',
      legalName: 'Kikuyu Golf & Country Resort Ltd',
      segment: 'horeca',
      status: 'pending',
      kraPin: 'P051188223B',
      licenceNo: 'LQ-KIAM-2025-1100',
      licenceDocUrl: '/docs/licences/kikuyu-licence.pdf',
      licenceExpiry: '2026-11-30',
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: false,
      creditLimit: 0,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 0,
      orderCeiling: null,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_kikuyu_club',
          label: 'Clubhouse Store',
          contactName: 'General Manager Peter',
          phone: '+254722888999',
          addressLine: 'Ondiri Road, Kikuyu, Kiambu County',
          city: 'Kiambu',
          deliveryWindow: '10:00 - 16:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_kikuyu_club',
      points: 0,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-08-25T16:00:00.000Z',
      },
      createdAt: '2026-08-25T16:00:00.000Z',
    },
    {
      id: 'acc_pending_carnivore',
      tradingName: 'The Carnivore Restaurant Nairobi',
      legalName: 'Tamarind Management Ltd',
      segment: 'horeca',
      status: 'pending',
      kraPin: 'P052244668G',
      licenceNo: 'LQ-NRB-2025-3388',
      licenceDocUrl: '/docs/licences/carnivore-licence.pdf',
      licenceExpiry: '2027-02-28',
      priceBook: 'standard',
      tierOverride: null,
      creditEnabled: false,
      creditLimit: 0,
      creditTerms: 14,
      creditUsed: 0,
      cleanOrders: 0,
      orderCeiling: null,
      accountManager: {
        id: 'am_paulette',
        name: 'Paulette Chege',
        email: 'paulette@myhappyhour.co.ke',
        phone: '+254711234567',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        role: 'Key Account Director',
      },
      addresses: [
        {
          id: 'addr_carnivore_main',
          label: 'Langata Central Kitchen Receiving',
          contactName: 'F&B Head Martin Mwangi',
          phone: '+254722778899',
          addressLine: 'Langata Road, Nairobi',
          city: 'Nairobi',
          deliveryWindow: '07:00 - 11:00 EAT',
          isDefault: true,
        },
      ],
      defaultAddressId: 'addr_carnivore_main',
      points: 0,
      referralCredit: 0,
      termsAccepted: {
        version: '2026.1-B2B',
        acceptedAt: '2026-08-26T14:00:00.000Z',
      },
      createdAt: '2026-08-26T14:00:00.000Z',
    },
  ],
  users: [
    {
      id: 'usr_serena_owner',
      accountId: 'acc_serena_01',
      name: 'Angela Mutua',
      role: 'Finance Director',
      seatType: 'owner',
      email: 'angela.mutua@serenahotels.com',
      phone: '+254711998877',
    },
    {
      id: 'usr_serena_buyer',
      accountId: 'acc_serena_01',
      name: 'David Kimani',
      role: 'Beverage Manager',
      seatType: 'buyer',
      email: 'david.kimani@serenahotels.com',
      phone: '+254722111222',
    },
    {
      id: 'usr_serena_viewer',
      accountId: 'acc_serena_01',
      name: 'Grace Wanjiku',
      role: 'Internal Auditor',
      seatType: 'viewer',
      email: 'grace.wanjiku@serenahotels.com',
      phone: '+254733112233',
    },
    {
      id: 'usr_sankara_owner',
      accountId: 'acc_sankara_vip',
      name: 'Kelvin Mwangi',
      role: 'Director of Procurement',
      seatType: 'owner',
      email: 'kelvin.mwangi@sankaranairobi.com',
      phone: '+254711889900',
    },
    {
      id: 'usr_capital_owner',
      accountId: 'acc_capital_club',
      name: 'Michael Ndungu',
      role: 'Director of Food & Beverage',
      seatType: 'owner',
      email: 'michael.ndungu@capitalclubea.com',
      phone: '+254722556677',
    },
    {
      id: 'usr_artcaffe_buyer',
      accountId: 'acc_artcaffe_grand',
      name: 'Sarah Njoroge',
      role: 'Central Beverage Manager',
      seatType: 'buyer',
      email: 'sarah.njoroge@artcaffe.co.ke',
      phone: '+254711334455',
    },
    {
      id: 'usr_westlands_buyer',
      accountId: 'acc_westlands_lounge',
      name: 'Eric Omondi',
      role: 'Bar Manager',
      seatType: 'owner',
      email: 'eric@alchemist.co.ke',
      phone: '+254701234999',
    },
    {
      id: 'usr_acme_buyer',
      accountId: 'acc_acme_corp',
      name: 'Faith Chebet',
      role: 'Office Operations',
      seatType: 'owner',
      email: 'faith.chebet@acmeadvisory.co.ke',
      phone: '+254733444555',
    },
  ],
  prkCosts: {
    'jameson-original-750ml': 2850,
    'jameson-black-barrel-750ml': 4200,
    'chivas-regal-12yo-750ml': 3600,
    'chivas-regal-18yo-750ml': 7800,
    'the-glenlivet-12yo-750ml': 5400,
    'the-glenlivet-15yo-750ml': 8900,
    'the-glenlivet-18yo-750ml': 14500,
    'ballantines-finest-750ml': 1850,
    'martell-vs-750ml': 4900,
    'martell-vsop-750ml': 7500,
    'absolut-vodka-750ml': 1950,
    'beefeater-london-dry-gin-750ml': 1950,
    'malfy-gin-originale-750ml': 3400,
    'malfy-gin-rosa-750ml': 3400,
    'olmeca-tequila-silver-750ml': 2600,
    'olmeca-tequila-gold-750ml': 2600,
    'belaire-rare-rose-750ml': 4800,
    'jinro-chamilsul-soju-350ml': 340,
    'jinro-grapefruit-soju-350ml': 340,
  },
  templates: [
    {
      id: 'tpl_hospitality_bar',
      name: 'Hospitality High-Volume Bar Starter',
      segment: 'horeca',
      description: 'Standard fast-moving spirits and mixers package for premium hotel and cocktail bars.',
      items: [
        { sku: 'jameson-original-750ml', name: 'Jameson Irish Whiskey 750ml', quantity: 24, priceLine: 'spirits', prkCostIncVat: 2850 },
        { sku: 'beefeater-london-dry-gin-750ml', name: 'Beefeater London Dry Gin 750ml', quantity: 24, priceLine: 'spirits', prkCostIncVat: 1950 },
        { sku: 'absolut-vodka-750ml', name: 'Absolut Blue Vodka 750ml', quantity: 24, priceLine: 'spirits', prkCostIncVat: 1950 },
        { sku: 'jaba-beetroot-500ml', name: 'Happy Hour Jaba Juice Beetroot 500ml', quantity: 50, priceLine: 'jaba', prkCostIncVat: 0 },
        { sku: 'jaba-tamarind-500ml', name: 'Happy Hour Jaba Juice Tamarind 500ml', quantity: 50, priceLine: 'jaba', prkCostIncVat: 0 },
      ],
    },
    {
      id: 'tpl_corporate_lounge',
      name: 'Corporate Executive Lounge Pack',
      segment: 'corporate',
      description: 'Curated blend of premium single malts, classic whiskey, and organic Jaba juices for boardroom events.',
      items: [
        { sku: 'the-glenlivet-12yo-750ml', name: 'The Glenlivet 12YO Single Malt 750ml', quantity: 6, priceLine: 'spirits', prkCostIncVat: 5400 },
        { sku: 'chivas-regal-12yo-750ml', name: 'Chivas Regal 12YO Blended Scotch 750ml', quantity: 12, priceLine: 'spirits', prkCostIncVat: 3600 },
        { sku: 'jaba-hibiscus-500ml', name: 'Happy Hour Jaba Juice Hibiscus 500ml', quantity: 30, priceLine: 'jaba', prkCostIncVat: 0 },
        { sku: 'jaba-pineapple-500ml', name: 'Happy Hour Jaba Juice Pineapple 500ml', quantity: 30, priceLine: 'jaba', prkCostIncVat: 0 },
      ],
    },
    {
      id: 'tpl_event_party',
      name: 'Event & Festival Big Pour Pack',
      segment: 'events',
      description: 'High-margin Tier 3 volume bundle for large catered events and music festivals.',
      items: [
        { sku: 'jameson-original-750ml', name: 'Jameson Irish Whiskey 750ml', quantity: 75, priceLine: 'spirits', prkCostIncVat: 2850 },
        { sku: 'olmeca-tequila-silver-750ml', name: 'Olmeca Tequila Silver 750ml', quantity: 75, priceLine: 'spirits', prkCostIncVat: 2600 },
        { sku: 'jaba-tropical-500ml', name: 'Happy Hour Jaba Juice Tropical Mix 500ml', quantity: 200, priceLine: 'jaba', prkCostIncVat: 0 },
      ],
    },
  ],
  orders: [
    {
      id: 'ord_tr_1041',
      orderNumber: 'HH-TR-1041',
      invoiceNumber: 'HH-INV-2026-1041',
      accountId: 'acc_serena_01',
      accountName: 'Nairobi Serena Hotel',
      segment: 'horeca',
      orderedBy: { id: 'usr_serena_buyer', name: 'David Kimani', email: 'david.kimani@serenahotels.com' },
      status: 'delivered',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'paid',
      dueDate: '2026-08-15',
      paidAt: '2026-08-14T10:00:00.000Z',
      poReference: 'PO-SRN-99812',
      items: [
        {
          sku: 'jameson-original-750ml',
          name: 'Jameson Irish Whiskey 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 24,
          unitPriceIncVat: 3135,
          unitPriceExVat: 2702.59,
          vatAmountPerUnit: 432.41,
          lineTotalExVat: 64862.16,
          lineTotalIncVat: 75240,
          prkCostSnapshot: 2850,
          totalCostSnapshot: 68400,
          marginPercent: 9.1,
        },
        {
          sku: 'jaba-beetroot-500ml',
          name: 'Happy Hour Jaba Juice Beetroot 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 50,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 37500,
          lineTotalIncVat: 43500,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 74,
      subtotalExVat: 102362.16,
      vatTotal: 16377.84,
      subtotalIncVat: 118740,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 118740,
      deliveryAddress: {
        label: 'Central Receiving Dock',
        contactName: 'Main Bar Receiving (Attn: David)',
        phone: '+254722111222',
        addressLine: 'Kenyatta Avenue / Processional Way, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 68400,
        grossProfit: 50340,
        grossMarginPercent: 42.4,
      },
      createdAt: '2026-08-01T09:15:00.000Z',
    },
    {
      id: 'ord_tr_1042',
      orderNumber: 'HH-TR-1042',
      invoiceNumber: 'HH-INV-2026-1042',
      accountId: 'acc_serena_01',
      accountName: 'Nairobi Serena Hotel',
      segment: 'horeca',
      orderedBy: { id: 'usr_serena_buyer', name: 'David Kimani', email: 'david.kimani@serenahotels.com' },
      status: 'dispatched',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'unpaid',
      dueDate: '2026-09-09',
      poReference: 'PO-SRN-99944',
      items: [
        {
          sku: 'the-glenlivet-12yo-750ml',
          name: 'The Glenlivet 12YO Single Malt 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 12,
          unitPriceIncVat: 5940,
          unitPriceExVat: 5120.69,
          vatAmountPerUnit: 819.31,
          lineTotalExVat: 61448.28,
          lineTotalIncVat: 71280,
          prkCostSnapshot: 5400,
          totalCostSnapshot: 64800,
          marginPercent: 9.1,
        },
        {
          sku: 'chivas-regal-12yo-750ml',
          name: 'Chivas Regal 12YO Blended Scotch 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 12,
          unitPriceIncVat: 3960,
          unitPriceExVat: 3413.79,
          vatAmountPerUnit: 546.21,
          lineTotalExVat: 40965.48,
          lineTotalIncVat: 47520,
          prkCostSnapshot: 3600,
          totalCostSnapshot: 43200,
          marginPercent: 9.1,
        },
      ],
      totalBottles: 24,
      subtotalExVat: 102413.76,
      vatTotal: 16386.24,
      subtotalIncVat: 118800,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 118800,
      deliveryAddress: {
        label: 'Central Receiving Dock',
        contactName: 'Main Bar Receiving (Attn: David)',
        phone: '+254722111222',
        addressLine: 'Kenyatta Avenue / Processional Way, Nairobi',
        city: 'Nairobi',
      },
      driverInfo: {
        name: 'Boniface O.',
        phone: '+254712003344',
        vehicle: 'KDF 412X (Happy Hour Van 04)',
      },
      economics: {
        prkCostTotal: 108000,
        grossProfit: 10800,
        grossMarginPercent: 9.1,
      },
      createdAt: '2026-08-26T08:30:00.000Z',
    },
    {
      id: 'ord_tr_1043',
      orderNumber: 'HH-TR-1043',
      invoiceNumber: 'HH-INV-2026-1043',
      accountId: 'acc_sankara_vip',
      accountName: 'Sankara Hotel Bar & Grill',
      segment: 'horeca',
      orderedBy: { id: 'usr_sankara_owner', name: 'Kelvin Mwangi', email: 'kelvin.mwangi@sankaranairobi.com' },
      status: 'delivered',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'paid',
      dueDate: '2026-08-22',
      paidAt: '2026-08-21T14:20:00.000Z',
      poReference: 'PO-SNK-4402',
      items: [
        {
          sku: 'jameson-original-750ml',
          name: 'Jameson Irish Whiskey 750ml',
          priceLine: 'spirits',
          tierKey: 'T2',
          quantity: 72,
          unitPriceIncVat: 3050,
          unitPriceExVat: 2629.31,
          vatAmountPerUnit: 420.69,
          lineTotalExVat: 189310.32,
          lineTotalIncVat: 219600,
          prkCostSnapshot: 2850,
          totalCostSnapshot: 205200,
          marginPercent: 6.5,
        },
        {
          sku: 'jaba-tamarind-500ml',
          name: 'Happy Hour Jaba Juice Tamarind 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 50,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 37500,
          lineTotalIncVat: 43500,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 122,
      subtotalExVat: 226810.32,
      vatTotal: 36289.68,
      subtotalIncVat: 263100,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 263100,
      deliveryAddress: {
        label: 'Woodvale Receiving',
        contactName: 'Beverage Manager (Attn: Kelvin)',
        phone: '+254711889900',
        addressLine: '05 Woodvale Grove, Westlands, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 205200,
        grossProfit: 57900,
        grossMarginPercent: 22.0,
      },
      createdAt: '2026-08-08T11:00:00.000Z',
    },
    {
      id: 'ord_tr_1044',
      orderNumber: 'HH-TR-1044',
      invoiceNumber: 'HH-INV-2026-1044',
      accountId: 'acc_westlands_lounge',
      accountName: 'The Alchemist Westlands',
      segment: 'horeca',
      orderedBy: { id: 'usr_westlands_buyer', name: 'Eric Omondi', email: 'eric@alchemist.co.ke' },
      status: 'picking',
      paymentTerms: 'prepayment',
      paymentMethod: 'mpesa_b2b',
      paymentStatus: 'paid',
      dueDate: '2026-08-27',
      paidAt: '2026-08-27T06:00:00.000Z',
      poReference: 'PO-ALC-8819',
      items: [
        {
          sku: 'beefeater-london-dry-gin-750ml',
          name: 'Beefeater London Dry Gin 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 24,
          unitPriceIncVat: 2145,
          unitPriceExVat: 1849.14,
          vatAmountPerUnit: 295.86,
          lineTotalExVat: 44379.36,
          lineTotalIncVat: 51480,
          prkCostSnapshot: 1950,
          totalCostSnapshot: 46800,
          marginPercent: 9.1,
        },
        {
          sku: 'jaba-beetroot-500ml',
          name: 'Happy Hour Jaba Juice Beetroot 500ml',
          priceLine: 'jaba',
          tierKey: 'T2',
          quantity: 50,
          unitPriceIncVat: 812,
          unitPriceExVat: 700,
          vatAmountPerUnit: 112,
          lineTotalExVat: 35000,
          lineTotalIncVat: 40600,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 74,
      subtotalExVat: 79379.36,
      vatTotal: 12700.64,
      subtotalIncVat: 92080,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 92080,
      deliveryAddress: {
        label: 'Main Bar Store',
        contactName: 'Head Bartender Eric',
        phone: '+254701234999',
        addressLine: 'Parklands Road, Westlands, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 46800,
        grossProfit: 45280,
        grossMarginPercent: 49.2,
      },
      createdAt: '2026-08-27T05:30:00.000Z',
    },
    {
      id: 'ord_tr_1045',
      orderNumber: 'HH-TR-1045',
      invoiceNumber: 'HH-INV-2026-1045',
      accountId: 'acc_acme_corp',
      accountName: 'Acme Advisory Kenya',
      segment: 'corporate',
      orderedBy: { id: 'usr_acme_buyer', name: 'Faith Chebet', email: 'faith.chebet@acmeadvisory.co.ke' },
      status: 'confirmed',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'unpaid',
      dueDate: '2026-09-10',
      poReference: 'PO-ACM-3301',
      items: [
        {
          sku: 'jaba-hibiscus-500ml',
          name: 'Happy Hour Jaba Juice Hibiscus 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 30,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 22500,
          lineTotalIncVat: 26100,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
        {
          sku: 'jaba-pineapple-500ml',
          name: 'Happy Hour Jaba Juice Pineapple 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 30,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 22500,
          lineTotalIncVat: 26100,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 60,
      subtotalExVat: 45000,
      vatTotal: 7200,
      subtotalIncVat: 52200,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 52200,
      deliveryAddress: {
        label: 'Riverside Headquarters',
        contactName: 'Office Admin (Attn: Faith)',
        phone: '+254733444555',
        addressLine: 'Delta Corner Tower A, 7th Floor, Westlands, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 0,
        grossProfit: 52200,
        grossMarginPercent: 100.0,
      },
      createdAt: '2026-08-27T07:15:00.000Z',
    },
    {
      id: 'ord_tr_1046',
      orderNumber: 'HH-TR-1046',
      invoiceNumber: 'HH-INV-2026-1046',
      accountId: 'acc_capital_club',
      accountName: 'Capital Club East Africa',
      segment: 'residence',
      orderedBy: { id: 'usr_capital_owner', name: 'Michael Ndungu', email: 'michael.ndungu@capitalclubea.com' },
      status: 'delivered',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'paid',
      dueDate: '2026-08-20',
      paidAt: '2026-08-19T11:00:00.000Z',
      poReference: 'PO-CAP-0912',
      items: [
        {
          sku: 'the-glenlivet-15yo-750ml',
          name: 'The Glenlivet 15YO Single Malt 750ml',
          priceLine: 'spirits',
          tierKey: 'T2',
          quantity: 12,
          unitPriceIncVat: 9523,
          unitPriceExVat: 8209.48,
          vatAmountPerUnit: 1313.52,
          lineTotalExVat: 98513.76,
          lineTotalIncVat: 114276,
          prkCostSnapshot: 8900,
          totalCostSnapshot: 106800,
          marginPercent: 6.5,
        },
        {
          sku: 'belaire-rare-rose-750ml',
          name: 'Luc Belaire Rare Rosé 750ml',
          priceLine: 'spirits',
          tierKey: 'T2',
          quantity: 12,
          unitPriceIncVat: 5136,
          unitPriceExVat: 4427.59,
          vatAmountPerUnit: 708.41,
          lineTotalExVat: 53131.08,
          lineTotalIncVat: 61632,
          prkCostSnapshot: 4800,
          totalCostSnapshot: 57600,
          marginPercent: 6.5,
        },
      ],
      totalBottles: 24,
      subtotalExVat: 151644.84,
      vatTotal: 24263.16,
      subtotalIncVat: 175908,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 175908,
      deliveryAddress: {
        label: 'Imperial Tower Level 4 Dock',
        contactName: 'F&B Director Michael',
        phone: '+254722556677',
        addressLine: 'Imperial Tower, Westlands, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 164400,
        grossProfit: 11508,
        grossMarginPercent: 6.5,
      },
      createdAt: '2026-08-06T14:00:00.000Z',
    },
    {
      id: 'ord_tr_1047',
      orderNumber: 'HH-TR-1047',
      invoiceNumber: 'HH-INV-2026-1047',
      accountId: 'acc_artcaffe_grand',
      accountName: 'Artcaffé Grand Oval',
      segment: 'horeca',
      orderedBy: { id: 'usr_artcaffe_buyer', name: 'Sarah Njoroge', email: 'sarah.njoroge@artcaffe.co.ke' },
      status: 'confirmed',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'unpaid',
      dueDate: '2026-09-10',
      poReference: 'PO-ART-7721',
      items: [
        {
          sku: 'malfy-gin-rosa-750ml',
          name: 'Malfy Gin Rosa 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 18,
          unitPriceIncVat: 3740,
          unitPriceExVat: 3224.14,
          vatAmountPerUnit: 515.86,
          lineTotalExVat: 58034.52,
          lineTotalIncVat: 67320,
          prkCostSnapshot: 3400,
          totalCostSnapshot: 61200,
          marginPercent: 9.1,
        },
        {
          sku: 'jaba-tamarind-500ml',
          name: 'Happy Hour Jaba Juice Tamarind 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 30,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 22500,
          lineTotalIncVat: 26100,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 48,
      subtotalExVat: 80534.52,
      vatTotal: 12885.48,
      subtotalIncVat: 93420,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 93420,
      deliveryAddress: {
        label: 'The Oval Ground Floor Service Bay',
        contactName: 'Beverage Manager Sarah',
        phone: '+254711334455',
        addressLine: 'Ring Road Parklands, The Oval, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 61200,
        grossProfit: 32220,
        grossMarginPercent: 34.5,
      },
      createdAt: '2026-08-27T08:00:00.000Z',
    },
    {
      id: 'ord_tr_1048',
      orderNumber: 'HH-TR-1048',
      invoiceNumber: 'HH-INV-2026-1048',
      accountId: 'acc_serena_01',
      accountName: 'Nairobi Serena Hotel',
      segment: 'horeca',
      orderedBy: { id: 'usr_serena_buyer', name: 'David Kimani', email: 'david.kimani@serenahotels.com' },
      status: 'awaiting_approval',
      paymentTerms: 'credit_14',
      paymentMethod: 'pay_on_account',
      paymentStatus: 'unpaid',
      dueDate: '2026-09-10',
      poReference: 'PO-SRN-00104',
      items: [
        {
          sku: 'the-glenlivet-18yo-750ml',
          name: 'The Glenlivet 18YO Single Malt 750ml',
          priceLine: 'spirits',
          tierKey: 'T1',
          quantity: 18,
          unitPriceIncVat: 15950,
          unitPriceExVat: 13750,
          vatAmountPerUnit: 2200,
          lineTotalExVat: 247500,
          lineTotalIncVat: 287100,
          prkCostSnapshot: 14500,
          totalCostSnapshot: 261000,
          marginPercent: 9.1,
        },
        {
          sku: 'jaba-tropical-500ml',
          name: 'Happy Hour Jaba Juice Tropical Mix 500ml',
          priceLine: 'jaba',
          tierKey: 'T1',
          quantity: 30,
          unitPriceIncVat: 870,
          unitPriceExVat: 750,
          vatAmountPerUnit: 120,
          lineTotalExVat: 22500,
          lineTotalIncVat: 26100,
          prkCostSnapshot: 0,
          totalCostSnapshot: 0,
          marginPercent: 62.5,
        },
      ],
      totalBottles: 48,
      subtotalExVat: 270000,
      vatTotal: 43200,
      subtotalIncVat: 313200,
      deliveryFee: 0,
      referralCredit: 0,
      grandTotal: 313200,
      deliveryAddress: {
        label: 'Central Receiving Dock',
        contactName: 'Main Bar Receiving (Attn: David)',
        phone: '+254722111222',
        addressLine: 'Kenyatta Avenue / Processional Way, Nairobi',
        city: 'Nairobi',
      },
      economics: {
        prkCostTotal: 261000,
        grossProfit: 52200,
        grossMarginPercent: 16.7,
      },
      createdAt: '2026-08-27T08:45:00.000Z',
    },
  ],
  quotes: [
    {
      id: 'quote_101',
      quoteNumber: 'HH-QT-2026-101',
      accountId: 'acc_acme_corp',
      accountName: 'Acme Advisory Kenya',
      status: 'sent',
      validUntil: '2026-09-30T23:59:59.000Z',
      notes: 'Corporate End-of-Quarter Staff Celebration & Executive Lounge restock.',
      items: [
        { sku: 'jaba-hibiscus-500ml', name: 'Happy Hour Jaba Juice Hibiscus 500ml', quantity: 60, priceLine: 'jaba', prkCostIncVat: 0, tierKey: 'T2', unitPriceIncVat: 812, unitPriceExVat: 700, lineTotalExVat: 42000, lineTotalIncVat: 48720 },
        { sku: 'jaba-pineapple-500ml', name: 'Happy Hour Jaba Juice Pineapple 500ml', quantity: 60, priceLine: 'jaba', prkCostIncVat: 0, tierKey: 'T2', unitPriceIncVat: 812, unitPriceExVat: 700, lineTotalExVat: 42000, lineTotalIncVat: 48720 },
        { sku: 'jaba-tropical-500ml', name: 'Happy Hour Jaba Juice Tropical Mix 500ml', quantity: 60, priceLine: 'jaba', prkCostIncVat: 0, tierKey: 'T2', unitPriceIncVat: 812, unitPriceExVat: 700, lineTotalExVat: 42000, lineTotalIncVat: 48720 },
      ],
      totalBottles: 180,
      subtotalExVat: 126000,
      vatTotal: 20160,
      deliveryFee: 0,
      grandTotal: 146160,
      createdAt: '2026-08-25T10:00:00.000Z',
    },
    {
      id: 'quote_102',
      quoteNumber: 'HH-QT-2026-102',
      accountId: 'acc_westlands_lounge',
      accountName: 'The Alchemist Westlands',
      status: 'sent',
      validUntil: '2026-10-15T23:59:59.000Z',
      notes: 'Westlands Art & Music Festival Weekend Big Pour package.',
      items: [
        { sku: 'jameson-original-750ml', name: 'Jameson Irish Whiskey 750ml', quantity: 100, priceLine: 'spirits', prkCostIncVat: 2850, tierKey: 'T3', unitPriceIncVat: 2964, unitPriceExVat: 2555.17, lineTotalExVat: 255517, lineTotalIncVat: 296400 },
        { sku: 'olmeca-tequila-silver-750ml', name: 'Olmeca Tequila Silver 750ml', quantity: 100, priceLine: 'spirits', prkCostIncVat: 2600, tierKey: 'T3', unitPriceIncVat: 2704, unitPriceExVat: 2331.03, lineTotalExVat: 233103, lineTotalIncVat: 270400 },
      ],
      totalBottles: 200,
      subtotalExVat: 488620,
      vatTotal: 78180,
      deliveryFee: 0,
      grandTotal: 566800,
      createdAt: '2026-08-26T12:00:00.000Z',
    },
    {
      id: 'quote_103',
      quoteNumber: 'HH-QT-2026-103',
      accountId: 'acc_capital_club',
      accountName: 'Capital Club East Africa',
      status: 'sent',
      validUntil: '2026-09-15T23:59:59.000Z',
      notes: 'Diplomatic Ambassador Dinner special reserve Single Malts.',
      items: [
        { sku: 'the-glenlivet-18yo-750ml', name: 'The Glenlivet 18YO Single Malt 750ml', quantity: 36, priceLine: 'spirits', prkCostIncVat: 14500, tierKey: 'T2', unitPriceIncVat: 15515, unitPriceExVat: 13375, lineTotalExVat: 481500, lineTotalIncVat: 558540 },
        { sku: 'martell-vsop-750ml', name: 'Martell VSOP Cognac 750ml', quantity: 24, priceLine: 'spirits', prkCostIncVat: 7500, tierKey: 'T2', unitPriceIncVat: 8025, unitPriceExVat: 6918.1, lineTotalExVat: 166034.4, lineTotalIncVat: 192600 },
      ],
      totalBottles: 60,
      subtotalExVat: 647534.4,
      vatTotal: 103605.6,
      deliveryFee: 0,
      grandTotal: 751140,
      createdAt: '2026-08-26T15:30:00.000Z',
    },
    {
      id: 'quote_104',
      quoteNumber: 'HH-QT-2026-104',
      accountId: 'acc_artcaffe_grand',
      accountName: 'Artcaffé Grand Oval',
      status: 'sent',
      validUntil: '2026-09-20T23:59:59.000Z',
      notes: 'Seasonal Spring Gin & Tonic Brunch restock.',
      items: [
        { sku: 'malfy-gin-originale-750ml', name: 'Malfy Gin Originale 750ml', quantity: 48, priceLine: 'spirits', prkCostIncVat: 3400, tierKey: 'T2', unitPriceIncVat: 3638, unitPriceExVat: 3136.21, lineTotalExVat: 150538.08, lineTotalIncVat: 174624 },
        { sku: 'jaba-tamarind-500ml', name: 'Happy Hour Jaba Juice Tamarind 500ml', quantity: 100, priceLine: 'jaba', prkCostIncVat: 0, tierKey: 'T2', unitPriceIncVat: 812, unitPriceExVat: 700, lineTotalExVat: 70000, lineTotalIncVat: 81200 },
      ],
      totalBottles: 148,
      subtotalExVat: 220538.08,
      vatTotal: 35285.92,
      deliveryFee: 0,
      grandTotal: 255824,
      createdAt: '2026-08-27T09:00:00.000Z',
    },
  ],
  auditLog: [],
};

export function readTradeStore() {
  try {
    if (!fs.existsSync(TRADE_STORE_PATH)) {
      fs.mkdirSync(path.dirname(TRADE_STORE_PATH), { recursive: true });
      fs.writeFileSync(TRADE_STORE_PATH, JSON.stringify(INITIAL_TRADE_DATA, null, 2), 'utf-8');
      return INITIAL_TRADE_DATA;
    }
    const raw = fs.readFileSync(TRADE_STORE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.accounts) data.accounts = INITIAL_TRADE_DATA.accounts;
    if (!data.users) data.users = INITIAL_TRADE_DATA.users;
    if (!data.orders) data.orders = INITIAL_TRADE_DATA.orders;
    if (!data.quotes) data.quotes = INITIAL_TRADE_DATA.quotes;
    if (!data.templates) data.templates = INITIAL_TRADE_DATA.templates;
    if (!data.prkCosts) data.prkCosts = INITIAL_TRADE_DATA.prkCosts;
    if (!data.config) data.config = INITIAL_TRADE_DATA.config;
    return data;
  } catch (err) {
    console.error('Error reading trade store:', err);
    return INITIAL_TRADE_DATA;
  }
}

export function writeTradeStore(data) {
  try {
    writeJsonAtomic(TRADE_STORE_PATH, data);
  } catch (err) {
    console.error('Error writing trade store:', err);
    throw err;
  }
}

/**
 * Run a read-modify-write cycle against the trade store under a lock.
 *
 * Required for anything that increments a running total — `creditUsed` above
 * all. Without it, two concurrent orders on one account each read the same
 * starting balance and the second write discards the first increment, so the
 * account passes a credit check it should have failed.
 */
export function mutateTradeStore(mutate) {
  return mutateJson(TRADE_STORE_PATH, readTradeStore, writeTradeStore, mutate);
}

// ----------------- ACCOUNTS -----------------

export function getTradeAccounts() {
  const store = readTradeStore();
  return store.accounts || [];
}

export function getTradeAccountById(id) {
  const store = readTradeStore();
  return store.accounts?.find((a) => a.id === id) || null;
}

export async function upsertTradeAccount(account) {
  return mutateTradeStore((store) => {
    if (!store.accounts) store.accounts = [];
    const idx = store.accounts.findIndex((a) => a.id === account.id);
    const updatedAccount = {
      ...account,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      store.accounts[idx] = { ...store.accounts[idx], ...updatedAccount };
    } else {
      store.accounts.push({
        ...updatedAccount,
        createdAt: updatedAccount.createdAt || new Date().toISOString(),
      });
    }
    return store.accounts.find((a) => a.id === account.id);
  });
}

export async function updateTradeAccountStatus(accountId, status, notes = '', reviewer = 'Admin') {
  return mutateTradeStore((store) => {
    const acc = store.accounts?.find((a) => a.id === accountId);
    if (!acc) return null;

    acc.status = status;
    acc.updatedAt = new Date().toISOString();

    if (!store.auditLog) store.auditLog = [];
    store.auditLog.push({
      type: 'ACCOUNT_STATUS_CHANGE',
      accountId,
      accountName: acc.tradingName,
      newStatus: status,
      notes,
      actor: reviewer,
      timestamp: new Date().toISOString(),
    });

    return acc;
  });
}

// ----------------- USERS & AUTH -----------------

export function getTradeUsers() {
  const store = readTradeStore();
  return store.users || [];
}

export function findTradeUserByIdentifier(identifier) {
  if (!identifier) return null;
  const store = readTradeStore();
  const clean = String(identifier).trim().toLowerCase();
  return store.users?.find((u) => u.email?.toLowerCase() === clean || u.phone?.replace(/\D/g, '') === clean.replace(/\D/g, '') || u.id === identifier) || null;
}

export function getTradeUserWithAccount(userIdOrPhone) {
  const user = findTradeUserByIdentifier(userIdOrPhone);
  if (!user) return null;
  const account = getTradeAccountById(user.accountId);
  return { user, account };
}

// ----------------- PRK COSTS & IMPORTER -----------------

export function getPrkCosts() {
  const store = readTradeStore();
  return store.prkCosts || {};
}

export function importPrkCostsCsv(csvContent, isDryRun = true, user = 'Admin') {
  const store = readTradeStore();
  const currentCosts = { ...(store.prkCosts || {}) };
  const bands = store.config?.priceBands?.spirits?.bands || DEFAULT_PRICE_BANDS.spirits.bands;

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const diffs = [];
  const updatedCosts = { ...currentCosts };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && (line.toLowerCase().includes('sku') || line.toLowerCase().includes('cost'))) {
      continue;
    }

    const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 2) continue;

    const sku = parts[0];
    const newCost = parseFloat(parts[1]);
    if (!sku || isNaN(newCost) || newCost <= 0) continue;

    const oldCost = currentCosts[sku] || 0;
    const costDelta = roundCent(newCost - oldCost);
    const costDeltaPercent = oldCost > 0 ? roundCent(((newCost - oldCost) / oldCost) * 100) : 100;

    const oldT1 = oldCost > 0 ? roundKes(oldCost * (1 + (bands[0]?.markup_on_prk_incvat || 0.10))) : 0;
    const oldT2 = oldCost > 0 ? roundKes(oldCost * (1 + (bands[1]?.markup_on_prk_incvat || 0.07))) : 0;
    const oldT3 = oldCost > 0 ? roundKes(oldCost * (1 + (bands[2]?.markup_on_prk_incvat || 0.04))) : 0;

    const newT1 = roundKes(newCost * (1 + (bands[0]?.markup_on_prk_incvat || 0.10)));
    const newT2 = roundKes(newCost * (1 + (bands[1]?.markup_on_prk_incvat || 0.07)));
    const newT3 = roundKes(newCost * (1 + (bands[2]?.markup_on_prk_incvat || 0.04)));

    diffs.push({
      sku,
      oldCost,
      newCost,
      costDelta,
      costDeltaPercent,
      oldTierPrices: { T1: oldT1, T2: oldT2, T3: oldT3 },
      newTierPrices: { T1: newT1, T2: newT2, T3: newT3 },
      deltaTierPrices: { T1: newT1 - oldT1, T2: newT2 - oldT2, T3: newT3 - oldT3 },
    });

    updatedCosts[sku] = newCost;
  }

  if (!isDryRun && diffs.length > 0) {
    store.prkCosts = updatedCosts;
    store.lastCostImport = {
      importedAt: new Date().toISOString(),
      importedBy: user,
      itemCount: diffs.length,
    };
    if (!store.auditLog) store.auditLog = [];
    store.auditLog.push({
      type: 'PRK_COST_IMPORT',
      itemCount: diffs.length,
      actor: user,
      timestamp: new Date().toISOString(),
    });
    writeTradeStore(store);
  }

  return {
    isDryRun,
    totalParsed: diffs.length,
    diffs,
    applied: !isDryRun,
  };
}

// ----------------- ORDERS & INVOICES -----------------

export function getTradeOrders(filters = {}) {
  const store = readTradeStore();
  let orders = store.orders || [];

  if (filters.accountId) {
    orders = orders.filter((o) => o.accountId === filters.accountId);
  }
  if (filters.status) {
    orders = orders.filter((o) => o.status === filters.status);
  }
  if (filters.paymentStatus) {
    orders = orders.filter((o) => o.paymentStatus === filters.paymentStatus);
  }

  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getTradeOrderById(id) {
  const store = readTradeStore();
  return store.orders?.find((o) => o.id === id || o.orderNumber === id || o.invoiceNumber === id) || null;
}

export function generateSequentialInvoiceNumber() {
  const store = readTradeStore();
  store.invoiceSequence = (store.invoiceSequence || 1000) + 1;
  writeTradeStore(store);
  return `HH-INV-2026-${store.invoiceSequence}`;
}

/**
 * Create a trade order.
 *
 * Async and lock-guarded: the credit check and the `creditUsed` increment must
 * happen in one uninterrupted read-modify-write, or two concurrent orders can
 * each pass a check the account can only afford once.
 *
 * `items` must already have been resolved through
 * lib/trade/trade-catalog.js — costs and price lines are never taken from the
 * client, because the tier price is derived from the cost.
 */
export function createTradeOrder({
  account,
  user,
  items,
  deliveryAddress,
  deliveryDate,
  poReference = '',
  notes = '',
  paymentMethod = 'mpesa_paybill',
  source = 'portal',
}) {
  return mutateTradeStore((store) => {
    // Re-read the account inside the lock: `account` was captured before the
    // queue, and an earlier order may have moved the credit balance since.
    const accIndex = store.accounts.findIndex((a) => a.id === account.id);
    const liveAccount = accIndex >= 0 ? store.accounts[accIndex] : account;

    if (liveAccount.status === 'suspended') {
      throw new Error('Trade account is currently suspended. Please contact your account manager.');
    }

    const pricing = calculateTradeOrderPricing({
      items,
      tierOverride: liveAccount.tierOverride || null,
      isNairobi: deliveryAddress?.city?.toLowerCase()?.includes('nairobi') ?? true,
      city: deliveryAddress?.city || 'Nairobi',
      customBands: store.config?.priceBands || DEFAULT_PRICE_BANDS,
      referralCredit: liveAccount.referralCredit || 0,
    });

    if (!pricing.minOrderCheck.passed) {
      throw new Error(pricing.minOrderCheck.message);
    }

    // Licence gating is applied in trade-catalog.js against the server-derived
    // price line; repeated here as a backstop in case an order is constructed
    // by another path.
    const hasSpirits = pricing.items.some((i) => i.priceLine === 'spirits');
    if (hasSpirits) {
      if (!liveAccount.licenceNo) {
        throw new Error('Liquor licence required to order spirits lines. Please provide licence in account settings.');
      }
      if (liveAccount.licenceExpiry && new Date(liveAccount.licenceExpiry) < new Date()) {
        throw new Error('Liquor licence has expired. Spirits ordering is restricted.');
      }
    }

    let initialStatus = 'confirmed';
    if (liveAccount.orderCeiling && user.seatType === 'buyer' && pricing.grandTotal > liveAccount.orderCeiling) {
      initialStatus = 'awaiting_approval';
    }

    let paymentTerms = 'cash';
    const paymentStatus = 'unpaid';
    if (paymentMethod === 'pay_on_account') {
      if (!liveAccount.creditEnabled) {
        throw new Error('Credit terms are not enabled for this account.');
      }
      const currentUsed = liveAccount.creditUsed || 0;
      const limit = liveAccount.creditLimit || 0;
      if (currentUsed + pricing.grandTotal > limit) {
        const shortfall = (currentUsed + pricing.grandTotal) - limit;
        throw new Error(`Credit limit exceeded by KES ${shortfall.toLocaleString()}. Please reduce order value or pay shortfall.`);
      }
      paymentTerms = `credit_${liveAccount.creditTerms || 14}`;
    }

    const invoiceNumber = generateSequentialInvoiceNumber();
    const orderId = `ord_tr_${Date.now()}`;
    const orderNumber = `HH-TR-${store.invoiceSequence}`;

    const dueDate = paymentTerms.startsWith('credit')
      ? new Date(Date.now() + (liveAccount.creditTerms || 14) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const orderRecord = {
      id: orderId,
      orderNumber,
      invoiceNumber,
      accountId: liveAccount.id,
      accountName: liveAccount.tradingName,
      segment: liveAccount.segment,
      orderedBy: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        seatType: user.seatType,
      },
      status: initialStatus,
      paymentTerms,
      paymentMethod,
      paymentStatus,
      dueDate,
      poReference,
      notes,
      source,
      deliveryDate: deliveryDate || new Date().toISOString().split('T')[0],
      deliveryAddress,
      items: pricing.items,
      totalBottles: pricing.totalBottles,
      subtotalExVat: pricing.subtotalExVat,
      vatTotal: pricing.vatTotal,
      subtotalIncVat: pricing.subtotalIncVat,
      deliveryFee: pricing.deliveryFee,
      referralCredit: pricing.referralCredit,
      grandTotal: pricing.grandTotal,
      economics: pricing.economics,
      footing: pricing.footing,
      createdAt: new Date().toISOString(),
    };

    if (!store.orders) store.orders = [];
    store.orders.unshift(orderRecord);

    if (accIndex >= 0) {
      if (paymentMethod === 'pay_on_account') {
        store.accounts[accIndex].creditUsed = roundCent((store.accounts[accIndex].creditUsed || 0) + pricing.grandTotal);
      }
      if (pricing.referralCredit > 0) {
        store.accounts[accIndex].referralCredit = Math.max(0, (store.accounts[accIndex].referralCredit || 0) - pricing.referralCredit);
      }
    }

    return orderRecord;
  });
}

export async function updateTradeOrderStatus(orderId, newStatus, meta = {}) {
  return mutateTradeStore((store) => {
    const order = store.orders?.find((o) => o.id === orderId);
    if (!order) return null;

    order.status = newStatus;
    if (meta.driverInfo) order.driverInfo = meta.driverInfo;
    if (meta.approvedBy) {
      order.approvedBy = meta.approvedBy;
      order.approvedAt = new Date().toISOString();
    }
    order.updatedAt = new Date().toISOString();

    if (newStatus === 'delivered' && order.paymentStatus === 'paid') {
      const acc = store.accounts?.find((a) => a.id === order.accountId);
      if (acc) {
        acc.cleanOrders = (acc.cleanOrders || 0) + 1;
        if (acc.cleanOrders >= 3 && !acc.creditEnabled) {
          acc.creditSuggested = true;
        }
      }
    }

    return order;
  });
}

// ----------------- QUOTES -----------------

export function getTradeQuotes(filters = {}) {
  const store = readTradeStore();
  let quotes = store.quotes || [];
  if (filters.accountId) {
    quotes = quotes.filter((q) => q.accountId === filters.accountId);
  }
  return quotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createTradeQuote(quoteData) {
  const store = readTradeStore();
  store.quoteSequence = (store.quoteSequence || 100) + 1;
  const quoteNumber = `HH-Q-2026-${store.quoteSequence}`;
  const id = `quote_${store.quoteSequence}`;

  const pricing = calculateTradeOrderPricing({
    items: quoteData.items || [],
    tierOverride: quoteData.tierOverride || null,
    isNairobi: true,
    customBands: store.config?.priceBands || DEFAULT_PRICE_BANDS,
  });

  const quoteRecord = {
    id,
    quoteNumber,
    accountId: quoteData.accountId,
    accountName: quoteData.accountName,
    status: 'sent',
    validUntil: quoteData.validUntil || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: quoteData.notes || '',
    items: pricing.items,
    totalBottles: pricing.totalBottles,
    subtotalExVat: pricing.subtotalExVat,
    vatTotal: pricing.vatTotal,
    deliveryFee: pricing.deliveryFee,
    grandTotal: pricing.grandTotal,
    createdAt: new Date().toISOString(),
  };

  if (!store.quotes) store.quotes = [];
  store.quotes.unshift(quoteRecord);
  writeTradeStore(store);
  return quoteRecord;
}

/**
 * Convert an accepted quote into an order.
 *
 * Async because `createTradeOrder` takes the store lock. The quote is marked
 * accepted in a *separate* locked mutation afterwards — reading the store
 * first and writing it back at the end would overwrite the order that
 * createTradeOrder had just committed.
 */
export async function acceptTradeQuote(quoteId, user) {
  const snapshot = readTradeStore();
  const quote = snapshot.quotes?.find((q) => q.id === quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'accepted') throw new Error('Quote already accepted');

  const account = getTradeAccountById(quote.accountId);
  if (!account) throw new Error('Associated account not found');

  const order = await createTradeOrder({
    account,
    user,
    items: quote.items,
    deliveryAddress: account.addresses?.[0] || {},
    poReference: `QUOTE-${quote.quoteNumber}`,
    notes: `Converted from quote ${quote.quoteNumber}. ${quote.notes}`,
    paymentMethod: account.creditEnabled ? 'pay_on_account' : 'mpesa_paybill',
    source: 'rep',
  });

  await mutateTradeStore((store) => {
    const live = store.quotes?.find((q) => q.id === quoteId);
    if (!live) return;
    // Re-check inside the lock: two concurrent accepts would otherwise both
    // create an order.
    if (live.status === 'accepted' && live.orderId && live.orderId !== order.id) return;
    live.status = 'accepted';
    live.acceptedAt = new Date().toISOString();
    live.orderId = order.id;
  });

  return order;
}

// ----------------- TEMPLATES & SAVED LISTS -----------------

export function getSegmentTemplates() {
  const store = readTradeStore();
  return store.templates || [];
}

// ----------------- STATEMENTS & AGING -----------------

export function getAccountStatement(accountId) {
  const store = readTradeStore();
  const account = store.accounts?.find((a) => a.id === accountId);
  if (!account) return null;

  const orders = store.orders?.filter((o) => o.accountId === accountId) || [];
  const now = new Date();

  let openingBalance = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;

  const aging = {
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days60Plus: 0,
  };

  const invoiceRows = orders.map((o) => {
    totalInvoiced += o.grandTotal;
    const isPaid = o.paymentStatus === 'paid';
    if (isPaid) totalPaid += o.grandTotal;

    const orderDate = new Date(o.createdAt);
    const dueDate = new Date(o.dueDate);
    const ageDays = Math.max(0, Math.floor((now - orderDate) / (1000 * 60 * 60 * 24)));
    const isOverdue = !isPaid && now > dueDate;

    if (!isPaid) {
      if (ageDays <= 14) {
        aging.current += o.grandTotal;
      } else if (ageDays <= 30) {
        aging.days1_30 += o.grandTotal;
      } else if (ageDays <= 60) {
        aging.days31_60 += o.grandTotal;
      } else {
        aging.days60Plus += o.grandTotal;
      }
    }

    return {
      date: o.createdAt.split('T')[0],
      invoiceNumber: o.invoiceNumber,
      orderNumber: o.orderNumber,
      poReference: o.poReference,
      totalAmount: o.grandTotal,
      paidAmount: isPaid ? o.grandTotal : 0,
      balanceDue: isPaid ? 0 : o.grandTotal,
      status: o.paymentStatus,
      dueDate: o.dueDate,
      isOverdue,
    };
  });

  const closingBalance = totalInvoiced - totalPaid;
  const isCreditHold = aging.days31_60 > 0 || aging.days60Plus > 0;

  return {
    account,
    statementDate: now.toISOString().split('T')[0],
    openingBalance: roundCent(openingBalance),
    totalInvoiced: roundCent(totalInvoiced),
    totalPaid: roundCent(totalPaid),
    closingBalance: roundCent(closingBalance),
    creditLimit: account.creditLimit || 0,
    creditAvailable: Math.max(0, (account.creditLimit || 0) - closingBalance),
    isCreditHold,
    aging: {
      current: roundCent(aging.current),
      days1_30: roundCent(aging.days1_30),
      days31_60: roundCent(aging.days31_60),
      days60Plus: roundCent(aging.days60Plus),
    },
    invoices: invoiceRows,
  };
}

// ----------------- MARGIN & ECONOMICS REPORT -----------------

export function getTradeMarginReport(filters = {}) {
  const store = readTradeStore();
  let orders = store.orders || [];

  if (filters.accountId) {
    orders = orders.filter((o) => o.accountId === filters.accountId);
  }
  if (filters.segment) {
    orders = orders.filter((o) => o.segment === filters.segment);
  }

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  const orderReports = [];
  const flaggedOrders = [];

  for (const o of orders) {
    const revenue = o.subtotalIncVat || o.grandTotal || 0;
    const cost = o.economics?.prkCostTotal || 0;
    const profit = o.economics?.grossProfit || (revenue - cost);
    const gmPercent = revenue > 0 ? roundCent((profit / revenue) * 100) : 0;

    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;

    const rep = {
      orderId: o.id,
      orderNumber: o.orderNumber,
      invoiceNumber: o.invoiceNumber,
      accountName: o.accountName,
      segment: o.segment,
      date: o.createdAt.split('T')[0],
      revenue: roundCent(revenue),
      cost: roundCent(cost),
      grossProfit: roundCent(profit),
      grossMarginPercent: gmPercent,
      isSubMarginFloor: gmPercent < (store.config?.gmFloorPercent || 4.0),
    };

    orderReports.push(rep);
    if (rep.isSubMarginFloor) {
      flaggedOrders.push(rep);
    }
  }

  const overallGmPercent = totalRevenue > 0 ? roundCent((totalProfit / totalRevenue) * 100) : 0;

  return {
    totalRevenue: roundCent(totalRevenue),
    totalCost: roundCent(totalCost),
    totalGrossProfit: roundCent(totalProfit),
    overallGrossMarginPercent: overallGmPercent,
    orderCount: orders.length,
    gmFloorPercent: store.config?.gmFloorPercent || 4.0,
    orders: orderReports,
    flaggedOrders,
  };
}

export default {
  readTradeStore,
  writeTradeStore,
  getTradeAccounts,
  getTradeAccountById,
  upsertTradeAccount,
  updateTradeAccountStatus,
  getTradeUsers,
  findTradeUserByIdentifier,
  getTradeUserWithAccount,
  getPrkCosts,
  importPrkCostsCsv,
  getTradeOrders,
  getTradeOrderById,
  generateSequentialInvoiceNumber,
  createTradeOrder,
  updateTradeOrderStatus,
  getTradeQuotes,
  createTradeQuote,
  acceptTradeQuote,
  getSegmentTemplates,
  getAccountStatement,
  getTradeMarginReport,
};


// ----------------- TRADE SEAT CREDENTIALS -----------------

/**
 * Store a password hash against a trade seat.
 *
 * The hash is produced by lib/trade/trade-password.js; this function never
 * sees a plaintext password. `mustChangePassword` marks temporary credentials
 * issued during onboarding.
 */
export function setTradeUserPasswordHash(userId, passwordHash, { mustChange = false } = {}) {
  return mutateTradeStore((store) => {
    const index = store.users?.findIndex((u) => u.id === userId);
    if (index === undefined || index < 0) {
      throw new Error('Trade user not found');
    }

    store.users[index] = {
      ...store.users[index],
      passwordHash,
      mustChangePassword: mustChange,
      passwordUpdatedAt: new Date().toISOString(),
    };

    return store.users[index];
  });
}

/**
 * Record the outcome of a sign-in attempt for a seat.
 * Used to lock a seat after repeated failures, independent of source IP.
 */
export function recordTradeLoginAttempt(userId, success) {
  return mutateTradeStore((store) => {
    const index = store.users?.findIndex((u) => u.id === userId);
    if (index === undefined || index < 0) return null;

    const user = store.users[index];

    store.users[index] = success
      ? { ...user, failedLogins: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() }
      : (() => {
          const failedLogins = (user.failedLogins || 0) + 1;
          // Five strikes, then a 15-minute cool-off on the seat itself.
          const lockedUntil = failedLogins >= 5
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : user.lockedUntil || null;
          return { ...user, failedLogins, lockedUntil };
        })();

    return store.users[index];
  });
}

/** Whether a seat is inside a failed-login lockout window. */
export function isTradeUserLocked(user) {
  if (!user?.lockedUntil) return false;
  return new Date(user.lockedUntil) > new Date();
}

/** Strip credential fields before a user object goes anywhere near a response. */
export function toPublicTradeUser(user) {
  if (!user) return null;
  const {
    passwordHash,
    failedLogins,
    lockedUntil,
    passwordUpdatedAt,
    ...safe
  } = user;
  return safe;
}

/** Merge partial config under the store lock. */
export async function updateTradeConfig(patch) {
  return mutateTradeStore((store) => {
    store.config = { ...store.config, ...patch };
    return store.config;
  });
}

/** Add a seat to an account under the store lock. */
export async function addTradeUser(user) {
  return mutateTradeStore((store) => {
    if (!store.users) store.users = [];
    store.users.push(user);
    return user;
  });
}

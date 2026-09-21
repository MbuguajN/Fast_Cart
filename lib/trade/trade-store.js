import fs from 'fs';
import path from 'path';
import { writeJsonAtomic, mutateJson } from '../atomic-json.js';
import { mirrorImageLocally } from '../uploads.js';
import { query, withTransaction, ensureTradeDb } from './trade-pg.js';
import {
  DEFAULT_PRICE_BANDS,
  calculateTradeOrderPricing,
  evaluateMinimumOrderRule,
  assertInvoiceFooting,
  roundCent,
  roundKes,
} from './pricing-engine.js';

const TRADE_STORE_PATH = path.join(process.cwd(), 'data', 'trade-store.json');

export const DEFAULT_DEMO_TRADE_PASSWORD = 'HappyHour2026!';
export const DEFAULT_DEMO_TRADE_PASSWORD_HASH =
  'scrypt$16384$8$1$i3WJlYRbP/3A0VDkB0L6Bg==$qVZCbB+YMhmmYU7JZyzJfX20O+Jalvrx2WiwmrY/Gjg/i52/QGn5wGkA5Fs81xtHrv1x+xQ0Xml34Scn1fhthQ==';

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
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_serena_buyer',
      accountId: 'acc_serena_01',
      name: 'David Kimani',
      role: 'Beverage Manager',
      seatType: 'buyer',
      email: 'david.kimani@serenahotels.com',
      phone: '+254722111222',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_serena_viewer',
      accountId: 'acc_serena_01',
      name: 'Grace Wanjiku',
      role: 'Internal Auditor',
      seatType: 'viewer',
      email: 'grace.wanjiku@serenahotels.com',
      phone: '+254733112233',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_sankara_owner',
      accountId: 'acc_sankara_vip',
      name: 'Kelvin Mwangi',
      role: 'Director of Procurement',
      seatType: 'owner',
      email: 'kelvin.mwangi@sankaranairobi.com',
      phone: '+254711889900',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_capital_owner',
      accountId: 'acc_capital_club',
      name: 'Michael Ndungu',
      role: 'Director of Food & Beverage',
      seatType: 'owner',
      email: 'michael.ndungu@capitalclubea.com',
      phone: '+254722556677',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_artcaffe_buyer',
      accountId: 'acc_artcaffe_grand',
      name: 'Sarah Njoroge',
      role: 'Central Beverage Manager',
      seatType: 'buyer',
      email: 'sarah.njoroge@artcaffe.co.ke',
      phone: '+254711334455',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_westlands_buyer',
      accountId: 'acc_westlands_lounge',
      name: 'Eric Omondi',
      role: 'Bar Manager',
      seatType: 'owner',
      email: 'eric@alchemist.co.ke',
      phone: '+254701234999',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
    },
    {
      id: 'usr_acme_buyer',
      accountId: 'acc_acme_corp',
      name: 'Faith Chebet',
      role: 'Office Operations',
      seatType: 'owner',
      email: 'faith.chebet@acmeadvisory.co.ke',
      phone: '+254733444555',
      passwordHash: DEFAULT_DEMO_TRADE_PASSWORD_HASH,
      mustChangePassword: false,
      failedLogins: 0,
      lockedUntil: null,
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

const DEFAULT_ACCOUNT_MANAGER = {
  id: 'am_paulette',
  name: 'Paulette Chege',
  email: 'paulette@myhappyhour.co.ke',
  phone: '+254711234567',
  role: 'Key Account Director',
};

const KRA_PIN_REGEX = /^[A-Z]\d{9}[A-Z]$/i;

/**
 * Build a new trade account record from application or admin-entry data.
 * Pure (no store I/O) so both the public apply flow and the admin
 * manual-creation endpoint construct accounts the same way. Throws on an
 * invalid KRA PIN rather than returning a soft error, since both call sites
 * are already in a try/catch.
 */
export function buildTradeAccount(data, { status = 'pending' } = {}) {
  if (!data.tradingName) throw new Error('tradingName is required');

  if (data.kraPin && !KRA_PIN_REGEX.test(data.kraPin.trim())) {
    throw new Error('Invalid KRA PIN format. Expected format like P051123456Z');
  }

  const id = data.id || `acc_${Date.now()}`;
  const addressId = `addr_${Date.now()}`;

  const addresses = data.addresses || [
    {
      id: addressId,
      label: data.addressLabel || 'Primary Receiving Dock',
      contactName: data.contactName || '',
      phone: data.phone || '',
      addressLine: data.deliveryAddress || 'Nairobi',
      city: data.city || 'Nairobi',
      deliveryWindow: data.deliveryWindow || '09:00 - 17:00 EAT',
      isDefault: true,
    },
  ];

  return {
    id,
    tradingName: data.tradingName.trim(),
    legalName: data.legalName ? data.legalName.trim() : data.tradingName.trim(),
    segment: data.segment || 'horeca',
    status,
    kraPin: data.kraPin ? data.kraPin.toUpperCase().trim() : '',
    licenceNo: data.licenceNo ? data.licenceNo.trim() : '',
    licenceExpiry: data.licenceExpiry || null,
    licenceDocUrl: data.licenceDocUrl || null,
    priceBook: data.priceBook || 'standard',
    tierOverride: data.tierOverride || null,
    creditEnabled: data.creditEnabled ?? false,
    creditLimit: data.creditLimit ?? 0,
    creditTerms: data.creditTerms ?? 14,
    creditUsed: 0,
    cleanOrders: 0,
    orderCeiling: data.orderCeiling ?? null,
    accountManager: data.accountManager || DEFAULT_ACCOUNT_MANAGER,
    addresses,
    defaultAddressId: addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || null,
    points: 0,
    referralCredit: 0,
    termsAccepted: data.skipTerms
      ? null
      : {
          version: '2026.1-B2B',
          acceptedAt: new Date().toISOString(),
        },
    createdAt: new Date().toISOString(),
  };
}

export function getTradeAccounts() {
  const store = readTradeStore();
  return store.accounts || [];
}

/** Maps a Postgres trade_accounts row back to the camelCase shape every caller already expects from the JSON store. */
function pgAccountRowToRecord(r) {
  return {
    id: r.id,
    tradingName: r.trading_name,
    legalName: r.legal_name,
    segment: r.segment,
    status: r.status,
    kraPin: r.kra_pin,
    licenceNo: r.licence_no,
    licenceDocUrl: r.licence_doc_url,
    licenceExpiry: r.licence_expiry,
    priceBook: r.price_book,
    tierOverride: r.tier_override,
    creditEnabled: Boolean(r.credit_enabled),
    creditLimit: Number(r.credit_limit),
    creditTerms: r.credit_terms,
    creditUsed: Number(r.credit_used),
    cleanOrders: r.clean_orders,
    orderCeiling: r.order_ceiling !== null ? Number(r.order_ceiling) : null,
    points: r.points,
    referralCredit: Number(r.referral_credit),
    accountManager: r.account_manager || null,
    addresses: r.addresses || [],
    defaultAddressId: r.default_address_id,
    termsAccepted: r.terms_accepted || null,
    isGuest: Boolean(r.is_guest),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Postgres-first account lookup — this and findTradeUserByIdentifier below
 * are the actual hot path for every authenticated trade request (see
 * trade-auth.js's getTradeAuthFromRequest, which re-checks on every
 * request by design). Previously this read+parsed the whole JSON store on
 * every call; every account write now syncs to Postgres (see
 * syncTradeAccountToPg), so Postgres is the fast, indexed, authoritative
 * read. Falls back to the JSON store only on a Postgres error (e.g. the DB
 * being briefly unreachable) — a genuine "not found" in Postgres is not
 * masked by falling back, since post-migration that would just hide bugs.
 */
export async function getTradeAccountById(id) {
  if (!id) return null;
  try {
    await ensureTradeDb();
    const res = await query('SELECT * FROM trade_accounts WHERE id = $1', [id]);
    if (res.rows.length > 0) return pgAccountRowToRecord(res.rows[0]);
    return null;
  } catch (err) {
    console.error('getTradeAccountById: Postgres lookup failed, falling back to JSON store:', err.message);
    const store = readTradeStore();
    return store.accounts?.find((a) => a.id === id) || null;
  }
}

/**
 * Writes an account through to Postgres `trade_accounts` — the table auth
 * (createTradeOrder's row lock, and the read path in
 * getTradeAccountByIdFast/findTradeUserByIdentifierFast below) actually
 * relies on. This used to be seeded once and then silently left to drift
 * from the JSON store on every subsequent write; every account/user mutator
 * now calls this (or syncTradeUserToPg) so Postgres is never stale.
 *
 * Deliberately not caught here — a failed sync should fail the whole
 * mutateTradeStore() call (see its comment on why throwing before the JSON
 * write keeps both stores from disagreeing) rather than degrade back into
 * "JSON has it, Postgres doesn't" for a brand new account.
 */
export async function syncTradeAccountToPg(account) {
  await ensureTradeDb();
  await query(
    `INSERT INTO trade_accounts (
      id, trading_name, legal_name, segment, status, kra_pin, licence_no,
      licence_doc_url, licence_expiry, price_book, tier_override,
      credit_enabled, credit_limit, credit_terms, credit_used, clean_orders,
      order_ceiling, points, referral_credit, account_manager, addresses,
      default_address_id, terms_accepted, is_guest, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW())
    ON CONFLICT (id) DO UPDATE SET
      trading_name = $2, legal_name = $3, segment = $4, status = $5,
      kra_pin = $6, licence_no = $7, licence_doc_url = $8, licence_expiry = $9,
      price_book = $10, tier_override = $11, credit_enabled = $12,
      credit_limit = $13, credit_terms = $14, credit_used = $15,
      clean_orders = $16, order_ceiling = $17, points = $18,
      referral_credit = $19, account_manager = $20, addresses = $21,
      default_address_id = $22, terms_accepted = $23, is_guest = $24,
      updated_at = NOW()`,
    [
      account.id,
      account.tradingName,
      account.legalName || account.tradingName,
      account.segment || 'horeca',
      account.status || 'pending',
      account.kraPin || null,
      account.licenceNo || null,
      account.licenceDocUrl || null,
      account.licenceExpiry || null,
      account.priceBook || 'standard',
      account.tierOverride || null,
      Boolean(account.creditEnabled),
      account.creditLimit ?? 0,
      account.creditTerms ?? 14,
      account.creditUsed ?? 0,
      account.cleanOrders ?? 0,
      account.orderCeiling ?? null,
      account.points ?? 0,
      account.referralCredit ?? 0,
      account.accountManager ? JSON.stringify(account.accountManager) : null,
      JSON.stringify(account.addresses || []),
      account.defaultAddressId || null,
      account.termsAccepted ? JSON.stringify(account.termsAccepted) : null,
      Boolean(account.isGuest),
      account.createdAt || new Date().toISOString(),
    ]
  );
}

/** Same reasoning as syncTradeAccountToPg, for trade_users. */
export async function syncTradeUserToPg(user) {
  await ensureTradeDb();
  await query(
    `INSERT INTO trade_users (
      id, account_id, name, email, phone, role, seat_type, password_hash,
      must_change_password, failed_attempts, locked_until, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET
      account_id = $2, name = $3, email = $4, phone = $5, role = $6,
      seat_type = $7,
      password_hash = COALESCE($8, trade_users.password_hash),
      must_change_password = COALESCE($9, trade_users.must_change_password),
      failed_attempts = COALESCE($10, trade_users.failed_attempts),
      locked_until = $11`,
    [
      user.id,
      user.accountId,
      user.name,
      (user.email || '').toLowerCase().trim(),
      user.phone || null,
      user.role || 'Business Owner',
      user.seatType || 'owner',
      user.passwordHash || null,
      user.mustChangePassword ?? null,
      user.failedLogins ?? null,
      user.lockedUntil || null,
      user.createdAt || new Date().toISOString(),
    ]
  );
}

export async function upsertTradeAccount(account) {
  return mutateTradeStore(async (store) => {
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
    const saved = store.accounts.find((a) => a.id === account.id);
    await syncTradeAccountToPg(saved);
    return saved;
  });
}

export async function updateTradeAccountStatus(accountId, status, notes = '', reviewer = 'Admin') {
  return mutateTradeStore(async (store) => {
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

    await ensureTradeDb();
    await query('UPDATE trade_accounts SET status = $1, updated_at = NOW() WHERE id = $2', [status, accountId]);

    return acc;
  });
}

// ----------------- USERS & AUTH -----------------

export function getTradeUsers() {
  const store = readTradeStore();
  return store.users || [];
}

/** Maps a Postgres trade_users row back to the camelCase shape every caller already expects from the JSON store. */
function pgUserRowToRecord(r) {
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    seatType: r.seat_type,
    passwordHash: r.password_hash,
    mustChangePassword: Boolean(r.must_change_password),
    failedLogins: r.failed_attempts,
    lockedUntil: r.locked_until,
    createdAt: r.created_at,
  };
}

function findTradeUserInJsonStore(identifier) {
  const store = readTradeStore();
  const clean = String(identifier).trim().toLowerCase();
  return store.users?.find(
    (u) =>
      u.email?.toLowerCase() === clean ||
      u.phone?.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
      u.id?.toLowerCase() === clean ||
      u.id === identifier
  ) || null;
}

/** Postgres-first — see getTradeAccountById's comment; same hot-path reasoning applies here. */
export async function findTradeUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim().toLowerCase();
  const digits = clean.replace(/\D/g, '');
  try {
    await ensureTradeDb();
    const res = await query(
      `SELECT * FROM trade_users
       WHERE LOWER(email) = $1
          OR ($2 <> '' AND regexp_replace(phone, '\\D', '', 'g') = $2)
          OR LOWER(id) = $1
          OR id = $3
       LIMIT 1`,
      [clean, digits, identifier]
    );
    if (res.rows.length > 0) return pgUserRowToRecord(res.rows[0]);
    return null;
  } catch (err) {
    console.error('findTradeUserByIdentifier: Postgres lookup failed, falling back to JSON store:', err.message);
    return findTradeUserInJsonStore(identifier);
  }
}

export async function getTradeUserWithAccount(userIdOrPhone) {
  const user = await findTradeUserByIdentifier(userIdOrPhone);
  if (!user) return null;
  const account = await getTradeAccountById(user.accountId);
  return { user, account };
}

/**
 * Public checkout has no login step, but every order still needs an account
 * to hang off (invoices, order history, admin reporting all assume one, and
 * `trade_orders.account_id` is a foreign key into Postgres `trade_accounts`).
 *
 * Security: an unauthenticated caller must never be able to attach an order
 * to someone else's account by supplying their email or phone — that would
 * leak that account's trading name back in the response and, for a real
 * vetted account, inherit its tierOverride/credit fields. So reuse is
 * restricted to accounts this same function created (`isGuest: true`), and
 * only on an EXACT match of both email AND phone together — a much smaller
 * collision surface than either field alone, and one that can never touch a
 * KYC'd trade or credit account (those are never `isGuest`). Otherwise a
 * fresh, already-`active` account is created — no vetting queue, no
 * password. Full KYC (KRA PIN, licence) stays reserved for `/trade/apply`'s
 * credit-account track.
 *
 * Written to both stores: the JSON trade-store (accounts/users live there —
 * login, admin accounts list, etc. all read it) and Postgres `trade_accounts`
 * (createTradeOrder's FK requires the row to exist there too).
 */
export async function findOrCreateGuestTradeAccount({ name, phone, email, addressLine, city }) {
  const normEmail = (email || '').toLowerCase().trim();
  const normPhone = (phone || '').replace(/\D/g, '');

  const store = readTradeStore();
  const existingUser = (store.users || []).find(
    (u) => u.email?.toLowerCase() === normEmail && u.phone?.replace(/\D/g, '') === normPhone
  );
  if (existingUser) {
    const account = getTradeAccountById(existingUser.accountId);
    if (account?.isGuest) {
      return { user: existingUser, account };
    }
  }

  const account = buildTradeAccount(
    {
      tradingName: name,
      contactName: name,
      phone,
      email,
      deliveryAddress: addressLine,
      city,
    },
    { status: 'active' }
  );
  account.isGuest = true;
  // upsertTradeAccount now writes through to Postgres itself (see
  // syncTradeAccountToPg) — no need for a second, duplicate INSERT here.
  await upsertTradeAccount(account);

  // seatType 'buyer', not 'owner' — canSeeEconomics() (pricing-visibility.js)
  // trusts 'owner'/'admin' seats with landed cost and margin. A public guest
  // checkout must never expose that data, even though it can place orders.
  const user = {
    id: `usr_guest_${Date.now()}`,
    accountId: account.id,
    name,
    role: 'Guest Buyer',
    seatType: 'buyer',
    email: (email || '').toLowerCase().trim(),
    phone: (phone || '').trim(),
  };
  await addTradeUser(user);

  return { user, account };
}

// ----------------- PRK COSTS & IMPORTER -----------------

export function getPrkCosts() {
  const store = readTradeStore();
  return store.prkCosts || {};
}

/** Read the live spirits markup bands, falling back to the shipped defaults. */
export function getSpiritsBands() {
  const store = readTradeStore();
  return store.config?.priceBands?.spirits?.bands || DEFAULT_PRICE_BANDS.spirits.bands;
}

/** T1/T2/T3 wholesale prices for a landed cost, under the given spirits bands. */
export function computeSpiritsTierPrices(cost, bands = getSpiritsBands()) {
  if (!(cost > 0)) return { T1: 0, T2: 0, T3: 0 };
  return {
    T1: roundKes(cost * (1 + (bands[0]?.markup_on_prk_incvat || 0.10))),
    T2: roundKes(cost * (1 + (bands[1]?.markup_on_prk_incvat || 0.07))),
    T3: roundKes(cost * (1 + (bands[2]?.markup_on_prk_incvat || 0.04))),
  };
}


// ----------------- ORDERS & INVOICES (POSTGRESQL + SYNC MIRROR) -----------------

export async function getTradeOrders(filters = {}) {
  try {
    await ensureTradeDb();
    let sql = 'SELECT * FROM trade_orders WHERE 1=1';
    const params = [];

  if (filters.accountId) {
      params.push(filters.accountId);
      sql += ` AND account_id = $${params.length}`;
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      params.push(filters.paymentStatus);
      sql += ` AND payment_status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);

    const orders = [];
    for (const r of res.rows) {
      const itemsRes = await query('SELECT * FROM trade_order_items WHERE order_id = $1', [r.id]);
      orders.push(mapOrderRecord(r, itemsRes.rows));
    }
    return orders;
  } catch (err) {
    console.error('getTradeOrders fallback to JSON:', err.message);
    const store = readTradeStore();
    let orders = store.orders || [];
    if (filters.accountId) orders = orders.filter((o) => o.accountId === filters.accountId);
    if (filters.status && filters.status !== 'all') orders = orders.filter((o) => o.status === filters.status);
    if (filters.paymentStatus && filters.paymentStatus !== 'all') orders = orders.filter((o) => o.paymentStatus === filters.paymentStatus);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

export function getTradeOrdersSync(filters = {}) {
  const store = readTradeStore();
  let orders = store.orders || [];
  if (filters.accountId) orders = orders.filter((o) => o.accountId === filters.accountId);
  if (filters.status && filters.status !== 'all') orders = orders.filter((o) => o.status === filters.status);
  if (filters.paymentStatus && filters.paymentStatus !== 'all') orders = orders.filter((o) => o.paymentStatus === filters.paymentStatus);
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getTradeOrderById(id) {
  try {
    await ensureTradeDb();
    const res = await query(
      'SELECT * FROM trade_orders WHERE id = $1 OR order_number = $1 OR invoice_number = $1',
      [id]
    );
    if (res.rows.length === 0) return getTradeOrderByIdSync(id);

    const r = res.rows[0];
    const itemsRes = await query('SELECT * FROM trade_order_items WHERE order_id = $1', [r.id]);
    return mapOrderRecord(r, itemsRes.rows);
  } catch (err) {
    console.error('getTradeOrderById fallback to JSON:', err.message);
    return getTradeOrderByIdSync(id);
  }
}

export function getTradeOrderByIdSync(id) {
  const store = readTradeStore();
  return store.orders?.find((o) => o.id === id || o.orderNumber === id || o.invoiceNumber === id) || null;
}

export function generateSequentialInvoiceNumberSync() {
  const store = readTradeStore();
  store.invoiceSequence = (store.invoiceSequence || 1000) + 1;
  writeTradeStore(store);
  return `HH-INV-2026-${store.invoiceSequence}`;
}

export async function generateSequentialInvoiceNumber() {
  try {
    await ensureTradeDb();
    const seqRes = await query("SELECT nextval('trade_invoice_seq') as seq");
    return `HH-INV-2026-${seqRes.rows[0].seq}`;
  } catch {
    const store = readTradeStore();
    store.invoiceSequence = (store.invoiceSequence || 1000) + 1;
    writeTradeStore(store);
    return `HH-INV-2026-${store.invoiceSequence}`;
  }
}

function mapOrderRecord(r, itemRows = []) {
  return {
    id: r.id,
    orderNumber: r.order_number,
    invoiceNumber: r.invoice_number,
    accountId: r.account_id,
    accountName: r.account_name,
    segment: r.segment,
    orderedBy: typeof r.ordered_by === 'string' ? JSON.parse(r.ordered_by) : r.ordered_by || {},
    status: r.status,
    paymentTerms: r.payment_terms,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    dueDate: r.due_date ? String(r.due_date).split('T')[0] : null,
    poReference: r.po_reference || '',
    notes: r.notes || '',
    source: r.source || 'portal',
    deliveryDate: r.delivery_date ? String(r.delivery_date).split('T')[0] : null,
    deliveryAddress: typeof r.delivery_address === 'string' ? JSON.parse(r.delivery_address) : r.delivery_address || {},
    deliveryFee: Number(r.delivery_fee) || 0,
    subtotalExVat: Number(r.subtotal_ex_vat) || 0,
    vatTotal: Number(r.vat_total) || 0,
    subtotalIncVat: Number(r.subtotal_inc_vat) || 0,
    referralCredit: Number(r.referral_credit) || 0,
    grandTotal: Number(r.grand_total) || 0,
    totalBottles: Number(r.total_bottles) || 0,
    economics: typeof r.economics === 'string' ? JSON.parse(r.economics) : r.economics || {},
    driverInfo: typeof r.driver_info === 'string' ? JSON.parse(r.driver_info) : r.driver_info || null,
    deliveryNoteNumber: r.delivery_note_number || null,
    sealNumber: r.seal_number || null,
    approvedBy: r.approved_by || null,
    approvedAt: r.approved_at || null,
    items: itemRows.map((it) => ({
      id: it.product_id,
      sku: it.sku,
      name: it.name,
      priceLine: it.price_line,
      tierKey: it.tier_key,
      quantity: Number(it.quantity),
      unitPriceIncVat: Number(it.unit_price_inc_vat),
      unitPriceExVat: Number(it.unit_price_ex_vat),
      lineTotalIncVat: Number(it.line_total_inc_vat),
      lineTotalExVat: Number(it.line_total_ex_vat),
      prkCostSnapshot: Number(it.prk_cost_snapshot),
      marginPercent: Number(it.margin_percent),
    })),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
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
 * Create a trade order with atomic stock verification & deduction in PostgreSQL.
 */
export async function createTradeOrder({
  account,
  user,
  items,
  deliveryAddress,
  deliveryDate,
  poReference = '',
  notes = '',
  paymentMethod = 'mpesa_paybill',
  source = 'portal',
  ageConfirmed = false,
}) {
  await ensureTradeDb();

  return withTransaction(async (client) => {
    // 1. Fetch live account
    const accRes = await client.query('SELECT * FROM trade_accounts WHERE id = $1 FOR UPDATE', [account.id]);
    let liveAccount;
    if (accRes.rows.length > 0) {
      const a = accRes.rows[0];
      liveAccount = {
        id: a.id,
        tradingName: a.trading_name,
        legalName: a.legal_name,
        segment: a.segment,
        status: a.status,
        kraPin: a.kra_pin,
        licenceNo: a.licence_no,
        licenceExpiry: a.licence_expiry,
        tierOverride: a.tier_override,
        creditEnabled: a.credit_enabled,
        creditLimit: Number(a.credit_limit),
        creditTerms: a.credit_terms,
        creditUsed: Number(a.credit_used),
        cleanOrders: a.clean_orders,
        orderCeiling: a.order_ceiling ? Number(a.order_ceiling) : null,
        referralCredit: Number(a.referral_credit),
      };
    } else {
      liveAccount = account;
    }

    if (liveAccount.status === 'suspended') {
      throw new Error('Trade account is currently suspended. Please contact your account manager.');
    }

    if (paymentMethod === 'pay_on_account' && !liveAccount.creditEnabled) {
      throw new Error('Pay-on-account is only available to accounts with approved credit terms.');
    }

    // 2. Pricing
    const { calculateTradeOrderPricingWithOverrides } = await import('./trade-costing.js');
    const pricing = await calculateTradeOrderPricingWithOverrides({
      items,
      tierOverride: liveAccount.tierOverride || null,
      isNairobi: deliveryAddress?.city?.toLowerCase()?.includes('nairobi') ?? true,
      city: deliveryAddress?.city || 'Nairobi',
      customBands: DEFAULT_PRICE_BANDS,
      referralCredit: liveAccount.referralCredit || 0,
    });

    if (!pricing.minOrderCheck.passed) {
      throw new Error(pricing.minOrderCheck.message);
    }

    // Spirits carry no liquor-licence gate — any buyer may order them. Age is
    // confirmed once at checkout (enforced in the checkout route) rather than
    // gated on account documents; a licence is only collected for the
    // credit/partner track.
    const hasSpirits = pricing.items.some((i) => i.priceLine === 'spirits');
    if (hasSpirits && !ageConfirmed) {
      throw new Error('Please confirm you are of legal drinking age to order spirits.');
    }

    // 3. Stock validation & atomic deduction
    for (const item of pricing.items) {
      const prodRes = await client.query(
        'SELECT id, sku, name, stock_quantity FROM trade_products WHERE sku = $1 FOR UPDATE',
        [item.sku]
      );
      if (prodRes.rows.length > 0) {
        const p = prodRes.rows[0];
        const available = parseInt(p.stock_quantity, 10);
        if (available < item.quantity) {
          throw new Error(`Insufficient stock for "${p.name}" (${p.sku}). Requested: ${item.quantity}, Available: ${available}`);
        }
        const newStock = available - item.quantity;
        await client.query(
          'UPDATE trade_products SET stock_quantity = $1, in_stock = ($1 > 0), updated_at = NOW() WHERE id = $2',
          [newStock, p.id]
        );
      }
    }

    // 4. Approval ceiling & credit check
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

    // 5. Sequential IDs
    const seqRes = await client.query("SELECT nextval('trade_invoice_seq') as seq");
    const seq = seqRes.rows[0].seq;
    const invoiceNumber = `HH-INV-2026-${seq}`;
    const orderNumber = `HH-TR-${seq}`;
    const orderId = `ord_tr_${Date.now()}`;

    const dueDate = paymentTerms.startsWith('credit')
      ? new Date(Date.now() + (liveAccount.creditTerms || 14) * 86400000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Insert trade_orders
    await client.query(
      `INSERT INTO trade_orders (
        id, order_number, invoice_number, account_id, account_name, segment, ordered_by,
        status, payment_terms, payment_method, payment_status, due_date, po_reference,
        notes, source, delivery_date, delivery_address, delivery_fee, subtotal_ex_vat,
        vat_total, subtotal_inc_vat, referral_credit, grand_total, total_bottles,
        economics, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW())`,
      [
        orderId, orderNumber, invoiceNumber, liveAccount.id, liveAccount.tradingName,
        liveAccount.segment, JSON.stringify(user), initialStatus, paymentTerms,
        paymentMethod, paymentStatus, dueDate, poReference, notes, source,
        deliveryDate || new Date().toISOString().split('T')[0], JSON.stringify(deliveryAddress),
        pricing.deliveryFee, pricing.subtotalExVat, pricing.vatTotal, pricing.subtotalIncVat,
        pricing.referralCredit, pricing.grandTotal, pricing.totalBottles, JSON.stringify(pricing.economics)
      ]
    );

    // Insert items & inventory logs
    for (const item of pricing.items) {
      await client.query(
        `INSERT INTO trade_order_items (
          order_id, product_id, sku, name, price_line, tier_key, quantity,
          unit_price_inc_vat, unit_price_ex_vat, vat_amount, line_total_inc_vat,
          line_total_ex_vat, prk_cost_snapshot, margin_percent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          orderId, item.id || item.sku, item.sku, item.name, item.priceLine,
          item.tierKey, item.quantity, item.unitPriceIncVat, item.unitPriceExVat,
          item.vatAmountPerUnit * item.quantity, item.lineTotalIncVat,
          item.lineTotalExVat, item.prkCostSnapshot, item.marginPercent
        ]
      );

      const prodRes = await client.query('SELECT id, stock_quantity FROM trade_products WHERE sku = $1', [item.sku]);
      if (prodRes.rows.length > 0) {
        await client.query(
          'INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [prodRes.rows[0].id, item.sku, -item.quantity, prodRes.rows[0].stock_quantity, 'order_placed', orderId]
        );
      }
    }

    // Account credit update
    if (paymentMethod === 'pay_on_account') {
      await client.query(
        'UPDATE trade_accounts SET credit_used = credit_used + $1, updated_at = NOW() WHERE id = $2',
        [pricing.grandTotal, liveAccount.id]
      );
    }
    if (pricing.referralCredit > 0) {
      await client.query(
        'UPDATE trade_accounts SET referral_credit = GREATEST(0, referral_credit - $1), updated_at = NOW() WHERE id = $2',
        [pricing.referralCredit, liveAccount.id]
      );
    }

    const orderRecord = {
      id: orderId,
      orderNumber,
      invoiceNumber,
      accountId: liveAccount.id,
      accountName: liveAccount.tradingName,
      segment: liveAccount.segment,
      orderedBy: user,
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

    // Mirror to JSON store for synchronous readers
    mutateTradeStore((store) => {
      if (!store.orders) store.orders = [];
      store.orders.unshift(orderRecord);
      const aIdx = store.accounts?.findIndex((a) => a.id === liveAccount.id);
      if (aIdx >= 0) {
        if (paymentMethod === 'pay_on_account') {
          store.accounts[aIdx].creditUsed = roundCent((store.accounts[aIdx].creditUsed || 0) + pricing.grandTotal);
        }
        if (pricing.referralCredit > 0) {
          store.accounts[aIdx].referralCredit = Math.max(0, (store.accounts[aIdx].referralCredit || 0) - pricing.referralCredit);
        }
      }
    });

    return orderRecord;
  });
}

/**
 * Update order status, handle cancellations (restock) and dispatch manifests.
 */
export async function updateTradeOrderStatus(orderId, newStatus, meta = {}) {
  await ensureTradeDb();

  return withTransaction(async (client) => {
    const orderRes = await client.query('SELECT * FROM trade_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) return null;
    const orderRow = orderRes.rows[0];
    const prevStatus = orderRow.status;

    // Restore stock if newly cancelled or rejected
    if ((newStatus === 'cancelled' || newStatus === 'rejected') && prevStatus !== 'cancelled' && prevStatus !== 'rejected') {
      const itemsRes = await client.query('SELECT * FROM trade_order_items WHERE order_id = $1', [orderId]);
      for (const item of itemsRes.rows) {
        const prodRes = await client.query(
          'UPDATE trade_products SET stock_quantity = stock_quantity + $1, in_stock = true, updated_at = NOW() WHERE sku = $2 RETURNING id, stock_quantity',
          [item.quantity, item.sku]
        );
        if (prodRes.rows.length > 0) {
          await client.query(
            'INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [prodRes.rows[0].id, item.sku, item.quantity, prodRes.rows[0].stock_quantity, 'order_cancelled', orderId]
          );
        }
      }

      if (orderRow.payment_method === 'pay_on_account') {
        await client.query(
          'UPDATE trade_accounts SET credit_used = GREATEST(0, credit_used - $1), updated_at = NOW() WHERE id = $2',
          [orderRow.grand_total, orderRow.account_id]
        );
      }
    }

    // Build update query
    let queryText = 'UPDATE trade_orders SET status = $1, updated_at = NOW()';
    const params = [newStatus];
    let pIdx = 2;

    if (meta.driverInfo) {
      queryText += `, driver_info = $${pIdx++}`;
      params.push(JSON.stringify(meta.driverInfo));
    }
    if (meta.deliveryNoteNumber) {
      queryText += `, delivery_note_number = $${pIdx++}`;
      params.push(meta.deliveryNoteNumber);
    }
    if (meta.sealNumber) {
      queryText += `, seal_number = $${pIdx++}`;
      params.push(meta.sealNumber);
    }
    if (meta.approvedBy) {
      queryText += `, approved_by = $${pIdx++}, approved_at = NOW()`;
      params.push(meta.approvedBy);
    }

    queryText += ` WHERE id = $${pIdx} RETURNING *`;
    params.push(orderId);

    const updatedRes = await client.query(queryText, params);
    const updatedItemsRes = await client.query('SELECT * FROM trade_order_items WHERE order_id = $1', [orderId]);
    const updatedRecord = mapOrderRecord(updatedRes.rows[0], updatedItemsRes.rows);

    // Mirror to JSON
    mutateTradeStore((store) => {
      const o = store.orders?.find((ord) => ord.id === orderId);
      if (o) {
        o.status = newStatus;
        if (meta.driverInfo) o.driverInfo = meta.driverInfo;
        if (meta.deliveryNoteNumber) o.deliveryNoteNumber = meta.deliveryNoteNumber;
        if (meta.sealNumber) o.sealNumber = meta.sealNumber;
        if (meta.approvedBy) {
          o.approvedBy = meta.approvedBy;
          o.approvedAt = new Date().toISOString();
        }
        o.updatedAt = new Date().toISOString();
      }
      if (newStatus === 'delivered' && updatedRecord.paymentStatus === 'paid') {
        const acc = store.accounts?.find((a) => a.id === updatedRecord.accountId);
        if (acc) {
          acc.cleanOrders = (acc.cleanOrders || 0) + 1;
          if (acc.cleanOrders >= 3 && !acc.creditEnabled) {
            acc.creditSuggested = true;
          }
        }
      }
    });

    return updatedRecord;
  });
}

// ----------------- QUOTES & QUOTE MANAGEMENT -----------------

function mapQuoteRecord(r, itemRows = []) {
  return {
    id: r.id,
    quoteNumber: r.quote_number,
    accountId: r.account_id,
    accountName: r.account_name,
    status: r.status,
    validUntil: r.valid_until ? String(r.valid_until).split('T')[0] : null,
    notes: r.notes || '',
    totalBottles: Number(r.total_bottles) || 0,
    subtotalExVat: Number(r.subtotal_ex_vat) || 0,
    vatTotal: Number(r.vat_total) || 0,
    deliveryFee: Number(r.delivery_fee) || 0,
    grandTotal: Number(r.grand_total) || 0,
    declineReason: r.decline_reason || null,
    orderId: r.order_id || null,
    acceptedAt: r.accepted_at || null,
    items: itemRows.map((it) => {
      const qty = Number(it.quantity) || 1;
      const snapshot = Number(it.prk_cost_snapshot) || 0;
      const unitCost = snapshot > 0 ? snapshot : Number(it.unit_price_inc_vat) * 0.75;
      return {
        id: it.product_id,
        sku: it.sku,
        name: it.name,
        priceLine: it.price_line,
        tierKey: it.tier_key,
        quantity: qty,
        unitPriceIncVat: Number(it.unit_price_inc_vat),
        unitPriceExVat: Number(it.unit_price_ex_vat),
        lineTotalIncVat: Number(it.line_total_inc_vat),
        prkCostSnapshot: snapshot,
        prkCostIncVat: unitCost,
      };
    }),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getTradeQuotes(filters = {}) {
  try {
    await ensureTradeDb();
    let sql = 'SELECT * FROM trade_quotes WHERE 1=1';
    const params = [];

    if (filters.accountId) {
      params.push(filters.accountId);
      sql += ` AND account_id = $${params.length}`;
    }
    if (filters.status && filters.status !== 'all') {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);

    const quotes = [];
    for (const r of res.rows) {
      const itemsRes = await query('SELECT * FROM trade_quote_items WHERE quote_id = $1', [r.id]);
      quotes.push(mapQuoteRecord(r, itemsRes.rows));
    }
    return quotes;
  } catch (err) {
    console.error('getTradeQuotes fallback to JSON:', err.message);
    const store = readTradeStore();
    let quotes = store.quotes || [];
    if (filters.accountId) quotes = quotes.filter((q) => q.accountId === filters.accountId);
    if (filters.status && filters.status !== 'all') quotes = quotes.filter((q) => q.status === filters.status);
    return quotes;
  }
}

export function getTradeQuotesSync(filters = {}) {
  const store = readTradeStore();
  let quotes = store.quotes || [];
  if (filters.accountId) quotes = quotes.filter((q) => q.accountId === filters.accountId);
  if (filters.status && filters.status !== 'all') quotes = quotes.filter((q) => q.status === filters.status);
  return quotes;
}

export async function getTradeQuoteById(id) {
  try {
    await ensureTradeDb();
    const res = await query(
      'SELECT * FROM trade_quotes WHERE id = $1 OR quote_number = $1',
      [id]
    );
    if (res.rows.length === 0) return getTradeQuoteByIdSync(id);

    const r = res.rows[0];
    const itemsRes = await query('SELECT * FROM trade_quote_items WHERE quote_id = $1', [r.id]);
    return mapQuoteRecord(r, itemsRes.rows);
  } catch (err) {
    console.error('getTradeQuoteById fallback to JSON:', err.message);
    return getTradeQuoteByIdSync(id);
  }
}

export function getTradeQuoteByIdSync(id) {
  const store = readTradeStore();
  return store.quotes?.find((q) => q.id === id || q.quoteNumber === id) || null;
}

export async function createTradeQuote(quoteData) {
  await ensureTradeDb();

  return withTransaction(async (client) => {
    const seqRes = await client.query("SELECT nextval('trade_quote_seq') as seq");
    const seq = seqRes.rows[0].seq;
    const quoteNumber = `HH-Q-2026-${seq}`;
    const id = `quote_${seq}`;

    const { calculateTradeOrderPricingWithOverrides } = await import('./trade-costing.js');
    const pricing = await calculateTradeOrderPricingWithOverrides({
      items: quoteData.items || [],
      tierOverride: quoteData.tierOverride || null,
      isNairobi: true,
      customBands: DEFAULT_PRICE_BANDS,
    });

    const validUntil = quoteData.validUntil
      ? quoteData.validUntil.split('T')[0]
      : new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    await client.query(
      `INSERT INTO trade_quotes (
        id, quote_number, account_id, account_name, status, valid_until, notes,
        total_bottles, subtotal_ex_vat, vat_total, delivery_fee, grand_total,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        id, quoteNumber, quoteData.accountId, quoteData.accountName, 'sent',
        validUntil, quoteData.notes || '', pricing.totalBottles, pricing.subtotalExVat,
        pricing.vatTotal, pricing.deliveryFee, pricing.grandTotal
      ]
    );

    for (const item of pricing.items) {
      await client.query(
        `INSERT INTO trade_quote_items (
          quote_id, product_id, sku, name, price_line, tier_key, quantity,
          unit_price_inc_vat, unit_price_ex_vat, line_total_inc_vat, prk_cost_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id, item.id || item.sku, item.sku, item.name, item.priceLine,
          item.tierKey, item.quantity, item.unitPriceIncVat, item.unitPriceExVat,
          item.lineTotalIncVat, item.prkCostSnapshot
        ]
      );
    }

    const quoteRecord = {
      id,
      quoteNumber,
      accountId: quoteData.accountId,
      accountName: quoteData.accountName,
      status: 'sent',
      validUntil,
      notes: quoteData.notes || '',
      items: pricing.items,
      totalBottles: pricing.totalBottles,
      subtotalExVat: pricing.subtotalExVat,
      vatTotal: pricing.vatTotal,
      deliveryFee: pricing.deliveryFee,
      grandTotal: pricing.grandTotal,
      createdAt: new Date().toISOString(),
    };

    mutateTradeStore((store) => {
      if (!store.quotes) store.quotes = [];
      store.quotes.unshift(quoteRecord);
    });

    return quoteRecord;
  });
}

/**
 * Convert an accepted quote into an order.
 *
 * Async because `createTradeOrder` takes the store lock. The quote is marked
 * accepted in a *separate* locked mutation afterwards — reading the store
 * first and writing it back at the end would overwrite the order that
 * createTradeOrder had just committed.
 * Convert an accepted quote into an active trade order with atomic stock checks.
 */
export async function acceptTradeQuote(quoteId, user) {
  await ensureTradeDb();
  const quote = await getTradeQuoteById(quoteId);
  if (!quote) throw new Error('Quote not found');
  if (quote.status === 'accepted') throw new Error('Quote already accepted');

  const today = new Date().toISOString().split('T')[0];
  if (quote.validUntil && quote.validUntil < today) {
    throw new Error(`This quotation expired on ${quote.validUntil}. Please request an updated quote.`);
  }

  const account = await getTradeAccountById(quote.accountId);
  if (!account) throw new Error('Associated account not found');

  const order = await createTradeOrder({
    account,
    user,
    items: quote.items,
    deliveryAddress: account.addresses?.[0] || {},
    poReference: `QUOTE-${quote.quoteNumber}`,
    notes: `Converted from quote ${quote.quoteNumber}. ${quote.notes || ''}`,
    paymentMethod: account.creditEnabled ? 'pay_on_account' : 'mpesa_paybill',
    source: 'rep',
    // A quote is built and sent by an account manager against a vetted
    // account, not raw public checkout — age confirmation is implicit.
    ageConfirmed: true,
  });

  await query(
    'UPDATE trade_quotes SET status = $1, order_id = $2, accepted_at = NOW(), updated_at = NOW() WHERE id = $3',
    ['accepted', order.id, quote.id]
  );

  mutateTradeStore((store) => {
    const q = store.quotes?.find((item) => item.id === quote.id);
    if (q) {
      q.status = 'accepted';
      q.orderId = order.id;
      q.acceptedAt = new Date().toISOString();
    }
  });

  return order;
}

/**
 * Decline a quotation with a logged reason code.
 */
export async function declineTradeQuote(quoteId, reason = '') {
  await ensureTradeDb();
  const res = await query(
    'UPDATE trade_quotes SET status = $1, decline_reason = $2, updated_at = NOW() WHERE id = $3 OR quote_number = $3 RETURNING *',
    ['declined', reason, quoteId]
  );
  if (res.rows.length === 0) throw new Error('Quote not found');

  mutateTradeStore((store) => {
    const q = store.quotes?.find((item) => item.id === quoteId || item.quoteNumber === quoteId);
    if (q) {
      q.status = 'declined';
      q.declineReason = reason;
      q.updatedAt = new Date().toISOString();
    }
  });

  return res.rows[0];
}

// ----------------- TRADE PRODUCTS & LIVE STOCK MANAGEMENT -----------------

export async function getTradeProducts(filters = {}) {
  await ensureTradeDb();
  let sql = 'SELECT * FROM trade_products WHERE 1=1';
  const params = [];

  if (filters.priceLine && filters.priceLine !== 'all') {
    params.push(filters.priceLine);
    sql += ` AND price_line = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length} OR LOWER(brand) LIKE $${params.length})`;
  }

  sql += ' ORDER BY name ASC';
  const res = await query(sql, params);
  const bands = getSpiritsBands();

  const { attachPriceOverrides, getMarginFloorConfig, classifyMarginStatus } = await import('./trade-costing.js');
  const floors = getMarginFloorConfig();

  const rows = res.rows.map((r) => {
    const cost = Number(r.prk_cost_inc_vat);
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      brandName: r.brand,
      categoryName: r.category_name,
      priceLine: r.price_line,
      prkCostIncVat: cost,
      caseSize: r.case_size ?? 12,
      productCostIncVat: r.product_cost_inc_vat !== null ? Number(r.product_cost_inc_vat) : null,
      logisticsCostIncVat: Number(r.logistics_cost_inc_vat) || 0,
      stockQuantity: parseInt(r.stock_quantity, 10),
      reservedStock: parseInt(r.reserved_stock, 10),
      inStock: Boolean(r.in_stock && r.stock_quantity > 0),
      isActive: Boolean(r.is_active),
      image: r.image_url,
      hasExplicitCost: cost > 0,
    };
  });

  const withOverrides = await attachPriceOverrides(rows.map((r) => ({ sku: r.sku, priceLine: r.priceLine })));
  const overridesBySku = new Map(withOverrides.map((r) => [r.sku, r.priceOverrides || {}]));

  return rows.map((r) => {
    let suggested;
    let floor;
    if (r.priceLine === 'spirits') {
      if (!r.hasExplicitCost) return { ...r, tierPrices: null };
      suggested = computeSpiritsTierPrices(r.prkCostIncVat, bands);
      floor = floors.spirits;
    } else if (r.priceLine === 'jaba') {
      // Standardized to inc-VAT, same convention as spirits — the flat
      // band price *is* the suggested figure, not derived from cost.
      suggested = {};
      for (const band of DEFAULT_PRICE_BANDS.jaba.bands) {
        suggested[band.key] = band.price_inc_vat;
      }
      floor = floors.jaba;
    } else {
      return { ...r, tierPrices: null };
    }

    const overrides = overridesBySku.get(r.sku) || {};
    const tierPrices = {};
    for (const key of Object.keys(suggested)) {
      const actual = overrides[key] ?? suggested[key];
      const marginPercent = actual > 0 ? Math.round(((actual - r.prkCostIncVat) / actual) * 100 * 100) / 100 : 0;
      tierPrices[key] = {
        suggested: suggested[key],
        actual,
        overrideApplied: overrides[key] !== undefined,
        marginPercent,
        status: classifyMarginStatus(marginPercent, floor),
      };
    }
    return { ...r, tierPrices };
  });
}

/**
 * Ad-hoc stock and catalogue-metadata edit. Landed cost is deliberately NOT
 * editable here — it is receipt-derived only (see recordStockReceipt in
 * trade-costing.js), so a `prkCostIncVat` key in `patch` is silently
 * ignored; a brand-new product's opening cost is instead set once at
 * `createTradeProduct` time. Stock-quantity changes are still audited via
 * inventory_logs; metadata fields (name, image, brand, category, active
 * flag) are not — they're catalogue upkeep, not inventory events.
 */
export async function updateTradeProduct(skuOrId, patch, user = 'Admin') {
  await ensureTradeDb();

  // Mirrored outside the transaction — it's a network fetch, and a locked
  // row shouldn't sit `FOR UPDATE` for however long the source site takes
  // to respond. A failed mirror keeps the URL the admin actually typed
  // rather than blocking the whole save over a hosting problem elsewhere.
  if (patch.imageUrl) {
    try {
      patch = { ...patch, imageUrl: await mirrorImageLocally(patch.imageUrl) };
    } catch (err) {
      console.error('Image mirror failed, keeping source URL:', err.message);
    }
  }

  return withTransaction(async (client) => {
    const checkRes = await client.query(
      'SELECT * FROM trade_products WHERE sku = $1 OR id = $1 FOR UPDATE',
      [skuOrId]
    );
    if (checkRes.rows.length === 0) throw new Error('Product not found in trade catalog');
    const existing = checkRes.rows[0];

    const currentQty = parseInt(existing.stock_quantity, 10);
    const newQty = patch.stockQuantity !== undefined ? parseInt(patch.stockQuantity, 10) : currentQty;

    const setClauses = ['stock_quantity = $1', 'in_stock = ($1 > 0)'];
    const params = [newQty];

    const metadataFields = {
      name: 'name',
      imageUrl: 'image_url',
      brand: 'brand',
      categoryName: 'category_name',
    };
    for (const [patchKey, column] of Object.entries(metadataFields)) {
      if (patch[patchKey] !== undefined) {
        params.push(patch[patchKey]);
        setClauses.push(`${column} = $${params.length}`);
      }
    }
    if (patch.isActive !== undefined) {
      params.push(Boolean(patch.isActive));
      setClauses.push(`is_active = $${params.length}`);
    }

    params.push(existing.id);
    await client.query(
      `UPDATE trade_products SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params
    );

    if (newQty !== currentQty) {
      const delta = newQty - currentQty;
      await client.query(
        'INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [existing.id, existing.sku, delta, newQty, patch.reason || 'manual_adjustment', user]
      );
    }

    return {
      ...existing,
      stock_quantity: newQty,
      in_stock: newQty > 0,
      name: patch.name !== undefined ? patch.name : existing.name,
      image_url: patch.imageUrl !== undefined ? patch.imageUrl : existing.image_url,
      brand: patch.brand !== undefined ? patch.brand : existing.brand,
      category_name: patch.categoryName !== undefined ? patch.categoryName : existing.category_name,
      is_active: patch.isActive !== undefined ? Boolean(patch.isActive) : existing.is_active,
    };
  });
}

/**
 * Creates a new trade-only catalogue product — the "manage the B2B catalog
 * independently" path. Opening cost is set once here (unlike
 * updateTradeProduct, which never touches cost); later cost changes go
 * through a stock receipt, same as any other product.
 */
export async function createTradeProduct(data, user = 'Admin') {
  await ensureTradeDb();

  const sku = String(data.sku || '').trim();
  const name = String(data.name || '').trim();
  const priceLine = data.priceLine;

  if (!sku) throw new Error('SKU is required');
  if (!name) throw new Error('Product name is required');
  if (priceLine !== 'spirits' && priceLine !== 'jaba') throw new Error('Price line must be spirits or jaba');

  const existing = await query('SELECT id FROM trade_products WHERE sku = $1', [sku]);
  if (existing.rows.length > 0) throw new Error(`SKU "${sku}" already exists in the trade catalogue`);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || sku.toLowerCase();
  const id = `prod_tr_${slug}-${Date.now().toString(36)}`;
  const qty = Math.max(0, parseInt(data.stockQuantity, 10) || 0);
  const cost = Math.max(0, Number(data.prkCostIncVat) || 0);
  const caseSize = Math.max(1, parseInt(data.caseSize, 10) || 12);

  let imageUrl = data.imageUrl || null;
  if (imageUrl) {
    try {
      imageUrl = await mirrorImageLocally(imageUrl);
    } catch (err) {
      console.error('Image mirror failed, keeping source URL:', err.message);
    }
  }

  await query(
    `INSERT INTO trade_products (
      id, sku, name, slug, brand, category_name, price_line, prk_cost_inc_vat,
      case_size, stock_quantity, reserved_stock, in_stock, is_active, image_url,
      created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,true,$12,NOW(),NOW())`,
    [id, sku, name, slug, data.brand || '', data.categoryName || '', priceLine, cost, caseSize, qty, qty > 0, imageUrl]
  );

  if (qty > 0) {
    await query(
      `INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id)
       VALUES ($1, $2, $3, $4, 'new_product', $5)`,
      [id, sku, qty, qty, user]
    );
  }

  return { id, sku, name, priceLine };
}

export async function getInventoryLogs(skuOrId = null, limit = 50) {
  await ensureTradeDb();
  let sql = 'SELECT * FROM inventory_logs';
  const params = [];
  if (skuOrId) {
    params.push(skuOrId);
    sql += ' WHERE sku = $1 OR product_id = $1';
  }
  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await query(sql, params);
  return res.rows;
}

// ----------------- TEMPLATES & SAVED LISTS -----------------

export function getSegmentTemplates() {
  const store = readTradeStore();
  return store.templates || [];
}

export function upsertSegmentTemplate(templateData) {
  if (!templateData || !templateData.name) {
    throw new Error('Template name is required');
  }

  const items = Array.isArray(templateData.items)
    ? templateData.items
        .filter((it) => it && (it.sku || it.id) && Number(it.quantity) > 0)
        .map((it) => ({
          sku: it.sku || it.id,
          name: String(it.name || it.sku || 'Item').trim(),
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
          priceLine: it.priceLine || 'spirits',
          prkCostIncVat: Number(it.prkCostIncVat) || 0,
        }))
    : [];

  return mutateTradeStore((store) => {
    if (!store.templates) store.templates = [];

    const existingIdx = templateData.id
      ? store.templates.findIndex((t) => t.id === templateData.id)
      : -1;

    const templateRecord = {
      id: existingIdx >= 0 ? store.templates[existingIdx].id : templateData.id || `tpl_custom_${Date.now()}`,
      name: String(templateData.name).trim(),
      segment: String(templateData.segment || 'general').trim().toLowerCase(),
      description: String(templateData.description || '').trim(),
      items,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      store.templates[existingIdx] = {
        ...store.templates[existingIdx],
        ...templateRecord,
      };
      return store.templates[existingIdx];
    } else {
      store.templates.push(templateRecord);
      return templateRecord;
    }
  });
}

export function deleteSegmentTemplate(templateId) {
  if (!templateId) return false;
  return mutateTradeStore((store) => {
    if (!store.templates) return false;
    const initialLen = store.templates.length;
    store.templates = store.templates.filter((t) => t.id !== templateId);
    return store.templates.length < initialLen;
  });
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

export async function getTradeMarginReport(filters = {}) {
  const store = readTradeStore();
  let orders = store.orders || [];

  const { getMarginFloorConfig } = await import('./trade-costing.js');
  const floors = getMarginFloorConfig();
  const floorPercent = Math.min(floors.spirits, floors.jaba);

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
      isSubMarginFloor: gmPercent < floorPercent,
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
    gmFloorPercent: floorPercent,
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
  getTradeOrders,
  getTradeOrderById,
  generateSequentialInvoiceNumber,
  createTradeOrder,
  updateTradeOrderStatus,
  getTradeQuotes,
  createTradeQuote,
  acceptTradeQuote,
  getSegmentTemplates,
  upsertSegmentTemplate,
  deleteSegmentTemplate,
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
  return mutateTradeStore(async (store) => {
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

    // Was a bare UPDATE keyed on a row addTradeUser had never actually
    // created (see syncTradeUserToPg) and referencing a trade_users column
    // ("updated_at") that doesn't exist — so this silently synced nothing,
    // ever, in either direction. Upserting the whole record fixes both.
    await syncTradeUserToPg(store.users[index]);

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
  return mutateTradeStore(async (store) => {
    if (!store.users) store.users = [];
    store.users.push(user);
    await syncTradeUserToPg(user);
    return user;
  });
}

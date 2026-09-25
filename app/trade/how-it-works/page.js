'use client';

import Link from 'next/link';

function CocktailIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16l-7 8.5v6.5" />
      <path d="M9 19h6" />
      <path d="M12 12.5 5.5 4.5" />
    </svg>
  );
}

function OfficeIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="10" height="18" />
      <rect x="14" y="9" width="6" height="12" />
      <path d="M7.5 7h1M11 7h1M7.5 11h1M11 11h1M7.5 15h1M11 15h1M16.5 12.5h1M16.5 16h1" />
    </svg>
  );
}

function EventIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </svg>
  );
}

function StoreIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9V4h16v5" />
      <path d="M3 9h18l-1 3a3 3 0 0 1-5.5 1.7A3 3 0 0 1 12 15a3 3 0 0 1-2.5-1.3A3 3 0 0 1 4 12l-1-3Z" />
      <path d="M5 13v8h14v-8" />
      <path d="M10 21v-5h4v5" />
    </svg>
  );
}

function HomeIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

export default function TradeHowItWorksPage() {
  const segments = [
    {
      title: 'HORECA & Bars',
      desc: 'Hotels, cocktail lounges, and rooftop venues enjoying Tier 3 volume rates, scheduled receiving dock drops, and monthly credit settlement.',
      Icon: CocktailIcon,
      badge: 'Hotels & Nightlife',
    },
    {
      title: 'Corporate Offices',
      desc: 'Friday happy hours, boardroom entertainment, client gifting, and celebration restocks with itemized KRA VAT invoices for tax deductions.',
      Icon: OfficeIcon,
      badge: 'Enterprises',
    },
    {
      title: 'Events & Caterers',
      desc: 'High-volume festival and wedding procurement with pre-event consignment terms, chilled delivery vans, and 1-click quote approvals.',
      Icon: EventIcon,
      badge: 'Festivals & Catering',
    },
    {
      title: 'Retail & Stockists',
      desc: 'Liquor stores, high-end grocers, and specialty merchants sourcing authentic Pernod Ricard spirits and artisanal Jaba elixirs.',
      Icon: StoreIcon,
      badge: 'Stockists',
    },
    {
      title: 'Private Residences',
      desc: 'Embassy residences, country estates, and collector cellars receiving discreet temperature-controlled private deliveries.',
      Icon: HomeIcon,
      badge: 'Diplomatic & Estates',
    },
  ];

  return (
    <div className="space-y-16 py-8 sm:py-12 text-[#231F20] animate-page-enter">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/trade" className="text-xs font-bold text-[#840038] uppercase hover:underline">
          ← Back to Trade Home
        </Link>
        <div className="mt-3 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Seamless Procurement
          </span>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#231F20]">
            How Wholesale Ordering Works
          </h1>
        </div>
      </section>

      {/* 4-Step Process */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
              01
            </div>
            <h4 className="text-sm font-bold uppercase text-gray-900">Browse Live Pricing</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              No account needed — wholesale quantity ladders are visible to everyone, from a single trial-priced bottle upward.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
              02
            </div>
            <h4 className="text-sm font-bold uppercase text-gray-900">Order &amp; Pay</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Check out with M-Pesa or bank transfer — just your details and a delivery address. Minimum order: 12 bottles or KES 10,000.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
              03
            </div>
            <h4 className="text-sm font-bold uppercase text-gray-900">Same-Day Dispatch</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Orders placed by 12:00 EAT delivered same afternoon across Nairobi Metro in dedicated vans. Rest of Kenya: 2-3 business days.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
              04
            </div>
            <h4 className="text-sm font-bold uppercase text-gray-900">Apply for Credit</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Approved partners get Net 14 settlement, gapless KRA VAT invoices, and a statement ledger — submit KRA PIN &amp; licence to apply.
            </p>
          </div>
        </div>
      </section>

      {/* Credit Account Track */}
      <section className="bg-white py-12 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">For Repeat & Larger Buyers</span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#231F20]">
              The Business Account Track
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Every order above works on cash terms with no account at all. Businesses that order regularly can apply
              separately for a trade business account — submit your KRA PIN and liquor licence, and an approved account
              unlocks Net 14 payment terms, a dedicated statement of account, and a named account manager. Vetting
              takes a few business hours; it never blocks you from ordering on cash terms in the meantime.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <Link
              href="/trade/apply"
              className="px-8 py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
            >
              Apply for a Business Account →
            </Link>
          </div>
        </div>
      </section>

      {/* Segment Strips */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center sm:text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Tailored Commercial Terms
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-1">
            Built for Every Trade Sector
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map((seg) => (
            <div
              key={seg.title}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center">
                  <seg.Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-50 text-[#840038]">
                  {seg.badge}
                </span>
              </div>
              <h3 className="text-lg font-black uppercase text-gray-900">{seg.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{seg.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1c1917] rounded-3xl p-8 sm:p-10 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            Ready to Order?
          </h2>
          <Link
            href="/trade/catalog"
            className="inline-block px-8 py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95"
          >
            Browse Wholesale Catalog →
          </Link>
        </div>
      </section>
    </div>
  );
}

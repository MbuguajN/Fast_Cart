'use client';

import Link from 'next/link';

function ScaleIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 7l-3 7a4 4 0 008 0l-3-7M19 7l-3 7a4 4 0 008 0l-3-7M5 7h14" />
    </svg>
  );
}

function TruckIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16V6a1 1 0 011-1h9a1 1 0 011 1v10M14 9h4l3 3v4a1 1 0 01-1 1h-2" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

function CardIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function DocumentIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </svg>
  );
}

export default function TradeLandingPage() {
  const features = [
    {
      title: 'Volume Tier Pricing',
      desc: 'Every bottle is priced on the quantity you order — from a trial single bottle up to bulk case rates. No negotiation.',
      Icon: ScaleIcon,
    },
    {
      title: 'Same-Day Nairobi Delivery',
      desc: 'Order before 12:00 EAT and receive it that afternoon. Rest of Kenya in 2-3 business days.',
      Icon: TruckIcon,
    },
    {
      title: 'M-Pesa & Bank Transfer',
      desc: 'Pay on order, no account required. Approved partners can apply separately for Net 14 credit terms.',
      Icon: CardIcon,
    },
    {
      title: 'VAT-Compliant Invoicing',
      desc: 'Every order gets a proper KRA VAT invoice — itemized, sequential, and ready for your books.',
      Icon: DocumentIcon,
    },
  ];

  return (
    <div className="space-y-16 py-8 sm:py-12 text-[#231F20] animate-page-enter">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl p-6 sm:p-10 text-white text-center sm:text-left relative overflow-hidden shadow-2xl border border-white/10 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(28,25,23,0.82), rgba(28,25,23,0.82)), url('https://myhappyhour.co.ke/wp-content/uploads/2026/09/b2bHomePage-01-1.webp')",
            backgroundColor: '#1c1917',
          }}
        >
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#840038] text-white text-xs font-black uppercase tracking-widest border border-pink-400/30">
              <span>★ Pernod Ricard Wholesale Partner · Nairobi</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight font-sans">
              Wholesale Spirits &amp; Craft Juices, Priced by the Bottle
            </h1>

            <p className="text-sm sm:text-base text-gray-300 font-medium leading-relaxed">
              Browse real wholesale pricing and order today — no account, no vetting, no waiting. From a single
              trial bottle to a full bar restock, the more you buy per SKU, the less you pay per bottle.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/trade/catalog"
                className="w-full sm:w-auto px-8 py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 text-center"
              >
                Browse Wholesale Catalog →
              </Link>
              <Link
                href="/trade/how-it-works"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-2xl border border-white/20 transition-all active:scale-95 text-center"
              >
                See How It Works
              </Link>
            </div>

            <p className="text-[11px] text-gray-400 pt-1">
              Ordering for a licensed venue or expect to reorder often?{' '}
              <Link href="/trade/apply" className="font-bold text-pink-300 hover:underline">
                Apply for a business account →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Feature Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center">
                <f.Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black uppercase text-gray-900">{f.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Minimum Order / Fine Print Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-pink-50 border border-pink-200 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#840038] block mb-1">
              Minimum Order
            </span>
            <p className="text-xs text-gray-700 font-medium">
              12 bottles across all SKUs, or KES 10,000 goods value — whichever is higher. Curious how the tiers
              and rules work? <Link href="/trade/how-it-works" className="font-bold text-[#840038] hover:underline">Read the full breakdown →</Link>
            </p>
          </div>
          <Link
            href="/trade/catalog"
            className="shrink-0 px-6 py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow transition-all active:scale-95"
          >
            Start Shopping →
          </Link>
        </div>
      </section>
    </div>
  );
}

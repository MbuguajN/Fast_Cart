'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { pickFeaturedProducts, priceSummary } from '@/lib/trade/landing-featured.js';

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

function ShieldIcon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const kes = (n) => `KES ${Number(n).toLocaleString('en-KE')}`;

export default function TradeLandingPage() {
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/trade/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setFeatured(pickFeaturedProducts(data?.products, 8)); })
      .catch(() => { if (!cancelled) setFeatured([]); });
    return () => { cancelled = true; };
  }, []);

  const benefits = [
    {
      title: 'Honest Wholesale Pricing',
      desc: 'Prices are online, no calling for a quote. Every bottle gets cheaper as you order more of it.',
      Icon: ScaleIcon,
    },
    {
      title: 'Fast Delivery',
      desc: 'Order before 12:00 EAT and receive it the same afternoon in Nairobi. Rest of Kenya in 2-3 business days.',
      Icon: TruckIcon,
    },
    {
      title: '100% Original',
      desc: 'Sealed, genuine bottles, and every order backed by a KRA VAT invoice. Never counterfeit.',
      Icon: ShieldIcon,
    },
  ];

  const ways = [
    { title: 'Pay now', desc: 'Card or M-Pesa at checkout. No account needed.', Icon: CardIcon },
    { title: 'Credit for approved businesses', desc: 'Apply for Net 14 terms and order on account.', Icon: DocumentIcon },
    { title: 'Funding for large orders', desc: 'Need help financing a big order? Sign in for the options.', Icon: ScaleIcon },
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
              <span>100% original · Sealed bottles · VAT invoice with every order</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight font-sans">
              Original Spirits at Wholesale Prices, Delivered Fast
            </h1>

            <p className="text-sm sm:text-base text-gray-300 font-medium leading-relaxed">
              See real wholesale prices and order today. No account, no vetting, no waiting. From a single
              trial bottle to a full bar restock, the more you buy of each bottle, the less you pay per bottle.
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

      {/* Shelf: live products and prices */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#840038] block">On the shelf today</span>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-gray-900">Popular with bars and venues</h2>
          </div>
          <Link href="/trade/catalog" className="text-xs font-bold text-[#840038] hover:underline shrink-0">
            See the full catalogue →
          </Link>
        </div>

        {featured === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 rounded-3xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="text-xs text-gray-500">
            Browse everything we stock in the <Link href="/trade/catalog" className="font-bold text-[#840038] hover:underline">wholesale catalogue</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {featured.map((product) => {
              const price = priceSummary(product);
              return (
                <Link
                  key={product.sku}
                  href="/trade/catalog"
                  className="group bg-white rounded-3xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 hover:border-[#840038] transition-colors"
                >
                  <div className="aspect-square rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
                    <p className="text-sm font-black text-[#840038]">{kes(price.from)}<span className="text-[10px] font-bold text-gray-500"> / bottle</span></p>
                    {price.to && (
                      <p className="text-[11px] text-emerald-700 font-bold">Down to {kes(price.to)} at volume</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-gray-500">Prices include VAT. Minimum order applies.</p>
      </section>

      {/* Why us */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {benefits.map((f) => (
            <div key={f.title} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center">
                <f.Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black uppercase text-gray-900">{f.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ways to pay */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-gray-900">Ways to pay</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ways.map((w) => (
            <div key={w.title} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-white border border-gray-200 text-[#840038] flex items-center justify-center">
                <w.Icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-gray-900">{w.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{w.desc}</p>
              </div>
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

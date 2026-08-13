'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full mt-12 select-none" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Warning Ribbon */}
      <div className="bg-pink-100 border-y border-pink-200 py-2.5 px-4 text-center overflow-hidden">
        <p className="text-[11px] md:text-xs font-black tracking-wider text-[#840037] uppercase">
          ⚠️ EXCESSIVE CONSUMPTION OF ALCOHOL IS HARMFUL TO YOUR HEALTH. STRICTLY NOT FOR SALE TO PERSONS UNDER THE AGE OF 18.
        </p>
      </div>

      {/* Main Footer Section */}
      <div className="bg-[#1c1917] text-white pt-12 pb-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          {/* Col 1: Brand & Logo */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase">
                HAPPY HOUR!
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm font-medium">
              Nairobi's premium 20-minute drinks, wine, and party supplies delivery service. Cold drinks delivered straight to your doorstep.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Deliveries Active 24/7 across Nairobi</span>
            </div>
          </div>

          {/* Col 2: Customer Service */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-200">
              Customer Service
            </h3>
            <ul className="space-y-2 text-xs text-gray-300 font-medium">
              <li>
                <a href="#refund" className="hover:text-white transition-colors hover:underline">
                  Refund and Returns Policy
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-white transition-colors hover:underline">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors hover:underline">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#ugc" className="hover:text-white transition-colors hover:underline">
                  UGC Policy
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors hover:underline">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Shop Info & Payment Badges */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-200">
              Happy Hour Shop
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-medium">
              Thanks for spending your Happy Hour with us. Follow us for more good times, great drinks, and unbeatable offers.
              Follow Our Socials for All the Deals We Have in Store!
            </p>

            {/* Paystack Payment Badge Card */}
            <div className="bg-white text-gray-900 rounded-2xl p-3.5 shadow-md border border-gray-100 max-w-md space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                <svg className="w-3.5 h-3.5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
                <span>Secured by <strong>paystack</strong></span>
              </div>

              {/* Payment Provider Icons */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {/* Mastercard */}
                <div className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-black text-red-600">Mastercard</span>
                </div>

                {/* VISA */}
                <div className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-black text-blue-800 italic">VISA</span>
                </div>

                {/* M-PESA */}
                <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-black text-emerald-600">M-PESA</span>
                </div>

                {/* AMEX */}
                <div className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-black text-sky-600">AMEX</span>
                </div>

                {/* Apple Pay */}
                <div className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] font-black text-black">Pay</span>
                </div>
              </div>
            </div>

            {/* Social Media Icons */}
            <div className="flex items-center gap-3 pt-1">
              <a href="#facebook" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-[#840037] text-white flex items-center justify-center transition-colors">
                <span className="text-xs font-bold">f</span>
              </a>
              <a href="#instagram" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-[#840037] text-white flex items-center justify-center transition-colors">
                <span className="text-xs font-bold">📷</span>
              </a>
              <a href="#tiktok" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-[#840037] text-white flex items-center justify-center transition-colors">
                <span className="text-xs font-bold">🎵</span>
              </a>
              <a href="#twitter" className="w-8 h-8 rounded-full bg-gray-800 hover:bg-[#840037] text-white flex items-center justify-center transition-colors">
                <span className="text-xs font-bold">𝕏</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Banner */}
      <div className="bg-[#840037] text-white py-3 px-6 text-center text-xs font-medium">
        <p>Copyright Happy Hour 2026. Designed for Fast Cart.</p>
      </div>
    </footer>
  );
}

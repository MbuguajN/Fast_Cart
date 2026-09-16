'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const SECTIONS = [
  { id: 'section-1', num: '1', title: 'Introduction' },
  { id: 'section-2', num: '2', title: 'Who We Are' },
  { id: 'section-3', num: '3', title: 'Age Restriction & Verification' },
  { id: 'section-4', num: '4', title: 'Information We Collect' },
  { id: 'section-5', num: '5', title: 'How We Collect Information' },
  { id: 'section-6', num: '6', title: 'How We Use Your Information' },
  { id: 'section-7', num: '7', title: 'Legal Basis for Processing' },
  { id: 'section-8', num: '8', title: 'Cookies & Tracking' },
  { id: 'section-9', num: '9', title: 'Marketing Communications' },
  { id: 'section-10', num: '10', title: 'Sharing & Disclosure' },
  { id: 'section-11', num: '11', title: 'Data Retention' },
  { id: 'section-12', num: '12', title: 'Data Security' },
  { id: 'section-13', num: '13', title: 'Your Rights (DPA 2019)' },
  { id: 'section-14', num: '14', title: "Children's Privacy" },
  { id: 'section-15', num: '15', title: 'Call Centre & Recorded Calls' },
  { id: 'section-16', num: '16', title: 'Loyalty & Referral Programmes' },
  { id: 'section-17', num: '17', title: 'Changes to This Policy' },
  { id: 'section-19', num: '19', title: 'Governing Law' },
  { id: 'section-20', num: '20', title: 'Related Practices & Policies' },
];

export default function PrivacyPolicyView() {
  const [activeSection, setActiveSection] = useState('section-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('Legal@nordic.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const filteredSections = searchQuery.trim()
    ? SECTIONS.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : SECTIONS;

  return (
    <div className="w-full">
      {/* Header Banner */}
      <div className="border-b border-gray-100 pb-8 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#840037] bg-pink-50 border border-pink-100 px-3.5 py-1 rounded-full">
              Official Legal Policy
            </span>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Kenya DPA 2019 Compliant
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copy link to clipboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{copiedLink ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="Print document"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Privacy Policy and Data Protection
        </h1>
        <p className="text-sm text-gray-500 mt-2 flex flex-wrap items-center gap-3">
          <span>Operator: <strong>Nordic Beverages Limited</strong></span>
          <span>•</span>
          <span>Jurisdiction: <strong>Republic of Kenya</strong></span>
          <span>•</span>
          <span>Last Revised: <strong>September 2026</strong></span>
        </p>

        {/* Quick Highlights Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
          <div className="bg-rose-50/70 border border-rose-100/90 rounded-2xl p-4 transition-all hover:shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-[#840037] text-white flex items-center justify-center font-bold text-xs mb-2.5">
              18+
            </div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
              Age Verification
            </h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Mandatory age check at registration &amp; ID visual inspection upon delivery under Kenya law.
            </p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100/90 rounded-2xl p-4 transition-all hover:shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
              🛡️
            </div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
              Zero Data Selling
            </h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              We never sell personal data. Information is only shared to fulfill orders and comply with law.
            </p>
          </div>

          <div className="bg-blue-50/70 border border-blue-100/90 rounded-2xl p-4 transition-all hover:shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
              ⚖️
            </div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
              DPA 2019 Rights
            </h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Right to access, rectify, port, or erase your data with dedicated privacy officer support.
            </p>
          </div>

          <div className="bg-purple-50/70 border border-purple-100/90 rounded-2xl p-4 transition-all hover:shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
              21d
            </div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">
              Statutory Response
            </h4>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Guaranteed prompt response within 21 days for all formal data subject rights requests.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar TOC + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Desktop TOC Sidebar */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-gray-50/80 backdrop-blur-xs rounded-2xl p-5 border border-gray-200/80">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#840037]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Table of Contents
              </h3>
              <span className="text-[10px] font-bold text-gray-400">19 Sections</span>
            </div>

            {/* Quick Search */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter sections..."
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-hidden focus:border-[#840037]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <nav className="max-h-[60vh] overflow-y-auto space-y-1 pr-1 text-xs">
              {filteredSections.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#840037] text-white font-bold shadow-xs'
                        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black transition-colors ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-700'
                      }`}
                    >
                      {sec.num}
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Quick Help Box */}
          <div className="bg-gradient-to-br from-[#840037] to-[#5b0024] text-white rounded-2xl p-5 shadow-xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-pink-200 mb-1">
              Need Privacy Assistance?
            </h4>
            <p className="text-xs text-white/90 leading-relaxed mb-3">
              For questions regarding your personal data or to submit a rights request:
            </p>
            <button
              onClick={handleCopyEmail}
              className="w-full bg-white text-[#840037] hover:bg-pink-50 font-bold text-xs py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{copiedEmail ? 'Copied Legal@nordic.com!' : 'Email Legal@nordic.com'}</span>
            </button>
          </div>
        </aside>

        {/* Policy Body */}
        <div className="lg:col-span-8 space-y-10 text-gray-700 leading-relaxed">
          {/* Mobile Quick-Jump Pills */}
          <div className="lg:hidden -mt-2 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#840037]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Quick Jump
              </span>
              <span className="text-[10px] text-gray-400">Scroll sideways →</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                      isActive
                        ? 'bg-[#840037] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="font-bold mr-1">{sec.num}.</span>
                    <span>{sec.title}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Section 1 */}
          <section id="section-1" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                1
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Introduction
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              Nordic Beverages Limited (<strong>&quot;Nordic Beverages&quot;</strong>, <strong>&quot;we&quot;</strong>, <strong>&quot;us&quot;</strong>, or <strong>&quot;our&quot;</strong>) operates the Happy Hour E-commerce Platform (the <strong>&quot;Platform&quot;</strong>), an online marketplace for the sale and delivery of alcoholic beverages and related products within Kenya.
            </p>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              This Privacy Policy explains how we collect, use, disclose, store, and protect personal data belonging to visitors, registered users, and customers of the Platform (<strong>&quot;you&quot;</strong> or <strong>&quot;your&quot;</strong>), in accordance with the <strong>Data Protection Act, 2019 (the &quot;DPA&quot;)</strong>, the <strong>Data Protection (General) Regulations, 2021</strong>, and other applicable laws of Kenya, as well as internationally recognised data protection practices adopted by leading e-commerce platforms.
            </p>
            <div className="bg-gray-50 border-l-4 border-[#840037] p-4 rounded-r-2xl">
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                By creating an account, browsing the Platform, placing an order, or otherwise submitting personal data to us, you acknowledge that you have read and understood this Privacy Policy and agree to the processing of your data. If you do not agree with this Privacy Policy, please do not use the Platform.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section id="section-2" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                2
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Who We Are
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              For the purposes of the DPA, Nordic Beverages is the <strong>&quot;data controller&quot;</strong> and/or <strong>&quot;data processor&quot;</strong> responsible for your personal data.
            </p>

            <div className="bg-gradient-to-br from-gray-50 to-pink-50/30 p-5 rounded-2xl border border-gray-200/80 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Registered Name
                  </span>
                  <span className="text-sm font-extrabold text-gray-900">
                    Nordic Beverages Limited
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Registered Address
                  </span>
                  <span className="text-sm font-extrabold text-gray-900">
                    The Billows, Kilimani, Nairobi
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200/60 pt-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-0.5">
                    General Privacy Enquiries
                  </span>
                  <a href="mailto:Legal@nordic.com" className="text-sm font-bold text-[#840037] hover:underline">
                    Legal@nordic.com
                  </a>
                </div>
                <button
                  onClick={handleCopyEmail}
                  className="text-xs font-bold text-[#840037] bg-white hover:bg-pink-100/50 border border-pink-200 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedEmail ? '✓ Copied' : 'Copy Email'}
                </button>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="section-3" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                3
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Age Restriction and Eligibility to Purchase
              </h2>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 p-4 sm:p-5 rounded-2xl mb-4 text-amber-950">
              <div className="flex items-center gap-2 font-extrabold text-sm mb-1.5">
                <span className="text-base">🔞</span>
                <span>Mandatory 18+ Legal Age Verification (Kenya Law)</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                Alcoholic beverages may only be sold to, and purchased by, persons who are <strong>18 years of age or older</strong>, in accordance with the <strong>Alcoholic Drinks Control Act, 2010</strong> and related county liquor licensing regulations. By registering an account or placing an order, you confirm that you are at least 18 years old.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">
                  1. Registration-Stage Verification:
                </strong>
                <p className="text-xs sm:text-sm text-gray-600">
                  We require you to confirm that you are 18 years and above and, where applicable, provide a national identity document or passport number to verify eligibility before you can complete a purchase.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">
                  2. Delivery-Stage Verification:
                </strong>
                <p className="text-xs sm:text-sm text-gray-600">
                  Our delivery riders or courier partners may be required to request a valid identification document from the recipient at the point of delivery, and may refuse delivery where age cannot be confirmed.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4 italic font-medium">
              We do not knowingly offer the Platform to, or collect personal data from, individuals under 18 years of age.
            </p>
          </section>

          {/* Section 4 */}
          <section id="section-4" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                4
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Information We Collect
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We collect the following categories of personal data:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (a) Identity &amp; Account
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Full name, age, phone number, email address.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (b) Order &amp; Transaction
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Products purchased, order value and history, delivery address, delivery instructions, order status, returns, and complaints.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60 md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block">
                    (c) Payment Information
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    PCI-DSS Compliant Gateways
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Mobile money details (e.g., M-Pesa phone number and transaction reference), card payment details, billing address, and transaction confirmations. Card and mobile money credentials are processed by our PCI-DSS-compliant payment service providers; <strong>we do not store full card numbers or mobile money PINs on our systems.</strong>
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (d) Delivery &amp; Location
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Delivery address, and, where you grant permission through the Platform, real-time or approximate device location used to facilitate delivery and estimate delivery times.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (e) Device &amp; Usage
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  IP address, device identifiers, browser type and version, operating system, referring/exit pages, clickstream data, and diagnostic log data collected automatically.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (g) Communications &amp; Support
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Records of customer support enquiries, complaints, product reviews and ratings, and survey responses.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/60">
                <span className="text-[11px] font-extrabold text-[#840037] uppercase tracking-wider block mb-1">
                  (h) Marketing Preferences
                </span>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Your choices regarding receipt of promotional emails, SMS, WhatsApp messages, or push notifications.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section-5" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                5
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                How We Collect Your Information
              </h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                <span className="text-[#840037] font-bold text-lg mt-0.5">•</span>
                <div>
                  <strong className="text-gray-900 block font-bold mb-0.5">Directly from you:</strong>
                  <span className="text-xs sm:text-sm text-gray-600">
                    When you register an account, complete checkout, contact customer support, respond to surveys, or otherwise interact with the Platform.
                  </span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                <span className="text-[#840037] font-bold text-lg mt-0.5">•</span>
                <div>
                  <strong className="text-gray-900 block font-bold mb-0.5">Automatically:</strong>
                  <span className="text-xs sm:text-sm text-gray-600">
                    Through cookies, analytics tools, and server logs when you use the Platform.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section id="section-6" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                6
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                How We Use Your Information
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We use personal data for the following legitimate purposes:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-gray-700">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To create, maintain, and secure your account</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To process, fulfil, and coordinate delivery with riders</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To process payments via mobile money &amp; cards</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To provide customer support and manage complaints</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To send transactional order confirmations &amp; updates</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To send consented marketing, promotions &amp; deals</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To personalise shopping &amp; product recommendations</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To maintain, test, and improve Platform analytics</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5 sm:col-span-2">
                <span className="w-2 h-2 rounded-full bg-[#840037] shrink-0"></span>
                <span>To enable you to participate in promotions, competitions, and surveys</span>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section id="section-7" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                7
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Legal Basis for Processing
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We process personal data on one or more of the following legal bases recognized under the Kenyan DPA 2019:
            </p>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="font-extrabold text-gray-900 block mb-1">1. Consent:</span>
                <p className="text-gray-600">
                  For marketing communications, optional cookies, and certain data sharing with marketing or advertising partners. You may withdraw your consent at any time, including by clicking the &quot;unsubscribe&quot; link at the bottom of any marketing email.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="font-extrabold text-gray-900 block mb-1">2. Performance of a Contract:</span>
                <p className="text-gray-600">
                  To process and deliver the orders you place with us, including using your contact details and payment information to fulfil and deliver your order.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="font-extrabold text-gray-900 block mb-1">3. Our Legitimate Business Interests:</span>
                <p className="text-gray-600">
                  Where necessary for us to understand our customers, and operate and improve the Platform, provided this does not unduly affect your privacy and other rights.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="font-extrabold text-gray-900 block mb-1">4. Compliance with a Legal Obligation:</span>
                <p className="text-gray-600">
                  Where we are required to process personal data to comply with an obligation under Kenyan law (e.g. tax records, liquor control regulations).
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="section-8" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                8
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Cookies and Similar Technologies
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We and our service providers use cookies, pixels, SDKs, and similar tracking technologies to operate and improve the Platform, including:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">Strictly Necessary Cookies</strong>
                <p className="text-gray-600">Required for core functions such as login, cart persistence, and checkout.</p>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">Performance &amp; Analytics</strong>
                <p className="text-gray-600">Used to understand how users interact with the Platform and detect errors.</p>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">Functional Cookies</strong>
                <p className="text-gray-600">Used to remember your preferences (e.g., location, delivery zone).</p>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-1">Advertising &amp; Targeting</strong>
                <p className="text-gray-600">Used to deliver relevant promotions, subject to your explicit consent.</p>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              You can manage or disable cookies through your browser or device settings, and through the cookie preference banner presented on the Platform. Disabling certain cookies may affect the functionality of the Platform.
            </p>
          </section>

          {/* Section 9 */}
          <section id="section-9" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                9
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Marketing Communications
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              Where you have opted in, we may send you marketing communications by email, SMS, WhatsApp, or push notification. You may withdraw consent at any time by:
            </p>

            <div className="space-y-2.5 text-xs sm:text-sm bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-pink-100 text-[#840037] flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <span>Clicking the <strong>&quot;unsubscribe&quot;</strong> link included in marketing emails; or</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-pink-100 text-[#840037] flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <span>Replying <strong>&quot;STOP&quot;</strong> to marketing SMS messages; or</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-pink-100 text-[#840037] flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <span>Writing to <a href="mailto:Legal@nordic.com" className="text-[#840037] font-bold underline">Legal@nordic.com</a> requesting withdrawal.</span>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section id="section-10" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                10
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Sharing and Disclosure of your Information
              </h2>
            </div>

            <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-2xl mb-4 text-xs sm:text-sm text-rose-950 font-medium flex items-start gap-2.5">
              <span className="text-base">🛡️</span>
              <div>
                <strong>We do not sell your personal data.</strong> We may share personal data with the following categories of recipients, only as necessary for the purposes described in this Policy:
              </div>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm mb-4">
              <li className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-0.5">Payment Service Providers:</strong>
                <span className="text-gray-600">Mobile money operators and licensed payment gateways/processors to process and confirm payments.</span>
              </li>
              <li className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-0.5">Delivery &amp; Logistics Partners:</strong>
                <span className="text-gray-600">Third-party courier companies and independent riders, who receive your name, phone number, and delivery address as necessary to fulfil your order.</span>
              </li>
              <li className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <strong className="text-gray-900 block font-bold mb-0.5">Regulators &amp; Public Authorities:</strong>
                <span className="text-gray-600">Where required by law, court order, or to establish, exercise, or defend legal claims.</span>
              </li>
            </ul>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs text-gray-600 leading-relaxed">
              When we share your personal data with third parties, we require them to agree to protect your data in accordance with this Policy and applicable law, and we only permit them to process your personal data for the specified purposes and in accordance with our instructions. We do not allow our third-party service providers to use your personal data for their own independent purposes.
            </div>
          </section>

          {/* Section 11 */}
          <section id="section-11" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                11
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Data Retention
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We take every reasonable step to ensure that your personal data is processed for the minimum period necessary for the purposes set out in this Policy. Your personal data may be retained in a form that allows for identification for as long as:
            </p>

            <ul className="space-y-2 text-xs sm:text-sm pl-4 list-disc mb-4 text-gray-700">
              <li>We maintain an ongoing relationship with you, so that we can provide the Platform to you and ensure you receive communications you have requested; or</li>
              <li>Your personal data is necessary in connection with the purposes set out in this Policy and we have a valid legal basis for retaining it.</li>
            </ul>

            <p className="text-xs text-gray-500 leading-relaxed">
              We actively review the personal data we hold and delete it securely, or in some cases anonymise it, when there is no longer a legal, business, or customer need for it to be retained.
            </p>
          </section>

          {/* Section 12 */}
          <section id="section-12" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                12
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Data Security
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              We implement appropriate technical and organisational measures to protect personal data against unauthorised access, alteration, disclosure, or destruction, including:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                🔒 End-to-end encryption in transit and at rest
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                🛡️ Role-based access controls &amp; least-privilege policies
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                👥 Staff confidentiality obligations and regular privacy training
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                💳 Engagement of PCI-DSS-compliant payment partners
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              We limit access to your personal data to those with a genuine business need to know it, and your personal data may only be processed on our instructions, subject to a duty of confidentiality.
            </p>
          </section>

          {/* Section 13 */}
          <section id="section-13" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                13
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Your Rights under the Data Protection Act, 2019
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              Please keep us informed if your personal data changes while you hold an account with us. Subject to applicable legal exceptions, you have the following rights:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs mb-5">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">1.</span>
                <span><strong>Right to be informed:</strong> of the use to which your personal data is to be put</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">2.</span>
                <span><strong>Right of access:</strong> to your personal data held by us</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">3.</span>
                <span><strong>Right to rectification:</strong> request correction of inaccurate or outdated data</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">4.</span>
                <span><strong>Right to erasure:</strong> request deletion of your personal data</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">5.</span>
                <span><strong>Right to restriction:</strong> request restriction of processing in certain circumstances</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">6.</span>
                <span><strong>Data portability:</strong> receive your data in a structured, commonly used format</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">7.</span>
                <span><strong>Right to object:</strong> object to legitimate interests processing or marketing</span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2">
                <span className="text-[#840037] font-bold">8.</span>
                <span><strong>Automated decision review:</strong> human review on significant automated decisions</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 sm:p-5 rounded-2xl text-xs sm:text-sm text-blue-950">
              <strong className="block font-bold mb-1 text-blue-900">
                Statutory 21-Day Response Commitment:
              </strong>
              <p className="leading-relaxed mb-2 text-blue-900/90">
                To exercise any of these rights, please contact us at <a href="mailto:Legal@nordic.com" className="font-bold underline">Legal@nordic.com</a>.
              </p>
              <p className="text-xs text-blue-800">
                We may need to verify your identity before processing your request, and we will respond within <strong>21 days</strong> of receipt (extendable by a further 21 days where reasonably necessary, with notice to you).
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section id="section-14" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                14
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Children&apos;s Privacy
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed">
              The Platform is not directed at, and must not be used by, individuals under 18 years of age. We do not knowingly collect personal data from minors. If we become aware that we have inadvertently collected personal data from a person under 18, we will take reasonable steps to delete that data without undue delay.
            </p>
          </section>

          {/* Section 15 */}
          <section id="section-15" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                15
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Call Centre, USSD, and Recorded Communications
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-3">
              Where you contact our customer care team by phone, WhatsApp, USSD, or live chat, we may collect your phone number, the content of your enquiry, and, where applicable, a recording or transcript of the call for quality assurance, staff training, and dispute resolution purposes.
            </p>
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 font-medium">
              📞 <strong>Call Recording Retention:</strong> Recorded calls are retained for 30 days unless required for longer to resolve an ongoing dispute or complaint.
            </div>
          </section>

          {/* Section 16 */}
          <section id="section-16" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                16
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Loyalty, Rewards, and Referral Programmes
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed">
              If you enroll in any loyalty, rewards, discount-voucher, or referral programme we may offer (for example, earning points on purchases or referring a friend for a discount code), we will collect additional information such as your points balance, redemption history, referral code usage, and the identity of referred users to the extent necessary to administer the programme and prevent abuse. Participation is optional, and you may withdraw at any time; withdrawal may result in forfeiture of unredeemed points or vouchers in accordance with the programme terms.
            </p>
          </section>

          {/* Section 17 */}
          <section id="section-17" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                17
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Changes to This Privacy Policy
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices, the Platform, or applicable law. We will post the updated version on the Platform with an updated revision date.
            </p>
          </section>

          {/* Section 19 */}
          <section id="section-19" className="scroll-mt-24 border-b border-gray-100 pb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                19
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Governing Law
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed">
              This Privacy Policy is governed by, and shall be construed in accordance with, the laws of the Republic of Kenya, including the <strong>Data Protection Act, 2019</strong>, and its subsidiary regulations. Any disputes arising in connection with this Policy shall be subject to the exclusive jurisdiction of the courts of Kenya.
            </p>
          </section>

          {/* Section 20 */}
          <section id="section-20" className="scroll-mt-24 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-xl bg-pink-100 text-[#840037] font-black text-sm flex items-center justify-center">
                20
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Related Practices and Information
              </h2>
            </div>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              This Privacy Policy should be read together with the following related store documents and policies:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/terms-conditions"
                className="group p-4 bg-gray-50 hover:bg-pink-50/50 border border-gray-200/80 hover:border-pink-200 rounded-2xl transition-all"
              >
                <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037] mb-1 flex items-center justify-between">
                  <span>Terms &amp; Conditions</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  User eligibility, ordering rules, liability, and payment terms.
                </p>
              </Link>

              <Link
                href="/ugc-policy"
                className="group p-4 bg-gray-50 hover:bg-pink-50/50 border border-gray-200/80 hover:border-pink-200 rounded-2xl transition-all"
              >
                <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037] mb-1 flex items-center justify-between">
                  <span>UGC Policy</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  User Generated Content licensing, photos, and social tagging.
                </p>
              </Link>

              <Link
                href="/refund-returns-policy"
                className="group p-4 bg-gray-50 hover:bg-pink-50/50 border border-gray-200/80 hover:border-pink-200 rounded-2xl transition-all"
              >
                <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037] mb-1 flex items-center justify-between">
                  <span>Refund &amp; Returns</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Order cancellation window, returns, damaged items, and refunds.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

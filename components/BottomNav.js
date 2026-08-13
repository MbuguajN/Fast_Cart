'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BottomNav({ cartCount, activeTab: activeTabProp, onOpenCart, onOpenAccount }) {
  const [activeTab, setActiveTab] = useState(activeTabProp || 'home');
  const router = useRouter();

  const tabs = [
    { id: 'home', label: 'Home', icon: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
    { id: 'orders', label: 'Orders', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z' },
    { id: 'account', label: 'Account', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
    { id: 'cart', label: 'Cart', icon: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' },
  ];

  const handleTabClick = (tabId) => {
    if (tabId === 'home') {
      setActiveTab('home');
      router.push('/');
    } else if (tabId === 'orders') {
      setActiveTab('orders');
      router.push('/orders');
    } else if (tabId === 'account') {
      if (onOpenAccount) {
        onOpenAccount();
      } else {
        setActiveTab('account');
      }
    } else if (tabId === 'cart') {
      if (onOpenCart) {
        onOpenCart();
      } else {
        setActiveTab('cart');
      }
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-[50] border-t border-gray-200 md:hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
      <div className="max-w-7xl mx-auto bg-white">
        <div className="flex justify-around items-center h-14 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="flex flex-col items-center justify-center gap-1 w-full transition-colors"
              style={{ color: activeTab === tab.id ? '#840037' : '#9ca3af' }}
            >
              <div className="relative">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d={tab.icon} />
                </svg>
                {tab.id === 'cart' && cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-[#840037] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span
                className="text-[10px]"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
              >
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

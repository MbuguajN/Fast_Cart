'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Products', href: '/admin/products', icon: '📦' },
  { label: 'Brands', href: '/admin/brands', icon: '🏷️' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5dc' }}>
      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b"
        style={{ backgroundColor: '#f5f5dc', borderColor: '#E9ECEF' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#F1F3F5' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="#191c1d" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <span
              className="text-sm font-bold"
              style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
            >
              LiquorDash
            </span>
            <span
              className="text-[10px] ml-2 px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: '#840037', color: '#ffffff', fontFamily: 'Montserrat, sans-serif' }}
            >
              ADMIN
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold underline"
          style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          View Store
        </Link>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-14 left-0 z-50 w-64 h-full border-r transition-transform"
        style={{
          backgroundColor: '#f5f5dc',
          borderColor: '#E9ECEF',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <nav className="p-4 space-y-1">
          {NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(132, 0, 55, 0.1)' : 'transparent',
                  color: isActive ? '#840037' : '#191c1d',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-14 pl-0 md:pl-64">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

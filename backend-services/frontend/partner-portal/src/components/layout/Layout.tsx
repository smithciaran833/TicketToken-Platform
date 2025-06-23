import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Branding', href: '/branding', icon: '🎨' },
    { name: 'Configuration', href: '/configuration', icon: '⚙️' },
    { name: 'Analytics', href: '/analytics', icon: '📈' },
    { name: 'Billing', href: '/billing', icon: '💳' },
    { name: 'Support', href: '/support', icon: '🎧' }
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-10">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">TicketToken</h1>
          <span className="ml-2 text-sm text-gray-500">Partner</span>
        </div>
        
        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="px-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account</p>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-gray-900 font-medium">Miami Tickets Co.</p>
                <p className="text-xs text-gray-500">Professional Plan</p>
                <p className="text-xs text-green-600">• Active</p>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => isActive(item.href))?.name || 'Partner Portal'}
              </h2>
              
              <div className="flex items-center space-x-4">
                <button className="text-gray-500 hover:text-gray-700">
                  🔔
                </button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">MT</span>
                  </div>
                  <span className="text-sm text-gray-700">John Doe</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main>
          {children}
        </main>
      </div>
    </div>
  );
}

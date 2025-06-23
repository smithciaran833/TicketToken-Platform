import Link from 'next/link';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Branding', href: '/branding', icon: '🎨' },
    { name: 'Configuration', href: '/configuration', icon: '⚙️' },
    { name: 'Analytics', href: '/analytics', icon: '📈' },
    { name: 'Billing', href: '/billing', icon: '💳' },
    { name: 'Support', href: '/support', icon: '🎧' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">TicketToken Partner Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Demo Partner</span>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                DP
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <div className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = router.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

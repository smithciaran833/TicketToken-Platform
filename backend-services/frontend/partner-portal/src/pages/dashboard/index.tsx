import React from 'react';
import Layout from '../../components/layout/Layout';

export default function Dashboard() {
  const stats = [
    { name: 'Total Events', value: '42', change: '+12%', trend: 'up' },
    { name: 'Tickets Sold', value: '1,234', change: '+23%', trend: 'up' },
    { name: 'Revenue', value: '$45,678', change: '+18%', trend: 'up' },
    { name: 'Active Users', value: '892', change: '+8%', trend: 'up' }
  ];

  const recentEvents = [
    { name: 'Summer Music Festival', date: 'July 15, 2025', tickets: 450, revenue: '$22,500', status: 'Active' },
    { name: 'Rock Concert Night', date: 'July 22, 2025', tickets: 320, revenue: '$16,000', status: 'Selling' },
    { name: 'Jazz Evening', date: 'July 28, 2025', tickets: 180, revenue: '$9,000', status: 'Draft' }
  ];

  const quickActions = [
    { name: 'Update Branding', icon: '🎨', description: 'Customize colors and logo', href: '/branding' },
    { name: 'View Analytics', icon: '📊', description: 'Check performance metrics', href: '/analytics' },
    { name: 'Platform Settings', icon: '⚙️', description: 'Configure your platform', href: '/configuration' },
    { name: 'Get Support', icon: '🎧', description: 'Contact our team', href: '/support' }
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, Miami Tickets! 👋</h1>
          <p className="text-gray-600">Here's what's happening with your white-label platform</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`flex items-center text-sm font-medium ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <span className="mr-1">
                    {stat.trend === 'up' ? '📈' : '📉'}
                  </span>
                  {stat.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Events */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentEvents.map((event, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div>
                      <h4 className="font-medium text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-600">{event.date}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        event.status === 'Active' ? 'bg-green-100 text-green-800' :
                        event.status === 'Selling' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{event.revenue}</p>
                      <p className="text-sm text-gray-600">{event.tickets} tickets</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium py-2 border border-blue-200 rounded-md hover:bg-blue-50">
                  View All Events →
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => window.location.href = action.href}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{action.icon}</div>
                      <div>
                        <h4 className="font-medium text-gray-900">{action.name}</h4>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Platform Health */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Platform Health</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🟢</div>
                <h4 className="font-medium text-gray-900">System Status</h4>
                <p className="text-sm text-green-600">All systems operational</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">⚡</div>
                <h4 className="font-medium text-gray-900">Performance</h4>
                <p className="text-sm text-gray-600">99.9% uptime this month</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🔒</div>
                <h4 className="font-medium text-gray-900">Security</h4>
                <p className="text-sm text-gray-600">SSL certificate valid</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

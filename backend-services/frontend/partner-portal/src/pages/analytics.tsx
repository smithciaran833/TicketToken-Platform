import Layout from '../components/Layout';

export default function Analytics() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics Dashboard</h1>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
            <p className="text-3xl font-bold text-green-600">$127,450</p>
            <p className="text-sm text-green-600">+12.5% from last month</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Tickets Sold</h3>
            <p className="text-3xl font-bold text-blue-600">8,342</p>
            <p className="text-sm text-blue-600">+8.3% from last month</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Events</h3>
            <p className="text-3xl font-bold text-purple-600">23</p>
            <p className="text-sm text-purple-600">+15.0% from last month</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Platform Fee</h3>
            <p className="text-3xl font-bold text-orange-600">$3,824</p>
            <p className="text-sm text-orange-600">+12.5% from last month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Revenue Trend</h2>
            <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
              <p className="text-gray-500">Revenue chart would go here</p>
            </div>
          </div>

          {/* Top Events */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Top Performing Events</h2>
            <div className="space-y-4">
              {[
                { name: 'Miami Music Festival', revenue: '$45,200', tickets: 1200 },
                { name: 'Electronic Nights', revenue: '$32,800', tickets: 850 },
                { name: 'Summer Vibes Concert', revenue: '$28,600', tickets: 720 },
                { name: 'Beach Party 2024', revenue: '$21,400', tickets: 550 }
              ].map((event, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-gray-500">{event.tickets} tickets sold</p>
                  </div>
                  <p className="font-bold text-green-600">{event.revenue}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

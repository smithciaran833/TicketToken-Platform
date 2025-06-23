import Layout from '../components/Layout';

export default function Configuration() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Platform Configuration</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Feature Toggles */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Feature Management</h2>
            <div className="space-y-4">
              {['Basic Ticketing', 'Secondary Market', 'NFT Collectibles', 'Analytics Dashboard', 'Mobile App'].map((feature) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-gray-700">{feature}</span>
                  <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
                    Enabled
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Pricing Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Platform Fee (%)</label>
                <input type="number" defaultValue="3" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Processing Fee (%)</label>
                <input type="number" defaultValue="2.9" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Maximum Resale Price (%)</label>
                <input type="number" defaultValue="200" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
            </div>
          </div>

          {/* Domain Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Domain Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Custom Domain</label>
                <input type="text" placeholder="your-domain.com" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subdomain</label>
                <input type="text" placeholder="yourcompany" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
                <p className="text-sm text-gray-500 mt-1">.tickettoken.io</p>
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                Save Domain Settings
              </button>
            </div>
          </div>

          {/* API Management Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">API Management</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Production API Key</label>
                <div className="flex mt-1">
                  <input type="password" defaultValue="tt_live_sk_abc123..." readOnly className="block w-full border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50" />
                  <button className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600">
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Test API Key</label>
                <div className="flex mt-1">
                  <input type="password" defaultValue="tt_test_sk_xyz789..." readOnly className="block w-full border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50" />
                  <button className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600">
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook Endpoint</label>
                <input type="url" placeholder="https://your-app.com/webhooks/tickettoken" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>
              <div className="flex space-x-2 mt-4">
                <button className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                  Download SDK
                </button>
                <button className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">
                  View Docs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

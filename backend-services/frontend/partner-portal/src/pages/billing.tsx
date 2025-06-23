import Layout from '../components/Layout';

export default function Billing() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Billing & Payments</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Plan */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Current Plan: Professional</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-blue-900">Professional Plan</h3>
                    <p className="text-blue-700">Advanced features for growing businesses</p>
                    <ul className="mt-2 text-sm text-blue-600">
                      <li>• Unlimited events</li>
                      <li>• Advanced analytics</li>
                      <li>• Custom branding</li>
                      <li>• Priority support</li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-900">$299</p>
                    <p className="text-blue-700">per month</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice History */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Invoice History</h2>
              <div className="space-y-3">
                {[
                  { date: '2024-01-01', amount: '$299.00', status: 'Paid', invoice: 'INV-2024-001' },
                  { date: '2023-12-01', amount: '$299.00', status: 'Paid', invoice: 'INV-2023-012' },
                  { date: '2023-11-01', amount: '$299.00', status: 'Paid', invoice: 'INV-2023-011' },
                  { date: '2023-10-01', amount: '$299.00', status: 'Paid', invoice: 'INV-2023-010' }
                ].map((invoice, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{invoice.invoice}</p>
                      <p className="text-sm text-gray-500">{invoice.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{invoice.amount}</p>
                      <span className="inline-flex px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        {invoice.status}
                      </span>
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">Download</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method & Usage */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
              <div className="border rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-5 bg-blue-600 rounded mr-2"></div>
                  <span className="font-medium">•••• •••• •••• 4242</span>
                </div>
                <p className="text-sm text-gray-500">Expires 12/25</p>
              </div>
              <button className="mt-4 w-full bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200">
                Update Payment Method
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Usage This Month</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>API Calls</span>
                    <span>8,342 / 50,000</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-blue-600 h-2 rounded-full" style={{width: '16.7%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Storage</span>
                    <span>2.3 GB / 10 GB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-green-600 h-2 rounded-full" style={{width: '23%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Bandwidth</span>
                    <span>45 GB / 100 GB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div className="bg-yellow-600 h-2 rounded-full" style={{width: '45%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

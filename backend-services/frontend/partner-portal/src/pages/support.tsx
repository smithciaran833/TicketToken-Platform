import Layout from '../components/Layout';

export default function Support() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Support Center</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Submit Ticket */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Submit Support Ticket</h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Brief description of your issue" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2">
                    <option>Technical Issue</option>
                    <option>Billing Question</option>
                    <option>Feature Request</option>
                    <option>General Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea rows={4} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Please describe your issue in detail..."></textarea>
                </div>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                  Submit Ticket
                </button>
              </form>
            </div>

            {/* Recent Tickets */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Tickets</h2>
              <div className="space-y-4">
                {[
                  { id: 'TT-001', subject: 'API Rate Limit Issue', status: 'Open', date: '2024-01-15', priority: 'High' },
                  { id: 'TT-002', subject: 'Custom Domain Setup', status: 'Resolved', date: '2024-01-10', priority: 'Medium' },
                  { id: 'TT-003', subject: 'Payment Processing Question', status: 'Resolved', date: '2024-01-05', priority: 'Low' }
                ].map((ticket, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{ticket.subject}</h3>
                        <p className="text-sm text-gray-500">#{ticket.id} • {ticket.date}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          ticket.status === 'Open' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {ticket.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{ticket.priority} Priority</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Live Chat Support
                </button>
                <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                  Schedule Call
                </button>
                <button className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700">
                  View Documentation
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Email Support</p>
                  <p className="text-gray-600">support@tickettoken.io</p>
                </div>
                <div>
                  <p className="font-medium">Phone Support</p>
                  <p className="text-gray-600">1-800-TICKETS</p>
                </div>
                <div>
                  <p className="font-medium">Business Hours</p>
                  <p className="text-gray-600">Mon-Fri 9AM-6PM EST</p>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">System Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>API Services</span>
                  <span className="text-green-600">●</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Processing</span>
                  <span className="text-green-600">●</span>
                </div>
                <div className="flex justify-between">
                  <span>Email Delivery</span>
                  <span className="text-green-600">●</span>
                </div>
                <div className="flex justify-between">
                  <span>Mobile Apps</span>
                  <span className="text-yellow-600">●</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

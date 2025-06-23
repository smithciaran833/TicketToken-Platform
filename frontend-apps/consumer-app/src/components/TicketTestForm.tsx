'use client';

import React, { useState } from 'react';

export default function TicketTestForm() {
  const [formData, setFormData] = useState({
    eventId: '',
    quantity: '1',
    tier: 'general',
    paymentMethod: 'card'
  });
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock API call for now
    setResult({
      success: true,
      message: 'Ticket purchase would be processed',
      data: {
        ...formData,
        totalPrice: parseInt(formData.quantity) * 50,
        ticketIds: Array.from({length: parseInt(formData.quantity)}, (_, i) => `ticket-${Date.now()}-${i}`)
      }
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Purchase Tickets (Test)</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Event ID</label>
          <input
            type="text"
            value={formData.eventId}
            onChange={(e) => setFormData({...formData, eventId: e.target.value})}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="event-123 (use any test ID)"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <select
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1 ticket</option>
              <option value="2">2 tickets</option>
              <option value="4">4 tickets</option>
              <option value="6">6 tickets</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tier</label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({...formData, tier: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General ($50)</option>
              <option value="premium">Premium ($75)</option>
              <option value="vip">VIP ($100)</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Payment Method</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="card">Credit Card</option>
            <option value="crypto">Crypto Wallet</option>
          </select>
        </div>
        
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
        >
          Test Purchase
        </button>
      </form>
      
      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

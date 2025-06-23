'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';

export default function EventTestForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    city: '',
    date: '',
    time: '',
    price: '',
    capacity: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    
    try {
      // Try real API call first
      const response = await api.events.create({
        ...formData,
        price: parseFloat(formData.price),
        capacity: parseInt(formData.capacity)
      });
      
      setResult(response);
      
      if (response.success) {
        // Reset form on success
        setFormData({
          title: '',
          description: '',
          venue: '',
          city: '',
          date: '',
          time: '',
          price: '',
          capacity: ''
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to connect to backend'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Create Event</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Concert, Game, Show..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Venue *</label>
            <input
              type="text"
              required
              value={formData.venue}
              onChange={(e) => setFormData({...formData, venue: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Madison Square Garden"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Event details..."
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">City *</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="New York, NY"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Time *</label>
            <input
              type="time"
              required
              value={formData.time}
              onChange={(e) => setFormData({...formData, time: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ticket Price ($) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="50.00"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Capacity *</label>
            <input
              type="number"
              min="1"
              required
              value={formData.capacity}
              onChange={(e) => setFormData({...formData, capacity: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="1000"
            />
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Event...' : 'Create Event'}
        </button>
      </form>
      
      {/* API Response */}
      {result && (
        <div className={`mt-6 p-4 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <h4 className={`font-medium mb-2 ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            API Response:
          </h4>
          <pre className={`text-sm overflow-auto ${
            result.success ? 'text-green-700' : 'text-red-700'
          }`}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

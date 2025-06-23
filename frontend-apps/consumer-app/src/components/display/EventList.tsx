'use client';

import React, { useState, useEffect } from 'react';
import { eventAPI } from '@/lib/api';
import { Event } from '@/types';

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await eventAPI.list();
      setEvents(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Events (API Test)</h2>
        <button
          onClick={fetchEvents}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded mb-6">
          Error: {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No events found. Create some events to test the API.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white border rounded-lg p-6 shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
                  <p className="text-gray-600 mb-2">{event.description}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                    <div><strong>Venue:</strong> {event.venue}</div>
                    <div><strong>City:</strong> {event.city}</div>
                    <div><strong>Date:</strong> {event.date}</div>
                    <div><strong>Time:</strong> {event.time}</div>
                    <div><strong>Category:</strong> {event.category}</div>
                    <div><strong>Price:</strong> ${event.price}</div>
                    <div><strong>Capacity:</strong> {event.capacity}</div>
                    <div><strong>Sold:</strong> {event.ticketsSold || 0}</div>
                  </div>
                </div>
                <div className="ml-4">
                  <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mb-2 w-full">
                    Buy Tickets
                  </button>
                  <div className="text-sm text-gray-500">
                    ID: {event.id}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

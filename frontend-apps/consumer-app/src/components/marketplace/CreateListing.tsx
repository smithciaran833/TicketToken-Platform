'use client';

import React, { useState } from 'react';

export default function CreateListing() {
  const [ticketId, setTicketId] = useState('');
  const [price, setPrice] = useState('');

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Create Listing</h2>
      <form>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Ticket ID
          </label>
          <input
            type="text"
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            className="w-full p-2 border rounded-md"
            placeholder="Enter ticket ID"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Price ($)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-2 border rounded-md"
            placeholder="Enter price"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        >
          Create Listing
        </button>
      </form>
    </div>
  );
}

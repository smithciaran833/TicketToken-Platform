'use client';

import React, { useState } from 'react';

interface QRDisplayProps {
  ticketId: string;
  qrCode: string;
  eventTitle: string;
  venue: string;
  date: string;
  time: string;
}

export default function QRDisplay({ ticketId, qrCode, eventTitle, venue, date, time }: QRDisplayProps) {
  const [isValidated, setIsValidated] = useState(false);

  const handleValidate = () => {
    // Mock validation
    setIsValidated(true);
    console.log('Ticket validated:', ticketId);
  };

  return (
    <div className="max-w-sm mx-auto bg-white border rounded-lg p-6 shadow">
      <div className="text-center">
        <h3 className="font-bold text-lg mb-2">{eventTitle}</h3>
        <p className="text-gray-600 text-sm mb-4">{venue}</p>
        <p className="text-gray-600 text-sm mb-6">{date} at {time}</p>
        
        {/* Mock QR Code */}
        <div className="bg-gray-100 border-2 border-dashed border-gray-300 h-48 flex items-center justify-center mb-4">
          <div className="text-center">
            <div className="text-4xl mb-2">⬜</div>
            <div className="text-xs text-gray-500">QR CODE</div>
            <div className="text-xs text-gray-500">{qrCode}</div>
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Ticket ID: {ticketId}
        </div>

        <button
          onClick={handleValidate}
          disabled={isValidated}
          className={`w-full py-2 px-4 rounded ${
            isValidated 
              ? 'bg-green-600 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isValidated ? '✓ Validated' : 'Validate Ticket'}
        </button>

        {isValidated && (
          <div className="mt-4 p-2 bg-green-100 text-green-800 rounded text-sm">
            Ticket successfully validated for entry
          </div>
        )}
      </div>
    </div>
  );
}

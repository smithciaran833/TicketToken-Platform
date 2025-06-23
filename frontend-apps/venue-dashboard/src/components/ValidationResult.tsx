'use client';

import React from 'react';
import { CheckCircle, XCircle, User, Calendar, MapPin, Ticket } from 'lucide-react';

interface ValidationResultProps {
  result: {
    isValid: boolean;
    ticketId?: string;
    eventId?: string;
    userId?: string;
    error?: string;
    metadata?: {
      scannedAt: Date;
      gateId: string;
      staffId: string;
      ticketInfo?: {
        tier: string;
        seatNumber?: string;
        holderName?: string;
        eventTitle?: string;
        eventDate?: string;
        venue?: string;
      };
    };
  } | null;
  onContinue: () => void;
}

export default function ValidationResult({ result, onContinue }: ValidationResultProps) {
  if (!result) {
    return null;
  }

  const { isValid, ticketId, error, metadata } = result;
  const ticketInfo = metadata?.ticketInfo;

  return (
    <div className={`p-6 rounded-lg border-2 ${
      isValid 
        ? 'bg-green-50 border-green-200' 
        : 'bg-red-50 border-red-200'
    }`}>
      {/* Status Header */}
      <div className="flex items-center mb-4">
        {isValid ? (
          <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
        ) : (
          <XCircle className="h-8 w-8 text-red-600 mr-3" />
        )}
        
        <div>
          <h3 className={`text-lg font-semibold ${
            isValid ? 'text-green-800' : 'text-red-800'
          }`}>
            {isValid ? 'Entry Approved' : 'Entry Denied'}
          </h3>
          <p className={`text-sm ${
            isValid ? 'text-green-600' : 'text-red-600'
          }`}>
            {isValid ? 'Ticket is valid' : error || 'Invalid ticket'}
          </p>
        </div>
      </div>

      {/* Ticket Information */}
      {isValid && ticketInfo && (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center text-sm">
              <Ticket className="h-4 w-4 mr-2 text-gray-500" />
              <span className="font-medium">Ticket:</span>
              <span className="ml-1">{ticketInfo.tier}</span>
              {ticketInfo.seatNumber && (
                <span className="ml-1">- Seat {ticketInfo.seatNumber}</span>
              )}
            </div>
            
            {ticketInfo.holderName && (
              <div className="flex items-center text-sm">
                <User className="h-4 w-4 mr-2 text-gray-500" />
                <span className="font-medium">Holder:</span>
                <span className="ml-1">{ticketInfo.holderName}</span>
              </div>
            )}
            
            {ticketInfo.eventTitle && (
              <div className="flex items-center text-sm">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                <span className="font-medium">Event:</span>
                <span className="ml-1">{ticketInfo.eventTitle}</span>
              </div>
            )}
            
            {ticketInfo.venue && (
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                <span className="font-medium">Venue:</span>
                <span className="ml-1">{ticketInfo.venue}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ticket ID */}
      {ticketId && (
        <div className="text-xs text-gray-500 mb-4 font-mono bg-gray-100 p-2 rounded">
          Ticket ID: {ticketId.substring(0, 16)}...
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="text-xs text-gray-500 border-t pt-2 mb-4">
          <div>Gate: {metadata.gateId}</div>
          <div>Staff: {metadata.staffId}</div>
          <div>Scanned: {metadata.scannedAt.toLocaleTimeString()}</div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onContinue}
        className={`w-full py-3 px-4 rounded font-medium ${
          isValid
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {isValid ? 'Allow Entry' : 'Next Scan'}
      </button>
    </div>
  );
}

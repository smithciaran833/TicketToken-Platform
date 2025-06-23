'use client';

import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import ValidationResult from '@/components/ValidationResult';

export default function ManualEntryPage() {
  const [ticketCode, setTicketCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCode.trim()) return;

    setIsValidating(true);
    
    // Mock validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const isValid = Math.random() > 0.4;
    
    setValidationResult({
      isValid,
      ticketId: ticketCode,
      eventId: 'event-123',
      userId: 'user-456',
      error: isValid ? undefined : 'Invalid ticket code',
      metadata: isValid ? {
        scannedAt: new Date(),
        gateId: 'Gate A',
        staffId: 'staff-001',
        ticketInfo: {
          tier: 'General Admission',
          holderName: 'Manual Entry',
          eventTitle: 'Summer Music Festival',
          eventDate: 'July 15, 2024 - 8:00 PM',
          venue: 'Central Park'
        }
      } : undefined
    });
    
    setIsValidating(false);
  };

  const handleReset = () => {
    setTicketCode('');
    setValidationResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center">
          <Link href="/" className="mr-4">
            <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Manual Entry</h1>
            <p className="text-sm text-gray-600">Enter ticket codes manually</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="space-y-6">
          {/* Manual Entry Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Enter Ticket Code</h2>
            
            <form onSubmit={handleValidate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ticket Code / ID
                </label>
                <input
                  type="text"
                  value={ticketCode}
                  onChange={(e) => setTicketCode(e.target.value)}
                  placeholder="Enter ticket code manually..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isValidating}
                />
              </div>
              
              <button
                type="submit"
                disabled={!ticketCode.trim() || isValidating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center"
              >
                {isValidating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Validating...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Validate Ticket
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <ValidationResult
              result={validationResult}
              onContinue={handleReset}
            />
          )}

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Manual Entry Guide</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Use this when QR codes are damaged or unreadable</li>
              <li>• Enter the full ticket ID or reference number</li>
              <li>• Codes are case-sensitive</li>
              <li>• Contact support if validation fails repeatedly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

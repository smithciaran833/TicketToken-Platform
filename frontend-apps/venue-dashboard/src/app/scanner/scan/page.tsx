'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Settings, Volume2, VolumeX, QrCode } from 'lucide-react';
import Link from 'next/link';
import QRScanner from '@/components/QRScanner';
import ValidationResult from '@/components/ValidationResult';
import OfflineSync from '@/components/OfflineSync';

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [scanCount, setScanCount] = useState(0);

  // Mock validation function
  const validateTicket = async (qrData: string): Promise<any> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock validation logic
    const isValid = Math.random() > 0.3; // 70% success rate for demo
    
    if (isValid) {
      return {
        isValid: true,
        ticketId: `ticket-${Date.now()}`,
        eventId: 'event-123',
        userId: 'user-456',
        metadata: {
          scannedAt: new Date(),
          gateId: 'Gate A',
          staffId: 'staff-001',
          ticketInfo: {
            tier: ['General Admission', 'Premium', 'VIP'][Math.floor(Math.random() * 3)],
            seatNumber: Math.random() > 0.5 ? `${Math.floor(Math.random() * 20) + 1}A` : undefined,
            holderName: ['John Doe', 'Jane Smith', 'Mike Johnson'][Math.floor(Math.random() * 3)],
            eventTitle: 'Summer Music Festival',
            eventDate: 'July 15, 2024 - 8:00 PM',
            venue: 'Central Park'
          }
        }
      };
    } else {
      const errors = [
        'Ticket already used',
        'Invalid QR code',
        'Ticket expired',
        'Wrong event'
      ];
      return {
        isValid: false,
        ticketId: `ticket-${Date.now()}`,
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }
  };

  const handleScan = async (data: string) => {
    if (!isScanning) return;

    setIsScanning(false);
    
    try {
      const result = await validateTicket(data);
      setScanResult(result);
      setScanCount(prev => prev + 1);
      
      // Play sound feedback
      if (soundEnabled) {
        console.log(`Playing ${result.isValid ? 'success' : 'error'} sound`);
      }

      // If offline, add to pending sync
      if (!isOnline) {
        setPendingSync(prev => prev + 1);
      }
    } catch (error) {
      setScanResult({
        isValid: false,
        error: 'Scan processing failed'
      });
    }
  };

  const handleError = (error: string) => {
    console.error('Scanner error:', error);
  };

  const handleContinue = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const handleSync = async () => {
    // Mock sync operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    setPendingSync(0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">QR Scanner</h1>
              <p className="text-sm text-gray-600">Gate A • Scanned: {scanCount}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Section */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Scan QR Code</h2>
              
              <QRScanner
                onScan={handleScan}
                onError={handleError}
                isActive={isScanning}
              />

              {!isScanning && !scanResult && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setIsScanning(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded flex items-center mx-auto"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resume Scanning
                  </button>
                </div>
              )}
            </div>

            {/* Offline Sync Status */}
            <OfflineSync
              isOnline={isOnline}
              pendingCount={pendingSync}
              onSync={handleSync}
            />
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {scanResult ? (
              <ValidationResult
                result={scanResult}
                onContinue={handleContinue}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-gray-400 mb-4">
                  <QrCode className="h-16 w-16 mx-auto mb-4" />
                  <p>Point camera at QR code to scan</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-green-600">✓ Valid</div>
                    <div className="text-gray-500">Allow entry</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600">✗ Invalid</div>
                    <div className="text-gray-500">Deny entry</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Session Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Scans:</span>
                  <span>{scanCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valid:</span>
                  <span className="text-green-600">{Math.floor(scanCount * 0.7)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invalid:</span>
                  <span className="text-red-600">{scanCount - Math.floor(scanCount * 0.7)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

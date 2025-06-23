'use client';

import React, { useState } from 'react';
import { Camera, Zap, AlertCircle, RotateCcw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError: (error: string) => void;
  isActive: boolean;
}

export default function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Simulate camera scanning
  const simulateScan = () => {
    if (!isActive || isScanning) return;
    
    setIsScanning(true);
    
    // Simulate scan delay
    setTimeout(() => {
      const mockQRData = JSON.stringify({
        ticketId: `ticket-${Date.now()}`,
        eventId: 'event-123',
        userId: 'user-456',
        timestamp: Date.now(),
        signature: 'mock-signature'
      });
      
      onScan(mockQRData);
      setIsScanning(false);
    }, 1500);
  };

  if (!hasCamera) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <p className="text-red-700 mb-4">Camera access denied</p>
          <button
            onClick={() => setHasCamera(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-lg bg-gray-800 h-64">
        {/* Mock camera view */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-white">
            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm opacity-75">Point camera at QR code</p>
          </div>
        </div>
        
        {/* Scanning overlay */}
        <div className="absolute inset-0 border-2 border-primary-500 rounded-lg">
          <div className="absolute inset-4 border border-white/50 rounded">
            {/* Corner indicators */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary-400"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary-400"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary-400"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary-400"></div>
          </div>
        </div>

        {/* Scanning indicator */}
        {isScanning && (
          <div className="absolute top-4 right-4 flex items-center bg-primary-600 text-white px-2 py-1 rounded text-sm">
            <Zap className="h-3 w-3 mr-1 animate-pulse" />
            Scanning...
          </div>
        )}
      </div>

      {/* Manual scan button for demo */}
      <div className="mt-4 text-center">
        <button
          onClick={simulateScan}
          disabled={!isActive || isScanning}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded flex items-center mx-auto"
        >
          {isScanning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Scanning...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Simulate Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
}

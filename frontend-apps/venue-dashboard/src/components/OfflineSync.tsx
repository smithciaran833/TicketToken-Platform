'use client';

import React, { useState } from 'react';
import { Wifi, WifiOff, Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface OfflineSyncProps {
  isOnline: boolean;
  pendingCount: number;
  onSync: () => Promise<void>;
}

export default function OfflineSync({ isOnline, pendingCount, onSync }: OfflineSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      await onSync();
      setLastSync(new Date());
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${
      isOnline 
        ? 'bg-green-50 border-green-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600 mr-2" />
          ) : (
            <WifiOff className="h-5 w-5 text-yellow-600 mr-2" />
          )}
          <span className={`font-medium ${
            isOnline ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isOnline ? 'Online' : 'Offline Mode'}
          </span>
        </div>

        {/* Pending Count */}
        {pendingCount > 0 && (
          <div className={`px-2 py-1 rounded text-sm font-medium ${
            isOnline 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className="space-y-2">
        {/* Last Sync */}
        {lastSync && (
          <div className="flex items-center text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
            Last sync: {lastSync.toLocaleTimeString()}
          </div>
        )}

        {/* Sync Error */}
        {syncError && (
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            {syncError}
          </div>
        )}

        {/* Syncing Status */}
        {isSyncing && (
          <div className="flex items-center text-sm text-blue-600">
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Syncing data...
          </div>
        )}

        {/* Offline Instructions */}
        {!isOnline && (
          <div className="text-sm text-yellow-700">
            <p>Working offline. Scans will be synced when connection is restored.</p>
          </div>
        )}
      </div>

      {/* Manual Sync Button */}
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded flex items-center justify-center"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isSyncing ? 'Syncing...' : `Sync ${pendingCount} items`}
        </button>
      )}
    </div>
  );
}

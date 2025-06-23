'use client';

import React, { useState } from 'react';
import { QrCode, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function ScannerHome() {
  const [stats] = useState({
    scannedToday: 127,
    validScans: 119,
    invalidScans: 8,
    currentGate: 'Gate A',
    eventName: 'Summer Music Festival 2024',
    capacity: 5000,
    currentAttendance: 2847
  });

  const [recentScans] = useState([
    {
      id: '1',
      time: '14:32',
      status: 'valid',
      ticketType: 'VIP',
      gateId: 'Gate A'
    },
    {
      id: '2', 
      time: '14:31',
      status: 'invalid',
      error: 'Already used',
      gateId: 'Gate A'
    },
    {
      id: '3',
      time: '14:30',
      status: 'valid',
      ticketType: 'General',
      gateId: 'Gate A'
    },
    {
      id: '4',
      time: '14:29',
      status: 'valid',
      ticketType: 'Premium',
      gateId: 'Gate A'
    }
  ]);

  const validationRate = stats.scannedToday > 0 
    ? ((stats.validScans / stats.scannedToday) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Scanner Dashboard</h1>
          <div className="flex items-center text-gray-600">
            <span>{stats.eventName}</span>
            <span className="mx-2">•</span>
            <span>{stats.currentGate}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link 
            href="/scanner/scan"
            className="bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg flex items-center justify-between transition-colors"
          >
            <div>
              <h3 className="text-xl font-semibold mb-2">Start Scanning</h3>
              <p className="text-blue-100">Scan QR codes for entry validation</p>
            </div>
            <QrCode className="h-8 w-8" />
          </Link>

          <Link 
            href="/scanner/manual"
            className="bg-gray-600 hover:bg-gray-700 text-white p-6 rounded-lg flex items-center justify-between transition-colors"
          >
            <div>
              <h3 className="text-xl font-semibold mb-2">Manual Entry</h3>
              <p className="text-gray-100">Enter ticket codes manually</p>
            </div>
            <Users className="h-8 w-8" />
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scanned Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.scannedToday}</p>
              </div>
              <QrCode className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valid Rate</p>
                <p className="text-2xl font-bold text-green-600">{validationRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Attendance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.currentAttendance.toLocaleString()}/{stats.capacity.toLocaleString()}
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Invalid Scans</p>
                <p className="text-2xl font-bold text-red-600">{stats.invalidScans}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Scans</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentScans.map((scan) => (
              <div key={scan.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    scan.status === 'valid' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {scan.status === 'valid' ? scan.ticketType : 'Invalid Scan'}
                    </p>
                    {scan.status === 'invalid' && scan.error && (
                      <p className="text-sm text-red-600">{scan.error}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{scan.time}</p>
                  <p className="text-xs text-gray-400">{scan.gateId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

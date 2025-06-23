'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import EventTestForm from '@/components/EventTestForm';
import AuthTestForm from '@/components/AuthTestForm';
import TicketTestForm from '@/components/TicketTestForm';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('events');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const testConnection = async () => {
    setIsTestingConnection(true);
    
    try {
      const result = await api.health();
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('disconnected');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const tabs = [
    { id: 'events', label: 'Events', component: EventTestForm },
    { id: 'auth', label: 'Authentication', component: AuthTestForm },
    { id: 'tickets', label: 'Tickets', component: TicketTestForm },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || EventTestForm;

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          TicketToken API Testing Dashboard
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* System Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">System Status</h2>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm">Frontend: Running</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 ${getStatusColor()} rounded-full mr-3`}></div>
                <span className="text-sm">Backend: {getStatusText()}</span>
              </div>
            </div>
          </div>

          {/* API Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">API Configuration</h3>
            <p className="text-gray-600 text-sm mb-4">
              Backend: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
            </p>
            <button 
              onClick={testConnection}
              disabled={isTestingConnection}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div>Events Created: 0</div>
              <div>Users Registered: 0</div>
              <div>Tickets Sold: 0</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            <ActiveComponent />
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Development Notes</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• Forms will attempt real API calls when backend is running</li>
            <li>• Falls back to mock responses if backend is unavailable</li>
            <li>• Update API_BASE_URL in src/lib/api.ts for different backend URLs</li>
            <li>• Test connection above to verify backend status</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';

export default function AuthTestForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mock API call for now
    setResult({
      success: true,
      message: `${mode} would be processed`,
      data: formData
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex mb-4">
        <button
          onClick={() => setMode('login')}
          className={`px-4 py-2 rounded-l ${mode === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Login Test
        </button>
        <button
          onClick={() => setMode('register')}
          className={`px-4 py-2 rounded-r ${mode === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Register Test
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Password"
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
        >
          {mode === 'login' ? 'Test Login' : 'Test Register'}
        </button>
      </form>
      
      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

use client;
import React from 'react';
import Link from 'next/link';
import { Wallet, Shield, Zap, ArrowLeft } from 'lucide-react';

export default function WalletConnectPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/auth/login" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to login
        </Link>
        
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <Wallet className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-gray-600">
            Connect your Phantom wallet to get started with crypto payments
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Wallet Benefits */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center">
              <div className="bg-success-100 p-2 rounded-full mr-3">
                <Shield className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <div className="font-medium">Secure & Safe</div>
                <div className="text-sm text-gray-500">Your wallet, your keys</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="bg-primary-100 p-2 rounded-full mr-3">
                <Zap className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <div className="font-medium">Instant Payments</div>
                <div className="text-sm text-gray-500">Pay with SOL or USDC</div>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="bg-warning-100 p-2 rounded-full mr-3">
                <Wallet className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <div className="font-medium">Own Your Tickets</div>
                <div className="text-sm text-gray-500">True ownership on blockchain</div>
              </div>
            </div>
          </div>

          {/* Connect Button */}
          <button
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Connect Phantom Wallet
          </button>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Don't have Phantom?{' '}
              <a 
                href="https://phantom.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-500"
              >
                Download here
              </a>
            </p>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or use email instead</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/auth/login"
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

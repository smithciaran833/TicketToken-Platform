'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Shield, Clock, CreditCard, Smartphone, Lock } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;
  
  const tier = searchParams.get('tier');
  const quantity = parseInt(searchParams.get('quantity') || '1');

  const [event] = useState({
    title: 'Summer Music Festival 2024',
    date: 'July 15, 2024',
    time: '8:00 PM',
    venue: 'Central Park'
  });

  const [tierData] = useState({
    general: { name: 'General Admission', price: 75 },
    premium: { name: 'Premium Seating', price: 150 },
    vip: { name: 'VIP Experience', price: 300 }
  });

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes
  const [formData, setFormData] = useState({
    email: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  const selectedTier = tier ? tierData[tier as keyof typeof tierData] : null;
  const subtotal = selectedTier ? selectedTier.price * quantity : 0;
  const total = subtotal; // No fees!

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          router.push(`/events/${id}/purchase`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [id, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Redirect to confirmation
      router.push(`/events/${id}/confirmation?orderId=ORDER-${Date.now()}`);
    } catch (error) {
      console.error('Payment failed:', error);
      setIsProcessing(false);
    }
  };

  if (!selectedTier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Selection</h2>
          <Link href={`/events/${id}/purchase`} className="text-blue-600 hover:text-blue-700">
            Return to ticket selection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href={`/events/${id}/purchase`} className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Secure Checkout</h1>
                <p className="text-sm text-gray-600">Complete your purchase</p>
              </div>
            </div>
            
            {/* Timer */}
            <div className="flex items-center bg-orange-100 text-orange-800 px-4 py-2 rounded-lg">
              <Clock className="h-4 w-4 mr-2" />
              <span className="font-bold">Time remaining: {formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Order Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Event:</span>
                  <span className="font-medium">{event.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tickets:</span>
                  <span className="font-medium">{quantity} × {selectedTier.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Service Fee:</span>
                  <span className="font-medium text-green-600">FREE!</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Choose Payment Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-6 border-2 rounded-xl flex items-center space-x-4 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard className="h-8 w-8 text-gray-600" />
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Credit/Debit Card</div>
                    <div className="text-sm text-gray-500">Instant confirmation</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto')}
                  className={`p-6 border-2 rounded-xl flex items-center space-x-4 transition-all ${
                    paymentMethod === 'crypto'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Smartphone className="h-8 w-8 text-gray-600" />
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Crypto Wallet</div>
                    <div className="text-sm text-gray-500">Lower fees</div>
                  </div>
                </button>
              </div>

              {/* Payment Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {paymentMethod === 'card' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => setFormData({...formData, cardNumber: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="1234 5678 9012 3456"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
                        <input
                          type="text"
                          value={formData.expiry}
                          onChange={(e) => setFormData({...formData, expiry: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="MM/YY"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                        <input
                          type="text"
                          value={formData.cvv}
                          onChange={(e) => setFormData({...formData, cvv: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="123"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Smartphone className="h-16 w-16 mx-auto text-purple-600 mb-4" />
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Connect Your Wallet</h4>
                    <p className="text-gray-600 mb-6">Pay with SOL or USDC</p>
                    <button
                      type="button"
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg"
                    >
                      Connect Phantom Wallet
                    </button>
                  </div>
                )}

                {/* Security Notice */}
                <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div className="text-sm text-green-800">
                    <span className="font-medium">Secure Payment:</span> Your information is encrypted and protected
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="h-5 w-5 mr-2" />
                      Complete Purchase - ${total.toFixed(2)}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-lg sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{event.title}</h3>
              <div className="space-y-2 text-sm text-gray-600 mb-6">
                <div>{event.date} at {event.time}</div>
                <div>{event.venue}</div>
                <div>{selectedTier.name} × {quantity}</div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

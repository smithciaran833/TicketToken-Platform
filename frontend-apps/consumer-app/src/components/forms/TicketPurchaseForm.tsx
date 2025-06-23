'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ticketAPI, paymentAPI } from '@/lib/api';

interface PurchaseFormData {
  eventId: string;
  quantity: number;
  tier: string;
  paymentMethod: 'card' | 'crypto';
}

export default function TicketPurchaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PurchaseFormData>();

  const onSubmit = async (data: PurchaseFormData) => {
    setIsSubmitting(true);
    setResult(null);
    
    try {
      // First create payment intent
      const paymentResponse = await paymentAPI.createPaymentIntent({
        amount: data.quantity * 50, // Mock price calculation
        currency: 'USD',
        eventId: data.eventId,
        quantity: data.quantity,
      });

      // Then mint tickets
      const ticketResponse = await ticketAPI.mint({
        eventId: data.eventId,
        quantity: data.quantity,
        tier: data.tier,
        paymentIntentId: paymentResponse.data.id,
      });

      setResult({ 
        success: true, 
        data: { 
          payment: paymentResponse.data, 
          tickets: ticketResponse.data 
        } 
      });
      reset();
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data || error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Purchase Tickets (API Test)</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Event ID</label>
          <input
            {...register('eventId', { required: 'Event ID is required' })}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Copy event ID from event list"
          />
          {errors.eventId && <p className="text-red-500 text-sm">{errors.eventId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <select
              {...register('quantity', { required: 'Quantity is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="1">1 ticket</option>
              <option value="2">2 tickets</option>
              <option value="4">4 tickets</option>
              <option value="6">6 tickets</option>
              <option value="8">8 tickets</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ticket Tier</label>
            <select
              {...register('tier', { required: 'Tier is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="general">General Admission</option>
              <option value="premium">Premium</option>
              <option value="vip">VIP</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Payment Method</label>
          <select
            {...register('paymentMethod', { required: 'Payment method is required' })}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            <option value="card">Credit Card</option>
            <option value="crypto">Crypto Wallet</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Processing Purchase...' : 'Buy Tickets'}
        </button>
      </form>

      {/* API Response Display */}
      {result && (
        <div className={`mt-6 p-4 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <h3 className="font-bold">API Response:</h3>
          <pre className="text-sm mt-2 overflow-auto max-h-64">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

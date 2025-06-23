'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, Download, Calendar, Mail, QrCode, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { id } = params;
  const orderId = searchParams.get('orderId');

  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after animation
    const timer = setTimeout(() => setConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const [order] = useState({
    id: orderId || 'ORDER-123456',
    event: {
      title: 'Summer Music Festival 2024',
      date: 'July 15, 2024',
      time: '8:00 PM',
      venue: 'Central Park'
    },
    tickets: [
      {
        id: 'TICKET-001',
        type: 'General Admission',
        qrCode: 'QR123456789'
      }
    ],
    total: 75,
    email: 'your@email.com'
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 relative overflow-hidden">
      {/* Confetti Animation */}
      {confetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">
            🎉 You're Going! 🎉
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Your tickets have been confirmed and sent to your email
          </p>
          <div className="bg-white rounded-xl p-4 shadow-lg inline-block">
            <p className="text-sm text-gray-500">Order Number</p>
            <p className="text-lg font-bold text-gray-900">{order.id}</p>
          </div>
        </div>

        {/* Event Summary */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{order.event.title}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">{order.event.date}</p>
              <p className="text-gray-600">{order.event.time}</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <QrCode className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Your Tickets</p>
              <p className="text-gray-600">{order.tickets.length} ticket(s)</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <Mail className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Email Sent</p>
              <p className="text-gray-600">Check your inbox</p>
            </div>
          </div>

          {/* Tickets */}
          <div className="space-y-4 mb-8">
            <h3 className="text-lg font-bold text-gray-900">Your Tickets</h3>
            {order.tickets.map((ticket, index) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">{ticket.type}</p>
                  <p className="text-sm text-gray-600">Ticket #{index + 1}</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center mb-2">
                    <QrCode className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-500">{ticket.qrCode}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              <Download className="h-5 w-5 mr-2" />
              Download Tickets
            </button>
            
            <button className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
              <Calendar className="h-5 w-5 mr-2" />
              Add to Calendar
            </button>
            
            <button className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors">
              <Mail className="h-5 w-5 mr-2" />
              Email Tickets
            </button>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">What's Next?</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">1</div>
              <span>Check your email for ticket confirmation</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</div>
              <span>Add the event to your calendar</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">3</div>
              <span>Arrive 30 minutes early for entry</span>
            </div>
          </div>
        </div>

        {/* Browse More Events */}
        <div className="text-center">
          <Link 
            href="/"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
          >
            Browse More Events
            <ArrowRight className="h-5 w-5 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}

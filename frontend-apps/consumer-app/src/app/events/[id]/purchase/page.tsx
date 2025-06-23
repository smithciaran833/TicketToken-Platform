'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';
import TierSelector from '@/components/purchase/TierSelector';

export default function PurchasePage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  
  const [event] = useState({
    id: 'event-123',
    title: 'Summer Music Festival 2024',
    artist: 'The Weeknd, Dua Lipa, Travis Scott',
    venue: 'Central Park',
    date: 'July 15, 2024',
    time: '8:00 PM'
  });

  const [tiers] = useState([
    {
      id: 'general',
      name: 'General Admission',
      price: 75,
      originalPrice: 85,
      description: 'Standing room access to the main event area',
      features: [
        'Access to main event area',
        'Food & beverage vendors',
        'Merchandise booths',
        'Portable restrooms',
        'Free event program'
      ],
      available: 1250,
      total: 2000,
      icon: 'general' as const,
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium Seating',
      price: 150,
      description: 'Reserved seating with elevated views',
      features: [
        'Reserved seating',
        'Elevated viewing area',
        'Complimentary welcome drink',
        'Express entry lane',
        'Private restrooms'
      ],
      available: 180,
      total: 300,
      icon: 'premium' as const
    },
    {
      id: 'vip',
      name: 'VIP Experience',
      price: 300,
      description: 'Ultimate VIP experience with exclusive perks',
      features: [
        'Front row reserved seating',
        'Meet & greet with artists',
        'VIP lounge access',
        'Premium bar & catering',
        'Exclusive merchandise',
        'Valet parking'
      ],
      available: 15,
      total: 50,
      icon: 'vip' as const
    }
  ]);

  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const handleTierSelect = (tier: any) => {
    setSelectedTier(tier.id);
    // Go directly to checkout for now
    router.push(`/events/${id}/checkout?tier=${tier.id}&quantity=1`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 transition-colors" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
                <div className="flex items-center text-sm text-gray-600 space-x-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {event.date} at {event.time}
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {event.venue}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TierSelector
          tiers={tiers}
          selectedTier={selectedTier}
          onTierSelect={handleTierSelect}
        />

        {/* Event Details */}
        <div className="mt-12 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">About This Event</h3>
          <p className="text-gray-700 mb-4">
            Join us for an unforgettable evening of music under the stars with the biggest names in music today. 
            This outdoor festival features multiple stages, amazing food vendors, and an incredible atmosphere.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Genre:</span> Pop, Hip-Hop, Electronic
            </div>
            <div>
              <span className="font-medium">Duration:</span> 6 hours
            </div>
            <div>
              <span className="font-medium">Age:</span> All ages welcome
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

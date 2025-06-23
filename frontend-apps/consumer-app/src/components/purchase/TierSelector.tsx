'use client';

import React from 'react';
import { Check, Users, Crown, Star, Fire } from 'lucide-react';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  available: number;
  total: number;
  icon: 'general' | 'premium' | 'vip';
  popular?: boolean;
}

interface TierSelectorProps {
  tiers: TicketTier[];
  selectedTier: string | null;
  onTierSelect: (tier: TicketTier) => void;
}

export default function TierSelector({ tiers, selectedTier, onTierSelect }: TierSelectorProps) {
  const getTierIcon = (icon: string) => {
    switch (icon) {
      case 'general': return Users;
      case 'premium': return Star;
      case 'vip': return Crown;
      default: return Users;
    }
  };

  const getAvailabilityStatus = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    if (percentage <= 10) return { text: '🔥 Few left!', color: 'text-red-600' };
    if (percentage <= 25) return { text: '⚡ Limited', color: 'text-orange-600' };
    return { text: '✅ Available', color: 'text-green-600' };
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Experience</h3>
        <p className="text-gray-600">Select the perfect ticket for an unforgettable night</p>
      </div>
      
      <div className="space-y-4">
        {tiers.map((tier) => {
          const IconComponent = getTierIcon(tier.icon);
          const availability = getAvailabilityStatus(tier.available, tier.total);
          const isSelected = selectedTier === tier.id;
          const isAvailable = tier.available > 0;

          return (
            <div
              key={tier.id}
              onClick={() => isAvailable && onTierSelect(tier)}
              className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all transform hover:scale-[1.02] ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : isAvailable
                  ? 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-md'
                  : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center">
                  <Fire className="h-3 w-3 mr-1" />
                  MOST POPULAR
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}

              <div className="flex items-start space-x-6">
                {/* Icon */}
                <div className={`p-4 rounded-xl ${
                  tier.icon === 'vip' 
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                    : tier.icon === 'premium'
                    ? 'bg-gradient-to-br from-purple-400 to-pink-500'
                    : 'bg-gradient-to-br from-blue-400 to-blue-600'
                }`}>
                  <IconComponent className="h-8 w-8 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 mb-1">{tier.name}</h4>
                      <p className="text-gray-600">{tier.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        {tier.originalPrice && tier.originalPrice > tier.price && (
                          <span className="text-lg text-gray-500 line-through">
                            ${tier.originalPrice}
                          </span>
                        )}
                        <span className="text-3xl font-black text-gray-900">
                          ${tier.price}
                        </span>
                      </div>
                      {tier.originalPrice && tier.originalPrice > tier.price && (
                        <div className="text-sm font-semibold text-green-600">
                          Save ${tier.originalPrice - tier.price}!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-700">
                        <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* Availability */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${availability.color}`}>
                      {availability.text}
                    </span>
                    <span className="text-sm text-gray-500">
                      {tier.available.toLocaleString()} of {tier.total.toLocaleString()} left
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        (tier.available / tier.total) <= 0.1 
                          ? 'bg-red-500' 
                          : (tier.available / tier.total) <= 0.25
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${(tier.available / tier.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Sold Out Overlay */}
              {!isAvailable && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-75 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-white">SOLD OUT</span>
                    <p className="text-gray-300 mt-1">Join waitlist?</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

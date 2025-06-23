import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Clock, Star, ArrowLeft, CreditCard, Wallet } from 'lucide-react';

// Mock event data - in real app this would be fetched based on ID
const eventData = {
  id: 1,
  title: "Miami Electronic Festival",
  artist: "David Guetta",
  venue: "Bayfront Park",
  address: "301 Biscayne Blvd, Miami, FL 33132",
  date: "2025-07-15",
  time: "8:00 PM",
  doors: "7:00 PM",
  image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
  description: "Join us for an unforgettable night of electronic music with world-renowned DJ David Guetta. Experience cutting-edge sound, incredible visuals, and an atmosphere like no other.",
  category: "Electronic",
  attendees: 15000,
  rating: 4.8,
  reviews: 234,
  tiers: [
    {
      id: 1,
      name: "General Admission",
      price: 89,
      description: "Access to main floor and standard amenities",
      available: 1250,
      perks: ["Main floor access", "Standard bars", "Merchandise discounts"]
    },
    {
      id: 2,
      name: "VIP Experience",
      price: 189,
      description: "Premium viewing area with exclusive amenities",
      available: 150,
      perks: ["VIP viewing area", "Premium bars", "VIP entrance", "Exclusive merchandise"]
    },
    {
      id: 3,
      name: "Artist Meet & Greet",
      price: 350,
      description: "Ultimate experience with artist access",
      available: 25,
      perks: ["All VIP perks", "Meet & greet with artist", "Signed merchandise", "Photo opportunity"]
    }
  ]
};

export default function EventDetailsPage({ params }: { params: { id: string } }) {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Back Button */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/events" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Events
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Event Info */}
          <div>
            <img
              src={eventData.image}
              alt={eventData.title}
              className="w-full h-64 object-cover rounded-xl mb-6"
            />
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded">
                  {eventData.category}
                </span>
                <div className="flex items-center">
                  <Star className="h-5 w-5 text-yellow-400 mr-1" />
                  <span className="font-medium">{eventData.rating}</span>
                  <span className="text-gray-500 ml-1">({eventData.reviews} reviews)</span>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">{eventData.title}</h1>
              <h2 className="text-xl text-gray-600 mb-6">{eventData.artist}</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                  <span>{new Date(eventData.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-gray-400 mr-3" />
                  <span>Doors: {eventData.doors} | Show: {eventData.time}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <div>{eventData.venue}</div>
                    <div className="text-gray-500 text-sm">{eventData.address}</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-400 mr-3" />
                  <span>{eventData.attendees.toLocaleString()} people attending</span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">About This Event</h3>
                <p className="text-gray-600">{eventData.description}</p>
              </div>
            </div>
          </div>

          {/* Right Column - Ticket Selection */}
          <div>
            <div className="bg-white rounded-xl p-6 shadow-sm border sticky top-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Select Tickets</h3>
              
              <div className="space-y-4 mb-6">
                {eventData.tiers.map((tier) => (
                  <div key={tier.id} className="border rounded-lg p-4 hover:border-primary-500 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-lg">{tier.name}</h4>
                      <span className="text-2xl font-bold text-primary-600">${tier.price}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{tier.description}</p>
                    
                    <ul className="text-sm text-gray-500 space-y-1 mb-4">
                      {tier.perks.map((perk, index) => (
                        <li key={index} className="flex items-center">
                          <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2"></span>
                          {perk}
                        </li>
                      ))}
                    </ul>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {tier.available} tickets available
                      </span>
                      <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment Options */}
              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">Payment Options</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center p-3 border rounded-lg hover:border-primary-500 transition-colors">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Card
                  </button>
                  <button className="flex items-center justify-center p-3 border rounded-lg hover:border-primary-500 transition-colors">
                    <Wallet className="h-5 w-5 mr-2" />
                    Crypto
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

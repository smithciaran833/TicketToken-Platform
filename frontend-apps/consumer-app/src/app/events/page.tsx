import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Search, Filter } from 'lucide-react';

// Mock event data - in real app this would come from your API
const events = [
  {
    id: 1,
    title: "Miami Electronic Festival",
    artist: "David Guetta",
    venue: "Bayfront Park",
    date: "2025-07-15",
    time: "8:00 PM",
    price: 89,
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400",
    category: "Electronic",
    attendees: 15000
  },
  {
    id: 2,
    title: "Hip Hop Summer Jam",
    artist: "Travis Scott",
    venue: "American Airlines Arena",
    date: "2025-07-22",
    time: "7:30 PM",
    price: 125,
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
    category: "Hip Hop",
    attendees: 20000
  },
  {
    id: 3,
    title: "Indie Rock Night",
    artist: "The Strokes",
    venue: "The Fillmore",
    date: "2025-07-30",
    time: "9:00 PM",
    price: 65,
    image: "https://images.unsplash.com/photo-1501612780327-45045538702b?w=400",
    category: "Rock",
    attendees: 5000
  }
];

export default function EventsPage() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Events</h1>
          
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search events, artists, venues..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <div className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-48 object-cover rounded-t-xl"
                />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                      {event.category}
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${event.price}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {event.title}
                  </h3>
                  <p className="text-gray-600 mb-4">{event.artist}</p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(event.date).toLocaleDateString()} at {event.time}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      {event.venue}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      {event.attendees.toLocaleString()} attending
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

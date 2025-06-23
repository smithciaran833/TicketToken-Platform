'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { eventAPI } from '@/lib/api';

interface EventFormData {
  title: string;
  description: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  category: string;
  price: number;
  capacity: number;
}

export default function EventForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<EventFormData>();

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    setResult(null);
    
    try {
      const response = await eventAPI.create(data);
      setResult({ success: true, data: response.data });
      reset();
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data || error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Create Event (API Test)</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Event Title</label>
          <input
            {...register('title', { required: 'Title is required' })}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Concert, Game, Show..."
          />
          {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            {...register('description', { required: 'Description is required' })}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Event details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Venue</label>
            <input
              {...register('venue', { required: 'Venue is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="Madison Square Garden"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input
              {...register('city', { required: 'City is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="New York, NY"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time</label>
            <input
              type="time"
              {...register('time', { required: 'Time is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              {...register('category', { required: 'Category is required' })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              <option value="Music">Music</option>
              <option value="Sports">Sports</option>
              <option value="Comedy">Comedy</option>
              <option value="Theater">Theater</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Price ($)</label>
            <input
              type="number"
              step="0.01"
              {...register('price', { required: 'Price is required', min: 0 })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="50.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity</label>
            <input
              type="number"
              {...register('capacity', { required: 'Capacity is required', min: 1 })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="1000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating Event...' : 'Create Event'}
        </button>
      </form>

      {/* API Response Display */}
      {result && (
        <div className={`mt-6 p-4 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <h3 className="font-bold">API Response:</h3>
          <pre className="text-sm mt-2 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

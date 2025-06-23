export interface Event {
  id: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  category: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  createdBy: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  tokenId: string;
  qrCode: string;
  price: number;
  seatNumber?: string;
  tier: string;
  isUsed: boolean;
  mintedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  walletAddress?: string;
  role: 'USER' | 'ORGANIZER' | 'ADMIN';
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'card' | 'crypto';
  createdAt: string;
}

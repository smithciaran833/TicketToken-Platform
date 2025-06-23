export interface PaymentRequest {
  amount: number; // Amount in lamports for SOL, cents for USD
  currency: 'usd' | 'sol' | 'usdc';
  paymentMethod: 'card' | 'crypto';
  
  // Event details
  ticketId: string;
  eventId: string;
  buyerEmail: string;
  
  // Stripe fields (for card payments)
  stripePaymentMethodId?: string;
  
  // Crypto fields (for SOL/USDC payments)
  buyerPrivateKey?: Uint8Array;
  artistWallet?: string;
  venueWallet?: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  message: string;
  error?: string;
  
  // Optional Stripe fields
  stripePaymentIntentId?: string;
  
  // Optional contract fields
  contractCall?: boolean;
  signature?: string;
  platformAmount?: number;
  artistAmount?: number;
  venueAmount?: number;
}

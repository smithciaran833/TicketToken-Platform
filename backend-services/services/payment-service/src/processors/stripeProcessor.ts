import Stripe from 'stripe';
import { PaymentRequest, PaymentResponse } from '../types/payment.types';

export class StripeProcessor {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async processCardPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      console.log(`💳 Processing card payment for ${paymentRequest.amount} cents`);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        payment_method: paymentRequest.stripePaymentMethodId,
        confirm: true,
        return_url: 'https://your-app.com/return',
        metadata: {
          ticketId: paymentRequest.ticketId,
          eventId: paymentRequest.eventId,
          buyerEmail: paymentRequest.buyerEmail,
        },
      });

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          paymentId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          message: 'Card payment successful',
        };
      } else {
        return {
          success: false,
          paymentId: paymentIntent.id,
          message: `Payment ${paymentIntent.status}`,
        };
      }
    } catch (error: any) {
      console.error('Stripe payment error:', error);
      return {
        success: false,
        paymentId: '',
        message: 'Card payment failed',
        error: error.message,
      };
    }
  }

  async createCustomer(email: string, name?: string): Promise<string> {
    const customer = await this.stripe.customers.create({
      email,
      name,
    });
    return customer.id;
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<any> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
    });
  }

  async constructWebhookEvent(payload: string, signature: string): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  }
}

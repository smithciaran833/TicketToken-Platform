import { Request, Response } from 'express';
import { StripeProcessor } from '../processors/stripeProcessor';
import { CryptoProcessor } from '../processors/cryptoProcessor';
import { RefundProcessor } from '../processors/refundProcessor';
import { ChargebackHandler } from '../processors/chargebackHandler';
import { SplitService } from '../services/split/splitService';
import { PaymentRequest, RefundRequest } from '../types/payment.types';

export class PaymentController {
  private stripeProcessor: StripeProcessor;
  private cryptoProcessor: CryptoProcessor;
  private refundProcessor: RefundProcessor;
  private chargebackHandler: ChargebackHandler;
  private splitService: SplitService;

  constructor() {
    this.stripeProcessor = new StripeProcessor();
    this.cryptoProcessor = new CryptoProcessor();
    this.refundProcessor = new RefundProcessor();
    this.chargebackHandler = new ChargebackHandler();
    this.splitService = new SplitService();
  }

  async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentRequest: PaymentRequest = req.body;

      // Validate request
      const validation = await this.validatePaymentRequest(paymentRequest);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.message,
        });
        return;
      }

      // Process based on payment method
      let result;
      if (paymentRequest.paymentMethod === 'card') {
        // Process card payment first
        result = await this.stripeProcessor.processCardPayment(paymentRequest);
        
        if (result.success) {
          // Then trigger blockchain distribution
          await this.splitService.distributeFunds(paymentRequest, result.paymentId);
        }
      } else if (paymentRequest.paymentMethod === 'crypto') {
        if (paymentRequest.currency === 'sol') {
          result = await this.cryptoProcessor.processSOLPayment(paymentRequest);
        } else if (paymentRequest.currency === 'usdc') {
          result = await this.cryptoProcessor.processUSDCPayment(paymentRequest);
        } else {
          throw new Error('Unsupported crypto currency');
        }
      } else {
        throw new Error('Unsupported payment method');
      }

      res.json(result);
    } catch (error: any) {
      console.error('Payment processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: error.message,
      });
    }
  }

  async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const refundRequest: RefundRequest = req.body;
      const result = await this.refundProcessor.processRefund(refundRequest);
      res.json(result);
    } catch (error: any) {
      console.error('Refund processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Refund processing failed',
        error: error.message,
      });
    }
  }

  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Implementation for getting payment status
      res.json({
        paymentId: id,
        status: 'completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error getting payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment status',
        error: error.message,
      });
    }
  }

  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;

      const event = await this.stripeProcessor.constructWebhookEvent(
        payload,
        signature
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('✅ Payment succeeded:', event.data.object.id);
          break;
        case 'payment_intent.payment_failed':
          console.log('❌ Payment failed:', event.data.object.id);
          break;
        case 'charge.dispute.created':
          await this.chargebackHandler.handleChargeback(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message,
      });
    }
  }

  async validatePayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentRequest: PaymentRequest = req.body;
      const validation = await this.validatePaymentRequest(paymentRequest);
      res.json(validation);
    } catch (error: any) {
      console.error('Payment validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Payment validation failed',
        error: error.message,
      });
    }
  }

  private async validatePaymentRequest(request: PaymentRequest): Promise<{ valid: boolean; message: string }> {
    // Basic validation
    if (!request.ticketId || !request.eventId || !request.buyerEmail) {
      return { valid: false, message: 'Missing required fields' };
    }

    if (request.amount <= 0) {
      return { valid: false, message: 'Invalid payment amount' };
    }

    if (request.splits.platform + request.splits.venue + request.splits.artist !== 100) {
      return { valid: false, message: 'Payment splits must total 100%' };
    }

    // Validate wallet addresses for crypto payments
    if (request.paymentMethod === 'crypto') {
      const isValidBuyer = await this.cryptoProcessor.validateWalletAddress(request.buyerWallet!);
      const isValidVenue = await this.cryptoProcessor.validateWalletAddress(request.venueWallet);
      const isValidArtist = await this.cryptoProcessor.validateWalletAddress(request.artistWallet);

      if (!isValidBuyer || !isValidVenue || !isValidArtist) {
        return { valid: false, message: 'Invalid wallet address' };
      }
    }

    return { valid: true, message: 'Valid payment request' };
  }
}

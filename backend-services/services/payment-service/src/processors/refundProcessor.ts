import { StripeProcessor } from './stripeProcessor';
import { RefundRequest, RefundResponse } from '../types/payment.types';

export class RefundProcessor {
  private stripeProcessor: StripeProcessor;

  constructor() {
    this.stripeProcessor = new StripeProcessor();
  }

  async processRefund(refundRequest: RefundRequest): Promise<RefundResponse> {
    try {
      console.log(`🔄 Processing refund for payment ${refundRequest.paymentId}`);

      // For Stripe payments
      if (refundRequest.paymentId.startsWith('pi_')) {
        return this.processStripeRefund(refundRequest);
      }

      // For crypto payments
      if (refundRequest.paymentId.includes('transaction_hash')) {
        return this.processCryptoRefund(refundRequest);
      }

      throw new Error('Unknown payment type for refund');
    } catch (error: any) {
      console.error('Refund processing error:', error);
      return {
        success: false,
        refundId: '',
        amount: 0,
        message: 'Refund failed',
        error: error.message,
      };
    }
  }

  private async processStripeRefund(refundRequest: RefundRequest): Promise<RefundResponse> {
    const refund = await this.stripeProcessor.refundPayment(
      refundRequest.paymentId,
      refundRequest.amount
    );

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      message: 'Stripe refund processed successfully',
    };
  }

  private async processCryptoRefund(refundRequest: RefundRequest): Promise<RefundResponse> {
    // Crypto refunds are more complex - typically require manual processing
    // or creation of new reverse transactions
    
    console.log('Processing crypto refund - manual review required');

    return {
      success: true,
      refundId: `crypto_refund_${Date.now()}`,
      amount: refundRequest.amount || 0,
      message: 'Crypto refund initiated - manual processing required',
    };
  }

  async getRefundStatus(refundId: string): Promise<any> {
    // Implementation for checking refund status
    return {
      id: refundId,
      status: 'pending',
      created: Date.now(),
    };
  }
}

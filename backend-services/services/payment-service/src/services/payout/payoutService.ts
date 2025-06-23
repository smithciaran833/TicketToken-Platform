import { StripeConnectProcessor } from '../../processors/stripeConnect';

export class PayoutService {
  private stripeConnect: StripeConnectProcessor;

  constructor() {
    this.stripeConnect = new StripeConnectProcessor();
  }

  async scheduleInstantPayout(accountId: string, amount: number, description: string): Promise<string> {
    try {
      console.log(`💸 Processing instant payout of $${amount/100} to ${accountId}`);
      
      const transferId = await this.stripeConnect.transferFunds(
        accountId,
        amount,
        description
      );

      console.log(`✅ Instant payout completed: ${transferId}`);
      return transferId;
    } catch (error) {
      console.error('Instant payout error:', error);
      throw error;
    }
  }

  async scheduleBatchPayout(payouts: Array<{ accountId: string; amount: number; description: string }>): Promise<string[]> {
    try {
      console.log(`📦 Processing batch payout for ${payouts.length} recipients`);
      
      const transferIds = await Promise.all(
        payouts.map(payout =>
          this.stripeConnect.transferFunds(
            payout.accountId,
            payout.amount,
            payout.description
          )
        )
      );

      console.log(`✅ Batch payout completed: ${transferIds.length} transfers`);
      return transferIds;
    } catch (error) {
      console.error('Batch payout error:', error);
      throw error;
    }
  }

  async getPayoutHistory(accountId: string): Promise<any[]> {
    // Implementation for getting payout history
    return [
      {
        id: 'payout_1',
        amount: 4700,
        status: 'paid',
        created: Date.now(),
        arrival_date: Date.now() + 86400000, // +1 day
      },
    ];
  }

  async estimatePayoutTime(accountId: string): Promise<string> {
    // Implementation for estimating payout time
    const account = await this.stripeConnect.getAccountStatus(accountId);
    
    if (account.capabilities?.transfers === 'active') {
      return 'instant';
    } else {
      return '1-2 business days';
    }
  }
}

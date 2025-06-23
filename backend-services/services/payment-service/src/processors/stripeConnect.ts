import Stripe from 'stripe';

export class StripeConnectProcessor {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async createExpressAccount(email: string, businessName: string): Promise<string> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email,
        business_profile: {
          name: businessName,
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      });

      return account.id;
    } catch (error: any) {
      console.error('Error creating Stripe Connect account:', error);
      throw error;
    }
  }

  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  async transferFunds(accountId: string, amount: number, description: string): Promise<string> {
    const transfer = await this.stripe.transfers.create({
      amount,
      currency: 'usd',
      destination: accountId,
      description,
    });

    return transfer.id;
  }

  async getAccountStatus(accountId: string): Promise<any> {
    return this.stripe.accounts.retrieve(accountId);
  }
}

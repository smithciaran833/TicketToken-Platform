import { PrismaClient } from '@prisma/client';
import axios from 'axios';

interface QuickBooksAuth {
  access_token: string;
  refresh_token: string;
  realmId: string;
  expires_at: number;
}

interface QBCustomer {
  Id?: string;
  Name: string;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1: string;
    City: string;
    CountrySubDivisionCode: string;
    PostalCode: string;
  };
}

interface QBInvoice {
  Id?: string;
  CustomerRef: { value: string };
  Line: Array<{
    Amount: number;
    DetailType: 'SalesItemLineDetail';
    SalesItemLineDetail: {
      ItemRef: { value: string };
      Qty: number;
      UnitPrice: number;
    };
  }>;
  DocNumber?: string;
  TxnDate: string;
  DueDate: string;
  TotalAmt: number;
}

export class QuickBooksIntegration {
  private auth: QuickBooksAuth | null = null;
  private prisma: PrismaClient;
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID!;
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
    this.baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true' 
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
  }

  async setAuthTokens(authData: QuickBooksAuth) {
    this.auth = authData;
    
    // Store tokens securely
    await this.prisma.integrationAuth.upsert({
      where: { platform: 'quickbooks' },
      create: {
        platform: 'quickbooks',
        auth_data: authData,
        expires_at: new Date(authData.expires_at)
      },
      update: {
        auth_data: authData,
        expires_at: new Date(authData.expires_at)
      }
    });
  }

  async syncVenueFinancials(venueId: string): Promise<{
    customerId: string;
    invoicesCreated: number;
    itemsCreated: number;
    totalRevenue: number;
  }> {
    await this.ensureAuthenticated();

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      include: {
        events: {
          include: {
            tickets: true,
            artist: true
          }
        },
        owner: true
      }
    });

    if (!venue) throw new Error('Venue not found');

    // Create customer in QuickBooks
    const customerId = await this.createOrUpdateCustomer({
      Name: venue.name,
      CompanyName: venue.name,
      PrimaryEmailAddr: venue.owner?.email ? { Address: venue.owner.email } : undefined,
      PrimaryPhone: venue.phone ? { FreeFormNumber: venue.phone } : undefined,
      BillAddr: {
        Line1: venue.address,
        City: venue.city,
        CountrySubDivisionCode: venue.state,
        PostalCode: venue.zipCode
      }
    });

    // Create service items for different ticket types
    const itemsCreated = await this.createTicketItems(venue.events);

    // Create invoices for completed events
    let invoicesCreated = 0;
    let totalRevenue = 0;

    for (const event of venue.events) {
      if (event.status === 'COMPLETED' && event.tickets.length > 0) {
        const eventRevenue = event.tickets.reduce((sum, ticket) => sum + ticket.price, 0);
        
        const invoiceId = await this.createInvoice({
          CustomerRef: { value: customerId },
          DocNumber: `TT-${event.id.substring(0, 8)}`,
          TxnDate: event.date.split('T')[0],
          DueDate: event.date.split('T')[0],
          Line: [{
            Amount: eventRevenue,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              ItemRef: { value: await this.getOrCreateItem(`Event: ${event.name}`) },
              Qty: event.tickets.length,
              UnitPrice: eventRevenue / event.tickets.length
            }
          }],
          TotalAmt: eventRevenue
        });

        invoicesCreated++;
        totalRevenue += eventRevenue;
      }
    }

    // Store sync record
    await this.storeSyncRecord('venue', venueId, {
      customerId,
      invoicesCreated,
      itemsCreated,
      totalRevenue
    });

    return {
      customerId,
      invoicesCreated,
      itemsCreated,
      totalRevenue
    };
  }

  async syncArtistRoyalties(artistId: string): Promise<{
    vendorId: string;
    billsCreated: number;
    totalRoyalties: number;
  }> {
    await this.ensureAuthenticated();

    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        events: {
          include: {
            tickets: true,
            venue: true
          }
        },
        user: true
      }
    });

    if (!artist) throw new Error('Artist not found');

    // Create vendor for artist
    const vendorId = await this.createOrUpdateVendor({
      Name: artist.name,
      PrimaryEmailAddr: artist.user?.email ? { Address: artist.user.email } : undefined,
      PrimaryPhone: artist.user?.phone ? { FreeFormNumber: artist.user.phone } : undefined
    });

    // Calculate royalties from secondary sales
    const royalties = await this.calculateArtistRoyalties(artist.events);

    let billsCreated = 0;
    let totalRoyalties = 0;

    // Create bills for royalty payments
    for (const royaltyPeriod of royalties) {
      if (royaltyPeriod.amount > 0) {
        await this.createBill({
          VendorRef: { value: vendorId },
          TxnDate: royaltyPeriod.period,
          DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          Line: [{
            Amount: royaltyPeriod.amount,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: await this.getRoyaltyExpenseAccount() }
            }
          }],
          TotalAmt: royaltyPeriod.amount,
          DocNumber: `ROY-${artistId.substring(0, 8)}-${royaltyPeriod.period}`
        });

        billsCreated++;
        totalRoyalties += royaltyPeriod.amount;
      }
    }

    return {
      vendorId,
      billsCreated,
      totalRoyalties
    };
  }

  async generateFinancialReports(startDate: string, endDate: string) {
    await this.ensureAuthenticated();

    // Get profit & loss report
    const profitLoss = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`
    );

    // Get balance sheet
    const balanceSheet = await this.makeRequest('GET',
      `/v3/company/${this.auth!.realmId}/reports/BalanceSheet?date=${endDate}`
    );

    // Get cash flow
    const cashFlow = await this.makeRequest('GET',
      `/v3/company/${this.auth!.realmId}/reports/CashFlow?start_date=${startDate}&end_date=${endDate}`
    );

    // Process and return simplified report
    return {
      period: { start: startDate, end: endDate },
      profit_loss: this.processProfitLossReport(profitLoss),
      balance_sheet: this.processBalanceSheetReport(balanceSheet),
      cash_flow: this.processCashFlowReport(cashFlow),
      key_metrics: {
        total_revenue: this.extractTotalRevenue(profitLoss),
        net_income: this.extractNetIncome(profitLoss),
        total_assets: this.extractTotalAssets(balanceSheet),
        total_liabilities: this.extractTotalLiabilities(balanceSheet),
        cash_position: this.extractCashPosition(balanceSheet)
      }
    };
  }

  private async createOrUpdateCustomer(customerData: QBCustomer): Promise<string> {
    // Check if customer exists
    const existingCustomers = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/query?query=SELECT * FROM Customer WHERE Name = '${customerData.Name}'`
    );

    if (existingCustomers.QueryResponse.Customer && existingCustomers.QueryResponse.Customer.length > 0) {
      // Update existing customer
      const existingCustomer = existingCustomers.QueryResponse.Customer[0];
      const updatedCustomer = { ...existingCustomer, ...customerData };
      
      const result = await this.makeRequest('POST', 
        `/v3/company/${this.auth!.realmId}/customer`,
        { Customer: updatedCustomer }
      );
      
      return result.QueryResponse.Customer[0].Id;
    } else {
      // Create new customer
      const result = await this.makeRequest('POST', 
        `/v3/company/${this.auth!.realmId}/customer`,
        { Customer: customerData }
      );
      
      return result.QueryResponse.Customer[0].Id;
    }
  }

  private async createOrUpdateVendor(vendorData: any): Promise<string> {
    const existingVendors = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/query?query=SELECT * FROM Vendor WHERE Name = '${vendorData.Name}'`
    );

    if (existingVendors.QueryResponse.Vendor && existingVendors.QueryResponse.Vendor.length > 0) {
      return existingVendors.QueryResponse.Vendor[0].Id;
    } else {
      const result = await this.makeRequest('POST', 
        `/v3/company/${this.auth!.realmId}/vendor`,
        { Vendor: vendorData }
      );
      
      return result.QueryResponse.Vendor[0].Id;
    }
  }

  private async createInvoice(invoiceData: QBInvoice): Promise<string> {
    const result = await this.makeRequest('POST', 
      `/v3/company/${this.auth!.realmId}/invoice`,
      { Invoice: invoiceData }
    );
    
    return result.QueryResponse.Invoice[0].Id;
  }

  private async createBill(billData: any): Promise<string> {
    const result = await this.makeRequest('POST', 
      `/v3/company/${this.auth!.realmId}/bill`,
      { Bill: billData }
    );
    
    return result.QueryResponse.Bill[0].Id;
  }

  private async getOrCreateItem(itemName: string): Promise<string> {
    // Check if item exists
    const existingItems = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/query?query=SELECT * FROM Item WHERE Name = '${itemName}'`
    );

    if (existingItems.QueryResponse.Item && existingItems.QueryResponse.Item.length > 0) {
      return existingItems.QueryResponse.Item[0].Id;
    } else {
      // Create new service item
      const itemData = {
        Name: itemName,
        Type: 'Service',
        IncomeAccountRef: { value: await this.getRevenueAccount() }
      };

      const result = await this.makeRequest('POST', 
        `/v3/company/${this.auth!.realmId}/item`,
        { Item: itemData }
      );
      
      return result.QueryResponse.Item[0].Id;
    }
  }

  private async createTicketItems(events: any[]): Promise<number> {
    const uniqueItems = new Set();
    
    events.forEach(event => {
      uniqueItems.add(`Ticket - ${event.name}`);
      uniqueItems.add(`VIP Ticket - ${event.name}`);
    });

    let itemsCreated = 0;
    for (const itemName of uniqueItems) {
      await this.getOrCreateItem(itemName);
      itemsCreated++;
    }

    return itemsCreated;
  }

  private async calculateArtistRoyalties(events: any[]) {
    const royaltiesByMonth = new Map();

    for (const event of events) {
      // Get secondary sales for this event
      const secondarySales = await this.prisma.ticket.findMany({
        where: {
          event_id: event.id,
          resale_history: { not: null }
        }
      });

      secondarySales.forEach(ticket => {
        const month = new Date(ticket.updatedAt).toISOString().substring(0, 7);
        if (!royaltiesByMonth.has(month)) {
          royaltiesByMonth.set(month, 0);
        }
        
        // 5% royalty on resale price
        const royalty = ticket.resale_price * 0.05;
        royaltiesByMonth.set(month, royaltiesByMonth.get(month) + royalty);
      });
    }

    return Array.from(royaltiesByMonth.entries()).map(([period, amount]) => ({
      period,
      amount
    }));
  }

  private async getRevenueAccount(): Promise<string> {
    const accounts = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/query?query=SELECT * FROM Account WHERE AccountType = 'Income'`
    );
    
    return accounts.QueryResponse.Account[0].Id;
  }

  private async getRoyaltyExpenseAccount(): Promise<string> {
    const accounts = await this.makeRequest('GET', 
      `/v3/company/${this.auth!.realmId}/query?query=SELECT * FROM Account WHERE Name LIKE '%Royalty%'`
    );
    
    if (accounts.QueryResponse.Account && accounts.QueryResponse.Account.length > 0) {
      return accounts.QueryResponse.Account[0].Id;
    } else {
      // Create royalty expense account
      const accountData = {
        Name: 'Artist Royalties',
        AccountType: 'Expense',
        AccountSubType: 'SuppliesMaterials'
      };

      const result = await this.makeRequest('POST', 
        `/v3/company/${this.auth!.realmId}/account`,
        { Account: accountData }
      );
      
      return result.QueryResponse.Account[0].Id;
    }
  }

  private processProfitLossReport(report: any) {
    // Simplified profit & loss processing
    return {
      total_income: this.extractTotalRevenue(report),
      total_expenses: this.extractTotalExpenses(report),
      net_income: this.extractNetIncome(report),
      gross_profit_margin: this.calculateGrossProfitMargin(report)
    };
  }

  private processBalanceSheetReport(report: any) {
    return {
      total_assets: this.extractTotalAssets(report),
      total_liabilities: this.extractTotalLiabilities(report),
      equity: this.extractEquity(report),
      current_ratio: this.calculateCurrentRatio(report),
      debt_to_equity: this.calculateDebtToEquity(report)
    };
  }

  private processCashFlowReport(report: any) {
    return {
      operating_cash_flow: this.extractOperatingCashFlow(report),
      investing_cash_flow: this.extractInvestingCashFlow(report),
      financing_cash_flow: this.extractFinancingCashFlow(report),
      net_cash_flow: this.extractNetCashFlow(report)
    };
  }

  private extractTotalRevenue(report: any): number {
    // Implementation would parse QuickBooks report structure
    return 0; // Placeholder
  }

  private extractNetIncome(report: any): number {
    return 0; // Placeholder
  }

  private extractTotalAssets(report: any): number {
    return 0; // Placeholder
  }

  private extractTotalLiabilities(report: any): number {
    return 0; // Placeholder
  }

  private extractCashPosition(report: any): number {
    return 0; // Placeholder
  }

  private extractTotalExpenses(report: any): number {
    return 0; // Placeholder
  }

  private extractEquity(report: any): number {
    return 0; // Placeholder
  }

  private extractOperatingCashFlow(report: any): number {
    return 0; // Placeholder
  }

  private extractInvestingCashFlow(report: any): number {
    return 0; // Placeholder
  }

  private extractFinancingCashFlow(report: any): number {
    return 0; // Placeholder
  }

  private extractNetCashFlow(report: any): number {
    return 0; // Placeholder
  }

  private calculateGrossProfitMargin(report: any): number {
    return 0; // Placeholder
  }

  private calculateCurrentRatio(report: any): number {
    return 0; // Placeholder
  }

  private calculateDebtToEquity(report: any): number {
    return 0; // Placeholder
  }

  private async makeRequest(method: string, endpoint: string, data?: any) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.auth!.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      data
    };

    const response = await axios(config);
    return response.data;
  }

  private async ensureAuthenticated() {
    if (!this.auth) {
      // Load from database
      const authRecord = await this.prisma.integrationAuth.findUnique({
        where: { platform: 'quickbooks' }
      });
      
      if (authRecord) {
        this.auth = authRecord.auth_data as QuickBooksAuth;
      } else {
        throw new Error('QuickBooks not authenticated');
      }
    }

    // Check if token needs refresh
    if (Date.now() >= this.auth.expires_at) {
      await this.refreshToken();
    }
  }

  private async refreshToken() {
    const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.auth!.refresh_token
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.auth!.access_token = response.data.access_token;
    this.auth!.expires_at = Date.now() + (response.data.expires_in * 1000);

    // Update stored auth
    await this.setAuthTokens(this.auth!);
  }

  private async storeSyncRecord(type: string, entityId: string, metadata: any) {
    await this.prisma.accountingSync.create({
      data: {
        entity_type: type,
        entity_id: entityId,
        platform: 'quickbooks',
        sync_metadata: metadata,
        synced_at: new Date()
      }
    });
  }
}

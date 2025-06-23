import { PrismaClient } from '@prisma/client';
import axios from 'axios';

interface SalesforceAuth {
  access_token: string;
  instance_url: string;
  expires_at: number;
}

interface SalesforceAccount {
  Id: string;
  Name: string;
  Type: 'Artist' | 'Venue' | 'Customer';
  TicketToken_ID__c: string;
  Annual_Revenue__c?: number;
  Number_of_Events__c?: number;
  Total_Tickets_Sold__c?: number;
}

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  AccountId: string;
  StageName: string;
  Amount: number;
  CloseDate: string;
  TicketToken_Event_ID__c: string;
  Probability: number;
}

export class SalesforceIntegration {
  private auth: SalesforceAuth | null = null;
  private prisma: PrismaClient;
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;
  private securityToken: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.clientId = process.env.SALESFORCE_CLIENT_ID!;
    this.clientSecret = process.env.SALESFORCE_CLIENT_SECRET!;
    this.username = process.env.SALESFORCE_USERNAME!;
    this.password = process.env.SALESFORCE_PASSWORD!;
    this.securityToken = process.env.SALESFORCE_SECURITY_TOKEN!;
  }

  async authenticate(): Promise<void> {
    try {
      const response = await axios.post('https://login.salesforce.com/services/oauth2/token', null, {
        params: {
          grant_type: 'password',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: this.username,
          password: this.password + this.securityToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.auth = {
        access_token: response.data.access_token,
        instance_url: response.data.instance_url,
        expires_at: Date.now() + (3600 * 1000) // 1 hour
      };

    } catch (error) {
      console.error('Salesforce authentication failed:', error);
      throw new Error('Failed to authenticate with Salesforce');
    }
  }

  async syncVenueData(venueId: string): Promise<{
    accountId: string;
    opportunitiesCreated: number;
    contactsCreated: number;
  }> {
    await this.ensureAuthenticated();

    try {
      // Get venue data from database
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          events: {
            include: {
              artist: true,
              tickets: {
                include: { user: true }
              }
            }
          },
          owner: true
        }
      });

      if (!venue) throw new Error('Venue not found');

      // Create or update Salesforce account
      const accountId = await this.upsertAccount({
        Name: venue.name,
        Type: 'Venue',
        TicketToken_ID__c: venue.id,
        BillingStreet: venue.address,
        BillingCity: venue.city,
        BillingState: venue.state,
        BillingPostalCode: venue.zipCode,
        BillingCountry: venue.country || 'United States',
        Phone: venue.phone,
        Website: venue.website,
        Annual_Revenue__c: venue.events.reduce((sum, event) => 
          sum + event.tickets.reduce((eventSum, ticket) => eventSum + ticket.price, 0), 0
        ),
        Number_of_Events__c: venue.events.length,
        Total_Tickets_Sold__c: venue.events.reduce((sum, event) => sum + event.tickets.length, 0),
        Description: `Venue partner with TicketToken. Capacity: ${venue.capacity}. Location: ${venue.city}, ${venue.state}.`
      });

      // Create contacts for venue staff
      let contactsCreated = 0;
      if (venue.owner) {
        await this.upsertContact({
          FirstName: venue.owner.firstName || '',
          LastName: venue.owner.lastName || 'Owner',
          Email: venue.owner.email,
          AccountId: accountId,
          Title: 'Venue Owner',
          Phone: venue.owner.phone,
          TicketToken_User_ID__c: venue.owner.id
        });
        contactsCreated++;
      }

      // Create opportunities for each event
      let opportunitiesCreated = 0;
      for (const event of venue.events) {
        const opportunityId = await this.upsertOpportunity({
          Name: `${event.name} - ${venue.name}`,
          AccountId: accountId,
          StageName: this.mapEventStatusToStage(event.status),
          Amount: event.tickets.reduce((sum, ticket) => sum + ticket.price, 0),
          CloseDate: event.date,
          TicketToken_Event_ID__c: event.id,
          Probability: this.calculateEventProbability(event),
          Type: 'Concert',
          LeadSource: 'TicketToken Platform',
          Description: `Event featuring ${event.artist.name} at ${venue.name}. ${event.tickets.length} tickets sold.`
        });
        opportunitiesCreated++;
      }

      // Store sync record
      await this.storeSyncRecord('venue', venueId, accountId, {
        opportunitiesCreated,
        contactsCreated
      });

      return {
        accountId,
        opportunitiesCreated,
        contactsCreated
      };

    } catch (error) {
      console.error('Venue sync failed:', error);
      throw new Error(`Venue sync failed: ${error.message}`);
    }
  }

  async syncArtistData(artistId: string): Promise<{
    accountId: string;
    opportunitiesCreated: number;
    contactsCreated: number;
  }> {
    await this.ensureAuthenticated();

    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      include: {
        events: {
          include: {
            venue: true,
            tickets: true
          }
        },
        user: true
      }
    });

    if (!artist) throw new Error('Artist not found');

    // Create artist account
    const accountId = await this.upsertAccount({
      Name: artist.name,
      Type: 'Artist',
      TicketToken_ID__c: artist.id,
      Website: artist.website,
      Description: artist.bio,
      Industry: 'Entertainment',
      Annual_Revenue__c: artist.events.reduce((sum, event) => 
        sum + event.tickets.reduce((eventSum, ticket) => eventSum + ticket.price, 0), 0
      ),
      Number_of_Events__c: artist.events.length,
      Total_Tickets_Sold__c: artist.events.reduce((sum, event) => sum + event.tickets.length, 0),
      Spotify_Followers__c: artist.spotifyFollowers,
      Spotify_ID__c: artist.spotifyId,
      Genres__c: artist.genres?.join(', ')
    });

    // Create contact for artist
    let contactsCreated = 0;
    if (artist.user) {
      await this.upsertContact({
        FirstName: artist.user.firstName || artist.name.split(' ')[0],
        LastName: artist.user.lastName || artist.name.split(' ').slice(1).join(' ') || 'Artist',
        Email: artist.user.email,
        AccountId: accountId,
        Title: 'Artist',
        Phone: artist.user.phone,
        TicketToken_User_ID__c: artist.user.id
      });
      contactsCreated++;
    }

    // Create opportunities for future events
    let opportunitiesCreated = 0;
    const futureEvents = artist.events.filter(event => new Date(event.date) > new Date());
    
    for (const event of futureEvents) {
      await this.upsertOpportunity({
        Name: `${event.name} - ${artist.name}`,
        AccountId: accountId,
        StageName: this.mapEventStatusToStage(event.status),
        Amount: event.basePrice * event.capacity, // Projected revenue
        CloseDate: event.date,
        TicketToken_Event_ID__c: event.id,
        Probability: this.calculateEventProbability(event),
        Type: 'Concert',
        LeadSource: 'TicketToken Platform'
      });
      opportunitiesCreated++;
    }

    return {
      accountId,
      opportunitiesCreated,
      contactsCreated
    };
  }

  async syncCustomerData(userId: string): Promise<{
    contactId: string;
    opportunitiesCreated: number;
  }> {
    await this.ensureAuthenticated();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tickets: {
          include: {
            event: {
              include: {
                artist: true,
                venue: true
              }
            }
          }
        }
      }
    });

    if (!user) throw new Error('User not found');

    // Create contact for customer
    const contactId = await this.upsertContact({
      FirstName: user.firstName || '',
      LastName: user.lastName || 'Customer',
      Email: user.email,
      Phone: user.phone,
      Title: 'Customer',
      TicketToken_User_ID__c: user.id,
      Total_Tickets_Purchased__c: user.tickets.length,
      Total_Spent__c: user.tickets.reduce((sum, ticket) => sum + ticket.price, 0),
      Favorite_Genres__c: this.extractFavoriteGenres(user.tickets),
      Last_Purchase_Date__c: user.tickets.length > 0 ? 
        Math.max(...user.tickets.map(t => new Date(t.createdAt).getTime())) : null,
      Customer_Lifetime_Value__c: this.calculateCLV(user.tickets)
    });

    // Create opportunities for high-value customers
    let opportunitiesCreated = 0;
    const totalSpent = user.tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    
    if (totalSpent > 500) {
      await this.upsertOpportunity({
        Name: `VIP Customer - ${user.firstName} ${user.lastName}`,
        ContactId: contactId,
        StageName: 'Qualification',
        Amount: totalSpent * 0.5, // Potential future value
        CloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        Type: 'Customer Retention',
        LeadSource: 'High Value Customer'
      });
      opportunitiesCreated++;
    }

    return {
      contactId,
      opportunitiesCreated
    };
  }

  private async upsertAccount(accountData: any): Promise<string> {
    // Check if account exists
    const existingQuery = `SELECT Id FROM Account WHERE TicketToken_ID__c = '${accountData.TicketToken_ID__c}'`;
    const searchResult = await this.query(existingQuery);

    if (searchResult.records.length > 0) {
      // Update existing account
      const accountId = searchResult.records[0].Id;
      await this.update('Account', accountId, accountData);
      return accountId;
    } else {
      // Create new account
      const result = await this.create('Account', accountData);
      return result.id;
    }
  }

  private async upsertContact(contactData: any): Promise<string> {
    const existingQuery = contactData.TicketToken_User_ID__c 
      ? `SELECT Id FROM Contact WHERE TicketToken_User_ID__c = '${contactData.TicketToken_User_ID__c}'`
      : `SELECT Id FROM Contact WHERE Email = '${contactData.Email}'`;
    
    const searchResult = await this.query(existingQuery);

    if (searchResult.records.length > 0) {
      const contactId = searchResult.records[0].Id;
      await this.update('Contact', contactId, contactData);
      return contactId;
    } else {
      const result = await this.create('Contact', contactData);
      return result.id;
    }
  }

  private async upsertOpportunity(opportunityData: any): Promise<string> {
    const existingQuery = `SELECT Id FROM Opportunity WHERE TicketToken_Event_ID__c = '${opportunityData.TicketToken_Event_ID__c}'`;
    const searchResult = await this.query(existingQuery);

    if (searchResult.records.length > 0) {
      const opportunityId = searchResult.records[0].Id;
      await this.update('Opportunity', opportunityId, opportunityData);
      return opportunityId;
    } else {
      const result = await this.create('Opportunity', opportunityData);
      return result.id;
    }
  }

  private async create(objectType: string, data: any) {
    const response = await axios.post(
      `${this.auth!.instance_url}/services/data/v57.0/sobjects/${objectType}/`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${this.auth!.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  private async update(objectType: string, id: string, data: any) {
    const response = await axios.patch(
      `${this.auth!.instance_url}/services/data/v57.0/sobjects/${objectType}/${id}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${this.auth!.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  private async query(soqlQuery: string) {
    const response = await axios.get(
      `${this.auth!.instance_url}/services/data/v57.0/query`,
      {
        params: { q: soqlQuery },
        headers: {
          'Authorization': `Bearer ${this.auth!.access_token}`
        }
      }
    );
    return response.data;
  }

  private mapEventStatusToStage(status: string): string {
    const stageMap: Record<string, string> = {
      'DRAFT': 'Prospecting',
      'ACTIVE': 'Qualification',
      'SELLING': 'Proposal/Price Quote',
      'SOLD_OUT': 'Closed Won',
      'CANCELLED': 'Closed Lost',
      'COMPLETED': 'Closed Won'
    };
    return stageMap[status] || 'Qualification';
  }

  private calculateEventProbability(event: any): number {
    const now = new Date();
    const eventDate = new Date(event.date);
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEvent < 0) return event.status === 'COMPLETED' ? 100 : 0;
    if (event.status === 'SOLD_OUT') return 100;
    if (event.status === 'CANCELLED') return 0;
    
    // Probability decreases as event gets closer without selling out
    const soldPercentage = (event.tickets?.length || 0) / event.capacity * 100;
    const timeFactors = Math.max(0, 100 - daysUntilEvent * 2);
    
    return Math.min(95, Math.max(10, (soldPercentage + timeFactors) / 2));
  }

  private extractFavoriteGenres(tickets: any[]): string {
    const genreCount = new Map();
    
    tickets.forEach(ticket => {
      ticket.event?.artist?.genres?.forEach((genre: string) => {
        genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
      });
    });

    return Array.from(genreCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre)
      .join(', ');
  }

  private calculateCLV(tickets: any[]): number {
    if (tickets.length === 0) return 0;
    
    const totalSpent = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    const avgTicketPrice = totalSpent / tickets.length;
    const purchaseFrequency = tickets.length;
    
    // Simplified CLV calculation
    return avgTicketPrice * purchaseFrequency * 2.5; // Projected future value
  }

  private async ensureAuthenticated() {
    if (!this.auth || Date.now() >= this.auth.expires_at) {
      await this.authenticate();
    }
  }

  private async storeSyncRecord(type: string, entityId: string, salesforceId: string, metadata: any) {
    await this.prisma.salesforceSync.create({
      data: {
        entity_type: type,
        entity_id: entityId,
        salesforce_id: salesforceId,
        sync_metadata: metadata,
        synced_at: new Date()
      }
    });
  }

  async generateSalesReport(startDate: string, endDate: string) {
    await this.ensureAuthenticated();

    // Query Salesforce for opportunities in date range
    const opportunitiesQuery = `
      SELECT Id, Name, Amount, StageName, CloseDate, Type, TicketToken_Event_ID__c, Account.Name
      FROM Opportunity 
      WHERE CloseDate >= ${startDate} AND CloseDate <= ${endDate}
      AND TicketToken_Event_ID__c != null
      ORDER BY CloseDate DESC
    `;

    const opportunities = await this.query(opportunitiesQuery);

    // Aggregate data
    const report = {
      total_opportunities: opportunities.records.length,
      total_value: opportunities.records.reduce((sum: number, opp: any) => sum + (opp.Amount || 0), 0),
      won_opportunities: opportunities.records.filter((opp: any) => opp.StageName === 'Closed Won').length,
      lost_opportunities: opportunities.records.filter((opp: any) => opp.StageName === 'Closed Lost').length,
      pipeline_value: opportunities.records
        .filter((opp: any) => !opp.StageName.includes('Closed'))
        .reduce((sum: number, opp: any) => sum + (opp.Amount || 0), 0),
      win_rate: 0,
      by_venue: new Map(),
      by_month: new Map()
    };

    // Calculate win rate
    const closedOpps = report.won_opportunities + report.lost_opportunities;
    report.win_rate = closedOpps > 0 ? (report.won_opportunities / closedOpps) * 100 : 0;

    // Group by venue and month
    opportunities.records.forEach((opp: any) => {
      const venue = opp.Account?.Name || 'Unknown';
      const month = new Date(opp.CloseDate).toISOString().substring(0, 7);

      if (!report.by_venue.has(venue)) {
        report.by_venue.set(venue, { count: 0, value: 0 });
      }
      if (!report.by_month.has(month)) {
        report.by_month.set(month, { count: 0, value: 0 });
      }

      report.by_venue.get(venue).count++;
      report.by_venue.get(venue).value += opp.Amount || 0;
      report.by_month.get(month).count++;
      report.by_month.get(month).value += opp.Amount || 0;
    });

    return {
      ...report,
      by_venue: Object.fromEntries(report.by_venue),
      by_month: Object.fromEntries(report.by_month)
    };
  }

  async createCustomFields() {
    // Create custom fields for TicketToken integration
    const customFields = [
      {
        object: 'Account',
        fields: [
          { name: 'TicketToken_ID__c', type: 'Text', label: 'TicketToken ID' },
          { name: 'Number_of_Events__c', type: 'Number', label: 'Number of Events' },
          { name: 'Total_Tickets_Sold__c', type: 'Number', label: 'Total Tickets Sold' },
          { name: 'Spotify_Followers__c', type: 'Number', label: 'Spotify Followers' },
          { name: 'Genres__c', type: 'Text', label: 'Music Genres' }
        ]
      },
      {
        object: 'Contact',
        fields: [
          { name: 'TicketToken_User_ID__c', type: 'Text', label: 'TicketToken User ID' },
          { name: 'Total_Tickets_Purchased__c', type: 'Number', label: 'Total Tickets Purchased' },
          { name: 'Total_Spent__c', type: 'Currency', label: 'Total Spent' },
          { name: 'Favorite_Genres__c', type: 'Text', label: 'Favorite Genres' },
          { name: 'Customer_Lifetime_Value__c', type: 'Currency', label: 'Customer Lifetime Value' }
        ]
      },
      {
        object: 'Opportunity',
        fields: [
          { name: 'TicketToken_Event_ID__c', type: 'Text', label: 'TicketToken Event ID' },
          { name: 'Event_Date__c', type: 'Date', label: 'Event Date' },
          { name: 'Tickets_Sold__c', type: 'Number', label: 'Tickets Sold' },
          { name: 'Venue_Capacity__c', type: 'Number', label: 'Venue Capacity' }
        ]
      }
    ];

    console.log('Custom fields configuration:', customFields);
    return customFields;
  }
}

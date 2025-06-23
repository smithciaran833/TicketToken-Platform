import { SalesforceIntegration } from '../../../src/business/crm/salesforceSync';

describe('SalesforceIntegration', () => {
  let salesforce: SalesforceIntegration;

  beforeEach(() => {
    salesforce = new SalesforceIntegration();
  });

  describe('syncVenueData', () => {
    it('should sync venue data to Salesforce', async () => {
      const mockVenue = {
        id: 'venue_123',
        name: 'Test Venue',
        address: '123 Main St',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        phone: '+1234567890',
        capacity: 5000,
        events: [
          {
            id: 'event_1',
            name: 'Event 1',
            status: 'ACTIVE',
            date: '2025-07-15T20:00:00Z',
            basePrice: 50,
            capacity: 1000,
            artist: { name: 'Artist 1' },
            tickets: [
              { price: 50 },
              { price: 75 }
            ]
          }
        ],
        owner: {
          id: 'owner_123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@venue.com'
        }
      };

      const mockPrisma = {
        venue: {
          findUnique: jest.fn().mockResolvedValue(mockVenue)
        },
        salesforceSync: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      salesforce.prisma = mockPrisma;

      // Mock Salesforce API calls
      salesforce['makeRequest'] = jest.fn()
        .mockResolvedValueOnce({ access_token: 'token', instance_url: 'https://test.salesforce.com' })
        .mockResolvedValueOnce({ records: [] }) // No existing account
        .mockResolvedValueOnce({ id: 'account_123' }) // Create account
        .mockResolvedValueOnce({ records: [] }) // No existing contact
        .mockResolvedValueOnce({ id: 'contact_123' }) // Create contact
        .mockResolvedValueOnce({ records: [] }) // No existing opportunity
        .mockResolvedValueOnce({ id: 'opp_123' }); // Create opportunity

      const result = await salesforce.syncVenueData('venue_123');

      expect(result.accountId).toBe('account_123');
      expect(result.opportunitiesCreated).toBe(1);
      expect(result.contactsCreated).toBe(1);
    });
  });

  describe('mapEventStatusToStage', () => {
    it('should map event statuses to Salesforce stages correctly', () => {
      expect(salesforce['mapEventStatusToStage']('DRAFT')).toBe('Prospecting');
      expect(salesforce['mapEventStatusToStage']('ACTIVE')).toBe('Qualification');
      expect(salesforce['mapEventStatusToStage']('SOLD_OUT')).toBe('Closed Won');
      expect(salesforce['mapEventStatusToStage']('CANCELLED')).toBe('Closed Lost');
    });
  });

  describe('calculateEventProbability', () => {
    it('should calculate probability based on event status and timing', () => {
      const futureEvent = {
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days future
        status: 'ACTIVE',
        capacity: 1000,
        tickets: new Array(500) // 50% sold
      };

      const probability = salesforce['calculateEventProbability'](futureEvent);
      expect(probability).toBeGreaterThan(30);
      expect(probability).toBeLessThan(95);
    });

    it('should return 100% for sold out events', () => {
      const soldOutEvent = {
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'SOLD_OUT',
        capacity: 1000,
        tickets: new Array(1000)
      };

      expect(salesforce['calculateEventProbability'](soldOutEvent)).toBe(100);
    });
  });
});

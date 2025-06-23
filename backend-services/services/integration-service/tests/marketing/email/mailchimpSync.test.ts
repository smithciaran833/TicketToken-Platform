import { MailchimpIntegration } from '../../../src/marketing/email/mailchimpSync';

describe('MailchimpIntegration', () => {
  let mailchimp: MailchimpIntegration;

  beforeEach(() => {
    mailchimp = new MailchimpIntegration();
  });

  describe('syncEventTicketHolders', () => {
    it('should sync ticket holders to Mailchimp audience', async () => {
      const mockEvent = {
        id: 'event_123',
        name: 'Test Event',
        date: '2025-07-15T20:00:00Z',
        artist: {
          name: 'Test Artist',
          genres: ['electronic']
        },
        venue: {
          name: 'Test Venue',
          city: 'Miami'
        },
        tickets: [
          {
            id: 'ticket_1',
            tier: 'GA',
            price: 50,
            user: {
              email: 'user1@example.com',
              firstName: 'John',
              lastName: 'Doe'
            }
          },
          {
            id: 'ticket_2',
            tier: 'VIP',
            price: 150,
            user: {
              email: 'user2@example.com',
              firstName: 'Jane',
              lastName: 'Smith'
            }
          }
        ]
      };

      const mockPrisma = {
        event: {
          findUnique: jest.fn().mockResolvedValue(mockEvent)
        },
        emailSync: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      mailchimp.prisma = mockPrisma;

      // Mock Mailchimp API calls
      mailchimp['makeRequest'] = jest.fn()
        .mockResolvedValueOnce({ id: 'audience_123' }) // createEventAudience
        .mockResolvedValueOnce({}) // executeBatchOperation
        .mockResolvedValueOnce({ id: 'campaign_123' }); // createPostEventCampaign

      const result = await mailchimp.syncEventTicketHolders('event_123');

      expect(result.audienceId).toBe('audience_123');
      expect(result.syncedMembers).toBe(2);
      expect(result.campaignId).toBe('campaign_123');
    });

    it('should handle events with no tickets', async () => {
      const mockEvent = {
        id: 'event_123',
        name: 'Test Event',
        artist: { name: 'Test Artist' },
        venue: { name: 'Test Venue' },
        tickets: []
      };

      const mockPrisma = {
        event: {
          findUnique: jest.fn().mockResolvedValue(mockEvent)
        },
        emailSync: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      mailchimp.prisma = mockPrisma;

      mailchimp['makeRequest'] = jest.fn()
        .mockResolvedValueOnce({ id: 'audience_123' })
        .mockResolvedValueOnce({ id: 'campaign_123' });

      const result = await mailchimp.syncEventTicketHolders('event_123');

      expect(result.syncedMembers).toBe(0);
      expect(result.audienceId).toBe('audience_123');
    });
  });

  describe('createMemberData', () => {
    it('should format member data correctly', () => {
      const mockUser = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        city: 'Miami'
      };

      const mockTicket = {
        tier: 'VIP',
        price: 150
      };

      const mockEvent = {
        id: 'event_123',
        name: 'Test Event',
        artist: {
          name: 'Test Artist',
          genres: ['electronic', 'house']
        },
        venue: {
          name: 'Test Venue',
          city: 'Miami'
        }
      };

      const memberData = mailchimp['createMemberData'](mockUser, mockTicket, mockEvent);

      expect(memberData.email_address).toBe('test@example.com');
      expect(memberData.status).toBe('subscribed');
      expect(memberData.merge_fields.FNAME).toBe('John');
      expect(memberData.merge_fields.LNAME).toBe('Doe');
      expect(memberData.tags).toContainEqual({ name: 'event-event_123', status: 'active' });
      expect(memberData.tags).toContainEqual({ name: 'tier-vip', status: 'active' });
    });
  });
});

import { InstagramStorySharer } from '../../../src/social/instagram/storySharing';

describe('InstagramStorySharer', () => {
  let sharer: InstagramStorySharer;

  beforeEach(() => {
    sharer = new InstagramStorySharer();
  });

  describe('shareTicketPurchase', () => {
    it('should generate shareable story content', async () => {
      // Mock ticket data
      const mockTicket = {
        id: 'ticket_123',
        tier: 'VIP',
        price: 150,
        event: {
          id: 'event_123',
          name: 'Amazing Concert',
          date: '2025-07-15T20:00:00Z',
          artwork_url: 'https://example.com/artwork.jpg',
          artist: {
            name: 'Test Artist',
            genres: ['electronic', 'house']
          },
          venue: {
            name: 'Test Venue',
            city: 'Miami'
          }
        },
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      };

      const mockPrisma = {
        ticket: {
          findUnique: jest.fn().mockResolvedValue(mockTicket)
        },
        socialShare: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      sharer.prisma = mockPrisma;

      // Mock image generation
      sharer['uploadToCDN'] = jest.fn().mockResolvedValue('https://cdn.example.com/story.png');

      const result = await sharer.shareTicketPurchase('ticket_123', 'user_123');

      expect(result.imageUrl).toBe('https://cdn.example.com/story.png');
      expect(result.caption).toContain('Test Artist');
      expect(result.hashtags).toContain('#TicketToken');
      expect(result.hashtags).toContain('#TestArtist');
    });

    it('should handle missing ticket gracefully', async () => {
      const mockPrisma = {
        ticket: {
          findUnique: jest.fn().mockResolvedValue(null)
        }
      };
      // @ts-ignore
      sharer.prisma = mockPrisma;

      await expect(sharer.shareTicketPurchase('invalid_ticket', 'user_123'))
        .rejects.toThrow('Ticket not found');
    });
  });

  describe('generateHashtags', () => {
    it('should generate relevant hashtags', () => {
      const mockTicket = {
        event: {
          artist: {
            name: 'Test Artist',
            genres: ['electronic', 'house']
          },
          venue: {
            name: 'Test Venue'
          }
        }
      };

      const hashtags = sharer['generateHashtags'](mockTicket);

      expect(hashtags).toContain('#TicketToken');
      expect(hashtags).toContain('#TestArtist');
      expect(hashtags).toContain('#TestVenue');
      expect(hashtags).toContain('#electronic');
      expect(hashtags).toContain('#house');
    });
  });
});

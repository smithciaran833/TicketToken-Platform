import { TwitterEventAnnouncer } from '../../../src/social/twitter/eventAnnouncements';

describe('TwitterEventAnnouncer', () => {
  let announcer: TwitterEventAnnouncer;

  beforeEach(() => {
    announcer = new TwitterEventAnnouncer();
  });

  describe('announceNewEvent', () => {
    it('should post event announcement tweet', async () => {
      const mockEvent = {
        id: 'event_123',
        name: 'Amazing Concert',
        date: '2025-07-15T20:00:00Z',
        base_price: 50,
        artist: {
          name: 'Test Artist',
          genres: ['electronic', 'house'],
          twitter_handle: 'testartist'
        },
        venue: {
          name: 'Test Venue',
          city: 'Miami',
          twitter_handle: 'testvenue'
        }
      };

      const mockPrisma = {
        event: {
          findUnique: jest.fn().mockResolvedValue(mockEvent)
        },
        scheduledTweet: {
          create: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      announcer.prisma = mockPrisma;

      const mockTweet = {
        data: { id: 'tweet_123' }
      };

      const mockTwitter = {
        v2: {
          tweet: jest.fn().mockResolvedValue(mockTweet)
        }
      };
      // @ts-ignore
      announcer.twitter = mockTwitter;

      const result = await announcer.announceNewEvent('event_123');

      expect(result.status).toBe('posted');
      expect(result.tweetId).toBe('tweet_123');
      expect(mockTwitter.v2.tweet).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Test Artist')
        })
      );
    });

    it('should handle Twitter API errors', async () => {
      const mockEvent = {
        id: 'event_123',
        name: 'Test Event',
        artist: { name: 'Test Artist' },
        venue: { name: 'Test Venue' }
      };

      const mockPrisma = {
        event: {
          findUnique: jest.fn().mockResolvedValue(mockEvent)
        }
      };
      // @ts-ignore
      announcer.prisma = mockPrisma;

      const mockTwitter = {
        v2: {
          tweet: jest.fn().mockRejectedValue(new Error('Twitter API Error'))
        }
      };
      // @ts-ignore
      announcer.twitter = mockTwitter;

      await expect(announcer.announceNewEvent('event_123'))
        .rejects.toThrow('Tweet posting failed');
    });
  });

  describe('processPendingTweets', () => {
    it('should process scheduled tweets', async () => {
      const mockScheduledTweets = [
        {
          id: 'scheduled_1',
          content: { text: 'Test tweet content' },
          scheduled_for: new Date(Date.now() - 1000) // Past date
        }
      ];

      const mockPrisma = {
        scheduledTweet: {
          findMany: jest.fn().mockResolvedValue(mockScheduledTweets),
          update: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      announcer.prisma = mockPrisma;

      const mockTwitter = {
        v2: {
          tweet: jest.fn().mockResolvedValue({ data: { id: 'tweet_456' } })
        }
      };
      // @ts-ignore
      announcer.twitter = mockTwitter;

      await announcer.processPendingTweets();

      expect(mockTwitter.v2.tweet).toHaveBeenCalledWith({
        text: 'Test tweet content'
      });

      expect(mockPrisma.scheduledTweet.update).toHaveBeenCalledWith({
        where: { id: 'scheduled_1' },
        data: {
          status: 'posted',
          tweet_id: 'tweet_456',
          posted_at: expect.any(Date)
        }
      });
    });
  });
});

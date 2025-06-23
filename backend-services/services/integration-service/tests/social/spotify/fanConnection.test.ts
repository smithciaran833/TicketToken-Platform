import { SpotifyFanConnector } from '../../../src/social/spotify/fanConnection';

describe('SpotifyFanConnector', () => {
  let connector: SpotifyFanConnector;

  beforeEach(() => {
    connector = new SpotifyFanConnector();
  });

  describe('linkFanAccount', () => {
    it('should successfully link Spotify account and extract preferences', async () => {
      // Mock Spotify API responses
      const mockProfile = {
        id: 'spotify_user_id',
        display_name: 'Test User',
        email: 'test@example.com',
        followers: { total: 100 },
        country: 'US'
      };

      const mockTopArtists = {
        items: [
          { id: 'artist1', name: 'Artist 1', genres: ['electronic', 'house'] },
          { id: 'artist2', name: 'Artist 2', genres: ['hip-hop'] }
        ]
      };

      const mockTopTracks = {
        items: [
          { id: 'track1', name: 'Track 1', artists: [{ name: 'Artist 1' }] }
        ]
      };

      const mockAudioFeatures = [
        { danceability: 0.8, energy: 0.9, valence: 0.7 }
      ];

      const mockSpotify = {
        currentUser: {
          profile: jest.fn().mockResolvedValue(mockProfile),
          topItems: jest.fn()
            .mockResolvedValueOnce(mockTopArtists) // artists
            .mockResolvedValueOnce(mockTopTracks) // tracks
        },
        tracks: {
          audioFeatures: jest.fn().mockResolvedValue(mockAudioFeatures)
        }
      };

      // @ts-ignore
      connector.spotify = mockSpotify;

      // Mock database operations
      const mockPrisma = {
        user: {
          update: jest.fn().mockResolvedValue({})
        }
      };
      // @ts-ignore
      connector.prisma = mockPrisma;

      // Mock Redis
      const mockRedis = {
        setex: jest.fn().mockResolvedValue('OK')
      };
      // @ts-ignore
      connector.redis = mockRedis;

      const result = await connector.linkFanAccount('user_id', 'access_token');

      expect(result.linked).toBe(true);
      expect(result.preferences).toBeDefined();
      expect(result.preferences?.genres).toContain('electronic');
      expect(result.recommendations).toBeDefined();
    });

    it('should handle authentication failures', async () => {
      const mockSpotify = {
        currentUser: {
          profile: jest.fn().mockRejectedValue(new Error('Invalid token'))
        }
      };

      // @ts-ignore
      connector.spotify = mockSpotify;

      const result = await connector.linkFanAccount('user_id', 'invalid_token');

      expect(result.linked).toBe(false);
      expect(result.error).toBe('Failed to connect Spotify account');
    });
  });
});

import { SpotifyArtistVerifier } from '../../../src/social/spotify/artistVerification';

// Mock Spotify API
jest.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withClientCredentials: jest.fn(() => ({
      artists: {
        get: jest.fn()
      }
    }))
  }
}));

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    artist: {
      update: jest.fn(),
      findUnique: jest.fn()
    },
    artistSpotifyData: {
      upsert: jest.fn()
    }
  }))
}));

describe('SpotifyArtistVerifier', () => {
  let verifier: SpotifyArtistVerifier;

  beforeEach(() => {
    verifier = new SpotifyArtistVerifier();
  });

  describe('verifyArtist', () => {
    it('should verify artist with sufficient followers and popularity', async () => {
      // Mock Spotify response
      const mockSpotifyData = {
        id: 'spotify_artist_id',
        name: 'Test Artist',
        followers: { total: 50000 },
        popularity: 65,
        genres: ['electronic', 'house'],
        images: [{ url: 'https://example.com/image.jpg' }],
        external_urls: { spotify: 'https://open.spotify.com/artist/test' }
      };

      // Mock the Spotify API call
      const mockSpotify = {
        artists: {
          get: jest.fn().mockResolvedValue(mockSpotifyData),
          topTracks: jest.fn().mockResolvedValue({ tracks: [] }),
          relatedArtists: jest.fn().mockResolvedValue({ artists: [] })
        }
      };

      // @ts-ignore
      verifier.spotify = mockSpotify;

      const result = await verifier.verifyArtist('spotify_artist_id', 'tt_artist_id');

      expect(result.verified).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.data).toEqual(mockSpotifyData);
    });

    it('should reject artist with insufficient followers', async () => {
      const mockSpotifyData = {
        id: 'spotify_artist_id',
        name: 'Small Artist',
        followers: { total: 500 }, // Below 1000 threshold
        popularity: 65,
        genres: ['electronic'],
        images: [{ url: 'https://example.com/image.jpg' }],
        external_urls: { spotify: 'https://open.spotify.com/artist/test' }
      };

      const mockSpotify = {
        artists: {
          get: jest.fn().mockResolvedValue(mockSpotifyData)
        }
      };

      // @ts-ignore
      verifier.spotify = mockSpotify;

      const result = await verifier.verifyArtist('spotify_artist_id', 'tt_artist_id');

      expect(result.verified).toBe(false);
      expect(result.reasons).toContain('Insufficient followers: 500 (minimum 1000)');
    });

    it('should handle Spotify API errors gracefully', async () => {
      const mockSpotify = {
        artists: {
          get: jest.fn().mockRejectedValue(new Error('Spotify API Error'))
        }
      };

      // @ts-ignore
      verifier.spotify = mockSpotify;

      const result = await verifier.verifyArtist('invalid_id', 'tt_artist_id');

      expect(result.verified).toBe(false);
      expect(result.reasons).toContain('Spotify API error or artist not found');
      expect(result.score).toBe(0);
    });
  });
});

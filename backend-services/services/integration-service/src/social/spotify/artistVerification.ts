import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../../shared/logger';

interface SpotifyArtist {
  id: string;
  name: string;
  followers: { total: number };
  genres: string[];
  images: Array<{ url: string; height: number; width: number }>;
  popularity: number;
  external_urls: { spotify: string };
}

interface VerificationResult {
  verified: boolean;
  data?: SpotifyArtist;
  reasons?: string[];
  score: number;
}

export class SpotifyArtistVerifier {
  private spotify: SpotifyApi;
  private prisma: PrismaClient;
  private logger: Logger;

  constructor() {
    this.spotify = SpotifyApi.withClientCredentials(
      process.env.SPOTIFY_CLIENT_ID!,
      process.env.SPOTIFY_CLIENT_SECRET!
    );
    this.prisma = new PrismaClient();
    this.logger = new Logger('SpotifyArtistVerifier');
  }

  async verifyArtist(
    spotifyId: string, 
    ticketTokenArtistId: string
  ): Promise<VerificationResult> {
    try {
      const spotifyData = await this.spotify.artists.get(spotifyId);
      const reasons: string[] = [];
      let score = 0;

      // Minimum follower requirement (1000)
      if (spotifyData.followers.total < 1000) {
        reasons.push(`Insufficient followers: ${spotifyData.followers.total} (minimum 1000)`);
      } else {
        score += 25;
      }

      // Popularity check (minimum 20)
      if (spotifyData.popularity < 20) {
        reasons.push(`Low popularity score: ${spotifyData.popularity} (minimum 20)`);
      } else {
        score += 25;
      }

      // Genre verification (must have genres)
      if (spotifyData.genres.length === 0) {
        reasons.push('No genres specified on Spotify');
      } else {
        score += 20;
      }

      // Profile completeness
      if (spotifyData.images.length > 0) score += 15;
      if (spotifyData.name.length > 2) score += 15;

      const verified = score >= 70;

      if (verified) {
        await this.saveVerifiedArtist(ticketTokenArtistId, spotifyData);
        await this.syncArtistData(ticketTokenArtistId, spotifyData);
      }

      this.logger.info(`Artist verification: ${spotifyData.name} - Score: ${score}, Verified: ${verified}`);

      return {
        verified,
        data: spotifyData,
        reasons: reasons.length > 0 ? reasons : undefined,
        score
      };

    } catch (error) {
      this.logger.error('Artist verification failed:', error);
      return {
        verified: false,
        reasons: ['Spotify API error or artist not found'],
        score: 0
      };
    }
  }

  private async saveVerifiedArtist(artistId: string, spotifyData: SpotifyArtist) {
    await this.prisma.artist.update({
      where: { id: artistId },
      data: {
        spotify_id: spotifyData.id,
        spotify_verified: true,
        spotify_followers: spotifyData.followers.total,
        spotify_popularity: spotifyData.popularity,
        genres: spotifyData.genres,
        profile_image: spotifyData.images[0]?.url,
        verified_at: new Date()
      }
    });
  }

  private async syncArtistData(artistId: string, spotifyData: SpotifyArtist) {
    // Import top tracks for event recommendations
    const topTracks = await this.spotify.artists.topTracks(spotifyData.id, 'US');
    
    // Get related artists for cross-promotion
    const relatedArtists = await this.spotify.artists.relatedArtists(spotifyData.id);

    await this.prisma.artistSpotifyData.upsert({
      where: { artist_id: artistId },
      create: {
        artist_id: artistId,
        top_tracks: topTracks.tracks.map(track => ({
          id: track.id,
          name: track.name,
          popularity: track.popularity,
          preview_url: track.preview_url
        })),
        related_artists: relatedArtists.artists.slice(0, 10).map(artist => ({
          id: artist.id,
          name: artist.name,
          popularity: artist.popularity
        })),
        last_synced: new Date()
      },
      update: {
        top_tracks: topTracks.tracks.map(track => ({
          id: track.id,
          name: track.name,
          popularity: track.popularity,
          preview_url: track.preview_url
        })),
        related_artists: relatedArtists.artists.slice(0, 10).map(artist => ({
          id: artist.id,
          name: artist.name,
          popularity: artist.popularity
        })),
        last_synced: new Date()
      }
    });
  }

  async getBulkArtistData(spotifyIds: string[]) {
    const chunks = this.chunkArray(spotifyIds, 50); // Spotify API limit
    const allArtists = [];

    for (const chunk of chunks) {
      const artists = await this.spotify.artists.get(chunk);
      allArtists.push(...artists);
    }

    return allArtists;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

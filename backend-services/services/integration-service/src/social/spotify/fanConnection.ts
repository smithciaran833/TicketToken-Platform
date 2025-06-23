import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { PrismaClient } from '@prisma/client';
import { RedisClient } from '../../shared/cache';

interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  followers: { total: number };
  images: Array<{ url: string }>;
  country: string;
}

interface MusicPreferences {
  topArtists: Array<{ id: string; name: string; genres: string[] }>;
  topTracks: Array<{ id: string; name: string; artist: string }>;
  genres: string[];
  danceability: number;
  energy: number;
  valence: number;
}

export class SpotifyFanConnector {
  private spotify: SpotifyApi;
  private prisma: PrismaClient;
  private redis: RedisClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new RedisClient();
  }

  async linkFanAccount(
    ticketTokenUserId: string, 
    spotifyAccessToken: string
  ): Promise<{
    linked: boolean;
    preferences?: MusicPreferences;
    recommendations?: any[];
    error?: string;
  }> {
    try {
      this.spotify = SpotifyApi.withAccessToken(
        process.env.SPOTIFY_CLIENT_ID!,
        { access_token: spotifyAccessToken }
      );

      // Get user profile
      const profile = await this.spotify.currentUser.profile();

      // Extract music preferences
      const preferences = await this.extractMusicPreferences();

      // Link accounts in database
      await this.linkAccounts(ticketTokenUserId, profile, preferences);

      // Generate event recommendations
      const recommendations = await this.generateEventRecommendations(preferences);

      // Cache preferences for quick access
      await this.redis.setex(
        `user:${ticketTokenUserId}:spotify_prefs`,
        3600, // 1 hour
        JSON.stringify(preferences)
      );

      return {
        linked: true,
        preferences,
        recommendations
      };

    } catch (error) {
      console.error('Spotify linking failed:', error);
      return {
        linked: false,
        error: 'Failed to connect Spotify account'
      };
    }
  }

  private async extractMusicPreferences(): Promise<MusicPreferences> {
    // Get user's top artists (last 6 months)
    const topArtists = await this.spotify.currentUser.topItems('artists', 'medium_term', 20);
    
    // Get user's top tracks (last 6 months)
    const topTracks = await this.spotify.currentUser.topItems('tracks', 'medium_term', 20);

    // Extract genres from top artists
    const genres = [...new Set(
      topArtists.items.flatMap(artist => artist.genres)
    )].slice(0, 10);

    // Get audio features for music taste analysis
    const trackIds = topTracks.items.map(track => track.id);
    const audioFeatures = await this.spotify.tracks.audioFeatures(trackIds);

    // Calculate average music characteristics
    const avgFeatures = audioFeatures.reduce((acc, features) => ({
      danceability: acc.danceability + features.danceability,
      energy: acc.energy + features.energy,
      valence: acc.valence + features.valence
    }), { danceability: 0, energy: 0, valence: 0 });

    const trackCount = audioFeatures.length;

    return {
      topArtists: topArtists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres
      })),
      topTracks: topTracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists[0].name
      })),
      genres,
      danceability: avgFeatures.danceability / trackCount,
      energy: avgFeatures.energy / trackCount,
      valence: avgFeatures.valence / trackCount
    };
  }

  private async linkAccounts(
    userId: string, 
    profile: SpotifyProfile, 
    preferences: MusicPreferences
  ) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        spotify_id: profile.id,
        spotify_connected: true,
        spotify_display_name: profile.display_name,
        music_preferences: preferences,
        spotify_followers: profile.followers.total,
        connected_at: new Date()
      }
    });
  }

  private async generateEventRecommendations(preferences: MusicPreferences) {
    // Find events with artists matching user's taste
    const artistIds = preferences.topArtists.map(artist => artist.id);
    
    const recommendedEvents = await this.prisma.event.findMany({
      where: {
        artist: {
          spotify_id: { in: artistIds }
        },
        date: { gte: new Date() },
        status: 'ACTIVE'
      },
      include: {
        artist: true,
        venue: true
      },
      take: 10
    });

    // Find events by genre similarity
    const genreEvents = await this.prisma.event.findMany({
      where: {
        artist: {
          genres: { hasSome: preferences.genres }
        },
        date: { gte: new Date() },
        status: 'ACTIVE'
      },
      include: {
        artist: true,
        venue: true
      },
      take: 20
    });

    // Combine and deduplicate
    const allEvents = [...recommendedEvents, ...genreEvents];
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );

    // Score events based on preference match
    return uniqueEvents.map(event => ({
      ...event,
      matchScore: this.calculateMatchScore(event, preferences)
    })).sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
  }

  private calculateMatchScore(event: any, preferences: MusicPreferences): number {
    let score = 0;

    // Artist match (highest weight)
    if (preferences.topArtists.some(artist => artist.id === event.artist.spotify_id)) {
      score += 50;
    }

    // Genre match
    const genreMatches = event.artist.genres.filter((genre: string) => 
      preferences.genres.includes(genre)
    ).length;
    score += genreMatches * 10;

    // Popularity factor
    score += (event.artist.spotify_popularity || 0) * 0.2;

    return score;
  }

  async syncUserPlaylists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { spotify_id: true }
    });

    if (!user?.spotify_id) return;

    const playlists = await this.spotify.currentUser.playlists.playlists(50);
    
    // Look for event-related playlists
    const eventPlaylists = playlists.items.filter(playlist => 
      playlist.name.toLowerCase().includes('concert') ||
      playlist.name.toLowerCase().includes('festival') ||
      playlist.name.toLowerCase().includes('live')
    );

    // Store playlist data for event recommendations
    await this.prisma.userSpotifyData.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        playlists: eventPlaylists.map(p => ({
          id: p.id,
          name: p.name,
          track_count: p.tracks.total
        })),
        last_synced: new Date()
      },
      update: {
        playlists: eventPlaylists.map(p => ({
          id: p.id,
          name: p.name,
          track_count: p.tracks.total
        })),
        last_synced: new Date()
      }
    });
  }

  async createEventPlaylist(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true }
    });

    if (!event?.artist.spotify_id) return null;

    // Get artist's top tracks
    const topTracks = await this.spotify.artists.topTracks(event.artist.spotify_id, 'US');
    
    // Create playlist
    const playlist = await this.spotify.currentUser.playlists.createPlaylist(
      userId,
      {
        name: `🎵 ${event.name} - TicketToken`,
        description: `Get hyped for ${event.artist.name} at ${event.venue.name}! Created by TicketToken.`,
        public: true
      }
    );

    // Add tracks
    const trackUris = topTracks.tracks.slice(0, 20).map(track => track.uri);
    await this.spotify.playlists.addItemsToPlaylist(playlist.id, trackUris);

    return playlist;
  }
}

import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { PrismaClient } from '@prisma/client';

export class SpotifyPlaylistIntegrator {
  private spotify: SpotifyApi;
  private prisma: PrismaClient;

  constructor() {
    this.spotify = SpotifyApi.withClientCredentials(
      process.env.SPOTIFY_CLIENT_ID!,
      process.env.SPOTIFY_CLIENT_SECRET!
    );
    this.prisma = new PrismaClient();
  }

  async createPreEventPlaylist(eventId: string, userAccessToken: string) {
    this.spotify = SpotifyApi.withAccessToken(
      process.env.SPOTIFY_CLIENT_ID!,
      { access_token: userAccessToken }
    );

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true, venue: true }
    });

    if (!event) throw new Error('Event not found');

    // Create hype playlist
    const playlist = await this.spotify.currentUser.playlists.createPlaylist(
      await this.getCurrentUserId(),
      {
        name: `🔥 ${event.artist.name} at ${event.venue.name}`,
        description: `Get ready for the show! Curated by TicketToken for ${new Date(event.date).toLocaleDateString()}`,
        public: true
      }
    );

    // Add artist's top tracks
    if (event.artist.spotify_id) {
      const topTracks = await this.spotify.artists.topTracks(event.artist.spotify_id, 'US');
      const trackUris = topTracks.tracks.slice(0, 15).map(t => t.uri);
      
      await this.spotify.playlists.addItemsToPlaylist(playlist.id, trackUris);
    }

    // Add similar artists
    const relatedArtists = await this.spotify.artists.relatedArtists(event.artist.spotify_id!);
    for (const artist of relatedArtists.artists.slice(0, 3)) {
      const tracks = await this.spotify.artists.topTracks(artist.id, 'US');
      const trackUris = tracks.tracks.slice(0, 2).map(t => t.uri);
      await this.spotify.playlists.addItemsToPlaylist(playlist.id, trackUris);
    }

    return playlist;
  }

  private async getCurrentUserId(): Promise<string> {
    const profile = await this.spotify.currentUser.profile();
    return profile.id;
  }

  async generateFestivalPlaylist(festivalEvents: string[]) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: festivalEvents } },
      include: { artist: true }
    });

    const playlist = await this.spotify.currentUser.playlists.createPlaylist(
      await this.getCurrentUserId(),
      {
        name: '🎪 Festival Mix - TicketToken',
        description: 'All your festival artists in one playlist!',
        public: true
      }
    );

    // Add top track from each artist
    for (const event of events) {
      if (event.artist.spotify_id) {
        const topTracks = await this.spotify.artists.topTracks(event.artist.spotify_id, 'US');
        if (topTracks.tracks.length > 0) {
          await this.spotify.playlists.addItemsToPlaylist(
            playlist.id, 
            [topTracks.tracks[0].uri]
          );
        }
      }
    }

    return playlist;
  }
}

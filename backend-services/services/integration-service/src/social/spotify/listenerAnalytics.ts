import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { PrismaClient } from '@prisma/client';

interface ListeningInsights {
  topGenres: Array<{ genre: string; percentage: number }>;
  listeningTime: string; // 'morning', 'afternoon', 'evening', 'night'
  energyLevel: 'low' | 'medium' | 'high';
  danceability: 'low' | 'medium' | 'high';
  musicalEra: string; // Based on release dates
  recommendations: {
    eventTypes: string[];
    venues: string[];
    timeSlots: string[];
  };
}

export class SpotifyListenerAnalytics {
  private spotify: SpotifyApi;
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async analyzeListeningPatterns(userId: string, accessToken: string): Promise<ListeningInsights> {
    this.spotify = SpotifyApi.withAccessToken(
      process.env.SPOTIFY_CLIENT_ID!,
      { access_token: accessToken }
    );

    // Get comprehensive listening data
    const [recentTracks, topArtists, topTracks] = await Promise.all([
      this.spotify.player.getRecentlyPlayedTracks(50),
      this.spotify.currentUser.topItems('artists', 'long_term', 50),
      this.spotify.currentUser.topItems('tracks', 'long_term', 50)
    ]);

    // Analyze audio features
    const trackIds = topTracks.items.map(track => track.id);
    const audioFeatures = await this.spotify.tracks.audioFeatures(trackIds);

    // Extract genre preferences
    const genreMap = new Map<string, number>();
    topArtists.items.forEach(artist => {
      artist.genres.forEach(genre => {
        genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
      });
    });

    const totalGenres = Array.from(genreMap.values()).reduce((a, b) => a + b, 0);
    const topGenres = Array.from(genreMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre, count]) => ({
        genre,
        percentage: Math.round((count / totalGenres) * 100)
      }));

    // Analyze listening times
    const listeningTimes = recentTracks.items.map(item => 
      new Date(item.played_at).getHours()
    );
    const listeningTime = this.determinePreferredListeningTime(listeningTimes);

    // Calculate music characteristics
    const avgFeatures = audioFeatures.reduce((acc, features) => ({
      energy: acc.energy + features.energy,
      danceability: acc.danceability + features.danceability,
      valence: acc.valence + features.valence
    }), { energy: 0, danceability: 0, valence: 0 });

    const featureCount = audioFeatures.length;
    const energyLevel = this.categorizeLevel(avgFeatures.energy / featureCount);
    const danceability = this.categorizeLevel(avgFeatures.danceability / featureCount);

    // Determine musical era preference
    const releaseDates = topTracks.items.map(track => 
      new Date(track.album.release_date).getFullYear()
    );
    const musicalEra = this.determineMusicalEra(releaseDates);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      topGenres,
      listeningTime,
      energyLevel,
      danceability,
      musicalEra
    });

    const insights: ListeningInsights = {
      topGenres,
      listeningTime,
      energyLevel,
      danceability,
      musicalEra,
      recommendations
    };

    // Store insights for future use
    await this.storeListeningInsights(userId, insights);

    return insights;
  }

  private determinePreferredListeningTime(hours: number[]): string {
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    
    hours.forEach(hour => {
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
      else if (hour >= 18 && hour < 24) timeSlots.evening++;
      else timeSlots.night++;
    });

    return Object.entries(timeSlots)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  private categorizeLevel(value: number): 'low' | 'medium' | 'high' {
    if (value < 0.4) return 'low';
    if (value < 0.7) return 'medium';
    return 'high';
  }

  private determineMusicalEra(years: number[]): string {
    const avgYear = years.reduce((a, b) => a + b, 0) / years.length;
    
    if (avgYear >= 2020) return 'current';
    if (avgYear >= 2010) return '2010s';
    if (avgYear >= 2000) return '2000s';
    if (avgYear >= 1990) return '90s';
    return 'classic';
  }

  private generateRecommendations(insights: any) {
    const eventTypes = [];
    const venues = [];
    const timeSlots = [];

    // Event type recommendations based on genres
    const genreMap: Record<string, string[]> = {
      'electronic': ['club nights', 'festivals', 'warehouse parties'],
      'hip hop': ['hip hop shows', 'rap battles', 'urban festivals'],
      'rock': ['rock concerts', 'music festivals', 'intimate venues'],
      'jazz': ['jazz clubs', 'intimate venues', 'music lounges'],
      'pop': ['pop concerts', 'festivals', 'arena shows']
    };

    insights.topGenres.forEach((genre: any) => {
      const recommendations = genreMap[genre.genre.toLowerCase()];
      if (recommendations) {
        eventTypes.push(...recommendations);
      }
    });

    // Venue recommendations based on energy/danceability
    if (insights.energyLevel === 'high' && insights.danceability === 'high') {
      venues.push('clubs', 'dance venues', 'outdoor festivals');
    } else if (insights.energyLevel === 'low') {
      venues.push('intimate venues', 'acoustic rooms', 'lounges');
    } else {
      venues.push('theaters', 'concert halls', 'mid-size venues');
    }

    // Time slot recommendations
    if (insights.listeningTime === 'evening' || insights.listeningTime === 'night') {
      timeSlots.push('evening shows', 'late night events');
    } else {
      timeSlots.push('matinee shows', 'afternoon concerts');
    }

    return {
      eventTypes: [...new Set(eventTypes)],
      venues: [...new Set(venues)],
      timeSlots: [...new Set(timeSlots)]
    };
  }

  private async storeListeningInsights(userId: string, insights: ListeningInsights) {
    await this.prisma.userListeningInsights.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        insights: insights,
        analyzed_at: new Date()
      },
      update: {
        insights: insights,
        analyzed_at: new Date()
      }
    });
  }

  async getStoredInsights(userId: string): Promise<ListeningInsights | null> {
    const stored = await this.prisma.userListeningInsights.findUnique({
      where: { user_id: userId }
    });

    return stored?.insights as ListeningInsights || null;
  }
}

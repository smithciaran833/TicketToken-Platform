import { TwitterApi } from 'twitter-api-v2';
import { PrismaClient } from '@prisma/client';

interface SocialProofMetrics {
  eventId: string;
  mentions: number;
  hashtag_usage: number;
  retweets: number;
  likes: number;
  engagement_rate: number;
  sentiment_score: number;
  trending_potential: number;
  viral_coefficient: number;
}

interface TrendingHashtag {
  hashtag: string;
  count: number;
  growth_rate: number;
  events: string[];
}

export class TwitterSocialProofTracker {
  private twitter: TwitterApi;
  private prisma: PrismaClient;

  constructor() {
    this.twitter = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
    this.prisma = new PrismaClient();
  }

  async trackEventSocialProof(eventId: string): Promise<SocialProofMetrics> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true, venue: true }
    });

    if (!event) throw new Error('Event not found');

    // Search for event-related tweets
    const searchQueries = [
      `"${event.artist.name}" "${event.venue.name}"`,
      `#${event.artist.name.replace(/\s+/g, '')}`,
      `"${event.name}"`,
      `"TicketToken" "${event.artist.name}"`
    ];

    let totalMentions = 0;
    let totalEngagement = 0;
    let sentimentScores: number[] = [];

    for (const query of searchQueries) {
      try {
        const tweets = await this.twitter.v2.search(query, {
          max_results: 100,
          'tweet.fields': ['public_metrics', 'created_at', 'context_annotations'],
          expansions: ['author_id']
        });

        if (tweets.data) {
          for (const tweet of tweets.data) {
            totalMentions++;
            
            const metrics = tweet.public_metrics;
            if (metrics) {
              totalEngagement += metrics.retweet_count + metrics.like_count + metrics.reply_count;
            }

            // Analyze sentiment (simplified)
            const sentiment = this.analyzeSentiment(tweet.text);
            sentimentScores.push(sentiment);
          }
        }
      } catch (error) {
        console.error(`Search failed for query: ${query}`, error);
      }
    }

    const avgSentiment = sentimentScores.length > 0 
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length 
      : 0;

    const engagementRate = totalMentions > 0 ? totalEngagement / totalMentions : 0;
    const viralCoefficient = this.calculateViralCoefficient(totalMentions, totalEngagement);
    const trendingPotential = this.calculateTrendingPotential(totalMentions, engagementRate, avgSentiment);

    const metrics: SocialProofMetrics = {
      eventId,
      mentions: totalMentions,
      hashtag_usage: await this.countHashtagUsage(event),
      retweets: Math.floor(totalEngagement * 0.3), // Estimated retweet portion
      likes: Math.floor(totalEngagement * 0.6), // Estimated like portion
      engagement_rate: engagementRate,
      sentiment_score: avgSentiment,
      trending_potential: trendingPotential,
      viral_coefficient: viralCoefficient
    };

    // Store metrics
    await this.prisma.socialProofMetrics.upsert({
      where: { event_id: eventId },
      create: {
        event_id: eventId,
        platform: 'twitter',
        metrics: metrics,
        tracked_at: new Date()
      },
      update: {
        metrics: metrics,
        tracked_at: new Date()
      }
    });

    return metrics;
  }

  private analyzeSentiment(text: string): number {
    // Simplified sentiment analysis
    const positiveWords = ['amazing', 'excited', 'can\'t wait', 'love', 'awesome', 'fantastic', 'incredible', 'pumped'];
    const negativeWords = ['disappointed', 'cancelled', 'expensive', 'sold out', 'hate', 'terrible', 'awful'];

    const words = text.toLowerCase().split(' ');
    let score = 0;

    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) score += 1;
      if (negativeWords.some(nw => word.includes(nw))) score -= 1;
    });

    // Normalize to -1 to 1 scale
    return Math.max(-1, Math.min(1, score / words.length * 10));
  }

  private async countHashtagUsage(event: any): Promise<number> {
    const hashtags = [
      `#${event.artist.name.replace(/\s+/g, '')}`,
      `#${event.venue.name.replace(/\s+/g, '')}`,
      '#TicketToken'
    ];

    let totalUsage = 0;

    for (const hashtag of hashtags) {
      try {
        const results = await this.twitter.v2.search(hashtag, { max_results: 10 });
        if (results.meta) {
          totalUsage += results.meta.result_count || 0;
        }
      } catch (error) {
        console.error(`Hashtag search failed: ${hashtag}`, error);
      }
    }

    return totalUsage;
  }

  private calculateViralCoefficient(mentions: number, engagement: number): number {
    if (mentions === 0) return 0;
    
    // Viral coefficient = (shares + retweets) / mentions
    // Simplified: assume 30% of engagement is shares/retweets
    const shares = engagement * 0.3;
    return shares / mentions;
  }

  private calculateTrendingPotential(mentions: number, engagement: number, sentiment: number): number {
    // Score from 0-100 based on multiple factors
    let score = 0;

    // Volume (40% weight)
    score += Math.min(40, mentions / 10); // Max 40 points for 400+ mentions

    // Engagement (40% weight) 
    score += Math.min(40, engagement / 25); // Max 40 points for 1000+ total engagement

    // Sentiment (20% weight)
    score += Math.max(0, sentiment * 20); // Max 20 points for perfect positive sentiment

    return Math.round(score);
  }

  async identifyTrendingHashtags(): Promise<TrendingHashtag[]> {
    // Get current trending topics related to music/events
    try {
      const trends = await this.twitter.v1.trendsAvailable();
      // Note: Actual trending API access requires higher Twitter API tier
      
      // For now, return mock trending hashtags based on our events
      const events = await this.prisma.event.findMany({
        where: {
          date: { gte: new Date() },
          status: 'ACTIVE'
        },
        include: { artist: true }
      });

      const trendingHashtags: TrendingHashtag[] = [];

      for (const event of events.slice(0, 5)) {
        const hashtag = `#${event.artist.name.replace(/\s+/g, '')}`;
        const count = await this.countHashtagUsage(event);
        
        trendingHashtags.push({
          hashtag,
          count,
          growth_rate: Math.random() * 100, // Would calculate actual growth
          events: [event.id]
        });
      }

      return trendingHashtags.sort((a, b) => b.count - a.count);

    } catch (error) {
      console.error('Failed to fetch trending hashtags:', error);
      return [];
    }
  }

  async generateSocialProofContent(eventId: string): Promise<string[]> {
    const metrics = await this.trackEventSocialProof(eventId);
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true, venue: true }
    });

    if (!event) return [];

    const proofPoints = [];

    if (metrics.mentions > 50) {
      proofPoints.push(`🔥 ${metrics.mentions}+ people are talking about ${event.artist.name}!`);
    }

    if (metrics.sentiment_score > 0.5) {
      proofPoints.push(`❤️ 95% positive buzz around this event!`);
    }

    if (metrics.trending_potential > 70) {
      proofPoints.push(`📈 This event is trending and tickets are flying!`);
    }

    if (metrics.viral_coefficient > 1.2) {
      proofPoints.push(`🚀 This is going viral - everyone's sharing!`);
    }

    // Add engagement-based proof
    if (metrics.engagement_rate > 5) {
      proofPoints.push(`⚡ Super high engagement - this event is electric!`);
    }

    return proofPoints;
  }

  async createSocialProofWidget(eventId: string) {
    const metrics = await this.trackEventSocialProof(eventId);
    const proofContent = await this.generateSocialProofContent(eventId);

    return {
      metrics: {
        mentions: metrics.mentions,
        engagement: Math.round(metrics.engagement_rate),
        sentiment: Math.round(metrics.sentiment_score * 100),
        trending: Math.round(metrics.trending_potential)
      },
      content: proofContent,
      widget: {
        type: 'social_proof_banner',
        display: proofContent.length > 0 ? proofContent[0] : null,
        urgency_level: metrics.trending_potential > 80 ? 'high' : 
                      metrics.trending_potential > 50 ? 'medium' : 'low'
      }
    };
  }
}

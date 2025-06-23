import { TwitterApi } from 'twitter-api-v2';
import { PrismaClient } from '@prisma/client';

interface ViralMetrics {
  eventId: string;
  hashtag: string;
  timeline: Array<{
    timestamp: Date;
    mentions: number;
    reach: number;
    engagement: number;
  }>;
  growth_rate: number;
  peak_hour: string;
  viral_triggers: string[];
  influencer_participation: Array<{
    username: string;
    followers: number;
    engagement: number;
  }>;
}

interface ViralEvent {
  id: string;
  eventId: string;
  trigger_type: 'artist_post' | 'fan_content' | 'media_coverage' | 'celebrity_mention';
  trigger_content: string;
  viral_score: number;
  reach_multiplier: number;
  started_at: Date;
  peak_at?: Date;
  ended_at?: Date;
}

export class TwitterViralTracker {
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

  async trackEventVirality(eventId: string): Promise<ViralMetrics> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true, venue: true }
    });

    if (!event) throw new Error('Event not found');

    const hashtag = `#${event.artist.name.replace(/\s+/g, '')}`;
    
    // Track mentions over the last 24 hours in hourly intervals
    const timeline = await this.buildViralTimeline(hashtag, 24);
    
    // Calculate growth rate
    const growthRate = this.calculateGrowthRate(timeline);
    
    // Find peak activity hour
    const peakHour = this.findPeakHour(timeline);
    
    // Identify viral triggers
    const viralTriggers = await this.identifyViralTriggers(eventId, hashtag);
    
    // Track influencer participation
    const influencerParticipation = await this.trackInfluencerParticipation(hashtag);

    const metrics: ViralMetrics = {
      eventId,
      hashtag,
      timeline,
      growth_rate: growthRate,
      peak_hour: peakHour,
      viral_triggers: viralTriggers,
      influencer_participation: influencerParticipation
    };

    // Store viral metrics
    await this.storeViralMetrics(metrics);

    // Check if this qualifies as a viral event
    if (this.isViralEvent(metrics)) {
      await this.recordViralEvent(eventId, metrics);
    }

    return metrics;
  }

  private async buildViralTimeline(hashtag: string, hours: number) {
    const timeline = [];
    const now = new Date();

    for (let i = hours; i >= 0; i--) {
      const timeStart = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const timeEnd = new Date(now.getTime() - ((i - 1) * 60 * 60 * 1000));

      try {
        const tweets = await this.twitter.v2.search(hashtag, {
          start_time: timeStart.toISOString(),
          end_time: timeEnd.toISOString(),
          max_results: 100,
          'tweet.fields': ['public_metrics', 'author_id'],
          expansions: ['author_id']
        });

        let hourlyMentions = 0;
        let hourlyReach = 0;
        let hourlyEngagement = 0;

        if (tweets.data) {
          for (const tweet of tweets.data) {
            hourlyMentions++;
            
            if (tweet.public_metrics) {
              hourlyEngagement += 
                tweet.public_metrics.retweet_count +
                tweet.public_metrics.like_count +
                tweet.public_metrics.reply_count;
            }

            // Estimate reach based on author followers (if available)
            // This would require additional API calls to get user details
            hourlyReach += this.estimateReach(tweet);
          }
        }

        timeline.push({
          timestamp: timeStart,
          mentions: hourlyMentions,
          reach: hourlyReach,
          engagement: hourlyEngagement
        });

      } catch (error) {
        console.error(`Timeline tracking failed for hour ${i}:`, error);
        timeline.push({
          timestamp: timeStart,
          mentions: 0,
          reach: 0,
          engagement: 0
        });
      }
    }

    return timeline;
  }

  private estimateReach(tweet: any): number {
    // Simplified reach estimation
    // In reality, you'd fetch user details to get follower count
    const baseReach = 100; // Assume average 100 followers per user
    const engagementMultiplier = tweet.public_metrics ? 
      1 + (tweet.public_metrics.retweet_count * 0.1) : 1;
    
    return Math.round(baseReach * engagementMultiplier);
  }

  private calculateGrowthRate(timeline: any[]): number {
    if (timeline.length < 2) return 0;

    const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2));
    const secondHalf = timeline.slice(Math.floor(timeline.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, hour) => sum + hour.mentions, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, hour) => sum + hour.mentions, 0) / secondHalf.length;

    if (firstHalfAvg === 0) return secondHalfAvg > 0 ? 100 : 0;

    return ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  }

  private findPeakHour(timeline: any[]): string {
    const peakEntry = timeline.reduce((max, current) => 
      current.mentions > max.mentions ? current : max
    );

    return peakEntry.timestamp.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  private async identifyViralTriggers(eventId: string, hashtag: string): Promise<string[]> {
    const triggers = [];

    // Check for artist posts
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true }
    });

    if (event?.artist.twitter_handle) {
      try {
        const artistTweets = await this.twitter.v2.userTimelineByUsername(
          event.artist.twitter_handle,
          { max_results: 10 }
        );

        if (artistTweets.data) {
          for (const tweet of artistTweets.data) {
            if (tweet.text.toLowerCase().includes(hashtag.toLowerCase().substring(1))) {
              triggers.push(`Artist posted: "${tweet.text.substring(0, 100)}..."`);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check artist tweets:', error);
      }
    }

    // Check for media coverage (simplified)
    const mediaKeywords = ['news', 'article', 'review', 'interview'];
    try {
      const mediaTweets = await this.twitter.v2.search(
        `${hashtag} (${mediaKeywords.join(' OR ')})`,
        { max_results: 20 }
      );

      if (mediaTweets.data) {
        mediaTweets.data.forEach(tweet => {
          triggers.push(`Media coverage: "${tweet.text.substring(0, 100)}..."`);
        });
      }
    } catch (error) {
      console.error('Failed to check media coverage:', error);
    }

    // Check for high-engagement fan content
    try {
      const highEngagementTweets = await this.twitter.v2.search(hashtag, {
        max_results: 50,
        'tweet.fields': ['public_metrics']
      });

      if (highEngagementTweets.data) {
        const viralTweets = highEngagementTweets.data.filter(tweet => 
          tweet.public_metrics && 
          (tweet.public_metrics.retweet_count > 50 || tweet.public_metrics.like_count > 200)
        );

        viralTweets.forEach(tweet => {
          triggers.push(`Viral fan content: "${tweet.text.substring(0, 100)}..."`);
        });
      }
    } catch (error) {
      console.error('Failed to check fan content:', error);
    }

    return triggers;
  }

  private async trackInfluencerParticipation(hashtag: string) {
    const influencers = [];

    try {
      const tweets = await this.twitter.v2.search(hashtag, {
        max_results: 100,
        'tweet.fields': ['public_metrics', 'author_id'],
        expansions: ['author_id'],
        'user.fields': ['public_metrics']
      });

      if (tweets.data && tweets.includes?.users) {
        for (const tweet of tweets.data) {
          const author = tweets.includes.users.find(user => user.id === tweet.author_id);
          
          if (author?.public_metrics && author.public_metrics.followers_count > 10000) {
            influencers.push({
              username: author.username,
              followers: author.public_metrics.followers_count,
              engagement: tweet.public_metrics ? 
                tweet.public_metrics.retweet_count + tweet.public_metrics.like_count : 0
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to track influencer participation:', error);
    }

    return influencers.sort((a, b) => b.followers - a.followers).slice(0, 10);
  }

  private isViralEvent(metrics: ViralMetrics): boolean {
    return (
      metrics.growth_rate > 200 || // 200%+ growth
      metrics.timeline.some(hour => hour.mentions > 100) || // 100+ mentions in an hour
      metrics.influencer_participation.length > 3 // Multiple influencers participating
    );
  }

  private async recordViralEvent(eventId: string, metrics: ViralMetrics) {
    const viralScore = this.calculateViralScore(metrics);
    const reachMultiplier = this.calculateReachMultiplier(metrics);

    const viralEvent: ViralEvent = {
      id: `viral_${eventId}_${Date.now()}`,
      eventId,
      trigger_type: this.determineTriggerType(metrics.viral_triggers),
      trigger_content: metrics.viral_triggers[0] || 'Unknown trigger',
      viral_score: viralScore,
      reach_multiplier: reachMultiplier,
      started_at: new Date(),
      peak_at: new Date(metrics.peak_hour),
    };

    await this.prisma.viralEvent.create({
      data: viralEvent
    });

    // Trigger viral event notifications
    await this.notifyViralEvent(viralEvent);
  }

  private calculateViralScore(metrics: ViralMetrics): number {
    let score = 0;
    
    // Growth rate component (0-40 points)
    score += Math.min(40, metrics.growth_rate / 5);
    
    // Peak mentions component (0-30 points)
    const peakMentions = Math.max(...metrics.timeline.map(h => h.mentions));
    score += Math.min(30, peakMentions / 5);
    
    // Influencer participation (0-30 points)
    score += Math.min(30, metrics.influencer_participation.length * 5);

    return Math.round(score);
  }

  private calculateReachMultiplier(metrics: ViralMetrics): number {
    const totalReach = metrics.timeline.reduce((sum, hour) => sum + hour.reach, 0);
    const totalMentions = metrics.timeline.reduce((sum, hour) => sum + hour.mentions, 0);
    
    return totalMentions > 0 ? totalReach / totalMentions : 1;
  }

  private determineTriggerType(triggers: string[]): 'artist_post' | 'fan_content' | 'media_coverage' | 'celebrity_mention' {
    if (triggers.some(t => t.includes('Artist posted'))) return 'artist_post';
    if (triggers.some(t => t.includes('Media coverage'))) return 'media_coverage';
    if (triggers.some(t => t.includes('Viral fan content'))) return 'fan_content';
    return 'celebrity_mention';
  }

  private async storeViralMetrics(metrics: ViralMetrics) {
    await this.prisma.viralMetrics.upsert({
      where: { event_id: metrics.eventId },
      create: {
        event_id: metrics.eventId,
        platform: 'twitter',
        hashtag: metrics.hashtag,
        metrics: metrics,
        tracked_at: new Date()
      },
      update: {
        metrics: metrics,
        tracked_at: new Date()
      }
    });
  }

  private async notifyViralEvent(viralEvent: ViralEvent) {
    // Send notifications to relevant stakeholders
    console.log(`🚀 VIRAL EVENT DETECTED: ${viralEvent.id}`);
    console.log(`Score: ${viralEvent.viral_score}/100`);
    console.log(`Reach Multiplier: ${viralEvent.reach_multiplier}x`);
    
    // In a real implementation, you'd send:
    // - Slack notifications to marketing team
    // - Email alerts to event organizers
    // - Push notifications to mobile app
    // - Dashboard alerts for real-time monitoring
  }

  async getViralEventSummary(eventId: string) {
    const viralEvents = await this.prisma.viralEvent.findMany({
      where: { event_id: eventId },
      orderBy: { viral_score: 'desc' }
    });

    const metrics = await this.prisma.viralMetrics.findUnique({
      where: { event_id: eventId }
    });

    return {
      total_viral_events: viralEvents.length,
      highest_viral_score: viralEvents[0]?.viral_score || 0,
      best_trigger_type: viralEvents[0]?.trigger_type || null,
      current_metrics: metrics?.metrics || null,
      recommendations: this.generateViralRecommendations(viralEvents, metrics?.metrics)
    };
  }

  private generateViralRecommendations(viralEvents: any[], currentMetrics: any): string[] {
    const recommendations = [];

    if (viralEvents.length === 0) {
      recommendations.push('Consider reaching out to micro-influencers');
      recommendations.push('Create shareable content for fans');
      recommendations.push('Encourage artist to post about the event');
    } else {
      const bestTrigger = viralEvents[0]?.trigger_type;
      recommendations.push(`Focus on ${bestTrigger} - it worked best before`);
      
      if (currentMetrics?.growth_rate < 50) {
        recommendations.push('Growth is slow - consider promotional push');
      }
      
      if (currentMetrics?.influencer_participation?.length < 3) {
        recommendations.push('Reach out to more influencers');
      }
    }

    return recommendations;
  }
}

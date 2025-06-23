import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Pool } from 'pg';
import axios from 'axios';

interface SocialEvent {
  eventId: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'tiktok' | 'internal';
  type: 'share' | 'mention' | 'hashtag' | 'like' | 'comment' | 'view';
  userId?: string;
  content?: string;
  engagement: number;
  reach?: number;
  timestamp: Date;
  metadata?: any;
}

interface SocialMetrics {
  totalShares: number;
  totalMentions: number;
  totalEngagement: number;
  estimatedReach: number;
  viralityScore: number;
  platformBreakdown: Map<string, number>;
  trendingHashtags: Array<{tag: string, count: number}>;
  influencerMentions: Array<{handle: string, followers: number, engagement: number}>;
}

interface ViralityIndicators {
  shareVelocity: number; // shares per minute
  reachGrowthRate: number; // reach increase percentage
  engagementRate: number; // engagement vs reach ratio
  amplificationFactor: number; // how much content is being amplified
}

export class SocialMetrics extends EventEmitter {
  private redis: Redis;
  private db: Pool;
  private socialCache: Map<string, SocialMetrics> = new Map();
  private apiKeys: Map<string, string> = new Map();

  constructor(redis: Redis, db: Pool) {
    super();
    this.redis = redis;
    this.db = db;
    this.setupAPIKeys();
    this.startSocialTracking();
  }

  async trackSocialEvent(social: SocialEvent): Promise<void> {
    try {
      // Store in Redis for real-time access
      const socialKey = `social:${social.eventId}:${Date.now()}`;
      await this.redis.setex(socialKey, 86400, JSON.stringify(social));

      // Update live social metrics
      await this.updateLiveSocialMetrics(social);

      // Store in database
      await this.storeSocialInDB(social);

      // Calculate virality score
      await this.updateViralityScore(social.eventId);

      // Emit real-time event
      this.emit('socialUpdate', social);

      // Check for viral trends
      await this.checkViralTrends(social.eventId);

    } catch (error) {
      console.error('Error tracking social event:', error);
      throw error;
    }
  }

  async getLiveSocialMetrics(eventId: string): Promise<SocialMetrics> {
    try {
      const cached = this.socialCache.get(eventId);
      if (cached) return cached;

      const metrics = await this.calculateLiveSocialMetrics(eventId);
      this.socialCache.set(eventId, metrics);
      
      // Cache for 5 minutes
      setTimeout(() => this.socialCache.delete(eventId), 300000);
      
      return metrics;
    } catch (error) {
      console.error('Error getting live social metrics:', error);
      throw error;
    }
  }

  async getViralityIndicators(eventId: string): Promise<ViralityIndicators> {
    try {
      const shareVelocity = await this.calculateShareVelocity(eventId);
      const reachGrowthRate = await this.calculateReachGrowthRate(eventId);
      const engagementRate = await this.calculateEngagementRate(eventId);
      const amplificationFactor = await this.calculateAmplificationFactor(eventId);

      return {
        shareVelocity,
        reachGrowthRate,
        engagementRate,
        amplificationFactor
      };
    } catch (error) {
      console.error('Error getting virality indicators:', error);
      return {
        shareVelocity: 0,
        reachGrowthRate: 0,
        engagementRate: 0,
        amplificationFactor: 0
      };
    }
  }

  async getSocialByPlatform(eventId: string): Promise<Array<{platform: string, shares: number, engagement: number, reach: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          platform,
          COUNT(CASE WHEN type = 'share' THEN 1 END) as shares,
          SUM(engagement) as engagement,
          SUM(reach) as reach
        FROM social_log 
        WHERE event_id = $1
        GROUP BY platform
        ORDER BY engagement DESC
      `, [eventId]);

      return result.rows.map(row => ({
        platform: row.platform,
        shares: parseInt(row.shares || '0'),
        engagement: parseInt(row.engagement || '0'),
        reach: parseInt(row.reach || '0')
      }));
    } catch (error) {
      console.error('Error getting social by platform:', error);
      return [];
    }
  }

  async getTrendingHashtags(eventId: string, limit: number = 10): Promise<Array<{tag: string, count: number, growth: number}>> {
    try {
      // Extract hashtags from content and track their frequency
      const result = await this.db.query(`
        WITH hashtag_extraction AS (
          SELECT 
            regexp_split_to_table(content, E'\\s+') as word,
            timestamp
          FROM social_log 
          WHERE event_id = $1 
            AND content IS NOT NULL
            AND timestamp >= NOW() - INTERVAL '24 hours'
        ),
        hashtags AS (
          SELECT 
            word as tag,
            DATE_TRUNC('hour', timestamp) as hour
          FROM hashtag_extraction
          WHERE word LIKE '#%'
        ),
        current_counts AS (
          SELECT tag, COUNT(*) as current_count
          FROM hashtags
          WHERE hour >= NOW() - INTERVAL '6 hours'
          GROUP BY tag
        ),
        previous_counts AS (
          SELECT tag, COUNT(*) as previous_count
          FROM hashtags
          WHERE hour >= NOW() - INTERVAL '12 hours' 
            AND hour < NOW() - INTERVAL '6 hours'
          GROUP BY tag
        )
        SELECT 
          c.tag,
          c.current_count as count,
          CASE 
            WHEN p.previous_count > 0 THEN 
              ((c.current_count - p.previous_count)::float / p.previous_count * 100)
            ELSE 100
          END as growth
        FROM current_counts c
        LEFT JOIN previous_counts p ON c.tag = p.tag
        ORDER BY c.current_count DESC
        LIMIT $2
      `, [eventId, limit]);

      return result.rows.map(row => ({
        tag: row.tag,
        count: parseInt(row.count),
        growth: parseFloat(row.growth || '0')
      }));
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      return [];
    }
  }

  async getInfluencerMentions(eventId: string): Promise<Array<{handle: string, platform: string, followers: number, engagement: number, content: string}>> {
    try {
      // Get mentions from accounts with significant followings
      const result = await this.db.query(`
        SELECT 
          (metadata->>'handle') as handle,
          platform,
          (metadata->>'followers')::int as followers,
          engagement,
          content
        FROM social_log 
        WHERE event_id = $1 
          AND type = 'mention'
          AND (metadata->>'followers')::int > 1000
        ORDER BY (metadata->>'followers')::int DESC, engagement DESC
        LIMIT 20
      `, [eventId]);

      return result.rows.map(row => ({
        handle: row.handle || '',
        platform: row.platform,
        followers: parseInt(row.followers || '0'),
        engagement: parseInt(row.engagement || '0'),
        content: row.content || ''
      }));
    } catch (error) {
      console.error('Error getting influencer mentions:', error);
      return [];
    }
  }

  async getSocialTimeline(eventId: string, hours: number = 24): Promise<Array<{hour: string, shares: number, mentions: number, engagement: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(CASE WHEN type = 'share' THEN 1 END) as shares,
          COUNT(CASE WHEN type = 'mention' THEN 1 END) as mentions,
          SUM(engagement) as engagement
        FROM social_log 
        WHERE event_id = $1 
          AND timestamp >= NOW() - INTERVAL '${hours} hours'
        GROUP BY hour
        ORDER BY hour
      `, [eventId]);

      return result.rows.map(row => ({
        hour: row.hour.toISOString(),
        shares: parseInt(row.shares || '0'),
        mentions: parseInt(row.mentions || '0'),
        engagement: parseInt(row.engagement || '0')
      }));
    } catch (error) {
      console.error('Error getting social timeline:', error);
      return [];
    }
  }

  async monitorExternalMentions(eventId: string): Promise<void> {
    try {
      // Get event details for monitoring
      const eventResult = await this.db.query(`
        SELECT name, hashtags 
        FROM events 
        WHERE id = $1
      `, [eventId]);

      if (eventResult.rows.length === 0) return;

      const event = eventResult.rows[0];
      const searchTerms = [event.name, ...(event.hashtags || [])];

      // Monitor each platform
      await Promise.all([
        this.monitorTwitter(eventId, searchTerms),
        this.monitorInstagram(eventId, searchTerms),
        // Add other platforms as needed
      ]);

    } catch (error) {
      console.error('Error monitoring external mentions:', error);
    }
  }

  private async calculateShareVelocity(eventId: string, timeWindow: number = 300): Promise<number> {
    try {
      const now = Date.now();
      const start = now - (timeWindow * 1000);
      
      const shares = await this.redis.eval(`
        local shares = 0
        local keys = redis.call('KEYS', 'social:' .. ARGV[1] .. ':*')
        for i=1,#keys do
          local timestamp = string.match(keys[i], ':(%d+)$')
          if tonumber(timestamp) >= tonumber(ARGV[2]) then
            local data = redis.call('GET', keys[i])
            if data then
              local social = cjson.decode(data)
              if social.type == 'share' then
                shares = shares + 1
              end
            end
          end
        end
        return shares
      `, 0, eventId, start.toString()) as number;

      return shares / (timeWindow / 60); // shares per minute
    } catch (error) {
      console.error('Error calculating share velocity:', error);
      return 0;
    }
  }

  private async calculateReachGrowthRate(eventId: string): Promise<number> {
    try {
      const currentReach = await this.redis.get(`reach:${eventId}:current`) || '0';
      const previousReach = await this.redis.get(`reach:${eventId}:previous`) || '0';
      
      const current = parseInt(currentReach);
      const previous = parseInt(previousReach);
      
      if (previous === 0) return 100;
      
      return ((current - previous) / previous) * 100;
    } catch (error) {
      console.error('Error calculating reach growth rate:', error);
      return 0;
    }
  }

  private async calculateEngagementRate(eventId: string): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT 
          SUM(engagement) as total_engagement,
          SUM(reach) as total_reach
        FROM social_log 
        WHERE event_id = $1 
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `, [eventId]);

      const totalEngagement = parseInt(result.rows[0].total_engagement || '0');
      const totalReach = parseInt(result.rows[0].total_reach || '0');
      
      return totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
    }
  }

  private async calculateAmplificationFactor(eventId: string): Promise<number> {
    try {
      // Amplification = how much content is being reshared vs original shares
      const result = await this.db.query(`
        SELECT 
          COUNT(CASE WHEN type = 'share' AND metadata->>'is_original' = 'true' THEN 1 END) as original_shares,
          COUNT(CASE WHEN type = 'share' AND metadata->>'is_original' = 'false' THEN 1 END) as reshares
        FROM social_log 
        WHERE event_id = $1 
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `, [eventId]);

      const originalShares = parseInt(result.rows[0].original_shares || '0');
      const reshares = parseInt(result.rows[0].reshares || '0');
      
      return originalShares > 0 ? reshares / originalShares : 0;
    } catch (error) {
      console.error('Error calculating amplification factor:', error);
      return 0;
    }
  }

  private async updateLiveSocialMetrics(social: SocialEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Update counters by type
    pipeline.hincrby(`social:${social.eventId}`, social.type, 1);
    
    // Update engagement
    pipeline.hincrbyfloat(`social:${social.eventId}`, 'engagement', social.engagement);
    
    // Update reach if provided
    if (social.reach) {
      pipeline.hincrbyfloat(`social:${social.eventId}`, 'reach', social.reach);
    }
    
    // Update platform breakdown
    pipeline.hincrby(`social:${social.eventId}:platforms`, social.platform, 1);
    
    // Set expiration
    pipeline.expire(`social:${social.eventId}`, 86400);
    
    await pipeline.exec();
  }

  private async calculateLiveSocialMetrics(eventId: string): Promise<SocialMetrics> {
    const socialData = await this.redis.hmget(
      `social:${eventId}`,
      'share', 'mention', 'engagement', 'reach'
    );

    const totalShares = parseInt(socialData[0] || '0');
    const totalMentions = parseInt(socialData[1] || '0');
    const totalEngagement = parseInt(socialData[2] || '0');
    const estimatedReach = parseInt(socialData[3] || '0');

    // Calculate virality score (simplified algorithm)
    const viralityScore = this.calculateViralityScore(totalShares, totalEngagement, estimatedReach);

    // Get platform breakdown
    const platformData = await this.redis.hgetall(`social:${eventId}:platforms`);
    const platformBreakdown = new Map(Object.entries(platformData).map(([k, v]) => [k, parseInt(v)]));

    // Get trending hashtags and influencer mentions from DB
    const trendingHashtags = await this.getTrendingHashtags(eventId, 5);
    const influencerMentions = await this.getInfluencerMentions(eventId);

    return {
      totalShares,
      totalMentions,
      totalEngagement,
      estimatedReach,
      viralityScore,
      platformBreakdown,
      trendingHashtags,
      influencerMentions
    };
  }

  private calculateViralityScore(shares: number, engagement: number, reach: number): number {
    // Proprietary virality algorithm
    const shareWeight = 0.4;
    const engagementWeight = 0.3;
    const reachWeight = 0.3;
    
    // Normalize values (simplified)
    const normalizedShares = Math.min(shares / 100, 1);
    const normalizedEngagement = Math.min(engagement / 1000, 1);
    const normalizedReach = Math.min(reach / 10000, 1);
    
    return Math.round(
      (normalizedShares * shareWeight + 
       normalizedEngagement * engagementWeight + 
       normalizedReach * reachWeight) * 100
    );
  }

  private async updateViralityScore(eventId: string): Promise<void> {
    const metrics = await this.getLiveSocialMetrics(eventId);
    await this.redis.set(`virality:${eventId}`, metrics.viralityScore, 'EX', 3600);
  }

  private async storeSocialInDB(social: SocialEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO social_log (
        event_id, platform, type, user_id, content,
        engagement, reach, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      social.eventId, social.platform, social.type, social.userId,
      social.content, social.engagement, social.reach || 0,
      social.timestamp, JSON.stringify(social.metadata || {})
    ]);
  }

  private async checkViralTrends(eventId: string): Promise<void> {
    const indicators = await this.getViralityIndicators(eventId);
    
    // Check for viral thresholds
    if (indicators.shareVelocity > 10) { // 10 shares per minute
      this.emit('viralTrend', {
        eventId,
        type: 'high_velocity',
        indicators
      });
    }
    
    if (indicators.amplificationFactor > 5) { // High amplification
      this.emit('viralTrend', {
        eventId,
        type: 'high_amplification',
        indicators
      });
    }
  }

  private async monitorTwitter(eventId: string, searchTerms: string[]): Promise<void> {
    // Implement Twitter API monitoring
    // This would use Twitter API v2 to search for mentions
    try {
      const twitterKey = this.apiKeys.get('twitter');
      if (!twitterKey) return;

      for (const term of searchTerms) {
        // Implementation would go here
        // const response = await axios.get(`https://api.twitter.com/2/tweets/search/recent`, {
        //   headers: { Authorization: `Bearer ${twitterKey}` },
        //   params: { query: term }
        // });
      }
    } catch (error) {
      console.error('Error monitoring Twitter:', error);
    }
  }

  private async monitorInstagram(eventId: string, searchTerms: string[]): Promise<void> {
    // Implement Instagram API monitoring
    // This would use Instagram Basic Display API
    try {
      const instagramKey = this.apiKeys.get('instagram');
      if (!instagramKey) return;

      // Implementation would go here
    } catch (error) {
      console.error('Error monitoring Instagram:', error);
    }
  }

  private setupAPIKeys(): void {
    // Set up API keys from environment variables
    this.apiKeys.set('twitter', process.env.TWITTER_BEARER_TOKEN || '');
    this.apiKeys.set('instagram', process.env.INSTAGRAM_ACCESS_TOKEN || '');
    this.apiKeys.set('facebook', process.env.FACEBOOK_ACCESS_TOKEN || '');
  }

  private startSocialTracking(): void {
    // Refresh social cache periodically
    setInterval(async () => {
      try {
        for (const [eventId] of this.socialCache) {
          const freshMetrics = await this.calculateLiveSocialMetrics(eventId);
          this.socialCache.set(eventId, freshMetrics);
        }
      } catch (error) {
        console.error('Error refreshing social cache:', error);
      }
    }, 300000); // Every 5 minutes

    // Monitor external mentions periodically
    setInterval(async () => {
      try {
        // Get active events
        const activeEvents = await this.db.query(`
          SELECT id FROM events 
          WHERE start_time <= NOW() 
            AND end_time >= NOW()
        `);

        for (const event of activeEvents.rows) {
          await this.monitorExternalMentions(event.id);
        }
      } catch (error) {
        console.error('Error monitoring external mentions:', error);
      }
    }, 600000); // Every 10 minutes
  }
}

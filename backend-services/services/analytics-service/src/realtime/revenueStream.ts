import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Pool } from 'pg';

interface RevenueEvent {
  eventId: string;
  transactionId: string;
  amount: number;
  currency: string;
  type: 'primary_sale' | 'secondary_sale' | 'royalty' | 'refund';
  timestamp: Date;
  metadata: {
    ticketId?: string;
    userId?: string;
    fees?: number;
    artistRoyalty?: number;
    venueShare?: number;
    platformShare?: number;
  };
}

interface RevenueMetrics {
  totalRevenue: number;
  primaryRevenue: number;
  secondaryRevenue: number;
  royaltyRevenue: number;
  revenuePerMinute: number;
  projectedTotal: number;
  artistEarnings: number;
  venueEarnings: number;
  platformEarnings: number;
}

interface RevenueSplit {
  artist: number;
  venue: number;
  platform: number;
  fees: number;
}

export class RevenueStream extends EventEmitter {
  private redis: Redis;
  private db: Pool;
  private revenueCache: Map<string, RevenueMetrics> = new Map();

  constructor(redis: Redis, db: Pool) {
    super();
    this.redis = redis;
    this.db = db;
    this.startRevenueTracking();
  }

  async trackRevenue(revenue: RevenueEvent): Promise<void> {
    try {
      // Store in Redis for real-time access
      const revenueKey = `revenue:${revenue.eventId}:${Date.now()}`;
      await this.redis.setex(revenueKey, 86400, JSON.stringify(revenue));

      // Update live revenue metrics
      await this.updateLiveRevenue(revenue);

      // Store in database
      await this.storeRevenueInDB(revenue);

      // Emit real-time event
      this.emit('revenueUpdate', revenue);

      // Check for revenue milestones
      await this.checkRevenueMilestones(revenue.eventId);

    } catch (error) {
      console.error('Error tracking revenue:', error);
      throw error;
    }
  }

  async getLiveRevenueMetrics(eventId: string): Promise<RevenueMetrics> {
    try {
      const cached = this.revenueCache.get(eventId);
      if (cached) return cached;

      const metrics = await this.calculateLiveRevenue(eventId);
      this.revenueCache.set(eventId, metrics);
      
      // Cache for 60 seconds
      setTimeout(() => this.revenueCache.delete(eventId), 60000);
      
      return metrics;
    } catch (error) {
      console.error('Error getting live revenue metrics:', error);
      throw error;
    }
  }

  async getRevenueByTimeframe(eventId: string, timeframe: 'hour' | 'day' | 'week'): Promise<Array<{period: string, revenue: number, transactions: number}>> {
    try {
      let truncateFormat: string;
      let interval: string;

      switch (timeframe) {
        case 'hour':
          truncateFormat = 'hour';
          interval = '24 hours';
          break;
        case 'day':
          truncateFormat = 'day';
          interval = '30 days';
          break;
        case 'week':
          truncateFormat = 'week';
          interval = '12 weeks';
          break;
      }

      const result = await this.db.query(`
        SELECT 
          DATE_TRUNC($1, timestamp) as period,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM revenue_log 
        WHERE event_id = $2 
          AND timestamp >= NOW() - INTERVAL '${interval}'
        GROUP BY period
        ORDER BY period
      `, [truncateFormat, eventId]);

      return result.rows.map(row => ({
        period: row.period.toISOString(),
        revenue: parseFloat(row.revenue),
        transactions: parseInt(row.transactions)
      }));
    } catch (error) {
      console.error('Error getting revenue by timeframe:', error);
      return [];
    }
  }

  async getRevenueSplit(eventId: string): Promise<RevenueSplit> {
    try {
      const result = await this.db.query(`
        SELECT 
          SUM(CASE WHEN type = 'primary_sale' OR type = 'secondary_sale' THEN 
            (metadata->>'artistRoyalty')::numeric ELSE 0 END) as artist,
          SUM(CASE WHEN type = 'primary_sale' OR type = 'secondary_sale' THEN 
            (metadata->>'venueShare')::numeric ELSE 0 END) as venue,
          SUM(CASE WHEN type = 'primary_sale' OR type = 'secondary_sale' THEN 
            (metadata->>'platformShare')::numeric ELSE 0 END) as platform,
          SUM(CASE WHEN type = 'primary_sale' OR type = 'secondary_sale' THEN 
            (metadata->>'fees')::numeric ELSE 0 END) as fees
        FROM revenue_log 
        WHERE event_id = $1
      `, [eventId]);

      const row = result.rows[0];
      return {
        artist: parseFloat(row.artist || '0'),
        venue: parseFloat(row.venue || '0'),
        platform: parseFloat(row.platform || '0'),
        fees: parseFloat(row.fees || '0')
      };
    } catch (error) {
      console.error('Error getting revenue split:', error);
      return { artist: 0, venue: 0, platform: 0, fees: 0 };
    }
  }

  async getRevenueBySource(eventId: string): Promise<Array<{source: string, amount: number, percentage: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          type as source,
          SUM(amount) as amount,
          COUNT(*) as transactions
        FROM revenue_log 
        WHERE event_id = $1
        GROUP BY type
        ORDER BY amount DESC
      `, [eventId]);

      const totalRevenue = result.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);

      return result.rows.map(row => ({
        source: row.source,
        amount: parseFloat(row.amount),
        percentage: totalRevenue > 0 ? (parseFloat(row.amount) / totalRevenue) * 100 : 0
      }));
    } catch (error) {
      console.error('Error getting revenue by source:', error);
      return [];
    }
  }

  async getTopRevenueEvents(limit: number = 10): Promise<Array<{eventId: string, eventName: string, totalRevenue: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          r.event_id,
          e.name as event_name,
          SUM(r.amount) as total_revenue
        FROM revenue_log r
        JOIN events e ON r.event_id = e.id
        WHERE r.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY r.event_id, e.name
        ORDER BY total_revenue DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        eventId: row.event_id,
        eventName: row.event_name,
        totalRevenue: parseFloat(row.total_revenue)
      }));
    } catch (error) {
      console.error('Error getting top revenue events:', error);
      return [];
    }
  }

  async getRevenueProjection(eventId: string): Promise<{projected: number, confidence: number}> {
    try {
      // Get historical revenue pattern
      const historicalData = await this.getRevenueByTimeframe(eventId, 'hour');
      
      if (historicalData.length < 3) {
        return { projected: 0, confidence: 0 };
      }

      // Simple linear projection based on recent trend
      const recentHours = historicalData.slice(-6); // Last 6 hours
      const avgHourlyRevenue = recentHours.reduce((sum, h) => sum + h.revenue, 0) / recentHours.length;
      
      // Get event duration
      const eventResult = await this.db.query(`
        SELECT 
          EXTRACT(EPOCH FROM (end_time - start_time))/3600 as duration_hours,
          EXTRACT(EPOCH FROM (NOW() - start_time))/3600 as elapsed_hours
        FROM events 
        WHERE id = $1
      `, [eventId]);

      const durationHours = parseFloat(eventResult.rows[0]?.duration_hours || '24');
      const elapsedHours = parseFloat(eventResult.rows[0]?.elapsed_hours || '0');
      const remainingHours = Math.max(0, durationHours - elapsedHours);

      const projectedAdditional = avgHourlyRevenue * remainingHours;
      const currentRevenue = (await this.getLiveRevenueMetrics(eventId)).totalRevenue;
      const projected = currentRevenue + projectedAdditional;

      // Confidence based on data quality and trend stability
      const confidence = Math.min(95, Math.max(20, recentHours.length * 15));

      return { projected, confidence };
    } catch (error) {
      console.error('Error calculating revenue projection:', error);
      return { projected: 0, confidence: 0 };
    }
  }

  private async updateLiveRevenue(revenue: RevenueEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Update total revenue
    pipeline.hincrbyfloat(`revenue:${revenue.eventId}`, 'total', revenue.amount);
    
    // Update by type
    pipeline.hincrbyfloat(`revenue:${revenue.eventId}`, revenue.type, revenue.amount);
    
    // Update split amounts
    if (revenue.metadata.artistRoyalty) {
      pipeline.hincrbyfloat(`revenue:${revenue.eventId}`, 'artist', revenue.metadata.artistRoyalty);
    }
    if (revenue.metadata.venueShare) {
      pipeline.hincrbyfloat(`revenue:${revenue.eventId}`, 'venue', revenue.metadata.venueShare);
    }
    if (revenue.metadata.platformShare) {
      pipeline.hincrbyfloat(`revenue:${revenue.eventId}`, 'platform', revenue.metadata.platformShare);
    }
    
    // Track transaction count
    pipeline.hincrby(`revenue:${revenue.eventId}`, 'transactions', 1);
    
    // Set expiration
    pipeline.expire(`revenue:${revenue.eventId}`, 86400);
    
    await pipeline.exec();
  }

  private async calculateLiveRevenue(eventId: string): Promise<RevenueMetrics> {
    const revenueData = await this.redis.hmget(
      `revenue:${eventId}`,
      'total', 'primary_sale', 'secondary_sale', 'royalty',
      'artist', 'venue', 'platform', 'transactions'
    );

    const totalRevenue = parseFloat(revenueData[0] || '0');
    const primaryRevenue = parseFloat(revenueData[1] || '0');
    const secondaryRevenue = parseFloat(revenueData[2] || '0');
    const royaltyRevenue = parseFloat(revenueData[3] || '0');
    const artistEarnings = parseFloat(revenueData[4] || '0');
    const venueEarnings = parseFloat(revenueData[5] || '0');
    const platformEarnings = parseFloat(revenueData[6] || '0');

    // Calculate revenue per minute (simplified)
    const revenuePerMinute = await this.calculateRevenueVelocity(eventId);
    
    // Get projection
    const projection = await this.getRevenueProjection(eventId);

    return {
      totalRevenue,
      primaryRevenue,
      secondaryRevenue,
      royaltyRevenue,
      revenuePerMinute,
      projectedTotal: projection.projected,
      artistEarnings,
      venueEarnings,
      platformEarnings
    };
  }

  private async calculateRevenueVelocity(eventId: string, timeWindow: number = 300): Promise<number> {
    try {
      const now = Date.now();
      const start = now - (timeWindow * 1000);
      
      const recentRevenue = await this.redis.eval(`
        local total = 0
        local keys = redis.call('KEYS', 'revenue:' .. ARGV[1] .. ':*')
        for i=1,#keys do
          local timestamp = string.match(keys[i], ':(%d+)$')
          if tonumber(timestamp) >= tonumber(ARGV[2]) then
            local data = redis.call('GET', keys[i])
            if data then
              local revenue = cjson.decode(data)
              total = total + revenue.amount
            end
          end
        end
        return total
      `, 0, eventId, start.toString()) as number;

      return recentRevenue / (timeWindow / 60); // revenue per minute
    } catch (error) {
      console.error('Error calculating revenue velocity:', error);
      return 0;
    }
  }

  private async storeRevenueInDB(revenue: RevenueEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO revenue_log (
        event_id, transaction_id, amount, currency, type,
        timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      revenue.eventId, revenue.transactionId, revenue.amount,
      revenue.currency, revenue.type, revenue.timestamp,
      JSON.stringify(revenue.metadata)
    ]);
  }

  private async checkRevenueMilestones(eventId: string): Promise<void> {
    const metrics = await this.getLiveRevenueMetrics(eventId);
    
    // Get revenue targets
    const targetResult = await this.db.query(`
      SELECT expected_revenue 
      FROM events 
      WHERE id = $1
    `, [eventId]);

    const expectedRevenue = parseFloat(targetResult.rows[0]?.expected_revenue || '0');
    
    if (expectedRevenue > 0) {
      const percentageAchieved = (metrics.totalRevenue / expectedRevenue) * 100;
      
      if (percentageAchieved >= 50 && percentageAchieved < 75) {
        this.emit('revenueMilestone', { eventId, milestone: '50_percent', metrics });
      } else if (percentageAchieved >= 75 && percentageAchieved < 100) {
        this.emit('revenueMilestone', { eventId, milestone: '75_percent', metrics });
      } else if (percentageAchieved >= 100) {
        this.emit('revenueMilestone', { eventId, milestone: 'target_achieved', metrics });
      }
    }
  }

  private startRevenueTracking(): void {
    // Refresh revenue cache periodically
    setInterval(async () => {
      try {
        for (const [eventId] of this.revenueCache) {
          const freshMetrics = await this.calculateLiveRevenue(eventId);
          this.revenueCache.set(eventId, freshMetrics);
        }
      } catch (error) {
        console.error('Error refreshing revenue cache:', error);
      }
    }, 60000); // Every minute
  }
}

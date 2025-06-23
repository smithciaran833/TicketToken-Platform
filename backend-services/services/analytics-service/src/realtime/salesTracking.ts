import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Pool } from 'pg';

interface SaleEvent {
  eventId: string;
  ticketId: string;
  price: number;
  quantity: number;
  timestamp: Date;
  userId: string;
  tier: string;
  paymentMethod: 'card' | 'crypto';
  source: 'primary' | 'secondary';
}

interface SalesMetrics {
  totalSales: number;
  revenue: number;
  ticketsSold: number;
  averagePrice: number;
  salesVelocity: number; // sales per minute
  conversionRate: number;
}

export class SalesTracker extends EventEmitter {
  private redis: Redis;
  private db: Pool;
  private metricsCache: Map<string, SalesMetrics> = new Map();

  constructor(redis: Redis, db: Pool) {
    super();
    this.redis = redis;
    this.db = db;
    this.startRealTimeTracking();
  }

  async trackSale(sale: SaleEvent): Promise<void> {
    try {
      // Store sale in Redis for real-time access
      const saleKey = `sale:${sale.eventId}:${Date.now()}`;
      await this.redis.setex(saleKey, 3600, JSON.stringify(sale));

      // Update live metrics
      await this.updateLiveMetrics(sale.eventId, sale);

      // Store in database for historical analysis
      await this.storeSaleInDB(sale);

      // Emit real-time event
      this.emit('saleCompleted', sale);

      // Check for milestones
      await this.checkSalesMilestones(sale.eventId);

    } catch (error) {
      console.error('Error tracking sale:', error);
      throw error;
    }
  }

  async getLiveSalesMetrics(eventId: string): Promise<SalesMetrics> {
    try {
      const cached = this.metricsCache.get(eventId);
      if (cached) return cached;

      const metrics = await this.calculateLiveMetrics(eventId);
      this.metricsCache.set(eventId, metrics);
      
      // Cache for 30 seconds
      setTimeout(() => this.metricsCache.delete(eventId), 30000);
      
      return metrics;
    } catch (error) {
      console.error('Error getting live metrics:', error);
      throw error;
    }
  }

  async getSalesVelocity(eventId: string, timeWindow: number = 300): Promise<number> {
    try {
      const now = Date.now();
      const start = now - (timeWindow * 1000);
      
      const sales = await this.redis.eval(`
        local sales = {}
        local keys = redis.call('KEYS', 'sale:' .. ARGV[1] .. ':*')
        for i=1,#keys do
          local timestamp = string.match(keys[i], ':(%d+)$')
          if tonumber(timestamp) >= tonumber(ARGV[2]) then
            table.insert(sales, keys[i])
          end
        end
        return #sales
      `, 0, eventId, start.toString()) as number;

      return sales / (timeWindow / 60); // sales per minute
    } catch (error) {
      console.error('Error calculating sales velocity:', error);
      return 0;
    }
  }

  async getTopSellingTiers(eventId: string, limit: number = 5): Promise<Array<{tier: string, sold: number, revenue: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          tier,
          COUNT(*) as sold,
          SUM(price * quantity) as revenue
        FROM ticket_sales 
        WHERE event_id = $1 
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY tier
        ORDER BY revenue DESC
        LIMIT $2
      `, [eventId, limit]);

      return result.rows;
    } catch (error) {
      console.error('Error getting top selling tiers:', error);
      return [];
    }
  }

  async getRealTimeRevenue(eventId: string): Promise<{total: number, byHour: Array<{hour: string, revenue: number}>}> {
    try {
      const totalResult = await this.db.query(`
        SELECT COALESCE(SUM(price * quantity), 0) as total
        FROM ticket_sales 
        WHERE event_id = $1
      `, [eventId]);

      const hourlyResult = await this.db.query(`
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          SUM(price * quantity) as revenue
        FROM ticket_sales 
        WHERE event_id = $1 
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY hour
        ORDER BY hour
      `, [eventId]);

      return {
        total: parseFloat(totalResult.rows[0].total),
        byHour: hourlyResult.rows.map(row => ({
          hour: row.hour.toISOString(),
          revenue: parseFloat(row.revenue)
        }))
      };
    } catch (error) {
      console.error('Error getting real-time revenue:', error);
      return { total: 0, byHour: [] };
    }
  }

  private async updateLiveMetrics(eventId: string, sale: SaleEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Update counters
    pipeline.hincrby(`metrics:${eventId}`, 'totalSales', 1);
    pipeline.hincrbyfloat(`metrics:${eventId}`, 'revenue', sale.price * sale.quantity);
    pipeline.hincrby(`metrics:${eventId}`, 'ticketsSold', sale.quantity);
    
    // Track by tier
    pipeline.hincrby(`metrics:${eventId}:tiers`, sale.tier, sale.quantity);
    
    // Track by payment method
    pipeline.hincrby(`metrics:${eventId}:payment`, sale.paymentMethod, 1);
    
    // Set expiration
    pipeline.expire(`metrics:${eventId}`, 86400); // 24 hours
    
    await pipeline.exec();
  }

  private async calculateLiveMetrics(eventId: string): Promise<SalesMetrics> {
    const metrics = await this.redis.hmget(
      `metrics:${eventId}`,
      'totalSales', 'revenue', 'ticketsSold'
    );

    const totalSales = parseInt(metrics[0] || '0');
    const revenue = parseFloat(metrics[1] || '0');
    const ticketsSold = parseInt(metrics[2] || '0');

    const averagePrice = ticketsSold > 0 ? revenue / ticketsSold : 0;
    const salesVelocity = await this.getSalesVelocity(eventId);

    // Calculate conversion rate (simplified - would need more data in practice)
    const conversionRate = 0.15; // Placeholder

    return {
      totalSales,
      revenue,
      ticketsSold,
      averagePrice,
      salesVelocity,
      conversionRate
    };
  }

  private async storeSaleInDB(sale: SaleEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO ticket_sales (
        event_id, ticket_id, price, quantity, user_id, 
        tier, payment_method, source, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      sale.eventId, sale.ticketId, sale.price, sale.quantity,
      sale.userId, sale.tier, sale.paymentMethod, sale.source,
      sale.timestamp
    ]);
  }

  private async checkSalesMilestones(eventId: string): Promise<void> {
    const metrics = await this.getLiveSalesMetrics(eventId);
    
    // Check for milestones (50%, 75%, 90%, 100% sold out)
    const event = await this.db.query('SELECT capacity FROM events WHERE id = $1', [eventId]);
    const capacity = event.rows[0]?.capacity || 0;
    
    if (capacity > 0) {
      const percentSold = (metrics.ticketsSold / capacity) * 100;
      
      if (percentSold >= 50 && percentSold < 75) {
        this.emit('milestone', { eventId, milestone: '50_percent', metrics });
      } else if (percentSold >= 75 && percentSold < 90) {
        this.emit('milestone', { eventId, milestone: '75_percent', metrics });
      } else if (percentSold >= 90 && percentSold < 100) {
        this.emit('milestone', { eventId, milestone: '90_percent', metrics });
      } else if (percentSold >= 100) {
        this.emit('milestone', { eventId, milestone: 'sold_out', metrics });
      }
    }
  }

  private startRealTimeTracking(): void {
    // Subscribe to sale events from other services
    setInterval(async () => {
      try {
        // Refresh cached metrics every 30 seconds
        for (const [eventId] of this.metricsCache) {
          const freshMetrics = await this.calculateLiveMetrics(eventId);
          this.metricsCache.set(eventId, freshMetrics);
        }
      } catch (error) {
        console.error('Error refreshing metrics cache:', error);
      }
    }, 30000);
  }
}

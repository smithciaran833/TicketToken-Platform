import { Pool } from 'pg';
import Redis from 'ioredis';

interface PurchasePattern {
  timeOfDay: Array<{hour: number, purchases: number, revenue: number}>;
  dayOfWeek: Array<{day: string, purchases: number, revenue: number}>;
  seasonality: Array<{month: string, purchases: number, revenue: number}>;
  tierPreferences: Array<{tier: string, purchases: number, percentage: number}>;
  paymentMethods: Array<{method: string, usage: number, avgAmount: number}>;
  purchaseJourney: Array<{step: string, dropoffRate: number, avgTime: number}>;
}

interface BehaviorInsights {
  averageDecisionTime: number; // minutes from view to purchase
  priceElasticity: number; // how sensitive fans are to price changes
  groupBuyingRate: number; // percentage of purchases that are group buys
  repeatPurchaseRate: number; // percentage who buy multiple events
  upgradeRate: number; // percentage who upgrade tickets
  cancellationRate: number;
}

interface PurchaseSegments {
  earlyBirds: {count: number, avgSavings: number, loyaltyScore: number};
  lastMinute: {count: number, avgPremium: number, conversionRate: number};
  planners: {count: number, avgAdvanceDays: number, satisfaction: number};
  impulse: {count: number, avgDecisionTime: number, spendPattern: number};
}

export class PurchasePatterns {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async getEventPurchasePatterns(eventId: string): Promise<PurchasePattern> {
    try {
      const [
        timeOfDay,
        dayOfWeek,
        seasonality,
        tierPreferences,
        paymentMethods,
        purchaseJourney
      ] = await Promise.all([
        this.getTimeOfDayPatterns(eventId),
        this.getDayOfWeekPatterns(eventId),
        this.getSeasonalityPatterns(eventId),
        this.getTierPreferences(eventId),
        this.getPaymentMethodPatterns(eventId),
        this.getPurchaseJourney(eventId)
      ]);

      return {
        timeOfDay,
        dayOfWeek,
        seasonality,
        tierPreferences,
        paymentMethods,
        purchaseJourney
      };
    } catch (error) {
      console.error('Error getting purchase patterns:', error);
      throw error;
    }
  }

  async getBehaviorInsights(eventId: string): Promise<BehaviorInsights> {
    try {
      const [
        averageDecisionTime,
        priceElasticity,
        groupBuyingRate,
        repeatPurchaseRate,
        upgradeRate,
        cancellationRate
      ] = await Promise.all([
        this.calculateAverageDecisionTime(eventId),
        this.calculatePriceElasticity(eventId),
        this.calculateGroupBuyingRate(eventId),
        this.calculateRepeatPurchaseRate(eventId),
        this.calculateUpgradeRate(eventId),
        this.calculateCancellationRate(eventId)
      ]);

      return {
        averageDecisionTime,
        priceElasticity,
        groupBuyingRate,
        repeatPurchaseRate,
        upgradeRate,
        cancellationRate
      };
    } catch (error) {
      console.error('Error getting behavior insights:', error);
      throw error;
    }
  }

  async getPurchaseSegments(eventId: string): Promise<PurchaseSegments> {
    try {
      const segments = await this.db.query(`
        WITH purchase_timing AS (
          SELECT 
            t.*,
            e.start_time,
            EXTRACT(EPOCH FROM (t.created_at - e.announcement_date))/3600/24 as days_after_announcement,
            EXTRACT(EPOCH FROM (e.start_time - t.created_at))/3600/24 as days_before_event,
            t.metadata->>'decision_time_minutes' as decision_time
          FROM tickets t
          JOIN events e ON t.event_id = e.id
          WHERE t.event_id = $1
        ),
        classified_purchases AS (
          SELECT 
            *,
            CASE 
              WHEN days_after_announcement <= 7 THEN 'early_bird'
              WHEN days_before_event <= 3 THEN 'last_minute'
              WHEN days_after_announcement > 30 THEN 'planner'
              WHEN decision_time::int < 5 THEN 'impulse'
              ELSE 'normal'
            END as segment
          FROM purchase_timing
        )
        SELECT 
          segment,
          COUNT(*) as count,
          AVG(price) as avg_price,
          AVG(days_before_event) as avg_days_before,
          AVG(decision_time::int) as avg_decision_time
        FROM classified_purchases
        GROUP BY segment
      `, [eventId]);

      const segmentResults: any = {};
      result.rows.forEach(row => {
        segmentResults[row.segment] = {
          count: parseInt(row.count),
          avgSavings: 0, // Would calculate based on dynamic pricing
          loyaltyScore: 0, // Would calculate from user history
          avgPremium: 0,
          conversionRate: 0,
          avgAdvanceDays: parseFloat(row.avg_days_before || '0'),
          satisfaction: 0, // Would get from surveys
          avgDecisionTime: parseFloat(row.avg_decision_time || '0'),
          spendPattern: parseFloat(row.avg_price || '0')
        };
      });

      return {
        earlyBirds: segmentResults.early_bird || {count: 0, avgSavings: 0, loyaltyScore: 0},
        lastMinute: segmentResults.last_minute || {count: 0, avgPremium: 0, conversionRate: 0},
        planners: segmentResults.planner || {count: 0, avgAdvanceDays: 0, satisfaction: 0},
        impulse: segmentResults.impulse || {count: 0, avgDecisionTime: 0, spendPattern: 0}
      };
    } catch (error) {
      console.error('Error getting purchase segments:', error);
      throw error;
    }
  }

  async getConversionFunnel(eventId: string): Promise<Array<{step: string, users: number, conversionRate: number}>> {
    try {
      // Track the conversion funnel from awareness to purchase
      const result = await this.db.query(`
        WITH funnel_data AS (
          SELECT 
            'page_view' as step, COUNT(*) as users, 1 as step_order
          FROM event_analytics 
          WHERE event_id = $1 AND action = 'page_view'
          
          UNION ALL
          
          SELECT 
            'ticket_selection' as step, COUNT(*) as users, 2 as step_order
          FROM event_analytics 
          WHERE event_id = $1 AND action = 'ticket_select'
          
          UNION ALL
          
          SELECT 
            'checkout_start' as step, COUNT(*) as users, 3 as step_order
          FROM event_analytics 
          WHERE event_id = $1 AND action = 'checkout_start'
          
          UNION ALL
          
          SELECT 
            'payment_info' as step, COUNT(*) as users, 4 as step_order
          FROM event_analytics 
          WHERE event_id = $1 AND action = 'payment_info'
          
          UNION ALL
          
          SELECT 
            'purchase_complete' as step, COUNT(*) as users, 5 as step_order
          FROM tickets 
          WHERE event_id = $1
        )
        SELECT step, users, step_order
        FROM funnel_data
        ORDER BY step_order
      `, [eventId]);

      const funnel = result.rows.map((row, index) => {
        const conversionRate = index > 0 ? 
          (row.users / result.rows[index - 1].users) * 100 : 100;
        
        return {
          step: row.step,
          users: parseInt(row.users),
          conversionRate
        };
      });

      return funnel;
    } catch (error) {
      console.error('Error getting conversion funnel:', error);
      return [];
    }
  }

  private async getTimeOfDayPatterns(eventId: string): Promise<Array<{hour: number, purchases: number, revenue: number}>> {
    const result = await this.db.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as purchases,
        SUM(price) as revenue
      FROM tickets
      WHERE event_id = $1
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [eventId]);

    const patterns = Array.from({length: 24}, (_, i) => ({
      hour: i,
      purchases: 0,
      revenue: 0
    }));

    result.rows.forEach(row => {
      const hour = parseInt(row.hour);
      patterns[hour] = {
        hour,
        purchases: parseInt(row.purchases),
        revenue: parseFloat(row.revenue)
      };
    });

    return patterns;
  }

  private async getDayOfWeekPatterns(eventId: string): Promise<Array<{day: string, purchases: number, revenue: number}>> {
    const result = await this.db.query(`
      SELECT 
        TO_CHAR(created_at, 'Day') as day,
        EXTRACT(DOW FROM created_at) as day_num,
        COUNT(*) as purchases,
        SUM(price) as revenue
      FROM tickets
      WHERE event_id = $1
      GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
      ORDER BY day_num
    `, [eventId]);

    return result.rows.map(row => ({
      day: row.day.trim(),
      purchases: parseInt(row.purchases),
      revenue: parseFloat(row.revenue)
    }));
  }

  private async getSeasonalityPatterns(eventId: string): Promise<Array<{month: string, purchases: number, revenue: number}>> {
    const result = await this.db.query(`
      SELECT 
        TO_CHAR(created_at, 'Month') as month,
        EXTRACT(MONTH FROM created_at) as month_num,
        COUNT(*) as purchases,
        SUM(price) as revenue
      FROM tickets
      WHERE event_id = $1
      GROUP BY TO_CHAR(created_at, 'Month'), EXTRACT(MONTH FROM created_at)
      ORDER BY month_num
    `, [eventId]);

    return result.rows.map(row => ({
      month: row.month.trim(),
      purchases: parseInt(row.purchases),
      revenue: parseFloat(row.revenue)
    }));
  }

  private async getTierPreferences(eventId: string): Promise<Array<{tier: string, purchases: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        tier,
        COUNT(*) as purchases
      FROM tickets
      WHERE event_id = $1
      GROUP BY tier
      ORDER BY purchases DESC
    `, [eventId]);

    const totalPurchases = result.rows.reduce((sum, row) => sum + parseInt(row.purchases), 0);

    return result.rows.map(row => ({
      tier: row.tier,
      purchases: parseInt(row.purchases),
      percentage: totalPurchases > 0 ? (parseInt(row.purchases) / totalPurchases) * 100 : 0
    }));
  }

  private async getPaymentMethodPatterns(eventId: string): Promise<Array<{method: string, usage: number, avgAmount: number}>> {
    const result = await this.db.query(`
      SELECT 
        payment_method as method,
        COUNT(*) as usage,
        AVG(price) as avg_amount
      FROM tickets
      WHERE event_id = $1
      GROUP BY payment_method
      ORDER BY usage DESC
    `, [eventId]);

    return result.rows.map(row => ({
      method: row.method,
      usage: parseInt(row.usage),
      avgAmount: parseFloat(row.avg_amount)
    }));
  }

  private async getPurchaseJourney(eventId: string): Promise<Array<{step: string, dropoffRate: number, avgTime: number}>> {
    // This would track user journey through the purchase process
    // Simplified version - in practice would need detailed analytics
    return [
      {step: 'Landing Page', dropoffRate: 15, avgTime: 30},
      {step: 'Event Details', dropoffRate: 25, avgTime: 120},
      {step: 'Ticket Selection', dropoffRate: 35, avgTime: 180},
      {step: 'User Registration', dropoffRate: 45, avgTime: 90},
      {step: 'Payment Info', dropoffRate: 20, avgTime: 60},
      {step: 'Purchase Complete', dropoffRate: 5, avgTime: 15}
    ];
  }

  private async calculateAverageDecisionTime(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT AVG(
        EXTRACT(EPOCH FROM (created_at - first_viewed))
      )/60 as avg_decision_minutes
      FROM tickets t
      JOIN (
        SELECT user_id, event_id, MIN(timestamp) as first_viewed
        FROM event_analytics
        WHERE event_id = $1 AND action = 'page_view'
        GROUP BY user_id, event_id
      ) ea ON t.user_id = ea.user_id AND t.event_id = ea.event_id
      WHERE t.event_id = $1
    `, [eventId]);

    return parseFloat(result.rows[0]?.avg_decision_minutes || '0');
  }

  private async calculatePriceElasticity(eventId: string): Promise<number> {
    // Simplified price elasticity calculation
    // In practice, would need A/B testing data
    const result = await this.db.query(`
      SELECT 
        AVG(CASE WHEN price > (SELECT AVG(price) FROM tickets WHERE event_id = $1) 
            THEN 1 ELSE 0 END) as high_price_rate
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    const highPriceRate = parseFloat(result.rows[0]?.high_price_rate || '0.5');
    return 1 - highPriceRate; // Simplified elasticity measure
  }

  private async calculateGroupBuyingRate(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN quantity > 1 THEN 1 END)::float / COUNT(*) * 100 as group_rate
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    return parseFloat(result.rows[0]?.group_rate || '0');
  }

  private async calculateRepeatPurchaseRate(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN purchase_count > 1 THEN 1 END)::float / COUNT(*) * 100 as repeat_rate
      FROM (
        SELECT user_id, COUNT(*) as purchase_count
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE e.artist_id = (SELECT artist_id FROM events WHERE id = $1)
        GROUP BY user_id
      ) user_purchases
    `, [eventId]);

    return parseFloat(result.rows[0]?.repeat_rate || '0');
  }

  private async calculateUpgradeRate(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN tier_changes.new_tier_price > tier_changes.original_tier_price 
             THEN 1 END)::float / COUNT(*) * 100 as upgrade_rate
      FROM (
        SELECT 
          t1.user_id,
          t1.price as original_tier_price,
          t2.price as new_tier_price
        FROM tickets t1
        JOIN tickets t2 ON t1.user_id = t2.user_id 
        WHERE t1.event_id = $1 
          AND t2.event_id = $1
          AND t2.created_at > t1.created_at
      ) tier_changes
    `, [eventId]);

    return parseFloat(result.rows[0]?.upgrade_rate || '0');
  }

  private async calculateCancellationRate(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::float / COUNT(*) * 100 as cancellation_rate
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    return parseFloat(result.rows[0]?.cancellation_rate || '0');
  }
}

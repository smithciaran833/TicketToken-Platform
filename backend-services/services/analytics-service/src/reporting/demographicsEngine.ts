import { Pool } from 'pg';
import Redis from 'ioredis';

interface DemographicData {
  ageGroups: Array<{range: string, count: number, percentage: number}>;
  genderDistribution: Array<{gender: string, count: number, percentage: number}>;
  locationData: Array<{city: string, state: string, country: string, count: number}>;
  spendingPatterns: Array<{segment: string, avgSpend: number, frequency: number}>;
  deviceUsage: Array<{device: string, count: number, percentage: number}>;
  timeZones: Array<{timezone: string, count: number}>;
}

interface FanSegment {
  id: string;
  name: string;
  criteria: any;
  size: number;
  characteristics: {
    avgAge: number;
    avgSpend: number;
    loyaltyScore: number;
    engagementLevel: string;
  };
}

interface CohortAnalysis {
  period: string;
  cohorts: Array<{
    cohortMonth: string;
    period0: number;
    period1: number;
    period2: number;
    period3: number;
    period6: number;
    period12: number;
  }>;
}

export class DemographicsEngine {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async getEventDemographics(eventId: string): Promise<DemographicData> {
    try {
      const [
        ageGroups,
        genderDistribution,
        locationData,
        spendingPatterns,
        deviceUsage,
        timeZones
      ] = await Promise.all([
        this.getAgeDistribution(eventId),
        this.getGenderDistribution(eventId),
        this.getLocationDistribution(eventId),
        this.getSpendingPatterns(eventId),
        this.getDeviceUsage(eventId),
        this.getTimeZoneDistribution(eventId)
      ]);

      return {
        ageGroups,
        genderDistribution,
        locationData,
        spendingPatterns,
        deviceUsage,
        timeZones
      };
    } catch (error) {
      console.error('Error getting event demographics:', error);
      throw error;
    }
  }

  async getArtistFanDemographics(artistId: string): Promise<DemographicData> {
    try {
      const artistEvents = await this.db.query(`
        SELECT id FROM events WHERE artist_id = $1
      `, [artistId]);

      const eventIds = artistEvents.rows.map(row => row.id);
      
      if (eventIds.length === 0) {
        return this.getEmptyDemographics();
      }

      const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');
      
      const [
        ageGroups,
        genderDistribution,
        locationData,
        spendingPatterns,
        deviceUsage,
        timeZones
      ] = await Promise.all([
        this.getAgeDistributionMultiple(eventIds, placeholders),
        this.getGenderDistributionMultiple(eventIds, placeholders),
        this.getLocationDistributionMultiple(eventIds, placeholders),
        this.getSpendingPatternsMultiple(eventIds, placeholders),
        this.getDeviceUsageMultiple(eventIds, placeholders),
        this.getTimeZoneDistributionMultiple(eventIds, placeholders)
      ]);

      return {
        ageGroups,
        genderDistribution,
        locationData,
        spendingPatterns,
        deviceUsage,
        timeZones
      };
    } catch (error) {
      console.error('Error getting artist fan demographics:', error);
      throw error;
    }
  }

  async getFanSegments(eventId?: string): Promise<FanSegment[]> {
    try {
      let whereClause = '';
      let params: any[] = [];
      
      if (eventId) {
        whereClause = 'WHERE t.event_id = $1';
        params = [eventId];
      }

      const result = await this.db.query(`
        WITH fan_stats AS (
          SELECT 
            u.id,
            u.age,
            COUNT(t.id) as ticket_count,
            AVG(t.price) as avg_spend,
            SUM(t.price) as total_spend,
            MAX(t.created_at) as last_purchase,
            MIN(t.created_at) as first_purchase
          FROM users u
          JOIN tickets t ON u.id = t.user_id
          ${whereClause}
          GROUP BY u.id, u.age
        ),
        segments AS (
          SELECT 
            CASE 
              WHEN ticket_count >= 10 THEN 'VIP'
              WHEN ticket_count >= 5 THEN 'Regular'
              WHEN ticket_count >= 2 THEN 'Casual'
              ELSE 'New'
            END as segment,
            *
          FROM fan_stats
        )
        SELECT 
          segment,
          COUNT(*) as size,
          AVG(age) as avg_age,
          AVG(avg_spend) as avg_spend,
          AVG(ticket_count * 10) as loyalty_score
        FROM segments
        GROUP BY segment
      `, params);

      return result.rows.map(row => ({
        id: row.segment.toLowerCase(),
        name: row.segment,
        criteria: {}, // Simplified
        size: parseInt(row.size),
        characteristics: {
          avgAge: parseFloat(row.avg_age || '0'),
          avgSpend: parseFloat(row.avg_spend || '0'),
          loyaltyScore: parseFloat(row.loyalty_score || '0'),
          engagementLevel: this.calculateEngagementLevel(parseFloat(row.loyalty_score || '0'))
        }
      }));
    } catch (error) {
      console.error('Error getting fan segments:', error);
      return [];
    }
  }

  async getCohortAnalysis(artistId?: string): Promise<CohortAnalysis> {
    try {
      let whereClause = '';
      let params: any[] = [];
      
      if (artistId) {
        whereClause = 'AND e.artist_id = $1';
        params = [artistId];
      }

      const result = await this.db.query(`
        WITH first_purchases AS (
          SELECT 
            u.id as user_id,
            DATE_TRUNC('month', MIN(t.created_at)) as cohort_month
          FROM users u
          JOIN tickets t ON u.id = t.user_id
          JOIN events e ON t.event_id = e.id
          WHERE t.created_at >= NOW() - INTERVAL '12 months'
            ${whereClause}
          GROUP BY u.id
        ),
        purchase_periods AS (
          SELECT 
            fp.user_id,
            fp.cohort_month,
            DATE_TRUNC('month', t.created_at) as purchase_month,
            EXTRACT(MONTH FROM AGE(t.created_at, fp.cohort_month)) as period_number
          FROM first_purchases fp
          JOIN tickets t ON fp.user_id = t.user_id
          JOIN events e ON t.event_id = e.id
          WHERE 1=1 ${whereClause.replace('AND', 'AND')}
        )
        SELECT 
          cohort_month,
          COUNT(DISTINCT CASE WHEN period_number = 0 THEN user_id END) as period0,
          COUNT(DISTINCT CASE WHEN period_number = 1 THEN user_id END) as period1,
          COUNT(DISTINCT CASE WHEN period_number = 2 THEN user_id END) as period2,
          COUNT(DISTINCT CASE WHEN period_number = 3 THEN user_id END) as period3,
          COUNT(DISTINCT CASE WHEN period_number = 6 THEN user_id END) as period6,
          COUNT(DISTINCT CASE WHEN period_number = 12 THEN user_id END) as period12
        FROM purchase_periods
        GROUP BY cohort_month
        ORDER BY cohort_month
      `, params);

      return {
        period: 'monthly',
        cohorts: result.rows.map(row => ({
          cohortMonth: row.cohort_month.toISOString().slice(0, 7),
          period0: parseInt(row.period0),
          period1: parseInt(row.period1),
          period2: parseInt(row.period2),
          period3: parseInt(row.period3),
          period6: parseInt(row.period6),
          period12: parseInt(row.period12)
        }))
      };
    } catch (error) {
      console.error('Error getting cohort analysis:', error);
      return { period: 'monthly', cohorts: [] };
    }
  }

  private async getAgeDistribution(eventId: string): Promise<Array<{range: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        CASE 
          WHEN u.age < 18 THEN 'Under 18'
          WHEN u.age BETWEEN 18 AND 24 THEN '18-24'
          WHEN u.age BETWEEN 25 AND 34 THEN '25-34'
          WHEN u.age BETWEEN 35 AND 44 THEN '35-44'
          WHEN u.age BETWEEN 45 AND 54 THEN '45-54'
          WHEN u.age BETWEEN 55 AND 64 THEN '55-64'
          ELSE '65+'
        END as age_range,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
      GROUP BY age_range
      ORDER BY MIN(u.age)
    `, [eventId]);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      range: row.age_range,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getGenderDistribution(eventId: string): Promise<Array<{gender: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(u.gender, 'Not specified') as gender,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
      GROUP BY u.gender
      ORDER BY count DESC
    `, [eventId]);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      gender: row.gender,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getLocationDistribution(eventId: string): Promise<Array<{city: string, state: string, country: string, count: number}>> {
    const result = await this.db.query(`
      SELECT 
        u.city,
        u.state,
        u.country,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
        AND u.city IS NOT NULL
      GROUP BY u.city, u.state, u.country
      ORDER BY count DESC
      LIMIT 50
    `, [eventId]);

    return result.rows.map(row => ({
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      count: parseInt(row.count)
    }));
  }

  private async getSpendingPatterns(eventId: string): Promise<Array<{segment: string, avgSpend: number, frequency: number}>> {
    const result = await this.db.query(`
      WITH user_spending AS (
        SELECT 
          u.id,
          SUM(t.price) as total_spend,
          COUNT(t.id) as ticket_count
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.event_id = $1
        GROUP BY u.id
      )
      SELECT 
        CASE 
          WHEN total_spend >= 500 THEN 'High Spender'
          WHEN total_spend >= 200 THEN 'Medium Spender'
          WHEN total_spend >= 50 THEN 'Low Spender'
          ELSE 'Minimal Spender'
        END as segment,
        AVG(total_spend) as avg_spend,
        AVG(ticket_count) as frequency
      FROM user_spending
      GROUP BY segment
      ORDER BY avg_spend DESC
    `, [eventId]);

    return result.rows.map(row => ({
      segment: row.segment,
      avgSpend: parseFloat(row.avg_spend),
      frequency: parseFloat(row.frequency)
    }));
  }

  private async getDeviceUsage(eventId: string): Promise<Array<{device: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(device_type, 'Unknown') as device,
        COUNT(*) as count
      FROM tickets t
      WHERE t.event_id = $1
      GROUP BY device_type
      ORDER BY count DESC
    `, [eventId]);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      device: row.device,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getTimeZoneDistribution(eventId: string): Promise<Array<{timezone: string, count: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(u.timezone, 'Unknown') as timezone,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
      GROUP BY u.timezone
      ORDER BY count DESC
      LIMIT 10
    `, [eventId]);

    return result.rows.map(row => ({
      timezone: row.timezone,
      count: parseInt(row.count)
    }));
  }

  // Helper methods for multiple events (artist analysis)
  private async getAgeDistributionMultiple(eventIds: string[], placeholders: string): Promise<Array<{range: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        CASE 
          WHEN u.age < 18 THEN 'Under 18'
          WHEN u.age BETWEEN 18 AND 24 THEN '18-24'
          WHEN u.age BETWEEN 25 AND 34 THEN '25-34'
          WHEN u.age BETWEEN 35 AND 44 THEN '35-44'
          WHEN u.age BETWEEN 45 AND 54 THEN '45-54'
          WHEN u.age BETWEEN 55 AND 64 THEN '55-64'
          ELSE '65+'
        END as age_range,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id IN (${placeholders})
      GROUP BY age_range
      ORDER BY MIN(u.age)
    `, eventIds);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      range: row.age_range,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getGenderDistributionMultiple(eventIds: string[], placeholders: string): Promise<Array<{gender: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(u.gender, 'Not specified') as gender,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id IN (${placeholders})
      GROUP BY u.gender
      ORDER BY count DESC
    `, eventIds);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      gender: row.gender,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getLocationDistributionMultiple(eventIds: string[], placeholders: string): Promise<Array<{city: string, state: string, country: string, count: number}>> {
    const result = await this.db.query(`
      SELECT 
        u.city,
        u.state,
        u.country,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id IN (${placeholders})
        AND u.city IS NOT NULL
      GROUP BY u.city, u.state, u.country
      ORDER BY count DESC
      LIMIT 50
    `, eventIds);

    return result.rows.map(row => ({
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      count: parseInt(row.count)
    }));
  }

  private async getSpendingPatternsMultiple(eventIds: string[], placeholders: string): Promise<Array<{segment: string, avgSpend: number, frequency: number}>> {
    const result = await this.db.query(`
      WITH user_spending AS (
        SELECT 
          u.id,
          SUM(t.price) as total_spend,
          COUNT(t.id) as ticket_count
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.event_id IN (${placeholders})
        GROUP BY u.id
      )
      SELECT 
        CASE 
          WHEN total_spend >= 500 THEN 'High Spender'
          WHEN total_spend >= 200 THEN 'Medium Spender'
          WHEN total_spend >= 50 THEN 'Low Spender'
          ELSE 'Minimal Spender'
        END as segment,
        AVG(total_spend) as avg_spend,
        AVG(ticket_count) as frequency
      FROM user_spending
      GROUP BY segment
      ORDER BY avg_spend DESC
    `, eventIds);

    return result.rows.map(row => ({
      segment: row.segment,
      avgSpend: parseFloat(row.avg_spend),
      frequency: parseFloat(row.frequency)
    }));
  }

  private async getDeviceUsageMultiple(eventIds: string[], placeholders: string): Promise<Array<{device: string, count: number, percentage: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(device_type, 'Unknown') as device,
        COUNT(*) as count
      FROM tickets t
      WHERE t.event_id IN (${placeholders})
      GROUP BY device_type
      ORDER BY count DESC
    `, eventIds);

    const total = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    return result.rows.map(row => ({
      device: row.device,
      count: parseInt(row.count),
      percentage: total > 0 ? (parseInt(row.count) / total) * 100 : 0
    }));
  }

  private async getTimeZoneDistributionMultiple(eventIds: string[], placeholders: string): Promise<Array<{timezone: string, count: number}>> {
    const result = await this.db.query(`
      SELECT 
        COALESCE(u.timezone, 'Unknown') as timezone,
        COUNT(*) as count
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id IN (${placeholders})
      GROUP BY u.timezone
      ORDER BY count DESC
      LIMIT 10
    `, eventIds);

    return result.rows.map(row => ({
      timezone: row.timezone,
      count: parseInt(row.count)
    }));
  }

  private calculateEngagementLevel(loyaltyScore: number): string {
    if (loyaltyScore >= 80) return 'High';
    if (loyaltyScore >= 50) return 'Medium';
    if (loyaltyScore >= 20) return 'Low';
    return 'New';
  }

  private getEmptyDemographics(): DemographicData {
    return {
      ageGroups: [],
      genderDistribution: [],
      locationData: [],
      spendingPatterns: [],
      deviceUsage: [],
      timeZones: []
    };
  }
}

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

export class TierVerification extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async verifyUserTier(userId: string): Promise<{
    tier: string;
    level: number;
    benefits: string[];
  }> {
    try {
      const result = await this.db.query(`
        SELECT current_tier, total_points FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const tier = result.rows[0]?.current_tier || 'bronze';
      const benefits = this.getTierBenefits(tier);
      
      return {
        tier,
        level: this.getTierLevel(tier),
        benefits
      };

    } catch (error) {
      console.error('Tier verification error:', error);
      throw error;
    }
  }

  async getTierBenefits(userId: string): Promise<string[]> {
    const tierInfo = await this.verifyUserTier(userId);
    return tierInfo.benefits;
  }

  private getTierBenefits(tier: string): string[] {
    const benefits = {
      bronze: ['Basic support'],
      silver: ['Basic support', 'Presale access'],
      gold: ['Basic support', 'Presale access', 'Premium content'],
      platinum: ['Basic support', 'Presale access', 'Premium content', 'VIP experiences'],
      diamond: ['Basic support', 'Presale access', 'Premium content', 'VIP experiences', 'Concierge service']
    };

    return benefits[tier as keyof typeof benefits] || benefits.bronze;
  }

  private getTierLevel(tier: string): number {
    const levels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    return levels[tier as keyof typeof levels] || 1;
  }
}

import { Pool } from 'pg';
import Redis from 'ioredis';

interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  tierRequired: string;
  totalSupply: number;
  claimedSupply: number;
  isActive: boolean;
  expiresAt?: Date;
  imageUrl?: string;
  metadata: any;
  createdAt: Date;
}

interface RewardCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export class RewardsInventory {
  private db: Pool;
  private redis: Redis;
  private categories: Map<string, RewardCategory> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.initializeCategories();
  }

  async getAvailableRewards(userId?: string, category?: string, tierRequired?: number): Promise<Reward[]> {
    try {
      let query = `
        SELECT * FROM rewards 
        WHERE is_active = true 
          AND claimed_supply < total_supply
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (tierRequired !== undefined) {
        query += ` AND tier_required <= $${paramIndex}`;
        params.push(tierRequired);
        paramIndex++;
      }

      query += ` ORDER BY cost ASC, created_at DESC`;

      const result = await this.db.query(query, params);

      const rewards = result.rows.map(row => this.mapRowToReward(row));

      // Filter out already claimed rewards if userId provided
      if (userId) {
        const claimed = await this.getClaimedRewardIds(userId);
        return rewards.filter(reward => !claimed.has(reward.id));
      }

      return rewards;
    } catch (error) {
      console.error('Error getting available rewards:', error);
      return [];
    }
  }

  async getRewardById(rewardId: string): Promise<Reward | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM rewards WHERE id = $1
      `, [rewardId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToReward(result.rows[0]);
    } catch (error) {
      console.error('Error getting reward by ID:', error);
      return null;
    }
  }

  async createReward(reward: Omit<Reward, 'createdAt' | 'claimedSupply'>): Promise<Reward> {
    try {
      const result = await this.db.query(`
        INSERT INTO rewards (
          id, name, description, cost, category, tier_required,
          total_supply, is_active, expires_at, image_url, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `, [
        reward.id,
        reward.name,
        reward.description,
        reward.cost,
        reward.category,
        reward.tierRequired,
        reward.totalSupply,
        reward.isActive,
        reward.expiresAt,
        reward.imageUrl,
        JSON.stringify(reward.metadata)
      ]);

      // Clear cache
      await this.redis.del('rewards:available');

      return this.mapRowToReward(result.rows[0]);
    } catch (error) {
      console.error('Error creating reward:', error);
      throw error;
    }
  }

  async updateRewardStock(rewardId: string, newStock: number): Promise<void> {
    try {
      await this.db.query(`
        UPDATE rewards 
        SET total_supply = $1, updated_at = NOW()
        WHERE id = $2
      `, [newStock, rewardId]);

      // Clear cache
      await this.redis.del('rewards:available');
    } catch (error) {
      console.error('Error updating reward stock:', error);
      throw error;
    }
  }

  async deactivateReward(rewardId: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE rewards 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [rewardId]);

      // Clear cache
      await this.redis.del('rewards:available');
    } catch (error) {
      console.error('Error deactivating reward:', error);
      throw error;
    }
  }

  async getRewardsByCategory(category: string): Promise<Reward[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM rewards 
        WHERE category = $1 AND is_active = true
        ORDER BY cost ASC
      `, [category]);

      return result.rows.map(row => this.mapRowToReward(row));
    } catch (error) {
      console.error('Error getting rewards by category:', error);
      return [];
    }
  }

  async getRewardCategories(): Promise<RewardCategory[]> {
    return Array.from(this.categories.values());
  }

  async getFeaturedRewards(limit: number = 6): Promise<Reward[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM rewards 
        WHERE is_active = true 
          AND claimed_supply < total_supply
          AND metadata->>'featured' = 'true'
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => this.mapRowToReward(row));
    } catch (error) {
      console.error('Error getting featured rewards:', error);
      return [];
    }
  }

  async getLimitedTimeRewards(): Promise<Reward[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM rewards 
        WHERE is_active = true 
          AND expires_at IS NOT NULL
          AND expires_at > NOW()
          AND expires_at <= NOW() + INTERVAL '7 days'
        ORDER BY expires_at ASC
      `);

      return result.rows.map(row => this.mapRowToReward(row));
    } catch (error) {
      console.error('Error getting limited time rewards:', error);
      return [];
    }
  }

  async getRewardsForTier(tier: string): Promise<Reward[]> {
    try {
      const tierLevels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
      const userTierLevel = tierLevels[tier as keyof typeof tierLevels] || 1;

      const result = await this.db.query(`
        SELECT * FROM rewards 
        WHERE is_active = true 
          AND tier_required <= $1
        ORDER BY tier_required DESC, cost ASC
      `, [userTierLevel]);

      return result.rows.map(row => this.mapRowToReward(row));
    } catch (error) {
      console.error('Error getting rewards for tier:', error);
      return [];
    }
  }

  private async getClaimedRewardIds(userId: string): Promise<Set<string>> {
    try {
      const result = await this.db.query(`
        SELECT reward_id FROM reward_claims WHERE user_id = $1
      `, [userId]);

      return new Set(result.rows.map(row => row.reward_id));
    } catch (error) {
      console.error('Error getting claimed reward IDs:', error);
      return new Set();
    }
  }

  private mapRowToReward(row: any): Reward {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cost: row.cost,
      category: row.category,
      tierRequired: row.tier_required,
      totalSupply: row.total_supply,
      claimedSupply: row.claimed_supply || 0,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      imageUrl: row.image_url,
      metadata: row.metadata || {},
      createdAt: row.created_at
    };
  }

  private initializeCategories(): void {
    this.categories.set('merchandise', {
      id: 'merchandise',
      name: 'Merchandise',
      description: 'Exclusive event and artist merchandise',
      icon: '👕'
    });

    this.categories.set('experiences', {
      id: 'experiences',
      name: 'Experiences',
      description: 'VIP experiences and meet & greets',
      icon: '🎭'
    });

    this.categories.set('digital', {
      id: 'digital',
      name: 'Digital Content',
      description: 'Exclusive digital content and downloads',
      icon: '💿'
    });

    this.categories.set('tickets', {
      id: 'tickets',
      name: 'Tickets & Access',
      description: 'Free tickets and special access',
      icon: '🎫'
    });

    this.categories.set('food_drinks', {
      id: 'food_drinks',
      name: 'Food & Drinks',
      description: 'Venue food and beverage vouchers',
      icon: '🍕'
    });

    this.categories.set('collectibles', {
      id: 'collectibles',
      name: 'Collectibles',
      description: 'Limited edition collectible items',
      icon: '🏆'
    });
  }
}

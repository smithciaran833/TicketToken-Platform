import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface DigitalItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  exclusivityLevel: number; // 1-5
  accessRequirement: string;
  totalSupply?: number;
  currentSupply: number;
  price?: number;
  nftMintAddress?: string;
  attributes: { [key: string]: any };
}

export class DigitalMerchandise extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createItem(
    name: string,
    description: string,
    imagePath?: string,
    exclusivityLevel: number = 3,
    accessRequirement: string = 'gold'
  ): Promise<DigitalItem> {
    try {
      const item = await this.db.query(`
        INSERT INTO digital_merchandise (
          name, description, image_url, exclusivity_level, 
          access_requirement, current_supply, created_at
        ) VALUES ($1, $2, $3, $4, $5, 0, NOW())
        RETURNING *
      `, [name, description, imagePath, exclusivityLevel, accessRequirement]);

      const digitalItem = item.rows[0];

      this.emit('itemCreated', {
        itemId: digitalItem.id,
        name,
        exclusivityLevel,
        accessRequirement
      });

      return digitalItem;

    } catch (error) {
      console.error('Create digital merchandise error:', error);
      throw error;
    }
  }

  async getUserItems(userId: string): Promise<DigitalItem[]> {
    try {
      const items = await this.db.query(`
        SELECT dm.*, ui.claimed_at
        FROM digital_merchandise dm
        JOIN user_items ui ON dm.id = ui.item_id
        WHERE ui.user_id = $1
        ORDER BY ui.claimed_at DESC
      `, [userId]);

      return items.rows;

    } catch (error) {
      console.error('Get user items error:', error);
      throw error;
    }
  }

  async claimItem(itemId: string, userId: string): Promise<{
    success: boolean;
    message?: string;
    item?: DigitalItem;
  }> {
    try {
      // Check if user has access
      const hasAccess = await this.checkAccess(userId, itemId);
      if (!hasAccess) {
        return { success: false, message: 'Access denied' };
      }

      // Check if already claimed
      const existing = await this.db.query(`
        SELECT id FROM user_items WHERE item_id = $1 AND user_id = $2
      `, [itemId, userId]);

      if (existing.rows.length > 0) {
        return { success: false, message: 'Item already claimed' };
      }

      // Claim item
      await this.db.query(`
        INSERT INTO user_items (item_id, user_id, claimed_at)
        VALUES ($1, $2, NOW())
      `, [itemId, userId]);

      // Update supply
      await this.db.query(`
        UPDATE digital_merchandise 
        SET current_supply = current_supply + 1
        WHERE id = $1
      `, [itemId]);

      const item = await this.getItem(itemId);

      this.emit('itemClaimed', { itemId, userId });

      return {
        success: true,
        message: 'Item claimed successfully',
        item
      };

    } catch (error) {
      console.error('Claim item error:', error);
      throw error;
    }
  }

  private async checkAccess(userId: string, itemId: string): Promise<boolean> {
    const userTier = await this.getUserTier(userId);
    const item = await this.getItem(itemId);
    
    return userTier === item.accessRequirement || 
           this.tierMeetsRequirement(userTier, item.accessRequirement);
  }

  private async getUserTier(userId: string): Promise<string> {
    const result = await this.db.query(`
      SELECT current_tier FROM user_profiles WHERE user_id = $1
    `, [userId]);

    return result.rows[0]?.current_tier || 'bronze';
  }

  private async getItem(itemId: string): Promise<DigitalItem> {
    const result = await this.db.query(`
      SELECT * FROM digital_merchandise WHERE id = $1
    `, [itemId]);

    return result.rows[0];
  }

  private tierMeetsRequirement(userTier: string, requiredTier: string): boolean {
    const tierLevels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    const userLevel = tierLevels[userTier as keyof typeof tierLevels] || 1;
    const requiredLevel = tierLevels[requiredTier as keyof typeof tierLevels] || 5;

    return userLevel >= requiredLevel;
  }
}

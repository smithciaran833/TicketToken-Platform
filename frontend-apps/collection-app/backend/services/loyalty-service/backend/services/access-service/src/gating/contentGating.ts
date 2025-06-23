import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface ContentAccess {
  contentId: string;
  userId: string;
  accessLevel: string;
  unlockMethod: string;
  unlockedAt: Date;
  expiresAt?: Date;
}

interface ContentItem {
  id: string;
  title: string;
  type: string; // 'video', 'audio', 'image', 'document'
  requiredAccess: string[];
  tierRequired?: string;
  unlockCost?: number;
  exclusivityLevel: number; // 1-5, higher = more exclusive
}

export class ContentGating extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async checkContentAccess(userId: string, contentId: string, requiredAccess: string[]): Promise<{
    hasAccess: boolean;
    accessLevel?: string;
    unlockOptions?: string[];
    reason?: string;
  }> {
    try {
      // Check existing access
      const existingAccess = await this.db.query(`
        SELECT * FROM content_access 
        WHERE user_id = $1 AND content_id = $2 AND 
              (expires_at IS NULL OR expires_at > NOW())
      `, [userId, contentId]);

      if (existingAccess.rows.length > 0) {
        return {
          hasAccess: true,
          accessLevel: existingAccess.rows[0].access_level
        };
      }

      // Check user's tier and passes
      const userAccess = await this.getUserAccessLevels(userId);
      
      // Check if user has required access
      const hasRequiredAccess = requiredAccess.some(access => 
        userAccess.includes(access)
      );

      if (hasRequiredAccess) {
        // Grant automatic access
        await this.grantContentAccess(userId, contentId, 'automatic', requiredAccess[0]);
        return {
          hasAccess: true,
          accessLevel: requiredAccess[0]
        };
      }

      // Return unlock options
      const unlockOptions = await this.getUnlockOptions(userId, contentId);
      
      return {
        hasAccess: false,
        unlockOptions,
        reason: 'Insufficient access level'
      };

    } catch (error) {
      console.error('Content access check error:', error);
      throw error;
    }
  }

  async unlockContent(userId: string, contentId: string, unlockMethod: string): Promise<{
    success: boolean;
    accessLevel?: string;
    message?: string;
  }> {
    try {
      const content = await this.getContentDetails(contentId);
      if (!content) {
        return { success: false, message: 'Content not found' };
      }

      let accessGranted = false;
      let accessLevel = '';

      switch (unlockMethod) {
        case 'points':
          const pointsResult = await this.unlockWithPoints(userId, content);
          accessGranted = pointsResult.success;
          accessLevel = 'points_unlock';
          break;

        case 'tier_upgrade':
          const tierResult = await this.unlockWithTierUpgrade(userId, content);
          accessGranted = tierResult.success;
          accessLevel = 'tier_unlock';
          break;

        case 'purchase':
          const purchaseResult = await this.unlockWithPurchase(userId, content);
          accessGranted = purchaseResult.success;
          accessLevel = 'purchase_unlock';
          break;

        default:
          return { success: false, message: 'Invalid unlock method' };
      }

      if (accessGranted) {
        await this.grantContentAccess(userId, contentId, unlockMethod, accessLevel);
        
        // Emit event for analytics
        this.emit('contentUnlocked', {
          userId,
          contentId,
          unlockMethod,
          accessLevel,
          timestamp: new Date()
        });

        return {
          success: true,
          accessLevel,
          message: 'Content unlocked successfully'
        };
      }

      return { success: false, message: 'Unlock failed' };

    } catch (error) {
      console.error('Content unlock error:', error);
      throw error;
    }
  }

  async getExclusiveContent(userId: string, tier?: string): Promise<ContentItem[]> {
    try {
      const userAccess = await this.getUserAccessLevels(userId);
      
      const query = `
        SELECT c.*, ca.access_level
        FROM content_items c
        LEFT JOIN content_access ca ON c.id = ca.content_id AND ca.user_id = $1
        WHERE c.required_access && $2 OR ca.access_level IS NOT NULL
        ORDER BY c.exclusivity_level DESC, c.created_at DESC
        LIMIT 50
      `;

      const result = await this.db.query(query, [userId, userAccess]);
      return result.rows;

    } catch (error) {
      console.error('Get exclusive content error:', error);
      throw error;
    }
  }

  private async getUserAccessLevels(userId: string): Promise<string[]> {
    try {
      // Get user's tier
      const tierResult = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const tier = tierResult.rows[0]?.current_tier || 'bronze';
      const accessLevels = [tier];

      // Get VIP passes
      const vipResult = await this.db.query(`
        SELECT pass_type FROM vip_passes 
        WHERE owner = $1 AND valid_until > NOW()
      `, [userId]);

      vipResult.rows.forEach(row => {
        accessLevels.push(`vip_${row.pass_type}`);
      });

      // Get season passes
      const seasonResult = await this.db.query(`
        SELECT season_name FROM season_passes 
        WHERE owner = $1 AND expires_at > NOW()
      `, [userId]);

      seasonResult.rows.forEach(row => {
        accessLevels.push(`season_${row.season_name}`);
      });

      return accessLevels;

    } catch (error) {
      console.error('Get user access levels error:', error);
      return ['bronze']; // Default access
    }
  }

  private async getUnlockOptions(userId: string, contentId: string): Promise<string[]> {
    const content = await this.getContentDetails(contentId);
    const options: string[] = [];

    // Check if user can unlock with points
    const userPoints = await this.getUserPoints(userId);
    if (content.unlockCost && userPoints >= content.unlockCost) {
      options.push('points');
    }

    // Check tier upgrade option
    const userTier = await this.getUserTier(userId);
    if (this.canUpgradeTier(userTier, content.tierRequired)) {
      options.push('tier_upgrade');
    }

    // Purchase option always available
    options.push('purchase');

    return options;
  }

  private async unlockWithPoints(userId: string, content: ContentItem): Promise<{ success: boolean }> {
    if (!content.unlockCost) return { success: false };

    const userPoints = await this.getUserPoints(userId);
    if (userPoints < content.unlockCost) {
      return { success: false };
    }

    // Deduct points (this would call the loyalty service)
    // await this.deductPoints(userId, content.unlockCost);

    return { success: true };
  }

  private async unlockWithTierUpgrade(userId: string, content: ContentItem): Promise<{ success: boolean }> {
    // Check if user can upgrade to required tier
    // This would integrate with the loyalty service
    return { success: true };
  }

  private async unlockWithPurchase(userId: string, content: ContentItem): Promise<{ success: boolean }> {
    // Handle direct purchase unlock
    // This would integrate with payment processing
    return { success: true };
  }

  private async grantContentAccess(userId: string, contentId: string, unlockMethod: string, accessLevel: string): Promise<void> {
    await this.db.query(`
      INSERT INTO content_access (user_id, content_id, access_level, unlock_method, unlocked_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, content_id) DO UPDATE SET
        access_level = EXCLUDED.access_level,
        unlock_method = EXCLUDED.unlock_method,
        unlocked_at = EXCLUDED.unlocked_at
    `, [userId, contentId, accessLevel, unlockMethod]);

    // Cache access for quick lookups
    await this.redis.setex(`content_access:${userId}:${contentId}`, 3600, accessLevel);
  }

  private async getContentDetails(contentId: string): Promise<ContentItem | null> {
    const result = await this.db.query(`
      SELECT * FROM content_items WHERE id = $1
    `, [contentId]);

    return result.rows[0] || null;
  }

  private async getUserPoints(userId: string): Promise<number> {
    // This would call the loyalty service
    const cached = await this.redis.get(`points:${userId}`);
    return cached ? parseInt(cached) : 0;
  }

  private async getUserTier(userId: string): Promise<string> {
    const result = await this.db.query(`
      SELECT current_tier FROM user_profiles WHERE user_id = $1
    `, [userId]);

    return result.rows[0]?.current_tier || 'bronze';
  }

  private canUpgradeTier(currentTier: string, requiredTier?: string): boolean {
    if (!requiredTier) return false;

    const tierLevels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    const current = tierLevels[currentTier as keyof typeof tierLevels] || 1;
    const required = tierLevels[requiredTier as keyof typeof tierLevels] || 5;

    return current < required;
  }
}

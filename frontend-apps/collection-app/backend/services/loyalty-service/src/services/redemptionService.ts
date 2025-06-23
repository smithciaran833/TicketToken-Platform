import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface RewardClaim {
  id: string;
  userId: string;
  rewardId: string;
  rewardName: string;
  pointsCost: number;
  status: 'pending' | 'approved' | 'fulfilled' | 'cancelled';
  claimedAt: Date;
  fulfilledAt?: Date;
  metadata: any;
}

interface RedemptionResult {
  success: boolean;
  claim?: RewardClaim;
  error?: string;
  requiresApproval?: boolean;
}

export class RedemptionService extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async claimReward(userId: string, rewardId: string): Promise<RedemptionResult> {
    try {
      // Start transaction
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Get reward details
        const rewardResult = await client.query(`
          SELECT * FROM rewards WHERE id = $1 FOR UPDATE
        `, [rewardId]);

        if (rewardResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Reward not found' };
        }

        const reward = rewardResult.rows[0];

        // Check if reward is available
        if (!reward.is_active) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Reward is not active' };
        }

        if (reward.claimed_supply >= reward.total_supply) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Reward is out of stock' };
        }

        if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Reward has expired' };
        }

        // Check if user already claimed this reward
        const existingClaim = await client.query(`
          SELECT id FROM reward_claims 
          WHERE user_id = $1 AND reward_id = $2
        `, [userId, rewardId]);

        if (existingClaim.rows.length > 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Reward already claimed' };
        }

        // Get user profile
        const userResult = await client.query(`
          SELECT * FROM user_profiles WHERE user_id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return { success: false, error: 'User profile not found' };
        }

        const user = userResult.rows[0];

        // Check tier requirement
        const tierLevels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
        const userTierLevel = tierLevels[user.current_tier as keyof typeof tierLevels] || 1;
        const requiredTierLevel = tierLevels[reward.tier_required as keyof typeof tierLevels] || 1;

        if (userTierLevel < requiredTierLevel) {
          await client.query('ROLLBACK');
          return { success: false, error: `Requires ${reward.tier_required} tier or higher` };
        }

        // Check points balance
        if (user.points_balance < reward.cost) {
          await client.query('ROLLBACK');
          return { success: false, error: 'Insufficient points balance' };
        }

        // Deduct points
        const newBalance = user.points_balance - reward.cost;
        await client.query(`
          UPDATE user_profiles 
          SET points_balance = $1, updated_at = NOW()
          WHERE user_id = $2
        `, [newBalance, userId]);

        // Record points transaction
        await client.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [userId, -reward.cost, 'spent', `Claimed reward: ${reward.name}`, JSON.stringify({ rewardId }), newBalance]);

        // Update reward claimed supply
        await client.query(`
          UPDATE rewards 
          SET claimed_supply = claimed_supply + 1, updated_at = NOW()
          WHERE id = $1
        `, [rewardId]);

        // Create reward claim
        const status = this.requiresApproval(reward) ? 'pending' : 'approved';
        const claimResult = await client.query(`
          INSERT INTO reward_claims (
            user_id, reward_id, reward_name, points_cost, status, claimed_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
          RETURNING *
        `, [userId, rewardId, reward.name, reward.cost, status, JSON.stringify({})]);

        await client.query('COMMIT');

        const claim: RewardClaim = {
          id: claimResult.rows[0].id,
          userId,
          rewardId,
          rewardName: reward.name,
          pointsCost: reward.cost,
          status,
          claimedAt: claimResult.rows[0].claimed_at,
          metadata: {}
        };

        // Clear cache
        await this.redis.del(`points:${userId}`);

        // Emit events
        this.emit('rewardClaimed', {
          userId,
          rewardId,
          rewardName: reward.name,
          pointsCost: reward.cost,
          requiresApproval: status === 'pending'
        });

        return {
          success: true,
          claim,
          requiresApproval: status === 'pending'
        };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      return { success: false, error: 'Failed to claim reward' };
    }
  }

  async getClaimedRewards(userId: string): Promise<RewardClaim[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM reward_claims 
        WHERE user_id = $1 
        ORDER BY claimed_at DESC
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        rewardId: row.reward_id,
        rewardName: row.reward_name,
        pointsCost: row.points_cost,
        status: row.status,
        claimedAt: row.claimed_at,
        fulfilledAt: row.fulfilled_at,
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Error getting claimed rewards:', error);
      return [];
    }
  }

  async getPendingClaims(): Promise<RewardClaim[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM reward_claims 
        WHERE status = 'pending'
        ORDER BY claimed_at ASC
      `);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        rewardId: row.reward_id,
        rewardName: row.reward_name,
        pointsCost: row.points_cost,
        status: row.status,
        claimedAt: row.claimed_at,
        fulfilledAt: row.fulfilled_at,
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error('Error getting pending claims:', error);
      return [];
    }
  }

  async approveClaim(claimId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE reward_claims 
        SET status = 'approved', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `, [claimId]);

      if (result.rows.length > 0) {
        const claim = result.rows[0];
        this.emit('claimApproved', {
          claimId,
          userId: claim.user_id,
          rewardId: claim.reward_id,
          rewardName: claim.reward_name
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error approving claim:', error);
      return false;
    }
  }

  async fulfillClaim(claimId: string, metadata?: any): Promise<boolean> {
    try {
      const result = await this.db.query(`
        UPDATE reward_claims 
        SET status = 'fulfilled', fulfilled_at = NOW(), metadata = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'approved'
        RETURNING *
      `, [claimId, JSON.stringify(metadata || {})]);

      if (result.rows.length > 0) {
        const claim = result.rows[0];
        this.emit('claimFulfilled', {
          claimId,
          userId: claim.user_id,
          rewardId: claim.reward_id,
          rewardName: claim.reward_name
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error fulfilling claim:', error);
      return false;
    }
  }

  async cancelClaim(claimId: string, reason?: string): Promise<boolean> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Get claim details
        const claimResult = await client.query(`
          SELECT * FROM reward_claims WHERE id = $1
        `, [claimId]);

        if (claimResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        const claim = claimResult.rows[0];

        // Refund points to user
        await client.query(`
          UPDATE user_profiles 
          SET points_balance = points_balance + $1, updated_at = NOW()
          WHERE user_id = $2
        `, [claim.points_cost, claim.user_id]);

        // Record refund transaction
        await client.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, $3, $4, $5, 
            (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
        `, [claim.user_id, claim.points_cost, 'earned', 'Reward claim cancelled - refund', JSON.stringify({ claimId, reason })]);

        // Update claim status
        await client.query(`
          UPDATE reward_claims 
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1
        `, [claimId]);

        // Update reward supply
        await client.query(`
          UPDATE rewards 
          SET claimed_supply = claimed_supply - 1, updated_at = NOW()
          WHERE id = $1
        `, [claim.reward_id]);

        await client.query('COMMIT');

        // Clear cache
        await this.redis.del(`points:${claim.user_id}`);

        this.emit('claimCancelled', {
          claimId,
          userId: claim.user_id,
          rewardId: claim.reward_id,
          pointsRefunded: claim.points_cost,
          reason
        });

        return true;

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error cancelling claim:', error);
      return false;
    }
  }

  private requiresApproval(reward: any): boolean {
    // High-value rewards or physical items require approval
    const highValueThreshold = 5000; // 5000 points
    const physicalCategories = ['merchandise', 'experiences', 'collectibles'];
    
    return reward.cost >= highValueThreshold || 
           physicalCategories.includes(reward.category);
  }
}

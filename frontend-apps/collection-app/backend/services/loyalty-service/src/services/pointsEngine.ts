import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface PointsTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earned' | 'spent' | 'transferred' | 'received';
  reason: string;
  metadata?: any;
  timestamp: Date;
}

interface PointsEarningRule {
  event: string;
  pointsPerDollar?: number;
  fixedPoints?: number;
  multiplier?: number;
  conditions?: any;
}

export class PointsEngine extends EventEmitter {
  private db: Pool;
  private redis: Redis;
  private earningRules: Map<string, PointsEarningRule> = new Map();

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
    this.initializeEarningRules();
  }

  async awardPoints(userId: string, amount: number, reason: string, metadata?: any): Promise<PointsTransaction> {
    try {
      // Get current balance
      const currentBalance = await this.getPointsBalance(userId);
      const newBalance = currentBalance + amount;

      // Store in database
      const result = await this.db.query(`
        INSERT INTO points_transactions (
          user_id, amount, type, reason, metadata, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [userId, amount, 'earned', reason, JSON.stringify(metadata || {}), newBalance]);

      // Update user balance
      await this.updateUserBalance(userId, newBalance);

      // Cache for quick access
      await this.redis.setex(`points:${userId}`, 3600, newBalance.toString());

      const transaction: PointsTransaction = {
        id: result.rows[0].id,
        userId,
        amount,
        type: 'earned',
        reason,
        metadata,
        timestamp: result.rows[0].created_at
      };

      // Emit event for real-time updates
      this.emit('pointsEarned', {
        userId,
        amount,
        reason,
        newBalance,
        transaction
      });

      return transaction;
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  async spendPoints(userId: string, amount: number, reason: string, metadata?: any): Promise<PointsTransaction> {
    try {
      const currentBalance = await this.getPointsBalance(userId);
      
      if (currentBalance < amount) {
        throw new Error('Insufficient points balance');
      }

      const newBalance = currentBalance - amount;

      const result = await this.db.query(`
        INSERT INTO points_transactions (
          user_id, amount, type, reason, metadata, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [userId, -amount, 'spent', reason, JSON.stringify(metadata || {}), newBalance]);

      await this.updateUserBalance(userId, newBalance);
      await this.redis.setex(`points:${userId}`, 3600, newBalance.toString());

      const transaction: PointsTransaction = {
        id: result.rows[0].id,
        userId,
        amount: -amount,
        type: 'spent',
        reason,
        metadata,
        timestamp: result.rows[0].created_at
      };

      this.emit('pointsSpent', {
        userId,
        amount,
        reason,
        newBalance,
        transaction
      });

      return transaction;
    } catch (error) {
      console.error('Error spending points:', error);
      throw error;
    }
  }

  async transferPoints(fromUserId: string, toUserId: string, amount: number, message?: string): Promise<{sender: PointsTransaction, recipient: PointsTransaction}> {
    try {
      const senderBalance = await this.getPointsBalance(fromUserId);
      
      if (senderBalance < amount) {
        throw new Error('Insufficient points balance');
      }

      const recipientBalance = await this.getPointsBalance(toUserId);
      const newSenderBalance = senderBalance - amount;
      const newRecipientBalance = recipientBalance + amount;

      // Create both transactions
      const senderResult = await this.db.query(`
        INSERT INTO points_transactions (
          user_id, amount, type, reason, metadata, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [fromUserId, -amount, 'transferred', `Transfer to ${toUserId}`, JSON.stringify({ recipient: toUserId, message }), newSenderBalance]);

      const recipientResult = await this.db.query(`
        INSERT INTO points_transactions (
          user_id, amount, type, reason, metadata, balance_after, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [toUserId, amount, 'received', `Transfer from ${fromUserId}`, JSON.stringify({ sender: fromUserId, message }), newRecipientBalance]);

      // Update balances
      await this.updateUserBalance(fromUserId, newSenderBalance);
      await this.updateUserBalance(toUserId, newRecipientBalance);
      
      // Update cache
      await this.redis.setex(`points:${fromUserId}`, 3600, newSenderBalance.toString());
      await this.redis.setex(`points:${toUserId}`, 3600, newRecipientBalance.toString());

      const senderTransaction: PointsTransaction = {
        id: senderResult.rows[0].id,
        userId: fromUserId,
        amount: -amount,
        type: 'transferred',
        reason: `Transfer to ${toUserId}`,
        metadata: { recipient: toUserId, message },
        timestamp: senderResult.rows[0].created_at
      };

      const recipientTransaction: PointsTransaction = {
        id: recipientResult.rows[0].id,
        userId: toUserId,
        amount,
        type: 'received',
        reason: `Transfer from ${fromUserId}`,
        metadata: { sender: fromUserId, message },
        timestamp: recipientResult.rows[0].created_at
      };

      this.emit('pointsTransferred', {
        fromUserId,
        toUserId,
        amount,
        message,
        senderBalance: newSenderBalance,
        recipientBalance: newRecipientBalance
      });

      return { sender: senderTransaction, recipient: recipientTransaction };
    } catch (error) {
      console.error('Error transferring points:', error);
      throw error;
    }
  }

  async getPointsBalance(userId: string): Promise<number> {
    try {
      // Try cache first
      const cached = await this.redis.get(`points:${userId}`);
      if (cached) {
        return parseInt(cached);
      }

      // Get from database
      const result = await this.db.query(`
        SELECT points_balance FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const balance = result.rows.length > 0 ? result.rows[0].points_balance : 0;
      
      // Cache for 1 hour
      await this.redis.setex(`points:${userId}`, 3600, balance.toString());
      
      return balance;
    } catch (error) {
      console.error('Error getting points balance:', error);
      return 0;
    }
  }

  async getPointsHistory(userId: string, limit: number = 50): Promise<PointsTransaction[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM points_transactions 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        amount: row.amount,
        type: row.type,
        reason: row.reason,
        metadata: row.metadata,
        timestamp: row.created_at
      }));
    } catch (error) {
      console.error('Error getting points history:', error);
      return [];
    }
  }

  async calculatePointsForPurchase(amount: number, eventType?: string): Promise<number> {
    const defaultRate = parseInt(process.env.DEFAULT_POINTS_PER_DOLLAR || '100');
    let pointsPerDollar = defaultRate;

    // Apply earning rules
    if (eventType && this.earningRules.has(eventType)) {
      const rule = this.earningRules.get(eventType)!;
      if (rule.pointsPerDollar) {
        pointsPerDollar = rule.pointsPerDollar;
      }
      if (rule.multiplier) {
        pointsPerDollar *= rule.multiplier;
      }
    }

    return Math.floor(amount * pointsPerDollar);
  }

  private async updateUserBalance(userId: string, newBalance: number): Promise<void> {
    await this.db.query(`
      INSERT INTO user_profiles (user_id, points_balance, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        points_balance = $2,
        updated_at = NOW()
    `, [userId, newBalance]);
  }

  private initializeEarningRules(): void {
    // Default earning rules
    this.earningRules.set('ticket_purchase', {
      event: 'ticket_purchase',
      pointsPerDollar: 100,
      conditions: {}
    });

    this.earningRules.set('event_attendance', {
      event: 'event_attendance',
      fixedPoints: 50,
      conditions: {}
    });

    this.earningRules.set('social_share', {
      event: 'social_share',
      fixedPoints: 25,
      conditions: {}
    });

    this.earningRules.set('referral_signup', {
      event: 'referral_signup',
      fixedPoints: 500,
      conditions: {}
    });

    this.earningRules.set('birthday_bonus', {
      event: 'birthday_bonus',
      fixedPoints: 500,
      conditions: {}
    });
  }
}

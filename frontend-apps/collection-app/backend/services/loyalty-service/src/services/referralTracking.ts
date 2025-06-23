import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  commissionRate: number;
  totalReferrals: number;
  totalCommission: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

interface ReferralStats {
  totalReferrals: number;
  totalCommission: number;
  pendingCommission: number;
  conversionRate: number;
  topReferrers: Array<{userId: string, referrals: number, commission: number}>;
  recentReferrals: Array<{refereeId: string, amount: number, date: Date}>;
}

export class ReferralTracking extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createReferralCode(userId: string, code: string, commissionRate: number): Promise<ReferralCode> {
    try {
      // Validate commission rate
      const maxCommissionRate = parseInt(process.env.MAX_COMMISSION_RATE || '1000'); // 10%
      if (commissionRate > maxCommissionRate) {
        throw new Error(`Commission rate cannot exceed ${maxCommissionRate / 100}%`);
      }

      // Check if code already exists
      const existingCode = await this.db.query(`
        SELECT id FROM referral_codes WHERE code = $1
      `, [code]);

      if (existingCode.rows.length > 0) {
        throw new Error('Referral code already exists');
      }

      // Calculate expiry date
      const expiryDays = parseInt(process.env.REFERRAL_CODE_EXPIRY_DAYS || '365');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const result = await this.db.query(`
        INSERT INTO referral_codes (
          user_id, code, commission_rate, total_referrals, total_commission,
          is_active, expires_at, created_at
        ) VALUES ($1, $2, $3, 0, 0, true, $4, NOW())
        RETURNING *
      `, [userId, code, commissionRate, expiresAt]);

      const referralCode: ReferralCode = {
        id: result.rows[0].id,
        userId,
        code,
        commissionRate,
        totalReferrals: 0,
        totalCommission: 0,
        isActive: true,
        expiresAt,
        createdAt: result.rows[0].created_at
      };

      this.emit('referralCodeCreated', {
        userId,
        code,
        commissionRate
      });

      return referralCode;
    } catch (error) {
      console.error('Error creating referral code:', error);
      throw error;
    }
  }

  async trackReferral(referralCode: string, refereeId: string, transactionAmount: number): Promise<{success: boolean, commission?: number}> {
    try {
      // Get referral code details
      const codeResult = await this.db.query(`
        SELECT * FROM referral_codes 
        WHERE code = $1 AND is_active = true
      `, [referralCode]);

      if (codeResult.rows.length === 0) {
        return { success: false };
      }

      const code = codeResult.rows[0];

      // Check if code is expired
      if (code.expires_at && new Date(code.expires_at) < new Date()) {
        return { success: false };
      }

      // Prevent self-referral
      if (code.user_id === refereeId) {
        return { success: false };
      }

      // Check if referee was already referred by this user
      const existingReferral = await this.db.query(`
        SELECT id FROM referral_transactions 
        WHERE referrer_id = $1 AND referee_id = $2
      `, [code.user_id, refereeId]);

      if (existingReferral.rows.length > 0) {
        return { success: false };
      }

      // Calculate commission
      let commission = Math.floor(transactionAmount * code.commission_rate / 10000);

      // Apply tier bonus
      const referrerProfile = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [code.user_id]);

      if (referrerProfile.rows.length > 0) {
        const tier = referrerProfile.rows[0].current_tier;
        const tierBonus = this.getTierCommissionBonus(tier);
        commission = Math.floor(commission * tierBonus);
      }

      // Record referral transaction
      await this.db.query(`
        INSERT INTO referral_transactions (
          referrer_id, referee_id, referral_code, transaction_amount,
          commission_amount, commission_paid, created_at
        ) VALUES ($1, $2, $3, $4, $5, false, NOW())
      `, [code.user_id, refereeId, referralCode, transactionAmount, commission]);

      // Update referral code stats
      await this.db.query(`
        UPDATE referral_codes 
        SET total_referrals = total_referrals + 1,
            total_commission = total_commission + $2,
            updated_at = NOW()
        WHERE id = $1
      `, [code.id, commission]);

      // Update referrer profile
      await this.db.query(`
        UPDATE user_profiles 
        SET referral_count = referral_count + 1,
            referral_earnings = referral_earnings + $2,
            updated_at = NOW()
        WHERE user_id = $1
      `, [code.user_id, commission]);

      // Cache referral data
      await this.redis.setex(`referral:${code.user_id}`, 3600, JSON.stringify({
        totalReferrals: code.total_referrals + 1,
        totalCommission: code.total_commission + commission
      }));

      this.emit('referralSuccess', {
        referrerId: code.user_id,
        refereeId,
        referralCode,
        transactionAmount,
        commission
      });

      return { success: true, commission };
    } catch (error) {
      console.error('Error tracking referral:', error);
      return { success: false };
    }
  }

  async getReferralStats(userId: string): Promise<ReferralStats> {
    try {
      // Get basic stats
      const statsResult = await this.db.query(`
        SELECT 
          COUNT(*) as total_referrals,
          SUM(commission_amount) as total_commission,
          SUM(CASE WHEN commission_paid = false THEN commission_amount ELSE 0 END) as pending_commission
        FROM referral_transactions 
        WHERE referrer_id = $1
      `, [userId]);

      const stats = statsResult.rows[0];

      // Get recent referrals
      const recentResult = await this.db.query(`
        SELECT referee_id, transaction_amount, created_at
        FROM referral_transactions 
        WHERE referrer_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [userId]);

      const recentReferrals = recentResult.rows.map(row => ({
        refereeId: row.referee_id,
        amount: row.transaction_amount,
        date: row.created_at
      }));

      // Calculate conversion rate (simplified)
      const conversionRate = 0.15; // Would calculate from actual data

      return {
        totalReferrals: parseInt(stats.total_referrals || '0'),
        totalCommission: parseFloat(stats.total_commission || '0'),
        pendingCommission: parseFloat(stats.pending_commission || '0'),
        conversionRate,
        topReferrers: [], // Would implement if needed
        recentReferrals
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        totalReferrals: 0,
        totalCommission: 0,
        pendingCommission: 0,
        conversionRate: 0,
        topReferrers: [],
        recentReferrals: []
      };
    }
  }

  async getUserReferralCodes(userId: string): Promise<ReferralCode[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM referral_codes 
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        code: row.code,
        commissionRate: row.commission_rate,
        totalReferrals: row.total_referrals,
        totalCommission: row.total_commission,
        isActive: row.is_active,
        expiresAt: row.expires_at,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error getting user referral codes:', error);
      return [];
    }
  }

  async payoutCommissions(userId: string): Promise<{success: boolean, amount?: number}> {
    try {
      // Get pending commissions
      const result = await this.db.query(`
        SELECT SUM(commission_amount) as total_pending
        FROM referral_transactions 
        WHERE referrer_id = $1 AND commission_paid = false
      `, [userId]);

      const totalPending = parseFloat(result.rows[0].total_pending || '0');

      if (totalPending <= 0) {
        return { success: false };
      }

      // Convert commission to points (1:1 ratio)
      const pointsToAward = Math.floor(totalPending);

      // Award points
      await this.db.query(`
        UPDATE user_profiles 
        SET points_balance = points_balance + $1,
            points_earned = points_earned + $1,
            referral_earnings = 0,
            updated_at = NOW()
        WHERE user_id = $2
      `, [pointsToAward, userId]);

      // Mark commissions as paid
      await this.db.query(`
        UPDATE referral_transactions 
        SET commission_paid = true, paid_at = NOW()
        WHERE referrer_id = $1 AND commission_paid = false
      `, [userId]);

      // Record points transaction
      await this.db.query(`
        INSERT INTO points_transactions (
          user_id, amount, type, reason, metadata, balance_after, created_at
        ) VALUES ($1, $2, 'referral', 'Referral commission payout', 
          $3, (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
      `, [userId, pointsToAward, JSON.stringify({ commission: totalPending })]);

      // Clear cache
      await this.redis.del(`points:${userId}`);
      await this.redis.del(`referral:${userId}`);

      this.emit('commissionPayout', {
        userId,
        commission: totalPending,
        pointsAwarded: pointsToAward
      });

      return { success: true, amount: pointsToAward };
    } catch (error) {
      console.error('Error paying out commissions:', error);
      return { success: false };
    }
  }

  private getTierCommissionBonus(tier: string): number {
    const bonuses = {
      bronze: 1.0,
      silver: 1.1,
      gold: 1.2,
      platinum: 1.3,
      diamond: 1.5
    };

    return bonuses[tier as keyof typeof bonuses] || 1.0;
  }
}

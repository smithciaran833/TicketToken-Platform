import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface TierInfo {
  currentTier: string;
  tierLevel: number;
  pointsEarned: number;
  nextTierThreshold: number;
  progress: number;
  benefits: string[];
  daysInTier: number;
}

interface TierBenefit {
  type: string;
  value: any;
  description: string;
}

export class TierManager extends EventEmitter {
  private db: Pool;
  private redis: Redis;
  private tierThresholds: Map<string, number> = new Map();
  private tierBenefits: Map<string, TierBenefit[]> = new Map();

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
    this.initializeTierSystem();
  }

  async getUserTierInfo(userId: string): Promise<TierInfo> {
    try {
      const result = await this.db.query(`
        SELECT 
          points_earned,
          current_tier,
          tier_upgraded_at,
          created_at
        FROM user_profiles 
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return this.getDefaultTierInfo();
      }

      const user = result.rows[0];
      const pointsEarned = user.points_earned || 0;
      const currentTier = this.calculateTier(pointsEarned);
      const nextTier = this.getNextTier(currentTier);
      const nextTierThreshold = this.tierThresholds.get(nextTier) || 0;
      const currentTierThreshold = this.tierThresholds.get(currentTier) || 0;
      
      const progress = nextTier ? 
        ((pointsEarned - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100 : 100;

      const tierUpgradedAt = user.tier_upgraded_at || user.created_at;
      const daysInTier = Math.floor((Date.now() - new Date(tierUpgradedAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        currentTier,
        tierLevel: this.getTierLevel(currentTier),
        pointsEarned,
        nextTierThreshold,
        progress: Math.max(0, Math.min(100, progress)),
        benefits: this.getTierBenefits(currentTier).map(b => b.description),
        daysInTier
      };
    } catch (error) {
      console.error('Error getting tier info:', error);
      return this.getDefaultTierInfo();
    }
  }

  async checkAndUpgradeTier(userId: string): Promise<{upgraded: boolean, oldTier?: string, newTier?: string, benefits?: string[]}> {
    try {
      const result = await this.db.query(`
        SELECT points_earned, current_tier 
        FROM user_profiles 
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return { upgraded: false };
      }

      const user = result.rows[0];
      const pointsEarned = user.points_earned || 0;
      const currentTier = user.current_tier || 'bronze';
      const calculatedTier = this.calculateTier(pointsEarned);

      if (calculatedTier !== currentTier) {
        // Upgrade tier
        await this.db.query(`
          UPDATE user_profiles 
          SET current_tier = $1, tier_upgraded_at = NOW(), updated_at = NOW()
          WHERE user_id = $2
        `, [calculatedTier, userId]);

        // Clear cache
        await this.redis.del(`tier:${userId}`);

        const benefits = this.getTierBenefits(calculatedTier).map(b => b.description);

        this.emit('tierUpgrade', {
          userId,
          oldTier: currentTier,
          newTier: calculatedTier,
          pointsEarned,
          benefits
        });

        return {
          upgraded: true,
          oldTier: currentTier,
          newTier: calculatedTier,
          benefits
        };
      }

      return { upgraded: false };
    } catch (error) {
      console.error('Error checking tier upgrade:', error);
      return { upgraded: false };
    }
  }

  async getTierMultiplier(userId: string, type: string): Promise<number> {
    try {
      const tierInfo = await this.getUserTierInfo(userId);
      const benefits = this.getTierBenefits(tierInfo.currentTier);
      
      const multiplierBenefit = benefits.find(b => 
        b.type === 'multiplier' && b.value.type === type
      );

      return multiplierBenefit ? multiplierBenefit.value.multiplier : 1.0;
    } catch (error) {
      console.error('Error getting tier multiplier:', error);
      return 1.0;
    }
  }

  async getTierDiscount(userId: string): Promise<number> {
    try {
      const tierInfo = await this.getUserTierInfo(userId);
      const benefits = this.getTierBenefits(tierInfo.currentTier);
      
      const discountBenefit = benefits.find(b => b.type === 'discount');
      return discountBenefit ? discountBenefit.value : 0;
    } catch (error) {
      console.error('Error getting tier discount:', error);
      return 0;
    }
  }

  async processMonthlyTierReview(): Promise<void> {
    try {
      // Get all users who might need tier updates
      const result = await this.db.query(`
        SELECT user_id, points_earned, current_tier 
        FROM user_profiles 
        WHERE updated_at >= NOW() - INTERVAL '1 month'
      `);

      let upgradeCount = 0;

      for (const user of result.rows) {
        const upgrade = await this.checkAndUpgradeTier(user.user_id);
        if (upgrade.upgraded) {
          upgradeCount++;
        }
      }

      console.log(`Monthly tier review complete: ${upgradeCount} users upgraded`);
    } catch (error) {
      console.error('Error in monthly tier review:', error);
    }
  }

  private calculateTier(pointsEarned: number): string {
    if (pointsEarned >= this.tierThresholds.get('diamond')!) return 'diamond';
    if (pointsEarned >= this.tierThresholds.get('platinum')!) return 'platinum';
    if (pointsEarned >= this.tierThresholds.get('gold')!) return 'gold';
    if (pointsEarned >= this.tierThresholds.get('silver')!) return 'silver';
    return 'bronze';
  }

  private getNextTier(currentTier: string): string | null {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  }

  private getTierLevel(tier: string): number {
    const levels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    return levels[tier as keyof typeof levels] || 1;
  }

  private getTierBenefits(tier: string): TierBenefit[] {
    return this.tierBenefits.get(tier) || [];
  }

  private getDefaultTierInfo(): TierInfo {
    return {
      currentTier: 'bronze',
      tierLevel: 1,
      pointsEarned: 0,
      nextTierThreshold: this.tierThresholds.get('silver') || 1000,
      progress: 0,
      benefits: this.getTierBenefits('bronze').map(b => b.description),
      daysInTier: 0
    };
  }

  private initializeTierSystem(): void {
    // Set tier thresholds
    this.tierThresholds.set('bronze', 0);
    this.tierThresholds.set('silver', 1000);
    this.tierThresholds.set('gold', 5000);
    this.tierThresholds.set('platinum', 15000);
    this.tierThresholds.set('diamond', 50000);

    // Set tier benefits
    this.tierBenefits.set('bronze', [
      { type: 'basic', value: true, description: 'Basic rewards access' },
      { type: 'support', value: 'standard', description: 'Standard customer support' }
    ]);

    this.tierBenefits.set('silver', [
      { type: 'discount', value: 5, description: '5% discount on tickets' },
      { type: 'priority', value: true, description: 'Priority customer support' },
      { type: 'early_access', value: 24, description: '24-hour early access to tickets' }
    ]);

    this.tierBenefits.set('gold', [
      { type: 'discount', value: 10, description: '10% discount on tickets' },
      { type: 'free_transfers', value: 2, description: '2 free ticket transfers per month' },
      { type: 'vip_events', value: true, description: 'Access to VIP events' },
      { type: 'multiplier', value: { type: 'points', multiplier: 1.5 }, description: '1.5x points earning' }
    ]);

    this.tierBenefits.set('platinum', [
      { type: 'discount', value: 15, description: '15% discount on tickets' },
      { type: 'free_transfers', value: 5, description: '5 free ticket transfers per month' },
      { type: 'meet_greet', value: true, description: 'Meet & greet opportunities' },
      { type: 'exclusive_content', value: true, description: 'Exclusive behind-the-scenes content' },
      { type: 'multiplier', value: { type: 'points', multiplier: 2.0 }, description: '2x points earning' }
    ]);

    this.tierBenefits.set('diamond', [
      { type: 'discount', value: 20, description: '20% discount on tickets' },
      { type: 'unlimited_transfers', value: true, description: 'Unlimited free ticket transfers' },
      { type: 'backstage_access', value: true, description: 'Backstage access to events' },
      { type: 'personal_concierge', value: true, description: 'Personal concierge service' },
      { type: 'multiplier', value: { type: 'points', multiplier: 3.0 }, description: '3x points earning' },
      { type: 'exclusive_experiences', value: true, description: 'Exclusive once-in-a-lifetime experiences' }
    ]);
  }
}

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';
import moment from 'moment';

interface BirthdayReward {
  type: 'points' | 'discount' | 'exclusive_access' | 'special_offer';
  value: any;
  description: string;
  expiresIn: number; // days
}

interface SpecialOccasion {
  name: string;
  date: Date;
  rewards: BirthdayReward[];
  eligibility: 'all' | 'tier_based' | 'custom';
}

export class BirthdayRewards extends EventEmitter {
  private db: Pool;
  private redis: Redis;
  private birthdayRewards: Map<string, BirthdayReward[]> = new Map();
  private specialOccasions: Map<string, SpecialOccasion> = new Map();

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
    this.initializeBirthdayRewards();
    this.initializeSpecialOccasions();
  }

  async checkBirthdayRewards(userId: string): Promise<{isBirthday: boolean, rewards: BirthdayReward[], claimed: boolean}> {
    try {
      const user = await this.db.query(`
        SELECT birthday, current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      if (user.rows.length === 0 || !user.rows[0].birthday) {
        return { isBirthday: false, rewards: [], claimed: false };
      }

      const birthday = moment(user.rows[0].birthday);
      const today = moment();
      const tier = user.rows[0].current_tier;

      // Check if it's their birthday (month and day match)
      const isBirthday = birthday.format('MM-DD') === today.format('MM-DD');

      if (!isBirthday) {
        return { isBirthday: false, rewards: [], claimed: false };
      }

      // Check if already claimed this year
      const claimed = await this.checkIfBirthdayRewardsClaimed(userId, today.year());
      
      const rewards = this.getBirthdayRewardsForTier(tier);

      if (!claimed && rewards.length > 0) {
        this.emit('birthdayDetected', {
          userId,
          tier,
          availableRewards: rewards
        });
      }

      return { isBirthday, rewards, claimed };
    } catch (error) {
      console.error('Error checking birthday rewards:', error);
      return { isBirthday: false, rewards: [], claimed: false };
    }
  }

  async claimBirthdayRewards(userId: string): Promise<{success: boolean, pointsAwarded?: number, rewards?: string[]}> {
    try {
      const birthdayCheck = await this.checkBirthdayRewards(userId);
      
      if (!birthdayCheck.isBirthday || birthdayCheck.claimed) {
        return { success: false };
      }

      const user = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const tier = user.rows[0].current_tier;
      const rewards = this.getBirthdayRewardsForTier(tier);
      let totalPointsAwarded = 0;
      const claimedRewards: string[] = [];

      // Process each reward
      for (const reward of rewards) {
        if (reward.type === 'points') {
          totalPointsAwarded += reward.value;
        }
        
        // Create special offers/discounts
        if (reward.type === 'discount' || reward.type === 'special_offer') {
          await this.createSpecialOffer(userId, reward);
        }

        claimedRewards.push(reward.description);
      }

      // Award points
      if (totalPointsAwarded > 0) {
        await this.db.query(`
          UPDATE user_profiles 
          SET points_balance = points_balance + $1,
              points_earned = points_earned + $1,
              updated_at = NOW()
          WHERE user_id = $2
        `, [totalPointsAwarded, userId]);

        // Record points transaction
        await this.db.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, 'bonus', 'Birthday bonus', $3,
            (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
        `, [userId, totalPointsAwarded, JSON.stringify({ tier, rewards: claimedRewards })]);
      }

      // Record birthday reward claim
      await this.db.query(`
        INSERT INTO birthday_claims (
          user_id, claim_year, points_awarded, rewards_claimed, claimed_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [userId, moment().year(), totalPointsAwarded, JSON.stringify(claimedRewards)]);

      // Clear cache
      await this.redis.del(`points:${userId}`);

      this.emit('birthdayRewardsClaimed', {
        userId,
        tier,
        pointsAwarded: totalPointsAwarded,
        rewards: claimedRewards
      });

      return {
        success: true,
        pointsAwarded: totalPointsAwarded,
        rewards: claimedRewards
      };
    } catch (error) {
      console.error('Error claiming birthday rewards:', error);
      return { success: false };
    }
  }

  async processDailyBirthdayRewards(): Promise<void> {
    try {
      const today = moment().format('MM-DD');
      
      // Find users with birthdays today
      const result = await this.db.query(`
        SELECT user_id, current_tier 
        FROM user_profiles 
        WHERE TO_CHAR(birthday, 'MM-DD') = $1
          AND user_id NOT IN (
            SELECT user_id FROM birthday_claims 
            WHERE claim_year = $2
          )
      `, [today, moment().year()]);

      console.log(`Found ${result.rows.length} users with birthdays today`);

      for (const user of result.rows) {
        // Auto-award basic birthday rewards
        const basicBirthdayPoints = parseInt(process.env.BIRTHDAY_BONUS_POINTS || '500');
        
        await this.db.query(`
          UPDATE user_profiles 
          SET points_balance = points_balance + $1,
              points_earned = points_earned + $1,
              updated_at = NOW()
          WHERE user_id = $2
        `, [basicBirthdayPoints, user.user_id]);

        // Record transaction
        await this.db.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, 'bonus', 'Birthday bonus - auto awarded', $3,
            (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
        `, [user.user_id, basicBirthdayPoints, JSON.stringify({ tier: user.current_tier })]);

        // Send birthday notification
        this.emit('birthdayNotification', {
          userId: user.user_id,
          tier: user.current_tier,
          pointsAwarded: basicBirthdayPoints
        });
      }
    } catch (error) {
      console.error('Error processing daily birthday rewards:', error);
    }
  }

  async checkSpecialOccasions(): Promise<SpecialOccasion[]> {
    const today = moment();
    const activeOccasions: SpecialOccasion[] = [];

    for (const [name, occasion] of this.specialOccasions) {
      const occasionDate = moment(occasion.date);
      
      // Check if it's within 3 days of the special occasion
      if (Math.abs(today.diff(occasionDate, 'days')) <= 3) {
        activeOccasions.push(occasion);
      }
    }

    return activeOccasions;
  }

  async createSpecialOffer(userId: string, reward: BirthdayReward): Promise<void> {
    try {
      const expiresAt = moment().add(reward.expiresIn, 'days').toDate();
      
      await this.db.query(`
        INSERT INTO special_offers (
          user_id, offer_type, offer_value, description, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [userId, reward.type, JSON.stringify(reward.value), reward.description, expiresAt]);

      this.emit('specialOfferCreated', {
        userId,
        offerType: reward.type,
        description: reward.description,
        expiresAt
      });
    } catch (error) {
      console.error('Error creating special offer:', error);
    }
  }

  private async checkIfBirthdayRewardsClaimed(userId: string, year: number): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT id FROM birthday_claims 
        WHERE user_id = $1 AND claim_year = $2
      `, [userId, year]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking birthday rewards claimed:', error);
      return false;
    }
  }

  private getBirthdayRewardsForTier(tier: string): BirthdayReward[] {
    return this.birthdayRewards.get(tier) || this.birthdayRewards.get('bronze') || [];
  }

  private initializeBirthdayRewards(): void {
    // Bronze tier birthday rewards
    this.birthdayRewards.set('bronze', [
      {
        type: 'points',
        value: 500,
        description: '500 Birthday Bonus Points',
        expiresIn: 0
      },
      {
        type: 'discount',
        value: { percentage: 10, category: 'all' },
        description: '10% Birthday Discount (valid for 30 days)',
        expiresIn: 30
      }
    ]);

    // Silver tier birthday rewards
    this.birthdayRewards.set('silver', [
      {
        type: 'points',
        value: 750,
        description: '750 Birthday Bonus Points',
        expiresIn: 0
      },
      {
        type: 'discount',
        value: { percentage: 15, category: 'all' },
        description: '15% Birthday Discount (valid for 30 days)',
        expiresIn: 30
      },
      {
        type: 'special_offer',
        value: { type: 'early_access', hours: 24 },
        description: '24-hour early access to new events',
        expiresIn: 7
      }
    ]);

    // Gold tier birthday rewards
    this.birthdayRewards.set('gold', [
      {
        type: 'points',
        value: 1000,
        description: '1000 Birthday Bonus Points',
        expiresIn: 0
      },
      {
        type: 'discount',
        value: { percentage: 20, category: 'all' },
        description: '20% Birthday Discount (valid for 30 days)',
        expiresIn: 30
      },
      {
        type: 'exclusive_access',
        value: { type: 'vip_lounge', events: 3 },
        description: 'VIP lounge access for next 3 events',
        expiresIn: 90
      }
    ]);

    // Platinum tier birthday rewards
    this.birthdayRewards.set('platinum', [
      {
        type: 'points',
        value: 1500,
        description: '1500 Birthday Bonus Points',
        expiresIn: 0
      },
      {
        type: 'discount',
        value: { percentage: 25, category: 'all' },
        description: '25% Birthday Discount (valid for 45 days)',
        expiresIn: 45
      },
      {
        type: 'special_offer',
        value: { type: 'meet_greet_lottery', entries: 3 },
        description: '3 bonus meet & greet lottery entries',
        expiresIn: 60
      }
    ]);

    // Diamond tier birthday rewards
    this.birthdayRewards.set('diamond', [
      {
        type: 'points',
        value: 2500,
        description: '2500 Birthday Bonus Points',
        expiresIn: 0
      },
      {
        type: 'discount',
        value: { percentage: 30, category: 'all' },
        description: '30% Birthday Discount (valid for 60 days)',
        expiresIn: 60
      },
      {
        type: 'exclusive_access',
        value: { type: 'backstage_pass', quantity: 1 },
        description: 'Complimentary backstage pass',
        expiresIn: 365
      },
      {
        type: 'special_offer',
        value: { type: 'personal_concierge', hours: 24 },
        description: '24-hour personal concierge service',
        expiresIn: 30
      }
    ]);
  }

  private initializeSpecialOccasions(): void {
    // New Year's celebration
    this.specialOccasions.set('new_year', {
      name: 'New Year Celebration',
      date: new Date(new Date().getFullYear(), 0, 1), // January 1st
      rewards: [
        {
          type: 'points',
          value: 1000,
          description: 'New Year Bonus - 1000 Points',
          expiresIn: 0
        }
      ],
      eligibility: 'all'
    });

    // Platform anniversary
    this.specialOccasions.set('anniversary', {
      name: 'TicketToken Anniversary',
      date: new Date(new Date().getFullYear(), 2, 15), // March 15th
      rewards: [
        {
          type: 'points',
          value: 2000,
          description: 'Anniversary Celebration - 2000 Points',
          expiresIn: 0
        },
        {
          type: 'discount',
          value: { percentage: 20, category: 'all' },
          description: '20% Anniversary Discount',
          expiresIn: 7
        }
      ],
      eligibility: 'all'
    });
  }
}

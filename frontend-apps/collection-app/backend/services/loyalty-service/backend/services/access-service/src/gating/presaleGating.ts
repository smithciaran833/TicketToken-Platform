import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface PresaleAccess {
  eventId: string;
  userId: string;
  accessType: string; // 'tier', 'vip', 'code', 'whitelist'
  enteredAt: Date;
  purchaseDeadline: Date;
  maxTickets: number;
  ticketsPurchased: number;
}

interface PresaleEvent {
  id: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
  requiredTier?: string;
  requiredPasses?: string[];
  accessCodes?: string[];
  whitelistOnly: boolean;
  maxParticipants?: number;
  currentParticipants: number;
}

export class PresaleGating extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async checkPresaleAccess(userId: string, eventId: string): Promise<{
    hasAccess: boolean;
    accessType?: string;
    entryOptions?: string[];
    waitingList?: boolean;
    reason?: string;
  }> {
    try {
      // Check if user already has access
      const existingAccess = await this.db.query(`
        SELECT * FROM presale_access 
        WHERE user_id = $1 AND event_id = $2
      `, [userId, eventId]);

      if (existingAccess.rows.length > 0) {
        return {
          hasAccess: true,
          accessType: existingAccess.rows[0].access_type
        };
      }

      // Get presale configuration
      const presale = await this.getPresaleConfig(eventId);
      if (!presale) {
        return {
          hasAccess: false,
          reason: 'No presale configured for this event'
        };
      }

      // Check if presale is active
      const now = new Date();
      if (now < presale.startTime) {
        return {
          hasAccess: false,
          reason: 'Presale has not started yet'
        };
      }

      if (now > presale.endTime) {
        return {
          hasAccess: false,
          reason: 'Presale has ended'
        };
      }

      // Check capacity
      if (presale.maxParticipants && presale.currentParticipants >= presale.maxParticipants) {
        return {
          hasAccess: false,
          waitingList: true,
          reason: 'Presale is at capacity'
        };
      }

      // Check access methods
      const entryOptions = await this.getEntryOptions(userId, presale);

      if (entryOptions.length === 0) {
        return {
          hasAccess: false,
          reason: 'No valid access method found'
        };
      }

      return {
        hasAccess: false, // Not automatically granted, user must use entry method
        entryOptions,
        reason: 'Use one of the available entry methods'
      };

    } catch (error) {
      console.error('Presale access check error:', error);
      throw error;
    }
  }

  async enterPresale(userId: string, eventId: string, accessCode?: string): Promise<{
    success: boolean;
    accessType?: string;
    queuePosition?: number;
    message?: string;
  }> {
    try {
      const presale = await this.getPresaleConfig(eventId);
      if (!presale) {
        return { success: false, message: 'Presale not found' };
      }

      // Check if already entered
      const existing = await this.db.query(`
        SELECT * FROM presale_access WHERE user_id = $1 AND event_id = $2
      `, [userId, eventId]);

      if (existing.rows.length > 0) {
        return { 
          success: true, 
          accessType: existing.rows[0].access_type,
          message: 'Already in presale' 
        };
      }

      // Determine access type
      let accessType = '';
      let maxTickets = 4; // Default

      // Check tier access
      const userTier = await this.getUserTier(userId);
      if (presale.requiredTier && this.tierMeetsRequirement(userTier, presale.requiredTier)) {
        accessType = 'tier';
        maxTickets = this.getTierTicketLimit(userTier);
      }

      // Check VIP pass access
      if (!accessType) {
        const vipAccess = await this.checkVipAccess(userId, presale.requiredPasses || []);
        if (vipAccess.hasAccess) {
          accessType = 'vip';
          maxTickets = 8; // VIP gets more tickets
        }
      }

      // Check access code
      if (!accessType && accessCode) {
        const codeValid = await this.validateAccessCode(eventId, accessCode);
        if (codeValid) {
          accessType = 'code';
          maxTickets = 6;
        }
      }

      // Check whitelist
      if (!accessType && presale.whitelistOnly) {
        const whitelisted = await this.checkWhitelist(userId, eventId);
        if (whitelisted) {
          accessType = 'whitelist';
          maxTickets = 4;
        }
      }

      if (!accessType) {
        return { success: false, message: 'No valid access method' };
      }

      // Check capacity again (with lock)
      const lockKey = `presale_lock:${eventId}`;
      const lockAcquired = await this.redis.set(lockKey, 'locked', 'EX', 10, 'NX');

      if (!lockAcquired) {
        return { success: false, message: 'System busy, please try again' };
      }

      try {
        // Recheck current participants
        const currentCount = await this.getCurrentParticipants(eventId);
        
        if (presale.maxParticipants && currentCount >= presale.maxParticipants) {
          // Add to waiting list
          await this.addToWaitingList(userId, eventId, accessType);
          const queuePosition = await this.getWaitingListPosition(userId, eventId);
          
          return {
            success: false,
            queuePosition,
            message: 'Added to waiting list'
          };
        }

        // Grant presale access
        await this.grantPresaleAccess(userId, eventId, accessType, maxTickets);

        // Update participant count
        await this.incrementParticipants(eventId);

        // Emit event
        this.emit('presaleEntered', {
          userId,
          eventId,
          accessType,
          maxTickets,
          timestamp: new Date()
        });

        return {
          success: true,
          accessType,
          message: 'Successfully entered presale'
        };

      } finally {
        await this.redis.del(lockKey);
      }

    } catch (error) {
      console.error('Presale entry error:', error);
      throw error;
    }
  }

  async getPresaleQueue(eventId: string): Promise<{
    totalParticipants: number;
    maxParticipants?: number;
    waitingListCount: number;
    averageWaitTime?: number;
  }> {
    try {
      const participants = await this.getCurrentParticipants(eventId);
      const waitingList = await this.getWaitingListCount(eventId);
      const presale = await this.getPresaleConfig(eventId);

      return {
        totalParticipants: participants,
        maxParticipants: presale?.maxParticipants,
        waitingListCount: waitingList,
        averageWaitTime: this.calculateAverageWaitTime(waitingList)
      };

    } catch (error) {
      console.error('Get presale queue error:', error);
      throw error;
    }
  }

  private async getPresaleConfig(eventId: string): Promise<PresaleEvent | null> {
    const result = await this.db.query(`
      SELECT * FROM presale_events WHERE event_id = $1
    `, [eventId]);

    return result.rows[0] || null;
  }

  private async getEntryOptions(userId: string, presale: PresaleEvent): Promise<string[]> {
    const options: string[] = [];

    // Check tier
    if (presale.requiredTier) {
      const userTier = await this.getUserTier(userId);
      if (this.tierMeetsRequirement(userTier, presale.requiredTier)) {
        options.push('tier');
      }
    }

    // Check VIP passes
    if (presale.requiredPasses && presale.requiredPasses.length > 0) {
      const vipAccess = await this.checkVipAccess(userId, presale.requiredPasses);
      if (vipAccess.hasAccess) {
        options.push('vip');
      }
    }

    // Access codes always available if configured
    if (presale.accessCodes && presale.accessCodes.length > 0) {
      options.push('access_code');
    }

    // Check whitelist
    if (presale.whitelistOnly) {
      const whitelisted = await this.checkWhitelist(userId, presale.eventId);
      if (whitelisted) {
        options.push('whitelist');
      }
    }

    return options;
  }

  private async getUserTier(userId: string): Promise<string> {
    const result = await this.db.query(`
      SELECT current_tier FROM user_profiles WHERE user_id = $1
    `, [userId]);

    return result.rows[0]?.current_tier || 'bronze';
  }

  private tierMeetsRequirement(userTier: string, requiredTier: string): boolean {
    const tierLevels = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
    const userLevel = tierLevels[userTier as keyof typeof tierLevels] || 1;
    const requiredLevel = tierLevels[requiredTier as keyof typeof tierLevels] || 5;

    return userLevel >= requiredLevel;
  }

  private getTierTicketLimit(tier: string): number {
    const limits = { bronze: 2, silver: 4, gold: 6, platinum: 8, diamond: 10 };
    return limits[tier as keyof typeof limits] || 2;
  }

  private async checkVipAccess(userId: string, requiredPasses: string[]): Promise<{ hasAccess: boolean }> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM vip_passes 
      WHERE owner = $1 AND pass_type = ANY($2) AND valid_until > NOW()
    `, [userId, requiredPasses]);

    return { hasAccess: parseInt(result.rows[0].count) > 0 };
  }

  private async validateAccessCode(eventId: string, code: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM presale_access_codes 
      WHERE event_id = $1 AND code = $2 AND active = true
    `, [eventId, code]);

    return parseInt(result.rows[0].count) > 0;
  }

  private async checkWhitelist(userId: string, eventId: string): Promise<boolean> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM presale_whitelist 
      WHERE user_id = $1 AND event_id = $2
    `, [userId, eventId]);

    return parseInt(result.rows[0].count) > 0;
  }

  private async grantPresaleAccess(userId: string, eventId: string, accessType: string, maxTickets: number): Promise<void> {
    await this.db.query(`
      INSERT INTO presale_access (user_id, event_id, access_type, entered_at, max_tickets, tickets_purchased)
      VALUES ($1, $2, $3, NOW(), $4, 0)
    `, [userId, eventId, accessType, maxTickets]);

    // Cache access
    await this.redis.setex(`presale_access:${userId}:${eventId}`, 3600, accessType);
  }

  private async getCurrentParticipants(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM presale_access WHERE event_id = $1
    `, [eventId]);

    return parseInt(result.rows[0].count);
  }

  private async incrementParticipants(eventId: string): Promise<void> {
    await this.db.query(`
      UPDATE presale_events SET current_participants = current_participants + 1
      WHERE event_id = $1
    `, [eventId]);
  }

  private async addToWaitingList(userId: string, eventId: string, accessType: string): Promise<void> {
    await this.db.query(`
      INSERT INTO presale_waiting_list (user_id, event_id, access_type, joined_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, eventId, accessType]);
  }

  private async getWaitingListPosition(userId: string, eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as position FROM presale_waiting_list 
      WHERE event_id = $1 AND joined_at <= (
        SELECT joined_at FROM presale_waiting_list 
        WHERE user_id = $2 AND event_id = $1
      )
    `, [eventId, userId]);

    return parseInt(result.rows[0].position);
  }

  private async getWaitingListCount(eventId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM presale_waiting_list WHERE event_id = $1
    `, [eventId]);

    return parseInt(result.rows[0].count);
  }

  private calculateAverageWaitTime(waitingListCount: number): number {
    // Estimate 5 minutes per person ahead in queue
    return waitingListCount * 5;
  }
}

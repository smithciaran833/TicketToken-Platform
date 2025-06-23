import { EventEmitter } from 'events';
import { RedisMultiTierCache } from './redisCaching';
import { SmartCDNCache } from './cdnIntegration';
import { DatabaseQueryCache } from './databaseCache';
import { Logger } from '../utils/logger';
import { InvalidationEvent, CacheTier } from '../types';

export class SmartInvalidationManager extends EventEmitter {
  private redisCache: RedisMultiTierCache;
  private cdnCache: SmartCDNCache;
  private dbCache: DatabaseQueryCache;
  private logger: Logger;
  private invalidationHistory: InvalidationEvent[];
  private rules: Map<string, InvalidationRule>;

  constructor(
    redisCache: RedisMultiTierCache,
    cdnCache: SmartCDNCache,
    dbCache: DatabaseQueryCache
  ) {
    super();
    this.redisCache = redisCache;
    this.cdnCache = cdnCache;
    this.dbCache = dbCache;
    this.logger = new Logger('SmartInvalidation');
    this.invalidationHistory = [];
    this.rules = new Map();
    
    this.setupInvalidationRules();
  }

  async invalidate(pattern: string, reason: string, tiers?: CacheTier[]): Promise<void> {
    const targetTiers = tiers || ['L1', 'L2', 'L3', 'CDN'];
    
    this.logger.info('Starting smart invalidation', { pattern, reason, tiers: targetTiers });

    const promises: Promise<void>[] = [];

    for (const tier of targetTiers) {
      switch (tier) {
        case 'L1':
        case 'L2':
        case 'L3':
          promises.push(this.invalidateRedisPattern(pattern));
          break;
        case 'CDN':
          promises.push(this.cdnCache.invalidatePattern(pattern));
          break;
      }
    }

    try {
      await Promise.allSettled(promises);
      
      this.recordInvalidation(pattern, targetTiers, reason);
      this.emit('invalidation', { pattern, tiers: targetTiers, reason });
      
    } catch (error) {
      this.logger.error('Invalidation failed', { pattern, reason, error: error.message });
      throw error;
    }
  }

  async invalidateByEvent(eventType: string, entityId: string, data?: any): Promise<void> {
    const rule = this.rules.get(eventType);
    if (!rule) {
      this.logger.warn('No invalidation rule found', { eventType });
      return;
    }

    const patterns = rule.generatePatterns(entityId, data);
    
    for (const pattern of patterns) {
      await this.invalidate(pattern, `Event: ${eventType}`, rule.tiers);
    }
  }

  private async invalidateRedisPattern(pattern: string): Promise<void> {
    // Redis doesn't support pattern deletion directly, so we need to scan and delete
    // This is a simplified implementation - in production, you'd want to be more careful
    try {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        this.logger.warn('Wildcard invalidation not fully implemented', { pattern });
      } else {
        // Direct key deletion
        await this.redisCache.delete(pattern);
      }
    } catch (error) {
      this.logger.error('Redis pattern invalidation failed', { pattern, error: error.message });
    }
  }

  private setupInvalidationRules(): void {
    // Event updated
    this.rules.set('event.updated', {
      tiers: ['L1', 'L2', 'L3', 'CDN'],
      generatePatterns: (eventId: string) => [
        `event:${eventId}`,
        `event:${eventId}:*`,
        `events:list:*`,
        `/api/events/${eventId}*`,
        `/events/${eventId}/poster.jpg`
      ]
    });

    // Ticket minted
    this.rules.set('ticket.minted', {
      tiers: ['L1', 'L2', 'L3'],
      generatePatterns: (ticketId: string, data: any) => [
        `ticket:${ticketId}`,
        `event:${data?.eventId}:tickets`,
        `user:${data?.userId}:tickets`,
        `blockchain:account:${ticketId}`
      ]
    });

    // User updated
    this.rules.set('user.updated', {
      tiers: ['L1', 'L2'],
      generatePatterns: (userId: string) => [
        `user:${userId}`,
        `user:${userId}:*`,
        `user:session:${userId}`
      ]
    });

    // Venue updated
    this.rules.set('venue.updated', {
      tiers: ['L1', 'L2', 'L3', 'CDN'],
      generatePatterns: (venueId: string) => [
        `venue:${venueId}`,
        `venue:${venueId}:*`,
        `venues:list:*`,
        `/api/venues/${venueId}*`
      ]
    });

    // Price updated
    this.rules.set('price.updated', {
      tiers: ['L1', 'L2'],
      generatePatterns: (eventId: string) => [
        `event:${eventId}:pricing`,
        `event:${eventId}:tiers`,
        `/api/events/${eventId}/pricing`
      ]
    });

    // Marketplace listing
    this.rules.set('listing.created', {
      tiers: ['L1', 'L2'],
      generatePatterns: (listingId: string, data: any) => [
        `marketplace:listing:${listingId}`,
        `marketplace:event:${data?.eventId}`,
        `marketplace:user:${data?.sellerId}`,
        `/api/marketplace/*`
      ]
    });
  }

  private recordInvalidation(pattern: string, tiers: CacheTier[], reason: string): void {
    const event: InvalidationEvent = {
      pattern,
      tier: tiers[0], // Simplified for storage
      timestamp: Date.now(),
      reason
    };

    this.invalidationHistory.push(event);

    // Keep only last 1000 invalidations
    if (this.invalidationHistory.length > 1000) {
      this.invalidationHistory = this.invalidationHistory.slice(-1000);
    }
  }

  getInvalidationHistory(limit: number = 100): InvalidationEvent[] {
    return this.invalidationHistory.slice(-limit);
  }

  getInvalidationStats(): any {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const recentInvalidations = this.invalidationHistory.filter(
      event => now - event.timestamp < oneHour
    );

    const reasonCounts = recentInvalidations.reduce((acc, event) => {
      acc[event.reason] = (acc[event.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.invalidationHistory.length,
      lastHour: recentInvalidations.length,
      reasonBreakdown: reasonCounts
    };
  }
}

interface InvalidationRule {
  tiers: CacheTier[];
  generatePatterns: (entityId: string, data?: any) => string[];
}

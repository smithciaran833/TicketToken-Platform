import Redis, { Cluster } from 'ioredis';
import { CacheStrategy, CacheStats, CacheConfig } from '../types';
import { Logger } from '../utils/logger';

export class RedisMultiTierCache implements CacheStrategy {
  private primaryCluster: Cluster;
  private fallbackCache: Redis;
  private localCache: Map<string, any>;
  private cacheStats: CacheStats;
  private logger: Logger;

  constructor(config: CacheConfig) {
    this.logger = new Logger('RedisCache');
    this.cacheStats = { hits: 0, misses: 0, hitRate: 0, size: 0, memory: 0 };
    this.localCache = new Map();
    
    // Initialize Redis cluster for primary cache with correct options
    this.primaryCluster = new Redis.Cluster(
      config.redis.primaryHosts.map(host => ({ host, port: 6379 })),
      {
        redisOptions: {
          password: config.redis.password,
          maxRetriesPerRequest: config.redis.maxRetries,
          retryDelayOnFailover: config.redis.retryDelayOnFailover,
        },
        enableOfflineQueue: false,
      }
    );

    // Initialize fallback Redis instance with correct options
    this.fallbackCache = new Redis({
      host: config.redis.fallbackHost,
      port: config.redis.fallbackPort,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    this.setupEventHandlers();
    this.startCleanupProcess();
  }

  async get(key: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      // L1: Check local memory cache (sub-millisecond)
      if (this.localCache.has(key)) {
        this.recordHit('L1', Date.now() - startTime);
        const item = this.localCache.get(key);
        if (this.isItemValid(item)) {
          item.accessCount++;
          item.lastAccess = Date.now();
          return item.value;
        } else {
          this.localCache.delete(key);
        }
      }

      // L2: Check primary Redis cluster (1-2ms)
      try {
        const primaryResult = await this.primaryCluster.get(key);
        if (primaryResult) {
          const data = JSON.parse(primaryResult);
          this.recordHit('L2', Date.now() - startTime);
          
          // Promote to L1 if frequently accessed
          if (this.shouldPromoteToL1(key)) {
            this.setLocalCache(key, data);
          }
          return data;
        }
      } catch (error: any) {
        this.logger.warn('Primary cache miss, checking fallback', { key, error: error.message });
      }

      // L3: Check fallback Redis (5-10ms)
      const fallbackResult = await this.fallbackCache.get(key);
      if (fallbackResult) {
        const data = JSON.parse(fallbackResult);
        this.recordHit('L3', Date.now() - startTime);
        
        // Backfill primary cache asynchronously
        this.primaryCluster.setex(key, 3600, fallbackResult).catch((err: any) => 
          this.logger.error('Failed to backfill primary cache', { key, error: err.message })
        );
        
        return data;
      }

      this.recordMiss(Date.now() - startTime);
      return null;

    } catch (error: any) {
      this.logger.error('Cache get error', { key, error: error.message });
      this.recordMiss(Date.now() - startTime);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    const promises: Promise<any>[] = [];

    try {
      // Write to primary Redis cluster
      promises.push(
        this.primaryCluster.setex(key, ttl, serialized)
      );

      // Write to fallback with longer TTL
      promises.push(
        this.fallbackCache.setex(key, ttl * 2, serialized)
      );

      // Update local cache if appropriate
      if (this.shouldCacheLocally(key, value)) {
        this.setLocalCache(key, value, ttl);
      }

      await Promise.allSettled(promises);
      
    } catch (error: any) {
      this.logger.error('Cache set error', { key, error: error.message });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const promises: Promise<any>[] = [];

    try {
      // Remove from all tiers
      this.localCache.delete(key);
      promises.push(this.primaryCluster.del(key));
      promises.push(this.fallbackCache.del(key));

      await Promise.allSettled(promises);
      
    } catch (error: any) {
      this.logger.error('Cache delete error', { key, error: error.message });
    }
  }

  async clear(): Promise<void> {
    try {
      this.localCache.clear();
      await Promise.allSettled([
        this.primaryCluster.flushall(),
        this.fallbackCache.flushall()
      ]);
    } catch (error: any) {
      this.logger.error('Cache clear error', { error: error.message });
    }
  }

  async stats(): Promise<CacheStats> {
    const localMemory = this.calculateLocalCacheMemory();
    
    return {
      ...this.cacheStats,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
      size: this.localCache.size,
      memory: localMemory
    };
  }

  private shouldPromoteToL1(key: string): boolean {
    return key.includes('ticket:') || 
           key.includes('event:hot') || 
           key.includes('user:session:');
  }

  private shouldCacheLocally(key: string, value: any): boolean {
    const serialized = JSON.stringify(value);
    return serialized.length < 10240 && this.shouldPromoteToL1(key);
  }

  private setLocalCache(key: string, value: any, ttl: number = 3600): void {
    if (this.localCache.size >= 10000) {
      const oldestKey = this.findLeastRecentlyUsed();
      if (oldestKey) {
        this.localCache.delete(oldestKey);
      }
    }

    this.localCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000,
      accessCount: 1,
      lastAccess: Date.now()
    });
  }

  private isItemValid(item: any): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  private findLeastRecentlyUsed(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.localCache) {
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private recordHit(tier: string, responseTime: number): void {
    this.cacheStats.hits++;
    this.logger.debug(`Cache hit [${tier}]`, { responseTime });
  }

  private recordMiss(responseTime: number): void {
    this.cacheStats.misses++;
    this.logger.debug('Cache miss', { responseTime });
  }

  private calculateLocalCacheMemory(): number {
    let totalMemory = 0;
    for (const [key, value] of this.localCache) {
      totalMemory += JSON.stringify({ key, value }).length * 2;
    }
    return totalMemory;
  }

  private setupEventHandlers(): void {
    this.primaryCluster.on('error', (error: any) => {
      this.logger.error('Primary cluster error', { error: error.message });
    });

    this.fallbackCache.on('error', (error: any) => {
      this.logger.error('Fallback cache error', { error: error.message });
    });

    this.primaryCluster.on('ready', () => {
      this.logger.info('Primary Redis cluster ready');
    });

    this.fallbackCache.on('ready', () => {
      this.logger.info('Fallback Redis ready');
    });
  }

  private startCleanupProcess(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.localCache) {
        if (!this.isItemValid(item)) {
          this.localCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

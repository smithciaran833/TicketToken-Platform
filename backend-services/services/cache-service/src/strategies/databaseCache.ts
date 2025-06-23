import { CacheStrategy, CacheStats } from '../types';
import { RedisMultiTierCache } from './redisCaching';
import { Logger } from '../utils/logger';

export class DatabaseQueryCache {
  private cache: RedisMultiTierCache;
  private logger: Logger;
  private queryStats: Map<string, any>;

  constructor(cache: RedisMultiTierCache) {
    this.cache = cache;
    this.logger = new Logger('DatabaseCache');
    this.queryStats = new Map();
  }

  async cacheQuery(sql: string, params: any[], result: any, ttl: number = 300): Promise<void> {
    const key = this.generateQueryKey(sql, params);
    
    try {
      await this.cache.set(key, {
        result,
        timestamp: Date.now(),
        sql: sql.substring(0, 100), // Store truncated SQL for debugging
        params: params.length
      }, ttl);

      this.updateQueryStats(key, 'cache');
      
    } catch (error) {
      this.logger.error('Failed to cache query result', { key, error: error.message });
    }
  }

  async getCachedQuery(sql: string, params: any[]): Promise<any> {
    const key = this.generateQueryKey(sql, params);
    
    try {
      const cached = await this.cache.get(key);
      
      if (cached) {
        this.updateQueryStats(key, 'hit');
        this.logger.debug('Query cache hit', { key: key.substring(0, 50) });
        return cached.result;
      }

      this.updateQueryStats(key, 'miss');
      return null;

    } catch (error) {
      this.logger.error('Failed to get cached query', { key, error: error.message });
      return null;
    }
  }

  async invalidateTableCache(tableName: string): Promise<void> {
    // This would require a more sophisticated implementation
    // For now, we'll use pattern-based invalidation
    const pattern = `query:*:${tableName}:*`;
    this.logger.info('Invalidating table cache', { tableName, pattern });
    
    // In a real implementation, you'd need to track which queries touch which tables
    // and invalidate accordingly
  }

  async warmUpCache(queries: Array<{ sql: string; params: any[]; ttl?: number }>): Promise<void> {
    this.logger.info('Starting cache warm-up', { queryCount: queries.length });

    const promises = queries.map(async ({ sql, params, ttl = 300 }) => {
      try {
        // In a real implementation, you'd execute the query against the database
        // For this example, we'll simulate it
        const mockResult = { warmedUp: true, timestamp: Date.now() };
        await this.cacheQuery(sql, params, mockResult, ttl);
      } catch (error) {
        this.logger.error('Failed to warm up query', { sql, error: error.message });
      }
    });

    await Promise.allSettled(promises);
    this.logger.info('Cache warm-up completed');
  }

  private generateQueryKey(sql: string, params: any[]): string {
    // Create a deterministic key based on SQL and parameters
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramString = JSON.stringify(params);
    
    // Use a simple hash for the key (in production, use a proper hash function)
    const hash = this.simpleHash(normalizedSql + paramString);
    
    return `query:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private updateQueryStats(key: string, type: 'hit' | 'miss' | 'cache'): void {
    if (!this.queryStats.has(key)) {
      this.queryStats.set(key, { hits: 0, misses: 0, cached: 0 });
    }

    const stats = this.queryStats.get(key);
    stats[type === 'cache' ? 'cached' : type === 'hit' ? 'hits' : 'misses']++;
  }

  async getQueryStats(): Promise<any> {
    const totalQueries = this.queryStats.size;
    let totalHits = 0;
    let totalMisses = 0;
    let totalCached = 0;

    for (const stats of this.queryStats.values()) {
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalCached += stats.cached;
    }

    return {
      totalQueries,
      totalHits,
      totalMisses,
      totalCached,
      hitRate: totalHits / (totalHits + totalMisses) || 0
    };
  }
}

export interface CacheConfig {
  redis: {
    primaryHosts: string[];
    fallbackHost: string;
    fallbackPort: number;
    password?: string;
    maxRetries: number;
    retryDelayOnFailover: number;
  };
  cdn: {
    distributionId: string;
    region: string;
    bucketName: string;
  };
  local: {
    maxSize: number;
    ttl: number;
  };
}

export interface CacheStrategy {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<CacheStats>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memory: number;
}

export interface CacheItem {
  value: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

export type CacheTier = 'L1' | 'L2' | 'L3' | 'CDN';

export interface InvalidationEvent {
  pattern: string;
  tier: CacheTier;
  timestamp: number;
  reason: string;
}

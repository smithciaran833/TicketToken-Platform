import { RateLimiterMemory } from 'rate-limiter-flexible';

interface RateLimitConfig {
  keyId: string;
  tier: 'starter' | 'professional' | 'enterprise';
  customLimits?: {
    requests: number;
    windowMs: number;
  };
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimitManager {
  private limiters: Map<string, RateLimiterMemory> = new Map();
  private tierLimits = {
    starter: { requests: 1000, windowMs: 3600000 }, // 1k/hour
    professional: { requests: 10000, windowMs: 3600000 }, // 10k/hour
    enterprise: { requests: 100000, windowMs: 3600000 } // 100k/hour
  };

  constructor() {
    console.log('⚡ RateLimitManager initialized');
  }

  private getLimiter(config: RateLimitConfig): RateLimiterMemory {
    const key = `${config.keyId}_${config.tier}`;
    
    if (!this.limiters.has(key)) {
      const limits = config.customLimits || this.tierLimits[config.tier];
      
      const limiter = new RateLimiterMemory({
        points: limits.requests,
        duration: Math.floor(limits.windowMs / 1000), // Convert to seconds
        blockDuration: 60, // Block for 1 minute if exceeded
      });

      this.limiters.set(key, limiter);
      console.log(`⚡ Created rate limiter for ${config.tier} tier: ${limits.requests} req/${limits.windowMs}ms`);
    }

    return this.limiters.get(key)!;
  }

  async checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    const limiter = this.getLimiter(config);
    
    try {
      const result = await limiter.consume(config.keyId);
      
      return {
        allowed: true,
        remaining: result.remainingHits || 0,
        resetTime: new Date(Date.now() + (result.msBeforeNext || 0))
      };

    } catch (rejRes: any) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + rejRes.msBeforeNext),
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000)
      };
    }
  }

  async getRemainingRequests(config: RateLimitConfig): Promise<number> {
    const limiter = this.getLimiter(config);
    const result = await limiter.get(config.keyId);
    
    const limits = config.customLimits || this.tierLimits[config.tier];
    return Math.max(0, limits.requests - (result?.totalHits || 0));
  }

  async resetRateLimit(keyId: string): Promise<void> {
    // Find and delete all limiters for this key
    for (const [key, limiter] of this.limiters.entries()) {
      if (key.startsWith(keyId)) {
        await limiter.delete(keyId);
        console.log(`🔄 Reset rate limit for key: ${keyId}`);
      }
    }
  }

  getUsageStats(config: RateLimitConfig): { limit: number; window: string } {
    const limits = config.customLimits || this.tierLimits[config.tier];
    return {
      limit: limits.requests,
      window: `${limits.windowMs / 1000 / 60} minutes`
    };
  }
}

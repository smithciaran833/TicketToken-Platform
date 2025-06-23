import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { config } from 'dotenv';
import { RedisMultiTierCache } from './strategies/redisCaching';
import { SmartCDNCache } from './strategies/cdnIntegration';
import { DatabaseQueryCache } from './strategies/databaseCache';
import { BlockchainRPCCache } from './strategies/blockchainCache';
import { SmartInvalidationManager } from './strategies/smartInvalidation';
import { Logger } from './utils/logger';
import { CacheConfig } from './types';

config();

const app = express();
const logger = new Logger('CacheService');
const PORT = process.env.PORT || 3030;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Cache configuration
const cacheConfig: CacheConfig = {
  redis: {
    primaryHosts: (process.env.REDIS_CLUSTER_HOSTS || 'localhost').split(','),
    fallbackHost: process.env.REDIS_FALLBACK_HOST || 'localhost',
    fallbackPort: parseInt(process.env.REDIS_FALLBACK_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetries: 3,
    retryDelayOnFailover: 100,
  },
  cdn: {
    distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.S3_BUCKET_NAME || '',
  },
  local: {
    maxSize: 10000,
    ttl: 3600,
  },
};

// Initialize cache layers
const redisCache = new RedisMultiTierCache(cacheConfig);
const cdnCache = new SmartCDNCache(cacheConfig);
const dbCache = new DatabaseQueryCache(redisCache);
const blockchainCache = new BlockchainRPCCache(
  redisCache, 
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
);
const invalidationManager = new SmartInvalidationManager(redisCache, cdnCache, dbCache);

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/stats', async (req, res) => {
  try {
    const [redisStats, dbStats, blockchainStats, invalidationStats] = await Promise.all([
      redisCache.stats(),
      dbCache.getQueryStats(),
      blockchainCache.getCacheStats(),
      invalidationManager.getInvalidationStats(),
    ]);

    res.json({
      redis: redisStats,
      database: dbStats,
      blockchain: blockchainStats,
      invalidation: invalidationStats,
      cdn: await cdnCache.getStats(),
    });
  } catch (error: any) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

app.post('/invalidate', async (req, res) => {
  try {
    const { pattern, reason, tiers } = req.body;
    
    if (!pattern || !reason) {
      return res.status(400).json({ error: 'Pattern and reason are required' });
    }

    await invalidationManager.invalidate(pattern, reason, tiers);
    
    res.json({ 
      success: true, 
      message: `Invalidated pattern: ${pattern}`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Invalidation request failed', { error: error.message });
    res.status(500).json({ error: 'Invalidation failed' });
  }
});

app.post('/warm-up', async (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      return res.status(400).json({ error: 'Queries array is required' });
    }

    await dbCache.warmUpCache(queries);
    
    res.json({ 
      success: true, 
      message: `Warmed up ${queries.length} queries`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Warm-up request failed', { error: error.message });
    res.status(500).json({ error: 'Cache warm-up failed' });
  }
});

app.get('/invalidation-history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = invalidationManager.getInvalidationHistory(limit);
    
    res.json({ history, count: history.length });
  } catch (error: any) {
    logger.error('Failed to get invalidation history', { error: error.message });
    res.status(500).json({ error: 'Failed to get invalidation history' });
  }
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Cache service started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

export {
  redisCache,
  cdnCache,
  dbCache,
  blockchainCache,
  invalidationManager
};

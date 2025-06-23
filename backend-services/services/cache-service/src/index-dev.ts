import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { Logger } from './utils/logger';

const app = express();
const logger = new Logger('CacheService-Dev');
const PORT = process.env.PORT || 3032;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Mock cache stats
let mockStats = {
  redis: { hits: 150, misses: 25, hitRate: 0.857, size: 1250, memory: 2048000 },
  database: { totalQueries: 50, totalHits: 45, totalMisses: 5, hitRate: 0.9 },
  blockchain: { rpcCalls: 100, cached: 85, hitRate: 0.85 },
  invalidation: { total: 25, lastHour: 3, reasonBreakdown: { 'Event updated': 2, 'User updated': 1 } }
};

// API Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'development',
    version: '1.0.0'
  });
});

app.get('/stats', async (req, res) => {
  try {
    // Simulate changing stats
    mockStats.redis.hits += Math.floor(Math.random() * 10);
    mockStats.redis.misses += Math.floor(Math.random() * 2);
    mockStats.redis.hitRate = mockStats.redis.hits / (mockStats.redis.hits + mockStats.redis.misses);
    
    res.json({
      ...mockStats,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
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

    // Simulate invalidation
    mockStats.invalidation.total++;
    mockStats.invalidation.lastHour++;
    
    res.json({ 
      success: true, 
      message: `Invalidated pattern: ${pattern}`,
      tiers: tiers || ['L1', 'L2', 'L3'],
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

    // Simulate warm-up
    setTimeout(() => {
      mockStats.database.totalQueries += queries.length;
      mockStats.database.totalHits += Math.floor(queries.length * 0.9);
    }, 1000);
    
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
    const mockHistory = [
      { pattern: 'event:12345', tier: 'L1', timestamp: Date.now() - 60000, reason: 'Event updated' },
      { pattern: 'user:67890:*', tier: 'L2', timestamp: Date.now() - 120000, reason: 'User profile changed' },
      { pattern: 'marketplace:*', tier: 'L3', timestamp: Date.now() - 180000, reason: 'Listing created' }
    ].slice(0, limit);
    
    res.json({ history: mockHistory, count: mockHistory.length });
  } catch (error: any) {
    logger.error('Failed to get invalidation history', { error: error.message });
    res.status(500).json({ error: 'Failed to get invalidation history' });
  }
});

// Performance test endpoint
app.get('/performance-test', (req, res) => {
  const operations = [
    'L1 Cache GET: 0.1ms',
    'L2 Cache GET: 1.5ms', 
    'L3 Cache GET: 8.2ms',
    'Database Query: 25ms (cached)',
    'Blockchain RPC: 45ms (cached)',
    'CDN Asset: 12ms'
  ];
  
  res.json({
    message: 'Performance test results',
    operations,
    avgResponseTime: '15ms',
    throughput: '2,500 req/sec',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Cache service (DEV MODE) started on port ${PORT}`);
  console.log(`🚀 Development Cache Service running on http://localhost:${PORT}`);
  console.log(`📊 Test endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /stats`);
  console.log(`   GET  /performance-test`);
  console.log(`   POST /invalidate`);
  console.log(`   POST /warm-up`);
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

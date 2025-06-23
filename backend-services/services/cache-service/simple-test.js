const express = require('express');
const app = express();
const PORT = 3031; // Different port to avoid conflicts

app.use(express.json());

// Mock cache stats
let mockStats = {
  redis: { hits: 150, misses: 25, hitRate: 0.857, size: 1250, memory: 2048000 },
  local: { size: 500, memory: 512000 },
  performance: { avgResponseTime: 45, throughput: 2500 }
};

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'cache-service',
    version: '1.0.0'
  });
});

app.get('/stats', (req, res) => {
  // Simulate live stats
  mockStats.redis.hits += Math.floor(Math.random() * 10);
  mockStats.redis.misses += Math.floor(Math.random() * 2);
  mockStats.redis.hitRate = mockStats.redis.hits / (mockStats.redis.hits + mockStats.redis.misses);
  
  res.json({
    ...mockStats,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/invalidate', (req, res) => {
  const { pattern, reason } = req.body;
  
  if (!pattern || !reason) {
    return res.status(400).json({ error: 'Pattern and reason are required' });
  }

  res.json({ 
    success: true, 
    message: `Invalidated pattern: ${pattern}`,
    reason: reason,
    timestamp: new Date().toISOString()
  });
});

app.get('/test-cache', (req, res) => {
  // Simulate cache operations
  const operations = [
    'SET ticket:12345 -> SUCCESS',
    'GET event:hot:67890 -> HIT (L1)',
    'GET user:session:abc123 -> HIT (L2)', 
    'SET marketplace:listing:999 -> SUCCESS',
    'GET blockchain:tx:xyz789 -> MISS -> DB -> CACHED'
  ];
  
  res.json({
    message: 'Cache operations simulation',
    operations: operations,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`✅ Cache Service Test Server running on http://localhost:${PORT}`);
  console.log(`🔧 Endpoints:`);
  console.log(`   GET  /health - Service health check`);
  console.log(`   GET  /stats - Cache statistics`);
  console.log(`   POST /invalidate - Invalidate cache patterns`);
  console.log(`   GET  /test-cache - Test cache operations`);
  console.log(``);
  console.log(`🧪 Try these commands:`);
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log(`   curl http://localhost:${PORT}/stats`);
  console.log(`   curl http://localhost:${PORT}/test-cache`);
  console.log(`   curl -X POST http://localhost:${PORT}/invalidate -H "Content-Type: application/json" -d '{"pattern":"event:*","reason":"Event updated"}'`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});

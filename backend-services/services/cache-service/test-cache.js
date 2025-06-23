const express = require('express');

// Simple test server to verify everything works
const app = express();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'cache-service-test'
  });
});

app.get('/stats', (req, res) => {
  res.json({
    message: 'Cache service test endpoint',
    redis: { hits: 100, misses: 10, hitRate: 0.9 },
    database: { queries: 50, cached: 45 },
    blockchain: { rpcCalls: 20, cached: 18 }
  });
});

const PORT = 3030;
app.listen(PORT, () => {
  console.log(`✅ Test server running on http://localhost:${PORT}`);
  console.log(`🔧 Try: curl http://localhost:${PORT}/health`);
});

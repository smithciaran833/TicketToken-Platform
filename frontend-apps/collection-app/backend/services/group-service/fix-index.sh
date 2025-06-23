#!/bin/bash

echo "🔧 Fixing the corrupted index.ts file..."

# Restore the correct, simple index.ts file
cat > src/index.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import { groupRoutes } from './routes/groupRoutes';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/groups', groupRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'group-service', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl,
    message: 'The requested resource was not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Group Service running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 API Base URL: http://localhost:${PORT}/api/groups`);
});

export default app;

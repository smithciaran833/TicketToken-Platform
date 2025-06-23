import express from 'express';
import cors from 'cors';
import { groupRoutes } from './routes/groupRoutes';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use('/api/groups', groupRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'group-service', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Group Service running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 API Base URL: http://localhost:${PORT}/api/groups`);
});

export default app;

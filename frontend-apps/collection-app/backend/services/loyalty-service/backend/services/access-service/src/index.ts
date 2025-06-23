import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import winston from 'winston';

// Import access control services
import { ContentGating } from './gating/contentGating';
import { MerchandiseGating } from './gating/merchandiseGating';
import { ExperienceGating } from './gating/experienceGating';
import { PresaleGating } from './gating/presaleGating';
import { TierVerification } from './gating/tierVerification';

// Import middleware
import { AccessMiddleware } from './middleware/accessMiddleware';
import { VipMiddleware } from './middleware/vipMiddleware';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Database connections
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/access-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/access-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Initialize services
const contentGating = new ContentGating(db, redis);
const merchandiseGating = new MerchandiseGating(db, redis);
const experienceGating = new ExperienceGating(db, redis);
const presaleGating = new PresaleGating(db, redis);
const tierVerification = new TierVerification(db, redis);

// Initialize middleware
const accessMiddleware = new AccessMiddleware(db, redis);
const vipMiddleware = new VipMiddleware(db, redis);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'access-control',
    timestamp: new Date().toISOString() 
  });
});

// Content Gating Routes
app.post('/api/access/content/gate', async (req, res) => {
  try {
    const { contentId, userId, requiredAccess } = req.body;
    const result = await contentGating.checkContentAccess(userId, contentId, requiredAccess);
    res.json(result);
  } catch (error) {
    logger.error('Content gating error:', error);
    res.status(500).json({ error: 'Content access check failed' });
  }
});

app.post('/api/access/content/unlock', async (req, res) => {
  try {
    const { contentId, userId, unlockMethod } = req.body;
    const result = await contentGating.unlockContent(userId, contentId, unlockMethod);
    res.json(result);
  } catch (error) {
    logger.error('Content unlock error:', error);
    res.status(500).json({ error: 'Content unlock failed' });
  }
});

// Merchandise Gating Routes
app.post('/api/access/merchandise/check', async (req, res) => {
  try {
    const { productId, userId } = req.body;
    const result = await merchandiseGating.checkMerchandiseAccess(userId, productId);
    res.json(result);
  } catch (error) {
    logger.error('Merchandise access error:', error);
    res.status(500).json({ error: 'Merchandise access check failed' });
  }
});

app.get('/api/access/merchandise/catalog/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const catalog = await merchandiseGating.getAccessibleMerchandise(userId);
    res.json(catalog);
  } catch (error) {
    logger.error('Merchandise catalog error:', error);
    res.status(500).json({ error: 'Failed to get merchandise catalog' });
  }
});

// Experience Gating Routes
app.post('/api/access/experience/check', async (req, res) => {
  try {
    const { experienceId, userId } = req.body;
    const result = await experienceGating.checkExperienceAccess(userId, experienceId);
    res.json(result);
  } catch (error) {
    logger.error('Experience access error:', error);
    res.status(500).json({ error: 'Experience access check failed' });
  }
});

app.post('/api/access/experience/book', async (req, res) => {
  try {
    const { experienceId, userId, timeSlot } = req.body;
    const result = await experienceGating.bookExperience(userId, experienceId, timeSlot);
    res.json(result);
  } catch (error) {
    logger.error('Experience booking error:', error);
    res.status(500).json({ error: 'Experience booking failed' });
  }
});

// Presale Gating Routes
app.post('/api/access/presale/check', async (req, res) => {
  try {
    const { eventId, userId } = req.body;
    const result = await presaleGating.checkPresaleAccess(userId, eventId);
    res.json(result);
  } catch (error) {
    logger.error('Presale access error:', error);
    res.status(500).json({ error: 'Presale access check failed' });
  }
});

app.post('/api/access/presale/enter', async (req, res) => {
  try {
    const { eventId, userId, accessCode } = req.body;
    const result = await presaleGating.enterPresale(userId, eventId, accessCode);
    res.json(result);
  } catch (error) {
    logger.error('Presale entry error:', error);
    res.status(500).json({ error: 'Presale entry failed' });
  }
});

// Tier Verification Routes
app.get('/api/access/tier/verify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tierInfo = await tierVerification.verifyUserTier(userId);
    res.json(tierInfo);
  } catch (error) {
    logger.error('Tier verification error:', error);
    res.status(500).json({ error: 'Tier verification failed' });
  }
});

app.get('/api/access/tier/benefits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const benefits = await tierVerification.getTierBenefits(userId);
    res.json(benefits);
  } catch (error) {
    logger.error('Tier benefits error:', error);
    res.status(500).json({ error: 'Failed to get tier benefits' });
  }
});

// WebSocket for real-time access updates
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('join-access-room', (userId) => {
    socket.join(`access-${userId}`);
    logger.info(`User ${userId} joined access room`);
  });

  socket.on('check-access', async (data) => {
    try {
      const { userId, resourceId, accessType } = data;
      // Implement real-time access checking
      const hasAccess = await accessMiddleware.checkAccess(userId, resourceId, accessType);
      socket.emit('access-result', { resourceId, hasAccess });
    } catch (error) {
      socket.emit('access-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Access service error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  logger.info(`🎫 Access Control Service running on port ${PORT}`);
  logger.info('🔐 Services initialized:');
  logger.info('   ✅ Content Gating');
  logger.info('   ✅ Merchandise Gating');
  logger.info('   ✅ Experience Gating');
  logger.info('   ✅ Presale Gating');
  logger.info('   ✅ Tier Verification');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

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
import * as cron from 'node-cron';

// Import loyalty services
import { PointsEngine } from './services/pointsEngine';
import { TierManager } from './services/tierManager';
import { RewardsInventory } from './services/rewardsInventory';
import { RedemptionService } from './services/redemptionService';
import { ReferralTracking } from './services/referralTracking';
import { StreakTracking } from './services/streakTracking';
import { BirthdayRewards } from './services/birthdayRewards';

dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class LoyaltyService {
  private app: express.Application;
  private server: any;
  private io: Server;
  private redis: Redis;
  private db: Pool;
  
  // Loyalty service modules
  private pointsEngine: PointsEngine;
  private tierManager: TierManager;
  private rewardsInventory: RewardsInventory;
  private redemptionService: RedemptionService;
  private referralTracking: ReferralTracking;
  private streakTracking: StreakTracking;
  private birthdayRewards: BirthdayRewards;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.initializeDatabase();
    this.initializeRedis();
    this.initializeMiddleware();
    this.initializeLoyaltyServices();
    this.initializeRoutes();
    this.initializeCronJobs();
  }

  private initializeDatabase(): void {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tickettoken',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.db.on('error', (err) => {
      logger.error('Database error:', err);
    });

    logger.info('Database connection pool initialized');
  }

  private initializeRedis(): void {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  private initializeMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true
    }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeLoyaltyServices(): void {
    this.pointsEngine = new PointsEngine(this.db, this.redis);
    this.tierManager = new TierManager(this.db, this.redis);
    this.rewardsInventory = new RewardsInventory(this.db, this.redis);
    this.redemptionService = new RedemptionService(this.db, this.redis);
    this.referralTracking = new ReferralTracking(this.db, this.redis);
    this.streakTracking = new StreakTracking(this.db, this.redis);
    this.birthdayRewards = new BirthdayRewards(this.db, this.redis);

    // Set up event listeners
    this.setupEventListeners();
    
    logger.info('All loyalty services initialized');
  }

  private setupEventListeners(): void {
    this.pointsEngine.on('pointsEarned', (event) => {
      this.io.emit('points-earned', event);
      logger.info(`Points earned: ${event.userId} - ${event.amount} points`);
    });

    this.tierManager.on('tierUpgrade', (event) => {
      this.io.emit('tier-upgrade', event);
      logger.info(`Tier upgrade: ${event.userId} - ${event.newTier}`);
    });

    this.streakTracking.on('streakAchievement', (event) => {
      this.io.emit('streak-achievement', event);
      logger.info(`Streak achievement: ${event.userId} - ${event.streakDays} days`);
    });

    this.referralTracking.on('referralSuccess', (event) => {
      this.io.emit('referral-success', event);
      logger.info(`Referral success: ${event.referrerId} referred ${event.refereeId}`);
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'loyalty-service',
        version: '1.0.0'
      });
    });

    // Points management
    this.app.post('/api/points/earn', async (req, res) => {
      try {
        const { userId, amount, reason, metadata } = req.body;
        const result = await this.pointsEngine.awardPoints(userId, amount, reason, metadata);
        res.json(result);
      } catch (error) {
        logger.error('Error awarding points:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/points/balance/:userId', async (req, res) => {
      try {
        const balance = await this.pointsEngine.getPointsBalance(req.params.userId);
        res.json({ balance });
      } catch (error) {
        logger.error('Error getting points balance:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/points/transfer', async (req, res) => {
      try {
        const { fromUserId, toUserId, amount, message } = req.body;
        const result = await this.pointsEngine.transferPoints(fromUserId, toUserId, amount, message);
        res.json(result);
      } catch (error) {
        logger.error('Error transferring points:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Tier management
    this.app.get('/api/tiers/:userId', async (req, res) => {
      try {
        const tierInfo = await this.tierManager.getUserTierInfo(req.params.userId);
        res.json(tierInfo);
      } catch (error) {
        logger.error('Error getting tier info:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/tiers/upgrade/:userId', async (req, res) => {
      try {
        const result = await this.tierManager.checkAndUpgradeTier(req.params.userId);
        res.json(result);
      } catch (error) {
        logger.error('Error upgrading tier:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Rewards management
    this.app.get('/api/rewards', async (req, res) => {
      try {
        const { userId, category, tierRequired } = req.query;
        const rewards = await this.rewardsInventory.getAvailableRewards(
          userId as string, 
          category as string, 
          tierRequired ? parseInt(tierRequired as string) : undefined
        );
        res.json(rewards);
      } catch (error) {
        logger.error('Error getting rewards:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/rewards/claim', async (req, res) => {
      try {
        const { userId, rewardId } = req.body;
        const result = await this.redemptionService.claimReward(userId, rewardId);
        res.json(result);
      } catch (error) {
        logger.error('Error claiming reward:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/rewards/claimed/:userId', async (req, res) => {
      try {
        const claimed = await this.redemptionService.getClaimedRewards(req.params.userId);
        res.json(claimed);
      } catch (error) {
        logger.error('Error getting claimed rewards:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Referral system
    this.app.post('/api/referrals/create-code', async (req, res) => {
      try {
        const { userId, code, commissionRate } = req.body;
        const result = await this.referralTracking.createReferralCode(userId, code, commissionRate);
        res.json(result);
      } catch (error) {
        logger.error('Error creating referral code:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/referrals/track', async (req, res) => {
      try {
        const { referralCode, refereeId, transactionAmount } = req.body;
        const result = await this.referralTracking.trackReferral(referralCode, refereeId, transactionAmount);
        res.json(result);
      } catch (error) {
        logger.error('Error tracking referral:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/referrals/stats/:userId', async (req, res) => {
      try {
        const stats = await this.referralTracking.getReferralStats(req.params.userId);
        res.json(stats);
      } catch (error) {
        logger.error('Error getting referral stats:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Streak tracking
    this.app.post('/api/streaks/checkin/:userId', async (req, res) => {
      try {
        const { eventId } = req.body;
        const result = await this.streakTracking.recordAttendance(req.params.userId, eventId);
        res.json(result);
      } catch (error) {
        logger.error('Error recording attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/streaks/:userId', async (req, res) => {
      try {
        const streak = await this.streakTracking.getCurrentStreak(req.params.userId);
        res.json(streak);
      } catch (error) {
        logger.error('Error getting streak:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Birthday and special rewards
    this.app.get('/api/birthday-rewards/:userId', async (req, res) => {
      try {
        const rewards = await this.birthdayRewards.checkBirthdayRewards(req.params.userId);
        res.json(rewards);
      } catch (error) {
        logger.error('Error checking birthday rewards:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  private initializeCronJobs(): void {
    // Daily birthday check
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running daily birthday rewards check');
      await this.birthdayRewards.processDailyBirthdayRewards();
    });

    // Weekly streak analysis
    cron.schedule('0 0 * * 0', async () => {
      logger.info('Running weekly streak analysis');
      await this.streakTracking.processWeeklyStreakRewards();
    });

    // Monthly tier review
    cron.schedule('0 0 1 * *', async () => {
      logger.info('Running monthly tier review');
      await this.tierManager.processMonthlyTierReview();
    });

    logger.info('Cron jobs scheduled');
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 3010;
    
    // Test database connection
    try {
      await this.db.query('SELECT NOW()');
      logger.info('Database connection successful');
    } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
    }

    // Test Redis connection
    try {
      await this.redis.ping();
      logger.info('Redis connection successful');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      process.exit(1);
    }

    this.server.listen(port, () => {
      logger.info(`🎯 Loyalty Service running on port ${port}`);
      logger.info(`💎 Points & Tiers: http://localhost:${port}/api/points`);
      logger.info(`🎁 Rewards: http://localhost:${port}/api/rewards`);
      logger.info(`🔗 Referrals: http://localhost:${port}/api/referrals`);
      logger.info(`🔥 Streaks: http://localhost:${port}/api/streaks`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.server.close(() => {
        this.db.end();
        this.redis.disconnect();
        process.exit(0);
      });
    });
  }
}

// Start the service
const loyaltyService = new LoyaltyService();
loyaltyService.start().catch((error) => {
  logger.error('Failed to start loyalty service:', error);
  process.exit(1);
});

export default LoyaltyService;

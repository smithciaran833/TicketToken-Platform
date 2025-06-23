import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import winston from 'winston';

// Import all analytics modules
import { SalesTracker } from './realtime/salesTracking';
import { AttendanceMonitor } from './realtime/attendanceMonitor';
import { RevenueStream } from './realtime/revenueStream';
import { SocialMetrics } from './realtime/socialMetrics';

import { DemographicsEngine } from './reporting/demographicsEngine';
import { GeographicHeatmap } from './reporting/geographicHeatmap';
import { PurchasePatterns } from './reporting/purchasePatterns';
import { PriceOptimization } from './reporting/priceOptimization';
import { CompetitorAnalysis } from './reporting/competitorAnalysis';

import { DemandForecasting } from './predictive/demandForecasting';
import { RevenueProjection } from './predictive/revenueProjection';
import { TrendAnalysis } from './predictive/trendAnalysis';

// Load environment variables
dotenv.config();

// Configure logger
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

class AnalyticsService {
  private app: express.Application;
  private server: any;
  private io: Server;
  private redis: Redis;
  private db: Pool;
  
  // Analytics modules
  private salesTracker: SalesTracker;
  private attendanceMonitor: AttendanceMonitor;
  private revenueStream: RevenueStream;
  private socialMetrics: SocialMetrics;
  
  private demographicsEngine: DemographicsEngine;
  private geographicHeatmap: GeographicHeatmap;
  private purchasePatterns: PurchasePatterns;
  private priceOptimization: PriceOptimization;
  private competitorAnalysis: CompetitorAnalysis;
  
  private demandForecasting: DemandForecasting;
  private revenueProjection: RevenueProjection;
  private trendAnalysis: TrendAnalysis;

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
    this.initializeAnalyticsModules();
    this.initializeRoutes();
    this.initializeSocketHandlers();
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
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    }));
  }

  private initializeAnalyticsModules(): void {
    // Real-time analytics
    this.salesTracker = new SalesTracker(this.redis, this.db);
    this.attendanceMonitor = new AttendanceMonitor(this.redis, this.db);
    this.revenueStream = new RevenueStream(this.redis, this.db);
    this.socialMetrics = new SocialMetrics(this.redis, this.db);

    // Reporting analytics
    this.demographicsEngine = new DemographicsEngine(this.db, this.redis);
    this.geographicHeatmap = new GeographicHeatmap(this.db, this.redis);
    this.purchasePatterns = new PurchasePatterns(this.db, this.redis);
    this.priceOptimization = new PriceOptimization(this.db, this.redis);
    this.competitorAnalysis = new CompetitorAnalysis(this.db, this.redis);

    // Predictive analytics
    this.demandForecasting = new DemandForecasting(this.db, this.redis);
    this.revenueProjection = new RevenueProjection(this.db, this.redis);
    this.trendAnalysis = new TrendAnalysis(this.db, this.redis);

    // Set up event listeners for real-time updates
    this.setupEventListeners();
    
    logger.info('All analytics modules initialized');
  }

  private setupEventListeners(): void {
    // Sales tracking events
    this.salesTracker.on('saleCompleted', (sale) => {
      this.io.emit('sale-update', sale);
      logger.info(`Sale completed: ${sale.ticketId}`);
    });

    this.salesTracker.on('milestone', (milestone) => {
      this.io.emit('sales-milestone', milestone);
      logger.info(`Sales milestone reached: ${milestone.milestone}`);
    });

    // Attendance monitoring events
    this.attendanceMonitor.on('attendanceUpdate', (attendance) => {
      this.io.emit('attendance-update', attendance);
    });

    this.attendanceMonitor.on('capacityAlert', (alert) => {
      this.io.emit('capacity-alert', alert);
      logger.warn(`Capacity alert: ${alert.level} - ${alert.utilizationRate}%`);
    });

    // Revenue stream events
    this.revenueStream.on('revenueUpdate', (revenue) => {
      this.io.emit('revenue-update', revenue);
    });

    this.revenueStream.on('revenueMilestone', (milestone) => {
      this.io.emit('revenue-milestone', milestone);
      logger.info(`Revenue milestone: ${milestone.milestone}`);
    });

    // Social metrics events
    this.socialMetrics.on('socialUpdate', (social) => {
      this.io.emit('social-update', social);
    });

    this.socialMetrics.on('viralTrend', (trend) => {
      this.io.emit('viral-trend', trend);
      logger.info(`Viral trend detected: ${trend.type}`);
    });
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'analytics-service',
        version: '1.0.0'
      });
    });

    // Real-time analytics routes
    this.app.get('/api/realtime/sales/:eventId', async (req, res) => {
      try {
        const metrics = await this.salesTracker.getLiveSalesMetrics(req.params.eventId);
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting sales metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/realtime/attendance/:eventId', async (req, res) => {
      try {
        const metrics = await this.attendanceMonitor.getAttendanceMetrics(req.params.eventId);
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting attendance metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/realtime/revenue/:eventId', async (req, res) => {
      try {
        const metrics = await this.revenueStream.getLiveRevenueMetrics(req.params.eventId);
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting revenue metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/realtime/social/:eventId', async (req, res) => {
      try {
        const metrics = await this.socialMetrics.getLiveSocialMetrics(req.params.eventId);
        res.json(metrics);
      } catch (error) {
        logger.error('Error getting social metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Reporting analytics routes
    this.app.get('/api/reporting/demographics/:eventId', async (req, res) => {
      try {
        const demographics = await this.demographicsEngine.getEventDemographics(req.params.eventId);
        res.json(demographics);
      } catch (error) {
        logger.error('Error getting demographics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/reporting/geographic/:eventId', async (req, res) => {
      try {
        const geographic = await this.geographicHeatmap.getEventGeographicData(req.params.eventId);
        res.json(geographic);
      } catch (error) {
        logger.error('Error getting geographic data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/reporting/purchase-patterns/:eventId', async (req, res) => {
      try {
        const patterns = await this.purchasePatterns.getEventPurchasePatterns(req.params.eventId);
        res.json(patterns);
      } catch (error) {
        logger.error('Error getting purchase patterns:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/reporting/price-optimization/:eventId', async (req, res) => {
      try {
        const optimization = await this.priceOptimization.getEventPriceOptimization(req.params.eventId);
        res.json(optimization);
      } catch (error) {
        logger.error('Error getting price optimization:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/reporting/competitor-analysis', async (req, res) => {
      try {
        const analysis = await this.competitorAnalysis.getCompetitiveAnalysis();
        res.json(analysis);
      } catch (error) {
        logger.error('Error getting competitor analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Predictive analytics routes
    this.app.get('/api/predictive/demand-forecast/:eventId', async (req, res) => {
      try {
        const forecast = await this.demandForecasting.forecastEventDemand(req.params.eventId);
        res.json(forecast);
      } catch (error) {
        logger.error('Error getting demand forecast:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/predictive/revenue-projection/:eventId', async (req, res) => {
      try {
        const projection = await this.revenueProjection.projectEventRevenue(req.params.eventId);
        res.json(projection);
      } catch (error) {
        logger.error('Error getting revenue projection:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/predictive/trend-analysis', async (req, res) => {
      try {
        const trends = await this.trendAnalysis.analyzeIndustryTrends();
        res.json(trends);
      } catch (error) {
        logger.error('Error getting trend analysis:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Artist-specific analytics
    this.app.get('/api/artist/:artistId/demographics', async (req, res) => {
      try {
        const demographics = await this.demographicsEngine.getArtistFanDemographics(req.params.artistId);
        res.json(demographics);
      } catch (error) {
        logger.error('Error getting artist demographics:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/artist/:artistId/revenue-projection', async (req, res) => {
      try {
        const { timeframe = '1year' } = req.query;
        const projection = await this.revenueProjection.projectArtistRevenue(
          req.params.artistId, 
          timeframe as '6months' | '1year' | '2years'
        );
        res.json(projection);
      } catch (error) {
        logger.error('Error getting artist revenue projection:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Data ingestion endpoints
    this.app.post('/api/ingest/sale', async (req, res) => {
      try {
        await this.salesTracker.trackSale(req.body);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error ingesting sale data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/ingest/attendance', async (req, res) => {
      try {
        await this.attendanceMonitor.recordAttendance(req.body);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error ingesting attendance data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/ingest/revenue', async (req, res) => {
      try {
        await this.revenueStream.trackRevenue(req.body);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error ingesting revenue data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.post('/api/ingest/social', async (req, res) => {
      try {
        await this.socialMetrics.trackSocialEvent(req.body);
        res.json({ success: true });
      } catch (error) {
        logger.error('Error ingesting social data:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  private initializeSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Subscribe to event-specific updates
      socket.on('subscribe-event', (eventId: string) => {
        socket.join(`event-${eventId}`);
        logger.info(`Client ${socket.id} subscribed to event ${eventId}`);
      });

      // Unsubscribe from event updates
      socket.on('unsubscribe-event', (eventId: string) => {
        socket.leave(`event-${eventId}`);
        logger.info(`Client ${socket.id} unsubscribed from event ${eventId}`);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 3009;
    
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
      logger.info(`🚀 Analytics Service running on port ${port}`);
      logger.info(`📊 Real-time analytics: ws://localhost:${port}`);
      logger.info(`📈 API documentation: http://localhost:${port}/health`);
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
const analyticsService = new AnalyticsService();
analyticsService.start().catch((error) => {
  logger.error('Failed to start analytics service:', error);
  process.exit(1);
});

export default AnalyticsService;

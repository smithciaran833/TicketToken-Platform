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
import multer from 'multer';

// Import content services
import { ContentUpload } from './management/contentUpload';
import { EncryptionService } from './security/encryptionService';
import { AccessRules } from './management/accessRules';
import { ReleaseScheduler } from './management/releaseScheduler';
import { ContentDelivery } from './management/contentDelivery';

// Import content types
import { BackstageFootage } from './types/backstageFootage';
import { SoundcheckAudio } from './types/soundcheckAudio';
import { VirtualMeetGreet } from './types/virtualMeetGreet';
import { DigitalMerchandise } from './types/digitalMerchandise';
import { ExclusiveMessages } from './types/exclusiveMessages';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"]
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
    new winston.transports.File({ filename: 'logs/content-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/content-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and documents
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|pdf|txt/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Initialize services
const contentUpload = new ContentUpload(db, redis);
const encryptionService = new EncryptionService();
const accessRules = new AccessRules(db, redis);
const releaseScheduler = new ReleaseScheduler(db, redis);
const contentDelivery = new ContentDelivery(db, redis);

// Initialize content types
const backstageFootage = new BackstageFootage(db, redis);
const soundcheckAudio = new SoundcheckAudio(db, redis);
const virtualMeetGreet = new VirtualMeetGreet(db, redis);
const digitalMerchandise = new DigitalMerchandise(db, redis);
const exclusiveMessages = new ExclusiveMessages(db, redis);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'content-service',
    timestamp: new Date().toISOString() 
  });
});

// Content Upload Routes
app.post('/api/content/upload', upload.single('file'), async (req, res) => {
  try {
    const { artistId, contentType, accessLevel, releaseDate } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await contentUpload.uploadContent(
      file,
      artistId,
      contentType,
      accessLevel,
      releaseDate ? new Date(releaseDate) : undefined
    );

    res.json(result);
  } catch (error) {
    logger.error('Content upload error:', error);
    res.status(500).json({ error: 'Content upload failed' });
  }
});

app.post('/api/content/upload-batch', upload.array('files', 10), async (req, res) => {
  try {
    const { artistId, contentType, accessLevel } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = await contentUpload.batchUpload(files, artistId, contentType, accessLevel);
    res.json(results);
  } catch (error) {
    logger.error('Batch upload error:', error);
    res.status(500).json({ error: 'Batch upload failed' });
  }
});

// Content Access Routes
app.get('/api/content/:contentId/access/:userId', async (req, res) => {
  try {
    const { contentId, userId } = req.params;
    const hasAccess = await accessRules.checkAccess(userId, contentId);
    
    if (hasAccess) {
      const content = await contentDelivery.getContent(contentId, userId);
      res.json(content);
    } else {
      res.status(403).json({ error: 'Access denied' });
    }
  } catch (error) {
    logger.error('Content access error:', error);
    res.status(500).json({ error: 'Failed to access content' });
  }
});

app.get('/api/content/catalog/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier, type, limit = 50 } = req.query;
    
    const catalog = await contentDelivery.getUserCatalog(
      userId, 
      tier as string, 
      type as string, 
      parseInt(limit as string)
    );
    
    res.json(catalog);
  } catch (error) {
    logger.error('Content catalog error:', error);
    res.status(500).json({ error: 'Failed to get content catalog' });
  }
});

// Backstage Content Routes
app.post('/api/content/backstage', upload.single('video'), async (req, res) => {
  try {
    const { eventId, title, description, accessLevel } = req.body;
    const file = req.file;

    const footage = await backstageFootage.createFootage(
      eventId,
      title,
      description,
      file?.path,
      accessLevel
    );

    res.json(footage);
  } catch (error) {
    logger.error('Backstage footage error:', error);
    res.status(500).json({ error: 'Failed to create backstage footage' });
  }
});

app.get('/api/content/backstage/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query;

    const footage = await backstageFootage.getEventFootage(eventId, userId as string);
    res.json(footage);
  } catch (error) {
    logger.error('Get backstage footage error:', error);
    res.status(500).json({ error: 'Failed to get backstage footage' });
  }
});

// Soundcheck Audio Routes
app.post('/api/content/soundcheck', upload.single('audio'), async (req, res) => {
  try {
    const { eventId, trackName, duration } = req.body;
    const file = req.file;

    const audio = await soundcheckAudio.createSoundcheck(
      eventId,
      trackName,
      file?.path,
      parseInt(duration)
    );

    res.json(audio);
  } catch (error) {
    logger.error('Soundcheck audio error:', error);
    res.status(500).json({ error: 'Failed to create soundcheck audio' });
  }
});

// Virtual Meet & Greet Routes
app.post('/api/content/meet-greet/create', async (req, res) => {
  try {
    const { eventId, artistId, maxParticipants, duration, accessRequirement } = req.body;

    const meetGreet = await virtualMeetGreet.createSession(
      eventId,
      artistId,
      maxParticipants,
      duration,
      accessRequirement
    );

    res.json(meetGreet);
  } catch (error) {
    logger.error('Meet & greet creation error:', error);
    res.status(500).json({ error: 'Failed to create meet & greet session' });
  }
});

app.post('/api/content/meet-greet/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;

    const result = await virtualMeetGreet.joinSession(sessionId, userId);
    res.json(result);
  } catch (error) {
    logger.error('Meet & greet join error:', error);
    res.status(500).json({ error: 'Failed to join meet & greet' });
  }
});

// Digital Merchandise Routes
app.post('/api/content/merchandise/create', upload.single('design'), async (req, res) => {
  try {
    const { name, description, exclusivityLevel, accessRequirement } = req.body;
    const file = req.file;

    const merchandise = await digitalMerchandise.createItem(
      name,
      description,
      file?.path,
      exclusivityLevel,
      accessRequirement
    );

    res.json(merchandise);
  } catch (error) {
    logger.error('Digital merchandise error:', error);
    res.status(500).json({ error: 'Failed to create digital merchandise' });
  }
});

// Exclusive Messages Routes
app.post('/api/content/messages/create', async (req, res) => {
  try {
    const { artistId, message, accessLevel, scheduledFor } = req.body;

    const exclusiveMessage = await exclusiveMessages.createMessage(
      artistId,
      message,
      accessLevel,
      scheduledFor ? new Date(scheduledFor) : undefined
    );

    res.json(exclusiveMessage);
  } catch (error) {
    logger.error('Exclusive message error:', error);
    res.status(500).json({ error: 'Failed to create exclusive message' });
  }
});

app.get('/api/content/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await exclusiveMessages.getUserMessages(userId);
    res.json(messages);
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Content Scheduling Routes
app.post('/api/content/schedule', async (req, res) => {
  try {
    const { contentId, releaseDate, accessLevel, targetAudience } = req.body;

    const scheduled = await releaseScheduler.scheduleRelease(
      contentId,
      new Date(releaseDate),
      accessLevel,
      targetAudience
    );

    res.json(scheduled);
  } catch (error) {
    logger.error('Content scheduling error:', error);
    res.status(500).json({ error: 'Failed to schedule content' });
  }
});

// WebSocket for real-time content updates
io.on('connection', (socket) => {
  logger.info(`Content client connected: ${socket.id}`);

  socket.on('join-content-room', (userId) => {
    socket.join(`content-${userId}`);
    logger.info(`User ${userId} joined content room`);
  });

  socket.on('subscribe-artist', (artistId) => {
    socket.join(`artist-${artistId}`);
    logger.info(`Subscribed to artist ${artistId} content updates`);
  });

  socket.on('disconnect', () => {
    logger.info(`Content client disconnected: ${socket.id}`);
  });
});

// Content release notifications
releaseScheduler.on('contentReleased', (contentData) => {
  io.to(`artist-${contentData.artistId}`).emit('new-content', contentData);
  logger.info(`New content released: ${contentData.id}`);
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Content service error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3004;

server.listen(PORT, () => {
  logger.info(`🎮 Content & Perks Service running on port ${PORT}`);
  logger.info('🎬 Services initialized:');
  logger.info('   ✅ Content Upload & Management');
  logger.info('   ✅ Backstage Footage');
  logger.info('   ✅ Soundcheck Audio');
  logger.info('   ✅ Virtual Meet & Greet');
  logger.info('   ✅ Digital Merchandise');
  logger.info('   ✅ Exclusive Messages');
  logger.info('   ✅ Release Scheduling');
  logger.info('   ✅ Content Delivery Network');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Content service terminated');
  });
});

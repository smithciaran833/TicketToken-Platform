import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import winston from 'winston';
import * as cron from 'node-cron';

// Import insurance modules
import { WeatherInsurance } from './coverage/weatherInsurance';
import { EventCancellation } from './coverage/eventCancellation';
import { FraudProtection } from './coverage/fraudProtection';
import { ClaimProcessing } from './claims/claimProcessing';

dotenv.config();

const app = express();

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
    new winston.transports.File({ filename: 'logs/insurance-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/insurance-combined.log' }),
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
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many insurance requests from this IP'
});
app.use(limiter);

// Initialize insurance services
const weatherInsurance = new WeatherInsurance(db, redis);
const eventCancellation = new EventCancellation(db, redis);
const fraudProtection = new FraudProtection(db, redis);
const claimProcessing = new ClaimProcessing(db, redis);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'insurance-service',
    timestamp: new Date().toISOString(),
    coverageTypes: ['weather', 'cancellation', 'fraud']
  });
});

// Weather insurance routes
app.post('/api/insurance/weather/quote', async (req, res) => {
  try {
    const { eventId, location, eventDate, ticketValue } = req.body;
    const quote = await weatherInsurance.getQuote(eventId, location, eventDate, ticketValue);
    res.json(quote);
  } catch (error) {
    logger.error('Weather insurance quote error:', error);
    res.status(500).json({ error: 'Failed to get weather insurance quote' });
  }
});

app.post('/api/insurance/weather/purchase', async (req, res) => {
  try {
    const { userId, eventId, coverage } = req.body;
    const policy = await weatherInsurance.purchaseCoverage(userId, eventId, coverage);
    res.json(policy);
  } catch (error) {
    logger.error('Weather insurance purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase weather insurance' });
  }
});

// Event cancellation insurance routes
app.post('/api/insurance/cancellation/quote', async (req, res) => {
  try {
    const { eventId, artistId, ticketValue, riskFactors } = req.body;
    const quote = await eventCancellation.getQuote(eventId, artistId, ticketValue, riskFactors);
    res.json(quote);
  } catch (error) {
    logger.error('Cancellation insurance quote error:', error);
    res.status(500).json({ error: 'Failed to get cancellation insurance quote' });
  }
});

app.post('/api/insurance/cancellation/purchase', async (req, res) => {
  try {
    const { userId, eventId, coverage } = req.body;
    const policy = await eventCancellation.purchaseCoverage(userId, eventId, coverage);
    res.json(policy);
  } catch (error) {
    logger.error('Cancellation insurance purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase cancellation insurance' });
  }
});

// Fraud protection routes
app.post('/api/insurance/fraud/assess', async (req, res) => {
  try {
    const { transactionId, userId, ticketId } = req.body;
    const assessment = await fraudProtection.assessRisk(transactionId, userId, ticketId);
    res.json(assessment);
  } catch (error) {
    logger.error('Fraud assessment error:', error);
    res.status(500).json({ error: 'Fraud assessment failed' });
  }
});

app.post('/api/insurance/fraud/report', async (req, res) => {
  try {
    const { userId, ticketId, fraudType, description } = req.body;
    const report = await fraudProtection.reportFraud(userId, ticketId, fraudType, description);
    res.json(report);
  } catch (error) {
    logger.error('Fraud report error:', error);
    res.status(500).json({ error: 'Failed to report fraud' });
  }
});

// Claims processing routes
app.post('/api/insurance/claims/submit', async (req, res) => {
  try {
    const { 
      userId, 
      policyId, 
      claimType, 
      description, 
      evidence,
      claimAmount 
    } = req.body;
    
    const claim = await claimProcessing.submitClaim(
      userId,
      policyId,
      claimType,
      description,
      evidence,
      claimAmount
    );
    
    res.json(claim);
  } catch (error) {
    logger.error('Claim submission error:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

app.get('/api/insurance/claims/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 20 } = req.query;
    
    const claims = await claimProcessing.getUserClaims(
      userId,
      status as string,
      parseInt(limit as string)
    );
    
    res.json(claims);
  } catch (error) {
    logger.error('Get user claims error:', error);
    res.status(500).json({ error: 'Failed to get user claims' });
  }
});

app.post('/api/insurance/claims/:claimId/process', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { decision, amount, notes } = req.body;
    
    const result = await claimProcessing.processClaim(claimId, decision, amount, notes);
    res.json(result);
  } catch (error) {
    logger.error('Claim processing error:', error);
    res.status(500).json({ error: 'Failed to process claim' });
  }
});

// Policy management routes
app.get('/api/insurance/policies/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const policies = await claimProcessing.getUserPolicies(userId);
    res.json(policies);
  } catch (error) {
    logger.error('Get user policies error:', error);
    res.status(500).json({ error: 'Failed to get user policies' });
  }
});

// Schedule automatic claim processing
cron.schedule('0 */6 * * *', async () => {
  logger.info('Running automated claim processing...');
  try {
    await claimProcessing.processAutomaticClaims();
  } catch (error) {
    logger.error('Automated claim processing error:', error);
  }
});

// Schedule weather monitoring
cron.schedule('0 */2 * * *', async () => {
  logger.info('Running weather monitoring...');
  try {
    await weatherInsurance.monitorWeatherConditions();
  } catch (error) {
    logger.error('Weather monitoring error:', error);
  }
});

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  logger.info(`🛡️ Insurance & Protection Service running on port ${PORT}`);
  logger.info('🔒 Coverage types:');
  logger.info('   ✅ Weather Insurance');
  logger.info('   ✅ Event Cancellation Protection');
  logger.info('   ✅ Fraud Protection');
  logger.info('   ✅ Automatic Claims Processing');
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import winston from 'winston';

// Import bridge modules
import { WormholeIntegration } from './bridges/wormholeIntegration';
import { EthereumBridge } from './bridges/ethereumBridge';
import { PolygonBridge } from './bridges/polygonBridge';
import { CrossChainVerify } from './bridges/crossChainVerify';

// Import monitoring
import { BridgeMonitoring } from './monitoring/bridgeMonitoring';
import { TransactionTracker } from './monitoring/transactionTracker';

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
    new winston.transports.File({ filename: 'logs/bridge-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/bridge-combined.log' }),
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
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many bridge requests from this IP'
});
app.use(limiter);

// Initialize bridge services
const wormholeIntegration = new WormholeIntegration(db, redis);
const ethereumBridge = new EthereumBridge(db, redis);
const polygonBridge = new PolygonBridge(db, redis);
const crossChainVerify = new CrossChainVerify(db, redis);

// Initialize monitoring
const bridgeMonitoring = new BridgeMonitoring(db, redis);
const transactionTracker = new TransactionTracker(db, redis);

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'bridge-service',
    timestamp: new Date().toISOString(),
    supportedChains: ['solana', 'ethereum', 'polygon']
  });
});

// Cross-chain bridge routes
app.post('/api/bridge/initiate', async (req, res) => {
  try {
    const { 
      fromChain, 
      toChain, 
      ticketId, 
      recipientAddress, 
      userId 
    } = req.body;

    // Validate supported chains
    const supportedChains = ['solana', 'ethereum', 'polygon'];
    if (!supportedChains.includes(fromChain) || !supportedChains.includes(toChain)) {
      return res.status(400).json({ error: 'Unsupported chain' });
    }

    let bridgeResult;

    // Route to appropriate bridge
    if (fromChain === 'solana' && toChain === 'ethereum') {
      bridgeResult = await wormholeIntegration.bridgeToEthereum(ticketId, recipientAddress, userId);
    } else if (fromChain === 'solana' && toChain === 'polygon') {
      bridgeResult = await wormholeIntegration.bridgeToPolygon(ticketId, recipientAddress, userId);
    } else if (fromChain === 'ethereum' && toChain === 'solana') {
      bridgeResult = await ethereumBridge.bridgeToSolana(ticketId, recipientAddress, userId);
    } else {
      return res.status(400).json({ error: 'Bridge route not supported' });
    }

    res.json(bridgeResult);

  } catch (error) {
    logger.error('Bridge initiation error:', error);
    res.status(500).json({ error: 'Bridge initiation failed' });
  }
});

app.get('/api/bridge/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const status = await transactionTracker.getTransactionStatus(transactionId);
    res.json(status);
  } catch (error) {
    logger.error('Bridge status error:', error);
    res.status(500).json({ error: 'Failed to get bridge status' });
  }
});

app.post('/api/bridge/verify', async (req, res) => {
  try {
    const { transactionHash, sourceChain, targetChain } = req.body;
    const verification = await crossChainVerify.verifyTransaction(
      transactionHash,
      sourceChain,
      targetChain
    );
    res.json(verification);
  } catch (error) {
    logger.error('Bridge verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Ethereum bridge routes
app.post('/api/bridge/ethereum/deposit', async (req, res) => {
  try {
    const { ticketId, amount, userAddress } = req.body;
    const result = await ethereumBridge.depositTicket(ticketId, amount, userAddress);
    res.json(result);
  } catch (error) {
    logger.error('Ethereum deposit error:', error);
    res.status(500).json({ error: 'Ethereum deposit failed' });
  }
});

app.post('/api/bridge/ethereum/withdraw', async (req, res) => {
  try {
    const { ticketId, amount, userAddress } = req.body;
    const result = await ethereumBridge.withdrawTicket(ticketId, amount, userAddress);
    res.json(result);
  } catch (error) {
    logger.error('Ethereum withdrawal error:', error);
    res.status(500).json({ error: 'Ethereum withdrawal failed' });
  }
});

// Polygon bridge routes
app.post('/api/bridge/polygon/transfer', async (req, res) => {
  try {
    const { ticketId, toAddress, userId } = req.body;
    const result = await polygonBridge.transferTicket(ticketId, toAddress, userId);
    res.json(result);
  } catch (error) {
    logger.error('Polygon transfer error:', error);
    res.status(500).json({ error: 'Polygon transfer failed' });
  }
});

// Bridge monitoring routes
app.get('/api/bridge/stats', async (req, res) => {
  try {
    const stats = await bridgeMonitoring.getBridgeStats();
    res.json(stats);
  } catch (error) {
    logger.error('Bridge stats error:', error);
    res.status(500).json({ error: 'Failed to get bridge stats' });
  }
});

app.get('/api/bridge/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const transactions = await transactionTracker.getUserTransactions(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    res.json(transactions);
  } catch (error) {
    logger.error('User transactions error:', error);
    res.status(500).json({ error: 'Failed to get user transactions' });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Bridge service error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Bridge operation failed'
  });
});

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  logger.info(`🌉 Cross-Chain Bridge Service running on port ${PORT}`);
  logger.info('🔗 Supported chains:');
  logger.info('   ✅ Solana (native)');
  logger.info('   ✅ Ethereum (via Wormhole)');
  logger.info('   ✅ Polygon (via Wormhole)');
  logger.info('🔍 Bridge monitoring active');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down bridge service gracefully');
  process.exit(0);
});

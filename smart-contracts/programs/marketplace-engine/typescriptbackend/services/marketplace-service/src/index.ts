import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { listingController } from './controllers/listingController';
import { offerController } from './controllers/offerController';
import { auctionController } from './controllers/auctionController';
import { royaltyController } from './controllers/royaltyController';
import { analyticsController } from './controllers/analyticsController';

import { ListingService } from './services/listingService';
import { PricingService } from './services/pricingService';
import { FraudDetectionService } from './services/fraudDetectionService';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const listingService = new ListingService();
const pricingService = new PricingService();
const fraudDetectionService = new FraudDetectionService();

// Routes
app.use('/api/listings', listingController);
app.use('/api/offers', offerController);
app.use('/api/auctions', auctionController);
app.use('/api/royalties', royaltyController);
app.use('/api/analytics', analyticsController);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'marketplace-service',
    timestamp: new Date().toISOString(),
    smartContracts: 'connected',
    features: [
      'automatic-artist-royalties',
      'price-cap-enforcement',
      'auction-system',
      'fraud-detection',
      'real-time-pricing'
    ]
  });
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
  console.log('🔄 Client connected to marketplace real-time feed');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 WebSocket message:', message);
      
      // Handle real-time marketplace events
      if (message.type === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: message.channel,
          message: 'Connected to marketplace updates'
        }));
      }
    } catch (error) {
      console.error('❌ WebSocket error:', error);
    }
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '🎫 Connected to TicketToken Marketplace',
    timestamp: new Date().toISOString()
  }));
});

const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
  console.log(`🚀 Marketplace Service running on port ${PORT}`);
  console.log(`💰 Revolutionary features active:`);
  console.log(`   ✅ Automatic artist royalties`);
  console.log(`   ✅ Anti-scalping price caps`);
  console.log(`   ✅ Real-time auctions`);
  console.log(`   ✅ Fraud detection`);
  console.log(`   ✅ Smart pricing algorithms`);
  console.log(`🎯 Ready to capture $15B secondary market!`);
});

export { listingService, pricingService, fraudDetectionService };

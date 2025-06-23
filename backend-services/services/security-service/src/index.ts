import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { KYCVerificationService } from './compliance/kycVerification';
import { FraudDetectionService } from './compliance/fraudDetection';
import { AuditLogger } from './audit/auditLogger';
import { EmergencyControlSystem } from './emergency/emergencyControls';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3030;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const kycService = new KYCVerificationService();
const fraudService = new FraudDetectionService();
const auditLogger = new AuditLogger();
const emergencyControls = new EmergencyControlSystem();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      kyc: 'operational',
      fraud: 'operational', 
      audit: 'operational',
      emergency: 'operational'
    }
  });
});

// Emergency endpoints
app.post('/api/emergency/pause', async (req, res) => {
  try {
    const { reason, initiatedBy } = req.body;
    const actionId = await emergencyControls.pauseSystem(initiatedBy, reason);
    res.json({ success: true, actionId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/status', async (req, res) => {
  res.json({
    operational: emergencyControls.isSystemOperational(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('🛡️ Security Service running on port', PORT);
  console.log('🆔 KYC verification ready');
  console.log('🕵️ Fraud detection active');
  console.log('📋 Audit logging enabled');
  console.log('🚨 Emergency controls armed');
});

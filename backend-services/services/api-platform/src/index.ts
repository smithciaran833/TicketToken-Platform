import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApiKeyManager } from './developer/apiKeyManagement';
import { WebhookManager } from './developer/webhookManager';
import { SDKGenerator } from './developer/sdkGenerator';
import { RateLimitManager } from './developer/rateLimiting';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3020;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const apiKeyManager = new ApiKeyManager();
const webhookManager = new WebhookManager();
const sdkGenerator = new SDKGenerator();
const rateLimitManager = new RateLimitManager();

// API Key Management Routes
app.post('/api/keys/generate', async (req, res) => {
  try {
    const { tenantId, environment, permissions } = req.body;
    const result = await apiKeyManager.generateApiKey(tenantId, environment, permissions);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/keys/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const keys = await apiKeyManager.getApiKeys(tenantId);
    
    // Remove sensitive data
    const safeKeys = keys.map(key => ({
      ...key,
      hashedKey: undefined,
      keyId: key.keyId.substring(0, 12) + '...'
    }));
    
    res.json({
      success: true,
      data: safeKeys
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const success = await apiKeyManager.revokeApiKey(keyId);
    
    res.json({
      success,
      message: success ? 'API key revoked' : 'API key not found'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook Management Routes
app.post('/api/webhooks', async (req, res) => {
  try {
    const { tenantId, url, events } = req.body;
    const webhookId = await webhookManager.createWebhook(tenantId, url, events);
    
    res.json({
      success: true,
      data: { id: webhookId }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/webhooks/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const webhooks = await webhookManager.getWebhooks(tenantId);
    
    res.json({
      success: true,
      data: webhooks
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SDK Generation Routes
app.post('/api/sdk/generate', async (req, res) => {
  try {
    const { tenantId, language, apiKey } = req.body;
    
    const config = {
      language,
      version: '1.0.0',
      baseUrl: process.env.API_BASE_URL || 'https://api.tickettoken.io',
      apiKey,
      tenantId
    };
    
    let sdk: string;
    
    if (language === 'javascript') {
      sdk = await sdkGenerator.generateJavaScriptSDK(config);
    } else if (language === 'python') {
      sdk = await sdkGenerator.generatePythonSDK(config);
    } else if (language === 'documentation') {
      sdk = await sdkGenerator.generateDocumentation(config);
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    res.json({
      success: true,
      data: { sdk, language }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rate Limiting Info
app.get('/api/rate-limit/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const { tier = 'professional' } = req.query;
    
    const config = { keyId, tier: tier as any };
    const remaining = await rateLimitManager.getRemainingRequests(config);
    const stats = rateLimitManager.getUsageStats(config);
    
    res.json({
      success: true,
      data: {
        remaining,
        limit: stats.limit,
        window: stats.window
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      apiKeys: 'operational',
      webhooks: 'operational',
      sdkGenerator: 'operational',
      rateLimiting: 'operational'
    }
  });
});

app.listen(PORT, () => {
  console.log('🔌 API Platform Service running on port', PORT);
  console.log('🔑 API key management active');
  console.log('🪝 Webhook system operational');
  console.log('📚 SDK generation ready');
  console.log('⚡ Rate limiting configured');
  console.log('💰 Ready for developer onboarding!');
});

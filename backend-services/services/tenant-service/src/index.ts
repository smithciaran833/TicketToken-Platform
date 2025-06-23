import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { TenantManager } from './core/tenantManager/TenantManager';
import { DomainMapper } from './core/domainMapping/DomainMapper';
import { TenantScaler } from './core/scaling/TenantScaler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize services
const tenantManager = new TenantManager();
const domainMapper = new DomainMapper();
const tenantScaler = new TenantScaler();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'tenant-service',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// Tenant management routes
app.post('/api/tenants', async (req, res) => {
  try {
    const config = req.body;
    const result = await tenantManager.createTenant(config);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tenants', async (req, res) => {
  try {
    const filters = req.query;
    const tenants = await tenantManager.listTenants(filters);
    res.json({ success: true, data: tenants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await tenantManager.getTenantById(id);
    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const tenant = await tenantManager.updateTenant(id, updates);
    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await tenantManager.deleteTenant(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Domain management routes
app.post('/api/domains', async (req, res) => {
  try {
    const { domain, tenantId } = req.body;
    const result = await domainMapper.setupCustomDomain(domain, tenantId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/domains/:domain/status', async (req, res) => {
  try {
    const { domain } = req.params;
    const status = await domainMapper.getDomainStatus(domain);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scaling and monitoring routes
app.get('/api/tenants/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const metrics = await tenantScaler.getScalingMetrics(id);
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/tenants/:id/scale', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await tenantScaler.autoScale(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tenants/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const usage = await tenantManager.getTenantUsage(id);
    res.json({ success: true, data: usage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tenant resolution middleware (for routing incoming requests)
app.use('/resolve', async (req, res, next) => {
  try {
    const host = req.get('host');
    const domain = host?.split(':')[0]; // Remove port if present
    
    if (domain) {
      const tenant = await domainMapper.getTenantByDomain(domain);
      if (tenant) {
        req.tenant = tenant;
        res.json({ success: true, data: tenant });
        return;
      }
    }
    
    res.status(404).json({ success: false, error: 'Tenant not found' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🏗️ Tenant Service running on port ${PORT}`);
  console.log('🏢 Multi-tenant architecture active');
  console.log('🌐 Domain mapping enabled');
  console.log('📈 Auto-scaling configured');
  console.log('💰 Ready for partner onboarding!');
});

// Import branding engine
import { BrandingEngine } from './customization/branding/BrandingEngine';

// Initialize branding engine
const brandingEngine = new BrandingEngine();

// Branding routes
app.post('/api/tenant/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const brandingAssets = req.body;
    const result = await brandingEngine.createTenantTheme(id, brandingAssets);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tenant/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const theme = await brandingEngine.getTenantTheme(id);
    res.json({ success: true, data: theme });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/theme/preview', async (req, res) => {
  try {
    const brandingAssets = req.body;
    const result = await brandingEngine.previewTheme(brandingAssets);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/tenant/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const result = await brandingEngine.updateTenantTheme(id, updates);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


import { randomBytes, createHash } from 'crypto';

interface ApiKey {
  id: string;
  keyId: string;
  hashedKey: string;
  name: string;
  tenantId: string;
  environment: 'test' | 'live';
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

interface ApiKeyUsage {
  keyId: string;
  requests: number;
  date: string;
  endpoints: Record<string, number>;
}

export class ApiKeyManager {
  private keys: Map<string, ApiKey> = new Map();
  private usage: Map<string, ApiKeyUsage[]> = new Map();

  constructor() {
    console.log('🔑 ApiKeyManager initialized');
  }

  async generateApiKey(tenantId: string, environment: 'test' | 'live', permissions: string[]): Promise<{keyId: string, secret: string}> {
    const keyId = `tt_${environment}_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(32).toString('hex');
    const hashedKey = createHash('sha256').update(secret).digest('hex');

    const apiKey: ApiKey = {
      id: randomBytes(8).toString('hex'),
      keyId,
      hashedKey,
      name: `${environment} Key`,
      tenantId,
      environment,
      permissions,
      rateLimit: environment === 'test' ? 1000 : 10000, // requests per hour
      isActive: true,
      createdAt: new Date()
    };

    this.keys.set(keyId, apiKey);
    
    console.log(`🔑 Generated ${environment} API key for tenant: ${tenantId}`);
    return { keyId, secret: `${keyId}_${secret}` };
  }

  async validateApiKey(authHeader: string): Promise<ApiKey | null> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const [keyId, secret] = token.split('_').slice(0, -1).join('_').split('_').concat(token.split('_').pop() || '');
    
    const apiKey = this.keys.get(keyId);
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    const hashedSecret = createHash('sha256').update(secret).digest('hex');
    if (hashedSecret !== apiKey.hashedKey) {
      return null;
    }

    // Update last used
    apiKey.lastUsed = new Date();
    this.recordUsage(keyId, 'validation');

    console.log(`✅ API key validated for tenant: ${apiKey.tenantId}`);
    return apiKey;
  }

  async revokeApiKey(keyId: string): Promise<boolean> {
    const apiKey = this.keys.get(keyId);
    if (!apiKey) {
      return false;
    }

    apiKey.isActive = false;
    console.log(`🚫 Revoked API key: ${keyId}`);
    return true;
  }

  async getApiKeys(tenantId: string): Promise<ApiKey[]> {
    const tenantKeys = Array.from(this.keys.values())
      .filter(key => key.tenantId === tenantId);
    
    console.log(`📋 Retrieved ${tenantKeys.length} API keys for tenant: ${tenantId}`);
    return tenantKeys;
  }

  private recordUsage(keyId: string, endpoint: string): void {
    const today = new Date().toISOString().split('T')[0];
    const usage = this.usage.get(keyId) || [];
    
    let todayUsage = usage.find(u => u.date === today);
    if (!todayUsage) {
      todayUsage = {
        keyId,
        requests: 0,
        date: today,
        endpoints: {}
      };
      usage.push(todayUsage);
    }

    todayUsage.requests++;
    todayUsage.endpoints[endpoint] = (todayUsage.endpoints[endpoint] || 0) + 1;
    
    this.usage.set(keyId, usage);
  }

  async getUsageStats(keyId: string, days: number = 30): Promise<ApiKeyUsage[]> {
    const usage = this.usage.get(keyId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return usage.filter(u => new Date(u.date) >= cutoffDate);
  }
}

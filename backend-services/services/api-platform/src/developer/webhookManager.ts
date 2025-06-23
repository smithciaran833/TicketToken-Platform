import axios from 'axios';
import { createHash, createHmac } from 'crypto';

interface Webhook {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  createdAt: Date;
  lastDelivery?: {
    timestamp: Date;
    status: 'success' | 'failed';
    statusCode?: number;
    error?: string;
  };
}

interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  tenantId: string;
}

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private deliveryQueue: WebhookEvent[] = [];

  constructor() {
    console.log('🪝 WebhookManager initialized');
    this.startDeliveryProcessor();
  }

  async createWebhook(tenantId: string, url: string, events: string[]): Promise<string> {
    const webhookId = `wh_${randomBytes(16).toString('hex')}`;
    const secret = randomBytes(32).toString('hex');

    const webhook: Webhook = {
      id: webhookId,
      tenantId,
      url,
      events,
      secret,
      isActive: true,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2
      },
      createdAt: new Date()
    };

    this.webhooks.set(webhookId, webhook);
    
    console.log(`🪝 Created webhook for tenant ${tenantId}: ${url}`);
    return webhookId;
  }

  async triggerEvent(event: WebhookEvent): Promise<void> {
    const tenantWebhooks = Array.from(this.webhooks.values())
      .filter(wh => wh.tenantId === event.tenantId && wh.isActive)
      .filter(wh => wh.events.includes(event.type) || wh.events.includes('*'));

    for (const webhook of tenantWebhooks) {
      this.deliveryQueue.push(event);
      console.log(`📤 Queued event ${event.type} for webhook: ${webhook.id}`);
    }
  }

  private async deliverWebhook(webhook: Webhook, event: WebhookEvent, attempt: number = 1): Promise<void> {
    try {
      const payload = {
        id: event.id,
        type: event.type,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
        tenant_id: event.tenantId
      };

      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-TicketToken-Signature': signature,
          'X-TicketToken-Event': event.type,
          'User-Agent': 'TicketToken-Webhooks/1.0'
        },
        timeout: 30000
      });

      webhook.lastDelivery = {
        timestamp: new Date(),
        status: 'success',
        statusCode: response.status
      };

      console.log(`✅ Webhook delivered successfully: ${webhook.id} (attempt ${attempt})`);

    } catch (error: any) {
      console.error(`❌ Webhook delivery failed: ${webhook.id} (attempt ${attempt})`, error.message);

      webhook.lastDelivery = {
        timestamp: new Date(),
        status: 'failed',
        statusCode: error.response?.status,
        error: error.message
      };

      // Retry logic
      if (attempt < webhook.retryPolicy.maxRetries) {
        const delay = Math.pow(webhook.retryPolicy.backoffMultiplier, attempt) * 1000;
        setTimeout(() => {
          this.deliverWebhook(webhook, event, attempt + 1);
        }, delay);
      }
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private startDeliveryProcessor(): void {
    setInterval(() => {
      if (this.deliveryQueue.length > 0) {
        const event = this.deliveryQueue.shift()!;
        const webhooks = Array.from(this.webhooks.values())
          .filter(wh => wh.tenantId === event.tenantId && wh.isActive)
          .filter(wh => wh.events.includes(event.type) || wh.events.includes('*'));

        webhooks.forEach(webhook => {
          this.deliverWebhook(webhook, event);
        });
      }
    }, 1000); // Process queue every second
  }

  async getWebhooks(tenantId: string): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(wh => wh.tenantId === tenantId);
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    const deleted = this.webhooks.delete(webhookId);
    if (deleted) {
      console.log(`🗑️ Deleted webhook: ${webhookId}`);
    }
    return deleted;
  }
}

function randomBytes(size: number): Buffer {
  return require('crypto').randomBytes(size);
}

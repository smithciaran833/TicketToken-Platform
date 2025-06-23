import { createHash } from 'crypto';

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  checksum: string;
}

export class AuditLogger {
  private events: AuditEvent[] = [];

  constructor() {
    console.log('📋 Audit Logger initialized');
  }

  async logEvent(userId: string, action: string, resource: string, details: any, ipAddress: string, userAgent: string, success: boolean = true): Promise<string> {
    const timestamp = new Date();
    const id = `audit_${timestamp.getTime()}_${Math.random().toString(36).substring(7)}`;
    
    const event: AuditEvent = {
      id, timestamp, userId, action, resource, details, ipAddress, userAgent, success,
      riskLevel: this.assessRiskLevel(action, success),
      checksum: this.generateChecksum(id, timestamp, userId, action, resource, success)
    };

    this.events.push(event);
    console.log(`📝 Audit event logged: ${action} by ${userId}`);
    return id;
  }

  private assessRiskLevel(action: string, success: boolean): AuditEvent['riskLevel'] {
    if (!success) return 'high';
    const highRiskActions = ['admin_login', 'user_delete', 'system_config_change'];
    return highRiskActions.includes(action) ? 'high' : 'low';
  }

  private generateChecksum(id: string, timestamp: Date, userId: string, action: string, resource: string, success: boolean): string {
    const data = `${id}${timestamp.toISOString()}${userId}${action}${resource}${success}`;
    return createHash('sha256').update(data).digest('hex');
  }

  async getEvents(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}

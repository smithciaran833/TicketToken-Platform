import { ValidationResult, QRData } from './qrValidator';
import { logger } from '../utils/logger';

export interface FraudAlert {
  id: string;
  type: 'duplicate_scan' | 'rapid_scans' | 'location_anomaly' | 'invalid_signature' | 'expired_ticket';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ticketId: string;
  eventId: string;
  gateId: string;
  staffId: string;
  timestamp: Date;
  details: {
    description: string;
    metadata: any;
  };
  status: 'active' | 'investigated' | 'resolved' | 'false_positive';
}

export interface ScanAttempt {
  ticketId: string;
  gateId: string;
  staffId: string;
  timestamp: Date;
  result: 'success' | 'duplicate' | 'invalid' | 'expired';
  ipAddress?: string;
  userAgent?: string;
}

export class FraudDetection {
  private scanHistory: Map<string, ScanAttempt[]> = new Map();
  private alerts: Map<string, FraudAlert> = new Map();
  private suspiciousIPs: Set<string> = new Set();

  // Configuration
  private readonly RAPID_SCAN_THRESHOLD = 5; // scans per minute
  private readonly DUPLICATE_SCAN_WINDOW = 300000; // 5 minutes in ms
  private readonly MAX_DISTANCE_METERS = 1000; // max distance between gates

  /**
   * Analyze validation attempt for fraud
   */
  async analyzeScan(
    qrData: QRData,
    validationResult: ValidationResult,
    gateId: string,
    staffId: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      location?: { latitude: number; longitude: number };
    }
  ): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    // Record scan attempt
    const scanAttempt: ScanAttempt = {
      ticketId: qrData.ticketId,
      gateId,
      staffId,
      timestamp: new Date(),
      result: validationResult.isValid ? 'success' : 'invalid',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent
    };

    this.recordScanAttempt(scanAttempt);

    // Check for various fraud patterns
    alerts.push(...this.checkDuplicateScans(qrData.ticketId, gateId, staffId));
    alerts.push(...this.checkRapidScans(qrData.ticketId, staffId));
    alerts.push(...this.checkLocationAnomalies(qrData.ticketId, gateId, metadata?.location));
    alerts.push(...this.checkInvalidSignatures(qrData, validationResult));
    alerts.push(...this.checkSuspiciousPatterns(staffId, metadata?.ipAddress));

    // Store alerts
    alerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
      logger.warn('Fraud alert generated:', alert);
    });

    return alerts;
  }

  /**
   * Record scan attempt in history
   */
  private recordScanAttempt(scanAttempt: ScanAttempt): void {
    const ticketHistory = this.scanHistory.get(scanAttempt.ticketId) || [];
    ticketHistory.push(scanAttempt);
    
    // Keep only recent history (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentHistory = ticketHistory.filter(h => h.timestamp > yesterday);
    
    this.scanHistory.set(scanAttempt.ticketId, recentHistory);
  }

  /**
   * Check for duplicate scans
   */
  private checkDuplicateScans(ticketId: string, gateId: string, staffId: string): FraudAlert[] {
    const alerts: FraudAlert[] = [];
    const history = this.scanHistory.get(ticketId) || [];
    const now = new Date();

    // Check for recent successful scans
    const recentSuccess = history.find(h => 
      h.result === 'success' && 
      (now.getTime() - h.timestamp.getTime()) < this.DUPLICATE_SCAN_WINDOW
    );

    if (recentSuccess) {
      alerts.push({
        id: `dup-${ticketId}-${Date.now()}`,
        type: 'duplicate_scan',
        severity: 'high',
        ticketId,
        eventId: '', // Will be filled by caller
        gateId,
        staffId,
        timestamp: now,
        details: {
          description: 'Ticket scanned multiple times within short window',
          metadata: {
            previousScan: recentSuccess,
            timeDifference: now.getTime() - recentSuccess.timestamp.getTime()
          }
        },
        status: 'active'
      });
    }

    return alerts;
  }

  /**
   * Check for rapid consecutive scans
   */
  private checkRapidScans(ticketId: string, staffId: string): FraudAlert[] {
    const alerts: FraudAlert[] = [];
    const history = this.scanHistory.get(ticketId) || [];
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Count scans in last minute
    const recentScans = history.filter(h => h.timestamp > oneMinuteAgo);

    if (recentScans.length >= this.RAPID_SCAN_THRESHOLD) {
      alerts.push({
        id: `rapid-${ticketId}-${Date.now()}`,
        type: 'rapid_scans',
        severity: 'medium',
        ticketId,
        eventId: '',
        gateId: recentScans[recentScans.length - 1].gateId,
        staffId,
        timestamp: now,
        details: {
          description: 'Unusually rapid scan attempts detected',
          metadata: {
            scansPerMinute: recentScans.length,
            scanHistory: recentScans
          }
        },
        status: 'active'
      });
    }

    return alerts;
  }

  /**
   * Check for location anomalies
   */
  private checkLocationAnomalies(
    ticketId: string, 
    gateId: string, 
    location?: { latitude: number; longitude: number }
  ): FraudAlert[] {
    const alerts: FraudAlert[] = [];
    
    if (!location) return alerts;

    const history = this.scanHistory.get(ticketId) || [];
    const recentScans = history.filter(h => 
      h.timestamp > new Date(Date.now() - 300000) // Last 5 minutes
    );

    // Check if ticket was scanned at distant locations too quickly
    for (const scan of recentScans) {
      // This would require gate location data - simplified for now
      if (scan.gateId !== gateId) {
        alerts.push({
          id: `location-${ticketId}-${Date.now()}`,
          type: 'location_anomaly',
          severity: 'medium',
          ticketId,
          eventId: '',
          gateId,
          staffId: scan.staffId,
          timestamp: new Date(),
          details: {
            description: 'Ticket scanned at multiple distant locations',
            metadata: {
              currentGate: gateId,
              previousGate: scan.gateId,
              timeDifference: Date.now() - scan.timestamp.getTime()
            }
          },
          status: 'active'
        });
      }
    }

    return alerts;
  }

  /**
   * Check for invalid signatures
   */
  private checkInvalidSignatures(qrData: QRData, validationResult: ValidationResult): FraudAlert[] {
    const alerts: FraudAlert[] = [];

    if (!validationResult.isValid && validationResult.error?.includes('signature')) {
      alerts.push({
        id: `sig-${qrData.ticketId}-${Date.now()}`,
        type: 'invalid_signature',
        severity: 'critical',
        ticketId: qrData.ticketId,
        eventId: qrData.eventId,
        gateId: '',
        staffId: '',
        timestamp: new Date(),
        details: {
          description: 'QR code with invalid signature detected',
          metadata: {
            qrData: {
              ticketId: qrData.ticketId,
              eventId: qrData.eventId,
              timestamp: qrData.timestamp
            }
          }
        },
        status: 'active'
      });
    }

    return alerts;
  }

  /**
   * Check for suspicious patterns
   */
  private checkSuspiciousPatterns(staffId: string, ipAddress?: string): FraudAlert[] {
    const alerts: FraudAlert[] = [];

    // Check for suspicious IP addresses
    if (ipAddress && this.suspiciousIPs.has(ipAddress)) {
      alerts.push({
        id: `suspicious-${staffId}-${Date.now()}`,
        type: 'location_anomaly',
        severity: 'high',
        ticketId: '',
        eventId: '',
        gateId: '',
        staffId,
        timestamp: new Date(),
        details: {
          description: 'Scan from suspicious IP address',
          metadata: {
            ipAddress,
            staffId
          }
        },
        status: 'active'
      });
    }

    return alerts;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): FraudAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.status === 'active');
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): FraudAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.severity === severity);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, status: 'investigated' | 'resolved' | 'false_positive'): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = status;
      this.alerts.set(alertId, alert);
    }
  }

  /**
   * Add suspicious IP
   */
  addSuspiciousIP(ipAddress: string): void {
    this.suspiciousIPs.add(ipAddress);
  }

  /**
   * Get fraud statistics
   */
  getFraudStats(): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
    resolvedAlerts: number;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const alertsBySeverity = {
      low: alerts.filter(a => a.severity === 'low').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      high: alerts.filter(a => a.severity === 'high').length,
      critical: alerts.filter(a => a.severity === 'critical').length
    };

    const alertsByType = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAlerts: alerts.length,
      alertsBySeverity,
      alertsByType,
      resolvedAlerts: alerts.filter(a => a.status === 'resolved').length
    };
  }
}

export const fraudDetection = new FraudDetection();

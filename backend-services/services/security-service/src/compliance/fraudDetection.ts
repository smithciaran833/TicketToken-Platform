import geoip from 'geoip-lite';

interface TransactionData {
  userId: string;
  amount: number;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  paymentMethod: string;
  ticketEventId: string;
  quantity: number;
}

interface FraudAlert {
  id: string;
  userId: string;
  transactionId: string;
  riskScore: number;
  flags: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow' | 'review' | 'block';
  timestamp: Date;
}

interface UserBehaviorProfile {
  userId: string;
  averageTransactionAmount: number;
  typicalPurchaseTimes: number[]; // hours of day
  commonLocations: string[];
  deviceFingerprints: string[];
  velocityLimits: {
    dailyAmount: number;
    weeklyTransactions: number;
  };
}

export class FraudDetectionService {
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private alerts: FraudAlert[] = [];
  private transactionHistory: Map<string, TransactionData[]> = new Map();

  constructor() {
    console.log('🕵️ Fraud Detection Service initialized');
  }

  async analyzeTransaction(transaction: TransactionData): Promise<FraudAlert | null> {
    console.log(`🔍 Analyzing transaction: ${transaction.userId} - $${transaction.amount}`);
    
    const flags: string[] = [];
    let riskScore = 0;

    // Get or create user profile
    const profile = this.getUserProfile(transaction.userId);
    
    // Add transaction to history
    this.addTransactionToHistory(transaction);

    // Check velocity limits
    if (this.checkVelocityLimits(transaction)) {
      flags.push('velocity_exceeded');
      riskScore += 30;
    }

    // Check unusual amount
    if (this.checkUnusualAmount(transaction, profile)) {
      flags.push('unusual_amount');
      riskScore += 20;
    }

    // Check location anomaly
    const locationRisk = this.checkLocationAnomaly(transaction, profile);
    if (locationRisk > 0) {
      flags.push('location_anomaly');
      riskScore += locationRisk;
    }

    // Check time anomaly
    if (this.checkTimeAnomaly(transaction, profile)) {
      flags.push('time_anomaly');
      riskScore += 15;
    }

    // Check bot patterns
    if (this.checkBotPatterns(transaction)) {
      flags.push('bot_patterns');
      riskScore += 40;
    }

    // Check duplicate purchases
    if (this.checkDuplicatePurchases(transaction)) {
      flags.push('duplicate_purchase');
      riskScore += 25;
    }

    // Update user profile
    this.updateUserProfile(transaction, profile);

    // Create alert if risk score is high enough
    if (riskScore >= 25 || flags.length >= 2) {
      const alert: FraudAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: transaction.userId,
        transactionId: `tx_${Date.now()}`,
        riskScore,
        flags,
        severity: this.calculateSeverity(riskScore),
        action: this.determineAction(riskScore, flags),
        timestamp: new Date()
      };

      this.alerts.push(alert);
      console.log(`🚨 Fraud alert generated: ${alert.severity} (${riskScore}%)`);
      return alert;
    }

    console.log(`✅ Transaction approved (Risk: ${riskScore}%)`);
    return null;
  }

  private getUserProfile(userId: string): UserBehaviorProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        averageTransactionAmount: 50,
        typicalPurchaseTimes: [18, 19, 20, 21], // Evening hours
        commonLocations: [],
        deviceFingerprints: [],
        velocityLimits: {
          dailyAmount: 1000,
          weeklyTransactions: 10
        }
      });
    }
    return this.userProfiles.get(userId)!;
  }

  private addTransactionToHistory(transaction: TransactionData): void {
    const history = this.transactionHistory.get(transaction.userId) || [];
    history.push(transaction);
    
    // Keep only last 100 transactions
    if (history.length > 100) {
      history.shift();
    }
    
    this.transactionHistory.set(transaction.userId, history);
  }

  private checkVelocityLimits(transaction: TransactionData): boolean {
    const history = this.transactionHistory.get(transaction.userId) || [];
    const now = new Date();
    
    // Check daily amount
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    
    const dailyAmount = history
      .filter(tx => tx.timestamp >= dayStart)
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    if (dailyAmount + transaction.amount > 1000) { // $1000 daily limit
      return true;
    }

    // Check hourly transactions
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyTransactions = history.filter(tx => tx.timestamp >= hourAgo).length;
    
    if (hourlyTransactions >= 5) { // 5 transactions per hour
      return true;
    }

    return false;
  }

  private checkUnusualAmount(transaction: TransactionData, profile: UserBehaviorProfile): boolean {
    const threshold = profile.averageTransactionAmount * 3;
    return transaction.amount > threshold;
  }

  private checkLocationAnomaly(transaction: TransactionData, profile: UserBehaviorProfile): number {
    const geo = geoip.lookup(transaction.ipAddress);
    if (!geo) return 0;
    
    const currentLocation = `${geo.city}, ${geo.country}`;
    
    if (profile.commonLocations.length === 0) {
      return 0; // First transaction
    }
    
    if (!profile.commonLocations.includes(currentLocation)) {
      // Check if it's a high-risk country
      const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
      if (highRiskCountries.includes(geo.country)) {
        return 35;
      }
      return 20;
    }
    
    return 0;
  }

  private checkTimeAnomaly(transaction: TransactionData, profile: UserBehaviorProfile): boolean {
    const hour = transaction.timestamp.getHours();
    
    // Check if transaction is during unusual hours (2 AM - 6 AM)
    if (hour >= 2 && hour <= 6) {
      return true;
    }
    
    // Check against user's typical hours
    if (profile.typicalPurchaseTimes.length > 0) {
      const isTypicalTime = profile.typicalPurchaseTimes.some(
        typicalHour => Math.abs(hour - typicalHour) <= 2
      );
      return !isTypicalTime;
    }
    
    return false;
  }

  private checkBotPatterns(transaction: TransactionData): boolean {
    // Check for bot-like user agents
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /automated/i
    ];
    
    return botPatterns.some(pattern => pattern.test(transaction.userAgent));
  }

  private checkDuplicatePurchases(transaction: TransactionData): boolean {
    const history = this.transactionHistory.get(transaction.userId) || [];
    const recentTransactions = history.filter(
      tx => tx.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );
    
    return recentTransactions.some(
      tx => tx.ticketEventId === transaction.ticketEventId && 
            tx.amount === transaction.amount &&
            tx.quantity === transaction.quantity
    );
  }

  private updateUserProfile(transaction: TransactionData, profile: UserBehaviorProfile): void {
    // Update average transaction amount
    const history = this.transactionHistory.get(transaction.userId) || [];
    profile.averageTransactionAmount = history.reduce((sum, tx) => sum + tx.amount, 0) / history.length;
    
    // Update typical purchase times
    const hour = transaction.timestamp.getHours();
    if (!profile.typicalPurchaseTimes.includes(hour)) {
      profile.typicalPurchaseTimes.push(hour);
      profile.typicalPurchaseTimes = profile.typicalPurchaseTimes.slice(-10); // Keep last 10 hours
    }
    
    // Update common locations
    const geo = geoip.lookup(transaction.ipAddress);
    if (geo) {
      const location = `${geo.city}, ${geo.country}`;
      if (!profile.commonLocations.includes(location)) {
        profile.commonLocations.push(location);
        profile.commonLocations = profile.commonLocations.slice(-5); // Keep last 5 locations
      }
    }
  }

  private calculateSeverity(riskScore: number): FraudAlert['severity'] {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  private determineAction(riskScore: number, flags: string[]): FraudAlert['action'] {
    if (riskScore >= 80 || flags.includes('bot_patterns')) return 'block';
    if (riskScore >= 50 || flags.includes('velocity_exceeded')) return 'review';
    return 'allow';
  }

  async getAlerts(userId?: string): Promise<FraudAlert[]> {
    if (userId) {
      return this.alerts.filter(alert => alert.userId === userId);
    }
    return this.alerts;
  }

  async updateAlertStatus(alertId: string, action: 'approve' | 'reject'): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.action = action === 'approve' ? 'allow' : 'block';
      console.log(`📝 Alert ${alertId} updated: ${action}`);
      return true;
    }
    return false;
  }
}

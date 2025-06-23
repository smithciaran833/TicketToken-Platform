export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface SocialPlatformConfig {
  platform: 'spotify' | 'instagram' | 'twitter';
  credentials: {
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export interface IntegrationEvent {
  type: 'user_connected' | 'content_shared' | 'viral_detected' | 'milestone_reached';
  platform: string;
  userId?: string;
  eventId?: string;
  data: any;
  timestamp: Date;
}

export interface AnalyticsData {
  platform: string;
  eventId: string;
  metrics: {
    reach: number;
    engagement: number;
    conversions: number;
    revenue_attributed: number;
  };
  timeframe: {
    start: Date;
    end: Date;
  };
}

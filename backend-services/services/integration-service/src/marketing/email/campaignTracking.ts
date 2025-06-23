import { PrismaClient } from '@prisma/client';
import { MailchimpIntegration } from './mailchimpSync';

interface CampaignMetrics {
  campaignId: string;
  eventId?: string;
  platform: 'mailchimp' | 'sendgrid' | 'klaviyo';
  metrics: {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    conversions: number;
    revenue: number;
    unsubscribes: number;
    complaints: number;
  };
  rates: {
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    conversion_rate: number;
    unsubscribe_rate: number;
  };
  roi: {
    cost: number;
    revenue: number;
    roi_percentage: number;
    cost_per_conversion: number;
  };
}

interface CampaignPerformance {
  best_send_time: string;
  best_subject_line: string;
  top_performing_content: string[];
  audience_segments: Array<{
    segment: string;
    performance: CampaignMetrics['rates'];
  }>;
}

export class EmailCampaignTracker {
  private prisma: PrismaClient;
  private mailchimp: MailchimpIntegration;

  constructor() {
    this.prisma = new PrismaClient();
    this.mailchimp = new MailchimpIntegration();
  }

  async trackCampaignROI(campaignId: string, platform: string): Promise<CampaignMetrics> {
    try {
      let metrics;
      
      switch (platform) {
        case 'mailchimp':
          metrics = await this.getMailchimpMetrics(campaignId);
          break;
        case 'sendgrid':
          metrics = await this.getSendGridMetrics(campaignId);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // Calculate rates
      const rates = this.calculateRates(metrics);
      
      // Calculate ROI
      const roi = await this.calculateROI(campaignId, metrics);

      const campaignMetrics: CampaignMetrics = {
        campaignId,
        platform: platform as any,
        metrics,
        rates,
        roi
      };

      // Store metrics
      await this.storeCampaignMetrics(campaignMetrics);

      return campaignMetrics;

    } catch (error) {
      console.error('Campaign tracking failed:', error);
      throw error;
    }
  }

  private async getMailchimpMetrics(campaignId: string) {
    // Get basic campaign stats
    const campaign = await this.mailchimp['makeRequest']('GET', `/campaigns/${campaignId}`);
    const reports = await this.mailchimp['makeRequest']('GET', `/reports/${campaignId}`);

    return {
      sent: reports.emails_sent,
      delivered: reports.emails_sent - reports.bounces.hard_bounces - reports.bounces.soft_bounces,
      opens: reports.opens.opens_total,
      clicks: reports.clicks.clicks_total,
      conversions: await this.getConversionsFromCampaign(campaignId),
      revenue: await this.getRevenueFromCampaign(campaignId),
      unsubscribes: reports.unsubscribed,
      complaints: reports.abuse_reports
    };
  }

  private async getSendGridMetrics(campaignId: string) {
    // SendGrid API integration would go here
    // For now, return mock data structure
    return {
      sent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      unsubscribes: 0,
      complaints: 0
    };
  }

  private calculateRates(metrics: any) {
    return {
      delivery_rate: metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0,
      open_rate: metrics.delivered > 0 ? (metrics.opens / metrics.delivered) * 100 : 0,
      click_rate: metrics.opens > 0 ? (metrics.clicks / metrics.opens) * 100 : 0,
      conversion_rate: metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0,
      unsubscribe_rate: metrics.delivered > 0 ? (metrics.unsubscribes / metrics.delivered) * 100 : 0
    };
  }

  private async calculateROI(campaignId: string, metrics: any) {
    // Calculate campaign costs (simplified)
    const baseCost = 50; // Base campaign creation cost
    const emailCost = metrics.sent * 0.001; // $0.001 per email
    const totalCost = baseCost + emailCost;

    return {
      cost: totalCost,
      revenue: metrics.revenue,
      roi_percentage: totalCost > 0 ? ((metrics.revenue - totalCost) / totalCost) * 100 : 0,
      cost_per_conversion: metrics.conversions > 0 ? totalCost / metrics.conversions : 0
    };
  }

  private async getConversionsFromCampaign(campaignId: string): Promise<number> {
    // Track conversions by looking for ticket purchases with campaign attribution
    const conversions = await this.prisma.ticket.count({
      where: {
        utm_campaign: campaignId,
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    return conversions;
  }

  private async getRevenueFromCampaign(campaignId: string): Promise<number> {
    const result = await this.prisma.ticket.aggregate({
      where: {
        utm_campaign: campaignId,
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _sum: {
        price: true
      }
    });

    return result._sum.price || 0;
  }

  private async storeCampaignMetrics(metrics: CampaignMetrics) {
    await this.prisma.campaignMetrics.upsert({
      where: { campaign_id: metrics.campaignId },
      create: {
        campaign_id: metrics.campaignId,
        event_id: metrics.eventId,
        platform: metrics.platform,
        metrics: metrics.metrics,
        rates: metrics.rates,
        roi: metrics.roi,
        tracked_at: new Date()
      },
      update: {
        metrics: metrics.metrics,
        rates: metrics.rates,
        roi: metrics.roi,
        tracked_at: new Date()
      }
    });
  }

  async optimizeSendTimes(audienceId: string): Promise<CampaignPerformance['best_send_time']> {
    // Analyze historical campaign performance by send time
    const campaigns = await this.prisma.campaignMetrics.findMany({
      where: {
        platform: 'mailchimp',
        created_at: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      }
    });

    // Group by hour of day and calculate average open rates
    const hourlyPerformance = new Map();
    
    campaigns.forEach(campaign => {
      const hour = new Date(campaign.created_at).getHours();
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, { total_open_rate: 0, count: 0 });
      }
      
      const data = hourlyPerformance.get(hour);
      data.total_open_rate += campaign.rates.open_rate;
      data.count += 1;
    });

    // Find the hour with highest average open rate
    let bestHour = 10; // Default to 10 AM
    let bestOpenRate = 0;

    for (const [hour, data] of hourlyPerformance) {
      const avgOpenRate = data.total_open_rate / data.count;
      if (avgOpenRate > bestOpenRate) {
        bestOpenRate = avgOpenRate;
        bestHour = hour;
      }
    }

    return `${bestHour}:00`;
  }

  async analyzeSubjectLinePerformance(): Promise<Array<{
    subject_line: string;
    open_rate: number;
    click_rate: number;
    keywords: string[];
  }>> {
    const campaigns = await this.prisma.campaignMetrics.findMany({
      take: 100,
      orderBy: { created_at: 'desc' }
    });

    // Analyze subject line patterns
    const subjectAnalysis = campaigns.map(campaign => {
      const keywords = this.extractSubjectLineKeywords(campaign.subject_line || '');
      
      return {
        subject_line: campaign.subject_line || '',
        open_rate: campaign.rates.open_rate,
        click_rate: campaign.rates.click_rate,
        keywords
      };
    });

    // Sort by open rate
    return subjectAnalysis.sort((a, b) => b.open_rate - a.open_rate).slice(0, 10);
  }

  private extractSubjectLineKeywords(subjectLine: string): string[] {
    // Extract meaningful keywords from subject lines
    const keywords = [];
    
    // Check for emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    if (emojiRegex.test(subjectLine)) {
      keywords.push('contains_emoji');
    }

    // Check for urgency words
    const urgencyWords = ['limited', 'last chance', 'urgent', 'ending soon', 'final', 'expires'];
    if (urgencyWords.some(word => subjectLine.toLowerCase().includes(word))) {
      keywords.push('urgency');
    }

    // Check for personalization
    if (subjectLine.includes('*|FNAME|*') || subjectLine.includes('{first_name}')) {
      keywords.push('personalized');
    }

    // Check for question format
    if (subjectLine.includes('?')) {
      keywords.push('question');
    }

    // Check for numbers
    if (/\d/.test(subjectLine)) {
      keywords.push('contains_numbers');
    }

    return keywords;
  }

  async generateCampaignReport(eventId: string): Promise<{
    overview: CampaignMetrics;
    performance: CampaignPerformance;
    recommendations: string[];
  }> {
    const campaigns = await this.prisma.campaignMetrics.findMany({
      where: { event_id: eventId }
    });

    if (campaigns.length === 0) {
      throw new Error('No campaigns found for this event');
    }

    // Aggregate metrics
    const totalMetrics = campaigns.reduce((acc, campaign) => ({
      sent: acc.sent + campaign.metrics.sent,
      delivered: acc.delivered + campaign.metrics.delivered,
      opens: acc.opens + campaign.metrics.opens,
      clicks: acc.clicks + campaign.metrics.clicks,
      conversions: acc.conversions + campaign.metrics.conversions,
      revenue: acc.revenue + campaign.metrics.revenue,
      unsubscribes: acc.unsubscribes + campaign.metrics.unsubscribes,
      complaints: acc.complaints + campaign.metrics.complaints
    }), {
      sent: 0, delivered: 0, opens: 0, clicks: 0,
      conversions: 0, revenue: 0, unsubscribes: 0, complaints: 0
    });

    const overview: CampaignMetrics = {
      campaignId: `event-${eventId}`,
      eventId,
      platform: 'mailchimp',
      metrics: totalMetrics,
      rates: this.calculateRates(totalMetrics),
      roi: await this.calculateROI(`event-${eventId}`, totalMetrics)
    };

    const performance: CampaignPerformance = {
      best_send_time: await this.optimizeSendTimes(eventId),
      best_subject_line: (await this.analyzeSubjectLinePerformance())[0]?.subject_line || '',
      top_performing_content: ['Event reminders', 'Exclusive content', 'Artist updates'],
      audience_segments: []
    };

    const recommendations = this.generateRecommendations(overview);

    return { overview, performance, recommendations };
  }

  private generateRecommendations(metrics: CampaignMetrics): string[] {
    const recommendations = [];

    if (metrics.rates.open_rate < 20) {
      recommendations.push('Improve subject lines - current open rate is below industry average');
      recommendations.push('Test different send times to find optimal delivery windows');
    }

    if (metrics.rates.click_rate < 2) {
      recommendations.push('Enhance call-to-action buttons and content relevance');
      recommendations.push('Include more personalized content based on ticket purchase history');
    }

    if (metrics.rates.conversion_rate < 1) {
      recommendations.push('Create more compelling offers for email subscribers');
      recommendations.push('Implement abandoned cart email sequences');
    }

    if (metrics.roi.roi_percentage < 400) {
      recommendations.push('Focus on high-value subscriber segments');
      recommendations.push('Reduce campaign frequency to improve engagement quality');
    }

    return recommendations;
  }
}

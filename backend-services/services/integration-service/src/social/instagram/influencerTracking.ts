import { PrismaClient } from '@prisma/client';

interface InfluencerMetrics {
  influencerId: string;
  username: string;
  followers: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost_per_conversion: number;
  roi: number;
}

interface InfluencerCampaign {
  id: string;
  eventId: string;
  influencerId: string;
  tier: 'nano' | 'micro' | 'macro' | 'mega';
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  deliverables: {
    posts: number;
    stories: number;
    reels: number;
  };
  compensation: {
    type: 'monetary' | 'tickets' | 'hybrid';
    amount: number;
  };
  performance: InfluencerMetrics;
}

export class InstagramInfluencerTracker {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createInfluencerCampaign(
    eventId: string,
    influencerData: {
      username: string;
      followers: number;
      engagement_rate: number;
      tier: 'nano' | 'micro' | 'macro' | 'mega';
    }
  ): Promise<InfluencerCampaign> {
    const campaign: InfluencerCampaign = {
      id: `inf_${eventId}_${Date.now()}`,
      eventId,
      influencerId: influencerData.username,
      tier: influencerData.tier,
      status: 'pending',
      deliverables: this.calculateDeliverables(influencerData.tier),
      compensation: this.calculateCompensation(influencerData),
      performance: {
        influencerId: influencerData.username,
        username: influencerData.username,
        followers: influencerData.followers,
        engagement_rate: influencerData.engagement_rate,
        reach: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cost_per_conversion: 0,
        roi: 0
      }
    };

    await this.prisma.influencerCampaign.create({
      data: {
        ...campaign,
        created_at: new Date()
      }
    });

    return campaign;
  }

  private calculateDeliverables(tier: string) {
    const deliverableMap = {
      nano: { posts: 1, stories: 2, reels: 0 },      // 1K-10K followers
      micro: { posts: 2, stories: 3, reels: 1 },     // 10K-100K followers
      macro: { posts: 3, stories: 5, reels: 2 },     // 100K-1M followers
      mega: { posts: 5, stories: 8, reels: 3 }       // 1M+ followers
    };

    return deliverableMap[tier as keyof typeof deliverableMap];
  }

  private calculateCompensation(influencerData: any) {
    const rates = {
      nano: { post: 10, story: 5, reel: 15 },
      micro: { post: 100, story: 50, reel: 150 },
      macro: { post: 1000, story: 500, reel: 1500 },
      mega: { post: 10000, story: 5000, reel: 15000 }
    };

    const tierRates = rates[influencerData.tier as keyof typeof rates];
    const deliverables = this.calculateDeliverables(influencerData.tier);
    
    const totalCost = 
      (deliverables.posts * tierRates.post) +
      (deliverables.stories * tierRates.story) +
      (deliverables.reels * tierRates.reel);

    return {
      type: influencerData.tier === 'nano' ? 'tickets' : 'monetary' as const,
      amount: totalCost
    };
  }

  async trackInfluencerPerformance(
    campaignId: string,
    metrics: Partial<InfluencerMetrics>
  ) {
    const campaign = await this.prisma.influencerCampaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) throw new Error('Campaign not found');

    const updatedMetrics = { ...campaign.performance, ...metrics };
    
    // Calculate ROI
    if (updatedMetrics.conversions > 0 && campaign.compensation.amount > 0) {
      const revenue = updatedMetrics.conversions * 50; // Assume avg ticket price $50
      updatedMetrics.roi = ((revenue - campaign.compensation.amount) / campaign.compensation.amount) * 100;
      updatedMetrics.cost_per_conversion = campaign.compensation.amount / updatedMetrics.conversions;
    }

    await this.prisma.influencerCampaign.update({
      where: { id: campaignId },
      data: {
        performance: updatedMetrics,
        last_updated: new Date()
      }
    });

    return updatedMetrics;
  }

  async findInfluencersForEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        artist: true,
        venue: true
      }
    });

    if (!event) throw new Error('Event not found');

    // Find influencers based on:
    // 1. Geographic location (near venue)
    // 2. Music genre alignment
    // 3. Audience demographics
    // 4. Previous performance

    const targetCriteria = {
      location: event.venue.city,
      genres: event.artist.genres || [],
      minFollowers: 1000,
      minEngagement: 2.0, // 2% engagement rate
      audienceAge: '18-35'
    };

    // This would integrate with influencer discovery APIs
    // For now, return mock data structure
    return {
      nano: await this.findInfluencersByTier('nano', targetCriteria),
      micro: await this.findInfluencersByTier('micro', targetCriteria),
      macro: await this.findInfluencersByTier('macro', targetCriteria),
      mega: await this.findInfluencersByTier('mega', targetCriteria)
    };
  }

  private async findInfluencersByTier(tier: string, criteria: any) {
    // This would integrate with platforms like:
    // - AspireIQ
    // - Upfluence
    // - Creator.co
    // - Grin
    
    // Mock implementation
    const mockInfluencers = [
      {
        username: `music_lover_${tier}`,
        followers: this.getFollowerCountForTier(tier),
        engagement_rate: 3.2,
        location: criteria.location,
        genres: criteria.genres,
        estimated_cost: this.calculateCompensation({ tier, followers: this.getFollowerCountForTier(tier) })
      }
    ];

    return mockInfluencers;
  }

  private getFollowerCountForTier(tier: string): number {
    const followerRanges = {
      nano: 5000,
      micro: 50000,
      macro: 500000,
      mega: 2000000
    };

    return followerRanges[tier as keyof typeof followerRanges];
  }

  async generateInfluencerReport(eventId: string) {
    const campaigns = await this.prisma.influencerCampaign.findMany({
      where: { event_id: eventId }
    });

    const totalReach = campaigns.reduce((sum, c) => sum + c.performance.reach, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.performance.conversions, 0);
    const totalCost = campaigns.reduce((sum, c) => sum + c.compensation.amount, 0);
    const avgROI = campaigns.reduce((sum, c) => sum + c.performance.roi, 0) / campaigns.length;

    return {
      summary: {
        total_campaigns: campaigns.length,
        total_reach: totalReach,
        total_conversions: totalConversions,
        total_cost: totalCost,
        average_roi: avgROI,
        cost_per_conversion: totalCost / totalConversions
      },
      by_tier: this.groupCampaignsByTier(campaigns),
      top_performers: campaigns
        .sort((a, b) => b.performance.roi - a.performance.roi)
        .slice(0, 5),
      recommendations: this.generateRecommendations(campaigns)
    };
  }

  private groupCampaignsByTier(campaigns: any[]) {
    return campaigns.reduce((acc, campaign) => {
      if (!acc[campaign.tier]) {
        acc[campaign.tier] = {
          count: 0,
          total_reach: 0,
          total_conversions: 0,
          total_cost: 0,
          avg_roi: 0
        };
      }
      
      acc[campaign.tier].count++;
      acc[campaign.tier].total_reach += campaign.performance.reach;
      acc[campaign.tier].total_conversions += campaign.performance.conversions;
      acc[campaign.tier].total_cost += campaign.compensation.amount;
      acc[campaign.tier].avg_roi = (acc[campaign.tier].avg_roi + campaign.performance.roi) / acc[campaign.tier].count;
      
      return acc;
    }, {});
  }

  private generateRecommendations(campaigns: any[]) {
    const topTier = campaigns
      .reduce((acc, campaign) => {
        if (!acc[campaign.tier]) acc[campaign.tier] = [];
        acc[campaign.tier].push(campaign.performance.roi);
        return acc;
      }, {});

    const bestTier = Object.entries(topTier)
      .map(([tier, rois]: [string, number[]]) => ({
        tier,
        avgROI: rois.reduce((a, b) => a + b, 0) / rois.length
      }))
      .sort((a, b) => b.avgROI - a.avgROI)[0];

    return [
      `Focus on ${bestTier.tier} influencers for best ROI (${bestTier.avgROI.toFixed(1)}%)`,
      'Increase story content - higher engagement than posts',
      'Target local influencers for better conversion rates',
      'Provide clear tracking links for better attribution'
    ];
  }
}

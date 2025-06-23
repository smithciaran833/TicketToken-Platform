import { PrismaClient } from '@prisma/client';
import axios from 'axios';

interface MailchimpAudience {
  id: string;
  name: string;
  member_count: number;
  stats: {
    member_count: number;
    unsubscribe_count: number;
    cleaned_count: number;
    member_count_since_send: number;
    unsubscribe_count_since_send: number;
    cleaned_count_since_send: number;
    campaign_count: number;
    campaign_last_sent: string;
    merge_field_count: number;
    avg_sub_rate: number;
    avg_unsub_rate: number;
    target_sub_rate: number;
    open_rate: number;
    click_rate: number;
  };
}

interface MailchimpMember {
  email_address: string;
  status: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
  merge_fields: {
    FNAME?: string;
    LNAME?: string;
    PHONE?: string;
    TICKETS?: number;
    REVENUE?: number;
    LASTSHOW?: string;
    GENRES?: string;
    CITY?: string;
  };
  interests?: Record<string, boolean>;
  tags?: Array<{ name: string; status: 'active' | 'inactive' }>;
}

export class MailchimpIntegration {
  private apiKey: string;
  private server: string;
  private baseUrl: string;
  private prisma: PrismaClient;

  constructor() {
    this.apiKey = process.env.MAILCHIMP_API_KEY!;
    this.server = this.apiKey.split('-')[1];
    this.baseUrl = `https://${this.server}.api.mailchimp.com/3.0`;
    this.prisma = new PrismaClient();
  }

  async syncEventTicketHolders(eventId: string): Promise<{
    audienceId: string;
    syncedMembers: number;
    campaignId?: string;
  }> {
    try {
      // Get event and ticket holder data
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          artist: true,
          venue: true,
          tickets: {
            include: {
              user: true
            }
          }
        }
      });

      if (!event) throw new Error('Event not found');

      // Create or get audience for this event
      const audienceId = await this.createEventAudience(event);

      // Sync all ticket holders to Mailchimp
      let syncedMembers = 0;
      const batchOperations = [];

      for (const ticket of event.tickets) {
        if (ticket.user?.email) {
          const member = this.createMemberData(ticket.user, ticket, event);
          batchOperations.push({
            method: 'PUT',
            path: `/lists/${audienceId}/members/${this.getSubscriberHash(ticket.user.email)}`,
            body: JSON.stringify(member)
          });

          if (batchOperations.length >= 500) {
            await this.executeBatchOperation(batchOperations);
            syncedMembers += batchOperations.length;
            batchOperations.length = 0;
          }
        }
      }

      // Execute remaining operations
      if (batchOperations.length > 0) {
        await this.executeBatchOperation(batchOperations);
        syncedMembers += batchOperations.length;
      }

      // Create post-event campaign template
      const campaignId = await this.createPostEventCampaign(event, audienceId);

      // Store sync record
      await this.storeSyncRecord(eventId, audienceId, syncedMembers);

      return {
        audienceId,
        syncedMembers,
        campaignId
      };

    } catch (error) {
      console.error('Mailchimp sync failed:', error);
      throw new Error(`Mailchimp sync failed: ${error.message}`);
    }
  }

  private async createEventAudience(event: any): Promise<string> {
    const audienceName = `${event.artist.name} - ${event.name} (${new Date(event.date).toLocaleDateString()})`;
    
    try {
      // Check if audience already exists
      const existingAudience = await this.findAudienceByName(audienceName);
      if (existingAudience) return existingAudience.id;

      // Create new audience
      const audienceData = {
        name: audienceName,
        contact: {
          company: 'TicketToken',
          address1: '123 Music Street',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90210',
          country: 'US'
        },
        permission_reminder: `You're receiving this because you purchased tickets for ${event.artist.name} via TicketToken.`,
        use_archive_bar: true,
        campaign_defaults: {
          from_name: 'TicketToken',
          from_email: 'no-reply@tickettoken.io',
          subject: `${event.artist.name} - Exclusive Updates`,
          language: 'en'
        },
        email_type_option: true,
        double_optin: false,
        marketing_permissions: true
      };

      const response = await this.makeRequest('POST', '/lists', audienceData);
      
      // Create interest categories for this audience
      await this.createInterestCategories(response.id, event);
      
      return response.id;

    } catch (error) {
      console.error('Failed to create Mailchimp audience:', error);
      throw error;
    }
  }

  private async createInterestCategories(audienceId: string, event: any) {
    // Create interest categories for better segmentation
    const categories = [
      {
        title: 'Music Preferences',
        type: 'checkboxes',
        interests: event.artist.genres || ['Electronic', 'Hip Hop', 'Rock']
      },
      {
        title: 'Event Types',
        type: 'checkboxes', 
        interests: ['Concerts', 'Festivals', 'Club Events', 'VIP Experiences']
      },
      {
        title: 'Ticket Preferences',
        type: 'radio',
        interests: ['General Admission', 'VIP', 'Premium', 'Backstage']
      }
    ];

    for (const category of categories) {
      try {
        const categoryResponse = await this.makeRequest('POST', `/lists/${audienceId}/interest-categories`, {
          title: category.title,
          type: category.type
        });

        // Add interests to category
        for (const interest of category.interests) {
          await this.makeRequest('POST', `/lists/${audienceId}/interest-categories/${categoryResponse.id}/interests`, {
            name: interest
          });
        }
      } catch (error) {
        console.error('Failed to create interest category:', error);
      }
    }
  }

  private createMemberData(user: any, ticket: any, event: any): MailchimpMember {
    return {
      email_address: user.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: user.firstName || '',
        LNAME: user.lastName || '',
        PHONE: user.phone || '',
        TICKETS: user.totalTicketsPurchased || 1,
        REVENUE: user.totalSpent || ticket.price,
        LASTSHOW: event.name,
        GENRES: event.artist.genres?.join(', ') || '',
        CITY: user.city || event.venue.city
      },
      tags: [
        { name: `event-${event.id}`, status: 'active' },
        { name: `artist-${event.artist.name.toLowerCase().replace(/\s+/g, '-')}`, status: 'active' },
        { name: `venue-${event.venue.name.toLowerCase().replace(/\s+/g, '-')}`, status: 'active' },
        { name: `tier-${ticket.tier.toLowerCase()}`, status: 'active' },
        { name: 'tickettoken-customer', status: 'active' }
      ]
    };
  }

  private async createPostEventCampaign(event: any, audienceId: string): Promise<string> {
    const campaignData = {
      type: 'regular',
      recipients: {
        list_id: audienceId
      },
      settings: {
        subject_line: `Thanks for attending ${event.artist.name}! 🎵`,
        preview_text: 'Your exclusive post-event content and upcoming show recommendations',
        title: `Post Event - ${event.artist.name}`,
        from_name: 'TicketToken',
        reply_to: 'no-reply@tickettoken.io',
        use_conversation: false,
        to_name: '*|FNAME|*',
        folder_id: '',
        authenticate: true,
        auto_footer: false,
        inline_css: false,
        auto_tweet: false,
        auto_fb_post: [],
        fb_comments: true
      }
    };

    const campaign = await this.makeRequest('POST', '/campaigns', campaignData);

    // Create campaign content
    const content = this.generatePostEventEmailContent(event);
    await this.makeRequest('PUT', `/campaigns/${campaign.id}/content`, {
      html: content
    });

    return campaign.id;
  }

  private generatePostEventEmailContent(event: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thanks for attending ${event.artist.name}!</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="${process.env.TICKETTOKEN_LOGO_URL}" alt="TicketToken" style="max-width: 200px;">
    </div>
    
    <h1 style="color: #3B82F6; text-align: center;">Thanks for an amazing night! 🎵</h1>
    
    <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>${event.artist.name} at ${event.venue.name}</h2>
        <p>What a show! We hope you had an incredible time experiencing live music.</p>
    </div>
    
    <h3>🎫 Your Ticket is Now a Collectible!</h3>
    <p>Your ticket has been transformed into a unique digital collectible that proves you were there. View your collection and unlock exclusive content:</p>
    <div style="text-align: center; margin: 20px 0;">
        <a href="${process.env.FRONTEND_URL}/collection" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View My Collection</a>
    </div>
    
    <h3>🎤 Exclusive Behind-the-Scenes Content</h3>
    <p>As a ticket holder, you now have access to:</p>
    <ul>
        <li>Exclusive soundcheck recordings</li>
        <li>Behind-the-scenes photos and videos</li>
        <li>Artist interviews and messages</li>
        <li>Early access to future shows</li>
    </ul>
    
    <h3>🔮 Upcoming Shows You Might Love</h3>
    <p>Based on your taste in ${event.artist.genres?.join(', ') || 'music'}, here are some upcoming events:</p>
    <!-- Recommended events would be dynamically inserted here -->
    
    <div style="background: #10B981; color: white; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
        <h3>Share Your Experience!</h3>
        <p>Tag us @TicketToken and use #${event.artist.name.replace(/\s+/g, '')} to share your favorite moments from the show!</p>
        <div style="margin-top: 15px;">
            <a href="https://twitter.com/intent/tweet?text=Just%20saw%20${encodeURIComponent(event.artist.name)}%20live!%20Amazing%20show%20🎵%20%23${event.artist.name.replace(/\s+/g, '')}%20%23TicketToken" style="color: white; text-decoration: none; margin: 0 10px;">Share on Twitter</a>
            <a href="https://www.instagram.com/" style="color: white; text-decoration: none; margin: 0 10px;">Share on Instagram</a>
        </div>
    </div>
    
    <div style="text-align: center; margin-top: 40px; font-size: 14px; color: #666;">
        <p>Thanks for using TicketToken - The future of live entertainment</p>
        <p><a href="${process.env.FRONTEND_URL}" style="color: #3B82F6;">TicketToken.io</a></p>
    </div>
</body>
</html>
    `;
  }

  private async findAudienceByName(name: string): Promise<MailchimpAudience | null> {
    try {
      const response = await this.makeRequest('GET', '/lists?count=1000');
      const audience = response.lists.find((list: any) => list.name === name);
      return audience || null;
    } catch (error) {
      return null;
    }
  }

  private async executeBatchOperation(operations: any[]) {
    const batchData = {
      operations: operations
    };

    return await this.makeRequest('POST', '/batches', batchData);
  }

  private getSubscriberHash(email: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  private async makeRequest(method: string, endpoint: string, data?: any) {
    const config = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      data
    };

    const response = await axios(config);
    return response.data;
  }

  private async storeSyncRecord(eventId: string, audienceId: string, memberCount: number) {
    await this.prisma.emailSync.create({
      data: {
        event_id: eventId,
        platform: 'mailchimp',
        audience_id: audienceId,
        synced_members: memberCount,
        synced_at: new Date()
      }
    });
  }

  async createSegmentedCampaign(audienceId: string, segmentCriteria: {
    genres?: string[];
    ticketTiers?: string[];
    spendingLevel?: 'low' | 'medium' | 'high';
    engagement?: 'high' | 'medium' | 'low';
  }) {
    // Create advanced segments based on user behavior and preferences
    const segmentData = {
      name: `Targeted Segment - ${Date.now()}`,
      static_segment: false,
      options: {
        match: 'all',
        conditions: this.buildSegmentConditions(segmentCriteria)
      }
    };

    const segment = await this.makeRequest('POST', `/lists/${audienceId}/segments`, segmentData);
    return segment.id;
  }

  private buildSegmentConditions(criteria: any) {
    const conditions = [];

    if (criteria.genres?.length > 0) {
      conditions.push({
        condition_type: 'TextMerge',
        field: 'GENRES',
        op: 'contains',
        value: criteria.genres.join('|')
      });
    }

    if (criteria.spendingLevel) {
      const spendingRanges = {
        low: { min: 0, max: 100 },
        medium: { min: 100, max: 500 },
        high: { min: 500, max: 10000 }
      };
      
      const range = spendingRanges[criteria.spendingLevel];
      conditions.push({
        condition_type: 'TextMerge',
        field: 'REVENUE',
        op: 'greater',
        value: range.min.toString()
      });
    }

    return conditions;
  }

  async getAudienceInsights(audienceId: string) {
    const [audience, activity, growth] = await Promise.all([
      this.makeRequest('GET', `/lists/${audienceId}`),
      this.makeRequest('GET', `/lists/${audienceId}/activity`),
      this.makeRequest('GET', `/lists/${audienceId}/growth-history`)
    ]);

    return {
      stats: audience.stats,
      recent_activity: activity.activity,
      growth_trend: growth.history,
      recommendations: this.generateAudienceRecommendations(audience.stats)
    };
  }

  private generateAudienceRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats.open_rate < 20) {
      recommendations.push('Improve subject lines to increase open rates');
      recommendations.push('Send emails at optimal times based on audience timezone');
    }

    if (stats.click_rate < 2) {
      recommendations.push('Add more compelling call-to-action buttons');
      recommendations.push('Include exclusive offers for ticket holders');
    }

    if (stats.unsubscribe_count_since_send > stats.member_count * 0.02) {
      recommendations.push('Reduce email frequency');
      recommendations.push('Improve content relevance and personalization');
    }

    return recommendations;
  }
}

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import sharp from 'sharp';

interface StoryTemplate {
  backgroundImage: string;
  eventName: string;
  artistName: string;
  venueName: string;
  eventDate: string;
  ticketType: string;
  brandingElements: {
    logo: string;
    colors: {
      primary: string;
      secondary: string;
    };
  };
}

interface ShareableStory {
  imageUrl: string;
  storyUrl: string;
  caption: string;
  hashtags: string[];
}

export class InstagramStorySharer {
  private prisma: PrismaClient;
  private instagramAPI: any;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async shareTicketPurchase(
    ticketId: string, 
    userId: string,
    instagramAccessToken?: string
  ): Promise<ShareableStory> {
    try {
      // Get ticket and event details
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          event: {
            include: {
              artist: true,
              venue: true
            }
          },
          user: true
        }
      });

      if (!ticket) throw new Error('Ticket not found');

      // Generate story asset
      const storyAsset = await this.generateStoryAsset(ticket);

      // Create shareable story content
      const story: ShareableStory = {
        imageUrl: storyAsset.url,
        storyUrl: this.generateStoryLink(ticket),
        caption: this.generateCaption(ticket),
        hashtags: this.generateHashtags(ticket)
      };

      // If user has Instagram connected, auto-post
      if (instagramAccessToken) {
        await this.postToInstagramStory(story, instagramAccessToken);
      }

      // Track share for analytics
      await this.trackStoryShare(ticketId, userId, 'instagram');

      return story;

    } catch (error) {
      console.error('Instagram story sharing failed:', error);
      throw new Error('Failed to create shareable story');
    }
  }

  private async generateStoryAsset(ticket: any): Promise<{ url: string }> {
    const template = this.createStoryTemplate(ticket);
    
    // Create story image using Sharp
    const storyImage = await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: template.brandingElements.colors.primary
      }
    })
    .composite([
      // Background gradient
      {
        input: await this.createGradientBackground(template.brandingElements.colors),
        top: 0,
        left: 0
      },
      // Artist/Event image
      {
        input: await this.downloadAndResizeImage(ticket.event.artwork_url, 800, 600),
        top: 200,
        left: 140
      },
      // Excitement text overlay
      {
        input: await this.createTextOverlay('Just got my tickets! 🎵', {
          fontSize: 48,
          color: 'white',
          fontWeight: 'bold'
        }),
        top: 100,
        left: 50
      },
      // Event details
      {
        input: await this.createEventDetailsOverlay(ticket),
        top: 850,
        left: 50
      },
      // TicketToken branding
      {
        input: await this.createBrandingOverlay(),
        top: 1700,
        left: 50
      }
    ])
    .png()
    .toBuffer();

    // Upload to CDN
    const imageUrl = await this.uploadToCDN(storyImage, `story-${ticket.id}.png`);
    
    return { url: imageUrl };
  }

  private createStoryTemplate(ticket: any): StoryTemplate {
    return {
      backgroundImage: ticket.event.artwork_url,
      eventName: ticket.event.name,
      artistName: ticket.event.artist.name,
      venueName: ticket.event.venue.name,
      eventDate: new Date(ticket.event.date).toLocaleDateString(),
      ticketType: ticket.tier,
      brandingElements: {
        logo: process.env.TICKETTOKEN_LOGO_URL!,
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981'
        }
      }
    };
  }

  private async createGradientBackground(colors: any): Promise<Buffer> {
    return sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.7 }
      }
    }).png().toBuffer();
  }

  private async createTextOverlay(text: string, style: any): Promise<Buffer> {
    // Use sharp's text rendering or integrate with canvas
    const svg = `
      <svg width="980" height="100">
        <text x="10" y="50" font-family="Arial, sans-serif" 
              font-size="${style.fontSize}" font-weight="${style.fontWeight}" 
              fill="${style.color}">${text}</text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createEventDetailsOverlay(ticket: any): Promise<Buffer> {
    const svg = `
      <svg width="980" height="200">
        <rect width="980" height="200" fill="rgba(0,0,0,0.8)" rx="20"/>
        <text x="30" y="50" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white">
          ${ticket.event.artist.name}
        </text>
        <text x="30" y="90" font-family="Arial, sans-serif" font-size="24" fill="#10B981">
          ${ticket.event.name}
        </text>
        <text x="30" y="130" font-family="Arial, sans-serif" font-size="20" fill="white">
          📍 ${ticket.event.venue.name}
        </text>
        <text x="30" y="165" font-family="Arial, sans-serif" font-size="20" fill="white">
          📅 ${new Date(ticket.event.date).toLocaleDateString()}
        </text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async createBrandingOverlay(): Promise<Buffer> {
    const svg = `
      <svg width="300" height="100">
        <text x="10" y="30" font-family="Arial, sans-serif" font-size="18" fill="white">
          Powered by
        </text>
        <text x="10" y="60" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#3B82F6">
          TicketToken
        </text>
        <text x="10" y="85" font-family="Arial, sans-serif" font-size="14" fill="white">
          The future of ticketing 🎫
        </text>
      </svg>
    `;
    
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async downloadAndResizeImage(url: string, width: number, height: number): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return sharp(response.data)
      .resize(width, height, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  private generateCaption(ticket: any): string {
    const excitement = ['🔥', '🎵', '✨', '🎉', '💫'];
    const randomEmoji = excitement[Math.floor(Math.random() * excitement.length)];
    
    return `Just secured my tickets for ${ticket.event.artist.name}! ${randomEmoji} Can't wait to experience this live at ${ticket.event.venue.name}. Who else is going? 🙋‍♀️`;
  }

  private generateHashtags(ticket: any): string[] {
    const baseHashtags = ['#TicketToken', '#LiveMusic', '#Concert'];
    const artistHashtag = `#${ticket.event.artist.name.replace(/\s+/g, '')}`;
    const venueHashtag = `#${ticket.event.venue.name.replace(/\s+/g, '')}`;
    
    // Add genre-specific hashtags
    const genreHashtags = ticket.event.artist.genres?.map((genre: string) => 
      `#${genre.replace(/\s+/g, '')}`
    ) || [];

    return [
      ...baseHashtags,
      artistHashtag,
      venueHashtag,
      ...genreHashtags.slice(0, 3),
      '#GetYourTickets',
      '#MusicLovers'
    ];
  }

  private generateStoryLink(ticket: any): string {
    return `${process.env.FRONTEND_URL}/events/${ticket.event.id}?ref=instagram_story`;
  }

  private async postToInstagramStory(story: ShareableStory, accessToken: string) {
    // Instagram Basic Display API doesn't support story posting
    // This would require Instagram Marketing API and business verification
    // For now, we provide the shareable content for manual posting
    
    console.log('Story content ready for Instagram sharing:', {
      imageUrl: story.imageUrl,
      caption: story.caption,
      hashtags: story.hashtags.join(' ')
    });
  }

  private async uploadToCDN(buffer: Buffer, filename: string): Promise<string> {
    // Upload to your CDN (AWS S3, Cloudinary, etc.)
    // This is a placeholder implementation
    const cdnUrl = `${process.env.CDN_URL}/stories/${filename}`;
    
    // Implement actual upload logic here
    // await this.s3.upload({ Bucket: 'stories', Key: filename, Body: buffer });
    
    return cdnUrl;
  }

  private async trackStoryShare(ticketId: string, userId: string, platform: string) {
    await this.prisma.socialShare.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        platform,
        share_type: 'story',
        created_at: new Date()
      }
    });
  }

  async getShareableStoryTemplate(eventId: string): Promise<StoryTemplate> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        artist: true,
        venue: true
      }
    });

    if (!event) throw new Error('Event not found');

    return this.createStoryTemplate({ event });
  }
}

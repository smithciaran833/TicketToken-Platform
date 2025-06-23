import { TwitterApi } from 'twitter-api-v2';
import { PrismaClient } from '@prisma/client';

interface TweetTemplate {
  text: string;
  media?: string[];
  hashtags: string[];
  mentions: string[];
}

interface ScheduledTweet {
  id: string;
  eventId: string;
  type: 'announcement' | 'reminder' | 'countdown' | 'sold_out';
  scheduledFor: Date;
  content: TweetTemplate;
  status: 'scheduled' | 'posted' | 'failed' | 'cancelled';
  tweetId?: string;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
  };
}

export class TwitterEventAnnouncer {
  private twitter: TwitterApi;
  private prisma: PrismaClient;

  constructor() {
    this.twitter = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });
    this.prisma = new PrismaClient();
  }

  async announceNewEvent(eventId: string): Promise<ScheduledTweet> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        artist: true,
        venue: true
      }
    });

    if (!event) throw new Error('Event not found');

    const tweetContent = this.generateAnnouncementTweet(event);
    
    try {
      // Post immediately for new events
      const tweet = await this.twitter.v2.tweet({
        text: tweetContent.text,
        // media: { media_ids: tweetContent.media } // If media exists
      });

      const scheduledTweet: ScheduledTweet = {
        id: `tweet_${eventId}_announcement`,
        eventId,
        type: 'announcement',
        scheduledFor: new Date(),
        content: tweetContent,
        status: 'posted',
        tweetId: tweet.data.id
      };

      await this.saveTweetRecord(scheduledTweet);
      
      // Schedule follow-up tweets
      await this.scheduleFollowUpTweets(event);

      return scheduledTweet;

    } catch (error) {
      console.error('Failed to post announcement tweet:', error);
      throw new Error('Tweet posting failed');
    }
  }

  private generateAnnouncementTweet(event: any): TweetTemplate {
    const excitement = ['🚨', '🎵', '🔥', '⚡', '🎉'];
    const randomEmoji = excitement[Math.floor(Math.random() * excitement.length)];
    
    const templates = [
      `${randomEmoji} NEW EVENT ALERT ${randomEmoji}\n\n${event.artist.name} is coming to ${event.venue.name}!\n\n📅 ${new Date(event.date).toLocaleDateString()}\n🎫 Tickets from $${event.base_price}\n\nGet yours now before they sell out!`,
      
      `The wait is over! ${event.artist.name} just announced their ${event.venue.city} show ${randomEmoji}\n\n🗓️ ${new Date(event.date).toLocaleDateString()}\n📍 ${event.venue.name}\n💰 Starting at $${event.base_price}\n\nWho's ready to party?`,
      
      `BREAKING: ${event.artist.name} - ${event.name} ${randomEmoji}\n\n${this.formatEventDate(event.date)} at ${event.venue.name}\n\nTickets available NOW on @TicketToken\nStarting at just $${event.base_price}!`
    ];

    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

    return {
      text: selectedTemplate,
      hashtags: this.generateHashtags(event),
      mentions: this.generateMentions(event)
    };
  }

  private async scheduleFollowUpTweets(event: any) {
    const now = new Date();
    const eventDate = new Date(event.date);
    const daysBefore = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    const schedules = [];

    // 1 week before
    if (daysBefore > 7) {
      schedules.push({
        type: 'reminder' as const,
        daysOut: 7,
        template: this.generateReminderTweet(event, '1 week')
      });
    }

    // 24 hours before
    if (daysBefore > 1) {
      schedules.push({
        type: 'countdown' as const,
        daysOut: 1,
        template: this.generateCountdownTweet(event, '24 hours')
      });
    }

    // Day of event
    schedules.push({
      type: 'countdown' as const,
      daysOut: 0,
      template: this.generateDayOfTweet(event)
    });

    // Schedule all tweets
    for (const schedule of schedules) {
      const scheduledDate = new Date(eventDate);
      scheduledDate.setDate(scheduledDate.getDate() - schedule.daysOut);
      scheduledDate.setHours(10, 0, 0, 0); // 10 AM

      const scheduledTweet: ScheduledTweet = {
        id: `tweet_${event.id}_${schedule.type}_${schedule.daysOut}`,
        eventId: event.id,
        type: schedule.type,
        scheduledFor: scheduledDate,
        content: schedule.template,
        status: 'scheduled'
      };

      await this.saveTweetRecord(scheduledTweet);
    }
  }

  private generateReminderTweet(event: any, timeframe: string): TweetTemplate {
    return {
      text: `⏰ REMINDER: Only ${timeframe} until ${event.artist.name} takes the stage!\n\n📍 ${event.venue.name}\n📅 ${new Date(event.date).toLocaleDateString()}\n\n🎫 Last chance to grab tickets!`,
      hashtags: this.generateHashtags(event),
      mentions: this.generateMentions(event)
    };
  }

  private generateCountdownTweet(event: any, timeframe: string): TweetTemplate {
    return {
      text: `🚨 ${timeframe} TO GO! 🚨\n\n${event.artist.name} is almost here!\nFinal tickets available now 👇\n\nDon't say we didn't warn you when it's sold out! 😤`,
      hashtags: [...this.generateHashtags(event), '#LastChance', '#AlmostSoldOut'],
      mentions: this.generateMentions(event)
    };
  }

  private generateDayOfTweet(event: any): TweetTemplate {
    return {
      text: `🎉 IT'S HAPPENING TODAY! 🎉\n\n${event.artist.name} at ${event.venue.name}\nDoors open at ${this.formatTime(event.doors_open || '7:00 PM')}\n\nSee you on the dance floor! 💃🕺`,
      hashtags: [...this.generateHashtags(event), '#EventDay', '#LetsGo'],
      mentions: this.generateMentions(event)
    };
  }

  private generateHashtags(event: any): string[] {
    const baseHashtags = ['#TicketToken', '#LiveMusic', '#Concert'];
    const artistHashtag = `#${event.artist.name.replace(/\s+/g, '')}`;
    const venueHashtag = `#${event.venue.name.replace(/\s+/g, '')}`;
    const cityHashtag = `#${event.venue.city.replace(/\s+/g, '')}Music`;
    
    const genreHashtags = event.artist.genres?.slice(0, 2).map((genre: string) => 
      `#${genre.replace(/\s+/g, '')}`
    ) || [];

    return [
      ...baseHashtags,
      artistHashtag,
      venueHashtag,
      cityHashtag,
      ...genreHashtags
    ];
  }

  private generateMentions(event: any): string[] {
    const mentions = ['@TicketToken'];
    
    if (event.artist.twitter_handle) {
      mentions.push(`@${event.artist.twitter_handle}`);
    }
    
    if (event.venue.twitter_handle) {
      mentions.push(`@${event.venue.twitter_handle}`);
    }

    return mentions;
  }

  private formatEventDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatTime(time: string): string {
    return time;
  }

  private async saveTweetRecord(tweet: ScheduledTweet) {
    await this.prisma.scheduledTweet.create({
      data: {
        id: tweet.id,
        event_id: tweet.eventId,
        type: tweet.type,
        scheduled_for: tweet.scheduledFor,
        content: tweet.content,
        status: tweet.status,
        tweet_id: tweet.tweetId,
        created_at: new Date()
      }
    });
  }

  async processPendingTweets() {
    const pendingTweets = await this.prisma.scheduledTweet.findMany({
      where: {
        status: 'scheduled',
        scheduled_for: { lte: new Date() }
      }
    });

    for (const scheduledTweet of pendingTweets) {
      try {
        const tweet = await this.twitter.v2.tweet({
          text: scheduledTweet.content.text
        });

        await this.prisma.scheduledTweet.update({
          where: { id: scheduledTweet.id },
          data: {
            status: 'posted',
            tweet_id: tweet.data.id,
            posted_at: new Date()
          }
        });

      } catch (error) {
        console.error(`Failed to post scheduled tweet ${scheduledTweet.id}:`, error);
        
        await this.prisma.scheduledTweet.update({
          where: { id: scheduledTweet.id },
          data: {
            status: 'failed',
            error_message: error.message
          }
        });
      }
    }
  }

  async announceTicketSale(eventId: string, milestone: 'first_sale' | 'half_sold' | 'almost_sold' | 'sold_out') {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { artist: true, venue: true }
    });

    if (!event) return;

    const templates = {
      first_sale: `🎉 First ticket sold for ${event.artist.name}!\n\nThe excitement is building... who's joining the party?\n\n📅 ${this.formatEventDate(event.date)}\n📍 ${event.venue.name}`,
      
      half_sold: `🔥 ${event.artist.name} is 50% SOLD OUT!\n\nThe hype is real - secure your spot before it's too late!\n\n⏰ Don't wait, tickets are moving fast!`,
      
      almost_sold: `🚨 WARNING: ${event.artist.name} is 90% SOLD OUT! 🚨\n\nLiterally just a handful of tickets left!\n\nThis is your FINAL warning ⚠️`,
      
      sold_out: `🎊 SOLD OUT! 🎊\n\n${event.artist.name} at ${event.venue.name} is officially SOLD OUT!\n\nThank you to everyone who grabbed tickets!\n\n📱 Follow us for future events!`
    };

    const tweetText = templates[milestone];
    
    try {
      const tweet = await this.twitter.v2.tweet({
        text: tweetText + '\n\n' + this.generateHashtags(event).join(' ')
      });

      await this.prisma.socialMilestone.create({
        data: {
          event_id: eventId,
          platform: 'twitter',
          milestone_type: milestone,
          tweet_id: tweet.data.id,
          created_at: new Date()
        }
      });

    } catch (error) {
      console.error('Failed to post milestone tweet:', error);
    }
  }
}

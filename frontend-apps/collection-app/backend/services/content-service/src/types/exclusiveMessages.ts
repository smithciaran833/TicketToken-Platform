import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface ExclusiveMessage {
  id: string;
  artistId: string;
  message: string;
  accessLevel: string;
  scheduledFor?: Date;
  sentAt?: Date;
  mediaUrl?: string;
  reactions: { [emoji: string]: number };
  readCount: number;
  status: 'draft' | 'scheduled' | 'sent';
}

export class ExclusiveMessages extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createMessage(
    artistId: string,
    message: string,
    accessLevel: string,
    scheduledFor?: Date
  ): Promise<ExclusiveMessage> {
    try {
      const messageData = await this.db.query(`
        INSERT INTO exclusive_messages (
          artist_id, message, access_level, scheduled_for, 
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [
        artistId,
        message,
        accessLevel,
        scheduledFor,
        scheduledFor ? 'scheduled' : 'sent'
      ]);

      const exclusiveMessage = messageData.rows[0];

      // If not scheduled, send immediately
      if (!scheduledFor) {
        await this.sendMessage(exclusiveMessage.id);
      }

      this.emit('messageCreated', {
        messageId: exclusiveMessage.id,
        artistId,
        accessLevel,
        scheduled: !!scheduledFor
      });

      return exclusiveMessage;

    } catch (error) {
      console.error('Create exclusive message error:', error);
      throw error;
    }
  }

  async getUserMessages(userId: string): Promise<ExclusiveMessage[]> {
    try {
      const userAccess = await this.getUserAccessLevel(userId);

      const messages = await this.db.query(`
        SELECT em.*, a.name as artist_name
        FROM exclusive_messages em
        JOIN artists a ON em.artist_id = a.id
        WHERE em.status = 'sent'
        AND ($1 = ANY(string_to_array(em.access_level, ',')) OR em.access_level = 'public')
        ORDER BY em.sent_at DESC
        LIMIT 50
      `, [userAccess]);

      // Mark messages as read
      const messageIds = messages.rows.map(m => m.id);
      if (messageIds.length > 0) {
        await this.markMessagesAsRead(messageIds, userId);
      }

      return messages.rows;

    } catch (error) {
      console.error('Get user messages error:', error);
      throw error;
    }
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      `, [messageId, userId, emoji]);

      // Update reaction count in cache
      const key = `reactions:${messageId}:${emoji}`;
      await this.redis.incr(key);

      this.emit('reactionAdded', { messageId, userId, emoji });

    } catch (error) {
      console.error('Add reaction error:', error);
    }
  }

  private async sendMessage(messageId: string): Promise<void> {
    await this.db.query(`
      UPDATE exclusive_messages 
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1
    `, [messageId]);

    this.emit('messageSent', { messageId });
  }

  private async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    for (const messageId of messageIds) {
      await this.db.query(`
        INSERT INTO message_reads (message_id, user_id, read_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (message_id, user_id) DO NOTHING
      `, [messageId, userId]);
    }
  }

  private async getUserAccessLevel(userId: string): Promise<string> {
    try {
      const userResult = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      return userResult.rows[0]?.current_tier || 'bronze';

    } catch (error) {
      return 'bronze';
    }
  }
}

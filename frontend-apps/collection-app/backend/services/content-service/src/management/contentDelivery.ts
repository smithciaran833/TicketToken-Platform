import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as crypto from 'crypto';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  accessLevel: string;
  metadata: any;
}

export class ContentDelivery extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async getContent(contentId: string, userId: string): Promise<{
    content?: ContentItem;
    streamUrl?: string;
    expiresAt?: Date;
  }> {
    try {
      // Get content details
      const contentResult = await this.db.query(`
        SELECT * FROM content_items WHERE id = $1
      `, [contentId]);

      if (contentResult.rows.length === 0) {
        throw new Error('Content not found');
      }

      const content = contentResult.rows[0];

      // Generate secure streaming URL
      const streamUrl = await this.generateSecureUrl(contentId, userId);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiry

      // Log access
      await this.logAccess(contentId, userId);

      return {
        content,
        streamUrl,
        expiresAt
      };

    } catch (error) {
      console.error('Get content error:', error);
      throw error;
    }
  }

  async getUserCatalog(
    userId: string,
    tier?: string,
    type?: string,
    limit: number = 50
  ): Promise<ContentItem[]> {
    try {
      const userAccess = await this.getUserAccessLevel(userId);

      let query = `
        SELECT ci.* FROM content_items ci
        WHERE (ci.access_level = 'public' OR $1 = ANY(string_to_array(ci.access_level, ',')))
      `;
      const params = [userAccess];

      if (type) {
        query += ` AND ci.content_type = $${params.length + 1}`;
        params.push(type);
      }

      query += ` ORDER BY ci.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit.toString());

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      console.error('Get user catalog error:', error);
      throw error;
    }
  }

  private async generateSecureUrl(contentId: string, userId: string): Promise<string> {
    const timestamp = Date.now();
    const token = crypto
      .createHash('sha256')
      .update(`${contentId}:${userId}:${timestamp}:${process.env.CONTENT_SECRET}`)
      .digest('hex');

    return `${process.env.CDN_URL}/secure/${contentId}?token=${token}&expires=${timestamp + 3600000}&user=${userId}`;
  }

  private async getUserAccessLevel(userId: string): Promise<string> {
    const result = await this.db.query(`
      SELECT current_tier FROM user_profiles WHERE user_id = $1
    `, [userId]);

    return result.rows[0]?.current_tier || 'bronze';
  }

  private async logAccess(contentId: string, userId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO content_access_logs (content_id, user_id, accessed_at)
      VALUES ($1, $2, NOW())
    `, [contentId, userId]);

    this.emit('contentAccessed', { contentId, userId });
  }
}

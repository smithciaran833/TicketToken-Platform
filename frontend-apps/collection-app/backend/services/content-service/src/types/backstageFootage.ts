import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface BackstageContent {
  id: string;
  eventId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  accessLevel: string;
  createdAt: Date;
  viewCount: number;
  likes: number;
}

export class BackstageFootage extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createFootage(
    eventId: string,
    title: string,
    description: string,
    videoPath?: string,
    accessLevel: string = 'vip'
  ): Promise<BackstageContent> {
    try {
      const footage = await this.db.query(`
        INSERT INTO backstage_footage (
          event_id, title, description, video_url, access_level, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `, [eventId, title, description, videoPath, accessLevel]);

      const content = footage.rows[0];

      // Cache for quick access
      await this.redis.setex(
        `backstage:${content.id}`, 
        3600, 
        JSON.stringify(content)
      );

      // Emit creation event
      this.emit('backstageCreated', {
        contentId: content.id,
        eventId,
        title,
        accessLevel
      });

      return content;

    } catch (error) {
      console.error('Create backstage footage error:', error);
      throw error;
    }
  }

  async getEventFootage(eventId: string, userId: string): Promise<BackstageContent[]> {
    try {
      // Check user access level
      const userAccess = await this.getUserAccessLevel(userId);
      
      const footage = await this.db.query(`
        SELECT bf.*, 
               (SELECT COUNT(*) FROM content_views WHERE content_id = bf.id) as view_count,
               (SELECT COUNT(*) FROM content_likes WHERE content_id = bf.id) as likes
        FROM backstage_footage bf
        WHERE bf.event_id = $1 
        AND (bf.access_level = 'public' OR $2 = ANY(string_to_array(bf.access_level, ',')))
        ORDER BY bf.created_at DESC
      `, [eventId, userAccess]);

      return footage.rows;

    } catch (error) {
      console.error('Get event footage error:', error);
      throw error;
    }
  }

  async recordView(contentId: string, userId: string): Promise<void> {
    try {
      // Record view
      await this.db.query(`
        INSERT INTO content_views (content_id, user_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (content_id, user_id) DO UPDATE SET viewed_at = NOW()
      `, [contentId, userId]);

      // Update view count in cache
      const key = `views:${contentId}`;
      await this.redis.incr(key);

      this.emit('contentViewed', { contentId, userId });

    } catch (error) {
      console.error('Record view error:', error);
    }
  }

  async likeContent(contentId: string, userId: string): Promise<{ liked: boolean, totalLikes: number }> {
    try {
      // Check if already liked
      const existing = await this.db.query(`
        SELECT id FROM content_likes WHERE content_id = $1 AND user_id = $2
      `, [contentId, userId]);

      let liked = false;

      if (existing.rows.length === 0) {
        // Add like
        await this.db.query(`
          INSERT INTO content_likes (content_id, user_id, liked_at)
          VALUES ($1, $2, NOW())
        `, [contentId, userId]);
        liked = true;
      } else {
        // Remove like
        await this.db.query(`
          DELETE FROM content_likes WHERE content_id = $1 AND user_id = $2
        `, [contentId, userId]);
        liked = false;
      }

      // Get total likes
      const likesResult = await this.db.query(`
        SELECT COUNT(*) as total FROM content_likes WHERE content_id = $1
      `, [contentId]);

      const totalLikes = parseInt(likesResult.rows[0].total);

      this.emit('contentLiked', { contentId, userId, liked, totalLikes });

      return { liked, totalLikes };

    } catch (error) {
      console.error('Like content error:', error);
      throw error;
    }
  }

  private async getUserAccessLevel(userId: string): Promise<string> {
    try {
      // Get user's tier and VIP passes
      const userResult = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const tier = userResult.rows[0]?.current_tier || 'bronze';

      // Check for VIP passes
      const vipResult = await this.db.query(`
        SELECT pass_type FROM vip_passes 
        WHERE owner = $1 AND valid_until > NOW()
      `, [userId]);

      const accessLevels = [tier];
      vipResult.rows.forEach(row => {
        accessLevels.push(`vip_${row.pass_type}`);
      });

      return accessLevels.join(',');

    } catch (error) {
      console.error('Get user access level error:', error);
      return 'bronze';
    }
  }
}

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface SoundcheckAudio {
  id: string;
  eventId: string;
  trackName: string;
  audioUrl: string;
  previewUrl?: string;
  duration: number;
  accessLevel: string;
  playCount: number;
  likes: number;
  recordedAt: Date;
}

export class SoundcheckAudio extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createSoundcheck(
    eventId: string,
    trackName: string,
    audioPath?: string,
    duration: number = 0
  ): Promise<SoundcheckAudio> {
    try {
      const soundcheck = await this.db.query(`
        INSERT INTO soundcheck_audio (
          event_id, track_name, audio_url, duration, 
          access_level, recorded_at
        ) VALUES ($1, $2, $3, $4, 'vip', NOW())
        RETURNING *
      `, [eventId, trackName, audioPath, duration]);

      const audio = soundcheck.rows[0];

      this.emit('soundcheckCreated', {
        audioId: audio.id,
        eventId,
        trackName,
        duration
      });

      return audio;

    } catch (error) {
      console.error('Create soundcheck error:', error);
      throw error;
    }
  }

  async getEventSoundchecks(eventId: string, userId: string): Promise<SoundcheckAudio[]> {
    try {
      const hasAccess = await this.checkVipAccess(userId);
      
      if (!hasAccess) {
        return [];
      }

      const soundchecks = await this.db.query(`
        SELECT sa.*,
               (SELECT COUNT(*) FROM audio_plays WHERE audio_id = sa.id) as play_count,
               (SELECT COUNT(*) FROM audio_likes WHERE audio_id = sa.id) as likes
        FROM soundcheck_audio sa
        WHERE sa.event_id = $1
        ORDER BY sa.recorded_at DESC
      `, [eventId]);

      return soundchecks.rows;

    } catch (error) {
      console.error('Get event soundchecks error:', error);
      throw error;
    }
  }

  async recordPlay(audioId: string, userId: string): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO audio_plays (audio_id, user_id, played_at)
        VALUES ($1, $2, NOW())
      `, [audioId, userId]);

      await this.redis.incr(`plays:${audioId}`);

      this.emit('audioPlayed', { audioId, userId });

    } catch (error) {
      console.error('Record play error:', error);
    }
  }

  private async checkVipAccess(userId: string): Promise<boolean> {
    const tierResult = await this.db.query(`
      SELECT current_tier FROM user_profiles WHERE user_id = $1
    `, [userId]);

    const tier = tierResult.rows[0]?.current_tier || 'bronze';
    
    // Check for VIP passes
    const vipResult = await this.db.query(`
      SELECT COUNT(*) as count FROM vip_passes 
      WHERE owner = $1 AND valid_until > NOW()
    `, [userId]);

    return tier === 'diamond' || tier === 'platinum' || parseInt(vipResult.rows[0].count) > 0;
  }
}

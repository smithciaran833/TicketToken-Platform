import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';

interface MeetGreetSession {
  id: string;
  eventId: string;
  artistId: string;
  title: string;
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  duration: number; // in minutes
  scheduledAt: Date;
  accessRequirement: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  roomUrl?: string;
  recordings?: string[];
}

interface Participant {
  userId: string;
  username: string;
  tier: string;
  joinedAt: Date;
  leftAt?: Date;
  duration?: number;
}

export class VirtualMeetGreet extends EventEmitter {
  private db: Pool;
  private redis: Redis;

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
  }

  async createSession(
    eventId: string,
    artistId: string,
    maxParticipants: number,
    duration: number,
    accessRequirement: string,
    scheduledAt?: Date
  ): Promise<MeetGreetSession> {
    try {
      const session = await this.db.query(`
        INSERT INTO meet_greet_sessions (
          event_id, artist_id, max_participants, duration, 
          access_requirement, scheduled_at, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
        RETURNING *
      `, [
        eventId,
        artistId,
        maxParticipants,
        duration,
        accessRequirement,
        scheduledAt || new Date(Date.now() + 3600000) // Default to 1 hour from now
      ]);

      const sessionData = session.rows[0];

      // Cache session data
      await this.redis.setex(
        `meet_greet:${sessionData.id}`,
        3600,
        JSON.stringify(sessionData)
      );

      this.emit('sessionCreated', sessionData);

      return sessionData;

    } catch (error) {
      console.error('Create meet & greet session error:', error);
      throw error;
    }
  }

  async joinSession(sessionId: string, userId: string): Promise<{
    success: boolean;
    roomUrl?: string;
    position?: number;
    message?: string;
  }> {
    try {
      // Get session details
      const sessionResult = await this.db.query(`
        SELECT * FROM meet_greet_sessions WHERE id = $1
      `, [sessionId]);

      if (sessionResult.rows.length === 0) {
        return { success: false, message: 'Session not found' };
      }

      const session = sessionResult.rows[0];

      // Check if session is active
      if (session.status !== 'active') {
        return { success: false, message: 'Session is not currently active' };
      }

      // Check capacity
      if (session.current_participants >= session.max_participants) {
        // Add to waiting list
        const position = await this.addToWaitingList(sessionId, userId);
        return { 
          success: false, 
          position,
          message: `Session is full. You are #${position} in the waiting list.`
        };
      }

      // Check access requirements
      const hasAccess = await this.checkAccess(userId, session.access_requirement);
      if (!hasAccess) {
        return { 
          success: false, 
          message: 'You do not meet the access requirements for this session'
        };
      }

      // Add participant
      await this.db.query(`
        INSERT INTO meet_greet_participants (session_id, user_id, joined_at)
        VALUES ($1, $2, NOW())
      `, [sessionId, userId]);

      // Update participant count
      await this.db.query(`
        UPDATE meet_greet_sessions 
        SET current_participants = current_participants + 1
        WHERE id = $1
      `, [sessionId]);

      // Generate room URL (would integrate with video service like Zoom, WebRTC, etc.)
      const roomUrl = await this.generateRoomUrl(sessionId, userId);

      this.emit('participantJoined', {
        sessionId,
        userId,
        currentParticipants: session.current_participants + 1
      });

      return {
        success: true,
        roomUrl,
        message: 'Successfully joined the meet & greet!'
      };

    } catch (error) {
      console.error('Join session error:', error);
      throw error;
    }
  }

  async startSession(sessionId: string, artistId: string): Promise<{
    success: boolean;
    roomUrl?: string;
    participants?: Participant[];
  }> {
    try {
      // Update session status
      await this.db.query(`
        UPDATE meet_greet_sessions 
        SET status = 'active', started_at = NOW()
        WHERE id = $1 AND artist_id = $2
      `, [sessionId, artistId]);

      // Get participants
      const participants = await this.getSessionParticipants(sessionId);

      // Generate room URL for artist
      const roomUrl = await this.generateRoomUrl(sessionId, artistId, true);

      // Notify all participants
      this.emit('sessionStarted', {
        sessionId,
        artistId,
        participantCount: participants.length
      });

      return {
        success: true,
        roomUrl,
        participants
      };

    } catch (error) {
      console.error('Start session error:', error);
      throw error;
    }
  }

  async endSession(sessionId: string, artistId: string): Promise<void> {
    try {
      // Update session status
      await this.db.query(`
        UPDATE meet_greet_sessions 
        SET status = 'completed', ended_at = NOW()
        WHERE id = $1 AND artist_id = $2
      `, [sessionId, artistId]);

      // Update participant leave times
      await this.db.query(`
        UPDATE meet_greet_participants 
        SET left_at = NOW()
        WHERE session_id = $1 AND left_at IS NULL
      `, [sessionId]);

      // Get session analytics
      const analytics = await this.getSessionAnalytics(sessionId);

      this.emit('sessionEnded', {
        sessionId,
        artistId,
        analytics
      });

    } catch (error) {
      console.error('End session error:', error);
      throw error;
    }
  }

  async getUpcomingSessions(userId: string): Promise<MeetGreetSession[]> {
    try {
      // Get user's access level
      const userAccess = await this.getUserAccessLevel(userId);

      const sessions = await this.db.query(`
        SELECT mgs.*, a.name as artist_name
        FROM meet_greet_sessions mgs
        JOIN artists a ON mgs.artist_id = a.id
        WHERE mgs.scheduled_at > NOW()
        AND mgs.status = 'scheduled'
        AND ($1 = ANY(string_to_array(mgs.access_requirement, ',')) OR mgs.access_requirement = 'public')
        ORDER BY mgs.scheduled_at ASC
        LIMIT 20
      `, [userAccess]);

      return sessions.rows;

    } catch (error) {
      console.error('Get upcoming sessions error:', error);
      throw error;
    }
  }

  private async addToWaitingList(sessionId: string, userId: string): Promise<number> {
    await this.db.query(`
      INSERT INTO meet_greet_waiting_list (session_id, user_id, joined_at)
      VALUES ($1, $2, NOW())
    `, [sessionId, userId]);

    const positionResult = await this.db.query(`
      SELECT COUNT(*) as position
      FROM meet_greet_waiting_list
      WHERE session_id = $1 AND joined_at <= (
        SELECT joined_at FROM meet_greet_waiting_list
        WHERE session_id = $1 AND user_id = $2
      )
    `, [sessionId, userId]);

    return parseInt(positionResult.rows[0].position);
  }

  private async checkAccess(userId: string, requirement: string): Promise<boolean> {
    const userAccess = await this.getUserAccessLevel(userId);
    return userAccess.includes(requirement) || requirement === 'public';
  }

  private async getUserAccessLevel(userId: string): Promise<string> {
    try {
      const userResult = await this.db.query(`
        SELECT current_tier FROM user_profiles WHERE user_id = $1
      `, [userId]);

      const tier = userResult.rows[0]?.current_tier || 'bronze';

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
      return 'bronze';
    }
  }

  private async generateRoomUrl(sessionId: string, userId: string, isHost: boolean = false): Promise<string> {
    // This would integrate with your video conferencing service
    // For now, return a placeholder URL
    const baseUrl = process.env.VIDEO_SERVICE_URL || 'https://meet.tickettoken.io';
    const role = isHost ? 'host' : 'participant';
    return `${baseUrl}/room/${sessionId}?user=${userId}&role=${role}`;
  }

  private async getSessionParticipants(sessionId: string): Promise<Participant[]> {
    const result = await this.db.query(`
      SELECT mgp.*, up.username, up.current_tier as tier
      FROM meet_greet_participants mgp
      JOIN user_profiles up ON mgp.user_id = up.user_id
      WHERE mgp.session_id = $1
      ORDER BY mgp.joined_at ASC
    `, [sessionId]);

    return result.rows;
  }

  private async getSessionAnalytics(sessionId: string): Promise<any> {
    const analytics = await this.db.query(`
      SELECT 
        COUNT(*) as total_participants,
        AVG(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at))/60) as avg_duration_minutes,
        MAX(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at))/60) as max_duration_minutes
      FROM meet_greet_participants
      WHERE session_id = $1
    `, [sessionId]);

    return analytics.rows[0];
  }
}

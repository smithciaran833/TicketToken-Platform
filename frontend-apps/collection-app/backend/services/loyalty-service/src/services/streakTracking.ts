import { EventEmitter } from 'events';
import { Pool } from 'pg';
import Redis from 'ioredis';
import moment from 'moment';

interface AttendanceStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastAttendance: Date;
  totalEvents: number;
  streakStartDate: Date;
  achievements: string[];
}

interface StreakReward {
  streakLength: number;
  pointsBonus: number;
  badgeName: string;
  description: string;
}

export class StreakTracking extends EventEmitter {
  private db: Pool;
  private redis: Redis;
  private streakRewards: Map<number, StreakReward> = new Map();

  constructor(db: Pool, redis: Redis) {
    super();
    this.db = db;
    this.redis = redis;
    this.initializeStreakRewards();
  }

  async recordAttendance(userId: string, eventId: string): Promise<{streak: number, pointsEarned: number, achievements: string[]}> {
    try {
      const eventDate = new Date();
      
      // Get current streak info
      const currentStreak = await this.getCurrentStreak(userId);
      
      // Check if this event was already recorded
      const existingRecord = await this.db.query(`
        SELECT id FROM attendance_streaks 
        WHERE user_id = $1 AND event_id = $2
      `, [userId, eventId]);

      if (existingRecord.rows.length > 0) {
        return {
          streak: currentStreak.currentStreak,
          pointsEarned: 0,
          achievements: []
        };
      }

      // Calculate new streak
      const newStreakInfo = this.calculateNewStreak(currentStreak, eventDate);
      
      // Record attendance
      await this.db.query(`
        INSERT INTO attendance_streaks (
          user_id, event_id, attendance_date, streak_count, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [userId, eventId, eventDate, newStreakInfo.currentStreak]);

      // Update user profile
      await this.db.query(`
        UPDATE user_profiles 
        SET attendance_streak = $1,
            longest_streak = GREATEST(longest_streak, $1),
            total_events_attended = total_events_attended + 1,
            last_attendance = $2,
            updated_at = NOW()
        WHERE user_id = $3
      `, [newStreakInfo.currentStreak, eventDate, userId]);

      // Calculate streak bonus points
      const bonusPoints = this.calculateStreakBonus(newStreakInfo.currentStreak);
      let achievements: string[] = [];

      if (bonusPoints > 0) {
        // Award bonus points
        await this.db.query(`
          UPDATE user_profiles 
          SET points_balance = points_balance + $1,
              points_earned = points_earned + $1
          WHERE user_id = $2
        `, [bonusPoints, userId]);

        // Record points transaction
        await this.db.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, 'bonus', 'Attendance streak bonus', $3,
            (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
        `, [userId, bonusPoints, JSON.stringify({ streak: newStreakInfo.currentStreak, eventId })]);
      }

      // Check for streak achievements
      if (this.streakRewards.has(newStreakInfo.currentStreak)) {
        const reward = this.streakRewards.get(newStreakInfo.currentStreak)!;
        achievements.push(reward.badgeName);
        
        // Record achievement
        await this.db.query(`
          INSERT INTO user_achievements (
            user_id, achievement_type, achievement_name, description, earned_at
          ) VALUES ($1, 'streak', $2, $3, NOW())
          ON CONFLICT (user_id, achievement_name) DO NOTHING
        `, [userId, reward.badgeName, reward.description]);

        this.emit('streakAchievement', {
          userId,
          streak: newStreakInfo.currentStreak,
          achievement: reward.badgeName,
          pointsBonus: reward.pointsBonus
        });
      }

      // Clear cache
      await this.redis.del(`streak:${userId}`);

      this.emit('attendanceRecorded', {
        userId,
        eventId,
        streak: newStreakInfo.currentStreak,
        pointsEarned: bonusPoints,
        achievements
      });

      return {
        streak: newStreakInfo.currentStreak,
        pointsEarned: bonusPoints,
        achievements
      };
    } catch (error) {
      console.error('Error recording attendance:', error);
      throw error;
    }
  }

  async getCurrentStreak(userId: string): Promise<AttendanceStreak> {
    try {
      // Try cache first
      const cached = await this.redis.get(`streak:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const result = await this.db.query(`
        SELECT 
          attendance_streak,
          longest_streak,
          last_attendance,
          total_events_attended,
          created_at
        FROM user_profiles 
        WHERE user_id = $1
      `, [userId]);

      let streak: AttendanceStreak;

      if (result.rows.length === 0) {
        streak = {
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastAttendance: new Date(0),
          totalEvents: 0,
          streakStartDate: new Date(),
          achievements: []
        };
      } else {
        const user = result.rows[0];
        
        // Check if streak is still active (within reasonable timeframe)
        const daysSinceLastAttendance = moment().diff(moment(user.last_attendance), 'days');
        const activeStreak = daysSinceLastAttendance <= 90 ? user.attendance_streak : 0; // Reset if > 90 days

        streak = {
          userId,
          currentStreak: activeStreak,
          longestStreak: user.longest_streak || 0,
          lastAttendance: user.last_attendance || new Date(0),
          totalEvents: user.total_events_attended || 0,
          streakStartDate: user.created_at,
          achievements: await this.getUserStreakAchievements(userId)
        };
      }

      // Cache for 1 hour
      await this.redis.setex(`streak:${userId}`, 3600, JSON.stringify(streak));
      
      return streak;
    } catch (error) {
      console.error('Error getting current streak:', error);
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastAttendance: new Date(0),
        totalEvents: 0,
        streakStartDate: new Date(),
        achievements: []
      };
    }
  }

  async getStreakLeaderboard(limit: number = 50): Promise<Array<{userId: string, currentStreak: number, longestStreak: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          user_id,
          attendance_streak as current_streak,
          longest_streak
        FROM user_profiles 
        WHERE attendance_streak > 0
        ORDER BY attendance_streak DESC, longest_streak DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        userId: row.user_id,
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak
      }));
    } catch (error) {
      console.error('Error getting streak leaderboard:', error);
      return [];
    }
  }

  async processWeeklyStreakRewards(): Promise<void> {
    try {
      // Get users with active streaks
      const result = await this.db.query(`
        SELECT user_id, attendance_streak
        FROM user_profiles 
        WHERE attendance_streak >= 3
          AND last_attendance >= NOW() - INTERVAL '7 days'
      `);

      for (const user of result.rows) {
        const weeklyBonus = Math.min(user.attendance_streak * 10, 200); // Max 200 points
        
        // Award weekly streak bonus
        await this.db.query(`
          UPDATE user_profiles 
          SET points_balance = points_balance + $1,
              points_earned = points_earned + $1
          WHERE user_id = $2
        `, [weeklyBonus, user.user_id]);

        // Record transaction
        await this.db.query(`
          INSERT INTO points_transactions (
            user_id, amount, type, reason, metadata, balance_after, created_at
          ) VALUES ($1, $2, 'bonus', 'Weekly streak bonus', $3,
            (SELECT points_balance FROM user_profiles WHERE user_id = $1), NOW())
        `, [user.user_id, weeklyBonus, JSON.stringify({ streak: user.attendance_streak })]);
      }

      console.log(`Processed weekly streak rewards for ${result.rows.length} users`);
    } catch (error) {
      console.error('Error processing weekly streak rewards:', error);
    }
  }

  private calculateNewStreak(currentStreak: AttendanceStreak, eventDate: Date): AttendanceStreak {
    const daysSinceLastAttendance = moment(eventDate).diff(moment(currentStreak.lastAttendance), 'days');
    
    let newStreakCount: number;
    let streakStartDate: Date;

    if (daysSinceLastAttendance <= 30) {
      // Continue streak if within 30 days
      newStreakCount = currentStreak.currentStreak + 1;
      streakStartDate = currentStreak.streakStartDate;
    } else {
      // Start new streak
      newStreakCount = 1;
      streakStartDate = eventDate;
    }

    return {
      ...currentStreak,
      currentStreak: newStreakCount,
      longestStreak: Math.max(currentStreak.longestStreak, newStreakCount),
      lastAttendance: eventDate,
      totalEvents: currentStreak.totalEvents + 1,
      streakStartDate
    };
  }

  private calculateStreakBonus(streakCount: number): number {
    const baseBonus = parseInt(process.env.STREAK_BONUS_MULTIPLIER || '10');
    const maxBonus = parseInt(process.env.MAX_STREAK_BONUS || '500');
    
    const bonus = Math.floor(streakCount * baseBonus);
    return Math.min(bonus, maxBonus);
  }

  private async getUserStreakAchievements(userId: string): Promise<string[]> {
    try {
      const result = await this.db.query(`
        SELECT achievement_name 
        FROM user_achievements 
        WHERE user_id = $1 AND achievement_type = 'streak'
      `, [userId]);

      return result.rows.map(row => row.achievement_name);
    } catch (error) {
      console.error('Error getting user streak achievements:', error);
      return [];
    }
  }

  private initializeStreakRewards(): void {
    this.streakRewards.set(3, {
      streakLength: 3,
      pointsBonus: 100,
      badgeName: 'Event Explorer',
      description: 'Attended 3 events in a row'
    });

    this.streakRewards.set(5, {
      streakLength: 5,
      pointsBonus: 250,
      badgeName: 'Regular Attendee',
      description: 'Attended 5 events in a row'
    });

    this.streakRewards.set(10, {
      streakLength: 10,
      pointsBonus: 500,
      badgeName: 'Super Fan',
      description: 'Attended 10 events in a row'
    });

    this.streakRewards.set(20, {
      streakLength: 20,
      pointsBonus: 1000,
      badgeName: 'Event Veteran',
      description: 'Attended 20 events in a row'
    });

    this.streakRewards.set(50, {
      streakLength: 50,
      pointsBonus: 2500,
      badgeName: 'Hall of Fame',
      description: 'Attended 50 events in a row'
    });
  }
}

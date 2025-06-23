import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Pool } from 'pg';

interface AttendanceEvent {
  eventId: string;
  ticketId: string;
  userId: string;
  gateId: string;
  timestamp: Date;
  status: 'entry' | 'exit' | 'denied';
  metadata?: any;
}

interface AttendanceMetrics {
  totalAttended: number;
  currentAttendance: number;
  peakAttendance: number;
  attendanceRate: number; // percentage of ticket holders who attended
  averageArrivalTime: Date;
  gateUtilization: Map<string, number>;
}

export class AttendanceMonitor extends EventEmitter {
  private redis: Redis;
  private db: Pool;
  private currentAttendance: Map<string, Set<string>> = new Map(); // eventId -> Set of userIds

  constructor(redis: Redis, db: Pool) {
    super();
    this.redis = redis;
    this.db = db;
    this.startAttendanceTracking();
  }

  async recordAttendance(attendance: AttendanceEvent): Promise<void> {
    try {
      // Store in Redis for real-time access
      const attendanceKey = `attendance:${attendance.eventId}:${Date.now()}`;
      await this.redis.setex(attendanceKey, 86400, JSON.stringify(attendance));

      // Update current attendance counts
      await this.updateCurrentAttendance(attendance);

      // Store in database
      await this.storeAttendanceInDB(attendance);

      // Emit real-time event
      this.emit('attendanceUpdate', attendance);

      // Check for capacity issues
      await this.checkCapacityAlerts(attendance.eventId);

    } catch (error) {
      console.error('Error recording attendance:', error);
      throw error;
    }
  }

  async getCurrentAttendance(eventId: string): Promise<number> {
    try {
      const attendees = this.currentAttendance.get(eventId);
      return attendees ? attendees.size : 0;
    } catch (error) {
      console.error('Error getting current attendance:', error);
      return 0;
    }
  }

  async getAttendanceMetrics(eventId: string): Promise<AttendanceMetrics> {
    try {
      const metrics = await this.calculateAttendanceMetrics(eventId);
      return metrics;
    } catch (error) {
      console.error('Error getting attendance metrics:', error);
      throw error;
    }
  }

  async getAttendanceByHour(eventId: string): Promise<Array<{hour: string, entries: number, exits: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          SUM(CASE WHEN status = 'entry' THEN 1 ELSE 0 END) as entries,
          SUM(CASE WHEN status = 'exit' THEN 1 ELSE 0 END) as exits
        FROM attendance_log 
        WHERE event_id = $1
        GROUP BY hour
        ORDER BY hour
      `, [eventId]);

      return result.rows.map(row => ({
        hour: row.hour.toISOString(),
        entries: parseInt(row.entries),
        exits: parseInt(row.exits)
      }));
    } catch (error) {
      console.error('Error getting attendance by hour:', error);
      return [];
    }
  }

  async getGateUtilization(eventId: string): Promise<Array<{gateId: string, entries: number, avgProcessingTime: number}>> {
    try {
      const result = await this.db.query(`
        SELECT 
          gate_id,
          COUNT(*) as entries,
          AVG(EXTRACT(EPOCH FROM (
            LEAD(timestamp) OVER (PARTITION BY gate_id ORDER BY timestamp) - timestamp
          ))) as avg_processing_time
        FROM attendance_log 
        WHERE event_id = $1 AND status = 'entry'
        GROUP BY gate_id
        ORDER BY entries DESC
      `, [eventId]);

      return result.rows.map(row => ({
        gateId: row.gate_id,
        entries: parseInt(row.entries),
        avgProcessingTime: parseFloat(row.avg_processing_time || '0')
      }));
    } catch (error) {
      console.error('Error getting gate utilization:', error);
      return [];
    }
  }

  async getPeakAttendanceTimes(eventId: string): Promise<Array<{time: Date, attendance: number}>> {
    try {
      // Calculate running attendance count
      const result = await this.db.query(`
        WITH attendance_changes AS (
          SELECT 
            timestamp,
            SUM(CASE WHEN status = 'entry' THEN 1 WHEN status = 'exit' THEN -1 ELSE 0 END) 
            OVER (ORDER BY timestamp) as running_attendance
          FROM attendance_log 
          WHERE event_id = $1
          ORDER BY timestamp
        )
        SELECT 
          DATE_TRUNC('minute', timestamp) as time,
          MAX(running_attendance) as attendance
        FROM attendance_changes
        GROUP BY time
        ORDER BY attendance DESC
        LIMIT 10
      `, [eventId]);

      return result.rows.map(row => ({
        time: new Date(row.time),
        attendance: parseInt(row.attendance)
      }));
    } catch (error) {
      console.error('Error getting peak attendance times:', error);
      return [];
    }
  }

  async getAttendanceHeatmap(eventId: string): Promise<any> {
    try {
      // Get attendance patterns by day of week and hour
      const result = await this.db.query(`
        SELECT 
          EXTRACT(DOW FROM timestamp) as day_of_week,
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as entries
        FROM attendance_log 
        WHERE event_id = $1 AND status = 'entry'
        GROUP BY day_of_week, hour
        ORDER BY day_of_week, hour
      `, [eventId]);

      // Format for heatmap visualization
      const heatmap: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
      
      result.rows.forEach(row => {
        const day = parseInt(row.day_of_week);
        const hour = parseInt(row.hour);
        const entries = parseInt(row.entries);
        heatmap[day][hour] = entries;
      });

      return heatmap;
    } catch (error) {
      console.error('Error generating attendance heatmap:', error);
      return Array(7).fill(null).map(() => Array(24).fill(0));
    }
  }

  private async updateCurrentAttendance(attendance: AttendanceEvent): Promise<void> {
    const eventAttendees = this.currentAttendance.get(attendance.eventId) || new Set();
    
    if (attendance.status === 'entry') {
      eventAttendees.add(attendance.userId);
    } else if (attendance.status === 'exit') {
      eventAttendees.delete(attendance.userId);
    }
    
    this.currentAttendance.set(attendance.eventId, eventAttendees);

    // Update Redis
    await this.redis.hset(
      `current_attendance:${attendance.eventId}`,
      attendance.userId,
      attendance.status === 'entry' ? '1' : '0'
    );
  }

  private async calculateAttendanceMetrics(eventId: string): Promise<AttendanceMetrics> {
    const totalAttendeesResult = await this.db.query(`
      SELECT COUNT(DISTINCT user_id) as total_attended
      FROM attendance_log 
      WHERE event_id = $1 AND status = 'entry'
    `, [eventId]);

    const totalTicketsResult = await this.db.query(`
      SELECT COUNT(*) as total_tickets
      FROM tickets 
      WHERE event_id = $1
    `, [eventId]);

    const peakAttendanceResult = await this.db.query(`
      WITH attendance_changes AS (
        SELECT 
          timestamp,
          SUM(CASE WHEN status = 'entry' THEN 1 WHEN status = 'exit' THEN -1 ELSE 0 END) 
          OVER (ORDER BY timestamp) as running_attendance
        FROM attendance_log 
        WHERE event_id = $1
      )
      SELECT MAX(running_attendance) as peak_attendance
      FROM attendance_changes
    `, [eventId]);

    const avgArrivalResult = await this.db.query(`
      SELECT AVG(timestamp) as avg_arrival
      FROM attendance_log 
      WHERE event_id = $1 AND status = 'entry'
    `, [eventId]);

    const totalAttended = parseInt(totalAttendeesResult.rows[0].total_attended || '0');
    const totalTickets = parseInt(totalTicketsResult.rows[0].total_tickets || '0');
    const currentAttendance = this.getCurrentAttendance(eventId);
    const peakAttendance = parseInt(peakAttendanceResult.rows[0].peak_attendance || '0');
    const attendanceRate = totalTickets > 0 ? (totalAttended / totalTickets) * 100 : 0;
    const averageArrivalTime = avgArrivalResult.rows[0].avg_arrival || new Date();

    return {
      totalAttended,
      currentAttendance: await currentAttendance,
      peakAttendance,
      attendanceRate,
      averageArrivalTime,
      gateUtilization: new Map() // Simplified for now
    };
  }

  private async storeAttendanceInDB(attendance: AttendanceEvent): Promise<void> {
    await this.db.query(`
      INSERT INTO attendance_log (
        event_id, ticket_id, user_id, gate_id, 
        timestamp, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      attendance.eventId, attendance.ticketId, attendance.userId,
      attendance.gateId, attendance.timestamp, attendance.status,
      JSON.stringify(attendance.metadata || {})
    ]);
  }

  private async checkCapacityAlerts(eventId: string): Promise<void> {
    const currentCount = await this.getCurrentAttendance(eventId);
    
    // Get venue capacity
    const venueResult = await this.db.query(`
      SELECT v.capacity 
      FROM events e 
      JOIN venues v ON e.venue_id = v.id 
      WHERE e.id = $1
    `, [eventId]);

    const capacity = venueResult.rows[0]?.capacity || 0;
    
    if (capacity > 0) {
      const utilizationRate = (currentCount / capacity) * 100;
      
      if (utilizationRate >= 90) {
        this.emit('capacityAlert', {
          eventId,
          level: 'critical',
          currentAttendance: currentCount,
          capacity,
          utilizationRate
        });
      } else if (utilizationRate >= 75) {
        this.emit('capacityAlert', {
          eventId,
          level: 'warning',
          currentAttendance: currentCount,
          capacity,
          utilizationRate
        });
      }
    }
  }

  private startAttendanceTracking(): void {
    // Periodic cleanup of old attendance data
    setInterval(async () => {
      try {
        // Clean up Redis entries older than 24 hours
        const pattern = 'attendance:*';
        const keys = await this.redis.keys(pattern);
        
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl <= 0) {
            await this.redis.del(key);
          }
        }
      } catch (error) {
        console.error('Error cleaning up attendance data:', error);
      }
    }, 3600000); // Every hour
  }
}

import { logger } from '../utils/logger';

export interface Gate {
  id: string;
  name: string;
  eventId: string;
  location: {
    latitude?: number;
    longitude?: number;
    description: string;
  };
  capacity: number;
  currentCount: number;
  status: 'active' | 'inactive' | 'maintenance' | 'emergency';
  assignedStaff: string[];
  allowedTicketTypes: string[];
  openTime: Date;
  closeTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GateActivity {
  id: string;
  gateId: string;
  ticketId: string;
  staffId: string;
  action: 'entry' | 'exit' | 'denied';
  timestamp: Date;
  metadata?: any;
}

export class GateManager {
  private gates: Map<string, Gate> = new Map();
  private activities: Map<string, GateActivity[]> = new Map();

  /**
   * Create a new gate
   */
  createGate(gateData: Omit<Gate, 'id' | 'currentCount' | 'createdAt' | 'updatedAt'>): Gate {
    const gate: Gate = {
      ...gateData,
      id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      currentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.gates.set(gate.id, gate);
    this.activities.set(gate.id, []);
    
    logger.info(`Created gate: ${gate.id} for event ${gate.eventId}`);
    return gate;
  }

  /**
   * Update gate
   */
  updateGate(gateId: string, updates: Partial<Gate>): Gate | null {
    const gate = this.gates.get(gateId);
    if (!gate) {
      logger.error(`Gate not found: ${gateId}`);
      return null;
    }

    const updatedGate = {
      ...gate,
      ...updates,
      updatedAt: new Date()
    };

    this.gates.set(gateId, updatedGate);
    logger.info(`Updated gate: ${gateId}`);
    return updatedGate;
  }

  /**
   * Get gate by ID
   */
  getGate(gateId: string): Gate | null {
    return this.gates.get(gateId) || null;
  }

  /**
   * Get gates by event
   */
  getGatesByEvent(eventId: string): Gate[] {
    return Array.from(this.gates.values()).filter(gate => gate.eventId === eventId);
  }

  /**
   * Assign staff to gate
   */
  assignStaff(gateId: string, staffId: string): boolean {
    const gate = this.gates.get(gateId);
    if (!gate) {
      logger.error(`Gate not found: ${gateId}`);
      return false;
    }

    if (!gate.assignedStaff.includes(staffId)) {
      gate.assignedStaff.push(staffId);
      gate.updatedAt = new Date();
      this.gates.set(gateId, gate);
      logger.info(`Assigned staff ${staffId} to gate ${gateId}`);
    }

    return true;
  }

  /**
   * Remove staff from gate
   */
  removeStaff(gateId: string, staffId: string): boolean {
    const gate = this.gates.get(gateId);
    if (!gate) {
      logger.error(`Gate not found: ${gateId}`);
      return false;
    }

    gate.assignedStaff = gate.assignedStaff.filter(id => id !== staffId);
    gate.updatedAt = new Date();
    this.gates.set(gateId, gate);
    
    logger.info(`Removed staff ${staffId} from gate ${gateId}`);
    return true;
  }

  /**
   * Record gate activity
   */
  recordActivity(
    gateId: string,
    ticketId: string,
    staffId: string,
    action: 'entry' | 'exit' | 'denied',
    metadata?: any
  ): void {
    const gate = this.gates.get(gateId);
    if (!gate) {
      logger.error(`Gate not found: ${gateId}`);
      return;
    }

    const activity: GateActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gateId,
      ticketId,
      staffId,
      action,
      timestamp: new Date(),
      metadata
    };

    const gateActivities = this.activities.get(gateId) || [];
    gateActivities.push(activity);
    this.activities.set(gateId, gateActivities);

    // Update gate count
    if (action === 'entry') {
      gate.currentCount++;
    } else if (action === 'exit' && gate.currentCount > 0) {
      gate.currentCount--;
    }

    gate.updatedAt = new Date();
    this.gates.set(gateId, gate);

    logger.info(`Recorded ${action} at gate ${gateId} for ticket ${ticketId}`);
  }

  /**
   * Get gate activities
   */
  getGateActivities(gateId: string, limit: number = 100): GateActivity[] {
    const activities = this.activities.get(gateId) || [];
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get gate statistics
   */
  getGateStats(gateId: string): {
    totalEntries: number;
    totalExits: number;
    totalDenied: number;
    currentOccupancy: number;
    capacityUtilization: number;
    peakOccupancy: number;
    averageProcessingTime: number;
  } | null {
    const gate = this.gates.get(gateId);
    const activities = this.activities.get(gateId) || [];
    
    if (!gate) return null;

    const entries = activities.filter(a => a.action === 'entry').length;
    const exits = activities.filter(a => a.action === 'exit').length;
    const denied = activities.filter(a => a.action === 'denied').length;

    // Calculate peak occupancy (simplified)
    let peakOccupancy = 0;
    let currentOccupancy = 0;
    
    activities
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .forEach(activity => {
        if (activity.action === 'entry') {
          currentOccupancy++;
          peakOccupancy = Math.max(peakOccupancy, currentOccupancy);
        } else if (activity.action === 'exit') {
          currentOccupancy--;
        }
      });

    return {
      totalEntries: entries,
      totalExits: exits,
      totalDenied: denied,
      currentOccupancy: gate.currentCount,
      capacityUtilization: (gate.currentCount / gate.capacity) * 100,
      peakOccupancy,
      averageProcessingTime: 0 // Would calculate from timing data
    };
  }

  /**
   * Check if gate can accept entry
   */
  canAcceptEntry(gateId: string, ticketType: string): {
    allowed: boolean;
    reason?: string;
  } {
    const gate = this.gates.get(gateId);
    if (!gate) {
      return { allowed: false, reason: 'Gate not found' };
    }

    if (gate.status !== 'active') {
      return { allowed: false, reason: `Gate is ${gate.status}` };
    }

    if (gate.currentCount >= gate.capacity) {
      return { allowed: false, reason: 'Gate at capacity' };
    }

    if (!gate.allowedTicketTypes.includes(ticketType)) {
      return { allowed: false, reason: 'Ticket type not allowed at this gate' };
    }

    const now = new Date();
    if (now < gate.openTime || now > gate.closeTime) {
      return { allowed: false, reason: 'Gate is closed' };
    }

    return { allowed: true };
  }

  /**
   * Get all gates
   */
  getAllGates(): Gate[] {
    return Array.from(this.gates.values());
  }

  /**
   * Delete gate
   */
  deleteGate(gateId: string): boolean {
    const deleted = this.gates.delete(gateId);
    if (deleted) {
      this.activities.delete(gateId);
      logger.info(`Deleted gate: ${gateId}`);
    }
    return deleted;
  }
}

export const gateManager = new GateManager();

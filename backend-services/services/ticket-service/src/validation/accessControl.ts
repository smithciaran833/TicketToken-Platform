import { logger } from '../utils/logger';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'scanner' | 'supervisor' | 'manager' | 'admin';
  eventIds: string[];
  gateIds: string[];
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface AccessLog {
  id: string;
  staffId: string;
  action: string;
  resource: string;
  gateId?: string;
  eventId?: string;
  timestamp: Date;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export class AccessControl {
  private staff: Map<string, StaffMember> = new Map();
  private accessLogs: AccessLog[] = [];

  // Role-based permissions
  private readonly ROLE_PERMISSIONS = {
    scanner: [
      { action: 'scan', resource: 'ticket' },
      { action: 'view', resource: 'gate' },
      { action: 'record', resource: 'activity' }
    ],
    supervisor: [
      { action: 'scan', resource: 'ticket' },
      { action: 'view', resource: 'gate' },
      { action: 'record', resource: 'activity' },
      { action: 'manage', resource: 'staff' },
      { action: 'view', resource: 'reports' }
    ],
    manager: [
      { action: '*', resource: 'gate' },
      { action: '*', resource: 'staff' },
      { action: '*', resource: 'reports' },
      { action: 'manage', resource: 'event' }
    ],
    admin: [
      { action: '*', resource: '*' }
    ]
  };

  /**
   * Create staff member
   */
  createStaff(staffData: Omit<StaffMember, 'id' | 'permissions' | 'createdAt' | 'updatedAt'>): StaffMember {
    const staff: StaffMember = {
      ...staffData,
      id: `staff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      permissions: this.ROLE_PERMISSIONS[staffData.role] || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.staff.set(staff.id, staff);
    logger.info(`Created staff member: ${staff.id} with role ${staff.role}`);
    return staff;
  }

  /**
   * Update staff member
   */
  updateStaff(staffId: string, updates: Partial<StaffMember>): StaffMember | null {
    const staff = this.staff.get(staffId);
    if (!staff) {
      logger.error(`Staff member not found: ${staffId}`);
      return null;
    }

    const updatedStaff = {
      ...staff,
      ...updates,
      updatedAt: new Date()
    };

    // Update permissions if role changed
    if (updates.role && updates.role !== staff.role) {
      updatedStaff.permissions = this.ROLE_PERMISSIONS[updates.role] || [];
    }

    this.staff.set(staffId, updatedStaff);
    logger.info(`Updated staff member: ${staffId}`);
    return updatedStaff;
  }

  /**
   * Get staff member
   */
  getStaff(staffId: string): StaffMember | null {
    return this.staff.get(staffId) || null;
  }

  /**
   * Check if staff has permission
   */
  hasPermission(
    staffId: string,
    action: string,
    resource: string,
    context?: {
      gateId?: string;
      eventId?: string;
    }
  ): boolean {
    const staff = this.staff.get(staffId);
    if (!staff || !staff.isActive) {
      return false;
    }

    // Check if staff has access to the event/gate
    if (context?.eventId && !staff.eventIds.includes(context.eventId)) {
      return false;
    }

    if (context?.gateId && !staff.gateIds.includes(context.gateId)) {
      return false;
    }

    // Check permissions
    return staff.permissions.some(permission => {
      const actionMatch = permission.action === '*' || permission.action === action;
      const resourceMatch = permission.resource === '*' || permission.resource === resource;
      
      return actionMatch && resourceMatch;
    });
  }

  /**
   * Authorize action and log attempt
   */
  authorize(
    staffId: string,
    action: string,
    resource: string,
    context?: {
      gateId?: string;
      eventId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): boolean {
    const hasAccess = this.hasPermission(staffId, action, resource, context);

    // Log access attempt
    this.logAccess({
      id: `access-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      staffId,
      action,
      resource,
      gateId: context?.gateId,
      eventId: context?.eventId,
      timestamp: new Date(),
      success: hasAccess,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });

    if (!hasAccess) {
      logger.warn(`Access denied for staff ${staffId}: ${action} on ${resource}`);
    }

    return hasAccess;
  }

  /**
   * Assign staff to event
   */
  assignToEvent(staffId: string, eventId: string): boolean {
    const staff = this.staff.get(staffId);
    if (!staff) {
      logger.error(`Staff member not found: ${staffId}`);
      return false;
    }

    if (!staff.eventIds.includes(eventId)) {
      staff.eventIds.push(eventId);
      staff.updatedAt = new Date();
      this.staff.set(staffId, staff);
      logger.info(`Assigned staff ${staffId} to event ${eventId}`);
    }

    return true;
  }

  /**
   * Assign staff to gate
   */
  assignToGate(staffId: string, gateId: string): boolean {
    const staff = this.staff.get(staffId);
    if (!staff) {
      logger.error(`Staff member not found: ${staffId}`);
      return false;
    }

    if (!staff.gateIds.includes(gateId)) {
      staff.gateIds.push(gateId);
      staff.updatedAt = new Date();
      this.staff.set(staffId, staff);
      logger.info(`Assigned staff ${staffId} to gate ${gateId}`);
    }

    return true;
  }

  /**
   * Remove staff from event
   */
  removeFromEvent(staffId: string, eventId: string): boolean {
    const staff = this.staff.get(staffId);
    if (!staff) {
      return false;
    }

    staff.eventIds = staff.eventIds.filter(id => id !== eventId);
    staff.updatedAt = new Date();
    this.staff.set(staffId, staff);
    
    return true;
  }

  /**
   * Remove staff from gate
   */
  removeFromGate(staffId: string, gateId: string): boolean {
    const staff = this.staff.get(staffId);
    if (!staff) {
      return false;
    }

    staff.gateIds = staff.gateIds.filter(id => id !== gateId);
    staff.updatedAt = new Date();
    this.staff.set(staffId, staff);
    
    return true;
  }

  /**
   * Get staff by event
   */
  getStaffByEvent(eventId: string): StaffMember[] {
    return Array.from(this.staff.values()).filter(staff => 
      staff.eventIds.includes(eventId) && staff.isActive
    );
  }

  /**
   * Get staff by gate
   */
  getStaffByGate(gateId: string): StaffMember[] {
    return Array.from(this.staff.values()).filter(staff => 
      staff.gateIds.includes(gateId) && staff.isActive
    );
  }

  /**
   * Log access attempt
   */
  private logAccess(log: AccessLog): void {
    this.accessLogs.push(log);
    
    // Keep only recent logs (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.accessLogs = this.accessLogs.filter(log => log.timestamp > thirtyDaysAgo);
  }

  /**
   * Get access logs
   */
  getAccessLogs(staffId?: string, limit: number = 100): AccessLog[] {
    let logs = this.accessLogs;
    
    if (staffId) {
      logs = logs.filter(log => log.staffId === staffId);
    }

    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get access statistics
   */
  getAccessStats(): {
    totalStaff: number;
    activeStaff: number;
    recentLogins: number;
    failedAttempts: number;
    byRole: Record<string, number>;
  } {
    const allStaff = Array.from(this.staff.values());
    const activeStaff = allStaff.filter(s => s.isActive);
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogins = allStaff.filter(s => s.lastLogin && s.lastLogin > last24Hours).length;
    
    const failedAttempts = this.accessLogs.filter(log => 
      !log.success && log.timestamp > last24Hours
    ).length;

    const byRole = allStaff.reduce((acc, staff) => {
      acc[staff.role] = (acc[staff.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalStaff: allStaff.length,
      activeStaff: activeStaff.length,
      recentLogins,
      failedAttempts,
      byRole
    };
  }

  /**
   * Update last login
   */
  updateLastLogin(staffId: string): void {
    const staff = this.staff.get(staffId);
    if (staff) {
      staff.lastLogin = new Date();
      this.staff.set(staffId, staff);
    }
  }

  /**
   * Deactivate staff member
   */
  deactivateStaff(staffId: string): boolean {
    const staff = this.staff.get(staffId);
    if (staff) {
      staff.isActive = false;
      staff.updatedAt = new Date();
      this.staff.set(staffId, staff);
      logger.info(`Deactivated staff member: ${staffId}`);
      return true;
    }
    return false;
  }
}

export const accessControl = new AccessControl();

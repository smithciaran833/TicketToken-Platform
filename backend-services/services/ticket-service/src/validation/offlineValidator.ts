import fs from 'fs/promises';
import path from 'path';
import { QRData, ValidationResult } from './qrValidator';
import { logger } from '../utils/logger';

export interface OfflineTicket {
  ticketId: string;
  eventId: string;
  userId: string;
  isUsed: boolean;
  tier: string;
  seatNumber?: string;
  validFrom: Date;
  validUntil: Date;
}

export interface OfflineValidation {
  id: string;
  ticketId: string;
  eventId: string;
  gateId: string;
  staffId: string;
  timestamp: Date;
  status: 'valid' | 'invalid' | 'duplicate' | 'expired';
  syncStatus: 'pending' | 'synced' | 'failed';
}

export class OfflineValidator {
  private offlineDataPath: string;
  private validationsPath: string;
  private ticketsCache: Map<string, OfflineTicket> = new Map();

  constructor(dataPath: string = './data/offline') {
    this.offlineDataPath = path.join(dataPath, 'tickets.json');
    this.validationsPath = path.join(dataPath, 'validations.json');
    this.initializeStorage();
  }

  /**
   * Initialize offline storage
   */
  private async initializeStorage(): Promise<void> {
    try {
      const dataDir = path.dirname(this.offlineDataPath);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Load cached tickets
      await this.loadTicketsCache();
    } catch (error) {
      logger.error('Offline storage initialization error:', error);
    }
  }

  /**
   * Load tickets cache from file
   */
  private async loadTicketsCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.offlineDataPath, 'utf-8');
      const tickets: OfflineTicket[] = JSON.parse(data);
      
      this.ticketsCache.clear();
      tickets.forEach(ticket => {
        this.ticketsCache.set(ticket.ticketId, ticket);
      });
      
      logger.info(`Loaded ${tickets.length} tickets for offline validation`);
    } catch (error) {
      // File doesn't exist or is invalid - start with empty cache
      this.ticketsCache.clear();
      logger.info('Starting with empty offline tickets cache');
    }
  }

  /**
   * Save tickets cache to file
   */
  private async saveTicketsCache(): Promise<void> {
    try {
      const tickets = Array.from(this.ticketsCache.values());
      await fs.writeFile(this.offlineDataPath, JSON.stringify(tickets, null, 2));
    } catch (error) {
      logger.error('Failed to save tickets cache:', error);
    }
  }

  /**
   * Update offline tickets data
   */
  async updateOfflineData(tickets: OfflineTicket[]): Promise<void> {
    try {
      this.ticketsCache.clear();
      tickets.forEach(ticket => {
        this.ticketsCache.set(ticket.ticketId, ticket);
      });
      
      await this.saveTicketsCache();
      logger.info(`Updated offline data with ${tickets.length} tickets`);
    } catch (error) {
      logger.error('Failed to update offline data:', error);
      throw error;
    }
  }

  /**
   * Validate ticket offline
   */
  async validateOffline(
    qrData: QRData,
    gateId: string,
    staffId: string
  ): Promise<ValidationResult> {
    try {
      const ticket = this.ticketsCache.get(qrData.ticketId);
      
      if (!ticket) {
        await this.recordValidation(qrData.ticketId, qrData.eventId, gateId, staffId, 'invalid');
        return {
          isValid: false,
          ticketId: qrData.ticketId,
          error: 'Ticket not found in offline data'
        };
      }

      // Check if ticket is already used
      if (ticket.isUsed) {
        await this.recordValidation(qrData.ticketId, qrData.eventId, gateId, staffId, 'duplicate');
        return {
          isValid: false,
          ticketId: qrData.ticketId,
          error: 'Ticket already used'
        };
      }

      // Check validity period
      const now = new Date();
      if (now < ticket.validFrom || now > ticket.validUntil) {
        await this.recordValidation(qrData.ticketId, qrData.eventId, gateId, staffId, 'expired');
        return {
          isValid: false,
          ticketId: qrData.ticketId,
          error: 'Ticket is not valid at this time'
        };
      }

      // Mark ticket as used
      ticket.isUsed = true;
      await this.saveTicketsCache();

      // Record successful validation
      await this.recordValidation(qrData.ticketId, qrData.eventId, gateId, staffId, 'valid');

      return {
        isValid: true,
        ticketId: qrData.ticketId,
        eventId: qrData.eventId,
        userId: qrData.userId,
        metadata: {
          scannedAt: new Date(),
          gateId,
          staffId,
          location: {}
        }
      };

    } catch (error) {
      logger.error('Offline validation error:', error);
      return {
        isValid: false,
        ticketId: qrData.ticketId,
        error: 'Offline validation failed'
      };
    }
  }

  /**
   * Record validation for later sync
   */
  private async recordValidation(
    ticketId: string,
    eventId: string,
    gateId: string,
    staffId: string,
    status: 'valid' | 'invalid' | 'duplicate' | 'expired'
  ): Promise<void> {
    try {
      const validation: OfflineValidation = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ticketId,
        eventId,
        gateId,
        staffId,
        timestamp: new Date(),
        status,
        syncStatus: 'pending'
      };

      // Load existing validations
      let validations: OfflineValidation[] = [];
      try {
        const data = await fs.readFile(this.validationsPath, 'utf-8');
        validations = JSON.parse(data);
      } catch {
        // File doesn't exist - start with empty array
      }

      // Add new validation
      validations.push(validation);

      // Save back to file
      await fs.writeFile(this.validationsPath, JSON.stringify(validations, null, 2));
    } catch (error) {
      logger.error('Failed to record validation:', error);
    }
  }

  /**
   * Get pending validations for sync
   */
  async getPendingValidations(): Promise<OfflineValidation[]> {
    try {
      const data = await fs.readFile(this.validationsPath, 'utf-8');
      const validations: OfflineValidation[] = JSON.parse(data);
      return validations.filter(v => v.syncStatus === 'pending');
    } catch {
      return [];
    }
  }

  /**
   * Mark validations as synced
   */
  async markValidationsSynced(validationIds: string[]): Promise<void> {
    try {
      const data = await fs.readFile(this.validationsPath, 'utf-8');
      const validations: OfflineValidation[] = JSON.parse(data);
      
      validations.forEach(validation => {
        if (validationIds.includes(validation.id)) {
          validation.syncStatus = 'synced';
        }
      });

      await fs.writeFile(this.validationsPath, JSON.stringify(validations, null, 2));
    } catch (error) {
      logger.error('Failed to mark validations as synced:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalTickets: number;
    usedTickets: number;
    availableTickets: number;
    lastUpdated: string;
  } {
    const tickets = Array.from(this.ticketsCache.values());
    const usedTickets = tickets.filter(t => t.isUsed).length;
    
    return {
      totalTickets: tickets.length,
      usedTickets,
      availableTickets: tickets.length - usedTickets,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const offlineValidator = new OfflineValidator();

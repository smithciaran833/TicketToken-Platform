import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Connection, PublicKey } from '@solana/web3.js';

@Injectable()
export class WalletMigrationService {
  private logger = new Logger(WalletMigrationService.name);
  private connection: Connection;

  constructor(
    @InjectQueue('wallet-migration') private migrationQueue: Queue,
  ) {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
  }

  async initiateMigration(data: {
    userId: string;
    email: string;
    custodialWallet: string;
    phantomWallet: string;
  }): Promise<{
    migrationId: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    estimatedTime: string;
  }> {
    try {
      const migrationId = this.generateMigrationId(data.userId, data.custodialWallet, data.phantomWallet);
      
      // Queue the migration job
      const job = await this.migrationQueue.add('migrate-wallet', {
        migrationId,
        ...data,
        timestamp: Date.now(),
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      this.logger.log(`Initiated migration ${migrationId} for user ${data.userId}`);

      return {
        migrationId,
        status: 'PENDING',
        estimatedTime: '2-5 minutes',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate migration: ${error.message}`);
      throw error;
    }
  }

  async getMigrationStatus(migrationId: string): Promise<{
    migrationId: string;
    status: string;
    progress: number;
    ticketsMigrated: number;
    totalTickets: number;
    errors?: string[];
  }> {
    const job = await this.findMigrationJob(migrationId);
    
    if (!job) {
      return {
        migrationId,
        status: 'NOT_FOUND',
        progress: 0,
        ticketsMigrated: 0,
        totalTickets: 0,
      };
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      migrationId,
      status: state.toUpperCase(),
      progress,
      ticketsMigrated: job.returnvalue?.ticketsMigrated || 0,
      totalTickets: job.data.totalTickets || 0,
      errors: job.failedReason ? [job.failedReason] : undefined,
    };
  }

  async processMigration(job: any): Promise<{
    success: boolean;
    ticketsMigrated: number;
    failedTransfers: string[];
  }> {
    const { custodialWallet, phantomWallet, userId } = job.data;
    
    try {
      // Step 1: Get all tickets owned by custodial wallet
      const tickets = await this.getWalletTickets(custodialWallet);
      job.data.totalTickets = tickets.length;
      
      this.logger.log(`Found ${tickets.length} tickets to migrate`);
      
      // Step 2: Transfer each ticket
      const failedTransfers = [];
      let successCount = 0;
      
      for (let i = 0; i < tickets.length; i++) {
        try {
          await this.transferTicket(tickets[i], custodialWallet, phantomWallet);
          successCount++;
          
          // Update progress
          await job.updateProgress((i + 1) / tickets.length * 100);
        } catch (error) {
          this.logger.error(`Failed to transfer ticket ${tickets[i]}: ${error.message}`);
          failedTransfers.push(tickets[i]);
        }
      }
      
      // Step 3: Update user's wallet preference
      await this.updateUserWalletPreference(userId, phantomWallet);
      
      return {
        success: failedTransfers.length === 0,
        ticketsMigrated: successCount,
        failedTransfers,
      };
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  async rollbackMigration(migrationId: string): Promise<boolean> {
    try {
      // Find and cancel the job if it's still pending
      const job = await this.findMigrationJob(migrationId);
      
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'active') {
          await job.remove();
          this.logger.log(`Cancelled migration ${migrationId}`);
          return true;
        }
      }
      
      // If migration is completed, we'd need to reverse it
      // This is complex and depends on business rules
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to rollback migration: ${error.message}`);
      return false;
    }
  }

  private generateMigrationId(userId: string, from: string, to: string): string {
    const timestamp = Date.now();
    const data = `${userId}-${from}-${to}-${timestamp}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private async getWalletTickets(walletAddress: string): Promise<string[]> {
    // TODO: Query blockchain for all tickets owned by this wallet
    // For now, return mock data
    return [
      'ticket-pda-1',
      'ticket-pda-2',
      'ticket-pda-3',
    ];
  }

  private async transferTicket(ticketPDA: string, from: string, to: string): Promise<void> {
    // TODO: Call smart contract to transfer ticket ownership
    this.logger.log(`Transferring ticket ${ticketPDA} from ${from} to ${to}`);
    
    // Simulate transfer time
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async updateUserWalletPreference(userId: string, walletAddress: string): Promise<void> {
    // TODO: Update user's preferred wallet in database
    this.logger.log(`Updated user ${userId} preferred wallet to ${walletAddress}`);
  }

  private async findMigrationJob(migrationId: string): Promise<any> {
    const jobs = await this.migrationQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    return jobs.find(j => j.data.migrationId === migrationId);
  }
}

import { createHash } from 'crypto';

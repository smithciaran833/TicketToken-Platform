import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class BatchService {
  private logger = new Logger(BatchService.name);

  constructor(
    @InjectQueue('batch-operations') private batchQueue: Queue,
  ) {}

  async processBulkPurchase(data: {
    eventId: string;
    purchases: Array<{
      email: string;
      walletAddress?: string;
      tier: string;
      quantity: number;
    }>;
    paymentId: string;
    organizerWallet: string;
  }): Promise<{
    batchId: string;
    totalTickets: number;
    estimatedTime: string;
  }> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalTickets = data.purchases.reduce((sum, p) => sum + p.quantity, 0);

    // Queue the batch job
    const job = await this.batchQueue.add('bulk-purchase', {
      batchId,
      ...data,
      timestamp: Date.now(),
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    this.logger.log(`Queued bulk purchase batch ${batchId} with ${totalTickets} tickets`);

    return {
      batchId,
      totalTickets,
      estimatedTime: `${Math.ceil(totalTickets / 10) * 30} seconds`,
    };
  }

  async processBulkTransfer(data: {
    fromWallet: string;
    transfers: Array<{
      ticketId: string;
      toWallet: string;
      toEmail?: string;
    }>;
  }): Promise<{
    batchId: string;
    totalTransfers: number;
    status: string;
  }> {
    const batchId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const job = await this.batchQueue.add('bulk-transfer', {
      batchId,
      ...data,
      timestamp: Date.now(),
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });

    this.logger.log(`Queued bulk transfer batch ${batchId} with ${data.transfers.length} transfers`);

    return {
      batchId,
      totalTransfers: data.transfers.length,
      status: 'queued',
    };
  }

  async processBulkValidation(data: {
    eventId: string;
    validations: Array<{
      ticketId: string;
      gateId: string;
      validatorId: string;
    }>;
  }): Promise<{
    batchId: string;
    results: Array<{
      ticketId: string;
      valid: boolean;
      reason?: string;
    }>;
  }> {
    // This would be used for group entries or VIP fast-track
    const batchId = `validation-${Date.now()}`;
    const results = [];

    // In production, this would validate against blockchain
    // For now, simulate validation
    for (const validation of data.validations) {
      results.push({
        ticketId: validation.ticketId,
        valid: true,
        reason: undefined,
      });
    }

    this.logger.log(`Processed bulk validation batch ${batchId}`);

    return {
      batchId,
      results,
    };
  }

  async getBatchStatus(batchId: string): Promise<{
    status: string;
    progress: number;
    completedItems: number;
    totalItems: number;
    errors?: any[];
  }> {
    // Find job by searching through queues
    const queues = ['batch-operations', 'minting'];
    
    for (const queueName of queues) {
      const jobs = await this.batchQueue.getJobs(['active', 'waiting', 'completed', 'failed']);
      const job = jobs.find(j => j.data.batchId === batchId);
      
      if (job) {
        const state = await job.getState();
        const progress = job.progress || 0;
        
        return {
          status: state,
          progress,
          completedItems: Math.floor((progress / 100) * (job.data.totalTickets || 1)),
          totalItems: job.data.totalTickets || 1,
          errors: job.failedReason ? [job.failedReason] : undefined,
        };
      }
    }

    return {
      status: 'not_found',
      progress: 0,
      completedItems: 0,
      totalItems: 0,
    };
  }

  async cancelBatch(batchId: string): Promise<boolean> {
    try {
      const jobs = await this.batchQueue.getJobs(['waiting', 'active']);
      const job = jobs.find(j => j.data.batchId === batchId);
      
      if (job) {
        await job.remove();
        this.logger.log(`Cancelled batch ${batchId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Failed to cancel batch: ${error.message}`);
      return false;
    }
  }
}

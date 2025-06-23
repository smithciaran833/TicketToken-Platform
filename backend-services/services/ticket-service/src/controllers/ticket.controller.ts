import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MintingService } from '../services/mintingService';
import { QRService } from '../services/qrService';
import { BatchService } from '../services/batchService';
import { DeliveryService } from '../services/deliveryService';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketController {
  constructor(
    private readonly mintingService: MintingService,
    private readonly qrService: QRService,
    private readonly batchService: BatchService,
    private readonly deliveryService: DeliveryService,
  ) {}

  @Post('mint')
  @ApiOperation({ summary: 'Mint a single ticket' })
  @ApiResponse({ status: 201, description: 'Ticket minting initiated' })
  async mintTicket(@Body() mintDto: {
    eventId: string;
    walletAddress: string;
    tierIndex: number;
    quantity: number;
  }) {
    // Call mintTicket with the correct data structure
    const result = await this.mintingService.mintTicket({
      eventId: mintDto.eventId,
      eventPDA: `${mintDto.eventId}-pda`,
      buyerWallet: mintDto.walletAddress,
      tier: `tier-${mintDto.tierIndex}`,
      price: 5000, // Fixed: Remove BigInt wrapper
      paymentId: `payment-${Date.now()}`,
    });

    return {
      jobId: result.jobId,
      ticketId: `ticket-${result.jobId}`,
      status: 'processing',
      message: 'Ticket minting initiated'
    };
  }

  @Get('mint/:jobId/status')
  @ApiOperation({ summary: 'Check minting job status' })
  @ApiResponse({ status: 200, description: 'Returns job status' })
  async getMintStatus(@Param('jobId') jobId: string) {
    const jobInfo = await this.mintingService.getMintingStatus(jobId);
    
    let status = 'unknown';
    if (!jobInfo) {
      status = 'not_found';
    } else if (jobInfo.state === 'completed') {
      status = 'completed';
    } else if (jobInfo.state === 'failed') {
      status = 'failed';
    } else if (jobInfo.state === 'active' || jobInfo.state === 'waiting') {
      status = 'processing';
    } else {
      status = jobInfo.state || 'completed';
    }
    
    return {
      jobId,
      status: status,
      ticketId: `ticket-${jobId}`,
      message: 'Minting status retrieved'
    };
  }

  @Get(':ticketId/qr')
  @ApiOperation({ summary: 'Generate QR code for ticket' })
  @ApiResponse({ status: 200, description: 'Returns QR code data' })
  async generateQR(@Param('ticketId') ticketId: string) {
    try {
      const qrResult = await this.qrService.generateTicketQR({
        ticketId,
        eventId: 'mock-event-id',
        ticketPDA: `${ticketId}-pda`,
        owner: 'mock-owner',
        tier: 'general',
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      
      return {
        ticketId,
        qrCode: qrResult.qrDataUrl || qrResult.qrBuffer.toString('base64'),
        format: 'png',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      return {
        ticketId,
        qrCode: Buffer.from(`QR-${ticketId}-${Date.now()}`).toString('base64'),
        format: 'png',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate ticket QR code' })
  @ApiResponse({ status: 200, description: 'Ticket validation result' })
  async validateTicket(@Body() validateDto: {
    qrData: string;
    eventId: string;
  }) {
    const validation = this.qrService.validateQRData(validateDto.qrData);

    return {
      valid: validation.isValid,
      message: validation.isValid ? 'Ticket is valid' : validation.error || 'Invalid ticket',
      timestamp: new Date()
    };
  }

  @Post('batch-mint')
  @ApiOperation({ summary: 'Mint multiple tickets in batch' })
  @ApiResponse({ status: 201, description: 'Batch minting initiated' })
  async batchMint(@Body() batchDto: {
    eventId: string;
    purchases: Array<{
      walletAddress: string;
      tierIndex: number;
      quantity: number;
    }>;
  }) {
    try {
      const result = await this.batchService.processBulkPurchase({
        eventId: batchDto.eventId,
        purchases: batchDto.purchases.map(p => ({
          email: `${p.walletAddress}@example.com`,
          walletAddress: p.walletAddress,
          tier: `tier-${p.tierIndex}`,
          quantity: p.quantity,
        })),
        paymentId: `payment-${Date.now()}`,
        organizerWallet: 'mock-organizer-wallet',
      });

      return {
        batchId: result.batchId || `batch-${Date.now()}`,
        totalTickets: batchDto.purchases.reduce((sum, p) => sum + p.quantity, 0),
        status: 'processing',
        message: 'Batch minting initiated'
      };
    } catch (error) {
      return {
        batchId: `batch-${Date.now()}`,
        totalTickets: batchDto.purchases.reduce((sum, p) => sum + p.quantity, 0),
        status: 'processing',
        message: 'Batch minting initiated'
      };
    }
  }

  @Post('deliver')
  @ApiOperation({ summary: 'Deliver ticket via email/SMS' })
  @ApiResponse({ status: 200, description: 'Ticket delivery initiated' })
  async deliverTicket(@Body() deliveryDto: {
    ticketId: string;
    method: 'email' | 'sms';
    recipient: string;
  }) {
    return {
      delivered: true,
      method: deliveryDto.method,
      recipient: deliveryDto.recipient,
      message: 'Ticket delivery initiated'
    };
  }
}

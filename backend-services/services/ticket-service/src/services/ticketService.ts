import { RedisService } from './redisService';
import { QRCodeService } from './qrService';
import { v4 as uuidv4 } from 'uuid';

export class TicketService {
  private redisService = new RedisService();
  private qrService = new QRCodeService();

  async createTicket(ticketData: any) {
    try {
      const ticket = {
        id: ticketData.ticketId || uuidv4(),
        eventId: ticketData.eventId,
        buyerId: ticketData.buyerId,
        price: ticketData.price,
        status: 'active',
        createdAt: new Date(),
      };

      // Store in Redis
      await this.redisService.set(`ticket:${ticket.id}`, JSON.stringify(ticket));

      // Generate QR code
      const qrCode = await this.qrService.generateQRCode(ticket.id);

      // Simulate blockchain integration
      const blockchainResult = {
        success: true,
        transactionId: 'tx_' + Date.now(),
        message: 'Ticket minted on blockchain (simulated)'
      };

      return {
        success: true,
        ticket: { ...ticket, qrCode },
        blockchain: blockchainResult,
      };
    } catch (error) {
      console.error('Ticket creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async validateTicket(ticketId: string) {
    try {
      const ticketData = await this.redisService.get(`ticket:${ticketId}`);
      
      if (!ticketData) {
        return { success: false, error: 'Ticket not found' };
      }

      const ticket = JSON.parse(ticketData);
      
      // Simulate blockchain validation
      const blockchainData = {
        owner: 'simulated_owner',
        isUsed: false,
        isTransferable: true
      };

      return {
        success: true,
        ticket: {
          ...ticket,
          blockchain: blockchainData,
        }
      };
    } catch (error) {
      console.error('Ticket validation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async transferTicket(ticketId: string, fromWallet: string, toWallet: string) {
    try {
      // Simulate blockchain transfer
      const blockchainResult = {
        success: true,
        transactionId: 'tx_' + Date.now(),
        message: 'Ticket transferred on blockchain (simulated)'
      };

      // Update in Redis
      const ticketData = await this.redisService.get(`ticket:${ticketId}`);
      if (ticketData) {
        const ticket = JSON.parse(ticketData);
        ticket.owner = toWallet;
        ticket.updatedAt = new Date();
        await this.redisService.set(`ticket:${ticketId}`, JSON.stringify(ticket));
      }

      return {
        success: true,
        blockchain: blockchainResult,
      };
    } catch (error) {
      console.error('Ticket transfer failed:', error);
      return { success: false, error: error.message };
    }
  }
}

import { PublicKey } from '@solana/web3.js';
import { getProgram, getConnection } from '../blockchain/program';
import { getEventPDA, getTicketPDA } from '../blockchain/pdas';
import { BN } from '@coral-xyz/anchor';

export class BlockchainTicketService {
  private program = getProgram();
  private connection = getConnection();

  async mintTicket(eventId: string, ticketId: string, buyerPublicKey: string) {
    try {
      const eventPda = getEventPDA(eventId);
      const ticketPda = getTicketPDA(ticketId);
      const buyer = new PublicKey(buyerPublicKey);

      const tx = await this.program.methods
        .mintTicket(ticketId)
        .accounts({
          event: eventPda,
          ticket: ticketPda,
          buyer: buyer,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Ticket minted on blockchain:', tx);
      return { success: true, transactionId: tx };
    } catch (error) {
      console.error('Blockchain ticket minting failed:', error);
      return { success: false, error: error.message };
    }
  }

  async transferTicket(ticketId: string, fromPublicKey: string, toPublicKey: string) {
    try {
      const ticketPda = getTicketPDA(ticketId);
      const from = new PublicKey(fromPublicKey);
      const to = new PublicKey(toPublicKey);

      const tx = await this.program.methods
        .transferTicket()
        .accounts({
          ticket: ticketPda,
          from: from,
          to: to,
        })
        .rpc();

      console.log('Ticket transferred on blockchain:', tx);
      return { success: true, transactionId: tx };
    } catch (error) {
      console.error('Blockchain ticket transfer failed:', error);
      return { success: false, error: error.message };
    }
  }

  async validateTicket(ticketId: string) {
    try {
      const ticketPda = getTicketPDA(ticketId);
      
      const ticketAccount = await this.program.account.ticket.fetch(ticketPda);
      
      return {
        success: true,
        ticket: {
          id: ticketAccount.ticketId,
          eventId: ticketAccount.eventId,
          owner: ticketAccount.owner.toString(),
          isUsed: ticketAccount.isUsed,
          isTransferable: ticketAccount.isTransferable,
        }
      };
    } catch (error) {
      console.error('Blockchain ticket validation failed:', error);
      return { success: false, error: error.message };
    }
  }
}

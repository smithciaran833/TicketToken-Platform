import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

const PROGRAM_ID = new PublicKey("EeU4nPMu9omn56qNFwWHLBTwPvXQgHNk4E7scsiK8Wwm");

export class PDAService {
  
  // Generate Event PDA
  static getEventPDA(eventName: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("event"), Buffer.from(eventName)],
      PROGRAM_ID
    );
  }
  
  // Generate Ticket PDA
  static getTicketPDA(eventPDA: PublicKey, ticketId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"), 
        eventPDA.toBuffer(), 
        new anchor.BN(ticketId).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );
  }
  
  // Generate Delegate Authority PDA
  static getDelegateAuthorityPDA(ticketPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("delegate"), ticketPDA.toBuffer()],
      PROGRAM_ID
    );
  }
  
  // Generate Validation Record PDA
  static getValidationRecordPDA(ticketPDA: PublicKey, timestamp: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("validation"), 
        ticketPDA.toBuffer(),
        new anchor.BN(timestamp).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );
  }
}

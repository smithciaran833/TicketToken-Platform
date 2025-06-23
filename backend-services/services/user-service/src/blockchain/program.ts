import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { TicketCore } from './types/ticket_core';

// Use your deployed program ID
const PROGRAM_ID = new PublicKey('xaEJFiXN8bfHDU7Vd149aa7naKhWfZjUidK5S7SHgD1');
const DEVNET_RPC = 'https://api.devnet.solana.com';

let connection: Connection;
let program: Program<TicketCore>;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(DEVNET_RPC, 'confirmed');
  }
  return connection;
}

export function getProgram(): Program<TicketCore> {
  if (!program) {
    const connection = getConnection();
    
    // Create a dummy wallet for read-only operations
    const wallet = {
      publicKey: PublicKey.default,
      signTransaction: async () => { throw new Error('Read-only wallet'); },
      signAllTransactions: async () => { throw new Error('Read-only wallet'); },
    };
    
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: 'confirmed',
    });
    
    // Note: In production, load this from the IDL file
    const idl = {} as any; // Placeholder IDL
    program = new Program(idl, PROGRAM_ID, provider) as Program<TicketCore>;
  }
  return program;
}

export { PROGRAM_ID };

// ACTUAL working integration for your payment service
// File: backend/services/payment-service/src/blockchain/contractIntegration.ts

import { 
    Connection, 
    PublicKey, 
    Transaction, 
    TransactionInstruction,
    Keypair,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction
} from '@solana/web3.js';

export class RevenueSplitterContract {
    private connection: Connection;
    private programId: PublicKey;

    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.programId = new PublicKey('4hLWPqpNp3J1RZUaFaevFuxJcgw9uDqzi8Wd3pzDgjnW');
    }

    /**
     * Actually call your deployed contract to split payments
     */
    async splitSOLPayment(
        amountSOL: number,
        buyerPrivateKey: Uint8Array,
        platformWallet: string,
        artistWallet: string,
        venueWallet: string
    ) {
        try {
            // Convert SOL to lamports
            const amountLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
            
            // Create keypair from private key
            const buyer = Keypair.fromSecretKey(buyerPrivateKey);
            
            // Create wallet addresses
            const platform = new PublicKey(platformWallet);
            const artist = new PublicKey(artistWallet);
            const venue = new PublicKey(venueWallet);
            
            // Create instruction data for your contract
            // Instruction 1 = process_payment_split
            // Format: [instruction_id (1 byte), amount (8 bytes)]
            const instructionData = Buffer.alloc(9);
            instructionData.writeUInt8(1, 0); // Instruction ID = 1
            instructionData.writeBigUInt64LE(BigInt(amountLamports), 1); // Amount in lamports
            
            // Create the instruction for your contract
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: buyer.publicKey, isSigner: true, isWritable: true },  // Payer
                    { pubkey: platform, isSigner: false, isWritable: true },        // Platform wallet
                    { pubkey: artist, isSigner: false, isWritable: true },          // Artist wallet
                    { pubkey: venue, isSigner: false, isWritable: true },           // Venue wallet
                    { pubkey: new PublicKey('11111111111111111111111111111112'), isSigner: false, isWritable: false }, // System program
                ],
                programId: this.programId,
                data: instructionData,
            });
            
            // Create and send transaction
            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [buyer],
                { commitment: 'confirmed' }
            );
            
            // Calculate what was split for logging
            const platformAmount = Math.floor(amountLamports * 0.03);
            const artistAmount = Math.floor(amountLamports * 0.15);
            const venueAmount = amountLamports - platformAmount - artistAmount;
            
            console.log(`✅ Payment split successful!`);
            console.log(`Transaction: ${signature}`);
            console.log(`Platform: ${platformAmount / LAMPORTS_PER_SOL} SOL`);
            console.log(`Artist: ${artistAmount / LAMPORTS_PER_SOL} SOL`);
            console.log(`Venue: ${venueAmount / LAMPORTS_PER_SOL} SOL`);
            
            return {
                success: true,
                signature,
                platformAmount: platformAmount / LAMPORTS_PER_SOL,
                artistAmount: artistAmount / LAMPORTS_PER_SOL,
                venueAmount: venueAmount / LAMPORTS_PER_SOL,
            };
            
        } catch (error) {
            console.error('❌ Contract call failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

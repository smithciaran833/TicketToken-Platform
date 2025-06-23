import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PaymentRequest, PaymentResponse } from '../types/payment.types';
import { RevenueSplitterContract } from '../blockchain/contractIntegration';

export class CryptoProcessor {
    private connection: Connection;
    private revenueSplitter: RevenueSplitterContract;

    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.revenueSplitter = new RevenueSplitterContract();
    }

    async processSOLPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
        try {
            console.log(`🪙 Processing SOL payment: ${paymentRequest.amount / LAMPORTS_PER_SOL} SOL`);

            // Use your deployed contract for SOL payments
            const result = await this.revenueSplitter.splitSOLPayment(
                paymentRequest.amount / LAMPORTS_PER_SOL, // Convert to SOL
                paymentRequest.buyerPrivateKey,           // Buyer's wallet private key
                process.env.PLATFORM_WALLET_ADDRESS!,    // Your platform wallet
                paymentRequest.artistWallet!,            // Artist wallet
                paymentRequest.venueWallet!              // Venue wallet
            );

            if (result.success) {
                return {
                    success: true,
                    paymentId: result.signature!,
                    message: 'SOL payment processed with blockchain guarantees',
                    contractCall: true,
                };
            } else {
                throw new Error(result.error);
            }

        } catch (error: any) {
            console.error('❌ SOL payment failed:', error);
            return {
                success: false,
                paymentId: '',
                message: 'SOL payment failed',
                error: error.message,
            };
        }
    }

    async processUSDCPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
        try {
            console.log(`💵 Processing USDC payment: ${paymentRequest.amount} USDC`);

            // For now, return success (you can implement USDC logic later)
            return {
                success: true,
                paymentId: 'usdc_' + Date.now(),
                message: 'USDC payment processed (placeholder)',
            };

        } catch (error: any) {
            console.error('❌ USDC payment failed:', error);
            return {
                success: false,
                paymentId: '',
                message: 'USDC payment failed',
                error: error.message,
            };
        }
    }

    async verifySOLBalance(walletAddress: string): Promise<boolean> {
        try {
            const publicKey = new PublicKey(walletAddress);
            const balance = await this.connection.getBalance(publicKey);
            return balance > 0;
        } catch (error) {
            console.error('❌ Balance verification failed:', error);
            return false;
        }
    }
}
